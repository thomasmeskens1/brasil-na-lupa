// Receitas e despesas do Município de Atibaia pela API do TCE-SP (Tribunal de Contas do
// Estado de São Paulo), resumidas por mês. Nenhum dado de fornecedor é guardado (a API traz
// nomes e CPF parciais de pessoas físicas): só totais por órgão e fase da despesa, e por
// alínea e fonte de recurso da receita. Os totais são somas exatas, em centavos, dos
// registros devolvidos pela API para o mês.
import { obter, MESES, hojeISO } from './lib.mjs';

const BASE = 'https://transparencia.tce.sp.gov.br';
export const URL_DOC_API = `${BASE}/apis`;
export const URL_CONJUNTOS = `${BASE}/conjunto-de-dados`;
const MUNICIPIO = 'atibaia';

export const urlMes = (tipo, ano, mes) => `${BASE}/api/json/${tipo}/${MUNICIPIO}/${ano}/${mes}`;

/** "1194,90" | "-4.865,40" | "3297511,40" → centavos (inteiro) ou null. */
export function centavos(v) {
  const s = String(v ?? '').trim().replace(/\./g, '');
  const m = s.match(/^(-?)(\d+)(?:,(\d{1,2}))?$/);
  if (!m) return null;
  const c = Number(m[2]) * 100 + Number((m[3] || '0').padEnd(2, '0'));
  return m[1] ? -c : c;
}
const reais = (c) => Math.round(c) / 100;

function agrupar(registros, chaves, campoValor) {
  const mapa = new Map();
  let naoLidos = 0;
  for (const r of registros) {
    const c = centavos(r[campoValor]);
    if (c === null) { naoLidos++; continue; }
    const k = chaves.map((x) => r[x] ?? '').join('\u0000');
    const g = mapa.get(k) || { ...Object.fromEntries(chaves.map((x) => [x, r[x] ?? null])), registros: 0, c: 0 };
    g.registros++; g.c += c; mapa.set(k, g);
  }
  const lista = [...mapa.values()].map(({ c, ...g }) => ({ ...g, total: reais(c) }));
  return { lista, naoLidos };
}

export function resumirDespesas(regs) {
  const porEvento = agrupar(regs, ['evento'], 'vl_despesa');
  const porOrgao = agrupar(regs, ['orgao', 'evento'], 'vl_despesa');
  return {
    registros: regs.length,
    valores_nao_lidos: porEvento.naoLidos,
    por_evento: porEvento.lista.sort((a, b) => a.evento.localeCompare(b.evento, 'pt-BR')),
    por_orgao_e_evento: porOrgao.lista.sort((a, b) => a.orgao.localeCompare(b.orgao, 'pt-BR') || a.evento.localeCompare(b.evento, 'pt-BR')),
  };
}

export function resumirReceitas(regs) {
  let c = 0, naoLidos = 0;
  for (const r of regs) { const v = centavos(r.vl_arrecadacao); if (v === null) naoLidos++; else c += v; }
  const porAlinea = agrupar(regs, ['ds_alinea'], 'vl_arrecadacao');
  const porFonte = agrupar(regs, ['ds_fonte_recurso'], 'vl_arrecadacao');
  const porOrgao = agrupar(regs, ['orgao'], 'vl_arrecadacao');
  const ord = (k) => (a, b) => String(a[k]).localeCompare(String(b[k]), 'pt-BR');
  return {
    registros: regs.length,
    valores_nao_lidos: naoLidos,
    total_arrecadado: reais(c),
    por_orgao: porOrgao.lista.sort(ord('orgao')),
    por_alinea: porAlinea.lista.sort(ord('ds_alinea')),
    por_fonte_recurso: porFonte.lista.sort(ord('ds_fonte_recurso')),
  };
}

const textoDe = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

/** Aviso oficial do TCE-SP sobre a origem dos dados (texto literal da página das APIs). */
export async function avisoOficial() {
  try {
    const t = textoDe(await obter(URL_DOC_API, { tipo: 'text' }));
    const m = t.match(/As informações constantes neste banco de dados[^]*?conta prestada\./);
    return m ? m[0].trim() : null;
  } catch { return null; }
}

/** Datas de atualização informadas na página "Conjunto de Dados" ("Despesas - 2025 28/10/2026 ..."). */
export async function datasConjuntos() {
  try {
    const t = textoDe(await obter(URL_CONJUNTOS, { tipo: 'text' }));
    const r = {};
    for (const m of t.matchAll(/(Despesas|Receitas) - (\d{4}) (\d{2})\/(\d{2})\/(\d{4})/g)) {
      r[`${m[1].toLowerCase()}-${m[2]}`] = `${m[5]}-${m[4]}-${m[3]}`;
    }
    return r;
  } catch { return {}; }
}

/**
 * Atualiza o arquivo do exercício. `anterior` é o conteúdo já gravado (ou null).
 * Modo: { completo, desde } — sem nenhum dos dois, consulta só meses ainda sem dados
 * e os 3 últimos meses com dados (o município pode reenviar informações ao Audesp).
 */
export async function coletarExercicio(ano, anterior, { completo = false, desde = null, aviso, conjuntos } = {}) {
  const hoje = hojeISO();
  const [anoHoje, mesHoje] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7))];
  const ultimoMes = ano < anoHoje ? 12 : ano === anoHoje ? mesHoje : 0;
  const antigos = new Map((anterior?.meses || []).map((m) => [m.mes, m]));
  const comDados = [...antigos.values()].filter((m) => m.despesas?.registros || m.receitas?.registros).map((m) => m.mes).sort((a, b) => a - b);
  const recentes = new Set(comDados.slice(-3));
  const meses = [];
  for (let mes = 1; mes <= ultimoMes; mes++) {
    const antigo = antigos.get(mes);
    const chave = `${ano}-${String(mes).padStart(2, '0')}`;
    const consultar = completo || !antigo || recentes.has(mes) || (desde && chave >= desde.slice(0, 7))
      || !(antigo.despesas?.registros && antigo.receitas?.registros);
    if (!consultar) { meses.push(antigo); continue; }
    const [desp, rec] = await Promise.all([
      obter(urlMes('despesas', ano, mes), { timeoutMs: 180000 }),
      obter(urlMes('receitas', ano, mes), { timeoutMs: 180000 }),
    ]);
    meses.push({
      mes,
      nome: MESES[mes - 1],
      url_despesas: urlMes('despesas', ano, mes),
      url_receitas: urlMes('receitas', ano, mes),
      consultado_em: hoje,
      despesas: resumirDespesas(Array.isArray(desp) ? desp : []),
      receitas: resumirReceitas(Array.isArray(rec) ? rec : []),
    });
  }
  const preenchidos = meses.filter((m) => m.despesas.registros || m.receitas.registros);
  const ultimo = preenchidos.length ? preenchidos[preenchidos.length - 1].mes : null;
  const vazios = meses.filter((m) => !m.despesas.registros && !m.receitas.registros).map((m) => m.nome);
  const lacunas = [
    'A API de despesas do TCE-SP não traz a classificação por função de governo nem por categoria econômica; o resumo de despesas é por órgão e por fase (evento) da despesa, como a API informa.',
    'Os totais de despesas são separados por evento (empenhado, liquidado, pago, reforço, anulação) e não devem ser somados entre eventos.',
  ];
  if (vazios.length) lacunas.push(`Meses sem dados na API na data da consulta: ${vazios.join(', ')}.`);
  if (!aviso) lacunas.push('Aviso oficial do TCE-SP sobre a origem dos dados não pôde ser lido na data da coleta.');
  const atualizacaoDesp = conjuntos?.[`despesas-${ano}`] || null;
  const atualizacaoRec = conjuntos?.[`receitas-${ano}`] || null;
  if (!atualizacaoDesp && !atualizacaoRec) {
    lacunas.push(`A página "Conjunto de Dados" do TCE-SP não informa data de atualização para o exercício ${ano}.`);
  }
  return {
    atualizado_em: new Date().toISOString(),
    municipio: 'Estância de Atibaia (SP)',
    exercicio: ano,
    fonte: {
      titulo: 'Portal da Transparência Municipal do TCE-SP — APIs de despesas e receitas',
      url: URL_DOC_API,
      orgao: 'Tribunal de Contas do Estado de São Paulo (TCE-SP)',
      acessado_em: hoje,
    },
    aviso_oficial: aviso || null,
    atualizacao_informada: {
      descricao: 'Data de atualização exibida pelo TCE-SP na página "Conjunto de Dados" para os arquivos do exercício (quando houver)',
      despesas: atualizacaoDesp,
      receitas: atualizacaoRec,
      url: URL_CONJUNTOS,
    },
    ultimo_mes_com_dados: ultimo ? { mes: ultimo, nome: MESES[ultimo - 1], verificado_em: hoje } : null,
    metodo: 'Para cada mês, os registros devolvidos pela API foram somados (em centavos) por grupo. Nenhum valor foi estimado ou corrigido; valores que a API traz em formato não numérico são contados em "valores_nao_lidos".',
    meses,
    lacunas,
  };
}
