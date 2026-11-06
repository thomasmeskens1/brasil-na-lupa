// Lista de edições do Diário Oficial Eletrônico do TCM-PA (página "Calendário DOE TCM-PA", tabela
// paginada em /doe/doe/doe?Doe_page=N, da mais nova para a mais antiga).
// Só entram as edições da versão oficial: data a partir de 12/12/2016 (início informado pelo site) e
// título que não seja "Diário Eletrônico" (versão antecipada, que o próprio site diz não ser oficial) nem
// "Diário Oficial do Estado". Os títulos da série oficial variam ("Ano II, nº 500", "Edição nº 512",
// "Ano_II_505"); o número da edição vem da primeira coluna da tabela.
export const URL_LISTA = 'https://www.tcmpa.tc.br/doe/doe/doe';
export const URL_PAGINA_DOE = 'https://www.tcmpa.tc.br/diario-oficial-eletronico/';
export const urlPagina = (n) => (n <= 1 ? URL_LISTA : `${URL_LISTA}?Doe_page=${n}`);

// "Ano II, nº 519" ou, em algumas linhas, "Edição nº 512" (mesma série numerada).
export const INICIO_OFICIAL = '2016-12-12';
const NAO_OFICIAL = /Di[áa]rio\s+Eletr[ôo]nico|Estado\s+do\s+Par[áa]/i;

const limpar = (s) => String(s || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

/**
 * Linhas da tabela: { numero, titulo, data (AAAA-MM-DD), arquivo, url, oficial }.
 * Também devolve o total informado no rodapé ("Exibindo 1-10 de 2343 resultados").
 */
export function lerPaginaLista(html, base = 'https://www.tcmpa.tc.br') {
  const total = Number((String(html).match(/Exibindo\s+[\d.]+-[\d.]+\s+de\s+([\d.]+)\s+resultados/i) || [])[1]?.replace(/\./g, '')) || null;
  const corpo = (String(html).match(/<tbody>([\s\S]*?)<\/tbody>/i) || [])[1] || '';
  const linhas = [];
  for (const tr of corpo.split(/<tr\b/i).slice(1)) {
    const tds = [...tr.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (tds.length < 4) continue;
    const href = (tds[3].match(/href="([^"]+)"/i) || [])[1];
    const titulo = limpar(tds[1]);
    const d = limpar(tds[2]).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!href || !d) continue;
    const url = new URL(href.replace(/&amp;/g, '&'), base);
    url.pathname = url.pathname.split('/').map((p) => encodeURIComponent(decodeURIComponent(p))).join('/');
    const data = `${d[3]}-${d[2]}-${d[1]}`;
    linhas.push({
      numero: limpar(tds[0]),
      titulo,
      data,
      arquivo: limpar(tds[3]),
      url: url.href,
      oficial: data >= INICIO_OFICIAL && !NAO_OFICIAL.test(titulo),
    });
  }
  return { total, linhas };
}
