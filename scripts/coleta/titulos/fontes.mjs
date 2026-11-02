// Consultas às fontes oficiais que não estão em dados/: temas e palavras-chave da Câmara,
// apelido/explicação/classificações do Senado e manchetes da Agência Câmara e da Agência Senado
// (só os títulos e as datas das notícias ligadas à proposição na página oficial da Casa).
import { obter } from './lib.mjs';

const API_CAMARA = 'https://dadosabertos.camara.leg.br/api/v2';
const API_SENADO = 'https://legis.senado.leg.br/dadosabertos';

const decodificar = (s) => String(s)
  .replace(/<[^>]+>/g, '')
  .replace(/&quot;/g, '"').replace(/&#39;|&#039;|&apos;/g, "'").replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/\s+/g, ' ').trim();

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

/** Agência Câmara: notícias ligadas à proposição na ficha oficial (mais recentes primeiro). */
export async function noticiasAgenciaCamara(id, opts) {
  const url = `https://www.camara.leg.br/proposicoesWeb/prop_noticias?idProposicao=${id}`;
  const r = await obter(url, { tipo: 'text', ttlDias: 3, ...opts });
  if (!r) return { url, noticias: [] };
  const noticias = [];
  const re = /<div class="tituloData">\s*(\d{2})\/(\d{2})\/(\d{4})[^<]*<\/div>\s*<div class="titulo">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(r.corpo))) {
    if (!/^https:\/\/www\.camara\.leg\.br\/noticias\//.test(m[4])) continue;
    noticias.push({ data: `${m[3]}-${m[2]}-${m[1]}`, url: m[4], titulo: decodificar(m[5]), pagina: url });
  }
  noticias.sort((a, b) => b.data.localeCompare(a.data));
  return { url, noticias };
}

/** Senado: apelido, explicação da ementa e classificações do processo. */
export async function senadoProcesso(idProcesso, opts) {
  const url = `${API_SENADO}/processo/${idProcesso}`;
  const r = await obter(url, { ttlDias: 30, ...opts });
  const p = Array.isArray(r?.corpo) ? r.corpo[0] : r?.corpo;
  if (!p) return null;
  return {
    url,
    codigoMateria: p.codigoMateria ? String(p.codigoMateria) : null,
    apelido: p.apelido ? decodificar(p.apelido) : null,
    explicacao: p.conteudo?.explicacaoEmenta ? decodificar(p.conteudo.explicacaoEmenta) : null,
    classificacoes: (p.classificacoes || []).map((c) => c.descricaoHierarquia || c.descricao).filter(Boolean),
    ementa: p.conteudo?.ementa || null,
  };
}

/**
 * Agência Senado: notícias do painel "Notícias relacionadas" da página oficial da matéria
 * (www25.senado.leg.br, que redireciona MPs e vetos para congressonacional.leg.br).
 * A data vem do endereço da notícia (/noticias/materias/AAAA/MM/DD/…).
 */
export async function noticiasAgenciaSenado(codigoMateria, { url: urlDireta = null, ...opts } = {}) {
  const url = urlDireta || `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigoMateria}`;
  const r = await obter(url, { tipo: 'text', ttlDias: 7, ...opts });
  if (r === undefined) return undefined;
  if (!r) return { url, noticias: [] };
  const i = r.corpo.indexOf('id="noticias-relacionadas"');
  if (i < 0) return { url: r.url_final || url, noticias: [] };
  const bloco = r.corpo.slice(i, i + 40000);
  const fim = bloco.indexOf('</div> </div> </div> <!--googleon');
  const trecho = fim > 0 ? bloco.slice(0, fim) : bloco;
  const vistos = new Set();
  const noticias = [];
  const re = /<a\s+href="(https:\/\/www12\.senado\.leg\.br\/noticias\/materias\/(\d{4})\/(\d{2})\/(\d{2})\/[^"/]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(trecho))) {
    const titulo = decodificar(m[5]);
    if (!titulo || vistos.has(m[1])) continue;
    vistos.add(m[1]);
    noticias.push({ data: `${m[2]}-${m[3]}-${m[4]}`, url: m[1], titulo, pagina: r.url_final || url });
  }
  noticias.sort((a, b) => b.data.localeCompare(a.data));
  return { url: r.url_final || url, noticias };
}
