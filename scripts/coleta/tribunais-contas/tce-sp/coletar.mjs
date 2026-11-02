#!/usr/bin/env node
/**
 * Coletor do Tribunal de Contas do Estado de São Paulo (TCE-SP) — Brasil Transparente.
 *
 * Gera, em dados/tribunais-contas/tce-sp/:
 *   contas-governador/<exercicio>.json  parecer prévio sobre as contas do Governador (tipo "julgamento")
 *   contas-prefeitos/<municipio>.json   pareceres sobre as contas do Prefeito, um item por exercício
 *   meta.json                           data da execução, contagens, fontes, restrições e lacunas
 *
 * Uso (Node 20+):
 *   node scripts/coleta/tribunais-contas/tce-sp/coletar.mjs              rotina diária (exercícios desde ano atual − 3)
 *   node scripts/coleta/tribunais-contas/tce-sp/coletar.mjs --desde 2020 exercícios do Governador a partir de 2020
 *   node scripts/coleta/tribunais-contas/tce-sp/coletar.mjs --completo   todos os exercícios publicados na página
 *
 * Extração de PDF: Python com pdfplumber, sempre com "python -I" numa pasta temporária vazia.
 *   python -m venv scripts/coleta/tribunais-contas/tce-sp/.venv
 *   scripts/coleta/tribunais-contas/tce-sp/.venv/Scripts/python -m pip install -r scripts/coleta/tribunais-contas/tce-sp/requirements.txt
 *   (ou defina TCESP_PYTHON com o caminho de um Python que tenha pdfplumber)
 *
 * Regras de acesso: só www.tce.sp.gov.br e transparencia.tce.sp.gov.br (robots.txt Drupal padrão). Os hosts
 * www10.tce.sp.gov.br (robots "Disallow: /"), doe.tce.sp.gov.br ("Disallow: /pdf/") e www2.tce.sp.gov.br (403)
 * são bloqueados no código. No máximo 2 requisições simultâneas, até 5 tentativas, gravação atômica e
 * nenhum arquivo é regravado quando o conteúdo (fora as datas de coleta) não mudou.
 */
import path from 'node:path';
import { obter, gravarSeMudou, contagemGravacao, estatisticas, conferirPython, hojeISO, fonte, SAIDA } from './lib.mjs';
import { URL_CONTAS_ANUAIS, lerPaginaContasAnuais, montarExercicio, julgamentosAlesp } from './governador.mjs';
import { MUNICIPIOS, baixarPareceres, montarMunicipio, URL_PARECERES, URL_CONJUNTOS, LACUNA_LAI } from './prefeitos.mjs';

function argumentos(argv) {
  const a = { desde: null, completo: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--completo') a.completo = true;
    else if (argv[i] === '--desde') a.desde = Number(argv[++i]);
    else if (argv[i].startsWith('--desde=')) a.desde = Number(argv[i].slice(8));
    else if (argv[i] === '--ajuda' || argv[i] === '-h') { console.log('Uso: coletar.mjs [--desde AAAA] [--completo]'); process.exit(0); }
    else throw new Error(`argumento desconhecido: ${argv[i]}`);
  }
  if (a.desde !== null && !(Number.isInteger(a.desde) && a.desde >= 1990 && a.desde <= 2100)) throw new Error('--desde precisa de um ano (AAAA)');
  return a;
}

async function main() {
  const inicio = Date.now();
  const args = argumentos(process.argv.slice(2));
  const anoAtual = Number(hojeISO().slice(0, 4));
  const ultimoExercicio = anoAtual - 1; // contas de um exercício só são prestadas no ano seguinte
  conferirPython();

  // ---- Governador
  const pagina = await obter(URL_CONTAS_ANUAIS);
  const exercicios = lerPaginaContasAnuais(pagina.corpo);
  if (!exercicios.length) throw new Error('Página Contas Anuais sem exercícios (layout mudou?)');
  const publicados = new Map(exercicios.map((e) => [e.exercicio, e]));
  const desde = args.completo ? Math.min(...publicados.keys()) : (args.desde ?? anoAtual - 3);
  const alvo = [];
  for (let a = desde; a <= ultimoExercicio; a++) alvo.push(a);
  const alesp = julgamentosAlesp();
  const resumoGov = [];
  for (const ano of alvo) {
    let item;
    try {
      item = await montarExercicio(ano, publicados.get(ano), alesp);
    } catch (e) {
      console.error(`exercício ${ano}: ${e.message}`);
      resumoGov.push({ exercicio: ano, erro: e.message });
      continue;
    }
    gravarSeMudou(path.join(SAIDA, 'contas-governador', `${ano}.json`), item);
    resumoGov.push({
      exercicio: ano,
      publicado: publicados.has(ano),
      data_julgamento: item.data_julgamento,
      conclusao: item.parecer.conclusao,
      com_ressalvas: item.parecer.com_ressalvas,
      relator: item.relator,
      julgamento_politico: item.julgamento_politico ? `${item.julgamento_politico.proposicao.sigla} ${item.julgamento_politico.proposicao.numero}/${item.julgamento_politico.proposicao.ano}` : null,
      situacao_conferencia: item.situacao_conferencia,
      lacunas: item.lacunas.length,
    });
  }

  // ---- Prefeitos
  const base = await baixarPareceres();
  const resumoMun = [];
  for (const mun of MUNICIPIOS) {
    const arq = montarMunicipio(mun, base, ultimoExercicio);
    gravarSeMudou(path.join(SAIDA, 'contas-prefeitos', `${mun.id}.json`), arq);
    resumoMun.push({ municipio: mun.id, ...arq.contagens });
  }

  // ---- meta
  const falhas = resumoGov.filter((r) => r.erro);
  const meta = {
    atualizado_em: new Date().toISOString(),
    ultima_execucao: new Date().toISOString(),
    tribunal: 'tce-sp',
    modo: args.completo ? 'completo' : 'incremental',
    periodo: { contas_governador: { inicio: desde, fim: ultimoExercicio }, contas_prefeitos: 'exercícios de 2008 até o ano anterior ao atual' },
    contagens: {
      exercicios_governador_publicados_na_pagina: publicados.size,
      exercicios_governador_processados: resumoGov.length - falhas.length,
      exercicios_governador_com_erro: falhas.length,
      linhas_conjunto_pareceres: base.registros.length,
      municipios: resumoMun,
    },
    contas_governador: resumoGov,
    fontes: [
      fonte('Contas Anuais (página oficial)', URL_CONTAS_ANUAIS),
      { ...fonte('Conjunto de dados "Pareceres" (Contas de Prefeituras 2008 a 2017)', URL_PARECERES), pagina: URL_CONJUNTOS, sha256: base.sha256, atualizado_na_fonte: base.last_modified },
    ],
    robots_e_restricoes: [
      'Acessados: www.tce.sp.gov.br (página Contas Anuais e PDFs em /sites/default/files/portal/) e transparencia.tce.sp.gov.br (conjuntos de dados); robots.txt Drupal padrão, que não bloqueia esses caminhos.',
      'Não acessados: www10.tce.sp.gov.br (robots.txt "Disallow: /"; pesquisa de pareceres municipais e de processos), doe.tce.sp.gov.br (robots.txt "Disallow: /pdf/") e www2.tce.sp.gov.br (HTTP 403). O bloqueio está no código do coletor.',
      'Listas de responsáveis por contas julgadas irregulares não são republicadas (podem trazer particulares).',
    ],
    observacoes: [
      'Contas do Governador: relator e número do processo vêm da página Contas Anuais; data e tipo da sessão, lista "Pelo voto de…", presidente, conclusão, ressalvas e determinações vêm do texto literal do PDF "Decisão"/"Nota de Decisão" do Tribunal Pleno.',
      'Os PDFs de "Parecer" assinado de 2023 e 2024 usam fontes sem mapeamento de texto (ilegíveis por máquina, sem OCR); o coletor registra isso em cada exercício.',
      'Julgamento político: ligado ao Projeto de Decreto Legislativo da ALESP sobre as contas do exercício, quando existir nos dados já coletados em dados/alesp (votações por id).',
      `Contas dos Prefeitos de 2018 em diante: "${LACUNA_LAI}".`,
      'Conferência: os campos extraídos de 2023 e 2024 foram conferidos por amostragem contra os PDFs oficiais em 02/11/2026.',
    ],
    estatisticas_http: { ...estatisticas, falhas: estatisticas.falhas.slice(0, 20) },
    duracao_s: Math.round((Date.now() - inicio) / 1000),
  };
  gravarSeMudou(path.join(SAIDA, 'meta.json'), meta);

  console.log(JSON.stringify({ governador: resumoGov, prefeitos: resumoMun, gravados: contagemGravacao.gravados, inalterados: contagemGravacao.inalterados.length, http: { requisicoes: estatisticas.requisicoes, retentativas: estatisticas.retentativas, bytes: estatisticas.bytes } }, null, 2));
  if (falhas.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
