#!/usr/bin/env node
// Coletor da Fase 5 — Município de Atibaia-SP.
//
//   node scripts/coleta/atibaia/coletar.mjs                 rotina diária (só o que é novo)
//   node scripts/coleta/atibaia/coletar.mjs --desde 2026-10-01   reprocessa a partir da data
//   node scripts/coleta/atibaia/coletar.mjs --completo      reprocessa tudo (2025 em diante)
//   node scripts/coleta/atibaia/coletar.mjs --reindexar     sem rede: refaz índices, pendentes e máscaras
//                                                            a partir das edições já lidas (após curadoria)
//   opções: --anos 2025,2026   --so normas,vereadores,financas   --limite N (edições, para teste)
//
// Saídas (somente em dados/atibaia/):
//   normas/edicoes-<ano>.json  registro de cada edição lida (hash do PDF, páginas, candidatos)
//   normas/indice-<ano>.json   leis, leis complementares e decretos com confiança alta ou revisados
//   revisao/pendentes.json     candidatos incertos, para curadoria humana
//   revisao/curadoria.json     decisões da curadoria humana (editado à mão; o coletor só lê)
//   revisao/mascaras.json      lista de curadoria de nomes a omitir/manter por ato (diretriz 12; o coletor só lê)
//   revisao/mascaras-pendentes.json  atos retidos por dúvida sobre nome de pessoa física (não publicados)
//   vereadores.json            composição da Câmara pela ata mais recente publicada na IOE
//   financas/<ano>.json        receitas e despesas mensais (API do TCE-SP)
//   meta.json                  resumo da execução
//
// Requisitos: Node 20+; Python 3 com pdfplumber (pip install --user pdfplumber).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  obter, emLotes, gravarSeMudou, lerJson, hojeISO, estatisticas, contagemGravacao,
} from './lib.mjs';
import { listarEdicoes, baixarEExtrair, limparTemp, BASE_IOE, VERSAO_EXTRATOR } from './imprensa.mjs';
import { registroDaEdicao, consolidar, vereadoresDasAtas, semDocumentosNoAto } from './normas.mjs';
import { VERSAO_LEITOR } from './atos.mjs';
import { coletarExercicio, avisoOficial, datasConjuntos, URL_DOC_API } from './financas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DADOS = path.join(RAIZ, 'dados', 'atibaia');
const ARQ = {
  edicoes: (a) => path.join(DADOS, 'normas', `edicoes-${a}.json`),
  indice: (a) => path.join(DADOS, 'normas', `indice-${a}.json`),
  pendentes: path.join(DADOS, 'revisao', 'pendentes.json'),
  curadoria: path.join(DADOS, 'revisao', 'curadoria.json'),
  mascaras: path.join(DADOS, 'revisao', 'mascaras.json'),
  mascarasPendentes: path.join(DADOS, 'revisao', 'mascaras-pendentes.json'),
  vereadores: path.join(DADOS, 'vereadores.json'),
  financas: (a) => path.join(DADOS, 'financas', `${a}.json`),
  meta: path.join(DADOS, 'meta.json'),
};
const URL_CAMARA = 'https://www.camaraatibaia.sp.gov.br/';

function argumentos(argv) {
  const o = { completo: false, reindexar: false, desde: null, anos: null, so: null, limite: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { const v = a.includes('=') ? a.split('=').slice(1).join('=') : argv[++i]; if (!v) throw new Error(`valor ausente em ${a}`); return v; };
    if (a === '--completo') o.completo = true;
    else if (a === '--reindexar') o.reindexar = true;
    else if (a.startsWith('--desde')) o.desde = val();
    else if (a.startsWith('--anos')) o.anos = val().split(',').map(Number);
    else if (a.startsWith('--so')) o.so = new Set(val().split(','));
    else if (a.startsWith('--limite')) o.limite = Number(val());
    else throw new Error(`opção desconhecida: ${a}`);
  }
  if (o.reindexar && (o.completo || o.desde || o.limite)) throw new Error('--reindexar não combina com --completo, --desde ou --limite');
  if (o.desde && !/^\d{4}-\d{2}-\d{2}$/.test(o.desde)) throw new Error('--desde deve ser AAAA-MM-DD');
  if (o.anos && o.anos.some((x) => !Number.isInteger(x) || x < 2002 || x > 2100)) throw new Error('--anos inválido');
  if (o.limite !== null && !(o.limite > 0)) throw new Error('--limite deve ser positivo');
  const anoHoje = Number(hojeISO().slice(0, 4));
  if (!o.anos) o.anos = Array.from({ length: anoHoje - 2025 + 1 }, (_, k) => 2025 + k);
  return o;
}

const log = (...x) => console.log(new Date().toISOString().slice(11, 19), ...x);

async function coletarNormas(opc, hoje) {
  const registros = [];
  const resumo = { edicoes_no_calendario: 0, processadas_agora: 0, falhas: [] };
  for (const ano of opc.anos) {
    const { url: urlCal, edicoes } = await listarEdicoes(ano);
    resumo.edicoes_no_calendario += edicoes.length;
    const reg = lerJson(ARQ.edicoes(ano)) || { edicoes: [] };
    const porEd = new Map(reg.edicoes.map((e) => [e.edicao, e]));
    let fila = edicoes.filter((e) => {
      const r = porEd.get(e.edicao);
      return opc.completo || !r || r.url !== e.url || r.erro || (r.extrator_versao || 0) < VERSAO_EXTRATOR
        || (r.leitor_versao || 1) < VERSAO_LEITOR
        || (opc.desde && e.data >= opc.desde);
    });
    if (opc.limite) fila = fila.slice(-opc.limite);
    log(`IOE ${ano}: ${edicoes.length} edições no calendário; ${fila.length} a processar`);
    const salvar = () => {
      const lista = [...porEd.values()].sort((a, b) => a.data.localeCompare(b.data) || a.edicao.localeCompare(b.edicao, 'pt-BR', { numeric: true }));
      gravarSeMudou(ARQ.edicoes(ano), {
        atualizado_em: new Date().toISOString(),
        fonte: { titulo: `Imprensa Oficial Eletrônica da Estância de Atibaia — calendário de edições de ${ano}`, url: urlCal, orgao: 'Prefeitura da Estância de Atibaia', acessado_em: hoje },
        total_edicoes: lista.length,
        edicoes: lista,
      });
    };
    let feitas = 0;
    await emLotes(fila, 2, async (ed) => {
      try {
        const extr = await baixarEExtrair(ed);
        porEd.set(ed.edicao, registroDaEdicao(ed, extr, new Date().toISOString()));
        resumo.processadas_agora++;
      } catch (e) {
        resumo.falhas.push(`${ed.edicao}: ${e.message}`);
        const antigo = porEd.get(ed.edicao);
        porEd.set(ed.edicao, { ...(antigo || { edicao: ed.edicao, data: ed.data, url: ed.url, atos: [], presencas: [] }), erro: e.message.slice(0, 300) });
      }
      if (++feitas % 10 === 0) { log(`  ${ano}: ${feitas}/${fila.length}`); salvar(); }
    });
    salvar();
    registros.push(lerJson(ARQ.edicoes(ano)));
  }
  return { registros, resumo };
}

/** Lista de curadoria de máscaras: { ato_id: [{ trecho, substituir_por }] }; campos com "_" no início são comentários. */
function lerMascaras() {
  const m = lerJson(ARQ.mascaras);
  if (!m) return {};
  const regras = m.regras ?? m;
  for (const [k, v] of Object.entries(regras)) {
    if (k.startsWith('_')) continue;
    if (!Array.isArray(v)) throw new Error(`mascaras.json: "${k}" deve ser uma lista de { trecho, substituir_por }`);
  }
  return Object.fromEntries(Object.entries(regras).filter(([k]) => !k.startsWith('_')));
}

function gravarIndices(registros, hoje, opc) {
  const curadoria = lerJson(ARQ.curadoria);
  const { indices, pendentes, mascarasPendentes, estatisticas: est } = consolidar(registros, curadoria, hoje, lerMascaras());
  const datas = registros.flatMap((r) => r.edicoes.map((e) => e.data)).sort();
  const cobertura = { primeira_edicao: datas[0] || null, ultima_edicao: datas[datas.length - 1] || null };
  const anosIndice = new Set([...opc.anos.map(String), ...Object.keys(indices)]);
  for (const ano of anosIndice) {
    const itens = indices[ano] || [];
    gravarSeMudou(ARQ.indice(ano), {
      atualizado_em: new Date().toISOString(),
      ano: Number(ano),
      fonte: { titulo: 'Imprensa Oficial Eletrônica da Estância de Atibaia', url: BASE_IOE, orgao: 'Prefeitura da Estância de Atibaia', acessado_em: hoje },
      cobertura: { ...cobertura, observacao: 'Índice montado a partir das edições lidas nesse intervalo; atos do ano publicados fora dele não aparecem.' },
      criterio: 'Leis, leis complementares e decretos lidos na Imprensa Oficial. Só entram atos com número, data e ementa identificados de forma inequívoca no mesmo bloco de texto (confianca "alta") ou conferidos por curadoria humana (confianca "revisada"). A ementa é transcrita literalmente; os demais candidatos ficam em dados/atibaia/revisao/pendentes.json.',
      privacidade: 'Diretriz 12: exibir somente "ementa_publica", em que nomes de particulares (pessoas físicas que não são agentes públicos no exercício da função) aparecem como "[nome de particular omitido]" e CPF, RG e outros documentos pessoais como "[documento omitido]". O campo "ementa" é o texto literal, guardado para auditoria, sem números de documentos pessoais. Atos com dúvida sobre nome de pessoa física não entram no índice até a decisão da curadoria (dados/atibaia/revisao/mascaras-pendentes.json).',
      total: itens.length,
      itens,
    });
  }
  gravarSeMudou(ARQ.pendentes, {
    atualizado_em: new Date().toISOString(),
    instrucoes: 'Fila de curadoria humana. Para cada item, abrir o link (página da edição), conferir o ato e registrar a decisão em dados/atibaia/revisao/curadoria.json: { "id_candidato": "...", "decisao": "incluir" | "descartar", "correcao": { "tipo": "lei|lei-complementar|decreto", "numero": "...", "data": "AAAA-MM-DD", "ementa": "texto literal" }, "revisor": "...", "revisado_em": "AAAA-MM-DD", "observacao": "..." }. Nada desta lista é publicado sem essa decisão.',
    total: pendentes.length,
    itens: pendentes,
  });
  gravarSeMudou(ARQ.mascarasPendentes, {
    atualizado_em: new Date().toISOString(),
    instrucoes: 'Atos retidos (não publicados no índice) porque a ementa tem nome que pode ser de pessoa física sem contexto que o explique. Para cada um, abrir o link, decidir e registrar em dados/atibaia/revisao/mascaras.json: { "<ato_id>": [{ "trecho": "texto exato da ementa", "substituir_por": "[nome de particular omitido]" }] } para omitir, ou "substituir_por" igual ao "trecho" para manter (agente público no exercício da função, entidade, logradouro, homenagem pública). Depois, rodar o coletor com --reindexar.',
    total: mascarasPendentes.length,
    itens: mascarasPendentes,
  });
  if (!fs.existsSync(ARQ.mascaras)) {
    gravarSeMudou(ARQ.mascaras, {
      instrucoes: 'Lista de curadoria da diretriz 12, com prioridade sobre o detector automático. Chave: id do ato (ex.: atibaia-decreto-11468-2025). Valor: lista de { "trecho": texto exato da ementa, "substituir_por": "[nome de particular omitido]" | igual ao trecho para manter, "motivo": opcional }.',
      regras: {},
    });
  }
  if (!fs.existsSync(ARQ.curadoria)) {
    gravarSeMudou(ARQ.curadoria, {
      instrucoes: 'Arquivo editado somente por curadoria humana. Cada decisão referencia um id_candidato de pendentes.json. "incluir" publica o ato no índice com confianca "revisada" (campos de "correcao" substituem os lidos automaticamente); "descartar" retira o candidato da fila (ex.: citação, sumário, ato que não é do prefeito).',
      decisoes: [],
    });
  }
  return { est, pendentes: pendentes.length, aguardando_mascara: mascarasPendentes.length, publicados: Object.fromEntries(Object.entries(indices).map(([a, l]) => [a, l.length])) };
}

async function situacaoCamara() {
  try {
    const html = await obter(URL_CAMARA, { tipo: 'text', timeoutMs: 30000 });
    if (/wls_js|Carregando\.\.\./.test(html) && html.length < 5000) {
      return `O portal da Câmara Municipal (${URL_CAMARA}) responde a uma requisição simples apenas com uma página "Carregando..." que exige JavaScript e cookie (proteção anti-robô); o coletor não contorna essa proteção, por isso a composição foi lida da ata publicada na Imprensa Oficial.`;
    }
    return null;
  } catch (e) {
    return `O portal da Câmara Municipal (${URL_CAMARA}) não respondeu na data da coleta (${e.message.slice(0, 80)}).`;
  }
}

async function main() {
  const opc = argumentos(process.argv.slice(2));
  const faz = (x) => !opc.so || opc.so.has(x);
  const hoje = hojeISO();
  const meta = lerJson(ARQ.meta) || {};
  const execucao = { modo: opc.reindexar ? 'reindexar' : opc.completo ? 'completo' : opc.desde ? `desde ${opc.desde}` : 'diario', anos: opc.anos };
  log(`Atibaia — modo ${execucao.modo}; anos ${opc.anos.join(', ')}`);

  let registros = null;
  if (opc.reindexar) {
    // Sem rede: só reconsolida as edições já lidas (ex.: depois de editar a curadoria ou as máscaras).
    for (const ano of opc.anos) {
      const reg = lerJson(ARQ.edicoes(ano));
      if (!reg) continue;
      // Registros lidos antes da regra de documentos pessoais são saneados aqui (diretriz 12).
      for (const ed of reg.edicoes || []) for (const a of ed.atos || []) semDocumentosNoAto(a);
      gravarSeMudou(ARQ.edicoes(ano), reg);
    }
    registros = opc.anos.map((a) => lerJson(ARQ.edicoes(a))).filter(Boolean);
    meta.normas = { ...(meta.normas || {}), reindexado_em: new Date().toISOString(), ...gravarIndices(registros, hoje, opc) };
    log('reindexação:', JSON.stringify(meta.normas.est), 'pendentes', meta.normas.pendentes, 'aguardando máscara', meta.normas.aguardando_mascara);
    meta.atualizado_em = new Date().toISOString();
    gravarSeMudou(ARQ.meta, meta);
    log(`arquivos gravados: ${contagemGravacao.gravados}; sem mudança: ${contagemGravacao.inalterados}`);
    return;
  }
  if (faz('normas') || faz('vereadores')) {
    if (faz('normas')) {
      const r = await coletarNormas(opc, hoje);
      registros = r.registros;
      meta.normas = { ...r.resumo, ...gravarIndices(registros, hoje, opc) };
      log('normas:', JSON.stringify(meta.normas.est), 'pendentes', meta.normas.pendentes);
    } else {
      registros = opc.anos.map((a) => lerJson(ARQ.edicoes(a))).filter(Boolean);
    }
    if (faz('vereadores')) {
      const extra = await situacaoCamara();
      const v = vereadoresDasAtas(registros, hoje, extra ? [extra] : []);
      gravarSeMudou(ARQ.vereadores, v);
      meta.vereadores = { total: v.itens.length, fonte: v.fonte?.url ?? null, sessao: v.sessao ?? null };
      log(`vereadores: ${v.itens.length} (${v.sessao?.descricao ?? 'sem ata'})`);
    }
  }

  if (faz('financas')) {
    const [aviso, conjuntos] = await Promise.all([avisoOficial(), datasConjuntos()]);
    meta.financas = {};
    for (const ano of opc.anos) {
      const f = await coletarExercicio(ano, lerJson(ARQ.financas(ano)), { completo: opc.completo, desde: opc.desde, aviso, conjuntos });
      gravarSeMudou(ARQ.financas(ano), f);
      meta.financas[ano] = { meses: f.meses.length, ultimo_mes_com_dados: f.ultimo_mes_com_dados?.nome ?? null };
      log(`finanças ${ano}: último mês com dados = ${f.ultimo_mes_com_dados?.nome ?? 'nenhum'}`);
    }
  }

  meta.atualizado_em = new Date().toISOString();
  meta.ultima_execucao = { ...execucao, data: hoje, requisicoes: estatisticas.requisicoes, retentativas: estatisticas.retentativas, megabytes: Math.round(estatisticas.bytes / 1e5) / 10 };
  meta.fontes = [
    { titulo: 'Imprensa Oficial Eletrônica da Estância de Atibaia', url: BASE_IOE, orgao: 'Prefeitura da Estância de Atibaia', acessado_em: hoje },
    { titulo: 'APIs do Portal da Transparência Municipal', url: URL_DOC_API, orgao: 'TCE-SP', acessado_em: hoje },
    { titulo: 'Portal da Câmara Municipal da Estância de Atibaia', url: URL_CAMARA, orgao: 'Câmara Municipal da Estância de Atibaia', acessado_em: hoje },
  ];
  meta.observacoes = [
    'Votos individuais dos vereadores não são publicados de forma estruturada pela Câmara; só constam em atas e vídeos e exigem curadoria (ver docs/pesquisa/pedido-sic-camara-atibaia.md).',
    'A exportação de "Dados Abertos" da Câmara traz apenas os 10 itens mais recentes por tipo e o portal exige JavaScript; o coletor não contorna essa proteção.',
  ];
  gravarSeMudou(ARQ.meta, meta);
  log(`arquivos gravados: ${contagemGravacao.gravados}; sem mudança: ${contagemGravacao.inalterados}; requisições: ${estatisticas.requisicoes}`);
  if (estatisticas.falhas.length) log(`falhas de rede: ${estatisticas.falhas.length}`);
  if (meta.normas?.falhas?.length) { log('edições com falha:', meta.normas.falhas.join(' | ')); process.exitCode = 2; }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(limparTemp);
