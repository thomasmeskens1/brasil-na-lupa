#!/usr/bin/env node
/**
 * Coletor automático do Supremo Tribunal Federal (STF) — Brasil na Lupa (Fase 6).
 *
 * USO (Node 20+, sem dependências; de qualquer pasta):
 *   node scripts/coleta/stf/coletar.mjs                   # rotina diária (teses e julgamentos com data nos últimos 30 dias)
 *   node scripts/coleta/stf/coletar.mjs --desde 2026-01-01
 *   node scripts/coleta/stf/coletar.mjs --completo        # relê todas as teses e todos os julgamentos
 *
 * GERA (somente em dados/stf/):
 *   ministros.json                   composição oficial + código de cada ministro no Plenário Virtual (conferido pelo nome)
 *   repercussao-geral/<tema>.json    tema de repercussão geral: título, descrição, tese literal, relator, situação, datas, leading case
 *   repercussao-geral/indice.json    resumo de todos os temas
 *   julgamentos/<id>.json            julgamentos do recorte ICMS (scripts/coleta/stf/casos-icms.json), formato "julgamento"
 *   julgamentos/indice.json          resumo dos julgamentos
 *   sumulas-vinculantes.json         súmulas vinculantes
 *   meta.json                        contagens, fontes, robots.txt, lacunas e observações
 *
 * FONTES (todas conferidas contra o robots.txt antes do acesso; ver lib.mjs):
 *   portal.stf.jus.br/jurisprudenciaRepercussao/todostemas.asp, verTeseTema.asp (windows-1252), detalharProcesso.asp (só link)
 *   portal.stf.jus.br/textos/verTexto.asp (Composição Atual; Turmas)
 *   portal.stf.jus.br/pauta/services/processo-service.asp (ambiente e datas das sessões)
 *   sistemas.stf.jus.br/repgeral/votacao (Plenário Virtual: ?sessaoVirtual=<incidente>, ?tema=<n>)
 *   jurisprudencia.stf.jus.br/api/search/search (POST: acórdãos publicados e súmulas vinculantes)
 * NÃO ACESSA portal.stf.jus.br/processos/* (Disallow no robots.txt). O link público detalhe.asp?incidente= é só gravado.
 *
 * Gravação atômica; arquivo sem mudança de conteúdo não é reescrito. No máximo 2 requisições simultâneas,
 * até 5 tentativas com espera crescente. Código de saída: 0 = ok; 1 = erro fatal; 2 = concluído com falhas parciais.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reprocessarPasta } from './privacidade.mjs';
import { formatar, lerJson, gravarSeMudou, hojeISO, somarDias, estatisticas, contagemGravacao, robotsCarregados, carregarRobots, permitidoPorRobots } from './lib.mjs';
import * as F from './fontes.mjs';
import { lerListaTemas, lerTextoTese, montarTema, resumoTema } from './repercussao.mjs';
import { lerPaginaComposicao, lerPaginaTurmas, montarMinistros, indiceMinistros } from './ministros.mjs';
import { listasDoIncidente, registrarCodigos } from './votos.mjs';
import { montarJulgamento, resumoJulgamento, idJulgamento, decompor, LACUNA_ACORDAO } from './julgamento.mjs';
import { montarSumulas } from './sumulas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const DIR = path.join(RAIZ, 'dados', 'stf');
const DIR_RG = path.join(DIR, 'repercussao-geral');
const DIR_JUL = path.join(DIR, 'julgamentos');

function lerArgs(argv) {
  const a = { completo: false, desde: null, maxTeses: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--completo') a.completo = true;
    else if (argv[i] === '--desde') a.desde = argv[++i];
    else if (argv[i] === '--max-teses') a.maxTeses = Number(argv[++i]);
    else if (argv[i].startsWith('--desde=')) a.desde = argv[i].slice(8);
    else if (argv[i] === '--ajuda' || argv[i] === '-h') { console.log('Uso: coletar.mjs [--desde AAAA-MM-DD | --completo] [--max-teses N]'); process.exit(0); }
    else throw new Error(`argumento desconhecido: ${argv[i]}`);
  }
  if (a.desde && (!/^\d{4}-\d{2}-\d{2}$/.test(a.desde) || Number.isNaN(Date.parse(a.desde)))) throw new Error('--desde deve estar no formato AAAA-MM-DD');
  return a;
}

const falhas = [];
async function tentar(rotulo, fn, padrao = null) {
  try { return await fn(); } catch (e) { falhas.push(`${rotulo}: ${e.message}`); console.error(`  ! ${rotulo}: ${e.message}`); return padrao; }
}

async function main() {
  const args = lerArgs(process.argv.slice(2));
  const hoje = hojeISO();
  const desde = args.desde ?? somarDias(hoje, -30);
  const config = JSON.parse(fs.readFileSync(path.join(AQUI, 'casos-icms.json'), 'utf8'));
  console.log(`STF: ${args.completo ? 'coleta completa' : `incremental desde ${desde}`} (${hoje})`);

  // 0) robots.txt (registro; a trava é aplicada em cada requisição)
  for (const h of ['portal.stf.jus.br', 'sistemas.stf.jus.br', 'jurisprudencia.stf.jus.br']) await carregarRobots(h);
  if (permitidoPorRobots('https://portal.stf.jus.br/processos/detalhe.asp?incidente=1')) throw new Error('robots.txt do portal não bloqueia /processos: conferir antes de prosseguir (mudança na fonte)');

  // 1) Repercussão geral: lista de temas + teses
  console.log('1) Repercussão geral: lista de todos os temas');
  const temas = lerListaTemas(await F.lerTodosTemas());
  console.log(`   ${temas.length} temas na lista oficial`);
  const temasIcms = new Set(config.repercussao_geral.map((r) => r.tema));
  const anteriores = new Map();
  for (const t of temas) { const x = lerJson(path.join(DIR_RG, `${t.numero}.json`)); if (x) anteriores.set(t.numero, x); }
  const lidaEm = (n) => { const a = anteriores.get(n); return a?.tese_lida_em ?? (a?.tese ? a.fontes?.find((f) => /^Tese/.test(f.titulo))?.acessado_em ?? null : null); };
  // Prioridade: temas do recorte; tese com data nova ou alterada; tese ainda não lida. Limite por execução
  // (--max-teses; padrão 400 na rotina diária, sem limite em --completo) para não sobrecarregar o portal.
  const prioridade = (t) => (temasIcms.has(t.numero) ? 0 : anteriores.get(t.numero)?.data_tese !== t.data_tese || (t.data_tese && t.data_tese >= desde) ? 1 : 2);
  const candidatas = temas.filter((t) => t.tem_tese && (args.completo || temasIcms.has(t.numero) || !lidaEm(t.numero)
    || anteriores.get(t.numero)?.data_tese !== t.data_tese || (t.data_tese && t.data_tese >= desde)))
    .sort((a, b) => prioridade(a) - prioridade(b) || b.numero - a.numero);
  const limite = args.maxTeses ?? (args.completo ? Infinity : 400);
  const buscarTese = candidatas.slice(0, limite);
  console.log(`   teses a ler: ${buscarTese.length} (de ${candidatas.length} candidatas)`);
  const teses = new Map();
  let lidas = 0, falhasSeguidas = 0, interrompido = false;
  for (let i = 0; i < buscarTese.length && !interrompido; i += 2) {
    await Promise.all(buscarTese.slice(i, i + 2).map(async (t) => {
      const html = await tentar(`tese do tema ${t.numero}`, () => F.lerTese(t.numero));
      if (html !== null) { teses.set(t.numero, lerTextoTese(html)); falhasSeguidas = 0; } else if (++falhasSeguidas >= 4) interrompido = true;
      if (++lidas % 100 === 0) console.log(`   … ${lidas}/${buscarTese.length}`);
    }));
  }
  if (interrompido) falhas.push(`leitura de teses interrompida após ${lidas} de ${buscarTese.length} (falhas seguidas no portal); as restantes ficam para a próxima execução`);

  // 2) Casos do recorte ICMS
  console.log('2) Julgamentos do recorte ICMS');
  const porTema = new Map(temas.map((t) => [t.numero, t]));
  const casos = [];
  for (const r of config.repercussao_geral) {
    const t = porTema.get(r.tema);
    if (!t) { falhas.push(`tema ${r.tema} não está na lista oficial`); continue; }
    const identificacao = r.identificacao ?? t.leading_case.identificacao.replace(/\s+/g, ' ');
    casos.push({ identificacao, incidente: r.incidente ?? Number(t.leading_case.incidente), tema: r.tema, observacao: r.observacao });
  }
  for (const c of config.controle_concentrado) casos.push({ ...c });
  for (const c of casos) c.id = idJulgamento(c.identificacao);
  const idPorIdent = new Map(casos.map((c) => [c.identificacao, c.id]));
  for (const c of casos) {
    c.relacionados = (c.conjunto ?? []).map((x) => idPorIdent.get(x)).filter(Boolean);
    const irmaos = casos.filter((o) => o !== c && o.tema && o.tema === c.tema).map((o) => o.id);
    c.relacionados.push(...irmaos);
  }

  const acordaos = await tentar('API de jurisprudência (acórdãos)', () => F.lerAcordaosPorIncidente(casos.map((c) => c.incidente)));
  // Sem a API não se sabe se o acórdão foi publicado: os julgamentos já gravados são mantidos como estão.
  const apiFalhou = acordaos === null;
  // Julgamento estável (acórdão publicado, julgado antes de --desde, acórdão sem atualização na fonte): reaproveita o arquivo.
  const reaproveitar = new Map();
  for (const c of casos) {
    const ant = lerJson(path.join(DIR_JUL, `${c.id}.json`));
    const atual = (acordaos.get(Number(c.incidente)) ?? []).filter((a) => (a.julgamento_data ?? '') >= config.inicio).sort((a, b) => b.julgamento_data.localeCompare(a.julgamento_data))[0];
    if (apiFalhou && ant) { reaproveitar.set(c.id, ant); continue; }
    if (apiFalhou) continue;
    if (!args.completo && ant?.certidao_literal && ant.data_julgamento < desde && atual && ant.acordao_atualizado_na_fonte_em === atual.dg_atualizado_em
      && ant.data_julgamento === atual.julgamento_data && ant.situacao_conferencia !== 'pendente') reaproveitar.set(c.id, ant);
  }
  const ativos = apiFalhou ? [] : casos.filter((c) => !reaproveitar.has(c.id));
  console.log(`   ${casos.length} casos; ${reaproveitar.size} estáveis reaproveitados; ${ativos.length} consultados no Plenário Virtual e na pauta`);
  const temaPv = new Map(), pautas = new Map(), svs = new Map(), svFalhou = new Set();
  await Promise.all([...new Set(ativos.filter((c) => c.tema).map((c) => c.tema))].map(async (n) => temaPv.set(n, await tentar(`Plenário Virtual do tema ${n}`, () => F.lerVotacaoTema(n)))));
  await Promise.all(ativos.map(async (c) => {
    const r = await tentar(`Plenário Virtual ${c.identificacao}`, () => F.lerSessaoVirtual(c.incidente));
    if (r === null) svFalhou.add(c.id);
    svs.set(c.id, listasDoIncidente(r ?? [], c.incidente));
    const { classe, numero, sufixo } = decompor(c.identificacao);
    const k = `${classe} ${numero}`;
    if (!sufixo && !pautas.has(k)) { pautas.set(k, null); pautas.set(k, await tentar(`pauta ${k}`, () => F.lerPautaProcesso(classe, numero))); }
  }));

  // 3) Ministros (composição + códigos do Plenário Virtual)
  console.log('3) Composição do STF');
  const codigos = new Map();
  for (const c of lerJson(path.join(DIR, 'ministros.json'))?.codigos_plenario_virtual ?? []) codigos.set(c.codigo, { descricao: c.nome_no_plenario_virtual, visto_em: new Set(c.visto_em) });
  const conflitos = [];
  for (const c of ativos) conflitos.push(...registrarCodigos(codigos, svs.get(c.id).listas, c.identificacao));
  const htmlComp = await F.lerComposicao();
  const htmlTurmas = await F.lerTurmas();
  const ministros = montarMinistros({ composicao: lerPaginaComposicao(htmlComp), turmas: lerPaginaTurmas(htmlTurmas), codigosVistos: codigos, hoje });
  if (conflitos.length) ministros.lacunas.push(...conflitos.map((x) => `Código com nomes diferentes no Plenário Virtual: ${x}`));
  gravarSeMudou(path.join(DIR, 'ministros.json'), ministros);
  console.log(`   ${ministros.itens.length} ministros na página; ${ministros.itens.filter((m) => m.id).length} com código conferido`);
  const indice = indiceMinistros(ministros);

  // 4) Julgamentos
  const julgamentos = [];
  for (const c of casos) {
    const ant = reaproveitar.get(c.id) ?? (svFalhou.has(c.id) ? lerJson(path.join(DIR_JUL, `${c.id}.json`)) : null);
    if (ant) { julgamentos.push(ant); continue; }
    if (apiFalhou) continue;
    const t = c.tema ? porTema.get(c.tema) : null;
    const temaObj = t ? { titulo: t.titulo, relator: t.relator, situacao: t.situacao, data_tese: t.data_tese, tese: teses.get(t.numero) ?? anteriores.get(t.numero)?.tese ?? null } : null;
    const { classe, numero, sufixo } = decompor(c.identificacao);
    const j = montarJulgamento(c, {
      acordaos: acordaos.get(Number(c.incidente)) ?? [],
      sv: svs.get(c.id),
      temaPv: c.tema && !sufixo ? temaPv.get(c.tema) : null,
      pauta: sufixo ? null : pautas.get(`${classe} ${numero}`),
      tema: temaObj,
    }, { indice, hoje, inicio: config.inicio, colecao: config.colecao });
    gravarSeMudou(path.join(DIR_JUL, `${j.id}.json`), j);
    julgamentos.push(j);
  }
  const resumos = julgamentos.map(resumoJulgamento);
  if (!apiFalhou) gravarSeMudou(path.join(DIR_JUL, 'indice.json'), { atualizado_em: hoje, tribunal: 'stf', colecoes: [config.colecao], total: resumos.length, itens: resumos });
  console.log(`   ${julgamentos.length} julgamentos; ${julgamentos.filter((j) => j.certidao_literal).length} com acórdão publicado`);

  // 5) Arquivos dos temas (todos)
  const julgPorTema = new Map();
  for (const j of julgamentos) if (j.precedente.numero && !j.processo.sufixo) julgPorTema.set(Number(j.precedente.numero), j.id);
  const resumosTemas = [];
  for (const t of temas) {
    const tese = teses.has(t.numero) ? teses.get(t.numero) : anteriores.get(t.numero)?.tese ?? null;
    const teseAcessadaEm = teses.has(t.numero) ? hoje : lidaEm(t.numero);
    const obj = montarTema(t, { tese, teseAcessadaEm, hoje, colecoes: temasIcms.has(t.numero) ? [config.colecao] : [], julgamentoRef: julgPorTema.get(t.numero) ?? null });
    gravarSeMudou(path.join(DIR_RG, `${t.numero}.json`), obj);
    resumosTemas.push(resumoTema(obj));
  }
  gravarSeMudou(path.join(DIR_RG, 'indice.json'), {
    atualizado_em: hoje, tribunal: 'stf', fonte: F.fonte('Repercussão Geral – lista de todos os temas', F.URL_TODOS_TEMAS, hoje),
    total: resumosTemas.length, temas: resumosTemas,
  });

  // 6) Súmulas vinculantes
  console.log('4) Súmulas vinculantes');
  const sv = await tentar('API de jurisprudência (súmulas)', () => F.lerSumulasVinculantes());
  const sumulas = sv ? montarSumulas(sv, hoje) : lerJson(path.join(DIR, 'sumulas-vinculantes.json'));
  if (sv) gravarSeMudou(path.join(DIR, 'sumulas-vinculantes.json'), sumulas);

  // 7) Privacidade (diretriz 12): reaplica o mascaramento a tudo que já está gravado em dados/stf.
  const privacidade = reprocessarPasta(DIR, formatar);

  // 7b) Meta
  const aguardando = julgamentos.filter((j) => j.lacunas.includes(LACUNA_ACORDAO)).map((j) => j.processo.identificacao);
  const meta = {
    atualizado_em: new Date().toISOString(),
    ultima_execucao: { modo: args.completo ? 'completo' : 'incremental', desde: args.completo ? null : desde, data: hoje },
    periodo: `recorte ICMS: julgamentos a partir de ${config.inicio}; repercussão geral: todos os temas da lista oficial`,
    contagens: {
      temas_repercussao_geral: temas.length,
      temas_com_tese: resumosTemas.filter((t) => t.tem_tese).length,
      teses_lidas_nesta_execucao: teses.size,
      julgamentos: julgamentos.length,
      julgamentos_com_acordao_publicado: julgamentos.filter((j) => j.certidao_literal).length,
      julgamentos_aguardando_acordao: aguardando,
      julgamentos_com_votos_do_plenario_virtual: julgamentos.filter((j) => j.votacoes.some((v) => v.origem === 'plenario-virtual' && v.votos.length)).map((j) => j.id),
      julgamentos_presenciais: julgamentos.filter((j) => j.sessao.ambiente === 'presencial').map((j) => j.id),
      julgamentos_pendentes_de_conferencia: julgamentos.filter((j) => j.situacao_conferencia === 'pendente').map((j) => j.id),
      conferencia_votos_x_certidao: Object.fromEntries(['coincide', 'diverge', 'nao-aplicavel'].map((k) => [k, julgamentos.filter((j) => j.conferencia_votos_x_certidao.resultado === k).map((j) => j.id)])),
      ministros_na_composicao: ministros.itens.length,
      sumulas_vinculantes: sumulas?.total ?? null,
    },
    colecoes: { [config.colecao]: julgamentos.map((j) => j.id) },
    privacidade,
    fontes: [
      F.fonte('Repercussão Geral – lista de todos os temas', F.URL_TODOS_TEMAS, hoje),
      F.fonte('Repercussão Geral – tese do tema (verTeseTema.asp)', F.urlTese('{n}'), hoje),
      F.fonte('Composição Atual', F.URL_COMPOSICAO, hoje),
      F.fonte('Turmas', F.URL_TURMAS, hoje),
      F.fonte('Plenário Virtual – votação (JSON usado pelo portal)', F.urlVotacaoSessaoVirtual('{incidente}'), hoje),
      F.fonte('Pauta do Plenário (JSON usado pelo portal)', F.urlPautaProcesso('{classe}', '{numero}'), hoje),
      F.fonte('Pesquisa de jurisprudência – API (acórdãos e súmulas)', F.URL_API_JURIS, hoje),
    ],
    robots_txt: robotsCarregados(),
    regras: [
      'Nada em portal.stf.jus.br/processos/* é acessado (Disallow no robots.txt); o link detalhe.asp?incidente= é apenas exibido ao leitor.',
      'certidao_literal = último parágrafo de decisão do campo "acordao_ata" do acórdão publicado; sem acórdão publicado, fica null com a lacuna "Aguardando publicação do acórdão".',
      'resultado (unanimidade/maioria) e vencidos só quando as palavras estão no texto oficial; a parte (mérito, tese, modulação, embargos, preliminar) só quando o próprio trecho a nomeia.',
      'Votos individuais só do Plenário Virtual (última lista do incidente; campo "julgado" ignorado; votos com data fora da sessão descartados); julgamento presencial: votos vazios + lacuna.',
      'Código do ministro no Plenário Virtual conferido com ministros.json pelo nome; conflito → situacao_conferencia "pendente".',
      'Quando os votos de divergência do Plenário Virtual não coincidem com os vencidos do texto oficial, prevalece o texto oficial e os votos não são exibidos.',
    ],
    observacoes: [
      'sistemas.stf.jus.br/robots.txt responde HTTP 403 e jurisprudencia.stf.jus.br/robots.txt devolve a página do aplicativo (não há robots.txt): tratados como sem restrição.',
      'O firewall da API de jurisprudência recusa alguns User-Agents (ex.: com "Node.js"); o coletor usa um User-Agent identificado com o link do repositório.',
      'Na pauta, o código de situação "J" é "Processo julgado" (legenda da página da pauta), mas ele não aparece em todas as sessões finais (ex.: RE 1426271 vem com "N"); por isso a pauta só é usada para o ambiente (virtual/presencial) e as datas.',
      'O relator não aparece entre os votos da lista do Plenário Virtual; o voto do relator fica como link (voto_relator_url), sem tipo de voto atribuído.',
      'Votação do Plenário Virtual de repercussão geral (?tema=): a data de fim é a "Data prevista de fim" da página oficial.',
    ],
    falhas: [...falhas, ...estatisticas.falhas.filter((f) => !falhas.some((x) => x.includes(f)))],
    estatisticas: { requisicoes: estatisticas.requisicoes, retentativas: estatisticas.retentativas, bytes: estatisticas.bytes, por_host: estatisticas.por_host, arquivos_gravados: contagemGravacao.gravados + 1, arquivos_inalterados: contagemGravacao.inalterados },
  };
  gravarSeMudou(path.join(DIR, 'meta.json'), meta);
  console.log(`Concluído: ${estatisticas.requisicoes} requisições, ${contagemGravacao.gravados} arquivos gravados, ${contagemGravacao.inalterados} inalterados, ${falhas.length} falhas.`);
  return falhas.length ? 2 : 0;
}

main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
