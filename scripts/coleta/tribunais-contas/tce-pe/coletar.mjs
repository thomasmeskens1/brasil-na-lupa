#!/usr/bin/env node
/**
 * Coletor do Tribunal de Contas do Estado de Pernambuco (TCE-PE) — Brasil na Lupa.
 *
 * Fonte: API de Dados Abertos do TCE-PE (https://sistemas.tcepe.tc.br/DadosAbertos/), JSON em ISO-8859-1, sem chave.
 * Gera, em dados/tribunais-contas/tce-pe/:
 *   contas-governador/<exercicio>.json  parecer prévio sobre as contas do Governador (Resultados, Tipo=Governo, esfera E)
 *   contas-prefeitos/<municipio>.json   pareceres sobre as contas do Prefeito, um item por exercício (esfera M)
 *   meta.json                           data da execução, contagens, fontes, restrições e lacunas
 *
 * Uso (Node 20+):
 *   node scripts/coleta/tribunais-contas/tce-pe/coletar.mjs              rotina diária: prefeitos dos exercícios desde ano atual − 4
 *                                                                        e qualquer exercício ainda nunca baixado
 *   node scripts/coleta/tribunais-contas/tce-pe/coletar.mjs --desde 2018 rebaixa os exercícios municipais a partir de 2018
 *   node scripts/coleta/tribunais-contas/tce-pe/coletar.mjs --completo   todos os exercícios desde 2014
 *   COLETA_ORCAMENTO_MIN=20 node ...                                     para limpo ao fim do orçamento e grava o que tiver
 *
 * Regras de acesso: lê o robots.txt de sistemas.tcepe.tc.br antes de tudo (404 em 05/11/2026: sem regras) e o respeita;
 * uma requisição por vez, pausa de 1,5 s, User-Agent identificado. Os links do e-TCE (etce.tcepe.tc.br) são só guardados.
 * Uma consulta por exercício (cada uma demora de 20 s a 60 s no servidor e traz ~150 KB).
 */
import fs from 'node:fs';
import path from 'node:path';
import { lerRobots, gravarSeMudou, contagemGravacao, estatisticas, hojeISO, fonte, lerJson, restanteMs, apiIndisponivel, SAIDA } from './lib.mjs';
import { URL_CATALOGO, URL_DOC_RESULTADOS } from './parecer.mjs';
import { PRIMEIRO_EXERCICIO, baixarGovernador, processosPendentes, montarExercicioGovernador } from './governador.mjs';
import { baixarExercicioMunicipal, itemMunicipio, montarArquivoMunicipio, municipiosDosRegistros } from './prefeitos.mjs';

const MARGEM_MS = 4 * 60000; // não começa consulta nova com menos de 4 min de orçamento

function argumentos(argv) {
  const a = { desde: null, completo: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--completo') a.completo = true;
    else if (argv[i] === '--desde') a.desde = Number(argv[++i]);
    else if (argv[i].startsWith('--desde=')) a.desde = Number(argv[i].slice(8));
    else if (argv[i] === '--ajuda' || argv[i] === '-h') { console.log('Uso: coletar.mjs [--desde AAAA] [--completo]'); process.exit(0); }
    else throw new Error(`argumento desconhecido: ${argv[i]}`);
  }
  if (a.desde !== null && !(Number.isInteger(a.desde) && a.desde >= PRIMEIRO_EXERCICIO && a.desde <= 2100)) throw new Error(`--desde precisa de um ano (AAAA) a partir de ${PRIMEIRO_EXERCICIO}`);
  return a;
}

const temOrcamento = () => restanteMs() > MARGEM_MS;

function arquivosExistentes(dir) {
  try { return fs.readdirSync(dir).filter((n) => /^[a-z0-9-]+\.json$/.test(n)); } catch { return []; }
}

async function main() {
  const inicio = Date.now();
  const args = argumentos(process.argv.slice(2));
  const anoAtual = Number(hojeISO().slice(0, 4));
  const ultimo = anoAtual - 1; // contas de um exercício só são prestadas no ano seguinte
  const dirPref = path.join(SAIDA, 'contas-prefeitos');
  const existentes = arquivosExistentes(dirPref);
  const metaAntiga = lerJson(path.join(SAIDA, 'meta.json'));
  // Exercícios municipais já baixados em alguma execução: os que faltam entram na fila mesmo no modo incremental,
  // para uma coleta completa interrompida pelo orçamento continuar de onde parou.
  const coletados = new Set((metaAntiga?.exercicios_municipais_coletados ?? []).map(Number));
  const recentes = Math.max(PRIMEIRO_EXERCICIO, args.desde ?? anoAtual - 4);
  const alvoMun = [];
  for (let ano = ultimo; ano >= PRIMEIRO_EXERCICIO; ano--) if (args.completo || ano >= recentes || !coletados.has(ano)) alvoMun.push(ano);
  const completo = args.completo;
  const erros = [];
  let interrompido = false;

  const robots = await lerRobots();

  // ---- Governador (uma consulta para todos os exercícios; "Processos" só para exercícios sem resultado)
  const resumoGov = [];
  const consultasProcessos = { ...(metaAntiga?.consultas_processos_governador ?? {}) };
  let gov = null;
  try { gov = await baixarGovernador(); } catch (e) { erros.push(`Resultados (Governador): ${e.message}`); }
  // Sem a consulta do Governador, os arquivos já gravados ficam como estão.
  for (let ano = PRIMEIRO_EXERCICIO; gov && ano <= ultimo; ano++) {
    let pendentes = null;
    const arq = path.join(SAIDA, 'contas-governador', `${ano}.json`);
    if (!gov.regs.some((r) => r.exercicio === ano)) {
      // A entidade "Processos" responde devagar (até ~5 min por consulta): fora do modo completo, é consultada
      // no máximo uma vez a cada 7 dias por exercício; nos outros dias o arquivo anterior é mantido.
      const ultimaConsulta = consultasProcessos[ano];
      const recente = ultimaConsulta && Date.parse(hojeISO()) - Date.parse(ultimaConsulta) < 7 * 86400000;
      if (!args.completo && recente && lerJson(arq)) { resumoGov.push({ exercicio: ano, mantido: true }); continue; }
      if (temOrcamento() && !apiIndisponivel()) {
        try { pendentes = await processosPendentes(ano); consultasProcessos[ano] = hojeISO(); } catch (e) { erros.push(`Processos ${ano}: ${e.message}`); }
      } else interrompido = true;
    }
    const item = montarExercicioGovernador(ano, gov.regs, gov.url, pendentes);
    // Sem consulta de "Processos" (orçamento ou erro), mantém o arquivo anterior em vez de apagar o que se sabia.
    if (!pendentes && !item.parecer.conclusao && lerJson(arq)) { resumoGov.push({ exercicio: ano, mantido: true }); continue; }
    gravarSeMudou(arq, item);
    resumoGov.push({ exercicio: ano, processo: item.processo.numero, data_julgamento: item.data_julgamento, conclusao: item.parecer.conclusao, relator: item.relator, situacao: item.situacao_processo_literal });
  }

  // ---- Prefeitos (uma consulta por exercício, do mais recente para o mais antigo)
  const baixados = [];
  const pendentesMun = [];
  for (const ano of alvoMun) {
    if (!temOrcamento()) { interrompido = true; pendentesMun.push(ano); continue; }
    if (apiIndisponivel()) { pendentesMun.push(ano); continue; }
    try { baixados.push(await baixarExercicioMunicipal(ano)); } catch (e) { erros.push(`Resultados ${ano}: ${e.message}`); pendentesMun.push(ano); }
  }
  const municipios = municipiosDosRegistros(baixados.flatMap((b) => b.regs));
  for (const n of existentes) {
    const d = lerJson(path.join(dirPref, n));
    const id = n.slice(0, -5);
    if (d?.municipio?.nome && !municipios.has(id)) municipios.set(id, { id, nome: d.municipio.nome });
  }
  const resumoMun = { municipios: 0, por_resultado: {} };
  for (const mun of [...municipios.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const arq = path.join(dirPref, `${mun.id}.json`);
    const novos = new Map(baixados.map((b) => [b.exercicio, itemMunicipio(mun, b.exercicio, b.regs, b.url)]));
    const d = montarArquivoMunicipio(mun, lerJson(arq), novos, { inicio: PRIMEIRO_EXERCICIO, fim: ultimo });
    if (!d.itens.length) continue;
    gravarSeMudou(arq, d);
    resumoMun.municipios++;
    for (const it of d.itens) {
      const k = it.parecer.conclusao ?? 'sem parecer na API';
      resumoMun.por_resultado[k] = (resumoMun.por_resultado[k] || 0) + 1;
    }
  }

  // ---- meta
  for (const b of baixados) coletados.add(b.exercicio);
  const meta = {
    atualizado_em: new Date().toISOString(),
    ultima_execucao: new Date().toISOString(),
    tribunal: 'tce-pe',
    modo: completo ? 'completo' : 'incremental',
    interrompido_por_orcamento: interrompido,
    periodo: { contas_governador: { inicio: PRIMEIRO_EXERCICIO, fim: ultimo }, contas_prefeitos: { inicio: PRIMEIRO_EXERCICIO, fim: ultimo } },
    exercicios_municipais_baixados_nesta_execucao: baixados.map((b) => b.exercicio).sort(),
    exercicios_municipais_pendentes: pendentesMun.sort(),
    exercicios_municipais_coletados: [...coletados].sort(),
    consultas_processos_governador: consultasProcessos,
    contagens: {
      registros_governador: gov ? gov.regs.length : null,
      exercicios_governador_com_parecer: resumoGov.filter((r) => r.conclusao).length,
      registros_municipais_nesta_execucao: baixados.reduce((s, b) => s + b.regs.length, 0),
      registros_municipais_descartados: baixados.reduce((s, b) => s + b.descartados, 0),
      municipios: resumoMun.municipios,
      itens_municipais_por_resultado: resumoMun.por_resultado,
    },
    contas_governador: resumoGov,
    fontes: [
      fonte('API de Dados Abertos do TCE-PE — catálogo de entidades', URL_CATALOGO),
      fonte('API de Dados Abertos do TCE-PE — entidade "Resultados" (documentação)', URL_DOC_RESULTADOS),
      ...(gov ? [fonte('API de Dados Abertos do TCE-PE — contas de governo do Estado (consulta usada)', gov.url)] : []),
    ],
    robots_e_restricoes: [
      `robots.txt de sistemas.tcepe.tc.br lido no início de cada execução (HTTP ${robots.status}${robots.status === 404 ? ', sem regras' : `, ${robots.regras.length} regras aplicáveis`}).`,
      'Uma requisição por vez, pausa de 1,5 s entre elas, User-Agent identificado; sem chave, login, token ou CAPTCHA.',
      'Os documentos do parecer e a consulta de processos do e-TCE (etce.tcepe.tc.br) não são abertos pelo coletor; só o link oficial é guardado.',
      'O campo NomePessoa só é copiado para processos de contas de governo (responsáveis pela prefeitura ou pelo Governo do Estado); interessados da entidade "Processos" não são copiados.',
    ],
    observacoes: [
      'A entidade "Resultados" lista processos eletrônicos julgados; o primeiro exercício com contas de governo nela é 2014. Exercícios anteriores (processos físicos) não estão na API.',
      'O resultado ("Aprovação", "Aprovação com ressalvas", "Rejeição") é o texto literal do campo "Resultado". Ressalvas, votação e número do parecer não constam na API.',
      'A situação do processo ("Transitado em julgado", "Julgado (publicado)", "Finalizado"…) é copiada literalmente; a API não informa a data do trânsito em julgado.',
      'Julgamento político das contas (Alepe e Câmaras Municipais) ainda não coletado.',
    ],
    api_indisponivel: apiIndisponivel(),
    erros,
    estatisticas_http: { ...estatisticas, falhas: estatisticas.falhas.slice(0, 20) },
    duracao_s: Math.round((Date.now() - inicio) / 1000),
  };
  meta.ultima_coleta_completa = metaAntiga?.ultima_coleta_completa ?? null;
  if ((completo || !metaAntiga?.ultima_coleta_completa) && !pendentesMun.length && coletados.size === ultimo - PRIMEIRO_EXERCICIO + 1) meta.ultima_coleta_completa = hojeISO();
  gravarSeMudou(path.join(SAIDA, 'meta.json'), meta);

  console.log(JSON.stringify({ governador: resumoGov, prefeitos: resumoMun, baixados: meta.exercicios_municipais_baixados_nesta_execucao, pendentes: pendentesMun, interrompido, erros, gravados: contagemGravacao.gravados.length, inalterados: contagemGravacao.inalterados.length, http: { requisicoes: estatisticas.requisicoes, retentativas: estatisticas.retentativas, bytes: estatisticas.bytes } }, null, 2));
  if (erros.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
