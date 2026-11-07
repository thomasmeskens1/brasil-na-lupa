// Consultas às fontes oficiais que não estão em dados/, usadas só para o TEMA do item: temas e
// palavras-chave da Câmara e classificações do Senado. (Manchetes de agência e apelidos não são mais
// usados como título.)
import { obter } from './lib.mjs';

const API_CAMARA = 'https://dadosabertos.camara.leg.br/api/v2';
const API_SENADO = 'https://legis.senado.leg.br/dadosabertos';

/** Câmara: { keywords, temas[] } da proposição. */
export async function camaraProposicao(id, opts) {
  const [det, tem] = await Promise.all([
    obter(`${API_CAMARA}/proposicoes/${id}`, { ttlDias: 30, ...opts }),
    obter(`${API_CAMARA}/proposicoes/${id}/temas`, { ttlDias: 30, ...opts }),
  ]);
  return {
    keywords: det?.corpo?.dados?.keywords || null,
    temas: (tem?.corpo?.dados || []).map((t) => t.tema).filter(Boolean),
    url: `${API_CAMARA}/proposicoes/${id}`,
  };
}

/** Câmara: id da proposição a partir de sigla/número/ano (para leis com projeto de origem). */
export async function camaraIdPorIdentificacao(sigla, numero, ano, opts) {
  const r = await obter(`${API_CAMARA}/proposicoes?siglaTipo=${encodeURIComponent(sigla)}&numero=${numero}&ano=${ano}`, { ttlDias: 90, ...opts });
  const d = r?.corpo?.dados || [];
  return d.length === 1 ? String(d[0].id) : null;
}

/** Senado: classificações temáticas do processo e o tipo oficial do conteúdo (ex.: INDICACAO_AUTORIDADE). */
export async function senadoProcesso(idProcesso, opts) {
  const url = `${API_SENADO}/processo/${idProcesso}`;
  const r = await obter(url, { ttlDias: 30, ...opts });
  const p = Array.isArray(r?.corpo) ? r.corpo[0] : r?.corpo;
  if (!p) return null;
  return {
    url,
    classificacoes: (p.classificacoes || []).map((c) => c.descricaoHierarquia || c.descricao).filter(Boolean),
    tipoConteudo: p.conteudo?.siglaTipo || null,
  };
}

const lista = (x) => (Array.isArray(x) ? x : x == null || x === '' ? [] : [x]);

/** Senado: "Classificação Temática Unificada" da norma federal (campo classes da legislação). */
export async function senadoNorma(idNorma, opts) {
  const url = `${API_SENADO}/legislacao/${idNorma}`;
  const r = await obter(url, { ttlDias: 90, ...opts });
  const doc = lista(r?.corpo?.DetalheDocumento?.documentos?.documento)[0];
  if (!doc) return null;
  return { url, classificacoes: lista(doc.classes?.classe).map((c) => (typeof c === 'string' ? c : c?.descricao)).filter(Boolean) };
}

const API_ALESP = 'https://legis-api-portal-prd.al.sp.gov.br';
const API_BALEG = 'https://baleg-api-prd.al.sp.gov.br';

/** ALESP: termos do tesauro (indexadores) da proposição e a norma em que ela se transformou. */
export async function alespProposicao(id, opts) {
  const url = `${API_ALESP}/processo/detalhes/principais/${id}`;
  const r = await obter(url, { ttlDias: 30, ...opts });
  if (!r?.corpo) return null;
  const idNorma = /\/norma\/(\d+)/.exec(r.corpo.urlNorma || '')?.[1] || null;
  return { url, indexadores: (r.corpo.indexadores || []).map((i) => i.txTesauro).filter(Boolean), idNorma };
}

/** ALESP, Banco de Legislação: temas oficiais de uma norma estadual (por id da norma). */
export async function alespNorma(idNorma, opts) {
  const url = `${API_BALEG}/norma/${idNorma}`;
  const r = await obter(url, { ttlDias: 90, ...opts });
  if (!r?.corpo) return null;
  return { url, temas: (r.corpo.temas || []).map((t) => t.nmTema).filter(Boolean) };
}

/**
 * ALESP, Banco de Legislação: temas oficiais de todas as normas de um ano, lidos pela pesquisa filtrada
 * por tema (uma consulta por tema, em vez de uma por norma). Retorna Map "Tipo|número|ano" → [temas].
 */
export async function alespTemasDoAno(ano, opts) {
  const temas = (await obter(`${API_BALEG}/temas`, { ttlDias: 30, ...opts }))?.corpo || [];
  const mapa = new Map();
  for (const t of temas) {
    for (let page = 0; page < 50; page++) {
      const r = await obter(`${API_BALEG}/normas?page=${page}&size=1000&ano=${ano}&idsTema=${t.idTema}`, { ttlDias: 7, ...opts });
      for (const n of r?.corpo?.content || []) {
        const k = chaveNormaSp(n.tipo, n.nuNorma, ano);
        if (!mapa.has(k)) mapa.set(k, []);
        if (!mapa.get(k).includes(t.nmTema)) mapa.get(k).push(t.nmTema);
      }
      if (!r?.corpo || r.corpo.last !== false) break;
    }
  }
  return mapa;
}
export const chaveNormaSp = (tipo, numero, ano) => `${tipo}|${Number(String(numero).replace(/\D/g, ''))}|${ano}`;

/**
 * CNJ, Tabela Processual Unificada (assuntos): Map código → { nome, pai } com a árvore oficial inteira
 * (um único download), para subir de um assunto específico até o ramo do direito.
 */
export async function tpuAssuntos(opts) {
  const r = await obter('https://gateway.cloud.pje.jus.br/tpu/api/v1/publico/download/assuntos', { ttlDias: 90, ...opts });
  const m = new Map();
  for (const a of r?.corpo || []) m.set(String(a.cod_item), { nome: a.nome, pai: a.cod_item_pai != null ? String(a.cod_item_pai) : null });
  return m;
}
