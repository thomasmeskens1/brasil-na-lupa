#!/usr/bin/env node
/**
 * Cota para o Exercício da Atividade Parlamentar dos Senadores (CEAPS) → dados/senado/despesas/<ano>/
 *   <id-senador>.json    totais por mês, por tipo de despesa e por fornecedor (com contagem de documentos),
 *                        total oficial de "recursos utilizados" e diferença; sem a lista de documentos
 *   resumo.json          totais por senador
 *   pagina-oficial.json  cache dos totais por recurso publicados pelo Senado ("recursos utilizados")
 *
 * USO (Node 20+, sem dependências):
 *   node scripts/coleta/senado/despesas.mjs              # ano corrente (horário de Brasília)
 *   node scripts/coleta/senado/despesas.mjs --ano 2026 [--forcar]
 *
 * FONTES (Dados Abertos Administrativos do Senado Federal, https://adm.senado.gov.br/adm-dadosabertos):
 *   GET /api/v1/senadores/despesas_ceaps/{ano}                       um registro por documento (JSON, UTF-8),
 *       com codSenador (= CodigoParlamentar da API legislativa). É a mesma base do arquivo
 *       https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_{ano}.csv, que vem em windows-1252
 *       e sem o código do senador; por isso o JSON é usado.
 *   GET /api/v1/senadores/{codigo}/recursos-utilizados?ano={ano}     totais por recurso exibidos na página de
 *       transparência do senador (www6g.senado.leg.br/transparencia/sen/{codigo}/?ano=), usados para conferência.
 *       Consultado quando o arquivo de despesas muda, uma vez por semana, ou com --forcar.
 *   GET legis.senado.leg.br/dadosabertos/senador/lista/atual         marca quem está em exercício.
 *
 * PRIVACIDADE (diretriz 12): o CPF de fornecedor pessoa física (a fonte publica mascarado, ex. "123.***.***-45")
 * nunca é gravado, e o nome aparece como "[nome de particular omitido]". O mesmo vale quando o documento do
 * fornecedor não é um CNPJ válido de 14 dígitos. CNPJ e razão social de empresa são mantidos. Os campos
 * "detalhamento" (que traz nomes de passageiros) e "documento" não são gravados.
 */
import { readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  obter, paraCada, gravarSeMudou, lerJson, fonte, cmpPt, hojeISO, senadoresEmExercicio, carregarRobots,
  robotsCarregados, estat, gravacoes, SAIDA_SENADO, NAO_DISPONIVEL, BASE,
} from './presenca.mjs';
import crypto from 'node:crypto';

export const ADM = 'https://adm.senado.gov.br/adm-dadosabertos';
export const NOME_OMITIDO = '[nome de particular omitido]';
const DIAS_PAGINA_OFICIAL = 7;

export const DEFINICOES_DESPESAS = {
  total_liquido: 'Soma de "valorReembolsado" (valor reembolsado ao senador) dos documentos do arquivo oficial da CEAPS, em reais. Valores negativos são estornos registrados pela própria fonte (ex.: bilhete cancelado).',
  mes: 'Mês de referência informado pela fonte (campo "mes"), que pode diferir do mês da data do documento.',
  tipo: 'Tipo de despesa como consta na fonte (campo "tipoDespesa"); null quando a fonte não informa.',
  documentos: 'Quantidade de documentos (registros) do arquivo oficial no mês, no tipo ou no fornecedor.',
  fornecedor: `Razão social do fornecedor pessoa jurídica (com CNPJ), como consta na fonte. Fornecedores pessoa física, ou sem CNPJ válido na fonte, aparecem juntos como "${NOME_OMITIDO}", sem CPF (diretriz 12).`,
  url_documentos: 'Página oficial de transparência do senador no ano, no portal do Senado Federal.',
  total_pagina_oficial: 'Total da CEAPS no ano em "recursos utilizados" do senador (Dados Abertos Administrativos do Senado, mesma informação da página de transparência), na data da consulta.',
  diferenca_para_arquivo: 'total_pagina_oficial menos total_liquido do arquivo; null quando são iguais.',
};

// ---------- leitores (puros, testados offline) ----------
const reais = (c) => Math.round(c) / 100;
const centavos = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
const limpar = (s) => (s == null ? null : String(s).replace(/\s+/g, ' ').trim() || null);

/** 'pessoa jurídica' (CNPJ de 14 dígitos), 'pessoa física' (CPF de 11 posições, inclusive mascarado) ou 'não identificado'. */
export function classificarFornecedor(doc) {
  const s = String(doc ?? '').trim();
  const digitos = s.replace(/\D/g, '');
  if (digitos.length === 14 && /^[\d./-]+$/.test(s)) return 'pessoa jurídica';
  if (/^\d{3}\.?[\d*]{3}\.?[\d*]{3}-?\d{2}$/.test(s)) return 'pessoa física';
  return 'não identificado';
}
/** CNPJ no formato 00.000.000/0000-00. */
export const formatarCnpj = (doc) => String(doc).replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

/**
 * Agrega os documentos da CEAPS por senador. Só o necessário para os totais é guardado; nenhum CPF, nome de
 * particular, número de documento ou detalhamento sai daqui. → { senadores: Map, totais }
 */
export function agregarCeaps(registros, ano) {
  const sen = new Map();
  let pf = 0, naoIdent = 0, semTipo = 0, foraDoAno = 0;
  for (const r of registros) {
    if (Number(r.ano) !== ano) { foraDoAno++; continue; }
    const id = r.codSenador != null ? String(r.codSenador) : null;
    if (!id) continue;
    if (!sen.has(id)) sen.set(id, { id, nome: limpar(r.nomeSenador), docs: 0, c: 0, mes: new Map(), tipo: new Map(), forn: new Map(), semTipo: 0, particulares: 0 });
    const s = sen.get(id);
    const c = centavos(r.valorReembolsado);
    const tipo = limpar(r.tipoDespesa);
    const classe = classificarFornecedor(r.cpfCnpj);
    if (classe === 'pessoa física') pf++;
    if (classe === 'não identificado') naoIdent++;
    if (!tipo) { semTipo++; s.semTipo++; }
    s.docs++; s.c += c;
    const mes = Number(r.mes) || null;
    const m = s.mes.get(mes) ?? { mes, documentos: 0, c: 0 }; m.documentos++; m.c += c; s.mes.set(mes, m);
    const t = s.tipo.get(tipo) ?? { tipo, documentos: 0, c: 0 }; t.documentos++; t.c += c; s.tipo.set(tipo, t);
    let chave, base;
    if (classe === 'pessoa jurídica') {
      const cnpj = formatarCnpj(r.cpfCnpj);
      chave = `pj:${cnpj}`;
      base = { fornecedor: limpar(r.fornecedor) ?? NAO_DISPONIVEL, cnpj, tipo_fornecedor: classe };
    } else {
      s.particulares++;
      chave = 'particular';
      base = { fornecedor: NOME_OMITIDO, cnpj: null, tipo_fornecedor: 'pessoa física ou sem CNPJ na fonte' };
    }
    const f = s.forn.get(chave) ?? { ...base, documentos: 0, c: 0 };
    f.documentos++; f.c += c;
    if (classe === 'pessoa jurídica' && f.fornecedor !== base.fornecedor && cmpPt(base.fornecedor, f.fornecedor) < 0) f.fornecedor = base.fornecedor; // nome estável
    s.forn.set(chave, f);
  }
  return { senadores: sen, totais: { cpf_de_fornecedor_omitidos: pf, documento_de_fornecedor_nao_identificado: naoIdent, documentos_sem_tipo: semTipo, fora_do_ano: foraDoAno } };
}

/** Totais por recurso de "recursos utilizados" → { total, por_tipo } (só a parte da CEAPS). null se ausente. */
export function lerRecursosUtilizados(json) {
  const d = Array.isArray(json?.data) ? json.data[0] : null;
  const cotas = d?.cotas;
  if (!cotas) return null;
  return {
    total: typeof cotas.totalValor === 'number' ? cotas.totalValor : null,
    por_tipo: (cotas.despesas ?? []).map((x) => ({ tipo: limpar(x.recurso), total: typeof x.valor === 'number' ? x.valor : null })),
    partido: d.parlamentar?.partido ?? null, uf: d.parlamentar?.estado ?? null,
  };
}

/** Conteúdo do arquivo de um senador (formato igual ao da Câmara, mais por_fornecedor e em_exercicio). */
export function montarArquivoSenador({ s, ano, hoje, of, exercicio, fonteArq }) {
  const tot = s?.c ?? 0;
  const lacunas = [];
  let diferenca = null;
  if (of && of.total != null && Math.round(of.total * 100) !== tot) {
    diferenca = reais(Math.round(of.total * 100) - tot);
    lacunas.push(`O total de "recursos utilizados" publicado pelo Senado (R$ ${of.total.toFixed(2)}) difere da soma dos documentos do arquivo da CEAPS (R$ ${reais(tot).toFixed(2)}).`);
  }
  if (!s) lacunas.push(`Nenhum documento deste senador no arquivo da CEAPS de ${ano} na data da coleta.`);
  if (s?.semTipo) lacunas.push(`${s.semTipo} documento(s) sem tipo de despesa informado na fonte, somando R$ ${reais(s.tipo.get(null)?.c ?? 0).toFixed(2)}.`);
  const id = s?.id ?? exercicio.id;
  return {
    atualizado_em: hoje, ano, parlamentar_id: id,
    nome_na_fonte: s?.nome ?? exercicio?.nome ?? null,
    partido_na_fonte: exercicio?.partido ?? of?.partido ?? null, uf_na_fonte: exercicio?.uf ?? of?.uf ?? null,
    em_exercicio: !!exercicio,
    total_liquido: reais(tot), documentos_qtd: s?.docs ?? 0, total_pagina_oficial: of?.total ?? null,
    pagina_oficial: of ? { total: of.total, diferenca_para_arquivo: diferenca, por_tipo: of.por_tipo.slice().sort((a, b) => cmpPt(a.tipo, b.tipo)) } : null,
    por_mes: s ? [...s.mes.values()].sort((a, b) => (a.mes ?? 99) - (b.mes ?? 99)).map((m) => ({ mes: m.mes, documentos: m.documentos, total_liquido: reais(m.c) })) : [],
    por_tipo: s ? [...s.tipo.values()].sort((a, b) => b.c - a.c || cmpPt(a.tipo, b.tipo)).map((t) => ({ tipo: t.tipo, documentos: t.documentos, total_liquido: reais(t.c) })) : [],
    por_fornecedor: s ? [...s.forn.values()].sort((a, b) => b.c - a.c || cmpPt(a.fornecedor, b.fornecedor) || cmpPt(a.cnpj, b.cnpj))
      .map((f) => ({ fornecedor: f.fornecedor, cnpj: f.cnpj, tipo_fornecedor: f.tipo_fornecedor, documentos: f.documentos, total_liquido: reais(f.c) })) : [],
    fonte: fonteArq,
    url_oficial: exercicio?.url_oficial ?? `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${id}`,
    url_documentos: `https://www6g.senado.leg.br/transparencia/sen/${id}/?ano=${ano}`,
    lacunas,
  };
}

// ---------- coleta ----------
export async function coletarDespesas({ ano, hoje, dirBase, forcar = false, log = console.error }) {
  await carregarRobots(new URL(ADM).host); // robots.txt antes de tudo
  await carregarRobots(new URL(BASE).host);
  const dir = path.join(dirBase, String(ano));
  const arqResumo = path.join(dir, 'resumo.json');
  const arqOficial = path.join(dir, 'pagina-oficial.json');

  const url = `${ADM}/api/v1/senadores/despesas_ceaps/${ano}`;
  const texto = await obter(url, { tipo: 'text', timeoutMs: 300_000 });
  const sha256 = crypto.createHash('sha256').update(texto).digest('hex');
  const registros = JSON.parse(texto);
  if (!Array.isArray(registros)) throw new Error('Resposta inesperada da CEAPS');
  if (ano === Number(hoje.slice(0, 4)) && Number(hoje.slice(5, 7)) > 2 && registros.length < 1000) throw new Error(`CEAPS ${ano} com poucos registros (${registros.length}); nada gravado`);
  const { senadores: sen, totais: tAg } = agregarCeaps(registros, ano);
  const exercicio = new Map((await senadoresEmExercicio()).map((s) => [s.id, s]));
  const ids = [...new Set([...sen.keys(), ...exercicio.keys()])];
  log(`despesas ${ano}: ${registros.length} documentos, ${sen.size} senadores no arquivo, ${exercicio.size} em exercício; ${tAg.cpf_de_fornecedor_omitidos} CPF(s) de fornecedor omitido(s)`);

  let oficial = await lerJson(arqOficial);
  const vencida = !oficial || oficial.consultado_em <= new Date(Date.parse(hoje) - DIAS_PAGINA_OFICIAL * 86400e3).toISOString().slice(0, 10);
  if (forcar || vencida || oficial.arquivo_ceaps_sha256 !== sha256 || ids.some((id) => !(id in (oficial.itens ?? {})))) {
    log(`despesas ${ano}: consultando "recursos utilizados" de ${ids.length} senadores…`);
    const itens = {};
    await paraCada(ids, async (id) => {
      try { itens[id] = lerRecursosUtilizados(await obter(`${ADM}/api/v1/senadores/${id}/recursos-utilizados?ano=${ano}`)); } catch { itens[id] = null; }
    });
    oficial = {
      consultado_em: hoje, ano, arquivo_ceaps_sha256: sha256,
      _descricao: 'Cache do coletor: total da CEAPS por recurso em "recursos utilizados" (Dados Abertos Administrativos do Senado), por código do senador.',
      fonte: fonte(`Recursos utilizados pelos senadores em ${ano} (Dados Abertos Administrativos do Senado)`, `${ADM}/api/v1/senadores/{id}/recursos-utilizados?ano=${ano}`, hoje),
      itens: Object.fromEntries(Object.keys(itens).sort((a, b) => Number(a) - Number(b)).map((k) => [k, itens[k]])),
    };
    await gravarSeMudou(arqOficial, oficial);
  }

  const fonteArq = fonte(`Cota para o Exercício da Atividade Parlamentar dos Senadores (CEAPS) ${ano} — Senado Federal`, url, hoje);
  const itensResumo = [];
  let totalGeral = 0, docsGeral = 0, comDiferenca = 0;
  for (const id of ids) {
    const s = sen.get(id) ?? null;
    const of = oficial?.itens?.[id] ?? null;
    const arq = montarArquivoSenador({ s, ano, hoje, of, exercicio: exercicio.get(id) ?? null, fonteArq });
    if (arq.pagina_oficial?.diferenca_para_arquivo != null) comDiferenca++;
    await gravarSeMudou(path.join(dir, `${id}.json`), arq);
    totalGeral += s?.c ?? 0; docsGeral += s?.docs ?? 0;
    itensResumo.push({
      parlamentar_id: id, nome_na_fonte: arq.nome_na_fonte, partido_na_fonte: arq.partido_na_fonte, uf_na_fonte: arq.uf_na_fonte,
      em_exercicio: arq.em_exercicio, documentos: arq.documentos_qtd, total_liquido: arq.total_liquido, total_pagina_oficial: arq.total_pagina_oficial,
    });
  }
  // Remove arquivos de senadores que deixaram de constar (nem no arquivo nem em exercício).
  if (existsSync(dir)) for (const f of await readdir(dir)) {
    const m = /^(\d+)\.json$/.exec(f);
    if (m && !ids.includes(m[1])) await unlink(path.join(dir, f));
  }
  itensResumo.sort((a, b) => cmpPt(a.nome_na_fonte, b.nome_na_fonte) || cmpPt(a.parlamentar_id, b.parlamentar_id));
  const totais = {
    senadores: itensResumo.length, senadores_no_arquivo: sen.size, senadores_em_exercicio: exercicio.size,
    senadores_em_exercicio_sem_documentos: [...exercicio.keys()].filter((id) => !sen.has(id)).length,
    documentos: docsGeral, total_liquido: reais(totalGeral), registros_na_fonte: registros.length,
    ...tAg, senadores_com_total_diferente_da_pagina_oficial: oficial ? comDiferenca : null,
  };
  const lacunasResumo = [
    'Os valores vêm do arquivo oficial da CEAPS (um registro por documento). Quando o total de "recursos utilizados" publicado pelo Senado é outro, a diferença fica em "total_pagina_oficial" e nas lacunas do arquivo do senador, sem estimativa.',
    `CPF de fornecedor pessoa física não é guardado e o nome aparece como "${NOME_OMITIDO}" (diretriz 12); o mesmo para fornecedor sem CNPJ válido na fonte. O detalhamento dos documentos (que cita passageiros) e o número do documento não são guardados.`,
    'A lista de documentos fica na página de transparência do senador (url_documentos).',
    'Inclui senadores que não estão mais em exercício mas têm documentos no ano (em_exercicio = false).',
  ];
  if (comDiferenca) lacunasResumo.push(`${comDiferenca} senador(es) com total do arquivo diferente de "recursos utilizados" (consultado em ${oficial.consultado_em}).`);
  await gravarSeMudou(arqResumo, {
    atualizado_em: hoje, ano, casa: 'senado', totais, definicoes: DEFINICOES_DESPESAS,
    fonte: fonteArq,
    fontes_complementares: [
      oficial?.fonte ?? fonte(`Recursos utilizados pelos senadores em ${ano}`, `${ADM}/api/v1/senadores/{id}/recursos-utilizados?ano=${ano}`, hoje),
      fonte('Senadores em exercício (Dados Abertos do Senado)', `${BASE}/senador/lista/atual`, hoje),
    ],
    pagina_oficial_consultada_em: oficial?.consultado_em ?? null,
    robots_txt: robotsCarregados(),
    lacunas: lacunasResumo, itens: itensResumo,
  });
  return totais;
}

function lerArgs(argv) {
  const a = { ano: null, forcar: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ano') a.ano = Number(argv[++i]);
    else if (argv[i].startsWith('--ano=')) a.ano = Number(argv[i].slice(6));
    else if (argv[i] === '--forcar' || argv[i] === '--completo') a.forcar = true;
    else if (argv[i] === '--ajuda' || argv[i] === '-h') { console.log('Uso: despesas.mjs [--ano AAAA] [--forcar]'); process.exit(0); }
    else throw new Error(`Argumento desconhecido: ${argv[i]}`);
  }
  if (a.ano != null && !(a.ano >= 2008 && a.ano <= 2100)) throw new Error('--ano inválido');
  return a;
}

async function principal() {
  const t0 = Date.now();
  const hoje = hojeISO();
  const a = lerArgs(process.argv.slice(2));
  const ano = a.ano ?? Number(hoje.slice(0, 4));
  if (ano > Number(hoje.slice(0, 4))) throw new Error('--ano no futuro');
  const totais = await coletarDespesas({ ano, hoje, dirBase: path.join(SAIDA_SENADO, 'despesas'), forcar: a.forcar });
  console.error(`[senado/despesas] ${JSON.stringify(totais)}; arquivos gravados ${gravacoes.gravados}, inalterados ${gravacoes.inalterados}; ` +
    `${estat.requisicoes} requisições (${estat.retentativas} retentativas); ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => { console.error(`[senado/despesas] ERRO: ${e.message}`); process.exit(1); });
}
