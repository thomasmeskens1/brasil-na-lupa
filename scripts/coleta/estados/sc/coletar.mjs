#!/usr/bin/env node
/**
 * Coletor de Santa Catarina (Assembleia Legislativa, ALESC: portal, e-Legis e Legislação SC), Brasil na Lupa.
 * Node 20+, sem dependências. Raspagem de HTML (a ALESC não tem API pública de processo legislativo).
 *
 * USO
 *   node scripts/coleta/estados/sc/coletar.mjs                  # ano corrente
 *   node scripts/coleta/estados/sc/coletar.mjs --anos 2025,2026
 *   COLETA_ORCAMENTO_MIN=15 (padrão)
 *   SC_MAX_PAGINAS_PROPOSICOES=100  SC_MAX_TRAMITACOES=60  SC_MAX_PAGINAS_SESSOES=20  SC_MAX_SESSOES=40
 *   SC_MAX_PAGINAS_NORMAS=30 (por seção: leis e decretos)  SC_MAX_FICHAS_LEIS=60
 *   node scripts/coleta/estados/sc/testes.mjs                   # testes offline
 *
 * SAÍDA (dados/estados/sc/, mesmo contrato de PR, MA, PE e DF):
 *   meta.json, parlamentares.json, proposicoes/indice-<ano>.json, normas/indice-<ano>.json,
 *   votacoes/<id>.json + votacoes/indice-<ano>.json (um registro por item votado na Ordem do Dia; voto de cada deputado
 *   só nas votações nominais, do "Extrato de votação"), sessoes/indice-<ano>.json (cursor das sessões já lidas).
 *
 * INCREMENTAL: os próprios arquivos guardam o estado. A lista de proposições do ano é relida inteira (10 por página);
 * a tramitação só das que mudaram de situação ou setor. Sessões: só as ainda não lidas depois de "Realizada".
 * Leis e decretos: páginas novas no topo da lista e, depois, as antigas a partir do cursor gravado em meta.json.
 *
 * REGRAS: robots.txt de cada host antes de qualquer outra requisição (o do portal proíbe /wp-json/, que nunca é usado);
 * intervalo mínimo de 2 s por host (Crawl-delay + 1 s, se declarado); User-Agent do projeto; nenhum CAPTCHA ou bloqueio
 * é contornado (o cabeçalho X-Requested-With do extrato é o mesmo que o próprio site envia); nomes de particulares
 * mascarados; partido na data da votação nunca deduzido. Código de saída: 0 = ok; 1 = falhou por inteiro.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lerJson, hojeISO, fonte, chaveNome, conferirPrivacidade } from '../abertos/base.mjs';
import { lerIndices, gravar, gravarIndices, gravarVotacoes, porDataDesc } from '../abertos/saida.mjs';
import {
  CASA_SC, INDISPONIVEL, ClienteSC, interpretarDeputadosSC, chaveAutor, tiposPropositura, totalExibindo,
  interpretarListaProposicoesSC, interpretarTramitacaoSC, aplicarTramitacaoSC, marcaAndamento, interpretarSessoesSC,
  ultimaPagina, interpretarOrdemDoDiaSC, interpretarExtratoSC, votacaoSC, interpretarListaNormasSC,
  interpretarFichaLeiSC, aplicarFichaLeiSC,
} from './alesc.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const DIR = path.join(RAIZ, 'dados', 'estados', 'sc');
const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const hoje = hojeISO();
const anos = (val('--anos') || hoje.slice(0, 4)).split(',').map(Number).filter((a) => a >= 2000 && a <= Number(hoje.slice(0, 4)));
if (!anos.length) { console.error('Uso: --anos AAAA[,AAAA]'); process.exit(1); }
const env = (k, d) => (Number.isFinite(Number(process.env[k])) && process.env[k] !== '' && process.env[k] != null ? Number(process.env[k]) : d);
const orcamentoMin = env('COLETA_ORCAMENTO_MIN', 15);
const MAX_PAG_PROP = env('SC_MAX_PAGINAS_PROPOSICOES', 100);
const MAX_TRAM = env('SC_MAX_TRAMITACOES', 60);
const MAX_PAG_SES = env('SC_MAX_PAGINAS_SESSOES', 20);
const MAX_SES = env('SC_MAX_SESSOES', 40);
const MAX_PAG_NORMAS = env('SC_MAX_PAGINAS_NORMAS', 30);
const MAX_FICHAS = env('SC_MAX_FICHAS_LEIS', 60);
// Tipos do filtro "tipoPropositura" coletados (projetos, vetos e medidas provisórias). Ofícios, abaixo-assinados,
// anteprojetos, representações e sugestões legislativas ficam de fora (podem trazer dados de particulares).
const TIPOS_COLETADOS = new Set([1, 2, 6, 7, 8, 10, 15, 22, 25]);

const inicio = Date.now();
const log = (...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(0)}s] [SC]`, ...m);
const C = CASA_SC;
const cliente = new ClienteSC({ prazoMs: inicio + orcamentoMin * 60000, log });
const falhas = [];
const tentar = async (rotulo, fn) => { try { return await fn(); } catch (e) { falhas.push(`${rotulo}: ${e.message}`); log(`FALHA ${rotulo}: ${e.message}`); return null; } };
const html = (url) => cliente.texto(url, { aceitar: 'text/html' });
fs.mkdirSync(DIR, { recursive: true });
const seguros = (lista) => lista.filter((it) => {
  try { conferirPrivacidade(it); return true; } catch (e) { falhas.push(`${it.id}: não gravado (${e.message})`); return false; }
});
const metaAnt = lerJson(path.join(DIR, 'meta.json')) || {};
log(`anos ${anos.join(', ')}; orçamento ${orcamentoMin} min`);

// 1) Deputados (página inicial do portal; uma requisição)
let parl = lerJson(path.join(DIR, 'parlamentares.json'));
const home = await tentar('deputados', () => html(`${C.portal}/`));
if (home) {
  const novo = interpretarDeputadosSC(home, hoje);
  if (novo.itens.length >= 35) { parl = novo; gravar(path.join(DIR, 'parlamentares.json'), parl); log(`deputados: ${parl.itens.length}`); }
  else falhas.push(`deputados: a página trouxe só ${novo.itens.length} cartões; lista anterior mantida`);
}
const porNomeVoto = new Map((parl?.itens || []).map((p) => [chaveNome(p.nome), p.id]));
const porNomeAutor = new Map((parl?.itens || []).map((p) => [chaveAutor(p.nome), p.id]));

const props = lerIndices(DIR, 'proposicoes');
const normas = lerIndices(DIR, 'normas');
const cursorNormas = structuredClone(metaAnt.normas_cursor || {});
const totais = {}, totaisN = {};
let tramLidas = 0, sessoesLidas = 0, extratosLidos = 0, fichasLidas = 0;
const sessoes = lerIndices(DIR, 'sessoes');
const votacoes = new Map();
for (const f of fs.existsSync(path.join(DIR, 'votacoes')) ? fs.readdirSync(path.join(DIR, 'votacoes')) : []) {
  if (!f.endsWith('.json') || f.startsWith('indice')) continue;
  const v = lerJson(path.join(DIR, 'votacoes', f));
  if (v?.id && v.tipo) votacoes.set(v.id, v);
  else fs.rmSync(path.join(DIR, 'votacoes', f)); // registro sem forma de votação (versão anterior do coletor)
}
const TIPOS_NORMA_OK = new Set(['Lei Ordinária', 'Lei Complementar', 'Decreto Executivo', 'Decreto Legislativo', 'Resolução', 'Emenda Constitucional']);
for (const [id, n] of normas) if (!TIPOS_NORMA_OK.has(n.tipo_oficial)) normas.delete(id);

// 2) e-Legis: proposições, tramitações, sessões e votações (um host, uma fila)
async function eLegis() {
  // 2a) Proposições do ano, tipo a tipo (o tipo vem do próprio filtro da fonte)
  let paginas = 0;
  const primeira = await tentar('formulário de proposições', () => html(`${C.elegis}/proposicoes/processo-legislativo`));
  const tipos = primeira ? tiposPropositura(primeira).filter((t) => TIPOS_COLETADOS.has(t.codigo)) : [];
  for (const ano of anos) {
    totais[ano] = {};
    for (const t of tipos) {
      for (let pag = 1; paginas < MAX_PAG_PROP; pag++) {
        if (!cliente.cabe()) break;
        const q = `tipoPropositura=${t.codigo}&inicio=${ano}-01-01&fim=${ano}-12-31&arquivados=1&page=${pag}`;
        const h = await tentar(`proposições ${t.nome} ${ano} p.${pag}`, () => html(`${C.elegis}/proposicoes/processo-legislativo?${q}`));
        paginas++;
        if (!h) break;
        const total = totalExibindo(h);
        const lista = interpretarListaProposicoesSC(h, t.nome, hoje, porNomeAutor);
        for (const it of lista) {
          const ant = props.get(it.id);
          props.set(it.id, ant?.tramitacao ? {
            ...it, regime_tramitacao: ant.regime_tramitacao, materia: ant.materia, processo_origem: ant.processo_origem,
            tramitacao: ant.tramitacao, tramitacao_marca: ant.tramitacao_marca, tramitacao_coletada_em: ant.tramitacao_coletada_em,
            situacao: { ...it.situacao, ultima_tramitacao: ant.situacao?.ultima_tramitacao ?? null, url_norma: ant.situacao?.url_norma ?? null, norma: ant.situacao?.norma ?? null },
            privacidade_pendente: it.privacidade_pendente || ant.privacidade_pendente, lacunas: [...new Set([...it.lacunas, ...(ant.lacunas || []).filter((l) => /particular/.test(l))])],
          } : it);
        }
        if (total == null) { if (!lista.length) break; continue; }
        totais[ano][t.nome] = total;
        if (pag * 10 >= total || !lista.length) break;
      }
    }
    log(`proposições ${ano}: ${[...props.values()].filter((p) => p.ano === ano).length} (na fonte, por tipo: ${JSON.stringify(totais[ano])})`);
  }

  // 2b) Tramitação das que andaram (ou nunca lidas), mais recentes primeiro
  const fila = [...props.values()].filter((p) => anos.includes(p.ano) && p.tramitacao_marca !== marcaAndamento(p)).sort(porDataDesc('data_apresentacao'));
  for (const p of fila.slice(0, MAX_TRAM)) {
    if (!cliente.cabe()) break;
    const h = await tentar(`tramitação ${p.identificacao_oficial}`, () => html(`${C.elegis}/proposicoes/${p.id_oficial}/tramitacoes`));
    if (!h) continue;
    props.set(p.id, aplicarTramitacaoSC(p, interpretarTramitacaoSC(h, hoje), hoje));
    tramLidas++;
  }
  log(`tramitações lidas: ${tramLidas} (faltam ${Math.max(0, fila.length - tramLidas)})`);

  // 2c) Sessões plenárias do ano (lista, mais novas primeiro)
  const menorAno = Math.min(...anos);
  for (let pag = 1; pag <= MAX_PAG_SES; pag++) {
    if (!cliente.cabe()) break;
    const h = await tentar(`sessões p.${pag}`, () => html(`${C.elegis}/sessoes-plenarias?page=${pag}`));
    if (!h) break;
    const lista = interpretarSessoesSC(h, hoje);
    for (const s of lista) {
      if (!s.data || !anos.includes(Number(s.data.slice(0, 4)))) continue;
      const ant = sessoes.get(s.id);
      sessoes.set(s.id, { ...ant, ...s, ano: Number(s.data.slice(0, 4)) });
    }
    const ultima = lista.at(-1)?.data;
    if (!lista.length || (ultima && Number(ultima.slice(0, 4)) < menorAno) || pag >= ultimaPagina(h, '/sessoes-plenarias?')) break;
  }

  // 2d) Ordem do Dia das sessões realizadas ainda não lidas (ou com extrato pendente), mais antigas primeiro
  const filaS = [...sessoes.values()]
    .filter((s) => s.data && s.data <= hoje && s.situacao === 'Realizada' && (!s.ordem_lida_em || s.extratos_pendentes > 0))
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.hora).localeCompare(String(b.hora)));
  for (const s of filaS.slice(0, MAX_SES)) {
    if (!cliente.cabe()) break;
    const h = await tentar(`ordem do dia ${s.titulo} ${s.data}`, () => html(s.url));
    if (!h) continue;
    const od = interpretarOrdemDoDiaSC(h, hoje);
    const sessao = { ...s, tipo: od.sessao.tipo, hora_inicio: od.sessao.hora_inicio, titulo: od.sessao.titulo || s.titulo };
    let pendentes = 0, nominais = 0;
    for (const item of od.itens) {
      let extrato = null;
      if (/nominal/i.test(item.forma_oficial || '') && item.extrato_id_oficial) {
        nominais++;
        const id = `${s.id}-v${item.numero_item}`;
        const ant = votacoes.get(id);
        if (ant?.votos_situacao === 'coletados' && ant.extrato_id_oficial === item.extrato_id_oficial) { votacoes.set(id, { ...ant, fonte: { ...ant.fonte } }); continue; }
        if (cliente.cabe()) {
          const x = await tentar(`extrato ${item.identificacao_oficial}`, () => html(`${C.elegis}/extrato-votacao/${item.extrato_id_oficial}`));
          if (x) { extrato = interpretarExtratoSC(x); extratosLidos++; }
        }
        if (!extrato) pendentes++;
      }
      const v = votacaoSC(sessao, item, extrato, { hoje, porNome: porNomeVoto, props });
      votacoes.set(v.id, v);
    }
    sessoes.set(s.id, { ...sessao, ordem_lida_em: hoje, itens_votados: od.itens.length, nominais, extratos_pendentes: pendentes });
    sessoesLidas++;
  }
  log(`sessões lidas: ${sessoesLidas} (faltam ${Math.max(0, filaS.length - sessoesLidas)}); extratos: ${extratosLidos}`);
}

// 3) Legislação SC: leis (seção Legislação) e decretos do Governador (seção Decretos do Executivo)
async function legislacao() {
  for (const secao of ['legislativo', 'executivo']) {
    for (const ano of anos) {
      const cur = (cursorNormas[secao] ??= {})[ano] ??= { pagina: 0, completo: false };
      const ler = async (pag) => {
        const h = await tentar(`${secao} ${ano} p.${pag}`, () => html(`${C.leis}/${secao}?ano=${ano}&sort=data_desc&page=${pag}`));
        const r = h ? interpretarListaNormasSC(h, secao, hoje) : null;
        if (!r) { if (h) falhas.push(`${secao} ${ano} p.${pag}: lista não encontrada na página`); return null; }
        totaisN[`${secao}-${ano}`] = r.total;
        let novos = 0;
        for (const it of r.itens) {
          if (it.ano !== ano) continue;
          const ant = normas.get(it.id);
          if (!ant) novos++;
          normas.set(it.id, ant?.detalhe_coletado ? { ...it, ...Object.fromEntries(['detalhe_coletado', 'procedencia', 'data_publicacao', 'publicacao', 'projeto_origem', 'lacunas'].map((k) => [k, ant[k]])) } : it);
        }
        return { novos, n: r.itens.length, fim: pag * 5 >= (r.total ?? 0) || !r.itens.length };
      };
      let lidas = 0;
      // topo da lista: atos novos (até uma página sem novidade)
      for (let pag = 1; lidas < MAX_PAG_NORMAS && cliente.cabe(); pag++) {
        const r = await ler(pag); lidas++;
        if (!r || !r.novos || r.fim) { if (r?.fim) cur.completo = true; break; }
        if (pag > cur.pagina) cur.pagina = pag;
      }
      // páginas antigas a partir do cursor
      while (!cur.completo && lidas < MAX_PAG_NORMAS && cliente.cabe()) {
        const r = await ler(cur.pagina + 1); lidas++;
        if (!r) break;
        cur.pagina++;
        if (r.fim) cur.completo = true;
      }
      log(`${secao} ${ano}: ${[...normas.values()].filter((n) => n.ano === ano && (secao === 'executivo') === (n.tipo === 'Decreto')).length} de ${totaisN[`${secao}-${ano}`] ?? '?'} na fonte; cursor p.${cur.pagina}${cur.completo ? ' (completo)' : ''}`);
    }
  }
  // Fichas das leis (Diário Oficial e proposição de origem), mais recentes primeiro
  const fila = [...normas.values()].filter((n) => n.detalhe_coletado === false).sort(porDataDesc('data_assinatura'));
  for (const n of fila.slice(0, MAX_FICHAS)) {
    if (!cliente.cabe()) break;
    const h = await tentar(`ficha ${n.nome_oficial}`, () => html(n.url));
    if (!h) continue;
    normas.set(n.id, aplicarFichaLeiSC(n, interpretarFichaLeiSC(h, hoje), hoje));
    fichasLidas++;
  }
  log(`fichas de leis: ${fichasLidas} (faltam ${Math.max(0, fila.length - fichasLidas)})`);
}

// Hosts diferentes, relógios independentes: as duas filas andam juntas.
await Promise.all([eLegis(), legislacao()]);

// 4) Ligações norma → proposição (link da "Natureza" na ficha da lei)
for (const n of normas.values()) {
  const p = n.projeto_origem?.id ? props.get(n.projeto_origem.id) : null;
  if (p) props.set(p.id, { ...p, situacao: { ...p.situacao, url_norma: n.url, norma: n.nome_oficial } });
}
for (const [id, v] of votacoes) {
  const p = props.get(v.proposicao?.id);
  if (p && !v.proposicao.tipo) votacoes.set(id, { ...v, proposicao: { ...v.proposicao, tipo: p.tipo } });
}

// 5) Gravação
const listaP = [...props.values()];
const listaN = [...normas.values()];
const listaV = seguros([...votacoes.values()]);
const contP = gravarIndices(DIR, 'proposicoes', seguros(listaP), (p) => p.ano, (ano) => ({
  atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano,
  fonte: fonte(`Processo Legislativo de ${ano} — e-Legis (ALESC)`, `${C.elegis}/proposicoes/processo-legislativo?inicio=${ano}-01-01&fim=${ano}-12-31&arquivados=1`, C.nome, hoje),
}), porDataDesc('data_apresentacao'));
const contN = gravarIndices(DIR, 'normas', seguros(listaN), (n) => n.ano, (ano) => ({
  atualizado_em: hoje, uf: C.uf, ano: Number(ano) || ano,
  abrangencia: 'Leis, leis complementares, resoluções e decretos legislativos (seção Legislação) e decretos do Governador (seção Decretos do Executivo) da Legislação SC, base oficial da ALESC. Atos internos da Casa ficam de fora.',
  fontes: [
    fonte('Legislação SC — Legislação (ALESC)', `${C.leis}/legislativo?ano=${ano}&sort=data_desc`, C.nome, hoje),
    fonte('Legislação SC — Decretos do Executivo (ALESC)', `${C.leis}/executivo?ano=${ano}&sort=data_desc`, C.nome, hoje),
  ],
}), porDataDesc('data_assinatura'));
const contV = gravarVotacoes(DIR, listaV, (ano) => ({ atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano }));
const contS = gravarIndices(DIR, 'sessoes', seguros([...sessoes.values()]), (s) => s.ano, (ano) => ({
  atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano,
  observacao: 'Cursor do coletor: sessões plenárias do e-Legis e a data em que a Ordem do Dia foi lida.',
}), (a, b) => String(b.data).localeCompare(String(a.data)) || String(b.hora).localeCompare(String(a.hora)));

const nominais = listaV.filter((v) => v.tipo === 'nominal');
const meta = {
  atualizado_em: new Date().toISOString(), ultima_execucao: new Date(inicio).toISOString(), uf: C.uf, casa: C.casa, orgao: C.nome,
  periodo: { anos, fim: hoje }, modo: 'incremental',
  fontes: [
    fonte('e-Legis — Processo Legislativo (ALESC)', `${C.elegis}/proposicoes/processo-legislativo`, C.nome, hoje),
    fonte('e-Legis — Sessões Plenárias: Ordem do Dia e Extrato de votação (ALESC)', `${C.elegis}/sessoes-plenarias`, C.nome, hoje),
    fonte('Deputados — portal da ALESC', `${C.portal}/`, C.nome, hoje),
    fonte('Legislação SC — leis e decretos do Executivo (ALESC)', C.leis, C.nome, hoje),
  ],
  robots: cliente.resumoRobots(),
  execucao: { requisicoes: cliente.requisicoes, falhas: [...new Set([...falhas, ...cliente.falhas])].slice(0, 50) },
  contagens: {
    parlamentares: parl?.itens?.length ?? 0, proposicoes_por_ano: contP, proposicoes_na_fonte_por_tipo: totais,
    tramitacoes_lidas_nesta_execucao: tramLidas,
    tramitacoes_pendentes: listaP.filter((p) => p.tramitacao_marca !== marcaAndamento(p)).length,
    sessoes_por_ano: contS, sessoes_lidas_nesta_execucao: sessoesLidas,
    sessoes_pendentes: [...sessoes.values()].filter((s) => s.data && s.data <= hoje && s.situacao === 'Realizada' && (!s.ordem_lida_em || s.extratos_pendentes > 0)).length,
    votacoes_por_ano: contV, votacoes_nominais: nominais.length, votacoes_nominais_com_votos: nominais.filter((v) => v.votos_situacao === 'coletados').length,
    votacoes_simbolicas: listaV.filter((v) => v.tipo === 'simbolica').length, extratos_lidos_nesta_execucao: extratosLidos,
    normas_por_ano: contN, normas_na_fonte: totaisN, fichas_de_leis_lidas_nesta_execucao: fichasLidas,
    leis_sem_ficha: listaN.filter((n) => n.detalhe_coletado === false).length,
  },
  normas_cursor: cursorNormas,
  observacoes: [
    'Fonte: páginas HTML públicas da ALESC (não há API de processo legislativo). Portal (www.alesc.sc.gov.br): o robots.txt proíbe /wp-json/, /?rest_route=, /search/ e /?s=, que não são usados; só a página inicial é lida. e-Legis e Legislação SC não publicam robots.txt (HTTP 404: nenhuma restrição declarada). Intervalo mínimo de 2 s entre requisições ao mesmo host.',
    `Votações: cada item votado na Ordem do Dia de uma sessão plenária, com o resultado e a forma como a fonte escreve ("Votação simbólica" ou "Votação nominal"). Na votação simbólica não há voto individual. Na nominal, o "Extrato de votação" traz o nome e o voto de cada deputado; o extrato não publica totais, então o placar é a contagem dos nomes, conferida antes de gravar (cada cartão com um nome e um voto; identificação igual à da Ordem do Dia). Extrato que não passa na conferência não é gravado.`,
    `Partido na data da votação: ${INDISPONIVEL}. O extrato traz só o nome; o partido atual da página de deputados não é usado para votações passadas.`,
    'O sentido do "Sim" em votação de veto (manter ou derrubar) não está escrito no extrato; não é deduzido.',
    'Deputados: os 40 cartões da página inicial do portal da ALESC (nome, partido e foto como publicados hoje). Um voto ou autoria só é ligado ao deputado quando o nome é idêntico ao do cartão.',
    'Proposições: projetos de lei, de lei complementar, de decreto legislativo e de resolução, propostas de emenda à Constituição, mensagens de veto, medidas provisórias, projetos de conversão de medida provisória e propostas de sustação de ato, com entrada no ano (filtro da própria fonte, incluindo as arquivadas). Situação e setor atual vêm da lista; a tramitação completa é lida aos poucos (SC_MAX_TRAMITACOES por execução). Ofícios, abaixo-assinados, anteprojetos, representações e sugestões legislativas não são coletados.',
    'Normas: Legislação SC, base oficial da ALESC. Leis: número e data do Diário Oficial do Estado e proposição de origem vêm da ficha de cada lei (lida aos poucos). Decretos do Governador: título, data, ementa e início de vigência como publicados; a ficha do decreto não traz o número do Diário Oficial. A própria base avisa que os textos têm caráter informativo e não substituem o Diário Oficial do Estado (DOE-SC).',
  ],
};
gravar(path.join(DIR, 'meta.json'), meta);
const ok = Boolean(parl?.itens?.length || props.size || normas.size);
log(`${ok ? 'ok' : 'falhou'} — ${JSON.stringify(meta.contagens)}`);
process.exit(ok ? 0 : 1);
