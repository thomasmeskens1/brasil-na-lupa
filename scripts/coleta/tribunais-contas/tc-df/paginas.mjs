// Páginas "Contas de Governo AAAA – Relator(a) Fulano" do site do TCDF (WordPress, categoria "Contas de Governo").
// Funções puras: exercício e relator só do título literal; documentos só dos links da própria página.

export const CATEGORIA = 231; // categoria "Contas de Governo" usada pela página oficial /controle-externo/contas-de-governo/

/** Decodifica as entidades HTML mais comuns do WordPress ("&#8211;" → "–"). */
export function entidades(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

const semTags = (s) => entidades(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/**
 * Título → { exercicio, relator, relator_literal }. Só "Contas de Governo AAAA – Relator(a) Nome" (e "Contas de Governo
 * de AAAA ..."); notícias ("TCDF aprova ... Contas de Governo de 2017") não casam.
 */
export function lerTitulo(titulo) {
  const t = semTags(titulo).replace(/\s*\*\s*$/, '');
  const m = t.match(/^Contas de Governo (?:de )?(\d{4})\s*[–—-]\s*(Relatora?)\s*(.*)$/);
  if (!m) return null;
  const nome = m[3].replace(/^[–—-]\s*/, '').trim();
  return { exercicio: m[1], titulo_literal: t, relator: nome && !/^[–—-]+$/.test(nome) ? nome : null };
}

/** Links da página (href e texto). O texto "Clique aqui para acessar/baixar ..." vira o título do documento. */
export function links(html) {
  const out = [];
  for (const m of String(html || '').matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = entidades(m[1]).trim();
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({ url, texto: semTags(m[2]) });
  }
  return out;
}

const RE_LEGISLATIVO = /Decreto Legislativo|DecLegislativo|DCL-|DODF|Aprovacao_Contas/i;
const RE_SIMPLIFICADA = /simplificada/i;

/** Classifica os PDFs da página: o relatório com o parecer (RAPP) e os demais (decreto legislativo, versão simplificada). */
export function documentosDaPagina(html, exercicio) {
  const vistos = new Map();
  for (const l of links(html)) {
    if (!/\.pdf(?:$|\?)/i.test(l.url)) continue;
    const titulo = l.texto.replace(/^Clique aqui para acessar\/baixar\s*/i, '').replace(/[.\s]+$/, '').trim();
    const atual = vistos.get(l.url);
    // A página repete cada link (texto do link e visualizador); fica o texto mais descritivo.
    if (!atual || (/^Clique aqui/i.test(l.texto) && !/^Clique aqui/i.test(atual.texto_link))) vistos.set(l.url, { url: l.url, titulo, texto_link: l.texto });
  }
  const docs = [...vistos.values()];
  const tipo = (d) => (RE_LEGISLATIVO.test(d.titulo) || RE_LEGISLATIVO.test(d.url) ? 'decreto-legislativo' : RE_SIMPLIFICADA.test(d.titulo) || RE_SIMPLIFICADA.test(d.url) ? 'versao-simplificada' : 'relatorio');
  const comTipo = docs.map((d) => ({ ...d, tipo: tipo(d) }));
  // O relatório é o PDF cujo texto do link é "Contas de Governo AAAA" do mesmo exercício.
  const relatorios = comTipo.filter((d) => d.tipo === 'relatorio');
  const rapp = relatorios.find((d) => new RegExp(`Contas de Governo ${exercicio}\\b`, 'i').test(d.titulo)) ?? (relatorios.length === 1 ? relatorios[0] : null);
  return { rapp, documentos: comTipo };
}

/** Post da API REST do WordPress → exercício da página (null se o título não for de exercício). */
export function lerPost(post) {
  const t = lerTitulo(post?.title?.rendered);
  if (!t) return null;
  const { rapp, documentos } = documentosDaPagina(post?.content?.rendered, t.exercicio);
  return {
    ...t,
    id_post: post.id,
    url: String(post.link || ''),
    publicado_em: String(post.date || '').slice(0, 10) || null,
    modificado_em: String(post.modified || '').slice(0, 10) || null,
    rapp,
    documentos,
    sobrestado: /sobrestado/i.test(semTags(post?.content?.rendered)) ? semTags(post.content.rendered).match(/[^.]*sobrestado[^.]*\./i)?.[0].trim() ?? null : null,
  };
}

/** Agrupa os posts por exercício; mais de uma página para o mesmo exercício fica registrada (não se escolhe às cegas). */
export function exerciciosDosPosts(posts) {
  const porAno = new Map();
  const ignorados = [];
  for (const p of posts) {
    const e = lerPost(p);
    if (!e) { ignorados.push(semTags(p?.title?.rendered)); continue; }
    if (!porAno.has(e.exercicio)) porAno.set(e.exercicio, []);
    porAno.get(e.exercicio).push(e);
  }
  return { porAno, ignorados };
}
