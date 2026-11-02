#!/usr/bin/env node
/**
 * Coletor automático do Tribunal de Contas da União (TCU) — Brasil Transparente.
 *
 * USO (Node 20+, sem dependências; de qualquer pasta):
 *   node scripts/coleta/tribunais-contas/tcu/coletar.mjs              # rotina diária (incremental)
 *   node scripts/coleta/tribunais-contas/tcu/coletar.mjs --completo   # relê 2025 em diante (≈35 mil registros, 15-40 min)
 *
 * INCREMENTAL: lê a API recupera-acordaos do mais novo para o mais antigo (páginas de 200) e para na
 * primeira página que contém uma KEY já gravada nos índices. Sem índice gravado, faz a leitura completa.
 * COMPLETO: pagina de 1000 em 1000 até a primeira página só com acórdãos anteriores a 2025.
 *
 * GERA (somente em dados/tribunais-contas/tcu/):
 *   acordaos/indice-<ano>.json        todos os acórdãos do ano (2025, 2026…): número, colegiado, tipo, data,
 *                                      relator, sumário literal, KEY (id), link oficial e PDF
 *   acordaos/<KEY>.json               formato "julgamento" para os acórdãos das coleções (colecoes.mjs):
 *                                      "contas-do-presidente" (parecer prévio + situação no Congresso) e "impostos"
 *   contas-do-presidente.json         exercícios 2023-2025: acórdão do TCU e situação da MCN no Congresso
 *   meta.json                         contagens, fontes, robots.txt, restrições respeitadas, lacunas
 *
 * FONTES (únicos hosts permitidos; qualquer outro é recusado antes da requisição — ver lib.mjs):
 *   dados-abertos.apps.tcu.gov.br     API de dados abertos do TCU (acórdãos)
 *   legis.senado.leg.br               Dados Abertos do Senado (tramitação das MCN das contas do Presidente)
 * NÃO ACESSA sites.tcu.gov.br (o robots.txt proíbe robôs de IA pelo nome; inclui os CSV anuais com quórum),
 * pesquisa.apps.tcu.gov.br (firewall anti-robô) nem as listas de responsáveis com contas irregulares
 * (certidoes.apps.tcu.gov.br: trazem CPF e não são republicadas).
 *
 * No máximo 2 requisições simultâneas, até 4 tentativas com espera crescente; gravação atômica; arquivo sem
 * mudança de conteúdo não é reescrito. Saída: 0 = ok; 1 = erro fatal; 2 = concluído com falhas parciais.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { definirHostsPermitidos, lerJson, gravarSeMudou, hojeISO, estatisticas, contagemGravacao, robotsCarregados } from './lib.mjs';
import { API, ANO_INICIAL, URL_MODELO, normalizar, lerIncremental, lerCompleto } from './acordaos.mjs';
import { COLECOES } from './colecoes.mjs';
import { situacaoMcn } from './congresso.mjs';
import { montarJulgamento, resumoContas } from './julgamento.mjs';
import { tratarSumario, OMITIDO_DOC } from './privacidade.mjs';
import { montarMeta } from './meta.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const DIR = path.join(RAIZ, 'dados', 'tribunais-contas', 'tcu');
const DIR_AC = path.join(DIR, 'acordaos');

export const HOSTS = ['dados-abertos.apps.tcu.gov.br', 'legis.senado.leg.br'];

function lerArgs(argv) {
  const a = { completo: false };
  for (const x of argv) {
    if (x === '--completo') a.completo = true;
    else if (x === '--ajuda' || x === '-h') { console.log('Uso: coletar.mjs [--completo]'); process.exit(0); }
    else throw new Error(`argumento desconhecido: ${x}`);
  }
  return a;
}

/** Índices gravados → Map(KEY → item). */
function lerIndices() {
  const mapa = new Map();
  if (!fs.existsSync(DIR_AC)) return mapa;
  for (const f of fs.readdirSync(DIR_AC)) {
    if (!/^indice-\d{4}\.json$/.test(f)) continue;
    for (const it of lerJson(path.join(DIR_AC, f))?.itens || []) mapa.set(it.id, it);
  }
  return mapa;
}

const ordem = (a, b) =>
  (b.data_sessao || '').localeCompare(a.data_sessao || '') ||
  (a.colegiado || '').localeCompare(b.colegiado || '') ||
  (Number(b.numero) || 0) - (Number(a.numero) || 0) ||
  a.id.localeCompare(b.id);

function contar(lista, campo) {
  const c = {};
  for (const it of lista) { const k = it[campo] ?? '(sem valor)'; c[k] = (c[k] || 0) + 1; }
  return Object.fromEntries(Object.entries(c).sort((x, y) => x[0].localeCompare(y[0])));
}

async function main() {
  const args = lerArgs(process.argv.slice(2));
  const hoje = hojeISO();
  const inicio = Date.now();
  definirHostsPermitidos(HOSTS);
  const log = (m) => console.log(m);
  const falhas = [];

  // 1. Acórdãos (API de dados abertos do TCU)
  const indice = lerIndices();
  const modo = args.completo || indice.size === 0 ? 'completo' : 'incremental';
  log(`TCU — modo ${modo}; ${indice.size} acórdãos já gravados`);
  const leitura = modo === 'completo'
    ? await lerCompleto({ log })
    : await lerIncremental(new Set(indice.keys()), { log });
  if (!leitura.completo) falhas.push(`leitura ${modo} parou no limite de páginas (${leitura.paginas}) sem chegar ao fim previsto`);

  const vistos = new Set();
  let novos = 0, atualizados = 0, foraDoPeriodo = 0, duplicados = 0;
  for (const r of leitura.registros) {
    if (vistos.has(r.key)) { duplicados++; continue; }
    vistos.add(r.key);
    if (!(Number(r.anoAcordao) >= ANO_INICIAL)) { foraDoPeriodo++; continue; }
    const antigo = indice.get(r.key);
    const item = normalizar(r, antigo?.coletado_em ?? hoje);
    if (!antigo) novos++;
    else if (JSON.stringify(antigo) !== JSON.stringify(item)) atualizados++;
    indice.set(r.key, item);
  }
  // Itens já gravados passam de novo pelas regras atuais (idempotente): o filtro de privacidade (defesa em
  // profundidade: uma regra nova vale também para o que foi coletado antes) e o link igual ao modelo, que não
  // é repetido no item.
  for (const [k, original] of indice) {
    let it = original;
    if (it.url && it.url === URL_MODELO.replace('{id}', k)) { const { url, ...resto } = it; it = resto; }
    if (it.sumario) {
      const t = tratarSumario(it.sumario, k);
      if (t.texto !== it.sumario) {
        const { aviso_privacidade, ...resto } = it;
        it = { ...resto, sumario: t.texto, ...(t.aviso ? { aviso_privacidade: t.aviso } : {}) };
      }
    }
    if (it !== original) indice.set(k, it);
  }
  const ausentesNaLeitura = modo === 'completo' ? [...indice.keys()].filter((k) => !vistos.has(k)).length : null;

  // 2. Índices anuais
  const porAno = new Map();
  for (const it of indice.values()) {
    if (!porAno.has(it.ano)) porAno.set(it.ano, []);
    porAno.get(it.ano).push(it);
  }
  const contagensAno = {};
  for (const [ano, itens] of [...porAno].sort((a, b) => a[0] - b[0])) {
    itens.sort(ordem);
    contagensAno[ano] = { total: itens.length, por_colegiado: contar(itens, 'colegiado'), por_tipo: contar(itens, 'tipo'), com_sumario: itens.filter((i) => i.sumario).length };
    gravarSeMudou(path.join(DIR_AC, `indice-${ano}.json`), {
      atualizado_em: hoje,
      tribunal: 'tcu',
      ano,
      fonte: { titulo: 'Acórdãos do TCU — API de dados abertos (recupera-acordaos)', url: API, orgao: 'Tribunal de Contas da União', acessado_em: hoje },
      descricao: 'Todos os acórdãos do ano publicados na API de dados abertos do TCU. "id" é a KEY oficial (o número do acórdão se repete entre colegiados). Link oficial de cada acórdão: "url_modelo" com {id} trocado pela KEY (ou "url" do item, quando houver); "url_pdf" é o inteiro teor.',
      url_modelo: URL_MODELO,
      lacunas: [
        'Processo e assunto: a API de dados abertos do TCU não traz esses campos (ficam null). Eles existem só no arquivo anual de jurisprudência, publicado em host que proíbe robôs de inteligência artificial e não é acessado; consulte o link oficial de cada acórdão.',
        'Sumário: a API só o preenche para acórdãos do tipo "ACÓRDÃO"; nos "ACÓRDÃO DE RELAÇÃO" vem vazio na fonte.',
        'Resultado (unanimidade ou maioria), ministros presentes, vencidos e declarações de voto não vêm na API.',
      ],
      total: itens.length,
      itens,
    });
  }

  // 3. Situação das contas do Presidente no Congresso (Senado)
  const contas = COLECOES['contas-do-presidente'];
  const congresso = new Map();
  for (const c of [...contas.itens, ...contas.somente_congresso]) {
    const id = `MCN ${c.mcn.numero}/${c.mcn.ano}`;
    try {
      congresso.set(id, await situacaoMcn(c.mcn, hoje));
    } catch (e) {
      falhas.push(`Senado ${id}: ${e.message}`);
      const anterior = lerJson(path.join(DIR, 'contas-do-presidente.json'))?.exercicios?.find((x) => x.julgamento_politico?.mensagem === id)?.julgamento_politico;
      if (anterior) congresso.set(id, anterior); // mantém o último estado gravado
    }
  }

  // 4. Arquivos "julgamento" das coleções
  const colecoesMeta = {};
  const divergencias = [];
  const membros = new Map(); // KEY → { colecoes, def }
  for (const [nome, col] of Object.entries(COLECOES)) {
    for (const def of col.itens) {
      if (!membros.has(def.key)) membros.set(def.key, { colecoes: [], def, natureza: col.natureza });
      membros.get(def.key).colecoes.push(nome);
    }
  }
  const julgamentos = new Map();
  for (const [key, m] of membros) {
    const it = indice.get(key);
    for (const nome of m.colecoes) (colecoesMeta[nome] ??= { titulo: COLECOES[nome].titulo, itens: [], ausentes: [] });
    if (!it) {
      divergencias.push(`${key} (${m.def.numero}/${m.def.ano}-${m.def.colegiado}) não está no índice da API`);
      for (const nome of m.colecoes) colecoesMeta[nome].ausentes.push(key);
      continue;
    }
    if (it.numero !== m.def.numero || it.ano !== m.def.ano || it.colegiado !== m.def.colegiado) {
      divergencias.push(`${key}: coleção espera ${m.def.numero}/${m.def.ano}-${m.def.colegiado}; API traz ${it.numero}/${it.ano}-${it.colegiado}`);
    }
    const jp = m.def.mcn ? congresso.get(`MCN ${m.def.mcn.numero}/${m.def.mcn.ano}`) ?? null : undefined;
    if (m.def.exercicio) {
      // O exercício das contas é conferido nas duas fontes oficiais: sumário da API e informe da MCN.
      if (!new RegExp(`(EXERC[ÍI]CIO|ANO) DE ${m.def.exercicio}`, 'i').test(it.sumario || '')) divergencias.push(`${key}: sumário da API não cita o exercício ${m.def.exercicio}`);
      if (jp?.recebimento_parecer_tcu && !jp.recebimento_parecer_tcu.texto_literal.includes(`exercício de ${m.def.exercicio}`)) divergencias.push(`${jp.mensagem}: informe de recebimento não cita o exercício ${m.def.exercicio}`);
    }
    const j = montarJulgamento(it, { colecoes: m.colecoes, natureza: m.natureza, def: m.def, julgamentoPolitico: jp, hoje });
    julgamentos.set(key, j);
    gravarSeMudou(path.join(DIR_AC, `${key}.json`), j);
    for (const nome of m.colecoes) colecoesMeta[nome].itens.push({ id: key, numero: j.numero, orgao: j.orgao, data_julgamento: j.data_julgamento, relator: j.relator });
  }
  for (const c of Object.values(colecoesMeta)) c.itens.sort((a, b) => (a.data_julgamento || '').localeCompare(b.data_julgamento || ''));

  // 5. Resumo das contas do Presidente (exercícios, acórdão do TCU e Congresso)
  gravarSeMudou(path.join(DIR, 'contas-do-presidente.json'), resumoContas(contas, julgamentos, congresso, hoje));

  // 6. meta.json
  const meta = montarMeta({
    hoje, modo, leitura, contagensAno, novos, atualizados, foraDoPeriodo, duplicados, ausentesNaLeitura,
    colecoesMeta, divergencias, falhas, congresso,
    privacidade: {
      omitidos: [...indice.values()].filter((i) => i.aviso_privacidade).map((i) => i.id).sort(),
      com_documento_trocado: [...indice.values()].filter((i) => i.sumario?.includes(OMITIDO_DOC)).length,
    },
    robots: robotsCarregados(), estatisticas,
    duracao_s: Math.round((Date.now() - inicio) / 1000),
  });
  gravarSeMudou(path.join(DIR, 'meta.json'), meta);

  log(`acórdãos gravados: ${indice.size} (novos ${novos}, atualizados ${atualizados}); páginas lidas: ${leitura.paginas}`);
  log(`coleções: ${[...julgamentos.keys()].length} arquivos "julgamento"; divergências: ${divergencias.length}`);
  log(`arquivos gravados: ${contagemGravacao.gravados}, inalterados: ${contagemGravacao.inalterados}; requisições: ${estatisticas.requisicoes}`);
  for (const f of [...falhas, ...divergencias]) console.error(`AVISO: ${f}`);
  return falhas.length || divergencias.length ? 2 : 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error('ERRO FATAL:', e.stack || e.message); process.exit(1); });
