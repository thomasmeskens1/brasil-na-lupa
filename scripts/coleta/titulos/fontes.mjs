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

/** Senado: classificações do processo. */
export async function senadoProcesso(idProcesso, opts) {
  const url = `${API_SENADO}/processo/${idProcesso}`;
  const r = await obter(url, { ttlDias: 30, ...opts });
  const p = Array.isArray(r?.corpo) ? r.corpo[0] : r?.corpo;
  if (!p) return null;
  return {
    url,
    classificacoes: (p.classificacoes || []).map((c) => c.descricaoHierarquia || c.descricao).filter(Boolean),
  };
}
