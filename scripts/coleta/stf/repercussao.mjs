// Repercussão geral: leitura da lista oficial de todos os temas (todostemas.asp) e da tese literal (verTeseTema.asp).
import { entidades, htmlParaLinhas, normalizarEspacos, dataISO } from './lib.mjs';
import { PORTAL, URL_TODOS_TEMAS, urlTese, urlProcessoPublico, urlPlenarioVirtualTema, fonte } from './fontes.mjs';

const limpar = (s) => normalizarEspacos(entidades(String(s ?? '').replace(/<[^>]+>/g, ' ')));
const abs = (href) => (href.startsWith('http') ? href : href.startsWith('/') ? PORTAL + href : `${PORTAL}/jurisprudenciaRepercussao/${href}`);

/** Linhas da tabela #listagem-repercussao-geral → objetos com o que a página traz (texto literal). */
export function lerListaTemas(html) {
  const ini = html.indexOf('<tbody>');
  if (ini < 0) throw new Error('todostemas.asp: tabela não encontrada (layout mudou?)');
  const corpo = html.slice(ini, html.indexOf('</tbody>', ini) > 0 ? html.indexOf('</tbody>', ini) : undefined);
  const temas = [];
  for (const m of corpo.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => x[1]);
    if (tds.length < 6) continue;
    const id = tds[0].match(/incidente=(\d+)&(?:amp;)?numeroProcesso=(\d+)&(?:amp;)?classeProcesso=(\w+)&(?:amp;)?numeroTema=(\d+)/);
    if (!id) continue;
    const titulo = limpar(tds[1].match(/<a[^>]*>([\s\S]*?)<\/a>/)?.[1]);
    const descricao = tds[1].match(/title="([^"]*)"><strong>Ver Descri/)?.[1];
    const assuntos = tds[1].match(/title="([^"]*)"><strong>Ver Assuntos/)?.[1];
    const lc = tds[2].match(/<a[^>]*href="([^"]*detalhe\.asp[^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    const links = [...tds[2].matchAll(/<a[^>]*href="([^"]+)"[^>]*>\s*<strong>([^<]+)<\/strong>/g)]
      .map((x) => ({ titulo: limpar(x[2]), url: abs(entidades(x[1])) }))
      .filter((x) => !/\/processos\//.test(x.url));
    const relator = limpar(tds[3].replace(/<p>[\s\S]*?<\/p>/g, ' '));
    const sit = tds[4];
    const situacaoRg = limpar(sit.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1]);
    const depoisP = sit.replace(/^[\s\S]*?<\/p>/, '');
    const dataRg = dataISO(limpar(depoisP.split('<span')[0]));
    const span = sit.match(/<span[^>]*title="([^"]*)"[^>]*>\s*<strong>([\s\S]*?)<\/strong>/);
    const teseData = dataISO(limpar(tds[5]));
    temas.push({
      numero: Number(id[4]),
      titulo: titulo || null,
      descricao: descricao ? normalizarEspacos(entidades(descricao)) || null : null,
      assuntos: assuntos ? entidades(assuntos).split(/<br\s*\/?>/i).map(normalizarEspacos).filter(Boolean) : [],
      leading_case: {
        classe: id[3], numero: id[2], incidente: id[1],
        identificacao: lc ? limpar(lc[2]) : `${id[3]} ${id[2]}`,
        url: urlProcessoPublico(id[1]),
      },
      relator: relator || null,
      situacao: {
        repercussao_geral: situacaoRg || null,
        data_repercussao_geral: dataRg,
        andamento: span ? limpar(span[2]) || null : null,
        data_andamento: span ? dataISO(span[1]) : null,
      },
      tem_tese: /verTeseTema\.asp\?numTema=/.test(tds[5]),
      data_tese: teseData,
      links_oficiais: links,
    });
  }
  return temas;
}

/** Tese literal da página verTeseTema.asp (já decodificada de windows-1252). */
export function lerTextoTese(html) {
  const tds = [...String(html).matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => x[1]);
  if (tds.length < 3) return null;
  const linhas = htmlParaLinhas(tds[2]);
  const texto = linhas.join('\n').trim();
  return texto || null;
}

/** Monta o arquivo dados/stf/repercussao-geral/<tema>.json. */
export function montarTema(t, { tese, teseAcessadaEm, hoje, colecoes, julgamentoRef }) {
  const lacunas = [];
  if (!t.titulo) lacunas.push('Título do tema não disponível em fonte oficial (lista de temas sem título)');
  if (!t.descricao) lacunas.push('Descrição do tema não disponível em fonte oficial');
  if (t.tem_tese && !tese) lacunas.push(teseAcessadaEm ? 'Tese não disponível em fonte oficial (página da tese sem texto)' : 'Tese ainda não lida da página oficial (será lida em uma próxima coleta)');
  if (!t.tem_tese) lacunas.push('Tese não disponível em fonte oficial (tema sem tese publicada na lista de temas)');
  if (/MINISTRO PRESIDENTE/i.test(t.relator ?? '')) lacunas.push('Relator registrado na fonte como "Ministro Presidente", sem o nome');
  const fontes = [fonte('Repercussão Geral – lista de todos os temas', URL_TODOS_TEMAS, hoje)];
  if (t.tem_tese && teseAcessadaEm) fontes.push(fonte(`Tese do Tema ${t.numero}`, urlTese(t.numero), teseAcessadaEm));
  return {
    tribunal: 'stf',
    numero: t.numero,
    titulo: t.titulo,
    descricao: t.descricao,
    assuntos: t.assuntos,
    tese: tese ?? null,
    tese_lida_em: t.tem_tese ? teseAcessadaEm ?? null : null,
    data_tese: t.data_tese,
    relator: t.relator,
    situacao: t.situacao,
    leading_case: t.leading_case,
    url: urlPlenarioVirtualTema(t.numero),
    links_oficiais: t.links_oficiais,
    colecoes: colecoes ?? [],
    julgamento_ref: julgamentoRef ?? null,
    fontes,
    lacunas,
    atualizado_em: hoje,
  };
}

export const resumoTema = (x) => ({
  numero: x.numero, titulo: x.titulo, leading_case: x.leading_case.identificacao, incidente: x.leading_case.incidente,
  relator: x.relator, situacao: x.situacao.repercussao_geral, andamento: x.situacao.andamento,
  data_tese: x.data_tese, tem_tese: Boolean(x.tese), colecoes: x.colecoes, julgamento_ref: x.julgamento_ref,
});
