// API de dados abertos da ALMG. O robots.txt proíbe URLs com os parâmetros p=, ord=, tp= e ordenacao=
// (paginação e ordenação): cada pesquisa lê só a 1ª página (20 itens). Para cobrir um ano inteiro, a
// pesquisa é feita em janelas de datas que são divididas ao meio até caberem numa página (mínimo 1 dia).
// Os arquivos CSV anuais (/arquivo/...) estão fora dos caminhos liberados pelo robots.txt
// (Disallow: / com Allow só para /documentacao/, /api/ajuda/ e /api/v2/) e não são baixados.
import { obter, omitirParticulares, autorPublico, somarDias } from '../rs/lib.mjs';

export const API = 'https://dadosabertos.almg.gov.br/api/v2';
export const ORGAO = 'Assembleia Legislativa do Estado de Minas Gerais (ALMG)';
export const PORTAL = 'https://www.almg.gov.br';
const compacta = (iso) => iso.replace(/-/g, '');
const qs = (o) => Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

/** Garante que nenhuma URL montada aqui use parâmetros proibidos pelo robots.txt. */
export function conferirParametros(url) {
  if (/[?&](p|tp|ord|ordenacao)=/.test(url)) throw new Error(`URL com parâmetro de paginação/ordenação proibido pelo robots.txt: ${url}`);
  return url;
}
const getApi = (rota, params) => obter(conferirParametros(`${API}${rota}?${qs({ ...params, formato: 'json' })}`));

function meio(ini, fim) {
  const a = Date.parse(ini + 'T12:00:00Z'), b = Date.parse(fim + 'T12:00:00Z');
  return new Date(a + Math.floor((b - a) / 86400000 / 2) * 86400000).toISOString().slice(0, 10);
}

/**
 * Pesquisa por janela de datas, dividindo-a até cada parte caber em uma página.
 * ler(ini, fim) → { total, itens }. Devolve { itens, incompletas: [{ ini, fim, total, lidos }] }.
 */
export async function porJanelas(ler, ini, fim, acc = { itens: [], incompletas: [], consultas: 0 }) {
  const r = await ler(ini, fim);
  acc.consultas++;
  if (r.total <= r.itens.length) { acc.itens.push(...r.itens); return acc; }
  if (ini >= fim) { acc.itens.push(...r.itens); acc.incompletas.push({ ini, fim, total: r.total, lidos: r.itens.length }); return acc; }
  const m = meio(ini, fim);
  await porJanelas(ler, ini, m, acc);
  await porJanelas(ler, somarDias(m, 1), fim, acc);
  return acc;
}

/**
 * Quando um dia tem mais de 20 resultados (não dá para paginar), completa pelo número: a numeração
 * de cada tipo é sequencial, então os números que faltam entre o menor e o maior conhecidos (com folga
 * do tamanho da falta) são consultados um a um (num=N), cada consulta cabendo em uma página.
 * Devolve os itens achados; para quando acha 'faltam' itens ou o orçamento acaba.
 */
export async function completarPorNumero(lerNumero, conhecidos, faltam, { podeContinuar, limite = 2000 } = {}) {
  if (!(faltam > 0) || !conhecidos.size) return { itens: [], consultas: 0 };
  const nums = [...conhecidos].sort((a, b) => a - b);
  const ini = Math.max(1, nums[0] - 50), fim = nums[nums.length - 1] + faltam + 20;
  const achados = [];
  let consultas = 0;
  for (let n = fim; n >= ini && achados.length < faltam && consultas < limite; n--) {
    if (conhecidos.has(n)) continue;
    if (podeContinuar && !podeContinuar()) break;
    consultas++;
    achados.push(...(await lerNumero(n)));
  }
  return { itens: achados, consultas };
}

/** Janelas mensais entre duas datas ISO. */
export function meses(ini, fim) {
  const r = [];
  let d = ini;
  while (d <= fim) {
    const [a, m] = d.split('-').map(Number);
    const ult = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
    r.push([d, ult < fim ? ult : fim]);
    d = somarDias(ult, 1);
  }
  return r;
}

// ---------- deputados ----------
export async function deputados(legislatura) {
  const em = (await getApi('/deputados/em_exercicio', {})).list || [];
  const outros = [];
  for (const sit of ['que_exerceram_mandato', 'que_se_afastaram', 'que_perderam_mandato', 'que_renunciaram']) {
    const r = await getApi(`/legislaturas/${legislatura}/deputados/${sit}`, {}).catch(() => null);
    for (const d of r?.listaDeputado || r?.list || []) outros.push({ ...d, situacao: sit });
  }
  return { em, outros };
}

// ---------- proposições ----------
export const TIPOS_PROP = ['PL', 'PLC', 'PEC', 'PRE', 'VET'];
export const urlPortalProp = (sigla, n, ano) => `${PORTAL}/projetos-de-lei/${sigla}/${n}/${ano}/`;
export const urlApiProp = (sigla, n, ano) => `${API}/proposicoes/${sigla}/${n}/${ano}?formato=json`;

export async function totalProposicoes(tipo, ano) {
  const r = (await getApi('/proposicoes/pesquisa/direcionada', { tipo, ano })).resultado;
  return r?.noOcorrencias ?? null;
}
export function lerPropJanela(tipo, ano) {
  return async (ini, fim) => {
    const r = (await getApi('/proposicoes/pesquisa/direcionada', { tipo, ano, ini: compacta(ini), fim: compacta(fim) })).resultado;
    if (r?.erro) throw new Error(`API ALMG devolveu erro na pesquisa ${tipo}/${ano} ${ini}..${fim}`);
    return { total: r?.noOcorrencias ?? 0, itens: r?.listaItem || [] };
  };
}

export function lerPropNumero(tipo, ano) {
  return async (num) => ((await getApi('/proposicoes/pesquisa/direcionada', { tipo, ano, num: String(num) })).resultado?.listaItem || [])
    .filter((i) => Number(i.numero) === num && Number(i.ano) === ano);
}
export function lerNormaNumero(tipo, ano) {
  return async (num) => ((await getApi('/legislacao/mineira/pesquisa/direcionada', { tipo, ano, num: String(num), resumido: 'true' })).resultado?.listaItem || [])
    .filter((i) => Number(i.numero) === num && Number(i.ano) === ano);
}

// Registro literal da tramitação, ex.: "Proposição de lei promulgada. Lei 25890 publicada no DL…",
// "Lei 25934 2026 publicada no Diário do Executivo", "Transformado em Lei nº 26.100".
const RE_NORMA_HIST = /\b(Lei Complementar|Lei|Resolução|Emenda à Constituição)\s+(?:nº\s*)?(\d[\d.]*?)\.*(?:\s+(\d{4}))?\s+(?:publicad|promulgad|sancionad)|(?:Transformad[oa]|Convertid[oa])\s+em\s+(Lei Complementar|Lei|Resolução|Emenda à Constituição)\s+nº\s+([\d.]+)/i;

export function montarProposicao(i, hoje) {
  const sigla = String(i.siglaTipoProjeto || '').replace(/\.$/, '');
  const numero = Number(i.numero), ano = Number(i.ano);
  const em = omitirParticulares((i.ementa || '').replace(/\s+/g, ' ').trim() || null);
  const lacunas = [];
  if (em.omitido) lacunas.push('Nome de particular omitido na ementa (diretriz 12); texto integral na página oficial.');
  const autores = (i.autoresEstruturados || []).map((a) => {
    const nome = String(a.nome || '').replace(/\s+/g, ' ').trim();
    const pub = autorPublico(nome);
    if (pub.omitido) lacunas.push('Autor sem função pública identificada: nome omitido (diretriz 12).');
    return { nome: pub.nome, partido: a.partido || null, parlamentar_id: a.id != null && /deputad/i.test(nome) ? String(a.id) : null };
  });
  const autorTexto = String(i.autor || '').replace(/\s+/g, ' ').trim();
  const hist = (i.listaHistoricoTramitacoes || []).map((h) => ({ data: h.data || null, local: h.local || null, historico: String(h.historico || '').replace(/\s+/g, ' ').trim() }));
  let norma = null;
  for (const h of hist) {
    const m = RE_NORMA_HIST.exec(h.historico);
    if (m) norma = { tipo: m[1] || m[4], numero: Number(String(m[2] || m[5]).replace(/\./g, '')), ano: m[3] ? Number(m[3]) : null, texto_oficial: m[0], data_registro: h.data };
  }
  const ult = hist.length ? hist[hist.length - 1] : null;
  return {
    id: `mg-${sigla}-${numero}-${ano}`,
    uf: 'MG', casa: 'almg',
    sigla, numero, ano,
    tipo: i.tipoProjeto || null,
    ementa: em.texto,
    autor: autorPublico(autorTexto).nome,
    autores,
    data_publicacao: i.dataPublicacao || null,
    situacao: i.situacao || null,
    situacao_geral: i.situacaoGeral || null,
    regime: i.regime || null,
    local: i.local || null,
    fase_atual: i.faseAtual?.nome || null,
    data_ultima_acao: i.dataUltimaAcao || null,
    ultima_tramitacao: ult,
    passos_tramitacao: hist.length,
    norma_gerada: norma,
    atualizacao_fonte: i.atualizacaoTexto || i.atualizacao || null,
    url: urlPortalProp(sigla, numero, ano),
    url_api: urlApiProp(sigla, numero, ano),
    coletado_em: hoje,
    lacunas,
  };
}

// ---------- plenário ----------
export function lerReunioesJanela() {
  return async (ini, fim) => {
    const r = (await getApi('/plenario/reunioes/pesquisa', { ini: compacta(ini), fim: compacta(fim) })).resultadoPesquisaReunioesPlenario;
    return { total: r?.numeroOcorrencias ?? 0, itens: r?.listaReuniaoPlenario || [] };
  };
}
export const urlDetalheReuniao = (data, hora) => `${API}/plenario/reunioes/detalhes/${data.replace(/-/g, '/')}/${hora}?formato=json`;

// ---------- Diário do Legislativo ----------
/** Edições que contêm a expressão "Registraram" (marca das listas de votação nominal). */
export function lerDiariosJanela() {
  return async (ini, fim) => {
    const r = (await getApi('/diario_legislativo/pesquisa', { ini: compacta(ini), fim: compacta(fim), expressao: 'Registraram' })).list;
    return { total: r?.numeroOcorrencias ?? 0, itens: r?.lista || [] };
  };
}

// ---------- comissões ----------
export const urlResultadosComissao = (sigla, n, ano) => `${API}/comissoes/proposicao/${sigla}/${n}/${ano}/reunioes/resultados?formato=json`;
export async function resultadosComissao(sigla, n, ano) {
  return obter(conferirParametros(urlResultadosComissao(sigla, n, ano)), { opcional: true, timeoutMs: 60000, maxTentativas: 2 });
}

// ---------- legislação ----------
export const TIPOS_NORMA = [
  { sigla: 'LEI', tipo: 'Lei' }, { sigla: 'LCP', tipo: 'Lei Complementar' },
  { sigla: 'EMC', tipo: 'Emenda à Constituição' }, { sigla: 'DEC', tipo: 'Decreto' },
];
export function lerNormasJanela(tipo, ano) {
  return async (ini, fim) => {
    const r = (await getApi('/legislacao/mineira/pesquisa/direcionada', { tipo, ano, ini: compacta(ini), fim: compacta(fim), resumido: 'true' })).resultado;
    return { total: r?.noOcorrencias ?? 0, itens: r?.listaItem || [] };
  };
}
export async function totalNormas(tipo, ano) {
  return (await getApi('/legislacao/mineira/pesquisa/direcionada', { tipo, ano, resumido: 'true' })).resultado?.noOcorrencias ?? null;
}

const limparHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
export function montarNorma(tipo, i, hoje) {
  const numero = Number(i.numero), ano = Number(i.ano);
  const data = /^\d{8}$/.test(i.data || '') ? `${i.data.slice(0, 4)}-${i.data.slice(4, 6)}-${i.data.slice(6, 8)}` : null;
  const em = omitirParticulares((i.ementa || '').replace(/\s+/g, ' ').trim() || null);
  const lacunas = [];
  if (em.omitido) lacunas.push('Nome de particular omitido na ementa (diretriz 12); texto integral no link oficial.');
  const fonteTxt = limparHtml(i.fonte);
  const href = /href="([^"]+)"/.exec(i.fonte || '')?.[1] || null;
  const mp = /-\s*(.+?)\s*-\s*(\d{2})\/(\d{2})\/(\d{4})(?:\s+Pág\.\s*(\S+))?(?:\s+Col\.\s*(\S+))?/.exec(fonteTxt);
  const publicacao = fonteTxt ? [{
    veiculo: mp ? mp[1] : null, data: mp ? `${mp[4]}-${mp[3]}-${mp[2]}` : null, pagina: mp?.[5] || null, coluna: mp?.[6] || null,
    texto_oficial: fonteTxt, url: href,
  }] : [];
  if (!publicacao.length) lacunas.push('Publicação não informada pela fonte.');
  const fmt = numero.toLocaleString('pt-BR');
  const dataBr = data ? data.split('-').reverse().join('/') : null;
  const url = `${PORTAL}/legislacao-mineira/texto/${tipo.sigla}/${numero}/${ano}/`;
  return {
    id: `mg-${tipo.sigla.toLowerCase()}-${numero}-${ano}`,
    uf: 'MG', casa: 'almg',
    tipo: tipo.tipo, numero, ano,
    nome_oficial: `${tipo.tipo} nº ${fmt}${dataBr ? `, de ${dataBr}` : ''}`,
    data_assinatura: data,
    ementa: em.texto,
    resumo_almg: i.resumo ? i.resumo.replace(/\s+/g, ' ').trim() : null,
    origem: i.origem || null,
    caminho: tipo.sigla === 'DEC' ? 'governador-mg' : 'almg',
    publicacao,
    projeto_origem: [],
    links: { almg: url, api: `${API}/legislacao/mineira/${tipo.sigla}/${numero}/${ano}?formato=json` },
    fonte: { titulo: `Legislação Mineira — ${tipo.tipo} nº ${fmt}`, url, orgao: ORGAO, acessado_em: hoje },
    atualizacao_fonte: i.atualizacao || null,
    coletado_em: hoje,
    lacunas,
  };
}
