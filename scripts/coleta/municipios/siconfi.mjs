#!/usr/bin/env node
/**
 * Finanças de todos os municípios pela API oficial de dados abertos do Siconfi (Tesouro Nacional),
 * de forma incremental. Node 20+, sem dependências.
 *
 * USO
 *   node scripts/coleta/municipios/siconfi.mjs                 # próxima fatia (orçamento de tempo)
 *   node scripts/coleta/municipios/siconfi.mjs --uf sp,am       # só estas UFs
 *   node scripts/coleta/municipios/siconfi.mjs --ibge 3504107   # só estes municípios (códigos IBGE)
 *   COLETA_ORCAMENTO_MIN=20 (padrão)   SICONFI_INTERVALO_MS=1500 (padrão; nunca menos de 1000)
 *
 * O QUE COLETA — Relatório Resumido da Execução Orçamentária (RREO), declarado pelo próprio município
 *   Anexo 01 (Balanço Orçamentário): receitas previstas e realizadas; despesas por categoria
 *            econômica (dotação atualizada, empenhada, liquidada, paga) — linhas principais
 *   Anexo 02 (Despesa por Função): dotação atualizada, empenhada e liquidada de cada função de governo
 *            (Saúde, Educação…), pela lista oficial de funções da Portaria MOG nº 42/1999
 *   Relatórios-alvo: 6º bimestre do último exercício encerrado (o ano inteiro) e o bimestre mais
 *   recente do exercício atual cujo prazo de publicação (30 dias após o fim do bimestre) já passou.
 *
 * SAÍDA  dados/municipios/financas/<ano>-b<bimestre>/<uf>.json   (um arquivo por UF e relatório)
 *        dados/municipios/financas/meta.json                      (relatórios-alvo, robots, contagens)
 *
 * INCREMENTAL: a cada execução, os municípios ainda não consultados para cada relatório-alvo (capitais
 * primeiro, depois por população), até o orçamento acabar. Município sem o relatório na API fica
 * registrado como "sem dados" com a data da consulta e é reconsultado depois de 15 dias.
 * Nada é calculado além de copiar os valores: nenhum total é somado ou deduzido.
 */
import path from 'node:path';
import { ClienteEducado, DIR_MUNICIPIOS, gravarCompacto, gravarSeMudou, hojeISO, lerJson, semAcento } from './lib.mjs';

const BASE = 'https://apidatalake.tesouro.gov.br';
const API = '/ords/siconfi/tt';
const DIR = path.join(DIR_MUNICIPIOS, 'financas');
const REVISITA_SEM_DADOS_DIAS = 15;

/** Funções de governo (Portaria MOG nº 42/1999, anexo) e a reserva de contingência do Anexo 02. */
export const FUNCOES = [
  'Legislativa', 'Judiciária', 'Essencial à Justiça', 'Administração', 'Defesa Nacional', 'Segurança Pública',
  'Relações Exteriores', 'Assistência Social', 'Previdência Social', 'Saúde', 'Trabalho', 'Educação', 'Cultura',
  'Direitos da Cidadania', 'Urbanismo', 'Habitação', 'Saneamento', 'Gestão Ambiental', 'Ciência e Tecnologia',
  'Agricultura', 'Organização Agrária', 'Indústria', 'Comércio e Serviços', 'Comunicações', 'Energia', 'Transporte',
  'Desporto e Lazer', 'Encargos Especiais', 'Reserva de Contingência',
];
const CHAVE_FUNCAO = new Map(FUNCOES.map((f) => [semAcento(f).replace(/[^a-z ]/g, ''), f]));

/** Linhas do Anexo 01 guardadas (cod_conta da fonte). */
export const LINHAS_RECEITA = ['TotalReceitas', 'ReceitasCorrentes', 'ReceitaTributaria', 'Impostos', 'TransferenciasCorrentes', 'ReceitasDeCapital', 'ReceitasDeOperacoesDeCredito'];
export const LINHAS_DESPESA = ['TotalDespesas', 'DespesasCorrentes', 'PessoalEEncargosSociais', 'JurosEEncargosDaDivida', 'OutrasDespesasCorrentes', 'DespesasDeCapital', 'Investimentos', 'AmortizacaoDaDivida'];

/** Coluna da fonte → campo (pelo início do rótulo, sem acento; o rótulo muda de letra entre anexos). */
export function campoColuna(coluna) {
  const c = semAcento(coluna);
  if (c.startsWith('previsao atualizada')) return 'prevista';
  if (c.startsWith('ate o bimestre')) return 'realizada';
  if (c.startsWith('dotacao atualizada')) return 'dotacao';
  if (c.startsWith('despesas empenhadas ate o bimestre')) return 'empenhada';
  if (c.startsWith('despesas liquidadas ate o bimestre')) return 'liquidada';
  if (c.startsWith('despesas pagas ate o bimestre')) return 'paga';
  return null;
}

const CAMPOS_R = ['prevista', 'realizada'];
const CAMPOS_D = ['dotacao', 'empenhada', 'liquidada', 'paga'];
const CAMPOS_F = ['dotacao', 'empenhada', 'liquidada'];
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Anexo 01 → { receitas: {cod: [prevista, realizada]}, despesas: {cod: [dotacao, empenhada, liquidada, paga]}, contas }. */
export function lerAnexo01(itens) {
  const receitas = {};
  const despesas = {};
  const contas = {};
  for (const x of itens || []) {
    const campo = campoColuna(x.coluna);
    if (!campo) continue;
    const ehR = LINHAS_RECEITA.includes(x.cod_conta);
    const ehD = LINHAS_DESPESA.includes(x.cod_conta);
    if (ehR && CAMPOS_R.includes(campo)) {
      const linha = (receitas[x.cod_conta] ??= CAMPOS_R.map(() => null));
      if (linha[CAMPOS_R.indexOf(campo)] == null) linha[CAMPOS_R.indexOf(campo)] = num(x.valor);
      contas[x.cod_conta] ??= x.conta;
    } else if (ehD && CAMPOS_D.includes(campo)) {
      const linha = (despesas[x.cod_conta] ??= CAMPOS_D.map(() => null));
      if (linha[CAMPOS_D.indexOf(campo)] == null) linha[CAMPOS_D.indexOf(campo)] = num(x.valor);
      contas[x.cod_conta] ??= x.conta;
    }
  }
  return { receitas, despesas, contas };
}

/** Anexo 02 → [[função, dotacao, empenhada, liquidada]] na ordem da fonte (só despesas exceto intra). */
export function lerAnexo02(itens) {
  const por = new Map();
  for (const x of itens || []) {
    if (!/exceto intra/i.test(semAcento(x.rotulo))) continue;
    const f = CHAVE_FUNCAO.get(semAcento(x.conta).replace(/[^a-z ]/g, '').trim());
    const campo = campoColuna(x.coluna);
    if (!f || !CAMPOS_F.includes(campo)) continue;
    const linha = por.get(f) ?? [f, null, null, null];
    const i = 1 + CAMPOS_F.indexOf(campo);
    if (linha[i] == null) linha[i] = num(x.valor);
    por.set(f, linha);
  }
  return [...por.values()];
}

/** Relatórios-alvo para a data de hoje. */
export function relatoriosAlvo(hoje) {
  const [a, m, d] = hoje.split('-').map(Number);
  const alvos = [{ ano: a - 1, periodo: 6 }];
  // Bimestre b termina no mês 2b; prazo de publicação: 30 dias depois (fim do mês seguinte).
  let melhor = 0;
  for (let b = 1; b <= 5; b++) {
    const prazoMes = 2 * b + 1; // mês do prazo
    if (m > prazoMes || (m === prazoMes && d >= 30)) melhor = b;
  }
  if (melhor) alvos.push({ ano: a, periodo: melhor });
  return alvos;
}

export const chaveAlvo = (r) => `${r.ano}-b${r.periodo}`;

function caminhoAnexo(r, anexo, ibge) {
  return `${API}/rreo?an_exercicio=${r.ano}&nr_periodo=${r.periodo}&co_tipo_demonstrativo=RREO&no_anexo=${encodeURIComponent(`RREO-Anexo ${anexo}`)}&id_ente=${ibge}`;
}

/** Ordem de prioridade: capitais, depois população (maior primeiro), depois código. */
export function ordenarEntes(entes) {
  return [...entes].sort((a, b) => b.capital - a.capital || (b.populacao ?? 0) - (a.populacao ?? 0) || a.cod_ibge - b.cod_ibge);
}

/** Precisa consultar? (nunca consultado, ou sem dados há mais de 15 dias). */
export function precisa(registro, hoje) {
  if (!registro) return true;
  if (!registro.sem_dados) return false;
  const lim = new Date(`${hoje}T12:00:00Z`);
  lim.setUTCDate(lim.getUTCDate() - REVISITA_SEM_DADOS_DIAS);
  return String(registro.consultado_em || '') < lim.toISOString().slice(0, 10);
}

export async function coletar({ entes, hoje, prazoMs, intervaloMs, log, fetchImpl, dormirImpl, agora, dir = DIR }) {
  const alvos = relatoriosAlvo(hoje);
  const cli = new ClienteEducado(BASE, { intervaloMs, prazoMs, fetchImpl, dormirImpl, agora, log });
  await cli.lerRobots();
  log(`robots.txt HTTP ${cli.robots.status}; intervalo ${cli.intervaloMs} ms; relatórios-alvo ${alvos.map(chaveAlvo).join(', ')}`);
  const arquivos = new Map(); // `${alvo}|${uf}` → objeto
  const arq = (alvo, uf) => {
    const k = `${chaveAlvo(alvo)}|${uf}`;
    if (!arquivos.has(k)) {
      const f = path.join(dir, chaveAlvo(alvo), `${uf}.json`);
      arquivos.set(k, { f, d: lerJson(f) || { exercicio: alvo.ano, periodo: alvo.periodo, uf, itens: {} }, mudou: false });
    }
    return arquivos.get(k);
  };
  const gravarTudo = () => {
    for (const a of arquivos.values()) {
      if (!a.mudou) continue;
      a.d.atualizado_em = hoje;
      a.d.fonte = {
        titulo: `Relatório Resumido da Execução Orçamentária (RREO), ${a.d.periodo}º bimestre de ${a.d.exercicio} — API de dados abertos do Siconfi`,
        url: `${BASE}${API}/rreo`, orgao: 'Tesouro Nacional (Siconfi)', acessado_em: hoje,
      };
      a.d.campos = { receitas: CAMPOS_R, despesas: CAMPOS_D, funcoes: ['funcao', ...CAMPOS_F] };
      a.d.itens = Object.fromEntries(Object.entries(a.d.itens).sort((x, y) => Number(x[0]) - Number(y[0])));
      gravarCompacto(a.f, a.d);
      a.mudou = false;
    }
  };
  let feitos = 0;
  const falhas = [];
  const ordem = ordenarEntes(entes);
  laco: for (const alvo of alvos) {
    for (const e of ordem) {
      const a = arq(alvo, e.uf);
      if (!precisa(a.d.itens[e.cod_ibge], hoje)) continue;
      if (!cli.cabe(20000)) break laco;
      try {
        const d1 = await cli.json(caminhoAnexo(alvo, '01', e.cod_ibge));
        const itens1 = d1?.items || [];
        if (d1?.hasMore) throw new Error('Anexo 01 paginado (não esperado)');
        if (!itens1.length) {
          a.d.itens[e.cod_ibge] = { consultado_em: hoje, sem_dados: true };
        } else {
          const d2 = cli.cabe(10000) ? await cli.json(caminhoAnexo(alvo, '02', e.cod_ibge)) : null;
          const r1 = lerAnexo01(itens1);
          a.d.contas = { ...(a.d.contas || {}), ...r1.contas };
          a.d.itens[e.cod_ibge] = {
            consultado_em: hoje,
            instituicao: itens1[0]?.instituicao ?? null,
            populacao: num(itens1[0]?.populacao),
            receitas: r1.receitas,
            despesas: r1.despesas,
            funcoes: d2 ? lerAnexo02(d2.items || []) : null,
          };
        }
        a.mudou = true;
        feitos++;
        if (feitos % 25 === 0) { gravarTudo(); log(`${feitos} consultas de município gravadas`); }
      } catch (err) {
        falhas.push(`${chaveAlvo(alvo)} ${e.cod_ibge}: ${err.message}`);
        log(`FALHA ${chaveAlvo(alvo)} ${e.nome}/${e.uf}: ${err.message}`);
        if (falhas.length >= 20) { log('muitas falhas; encerrando a execução'); break laco; }
      }
    }
  }
  gravarTudo();
  return { alvos, feitos, falhas, requisicoes: cli.requisicoes, robots: cli.robots };
}

function contagens(dir, alvos) {
  const out = {};
  for (const alvo of alvos) {
    let com = 0, sem = 0;
    const k = chaveAlvo(alvo);
    for (const uf of ['ac', 'al', 'am', 'ap', 'ba', 'ce', 'es', 'go', 'ma', 'mg', 'ms', 'mt', 'pa', 'pb', 'pe', 'pi', 'pr', 'rj', 'rn', 'ro', 'rr', 'rs', 'sc', 'se', 'sp', 'to']) {
      const d = lerJson(path.join(dir, k, `${uf}.json`));
      for (const v of Object.values(d?.itens || {})) v.sem_dados ? sem++ : com++;
    }
    out[k] = { com_dados: com, sem_dados: sem };
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const ufs = val('--uf') ? new Set(val('--uf').toLowerCase().split(',')) : null;
  const ibges = val('--ibge') ? new Set(val('--ibge').split(',').map(Number)) : null;
  const orcamentoMin = Number(process.env.COLETA_ORCAMENTO_MIN || 20);
  const intervaloMs = Math.max(1000, Number(process.env.SICONFI_INTERVALO_MS || 1500));
  const inicio = Date.now();
  const log = (...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(0)}s]`, ...m);
  const hoje = hojeISO();
  const ent = lerJson(path.join(DIR_MUNICIPIOS, 'entes.json'));
  if (!ent?.itens?.length) { console.error('dados/municipios/entes.json ausente: rode registro.mjs primeiro'); process.exit(1); }
  let entes = ent.itens.map(([cod_ibge, nome, uf, slug, capital, populacao]) => ({ cod_ibge, nome, uf, slug, capital, populacao }));
  if (ufs) entes = entes.filter((e) => ufs.has(e.uf));
  if (ibges) entes = entes.filter((e) => ibges.has(e.cod_ibge));
  const r = await coletar({ entes, hoje, prazoMs: inicio + orcamentoMin * 60000, intervaloMs, log });
  const meta = {
    atualizado_em: hoje,
    fonte: { titulo: 'API de dados abertos do Siconfi (Tesouro Nacional) — RREO', url: `${BASE}${API}/rreo`, orgao: 'Tesouro Nacional', acessado_em: hoje },
    robots: { 'apidatalake.tesouro.gov.br': r.robots },
    relatorios_alvo: r.alvos.map(chaveAlvo),
    ultima_execucao: { em: new Date().toISOString(), requisicoes: r.requisicoes, municipios_consultados: r.feitos, falhas: r.falhas.slice(0, 20) },
    contagens: contagens(DIR, r.alvos),
    observacoes: [
      'Valores declarados pelo próprio município ao Tesouro Nacional no RREO, copiados sem cálculo; o site não soma nem completa linhas ausentes.',
      'Funções de governo identificadas pelo nome exato da lista oficial (Portaria MOG nº 42/1999); as subfunções da fonte não são guardadas.',
      'Município sem o relatório na API: "sem dados" na data da consulta (o município pode não ter entregado ou o Tesouro ainda não publicou); reconsultado depois de 15 dias.',
    ],
  };
  gravarSeMudou(path.join(DIR, 'meta.json'), meta);
  log(`fim: ${r.requisicoes} requisições, ${r.feitos} municípios consultados; ${JSON.stringify(meta.contagens)}`);
  process.exit(r.falhas.length >= 20 ? 1 : 0);
}

if (process.argv[1] && /siconfi\.mjs$/.test(process.argv[1])) {
  main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
}
