// Sistema LEGIS da ALRS (ASP clássico, ISO-8859-1): lista de normas por tipo e ano (formulário POST com
// cookie de sessão, 50 por página) e ficha de cada norma (proposição de origem e publicação no DOE).
import { obter, PoteDeCookies, dataBR, omitirParticulares, decodificarEntidades } from './lib.mjs';

export const LEGIS = 'https://ww3.al.rs.gov.br/legis/M010';
export const TIPOS_NORMA = [
  { codigo: 20, sigla: 'LEI', tipo: 'Lei' },
  { codigo: 2, sigla: 'LEC', tipo: 'Lei Complementar' },
  { codigo: 23, sigla: 'EC', tipo: 'Emenda Constitucional' },
  { codigo: 3, sigla: 'DEC', tipo: 'Decreto' },
];
export const urlFicha = (id) => `${LEGIS}/M0100018.asp?Hid_IdNorma=${id}&Texto=&Origem=1`;
export const urlTexto = (id) => `${LEGIS}/M0100099.asp?Hid_Tipo=TEXTO&Hid_TodasNormas=${id}&hTexto=&Hid_IDNorma=${id}`;

const limpar = (h) => decodificarEntidades(String(h || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const semComentarios = (h) => String(h).replace(/<!--[\s\S]*?-->/g, '');

/** Linhas da página de resultados. */
export function lerListaLegis(html) {
  const h = semComentarios(html);
  const total = /Número de Documentos:\s*\d+\s*-\s*\d+\s*de\s*(\d+)/i.exec(limpar(h));
  const linhas = [];
  for (const tr of h.split(/<TR[\s>]/i)) {
    const id = /name="Hid_IdNorma\d+"\s+value="(\d+)"/i.exec(tr);
    const num = /name="Hid_NumeroNorma\d+"\s+value="([^"]+)"/i.exec(tr);
    if (!id || !num) continue;
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => limpar(m[1]));
    const data = tds.find((t) => /^\d{2}\/\d{2}\/\d{4}$/.test(t));
    const ementa = tds[tds.length - 1] || null;
    linhas.push({ id: id[1], numero: num[1], tipo_rotulo: tds[0] || null, data: dataBR(data).data, ementa });
  }
  const paginas = [...new Set([...h.matchAll(/M0100017\.asp\?txtPage=(\d+)/gi)].map((m) => Number(m[1])))];
  return { total: total ? Number(total[1]) : null, linhas, paginas };
}

function campo(h, rotulo) {
  const re = new RegExp(`<b>\\s*${rotulo}\\s*</b>[\\s\\S]*?</td>([\\s\\S]*?)</tr>`, 'i');
  const m = re.exec(h);
  return m ? m[1] : null;
}

/** Ficha da norma. */
export function lerFichaLegis(html) {
  const h = semComentarios(html);
  const prop = /jsExibeProposicao\('([A-Z]+)',\s*(\d+),\s*(\d{4})/.exec(h);
  const fonteHtml = campo(h, 'Fonte\\(s\\):') || '';
  const fontes = [...fonteHtml.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ texto: limpar(m[2]), url: m[1] }));
  if (!fontes.length && limpar(fonteHtml)) fontes.push({ texto: limpar(fonteHtml), url: null });
  const pub = fontes.map((f) => {
    const m = /DOE\s+(\d+)\s+DE\s+(\d{2})\/(\d{2})\/(\d{2,4})\s+P-?(\S+)/i.exec(f.texto);
    const ano = m ? (m[4].length === 2 ? `20${m[4]}` : m[4]) : null;
    return { veiculo: 'Diário Oficial do Estado do Rio Grande do Sul', texto_oficial: f.texto, edicao: m ? Number(m[1]) : null, data: m ? `${ano}-${m[3]}-${m[2]}` : null, pagina: m ? m[5] : null, url: f.url };
  });
  return {
    norma_texto: limpar(campo(h, 'Norma:')),
    data: dataBR(limpar(campo(h, 'Data:'))).data,
    proposicao: prop ? { sigla: prop[1], numero: Number(prop[2]), ano: Number(prop[3]) } : null,
    proposicao_texto: limpar(campo(h, 'Proposição:')) || null,
    ementa: limpar(campo(h, 'Ementa:')) || null,
    assunto: limpar(campo(h, 'Assunto:')) || null,
    publicacao: pub,
    tem_texto: /M0100099\.asp/i.test(h),
  };
}

const corpoBusca = (codigo, ano) => new URLSearchParams({
  txtTipoPesq: 'dirigida', cboTipoNorma: String(codigo), TxtNumero_Norma: '', TxtAno: String(ano), txtData: '',
  txtDataInicial: '', txtDataFinal: '', txtPalavraChave: '', TxtQualquerPalavra: '', CmbPROPOSICAO: '', txtProcAdin: '',
  cmbNumero_Docs: '50', txtOrdenacao: 'numeroNorma', txtOperacaoFormulario: 'Pesquisar',
}).toString();

/** Todas as normas de um tipo/ano (pagina de 50 em 50 dentro da mesma sessão). */
export async function listarNormas(tipo, ano) {
  const pote = new PoteDeCookies();
  const html1 = await obter(`${LEGIS}/M0100008.ASP`, { tipo: 'latin1', metodo: 'POST', corpo: corpoBusca(tipo.codigo, ano), cookies: pote });
  const p1 = lerListaLegis(html1);
  const linhas = [...p1.linhas];
  const totalPag = p1.total ? Math.ceil(p1.total / 50) : Math.max(1, ...p1.paginas);
  for (let pg = 2; pg <= totalPag; pg++) {
    const h = await obter(`${LEGIS}/M0100017.asp?txtPage=${pg}&txtNumDocs=50`, { tipo: 'latin1', cookies: pote });
    linhas.push(...lerListaLegis(h).linhas);
  }
  const unicas = [...new Map(linhas.map((l) => [l.id, l])).values()];
  if (p1.total != null && unicas.length !== p1.total) {
    throw new Error(`LEGIS ${tipo.sigla} ${ano}: ${unicas.length} normas lidas, a página informa ${p1.total}`);
  }
  return unicas;
}

/** Norma no contrato estadual (definição "norma" + uf + casa). */
export function montarNorma(tipo, linha, ficha, { hoje }) {
  const numero = Number(String(linha.numero).replace(/\D/g, ''));
  const ano = Number((ficha?.data || linha.data || '').slice(0, 4)) || null;
  const em = omitirParticulares(ficha?.ementa || linha.ementa);
  const lacunas = [];
  if (em.omitido) lacunas.push('Nome de particular omitido na ementa (diretriz 12); texto integral no link oficial.');
  if (!ficha) lacunas.push('Ficha da norma ainda não lida (orçamento de tempo): proposição de origem e publicação pendentes.');
  else if (!ficha.proposicao && tipo.sigla !== 'DEC') lacunas.push('Proposição de origem não informada pelo LEGIS.');
  if (ficha && !ficha.publicacao.length) lacunas.push('Publicação no Diário Oficial não informada pelo LEGIS.');
  const fmt = numero.toLocaleString('pt-BR');
  const dataBr = (linha.data || '').split('-').reverse().join('/');
  return {
    id: `rs-${tipo.sigla.toLowerCase()}-${numero}-${ano}`,
    id_fonte: linha.id,
    uf: 'RS', casa: 'alrs',
    tipo: tipo.tipo,
    numero, ano,
    nome_oficial: `${tipo.tipo} nº ${fmt}, de ${dataBr}`,
    data_assinatura: ficha?.data || linha.data,
    ementa: em.texto,
    caminho: tipo.sigla === 'DEC' ? 'governador-rs' : 'alrs',
    assunto: ficha?.assunto ?? null,
    publicacao: ficha ? ficha.publicacao : [],
    projeto_origem: ficha?.proposicao ? [{
      identificacao: `${ficha.proposicao.sigla} ${ficha.proposicao.numero}/${ficha.proposicao.ano}`,
      proposicao_id: `rs-${ficha.proposicao.sigla}-${ficha.proposicao.numero}-${ficha.proposicao.ano}`,
      url: `https://ww4.al.rs.gov.br/proposicao/${ficha.proposicao.sigla}/${ficha.proposicao.numero}/${ficha.proposicao.ano}`,
    }] : [],
    links: { ficha_legis: urlFicha(linha.id), texto: ficha?.tem_texto ? urlTexto(linha.id) : null },
    fonte: { titulo: `Sistema LEGIS — ${tipo.tipo} nº ${fmt}`, url: urlFicha(linha.id), orgao: 'Assembleia Legislativa do Estado do Rio Grande do Sul (ALRS)', acessado_em: hoje },
    coletado_em: hoje,
    ficha_lida: !!ficha,
    lacunas,
  };
}

export async function lerFicha(id) {
  return lerFichaLegis(await obter(urlFicha(id), { tipo: 'latin1' }));
}
