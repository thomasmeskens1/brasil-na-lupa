// Normas estaduais: LegisOn (PGE-SE, API JSON), legislação da Alese (HTML; liga a lei ao projeto
// de origem) e, na Bahia, as leis citadas na tramitação oficial da ALBA. Parte pura (interpretação)
// + fluxos que usam o ClienteHost (robots.txt já lido, orçamento de tempo, 2 requisições por vez).
import { decodificarEntidades } from '../../alesp/lib.mjs';
import { TIPOS_LEGISON } from './casas.mjs';
import { dataHora, textoPublico } from './normalizar.mjs';

const limpar = (s) => (s == null ? null : decodificarEntidades(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() || null);

const PREFIXOS = [
  [/^lei\s+complementar/i, 'lc', 'Lei Complementar'],
  [/^lei(\s+ordin[áa]ria)?$/i, 'lei', 'Lei Ordinária'],
  [/^emenda\s+constitucional/i, 'ec', 'Emenda Constitucional'],
  [/^decreto\s+legislativo/i, 'dl', 'Decreto Legislativo'],
  [/^decreto/i, 'dec', 'Decreto'],
  [/^resolu/i, 'res', 'Resolução'],
];
export function prefixoNorma(especie) {
  const e = String(especie || '').trim();
  const p = PREFIXOS.find(([re]) => re.test(e));
  return p ? p[1] : e.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'norma';
}

// ---------------------------------------------------------------- LegisOn (SE)
/** Item da lista public/acts → norma. */
export function normLegison(a, tipoCfg, { portal, host, hoje, regras = () => [] }) {
  const numero = Number(String(a.number || '').replace(/\D/g, ''));
  const dataAto = dataHora(a.actDate).data;
  const ano = dataAto ? Number(dataAto.slice(0, 4)) : null;
  const em = textoPublico(a.summary, regras(`legison-${a.id}`));
  const lacunas = [];
  if (!ano) lacunas.push('Data do ato: não informada na fonte.');
  if (em.pendente) lacunas.push('Trecho com possível nome de particular aguardando conferência (diretriz 12).');
  return {
    id: `${tipoCfg.prefixo}-${numero}-${ano}`,
    id_oficial: a.id,
    tipo: tipoCfg.tipo,
    numero,
    ano,
    nome_oficial: `${tipoCfg.tipo} nº ${a.number}${dataAto ? `, de ${dataAto.split('-').reverse().join('/')}` : ''}`,
    data: dataAto,
    data_publicacao: dataHora(a.publicationDate).data,
    ementa: em.texto,
    caminho: tipoCfg.prefixo === 'dec' ? 'governador' : 'assembleia',
    forma: tipoCfg.prefixo === 'dec' ? 'ato individual (decreto do governador)' : null,
    url: `${portal}/${tipoCfg.slug}/${a.number}`,
    fonte_dados: `https://${host}/api/v1/public/act/details?Number=${encodeURIComponent(a.number)}&ActTypeId=${tipoCfg.id}`,
    fonte_orgao: 'Procuradoria-Geral do Estado de Sergipe (PGE-SE) — LegisOn',
    acessado_em: hoje,
    privacidade_pendente: em.pendente || undefined,
    lacunas,
  };
}

/** Pagina a lista do LegisOn de um tipo e ano (50 por página). Devolve { itens, completo }. */
export async function coletarLegison(cliente, ano, tipoCfg, ctx) {
  const itens = [];
  for (let pagina = 1; pagina <= 200; pagina++) {
    if (!cliente.cabe()) return { itens, completo: false };
    const r = await cliente.json(`/api/v1/public/acts?Year=${ano}&TypeAct=${tipoCfg.id}&Order=desc&Page=${pagina}&Quantity=50`);
    const dados = r?.json?.data || [];
    for (const a of dados) itens.push(normLegison(a, tipoCfg, ctx));
    let pag = null;
    try { pag = JSON.parse(r?.headers?.get?.('x-pagination') || 'null'); } catch { pag = null; }
    if (!dados.length || (pag && !pag.next) || (!pag && dados.length < 50)) return { itens, completo: true };
  }
  return { itens, completo: false };
}

export { TIPOS_LEGISON };

// ---------------------------------------------------------------- legislação da Alese (HTML)
/** Interpreta uma página de consulta-legislacao.aspx: normas com projeto de origem. */
export function interpretarListaAlese(html, host) {
  const blocos = String(html || '').split(/<div class="kt-widget5__item\b/).slice(1);
  const itens = [];
  for (const b of blocos) {
    const t = /<a href="norma\.aspx\?id=(\d+)&(?:amp;)?ano=(\d{4})" class="kt-widget5__title">([\s\S]*?)<\/a>/.exec(b);
    if (!t) continue;
    const titulo = limpar(t[3]);
    const m = /^(.*?)\s+n[°º]\s*([\d.]+)\s*\/\s*(\d{4})$/i.exec(titulo || '');
    if (!m) continue;
    const ementa = /class="kt-widget5__desc">([\s\S]*?)<\/a>/.exec(b);
    const info = (rotulo) => {
      const x = new RegExp(`<span>${rotulo}:?</span>\\s*<span class="kt-font-info">([\\s\\S]*?)</span>\\s*(?:<span>|</div>)`).exec(b);
      return x ? limpar(x[1]) : null;
    };
    const proc = /href='\/spl\/processo\.aspx\?id=(\d+)'[^>]*>\s*<i[^>]*><\/i>\s*([^<]+)<\/a>/.exec(b);
    const texto = /href='(\/Arquivo\/Documents\/legislacao\/[^']+)'/.exec(b);
    const numero = Number(m[2].replace(/\./g, ''));
    const autoresTxt = info('Autor\\(es\\) da Norma');
    itens.push({
      id_alese: Number(t[1]),
      especie: m[1].trim(),
      id: `${prefixoNorma(m[1])}-${numero}-${m[3]}`,
      numero,
      ano: Number(m[3]),
      titulo,
      ementa: ementa ? limpar(ementa[1]) : null,
      data: dataHora(info('Data')).data,
      situacao: info('Situação'),
      autores: autoresTxt ? autoresTxt.split(/\s*,\s*/).filter(Boolean) : [],
      projeto_origem: proc ? { id_oficial: Number(proc[1]), identificacao: limpar(proc[2]), url: `https://${host}/spl/processo.aspx?id=${proc[1]}` } : null,
      url: `https://${host}/legislacao/norma.aspx?id=${t[1]}&ano=${m[3]}`,
      url_texto: texto ? `https://${host}${texto[1]}` : null,
    });
  }
  const proximo = /id="ContentPlaceHolder1_lbNext"(?![^>]*aspNetDisabled)[^>]*href="javascript:__doPostBack\(&#39;([^&]+)&#39;/.exec(html || '');
  const campos = {};
  for (const n of ['__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION', '__VIEWSTATEENCRYPTED']) {
    const x = new RegExp(`id="${n}" value="([^"]*)"`).exec(html || '');
    if (x) campos[n] = decodificarEntidades(x[1]);
  }
  const total = /Localizada\(s\)\s*(\d+)\s*ato/i.exec(limpar(html) || '');
  return { itens, proximo: proximo ? proximo[1] : null, campos, total: total ? Number(total[1]) : null };
}

/** Lê todas as páginas de um ano (GET da 1ª, "Próxima" por postback do próprio formulário). */
export async function coletarLegislacaoAlese(cliente, ano, { maxPaginas = 60 } = {}) {
  const caminho = `/legislacao/consulta-legislacao.aspx?ano=${ano}`;
  let html = await cliente.texto(caminho);
  const porId = new Map();
  let total = null;
  for (let p = 1; p <= maxPaginas && html; p++) {
    const pg = interpretarListaAlese(html, cliente.host);
    total ??= pg.total;
    const antes = porId.size;
    for (const it of pg.itens) porId.set(it.id, it);
    if (!pg.proximo || porId.size === antes || (total && porId.size >= total)) return { itens: [...porId.values()], completo: true, total };
    if (!cliente.cabe()) break;
    const form = new URLSearchParams({ __EVENTTARGET: pg.proximo, __EVENTARGUMENT: '', ...pg.campos });
    html = await cliente.texto(caminho, { metodo: 'POST', corpo: form.toString() });
  }
  return { itens: [...porId.values()], completo: false, total };
}

/** Junta LegisOn (base) e Alese (projeto de origem, autores, situação; normas só da Alese). */
export function juntarNormasSE(legison, alese, { uf, hoje }) {
  const porId = new Map(legison.map((n) => [n.id, { ...n }]));
  for (const a of alese) {
    const n = porId.get(a.id);
    const proj = a.projeto_origem ? { id: `${uf.toLowerCase()}-${a.projeto_origem.id_oficial}`, ...a.projeto_origem } : null;
    if (n) {
      n.projeto_origem = proj;
      n.situacao = a.situacao;
      n.autores = a.autores;
      n.url_alese = a.url;
      n.url_texto = a.url_texto;
    } else {
      porId.set(a.id, {
        id: a.id, id_oficial: null, id_alese: a.id_alese, tipo: a.especie, numero: a.numero, ano: a.ano,
        nome_oficial: a.titulo, data: a.data, data_publicacao: null, ementa: textoPublico(a.ementa).texto,
        caminho: 'assembleia', situacao: a.situacao, autores: a.autores, projeto_origem: proj,
        url: a.url, url_texto: a.url_texto, fonte_dados: a.url,
        fonte_orgao: 'Assembleia Legislativa do Estado de Sergipe (Alese) — Legislação', acessado_em: hoje,
        lacunas: ['Norma não localizada no LegisOn (PGE-SE) na data da coleta; dados da página de legislação da Alese.'],
      });
    }
  }
  return [...porId.values()];
}

/** Bahia: normas que a tramitação oficial da ALBA diz terem resultado de cada proposição. */
export function normasDaTramitacao(proposicoes, cfg, { hoje, motivo }) {
  const porId = new Map();
  for (const p of proposicoes) {
    for (const n of p.normas_citadas || []) {
      const atual = porId.get(n.id) || {
        id: n.id, id_oficial: null, tipo: n.tipo, numero: n.numero, ano: n.ano,
        nome_oficial: `${n.tipo} nº ${n.numero.toLocaleString('pt-BR')}`,
        data: null, data_publicacao: null, ementa: null, caminho: 'assembleia', projeto_origem: [], eventos: [],
        url: null, fonte_orgao: cfg.nome, acessado_em: hoje,
        lacunas: [`Ementa e texto integral: ${motivo}`, 'Data da norma: só a citada no registro de tramitação, quando houver.'],
      };
      if (!atual.projeto_origem.some((x) => x.id === p.id)) atual.projeto_origem.push({ id: p.id, identificacao: p.identificacao, url: p.url });
      for (const e of n.eventos) atual.eventos.push({ ...e, proposicao_id: p.id, url: p.url });
      const pub = n.eventos.find((e) => e.evento === 'publicada' && e.data);
      const prom = n.eventos.find((e) => e.evento === 'promulgada' && e.data);
      if (pub && !atual.data) atual.data = pub.data; // "Publicada a Lei nº X, de <data>": data da lei
      if (prom && !atual.data_promulgacao) atual.data_promulgacao = prom.data;
      atual.url ??= p.url;
      atual.fonte_dados ??= p.fonte_dados;
      porId.set(n.id, atual);
    }
  }
  return [...porId.values()];
}
