#!/usr/bin/env node
/**
 * Coletor da Assembleia Legislativa do Rio Grande do Norte (ALRN) — Brasil na Lupa.
 *
 * USO
 *   node scripts/coleta/estados/rn/coletar.mjs                 # incremental, prioriza o ano corrente
 *   node scripts/coleta/estados/rn/coletar.mjs --completo      # reprocessa tudo desde 2023
 *   node scripts/coleta/estados/rn/coletar.mjs --anos 2026     # só alguns anos
 *   node scripts/coleta/estados/rn/coletar.mjs --etapas parlamentares,votacoes,proposicoes,leis
 *   COLETA_ORCAMENTO_MIN=20 (padrão) limita o tempo; o que faltar fica no cursor de meta.json.
 *   node scripts/coleta/estados/rn/testes.mjs                  # testes offline
 *
 * SAÍDAS (dados/estados/rn/)
 *   meta.json                      meta_coleta + robots lidos + cursor
 *   parlamentares.json             deputados (sem CPF e sem data de nascimento, que a API expõe)
 *   proposicoes/indice-<ano>.json  PL, PLC, PEC, PDL, PRES, VET e Mensagens por ano do processo
 *   votacoes/<id>.json             uma por reunião × processo (plenário e comissões); índice anual
 *   normas/indice-<ano>.json       leis ordinárias e complementares (lista oficial do portal + PDF)
 *
 * FONTES: API eLegis da Transparência Legislativa (https://api-transparencialegislativa.al.rn.leg.br/
 *   elegis-api-transp-legislativa, sem documentação pública; legendas dos códigos tiradas do próprio site)
 *   e portal www.al.rn.leg.br/legislacao. robots.txt de cada host lido antes da 1.ª requisição.
 * LIMITES: no máximo 2 requisições simultâneas, 5 tentativas, User-Agent identificável, sem dependências.
 * Decretos do Governador (DOE-RN): só em PDF diário, sem fonte estruturada — fora desta versão.
 * Código de saída: 0 = ok; 1 = alguma etapa falhou (as demais são gravadas normalmente).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buscar, robotsDe, resumoRobots, emLotes, criarOrcamento, gravar, lerJson, hojeISO, estatisticas, contagemGravacao,
  gravarIndicesVotacoes, dataISO,
} from './base.mjs';
import {
  API, SITE, ORGAO, UF, CASA, SIGLAS_INDICE, siglaDe, montarParlamentar, montarProposicao, montarVotacao, situacaoDaTramitacao,
} from './elegis.mjs';
import { PORTAL, LISTAS, lerListaLeis } from './leis.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const DIR = path.join(RAIZ, 'dados', 'estados', 'rn');
const DIR_VOT = path.join(DIR, 'votacoes');
const DIR_PROP = path.join(DIR, 'proposicoes');
const DIR_NORMAS = path.join(DIR, 'normas');
const INICIO_ANO = 2023; // 63ª legislatura (2023–2027)
const REGRAS = lerJson(path.join(DIR, 'revisao', 'mascaras.json'))?.regras || []; // curadoria de privacidade (opcional)

const args = process.argv.slice(2);
const hoje = hojeISO();
const anoAtual = Number(hoje.slice(0, 4));
const completo = args.includes('--completo');
const iAnos = args.indexOf('--anos');
const anos = iAnos >= 0
  ? String(args[iAnos + 1] || '').split(',').map(Number).filter((a) => a >= 2019 && a <= anoAtual).sort((a, b) => b - a)
  : Array.from({ length: anoAtual - INICIO_ANO + 1 }, (_, i) => anoAtual - i);
const iEt = args.indexOf('--etapas');
const ETAPAS = new Set(iEt >= 0 ? String(args[iEt + 1] || '').split(',') : ['parlamentares', 'votacoes', 'proposicoes', 'leis']);
const orc = criarOrcamento();
const log = (...m) => console.log(`[${orc.decorrido().toFixed(1)}s]`, ...m);
const falhas = [];
const pendencias = [];
async function etapa(nome, fn) {
  try { return await fn(); } catch (e) { falhas.push(`${nome}: ${e.message}`); log(`FALHA em ${nome}: ${e.message}`); return null; }
}
const fonte = (titulo, url, orgao = ORGAO) => ({ titulo, url, orgao, acessado_em: hoje });
const metaAntiga = lerJson(path.join(DIR, 'meta.json')) || {};
const cursor = {
  votacoes_por_processo: {}, proposicoes_listadas_em: {}, ...(metaAntiga.cursor || {}),
};
log(`ALRN: anos ${anos.join(', ')}; orçamento ${orc.minutos} min${completo ? '; modo completo' : ''}`);

// ---------- 0. robots.txt (antes de qualquer outra requisição a cada host) ----------
for (const host of ['api-transparencialegislativa.al.rn.leg.br', 'transparencialegislativa.al.rn.leg.br', 'www.al.rn.leg.br']) {
  const r = await robotsDe(host);
  log(`robots.txt ${host}: ${r.observacao}${r.disallow.length ? ` (Disallow: ${r.disallow.join(' ')})` : ''}${r.crawl_delay_s ? ` (Crawl-delay ${r.crawl_delay_s}s)` : ''}`);
}

// ---------- 1. parlamentares ----------
const cont = { parlamentares: null };
if (ETAPAS.has('parlamentares')) await etapa('parlamentares', async () => {
  const url = `${API}/parlamentar`;
  const j = await buscar(url);
  const lista = Array.isArray(j?.dados) ? j.dados : [];
  const itens = lista.map((p) => montarParlamentar(p, hoje)).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  cont.parlamentares = { total: itens.length, em_exercicio: itens.filter((p) => p.em_exercicio).length };
  gravar(path.join(DIR, 'parlamentares.json'), {
    atualizado_em: hoje, uf: UF, casa: CASA,
    fonte: fonte('Parlamentares — Transparência Legislativa da ALRN', url),
    itens,
  });
  log(`Parlamentares: ${itens.length}`);
});

// ---------- 2. votações (plenário e comissões) ----------
const processosVotados = new Set(); // processos com votação gravada (para o índice de proposições)
const votadosNestaExecucao = new Set();
const contVot = { processos_na_lista: 0, processos_consultados: 0, votacoes_gravadas: 0, puladas_sem_mudanca: 0, sem_votos_conferidos: 0 };
if (ETAPAS.has('votacoes')) await etapa('votações', async () => {
  // 2a. Lista "últimas votações": um item por processo, com a votação mais recente.
  const itens = [];
  const tam = 200;
  for (let pag = 0; pag < 100; pag++) {
    const j = await buscar(`${API}/processo/ultimas-votacoes?pagina=${pag}&tamanhoPagina=${tam}`);
    const d = Array.isArray(j?.dados) ? j.dados : [];
    itens.push(...d);
    const anosPag = d.map((x) => Number(String(x?.resultadoVotacao?.dataSituacaoAbertura || '').slice(0, 4))).filter(Boolean);
    if (d.length < tam || itens.length >= (j?.total ?? Infinity)) break;
    // A ordem não é estritamente cronológica: só para quando a página inteira é anterior à cobertura.
    if (anosPag.length && Math.max(...anosPag) < Math.min(...anos)) break;
  }
  const ultimo = (x) => String(x?.resultadoVotacao?.dataSituacaoAbertura || '');
  const alvos = itens.filter((x) => anos.includes(Number(ultimo(x).slice(0, 4))))
    .sort((a, b) => ultimo(b).localeCompare(ultimo(a)));
  contVot.processos_na_lista = alvos.length;
  log(`Votações: ${itens.length} processo(s) na lista oficial; ${alvos.length} com votação em ${anos.join('/')}`);
  for (const f of fs.existsSync(DIR_VOT) ? fs.readdirSync(DIR_VOT) : []) {
    const m = /^rn-(\d+)-\d+\.json$/.exec(f);
    if (m) processosVotados.add(m[1]);
  }
  const recente = (iso) => iso && iso >= new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);
  let semTempo = 0;
  await emLotes(alvos, async (proc) => {
    const pid = String(proc.id);
    const ultId = proc?.resultadoVotacao?.id;
    if (!completo && cursor.votacoes_por_processo[pid] === ultId && !recente(dataISO(ultimo(proc)))) { contVot.puladas_sem_mudanca++; return; }
    if (!orc.resta()) { semTempo++; return; }
    const reun = await buscar(`${API}/processo/${pid}/reunioes`);
    contVot.processos_consultados++;
    for (const r of Array.isArray(reun?.dados) ? reun.dados : []) {
      if (!r?.resultadoVotacao) continue;
      const ano = Number(String(r.dataInicio || '').slice(0, 4));
      if (ano && ano < INICIO_ANO) continue;
      const arq = path.join(DIR_VOT, `rn-${pid}-${r.id}.json`);
      const existente = lerJson(arq);
      if (existente && !completo && !recente(existente.data)) continue;
      const det = await buscar(`${API}/processo/${pid}/detalhamento-votacao/${r.id}`);
      const reg = montarVotacao(proc, r, det, { hoje, regras: REGRAS });
      if (reg.tipo === 'nominal' && !reg.votos.length) contVot.sem_votos_conferidos++;
      gravar(arq, reg);
      contVot.votacoes_gravadas++;
      processosVotados.add(pid);
      votadosNestaExecucao.add(pid);
    }
    cursor.votacoes_por_processo[pid] = ultId;
  });
  if (semTempo) pendencias.push(`votações: ${semTempo} processo(s) ficaram para a próxima execução (orçamento de tempo)`);
  log(`Votações: ${contVot.votacoes_gravadas} gravada(s)/conferida(s) em ${contVot.processos_consultados} processo(s)`);
});

// ---------- 3. proposições ----------
const contProp = {};
const MAX_TRAMITACOES = Number(process.env.RN_MAX_TRAMITACOES) || 400; // por execução (rodízio)
if (ETAPAS.has('proposicoes')) {
  let tramitacoesFeitas = 0;
  for (const ano of anos) {
    if (!orc.resta()) { pendencias.push(`proposições ${ano}: não listadas (orçamento de tempo)`); continue; }
    const arq = path.join(DIR_PROP, `indice-${ano}.json`);
    const ultimaLista = cursor.proposicoes_listadas_em[ano];
    if (!completo && ano < anoAtual && ultimaLista && ultimaLista >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)) {
      log(`Proposições ${ano}: listadas em ${ultimaLista}; atualização semanal`);
      continue;
    }
    await etapa(`proposições ${ano}`, async () => {
      const antigos = new Map((lerJson(arq)?.itens || []).map((p) => [String(p.id_oficial ?? p.id), p]));
      const brutos = [];
      const tam = 500;
      for (let pag = 0; pag < 200; pag++) {
        const j = await buscar(`${API}/processo?pagina=${pag}&tamanhoPagina=${tam}&ano=${ano}`);
        const d = Array.isArray(j?.dados) ? j.dados : [];
        brutos.push(...d);
        if (d.length < tam || brutos.length >= (j?.total ?? Infinity)) break;
      }
      const selecionados = brutos.filter((p) => SIGLAS_INDICE.has(siglaDe(p)));
      // Situação (tramitação): novos primeiro, depois os votados agora, depois os mais antigos — com limite por execução.
      const prioridade = (p) => {
        const a = antigos.get(String(p.id));
        if (!a?.situacao) return 0;
        if (votadosNestaExecucao.has(String(p.id))) return 1;
        return 2;
      };
      const fila = [...selecionados].sort((a, b) => prioridade(a) - prioridade(b)
        || String(antigos.get(String(a.id))?.situacao?.coletada_em || '').localeCompare(String(antigos.get(String(b.id))?.situacao?.coletada_em || '')));
      const situacoes = new Map();
      await emLotes(fila, async (p) => {
        const id = String(p.id);
        const ant = antigos.get(id);
        const vencida = !ant?.situacao || ant.situacao.coletada_em < new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        if (!completo && !vencida && !votadosNestaExecucao.has(id)) return;
        if (tramitacoesFeitas >= MAX_TRAMITACOES || !orc.resta()) return;
        tramitacoesFeitas++;
        const t = await buscar(`${API}/processo/${id}/tramitacao`).catch(() => null);
        if (Array.isArray(t)) situacoes.set(id, situacaoDaTramitacao(t, hoje));
      });
      let semSituacao = 0;
      const itens = selecionados.map((p) => {
        const id = String(p.id);
        const sit = situacoes.has(id) ? situacoes.get(id) : (antigos.get(id)?.situacao ?? null);
        if (!sit) semSituacao++;
        return montarProposicao(p, { hoje, situacao: sit, temVotacao: processosVotados.has(id), regras: REGRAS });
      }).sort((a, b) => String(a.sigla).localeCompare(String(b.sigla)) || (b.numero ?? 0) - (a.numero ?? 0));
      const porSigla = {};
      for (const i of itens) porSigla[i.sigla] = (porSigla[i.sigla] || 0) + 1;
      contProp[ano] = { processos_no_ano: brutos.length, no_indice: itens.length, por_sigla: porSigla, situacao_consultada_nesta_execucao: situacoes.size, sem_situacao: semSituacao };
      if (semSituacao) pendencias.push(`proposições ${ano}: ${semSituacao} sem situação (tramitação) ainda; entram nas próximas execuções`);
      gravar(arq, {
        atualizado_em: hoje, uf: UF, casa: CASA, ano,
        fonte: fonte(`Processos protocolados em ${ano} — Transparência Legislativa da ALRN`, `${API}/processo?ano=${ano}`),
        itens,
      });
      cursor.proposicoes_listadas_em[ano] = hoje;
      log(`Proposições ${ano}: ${itens.length} no índice (de ${brutos.length} processos); situação consultada em ${situacoes.size}`);
    });
  }
}

// ---------- 4. leis ----------
const contNormas = {};
if (ETAPAS.has('leis')) await etapa('leis', async () => {
  const porAno = new Map();
  for (const lista of LISTAS) {
    const html = await buscar(`${PORTAL}/legislacao/${lista.caminho}`, { tipo: 'text' });
    const itens = lerListaLeis(html, lista, { hoje, regras: REGRAS });
    log(`Leis (${lista.tipo}): ${itens.length} na lista oficial`);
    for (const i of itens) {
      if (!i.ano || i.ano < INICIO_ANO) continue;
      if (!porAno.has(i.ano)) porAno.set(i.ano, []);
      porAno.get(i.ano).push(i);
    }
  }
  for (const [ano, itens] of porAno) {
    itens.sort((a, b) => String(b.data_assinatura || '').localeCompare(String(a.data_assinatura || '')) || a.id.localeCompare(b.id));
    const porTipo = {};
    for (const i of itens) porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1;
    contNormas[ano] = { total: itens.length, por_tipo: porTipo };
    gravar(path.join(DIR_NORMAS, `indice-${ano}.json`), {
      atualizado_em: hoje, uf: UF, ano, abrangencia: 'Leis ordinárias e complementares do Estado do Rio Grande do Norte',
      fontes: LISTAS.map((l) => fonte(`${l.titulo} — portal da ALRN`, `${PORTAL}/legislacao/${l.caminho}`)),
      itens,
    });
  }
});

// ---------- 5. índices e meta ----------
let contIndices = {};
await etapa('índices de votações', async () => { contIndices = gravarIndicesVotacoes(DIR_VOT, { uf: UF, casa: CASA, hoje }); });
const agora = new Date().toISOString();
gravar(path.join(DIR, 'meta.json'), {
  atualizado_em: agora,
  ultima_execucao: agora,
  uf: UF,
  casa: CASA,
  periodo: { anos, inicio_cobertura: `${INICIO_ANO}-01-01`, fim: hoje },
  modo: completo ? 'completo' : 'incremental',
  duracao_s: Math.round(orc.decorrido()),
  orcamento_min: orc.minutos,
  contagens: {
    parlamentares: cont.parlamentares ?? metaAntiga.contagens?.parlamentares ?? null,
    votacoes_por_ano: contIndices,
    ...(ETAPAS.has('votacoes') ? { votacoes_nesta_execucao: contVot } : {}),
    proposicoes_nesta_execucao: contProp,
    normas_por_ano: Object.keys(contNormas).length ? contNormas : (metaAntiga.contagens?.normas_por_ano ?? {}),
    requisicoes: estatisticas.requisicoes,
  },
  fontes: [
    fonte('API eLegis — Transparência Legislativa da ALRN', API),
    fonte('Transparência Legislativa da ALRN', SITE),
    fonte('Legislação — portal da ALRN', `${PORTAL}/legislacao/leis-ordinarias`),
  ],
  robots: resumoRobots(),
  observacoes: [
    'A API eLegis não tem documentação pública; rotas e legendas dos códigos (voto 0 = Não, 1 = Sim, 2 = Abstenção; tipo A = aberta, S = secreta, O = ostensiva, X = simbólica; resultado A = aprovada, R = rejeitada, X = retirado de pauta, N = não apreciado) foram tiradas do código do próprio site oficial.',
    'Votação aberta (nominal): votos individuais publicados só quando a contagem dos registros confere com o resumo oficial (Sim, Não, Abstenção); senão, placar oficial + lacuna.',
    'Votação secreta: placar oficial; a fonte só registra quem votou ("votou"), guardado como comparecimento — nunca como voto.',
    'Votação ostensiva: a fonte não registra voto individual nem placar; tipo "ostensiva" reproduz a legenda oficial (o esquema prevê nominal, simbólica e secreta).',
    'Presença: registro da reunião (presenca, ausencia-justificada ou sem registro), como a fonte traz.',
    'Emendas votadas em separado (rota detalhamento-votacao/{reunião}/{emenda}) ainda não são coletadas.',
    'A rota de parlamentares traz CPF e data de nascimento: esses campos não são lidos nem gravados. O nome do assessor das comissões também é descartado.',
    'Ementas e textos: nomes de particulares e documentos pessoais mascarados (regras do coletor de Atibaia); trechos em dúvida ficam como marcador com hash até a curadoria (dados/estados/rn/revisao/mascaras.json).',
    'Índice de proposições por ano do processo (filtro "ano" da fonte); entram PL, PLC, PEC, PDL, PRES, VET e Mensagens. Situação = última tramitação, consultada em rodízio (no máximo RN_MAX_TRAMITACOES por execução; padrão 400).',
    'Leis: lista oficial do portal da ALRN com o PDF de cada lei. O serviço privado leisestaduais.com.br, linkado no portal, não é usado.',
    'Decretos do Governador: o Diário Oficial do RN só publica PDF diário, sem fonte estruturada; não coletados nesta versão.',
    ...(pendencias.length ? [`Pendências desta execução: ${pendencias.join(' | ')}`] : []),
    ...(falhas.length ? [`Falhas nesta execução: ${falhas.join(' | ')}`] : []),
  ],
  cursor,
});
log(`Fim. Requisições: ${estatisticas.requisicoes} (retentativas ${estatisticas.retentativas}), ${(estatisticas.bytes / 1e6).toFixed(1)} MB. `
  + `Arquivos gravados: ${contagemGravacao.gravados}, inalterados: ${contagemGravacao.inalterados}.`);
if (falhas.length) { console.error('Falhas:\n- ' + falhas.join('\n- ')); process.exit(1); }
