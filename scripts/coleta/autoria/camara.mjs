// Autoria aprovada — Câmara dos Deputados.
// Fonte: arquivos em massa de dados abertos da Câmara (proposições e autores, um por ano de
// numeração). Critério: proposições apresentadas desde o início da legislatura atual cuja
// situação atual oficial é "Transformado em Norma Jurídica". Nada é deduzido: a autoria vem do
// arquivo de autores (todos os signatários, com a ordem de assinatura oficial).
import path from 'node:path';
import {
  obter, percorrerCsv, gravarAtomico, lerJson, hojeISO, robotsCarregados, estat,
  SAIDA, INICIO_LEGISLATURA, LEGISLATURA,
} from './lib.mjs';

export const BASE_ARQ = 'https://dadosabertos.camara.leg.br/arquivos';
export const urlProposicoes = (ano) => `${BASE_ARQ}/proposicoes/csv/proposicoes-${ano}.csv`;
export const urlAutores = (ano) => `${BASE_ARQ}/proposicoesAutores/csv/proposicoesAutores-${ano}.csv`;
export const SITUACAO_NORMA = /^transformad[oa] em norma jur[ií]dica/i;
const ID_DEP = /\/deputados\/(\d+)$/;

/** Filtra as linhas do CSV de proposições: situação atual "Transformado em Norma Jurídica" e apresentação no período. */
export function aprovadasDoCsv(texto, inicio = INICIO_LEGISLATURA) {
  const saida = new Map();
  percorrerCsv(texto, (l) => {
    const situacao = (l.ultimoStatus_descricaoSituacao || '').trim();
    if (!SITUACAO_NORMA.test(situacao)) return;
    const data = (l.dataApresentacao || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < inicio) return;
    const id = String(l.id || '').trim();
    if (!/^\d+$/.test(id)) return;
    saida.set(id, {
      identificacao: `${l.siglaTipo} ${l.numero}/${l.ano}`,
      sigla: l.siglaTipo || null,
      tipo: l.descricaoTipo || null,
      numero: Number(l.numero) || null,
      ano: Number(l.ano) || null,
      ementa: (l.ementa || '').replace(/\s+/g, ' ').trim() || null,
      data_apresentacao: data,
      situacao,
      data_situacao: (l.ultimoStatus_dataHora || '').slice(0, 10) || null,
      url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`,
      urn_norma: /^urn:lex:/.test(l.urnFinal || '') ? l.urnFinal : null,
    });
  });
  return saida;
}

/** Autores deputados das proposições aprovadas: Map(idDeputado → Map(idProposicao → ordem)). */
export function autoresDoCsv(texto, aprovadas, destino = new Map()) {
  percorrerCsv(texto, (l) => {
    const prop = String(l.idProposicao || '').trim();
    if (!aprovadas.has(prop)) return;
    const dep = String(l.idDeputadoAutor || '').trim() || (ID_DEP.exec(l.uriAutor || '')?.[1] ?? '');
    if (!/^\d+$/.test(dep)) return; // órgãos, Senado, Poder Executivo etc.
    const ordem = Number(l.ordemAssinatura);
    const m = destino.get(dep) ?? new Map();
    const atual = m.get(prop);
    const o = Number.isFinite(ordem) && ordem > 0 ? ordem : null;
    if (atual === undefined || (o !== null && (atual === null || o < atual))) m.set(prop, o);
    destino.set(dep, m);
  });
  return destino;
}

/** Monta o arquivo final (ordem estável: deputado por id numérico, proposições por data e id). */
export function montar({ aprovadas, autores, fontes, inicio = INICIO_LEGISLATURA, hoje = hojeISO(), robots = {} }) {
  const usadas = new Set();
  const idx = {};
  for (const dep of [...autores.keys()].sort((a, b) => Number(a) - Number(b))) {
    const lista = [...autores.get(dep)].sort(([a], [b]) =>
      (aprovadas.get(a).data_apresentacao).localeCompare(aprovadas.get(b).data_apresentacao) || Number(a) - Number(b));
    idx[dep] = lista.map(([p, o]) => { usadas.add(p); return [p, o]; });
  }
  const proposicoes = {};
  // Só as que têm deputado autor (as demais são de órgãos, do Senado ou do Poder Executivo).
  for (const id of [...usadas].sort((a, b) => Number(a) - Number(b))) proposicoes[id] = aprovadas.get(id);
  return {
    atualizado_em: hoje,
    casa: 'camara',
    legislatura: LEGISLATURA,
    periodo: { inicio, fim: hoje },
    criterio:
      'Proposições apresentadas desde o início da legislatura atual cuja situação atual, nos arquivos de dados abertos da Câmara dos Deputados, é "Transformado em Norma Jurídica". Autoria segundo o arquivo oficial de autores: todos os deputados que assinaram, com a ordem de assinatura (1 = primeiro signatário).',
    fontes,
    robots_txt: robots,
    totais: { proposicoes_transformadas_em_norma: aprovadas.size, com_deputado_autor: usadas.size, deputados_autores: Object.keys(idx).length },
    proposicoes,
    autores: idx,
  };
}

export async function coletarCamara({ hoje = hojeISO(), completo = false } = {}) {
  const dir = path.join(SAIDA, 'camara');
  const metaArq = path.join(dir, 'meta.json');
  const meta = lerJson(metaArq) ?? {};
  const anos = [];
  for (let a = Number(INICIO_LEGISLATURA.slice(0, 4)); a <= Number(hoje.slice(0, 4)); a++) anos.push(a);
  const urls = anos.flatMap((a) => [urlProposicoes(a), urlAutores(a)]);

  // Download condicional: se nenhum arquivo mudou desde a última coleta, nada a refazer.
  const anteriores = meta.arquivos ?? {};
  const novos = {};
  const textos = {};
  for (const u of urls) {
    const r = await obter(u, { tipo: 'text', anterior: completo ? null : anteriores[u] });
    if (r.naoMudou) continue;
    textos[u] = r.dados;
    novos[u] = { etag: r.etag, last_modified: r.last_modified };
  }
  if (!Object.keys(textos).length && lerJson(path.join(dir, 'aprovadas.json'))) {
    console.log('[autoria/camara] arquivos sem mudança desde a última coleta.');
    gravarAtomico(metaArq, { ...meta, ultima_execucao: new Date().toISOString(), resultado: 'sem mudança' });
    return null;
  }
  // Algum mudou: o resultado depende de todos; baixa de novo os que vieram 304.
  for (const u of urls) {
    if (textos[u] !== undefined) continue;
    const r = await obter(u, { tipo: 'text' });
    textos[u] = r.dados;
    novos[u] = { etag: r.etag, last_modified: r.last_modified };
  }

  const aprovadas = new Map();
  for (const a of anos) for (const [k, v] of aprovadasDoCsv(textos[urlProposicoes(a)])) aprovadas.set(k, v);
  const autores = new Map();
  for (const a of anos) autoresDoCsv(textos[urlAutores(a)], aprovadas, autores);

  const fontes = anos.flatMap((a) => [
    { titulo: `Proposições de ${a} — arquivo de dados abertos da Câmara dos Deputados`, url: urlProposicoes(a), orgao: 'Câmara dos Deputados', acessado_em: hoje },
    { titulo: `Autores das proposições de ${a} — arquivo de dados abertos da Câmara dos Deputados`, url: urlAutores(a), orgao: 'Câmara dos Deputados', acessado_em: hoje },
  ]);
  const saida = montar({ aprovadas, autores, fontes, hoje, robots: robotsCarregados() });
  const mudou = gravarAtomico(path.join(dir, 'aprovadas.json'), saida);
  gravarAtomico(metaArq, {
    atualizado_em: hoje,
    ultima_execucao: new Date().toISOString(),
    resultado: mudou ? 'atualizado' : 'sem mudança no resultado',
    totais: saida.totais,
    arquivos: { ...anteriores, ...novos },
    requisicoes: estat.requisicoes,
  });
  console.log(`[autoria/camara] ${saida.totais.proposicoes_transformadas_em_norma} proposições transformadas em norma; ${saida.totais.deputados_autores} deputados autores.`);
  return saida;
}
