#!/usr/bin/env node
/**
 * Coletor do Tribunal de Contas do Estado do Rio de Janeiro (TCE-RJ) — Brasil na Lupa.
 *
 * Gera, em dados/tribunais-contas/tce-rj/:
 *   contas-governador/<exercicio>.json  parecer prévio sobre as contas do Governador (indicador da API)
 *   contas-prefeitos/<municipio>.json   pareceres sobre as contas dos Prefeitos (91 municípios; a capital é do TCM-RJ)
 *   meta.json                           data da execução, contagens, fontes, restrições e lacunas
 *
 * Uso (Node 20+):  node scripts/coleta/tribunais-contas/tce-rj/coletar.mjs
 * Ambiente:        COLETA_ORCAMENTO_MIN (padrão 10) limita o tempo; ao esgotar, o coletor para e grava o que tiver.
 *
 * Fonte única: API de dados abertos https://dados.tcerj.tc.br/api/v1 (sem chave, licença ODbL). Duas consultas
 * por execução (rotas inteiras são pequenas: ~1 KB e ~100 KB), depois do robots.txt, em série, com pausa de 1,5 s.
 * Gravação atômica; arquivo sem mudança de conteúdo (fora as datas) não é regravado.
 */
import path from 'node:path';
import {
  SAIDA, URL_DOCS, LICENCA, obterJson, carregarRobots, gravarSeMudou, contagemGravacao, estatisticas,
  orcamentoEsgotado, ORCAMENTO_MS, hojeISO, fonte, lerJson,
} from './lib.mjs';
import { CAMINHO_ESTADO, URL_ESTADO, lerRegistrosEstado, montarExercicioGovernador } from './governador.mjs';
import { CAMINHO_MUNICIPIOS, URL_MUNICIPIOS, agruparMunicipios, carregarEntesRj, montarMunicipio } from './prefeitos.mjs';

async function main() {
  const inicio = Date.now();
  if (process.argv.slice(2).some((a) => a === '-h' || a === '--ajuda')) { console.log('Uso: coletar.mjs  (ambiente: COLETA_ORCAMENTO_MIN)'); return; }
  const ultimoExercicio = Number(hojeISO().slice(0, 4)) - 1; // contas de um exercício são prestadas no ano seguinte
  const erros = [];
  let interrompido = false;
  const robots = await carregarRobots();

  // ---- Governador
  const resumoGov = [];
  let periodoGov = null;
  try {
    const { dados } = await obterJson(CAMINHO_ESTADO);
    const porAno = lerRegistrosEstado(dados);
    if (!porAno.size) throw new Error('prestacao_contas_estado: nenhum exercício do Estado na resposta');
    const anos = [...porAno.keys()];
    periodoGov = { inicio: Math.min(...anos), fim: Math.max(ultimoExercicio, ...anos) };
    for (let ano = periodoGov.inicio; ano <= periodoGov.fim; ano++) {
      const item = montarExercicioGovernador(ano, porAno.get(ano));
      gravarSeMudou(path.join(SAIDA, 'contas-governador', `${ano}.json`), item);
      resumoGov.push({ exercicio: ano, indicador_na_fonte: item.parecer.indicador_na_fonte, conclusao: item.parecer.conclusao, processo: item.processo.numero });
    }
  } catch (e) {
    if (e.orcamento) interrompido = true;
    erros.push(`contas do Governador: ${e.message}`);
    console.error(`contas do Governador: ${e.message}`);
  }

  // ---- Prefeitos
  const resumoMun = { municipios: 0, com_parecer: 0, sem_parecer: 0, por_indicador: {}, grafia_conferida: [], sem_correspondencia: [] };
  let periodoMun = null;
  if (!orcamentoEsgotado()) {
    try {
      const { dados } = await obterJson(CAMINHO_MUNICIPIOS);
      const porMun = agruparMunicipios(dados);
      if (!porMun.size) throw new Error('prestacao_contas_municipio: resposta vazia');
      const anos = dados.map((r) => Number(r.Ano));
      periodoMun = { inicio: Math.min(...anos), fim: Math.max(ultimoExercicio, ...anos) };
      for (const r of dados) resumoMun.por_indicador[String(r.Indicador).trim()] = (resumoMun.por_indicador[String(r.Indicador).trim()] ?? 0) + 1;
      const entesRj = carregarEntesRj();
      const ids = new Set();
      for (const [nome, porAno] of porMun) {
        if (orcamentoEsgotado()) { interrompido = true; break; }
        const { arquivo, identificacao } = montarMunicipio(nome, porAno, entesRj, periodoMun);
        if (ids.has(arquivo.municipio.id)) throw new Error(`id de município repetido: ${arquivo.municipio.id}`);
        ids.add(arquivo.municipio.id);
        gravarSeMudou(path.join(SAIDA, 'contas-prefeitos', `${arquivo.municipio.id}.json`), arquivo);
        resumoMun.municipios++;
        resumoMun.com_parecer += arquivo.contagens.com_parecer_em_fonte_aberta;
        resumoMun.sem_parecer += arquivo.contagens.sem_fonte_aberta;
        if (identificacao === 'grafia-conferida') resumoMun.grafia_conferida.push(nome);
        if (identificacao === 'sem-correspondencia') resumoMun.sem_correspondencia.push(nome);
      }
    } catch (e) {
      if (e.orcamento) interrompido = true;
      erros.push(`contas dos Prefeitos: ${e.message}`);
      console.error(`contas dos Prefeitos: ${e.message}`);
    }
  } else interrompido = true;

  // ---- meta
  const agora = new Date().toISOString();
  const meta = {
    atualizado_em: agora,
    ultima_execucao: agora,
    tribunal: 'tce-rj',
    modo: 'completo',
    interrompido_por_orcamento: interrompido,
    orcamento_min: ORCAMENTO_MS / 60000,
    periodo: { contas_governador: periodoGov, contas_prefeitos: periodoMun },
    contagens: {
      exercicios_governador: resumoGov.length,
      exercicios_governador_com_parecer: resumoGov.filter((r) => r.conclusao).length,
      municipios: resumoMun.municipios,
      exercicios_prefeitos_com_parecer: resumoMun.com_parecer,
      exercicios_prefeitos_sem_parecer: resumoMun.sem_parecer,
      registros_municipais_por_indicador: resumoMun.por_indicador,
    },
    contas_governador: resumoGov,
    municipios_com_grafia_conferida: resumoMun.grafia_conferida,
    municipios_sem_correspondencia_ibge: resumoMun.sem_correspondencia,
    erros,
    fontes: [
      fonte('API de Dados Abertos do TCE-RJ — Prestação de Contas (Estado)', URL_ESTADO, { documentacao: URL_DOCS, licenca: LICENCA }),
      fonte('API de Dados Abertos do TCE-RJ — Prestação de Contas (Municípios)', URL_MUNICIPIOS, { documentacao: URL_DOCS, licenca: LICENCA }),
      { titulo: 'Entes da Federação — API de dados abertos do Siconfi (nome oficial e código IBGE dos municípios)', url: 'https://apidatalake.tesouro.gov.br/ords/siconfi/tt/entes', orgao: 'Tesouro Nacional', observacao: 'Lido de dados/municipios/entes.json, já coletado pelo projeto' },
    ],
    robots_e_restricoes: [
      `Acessado só dados.tcerj.tc.br (API de dados abertos). robots.txt lido antes de qualquer outra requisição em cada execução (HTTP ${robots.status}${robots.regras.disallow.length ? `; Disallow: ${robots.regras.disallow.join(', ')}` : '; nada proibido'}).`,
      'User-Agent identificado (BrasilNaLupa-coletor/1.0), requisições em série com pausa de 1,5 s, sem chave, login nem token. Se aparecer CAPTCHA, desafio anti-robô ou login, a coleta para e registra o erro.',
      'Não acessados: portais de consulta de processos e de jurisprudência do TCE-RJ (aplicações em JavaScript com APIs internas não documentadas como públicas).',
    ],
    observacoes: [
      'Contas do Governador e dos Prefeitos: o resultado exibido é o campo "Indicador" da rota "Prestação de Contas", reproduzido literalmente ("FAVORÁVEL" ou "CONTRÁRIO"). Outros valores (como "EM ANALISE") não viram conclusão e ficam registrados como lacuna.',
      'A API não traz relator, data da sessão, ressalvas, determinações nem inteiro teor; a documentação não define o campo "Indicador". Aviso da fonte: os dados são "conforme cadastrados", com completude e consistência de responsabilidade de quem os cadastrou.',
      'O Município do Rio de Janeiro não está na rota (é fiscalizado pelo Tribunal de Contas do Município do Rio de Janeiro, TCM-RJ).',
      'Julgamento político (Alerj e Câmaras Municipais): não coletado.',
    ],
    estatisticas_http: { ...estatisticas, falhas: estatisticas.falhas.slice(0, 20) },
    duracao_s: Math.round((Date.now() - inicio) / 1000),
  };
  // Seção não coletada nesta execução (erro ou orçamento): mantém os números da execução anterior.
  const anterior = lerJson(path.join(SAIDA, 'meta.json'));
  meta.secoes_nao_atualizadas = [];
  if (!periodoGov && anterior?.periodo?.contas_governador) {
    meta.secoes_nao_atualizadas.push('contas_governador');
    meta.periodo.contas_governador = anterior.periodo.contas_governador;
    meta.contas_governador = anterior.contas_governador ?? [];
    for (const k of ['exercicios_governador', 'exercicios_governador_com_parecer']) meta.contagens[k] = anterior.contagens?.[k] ?? null;
  }
  if (!resumoMun.municipios && anterior?.periodo?.contas_prefeitos) {
    meta.secoes_nao_atualizadas.push('contas_prefeitos');
    meta.periodo.contas_prefeitos = anterior.periodo.contas_prefeitos;
    for (const k of ['municipios', 'exercicios_prefeitos_com_parecer', 'exercicios_prefeitos_sem_parecer', 'registros_municipais_por_indicador']) meta.contagens[k] = anterior.contagens?.[k] ?? null;
    meta.municipios_com_grafia_conferida = anterior.municipios_com_grafia_conferida ?? [];
  }
  gravarSeMudou(path.join(SAIDA, 'meta.json'), meta);

  console.log(JSON.stringify({
    governador: resumoGov, prefeitos: resumoMun, interrompido, erros,
    gravados: contagemGravacao.gravados.length, inalterados: contagemGravacao.inalterados.length,
    http: { requisicoes: estatisticas.requisicoes, retentativas: estatisticas.retentativas, bytes: estatisticas.bytes },
  }, null, 2));
  if (erros.length && !interrompido) process.exitCode = 1;
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
