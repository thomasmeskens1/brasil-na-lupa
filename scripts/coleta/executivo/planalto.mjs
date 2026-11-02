// Planalto (ccivil_03): HTML legado, sem API. O servidor redireciona caminhos com maiúsculas
// para minúsculas; usamos minúsculas direto e só registramos URL que respondeu 200.
import { obter } from './lib.mjs';

export const BASE_PLANALTO = 'https://www.planalto.gov.br/ccivil_03/';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', ordm: 'º', ordf: 'ª', sect: '§', ccedil: 'ç', atilde: 'ã', otilde: 'õ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', acirc: 'â', ecirc: 'ê', ocirc: 'ô', agrave: 'à', Ccedil: 'Ç', Atilde: 'Ã', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú' };
export const textoHtml = (h) => h.replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m)
  .replace(/\s+/g, ' ').trim();

/** Baixa a página e devolve { url, titulo, links: [{ url, texto }] } ou null se não existir. */
export async function paginaPlanalto(caminho) {
  const r = await obter(BASE_PLANALTO + caminho.toLowerCase(), { tipo: 'buffer', opcional: true });
  if (!r) return null;
  const cabeca = r.dados.subarray(0, 3000).toString('latin1');
  const utf8 = /charset=["']?utf-?8/i.test(cabeca) || /utf-?8/i.test(r.tipoConteudo);
  const html = r.dados.toString(utf8 ? 'utf8' : 'latin1');
  const links = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const texto = textoHtml(m[2]);
    if (!texto || m[1].startsWith('#')) continue;
    try { links.push({ url: new URL(m[1], r.url).href.replace(/^http:\/\/www\.planalto/, 'https://www.planalto'), texto }); } catch { /* href inválido */ }
  }
  const titulo = links.find((l) => /legislacao\.planalto\.gov\.br/.test(l.url))?.texto
    || textoHtml((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '') || null;
  return { url: r.url, titulo, links };
}

/** Confirma (HEAD) que a página existe; devolve a URL final ou null. */
export async function existePlanalto(caminho) {
  const r = await obter(BASE_PLANALTO + caminho.toLowerCase(), { tipo: 'head', opcional: true });
  return r ? r.url : null;
}
