// Leitura das três fontes oficiais do TCE-RS usadas pelo coletor:
//  1. Portal de Dados Abertos (CKAN): arquivos anuais de decisões /dados/decisoes/{ANO}.json (o /api/ do CKAN é
//     proibido pelo robots.txt e não é usado). Trazem processo, sessão, colegiado e, no campo DECISAO, o parecer de
//     cada responsável ("<b> NOME: - Parecer Favorável com Ressalva(s)"). Não trazem o exercício das contas.
//  2. Pesquisa de Jurisprudência (portal.tce.rs.gov.br, base "Decisões"): o mesmo serviço público, sem login, que a
//     página de pesquisa usa. Traz o exercício (campo "Exercício"), o número formatado do processo, o relator e os
//     links do visualizador de documentos. Só os campos curtos são guardados; o relatório e o voto não são copiados.
//  3. Página "Contas do Governador" (tcers.tc.br/parecer-previo/): exercício, governador, processo e PDFs.
import { pedir, fonte, dataISO, semHtml } from './lib.mjs';

/* ---------- 1. Dados abertos: decisões ---------- */

export const PRIMEIRO_ANO_DECISOES = 2011; // primeiro arquivo anual publicado (2010.json devolve 404 em 06/11/2026)
export const urlDecisoes = (ano) => `https://dados.tce.rs.gov.br/dados/decisoes/${ano}.json`;
export const paginaDecisoes = (ano) => `https://dados.tce.rs.gov.br/dataset/decisoes-${ano}`;

/** Baixa o arquivo de decisões de um ano de sessão. null se o arquivo não existir (404). */
export async function baixarDecisoes(ano) {
  const url = urlDecisoes(ano);
  const r = await pedir(url, { esperado: /json/i, aceitar404: true });
  if (!r) return null;
  const d = JSON.parse(r.texto);
  const registros = Array.isArray(d?.decisoes) ? d.decisoes : null;
  if (!registros) throw new Error(`formato inesperado em ${url} (sem a lista "decisoes")`);
  return {
    ano, url, registros,
    fonte: fonte(`Decisões ${ano} — Portal de Dados Abertos do TCE-RS (arquivo JSON)`, url, { pagina: paginaDecisoes(ano), atualizado_na_fonte: r.ultimaModificacao || null }),
  };
}

const RE_PARECER = /^-\s*(Parecer\s+(?:Prévio\s+)?(?:Favorável|Desfavorável)\b.*?)\s*$/i;

/**
 * Pareceres por responsável no campo DECISAO. Só o formato estruturado da fonte é lido: um bloco "<b> NOME:"
 * seguido de linhas "- ...". Linhas "- Parecer Favorável", "- Parecer Favorável com Ressalva(s)" e
 * "- Parecer Desfavorável" são copiadas como estão. Retorna { pareceres: [{ nome, parecer, outras }], errata, citaParecer }.
 */
export function pareceresDaDecisao(texto) {
  const bruto = String(texto ?? '');
  const blocos = bruto.split(/<b>/i).slice(1);
  const pareceres = [];
  for (const b of blocos) {
    const m = b.match(/^\s*([^:\n<]+?)\s*:\s*(?:\n|$)([\s\S]*)$/);
    if (!m) continue;
    const linhas = m[2].split('\n').map((l) => semHtml(l)).filter(Boolean);
    const achados = linhas.map((l) => l.match(RE_PARECER)?.[1]).filter(Boolean);
    if (!achados.length) continue;
    pareceres.push({ nome: semHtml(m[1]), parecer: achados.length === 1 ? achados[0] : null, todos: achados, outras: linhas.filter((l) => !RE_PARECER.test(l)).map((l) => l.replace(/^-\s*/, '')) });
  }
  return { pareceres, errata: /ERRATA|retificada|refiticada/i.test(bruto), citaParecer: /Parecer\s+(Prévio\s+)?(Favorável|Desfavorável)/i.test(bruto) };
}

/** Campos usados de um registro de decisão. */
export function normalizarDecisao(r) {
  return {
    nr_processo: String(r.NR_PROCESSO ?? '').trim(),
    data_sessao: dataISO(r.DATA_SESSAO),
    ano_sessao: Number(r.ANO_SESSAO) || null,
    tipo_sessao: r.TIPO_SESSAO ?? null,
    numero_sessao: r.NUMERO_SESSAO ?? null,
    orgao_julgador: r.ORGAO_JULGADOR ?? null,
    tipo_processo: r.TIPO_PROCESSO ?? null,
    cod_orgao: r.COD_ORGAO ?? null,
    nome_orgao: String(r.NOME_ORGAO ?? '').trim(),
    magistrado: r.MAGISTRADO ?? null,
    decisao: r.DECISAO ?? '',
  };
}

/* ---------- 2. Pesquisa de Jurisprudência (base "Decisões") ---------- */

export const PAGINA_PESQUISA = 'https://portal.tce.rs.gov.br/app/pesquisa/jurisprudencia/pesquisa';
const URL_PESQUISA = 'https://portal.tce.rs.gov.br/api/pesquisa/v2/jurisprudencia-decisoes';
// Tipos de processo das contas de governo, na grafia da base: até ~2012 "PROCESSO DE CONTAS - EXECUTIVO",
// de 2013 a 2020 "CONTAS DE GOVERNO" e, desde 2021, "CONTAS ANUAIS" (contagens por ano da sessão em 06/11/2026).
export const TIPOS_JURIS = ['PROCESSO DE CONTAS - EXECUTIVO', 'CONTAS DE GOVERNO', 'CONTAS ANUAIS'];
const POR_PAGINA = 100;
const TERMOS_VAZIOS = { original: '', transformados: '', estruturados: [], operandos: [], operandosExpandidos: [] };

function corpo(tipo, filtroData, quantidade, totalizadores = []) {
  const filtros = [{ campo: 'ds_tp_processo.keyword', valores: [tipo], tipo: 'palavra-chave', nome: 'Tipo de Processo' }];
  if (filtroData) filtros.push({ campo: 'dt_sessao', nome: 'Data da sessão', tipo: 'data', inicio: filtroData[0], fim: filtroData[1], valores: [] });
  return {
    termos: TERMOS_VAZIOS,
    filtros,
    opcoes: [
      { opcao: 'quantidadeResultadosPorPagina', tipo: 'number', valor: quantidade },
      { opcao: 'ordenacaoCampo', tipo: 'string', valor: 'dt_sessao' },
      { opcao: 'ordenacaoDirecao', tipo: 'string', valor: 'asc' },
    ],
    totalizadoresCampos: totalizadores,
  };
}

async function consultar(c, pagina = 1) {
  const r = await pedir(`${URL_PESQUISA}/${pagina}`, { metodo: 'POST', corpo: c, esperado: /json/i });
  const d = JSON.parse(r.texto)?.resultados;
  if (!d || !Array.isArray(d.resultados)) throw new Error('resposta inesperada da pesquisa de jurisprudência');
  return d;
}

/** Quantidade de decisões do tipo por ano da sessão ({ '2024': 587, ... }). */
export async function anosDoTipo(tipo) {
  const d = await consultar(corpo(tipo, null, 0, [{ nome: 'Ano decisão', campo: 'dt_sessao', tipo: 'data-ano', quantidade: 60, quantidadeMinimaDocumentos: 1 }]));
  const v = d.totalizadoresCampos?.[0]?.valores ?? [];
  return Object.fromEntries(v.map((x) => [String(x.valor), Number(x.total) || 0]));
}

const ano4 = (v) => (/^\d{4}$/.test(String(v ?? '').trim()) ? String(v).trim() : null);

/** Campos curtos de um documento da base (sem relatório, voto ou texto integral). */
export function normalizarJuris(c) {
  return {
    nr_processo: String(c.nr_processo ?? '').trim(),
    processo_formatado: c.nr_processo_fmt ?? null,
    tipo_processo: c.ds_tp_processo ?? null,
    orgao: c.orgao ?? null,
    cod_orgao: c.cd_orgao ?? null,
    exercicio: ano4(c.dt_inicio_exercicio),
    data_sessao: dataISO(c.dt_sessao),
    orgao_julgador: c.nm_orgao_julgador ?? null,
    relator: c.nm_magistrado ?? null,
    data_publicacao: dataISO(c.publicacao_dt_publicacao),
    link_decisao: /^https:\/\/portal\.tce\.rs\.gov\.br\//.test(c.link_visualizador_decisao ?? '') ? c.link_visualizador_decisao : null,
    link_relatorio_voto: /^https:\/\/portal\.tce\.rs\.gov\.br\//.test(c.link_visualizador_relatorio_voto ?? '') ? c.link_visualizador_relatorio_voto : null,
  };
}

/** Todas as decisões do tipo em sessões do ano, em páginas de 100. */
export async function baixarJurisAno(tipo, ano, esperado) {
  const filtro = [`${ano}-01-01T00:00:00.000Z`, `${ano}-12-31T23:59:59.999Z`];
  const docs = [];
  for (let pag = 1; pag <= 200; pag++) {
    const d = await consultar(corpo(tipo, filtro, POR_PAGINA), pag);
    docs.push(...d.resultados.map((x) => normalizarJuris(x.campos ?? {})));
    const total = Number(d.total?.valor) || 0;
    if (!d.resultados.length || docs.length >= total) break;
  }
  if (esperado != null && docs.length < esperado) throw new Error(`pesquisa de jurisprudência: ${tipo} ${ano} trouxe ${docs.length} de ${esperado} documentos`);
  return docs;
}

/** Índice processo -> { exercicios: Set, docs: [...] }. */
export function indexarJuris(docs) {
  const m = new Map();
  for (const d of docs) {
    if (!d.nr_processo) continue;
    if (!m.has(d.nr_processo)) m.set(d.nr_processo, { exercicios: new Set(), docs: [] });
    const e = m.get(d.nr_processo);
    if (d.exercicio) e.exercicios.add(d.exercicio);
    e.docs.push(d);
  }
  return m;
}

/** Documento da base para a mesma sessão (ou, na falta, o mais recente do processo). */
export function docDaSessao(entrada, dataSessao) {
  if (!entrada) return null;
  const ordenados = [...entrada.docs].sort((a, b) => (b.data_sessao ?? '').localeCompare(a.data_sessao ?? ''));
  return ordenados.find((d) => d.data_sessao === dataSessao) ?? null;
}

/* ---------- 3. Página "Contas do Governador" ---------- */

export const URL_PAGINA_GOVERNADOR = 'https://tcers.tc.br/parecer-previo/';

/** Linhas da tabela da página: exercício, governador, processo (número, link), arquivos e situação literal. */
export function lerPaginaGovernador(html) {
  const linhas = String(html).split(/<div class="processo-seletivo__interna__content__item-archives__line">/).slice(1);
  const out = [];
  for (const l of linhas) {
    const col = (nome) => l.match(new RegExp(`col-${nome}">([\\s\\S]*?)</div>\\s*(?:<div class="processo-seletivo|</div>)`))?.[1] ?? '';
    const exercicio = semHtml(col('ano')).match(/^(\d{4})$/)?.[1];
    if (!exercicio) continue;
    const proc = col('processo');
    const link = proc.match(/href="(https:\/\/tcers\.tc\.br\/consultas\/processo_detalhe\/\?processo=(\d+))"/);
    const arquivos = [...col('arquivos').matchAll(/<a href="(https:\/\/tcers\.tc\.br\/repo\/parecer_previo\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((m) => ({ titulo: semHtml(m[2]), url: m[1] }));
    out.push({
      exercicio,
      governador_literal: semHtml(col('conselheiro')) || null,
      processo_formatado: semHtml(proc).match(/\d{1,6}-\d{4}\/\d{2}-\d/)?.[0] ?? null,
      processo_url: link?.[1] ?? null,
      nr_processo: link ? String(Number(link[2])) : null,
      arquivos,
      situacao_literal: arquivos.length ? null : [...new Set([...col('arquivos').matchAll(/<span class="info">([\s\S]*?)<\/span>/g)].map((m) => semHtml(m[1])).filter(Boolean))].join('; ') || null,
    });
  }
  return out;
}

export async function baixarPaginaGovernador() {
  const r = await pedir(URL_PAGINA_GOVERNADOR, { esperado: /html/i });
  const linhas = lerPaginaGovernador(r.texto);
  if (linhas.length < 20) throw new Error(`página do parecer prévio com ${linhas.length} linhas (esperado ≥ 20); estrutura pode ter mudado`);
  return { linhas, fonte: fonte('Contas do Governador — página "Parecer Prévio" do TCE-RS', URL_PAGINA_GOVERNADOR) };
}
