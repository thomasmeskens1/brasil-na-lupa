#!/usr/bin/env node
/**
 * Coletor do Pará (Assembleia Legislativa, ALEPA, e Banco de Leis), Brasil na Lupa. Node 20+, sem dependências.
 *
 * USO
 *   node scripts/coleta/estados/pa/coletar.mjs                  # ano corrente
 *   node scripts/coleta/estados/pa/coletar.mjs --anos 2025,2026
 *   COLETA_ORCAMENTO_MIN=15 (padrão)  PA_MAX_JANELAS=25  PA_MAX_VOTACOES=30  PA_MAX_DETALHES=10  PA_MAX_MESES=12  PA_MAX_REQ_LEIS=250
 *   node scripts/coleta/estados/pa/testes.mjs                   # testes offline
 *
 * SAÍDA (dados/estados/pa/, mesmo contrato de PE, DF, MA e PR):
 *   meta.json, parlamentares.json, proposicoes/indice-<ano>.json, normas/indice-<ano>.json,
 *   votacoes/<id>.json + votacoes/indice-<ano>.json (votações nominais do Plenário, com o voto de cada deputado).
 *
 * COLETA INCREMENTAL (o portal é lento, ~10 s por página): a lista de proposições mostra 10 cartões por página e
 * a paginação é feita por chamadas internas do componente, que não são usadas. Por isso cada tipo de projeto é
 * consultado por janelas de datas: começa por mês; se a janela tiver mais de uma página, ela é dividida em
 * janelas menores, lidas nas próximas consultas. O estado das janelas fica em meta.json (janelas_proposicoes);
 * as do último mês e meio são relidas a cada execução. Votações: lista mensal e detalhe de cada votação ainda não
 * gravada. Banco de Leis: API aberta (até 50 por chamada), varrida por tipo e por trecho do número.
 *
 * REGRAS: robots.txt de cada host antes de qualquer outra requisição (os dois hosts não publicam: HTTP 404);
 * intervalo mínimo de 2 s por host; User-Agent do Brasil na Lupa; nenhum CAPTCHA ou bloqueio é contornado; a
 * página de perfil dos deputados (com dados pessoais) não é acessada; nomes de particulares mascarados; nada
 * deduzido. Votação só é gravada quando as quatro listas conferem com as quantidades da página.
 * Código de saída: 0 = ok; 1 = falhou por inteiro.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lerJson, hojeISO, fonte, VOTO_INDISPONIVEL, chaveNome, conferirPrivacidade } from '../abertos/base.mjs';
import { lerIndices, gravar, gravarIndices, gravarVotacoes, porDataDesc } from '../abertos/saida.mjs';
import {
  CASA_PA, TIPOS_PROP, TIPOS_NORMA, LIMITE_API_LEIS, ClientePA, interpretarDeputadosPA, interpretarListaProposicoesPA,
  interpretarDetalheProposicaoPA, aplicarDetalhePA, interpretarListaVotacoesPA, interpretarVotacaoPA, interpretarNormaPA,
  prefixosIniciais, filhos, dividirJanela, janelasMensais, dataBRdeISO,
} from './alepa.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const DIR = path.join(RAIZ, 'dados', 'estados', 'pa');
const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const hoje = hojeISO();
const anos = (val('--anos') || hoje.slice(0, 4)).split(',').map(Number).filter((a) => a >= 2000 && a <= Number(hoje.slice(0, 4)));
if (!anos.length) { console.error('Uso: --anos AAAA[,AAAA]'); process.exit(1); }
const inicio = Date.now();
const env = (k, d) => Number(process.env[k] || d);
const orcamentoMin = env('COLETA_ORCAMENTO_MIN', 15);
const MAX_JANELAS = env('PA_MAX_JANELAS', 25);
const MAX_VOT = env('PA_MAX_VOTACOES', 30);
const MAX_DET = env('PA_MAX_DETALHES', 10);
const MAX_MESES = env('PA_MAX_MESES', 12);
const MAX_REQ_LEIS = env('PA_MAX_REQ_LEIS', 250);
const RELER_DIAS = 45;
const C = CASA_PA;
const log = (...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(0)}s] [PA]`, ...m);
const cliente = new ClientePA({ prazoMs: inicio + orcamentoMin * 60000, log });
const falhas = [];
const tentar = async (rotulo, fn) => { try { return await fn(); } catch (e) { falhas.push(`${rotulo}: ${e.message}`); log(`FALHA ${rotulo}: ${e.message}`); return null; } };
const diasAntes = (n) => new Date(Date.parse(`${hoje}T12:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
fs.mkdirSync(DIR, { recursive: true });
const seguros = (lista) => lista.filter((it) => {
  try { conferirPrivacidade(it); return true; } catch (e) { falhas.push(`${it.id}: não gravado (${e.message})`); return false; }
});
const metaAnt = lerJson(path.join(DIR, 'meta.json')) || {};
const janelas = { ...(metaAnt.janelas_proposicoes || {}) };
const meses = { ...(metaAnt.meses_votacoes || {}) };
log(`anos ${anos.join(', ')}; orçamento ${orcamentoMin} min; janelas ${MAX_JANELAS}; votações ${MAX_VOT}; detalhes ${MAX_DET}`);

// ---------------------------------------------------------------- Banco de Leis (outro host: roda em paralelo)
const normas = lerIndices(DIR, 'normas');
const totaisN = {};
let reqLeis = 0, truncadasLeis = 0;
async function consultarLeis(q) {
  if (reqLeis >= MAX_REQ_LEIS || !cliente.cabe()) return null;
  reqLeis++;
  const d = await cliente.json(`${C.leis}/api/leis.php?${new URLSearchParams(q)}`);
  if (!d || d.status !== true || !Array.isArray(d.resultados)) throw new Error(`resposta inesperada da API do Banco de Leis (${d?.mensagem ?? 'sem status'})`);
  return d.resultados;
}
const fluxoNormas = (async () => {
  for (const ano of anos) {
    for (const [tipo, def] of Object.entries(TIPOS_NORMA)) {
      const vistos = new Set();
      const add = (lista) => {
        let n = 0;
        for (const r of lista) {
          const it = interpretarNormaPA(r, hoje);
          if (!it || it.ano !== ano || it.tipo !== def.tipo) continue;
          normas.set(it.id, it); vistos.add(it.id); n++;
        }
        return n;
      };
      const base = await tentar(`normas ${ano} ${def.fonte}`, () => consultarLeis({ ano, tipo }));
      if (!base) continue;
      add(base);
      if (base.length >= LIMITE_API_LEIS) {
        // A API corta em 50 sem paginar: varre pelo trecho inicial do número, do maior para o menor.
        const maior = Math.max(...base.map((r) => Number(r.numero)).filter(Number.isFinite));
        const tam = String(maior).length;
        const varrer = async (p) => {
          const lista = await tentar(`normas ${ano} ${def.fonte} nº ${p}`, () => consultarLeis({ ano, tipo, numero: p }));
          if (!lista) return 0;
          add(lista);
          let n = lista.filter((r) => String(r.numero).startsWith(p)).length;
          if (lista.length >= LIMITE_API_LEIS) {
            if (p.length < tam) { n = 0; for (const f of filhos(p)) n += await varrer(f); } else truncadasLeis++;
          }
          return n;
        };
        let achou = false, vazias = 0;
        for (const p of prefixosIniciais(maior)) {
          const n = await varrer(p);
          if (n) { achou = true; vazias = 0; } else if (achou && ++vazias >= 2) break;
        }
      }
      totaisN[`${ano} ${def.tipo}`] = vistos.size;
    }
  }
  log(`normas: ${JSON.stringify(totaisN)} (${reqLeis} consultas à API)`);
})();

// ---------------------------------------------------------------- 1) Deputados
let parl = lerJson(path.join(DIR, 'parlamentares.json'));
const htmlDep = await tentar('deputados', () => cliente.texto(`${C.portal}/Institucional/Deputados`, { aceitar: 'text/html' }));
if (htmlDep) {
  const novo = interpretarDeputadosPA(htmlDep, hoje);
  if (novo.itens.length >= 35 && novo.itens.every((d) => d.id_oficial)) { parl = novo; gravar(path.join(DIR, 'parlamentares.json'), parl); log(`deputados: ${parl.itens.length}`); }
  else falhas.push(`deputados: a página trouxe ${novo.itens.length} cartões (ou sem o código oficial); lista anterior mantida`);
}
const porNome = new Map((parl?.itens || []).map((p) => [chaveNome(p.nome), p.id]));

// ---------------------------------------------------------------- 2) Votações nominais: listas mensais
const votDir = path.join(DIR, 'votacoes');
const votacoes = new Map();
for (const f of fs.existsSync(votDir) ? fs.readdirSync(votDir) : []) {
  if (!/^pa-\d+\.json$/.test(f)) continue;
  const v = lerJson(path.join(votDir, f));
  if (v?.id) votacoes.set(v.id, v);
}
const refs = new Map(Object.values(meses).flatMap((m) => m.itens || []).map((r) => [r.id_votacao, r]));
const mesAtual = hoje.slice(0, 7);
const mesAnterior = diasAntes(Number(hoje.slice(8, 10)) + 1).slice(0, 7);
const filaMeses = [];
for (const ano of anos) for (let m = 12; m >= 1; m--) {
  const chave = `${ano}-${String(m).padStart(2, '0')}`;
  if (chave > mesAtual) continue;
  const e = meses[chave];
  const fimMes = new Date(Date.UTC(ano, m, 0, 12)).toISOString().slice(0, 10);
  if (!e || chave >= mesAnterior || e.lida_em <= fimMes) filaMeses.push({ chave, ano, mes: m });
}
filaMeses.sort((a, b) => b.chave.localeCompare(a.chave));
let mesesLidos = 0;
for (const { chave, ano, mes } of filaMeses.slice(0, MAX_MESES)) {
  if (!cliente.cabe()) break;
  const html = await tentar(`votações ${chave}`, () => cliente.formulario(`${C.portal}/Legislativo/VotacoesNominais`, { Ano: String(ano), Mes: String(mes), Mes_VI: String(mes) }));
  if (!html) continue;
  const r = await tentar(`votações ${chave}`, async () => interpretarListaVotacoesPA(html, hoje));
  if (!r) continue;
  const fora = r.itens.filter((x) => !x.data || x.data.slice(0, 7) !== chave);
  if (fora.length) { falhas.push(`votações ${chave}: o portal devolveu ${fora.length} votação(ões) de outro mês; lista descartada`); continue; }
  meses[chave] = { lida_em: hoje, paginas: r.paginas, itens: r.itens };
  if (r.paginas > 1) falhas.push(`votações ${chave}: a lista tem ${r.paginas} páginas e só a primeira (10 votações) é lida pelo formulário; as demais entram pelo detalhe das proposições`);
  for (const x of r.itens) refs.set(x.id_votacao, x);
  mesesLidos++;
}
log(`votações: ${mesesLidos} mês(es) lido(s); ${refs.size} votações nominais listadas`);

// ---------------------------------------------------------------- 3) Proposições por janelas de datas
const projetos = lerIndices(DIR, 'proposicoes');
const ORDEM_TIPOS = [4, 2, 3, 1, 5];
const chaveJ = (tipo, ini, fim) => `${tipo}|${ini}|${fim}`;
function folhas(tipo, ini, fim) {
  const e = janelas[chaveJ(tipo, ini, fim)];
  if (e?.situacao === 'dividida') return dividirJanela(ini, fim, e.partes).flatMap(([a, b]) => folhas(tipo, a, b));
  return [{ tipo, ini, fim, e }];
}
const pendente = (f) => !f.e || (f.fim >= diasAntes(RELER_DIAS) && f.e.lida_em < hoje) || (f.e.situacao === 'vazia' && f.e.lida_em < diasAntes(7));
const mesclar = (it) => {
  const ant = projetos.get(it.id);
  projetos.set(it.id, ant?.detalhe_coletado_em
    ? { ...it, situacao: ant.situacao, deliberacoes_plenario: ant.deliberacoes_plenario, situacao_coletada_em: ant.situacao_coletada_em, detalhe_coletado_em: ant.detalhe_coletado_em, lacunas: ant.lacunas }
    : it);
};
const filaJ = [];
for (const ano of anos) for (const [ini, fim] of janelasMensais(ano, hoje)) for (const t of ORDEM_TIPOS) filaJ.push(...folhas(t, ini, fim).filter(pendente));
filaJ.sort((a, b) => b.fim.localeCompare(a.fim) || ORDEM_TIPOS.indexOf(a.tipo) - ORDEM_TIPOS.indexOf(b.tipo));
let janelasLidas = 0;
while (filaJ.length && janelasLidas < MAX_JANELAS && cliente.cabe()) {
  const j = filaJ.shift();
  const ano = Number(j.ini.slice(0, 4));
  const rot = `proposições ${TIPOS_PROP[j.tipo].sigla} ${j.ini}…${j.fim}`;
  const html = await tentar(rot, () => cliente.formulario(`${C.portal}/Legislativo/Proposicoes`, {
    Ano: String(ano), DataInicio: dataBRdeISO(j.ini), DataFim: dataBRdeISO(j.fim), ComboBoxTipoProposicao_VI: String(j.tipo), ComboBoxTipoProposicao: String(j.tipo),
  }));
  if (!html) continue;
  const r = await tentar(rot, async () => interpretarListaProposicoesPA(html, hoje, porNome));
  if (!r) continue;
  janelasLidas++;
  const k = chaveJ(j.tipo, j.ini, j.fim);
  const fora = r.itens.filter((x) => x.sigla !== TIPOS_PROP[j.tipo].sigla || !x.data_apresentacao || x.data_apresentacao < j.ini || x.data_apresentacao > j.fim);
  if (fora.length) { falhas.push(`${rot}: ${fora.length} cartão(ões) fora do tipo ou do período pedido; janela descartada`); continue; }
  for (const it of r.itens) mesclar(it);
  const dias = Math.round((Date.parse(j.fim) - Date.parse(j.ini)) / 86400000) + 1;
  if (r.paginas > 1 && dias > 1) {
    const partes = Math.max(2, Math.ceil(r.paginas * 1.5));
    janelas[k] = { situacao: 'dividida', partes, paginas: r.paginas, lida_em: hoje };
    filaJ.unshift(...dividirJanela(j.ini, j.fim, partes).map(([a, b]) => ({ tipo: j.tipo, ini: a, fim: b, e: null })));
  } else {
    janelas[k] = { situacao: r.paginas > 1 ? 'truncada' : r.vazia ? 'vazia' : 'completa', paginas: r.paginas, itens: r.itens.length, lida_em: hoje };
  }
}
const pendentesJ = anos.flatMap((ano) => janelasMensais(ano, hoje).flatMap(([ini, fim]) => ORDEM_TIPOS.flatMap((t) => folhas(t, ini, fim)))).filter((f) => !f.e).length;
log(`proposições: ${janelasLidas} janela(s) lida(s), ${pendentesJ} ainda não lida(s); ${projetos.size} projetos gravados`);

// ---------------------------------------------------------------- 4) Detalhe das proposições (PLC e PEC primeiro, mais novas antes)
const peso = (p) => (p.sigla === 'PLC' || p.sigla === 'PEC' ? 0 : 1);
const filaD = [...projetos.values()].filter((p) => anos.includes(p.ano) && !p.detalhe_coletado_em)
  .sort((a, b) => peso(a) - peso(b) || String(b.data_apresentacao || '').localeCompare(String(a.data_apresentacao || '')) || b.id_oficial - a.id_oficial);
let detalhados = 0;
for (const p of filaD.slice(0, MAX_DET)) {
  if (!cliente.cabe()) break;
  const html = await tentar(`proposição ${p.id_oficial}`, () => cliente.texto(p.url, { aceitar: 'text/html' }));
  const det = html ? interpretarDetalheProposicaoPA(html, hoje) : null;
  if (!det) continue;
  projetos.set(p.id, aplicarDetalhePA(p, det, hoje));
  for (const t of det.turnos) if (t.id_votacao && !refs.has(t.id_votacao)) refs.set(t.id_votacao, { id_proposicao: p.id_oficial, id_votacao: t.id_votacao, data: t.data, titulo: null });
  detalhados++;
}
log(`detalhes de proposições: ${detalhados} (faltam ${Math.max(0, filaD.length - detalhados)})`);

// ---------------------------------------------------------------- 5) Detalhe das votações ainda não gravadas
const filaV = [...refs.values()].filter((r) => !votacoes.has(`pa-${r.id_votacao}`) && anos.includes(Number(String(r.data || '').slice(0, 4))))
  .sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id_votacao - a.id_votacao);
let votLidas = 0;
const naoGravadas = [];
for (const r of filaV.slice(0, MAX_VOT)) {
  if (!cliente.cabe()) break;
  const html = await tentar(`votação ${r.id_votacao}`, () => cliente.texto(`${C.portal}/Legislativo/DetalhesVotacaoNominal?IdProposicao=${r.id_proposicao}&IdVotacao=${r.id_votacao}`, { aceitar: 'text/html' }));
  if (!html) continue;
  const v = interpretarVotacaoPA(html, r, hoje, porNome, projetos);
  if (v.erro) { naoGravadas.push(`votação ${r.id_votacao}: ${v.erro}`); falhas.push(`votação ${r.id_votacao} não gravada: ${v.erro}`); continue; }
  votacoes.set(v.votacao.id, v.votacao);
  votLidas++;
}
log(`votações gravadas nesta execução: ${votLidas} (faltam ${Math.max(0, filaV.length - votLidas)}; não conferidas: ${naoGravadas.length})`);

await fluxoNormas;

// ---------------------------------------------------------------- 6) Gravação
const listaP = [...projetos.values()];
const listaN = [...normas.values()];
const listaV = [...votacoes.values()].map((v) => {
  const p = projetos.get(v.proposicao?.id);
  return p ? { ...v, proposicao: { ...v.proposicao, ementa: p.ementa ?? v.proposicao.ementa } } : v;
});
const contP = gravarIndices(DIR, 'proposicoes', seguros(listaP), (p) => p.ano, (ano) => ({
  atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano,
  fonte: fonte(`Proposições de ${ano} — portal da ALEPA (consulta de proposições)`, `${C.portal}/Legislativo/Proposicoes`, C.nome, hoje),
}), porDataDesc('data_apresentacao'));
const contN = gravarIndices(DIR, 'normas', seguros(listaN), (n) => n.ano, (ano) => ({
  atualizado_em: hoje, uf: C.uf, ano: Number(ano) || ano,
  abrangencia: 'Leis ordinárias e complementares, decretos do Executivo estadual, decretos legislativos, resoluções e emendas constitucionais cadastrados no Banco de Leis da ALEPA (API aberta).',
  fontes: [fonte('API do Banco de Leis da ALEPA', `${C.leis}/api/leis.php?ano=${ano}`, C.nome, hoje)],
}), (a, b) => String(a.tipo).localeCompare(String(b.tipo), 'pt-BR') || (b.numero || 0) - (a.numero || 0) || String(a.id).localeCompare(String(b.id)));
const contV = gravarVotacoes(DIR, seguros(listaV), (ano) => ({ atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano }));

const meta = {
  atualizado_em: new Date().toISOString(), ultima_execucao: new Date(inicio).toISOString(), uf: C.uf, casa: C.casa, orgao: C.nome,
  periodo: { anos, fim: hoje }, modo: 'incremental',
  fontes: [
    fonte('Votações nominais — portal da ALEPA', `${C.portal}/Legislativo/VotacoesNominais`, C.nome, hoje),
    fonte('Proposições — portal da ALEPA', `${C.portal}/Legislativo/Proposicoes`, C.nome, hoje),
    fonte('Deputados da 61ª legislatura — portal da ALEPA', `${C.portal}/Institucional/Deputados`, C.nome, hoje),
    fonte('Dados Abertos API do Banco de Leis (documentação)', `${C.leis}/api.php`, C.nome, hoje),
  ],
  robots: cliente.resumoRobots(),
  execucao: { requisicoes: cliente.requisicoes, consultas_banco_de_leis: reqLeis, falhas: [...new Set([...falhas, ...cliente.falhas])].slice(0, 60) },
  contagens: {
    parlamentares: parl?.itens?.length ?? 0, proposicoes_por_ano: contP, normas_por_ano: contN, normas_por_tipo: totaisN, votacoes_por_ano: contV,
    votacoes_listadas: refs.size, votacoes_nao_conferidas: naoGravadas.length,
    votos_sem_ligacao_com_deputado: listaV.reduce((s, v) => s + v.votos.filter((x) => !x.parlamentar_id).length, 0),
    janelas_lidas_nesta_execucao: janelasLidas, janelas_nunca_lidas: pendentesJ,
    janelas_truncadas: Object.values(janelas).filter((e) => e.situacao === 'truncada').length,
    proposicoes_detalhadas_nesta_execucao: detalhados, proposicoes_sem_detalhe: listaP.filter((p) => !p.detalhe_coletado_em).length,
    consultas_truncadas_banco_de_leis: truncadasLeis,
  },
  observacoes: [
    'Fontes: portal da Assembleia Legislativa do Pará (páginas HTML) e API aberta do Banco de Leis da ALEPA. Nenhum dos dois hosts publica robots.txt (HTTP 404: nenhuma restrição declarada); intervalo mínimo de 2 s entre requisições ao mesmo host. O portal é lento (cerca de 10 s por página) e às vezes responde com página de erro: a coleta é incremental e o que falha fica para a próxima execução.',
    'Votações: a ALEPA publica a votação nominal (lista mensal e detalhe) com tipo e número da sessão, projeto, data, autor, turno, resultado e as listas Sim, Não, Abstenção e Não votaram, com nome e partido como impressos na página (federações aparecem com a sigla da página, por exemplo "FE PT PV PCdoB"). Cada votação só é gravada quando o número de nomes de cada lista confere com a quantidade informada e a soma confere com o total. "Não votaram" é registrado como está na página, sem dizer se o deputado estava ausente.',
    `Votações simbólicas: a ficha da proposição traz só o turno, a data e o resultado (por exemplo "REDAÇÃO FINAL: APROVADA"); ficam na proposição, sem voto individual ("${VOTO_INDISPONIVEL}"). A ALEPA registra votação nominal só em parte das matérias (em 2026, projetos de lei complementar e propostas de emenda à Constituição).`,
    'Deputados: página "Deputados da 61ª legislatura" (nome parlamentar e partido). O voto é ligado ao deputado só quando o nome da lista de votação é idêntico ao da página (sem acentos e maiúsculas); alguns nomes diferem (ex.: "Aveilton" × "AVEILTON SOUZA") e o voto fica sem ligação com o perfil, mas aparece na votação. As páginas de perfil não são acessadas (trazem dados pessoais).',
    'Proposições: só projetos (de lei, de lei complementar, de decreto legislativo, de resolução) e propostas de emenda à Constituição; indicações, requerimentos, moções e processos não são coletados. A lista do portal mostra 10 por página; cada tipo é lido por janelas de datas, divididas quando passam de uma página. A data de apresentação é a data de entrada mostrada na lista. A ficha (situação, regime e votação no Plenário por turno) é lida aos poucos (PA_MAX_DETALHES por execução, PLC e PEC primeiro).',
    'Normas: API do Banco de Leis (leis, leis complementares, decretos do Executivo, decretos legislativos, resoluções e emendas constitucionais), com ementa e PDF oficial. A API não informa as datas de assinatura e de publicação nem o projeto de origem ("Informação não disponível em fonte oficial"); o texto completo está no PDF. A API devolve no máximo 50 resultados por chamada, sem paginação: tipos com mais normas no ano são varridos pelo trecho inicial do número.',
    'Vetos e razões de veto: publicados só no Diário Oficial do Estado (PDF no Google Drive, busca fora do ar em 2026-11-02); não são coletados.',
  ],
  janelas_proposicoes: janelas,
  meses_votacoes: meses,
};
gravar(path.join(DIR, 'meta.json'), meta);
const ok = Boolean(parl?.itens?.length || projetos.size || normas.size || votacoes.size);
log(`${ok ? 'ok' : 'falhou'} — ${JSON.stringify(meta.contagens)}`);
process.exit(ok ? 0 : 1);
