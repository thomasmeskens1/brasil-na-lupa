#!/usr/bin/env node
/**
 * Coletor automático do Superior Tribunal de Justiça (STJ) — voto-em-quem (Fase 6).
 *
 * USO (Node 20+, sem dependências; de qualquer pasta):
 *   node scripts/coleta/stj/coletar.mjs                  # rotina diária: temas com alguma data nos últimos 120 dias
 *   node scripts/coleta/stj/coletar.mjs --desde 2026-01-01
 *   node scripts/coleta/stj/coletar.mjs --completo       # todos os temas (espelhos desde 05/2022)
 *   --sem-pagina   não consulta a página pública dos temas (conferência de UF, relator, situação e tipo)
 *
 * O QUE GERA (somente em dados/stj/):
 *   ministros.json         ministros em atividade (página oficial): matrícula, nome, cargo de direção. O órgão
 *                          julgador de cada ministro fica null (só existe em PDF, não em fonte estruturada).
 *   temas/<numero>.json    temas repetitivos e de relevância (Temas.csv + Processos.csv, sem duplicatas), com
 *                          colecoes (scripts/coleta/stj/colecoes.json), julgamento (texto literal do espelho do
 *                          acórdão ou da íntegra), resultado só por "por unanimidade"/"por maioria" literais e
 *                          pré-extração dos votos com situacao_conferencia "pendente" (o site não a exibe).
 *   temas/indice.json      resumo de todos os temas.
 *   meta.json              contagens, fontes, divergências da fonte, candidatos de curadoria.
 *
 * O QUE NÃO USA: scon.stj.jus.br e processo.stj.jus.br/processo/pesquisa (barreira anti-robô, HTTP 403).
 * Pautas futuras: só processo, datas, órgão, tipo de petição e relator; partes, CNPJ e advogados são descartados.
 *
 * INCREMENTAL: Temas.csv/Processos.csv são relidos sempre (arquivo único substituído pelo STJ); o julgamento
 * só é (re)pesquisado para temas com alguma data >= --desde, temas das coleções e temas que aguardam fonte.
 * Os demais mantêm o julgamento já gravado. Arquivos do portal ficam em cache local (scripts/coleta/stj/.cache),
 * chaveados pela data de modificação informada pelo próprio portal.
 *
 * GRAVAÇÃO: atômica; arquivo sem mudança de conteúdo (ignorando atualizado_em/acessado_em/verificado_em) não é
 * reescrito. LIMITES: no máximo 2 requisições simultâneas, até 6 tentativas com espera crescente.
 * Código de saída: 0 = ok; 1 = erro fatal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { obterRecurso, lerCsv, lerJson, gravarSeMudou, hojeISO, somarDias, dataISO, estatisticas, contagemGravacao } from './lib.mjs';
import { pacote, urlPacote, ESPELHOS_POR_ORGAO, PACOTE_TEMAS, PACOTE_INTEGRAS, PACOTE_PAUTAS, PAGINA_MINISTROS,
  indexarEspelhos, diasDeIntegras, buscarIntegras, lerPautas, lerMinistros } from './fontes.mjs';
import { agruparTemas, agruparProcessos, montarTema, datasDoTema, chave } from './temas.mjs';
import { sessaoDeEspelho, sessaoDeIntegra, montarJulgamento } from './julgamento.mjs';
import { lerPaginaTema, urlTema } from './pagina-tema.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const DIR = path.join(RAIZ, 'dados', 'stj');
const DIR_TEMAS = path.join(DIR, 'temas');
const CACHE = path.join(AQUI, '.cache');
const ORGAO = 'Superior Tribunal de Justiça';
const INICIO_PROJETO = '2025-01-01';
// Sigla do Temas.csv → nome exibido na página oficial dos temas (conferido em 02/11/2026 nos temas
// 1369 e 1477 = S1, 1391 = S2, 1405 = S3, 1424 = CE). Usado só para o nome legível; a sigla original é mantida.
const ORGAOS = { S1: 'Primeira Seção', S2: 'Segunda Seção', S3: 'Terceira Seção', CE: 'Corte Especial' };

function lerArgs(argv) {
  const a = { completo: false, desde: null, semPagina: false, ministrosHtml: null, ministrosData: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--completo') a.completo = true;
    else if (argv[i] === '--ministros-html') a.ministrosHtml = argv[++i];
    else if (argv[i] === '--ministros-data') a.ministrosData = argv[++i];
    else if (argv[i] === '--sem-pagina') a.semPagina = true;
    else if (argv[i] === '--desde') a.desde = argv[++i];
    else if (argv[i].startsWith('--desde=')) a.desde = argv[i].slice(8);
    else if (argv[i] === '--ajuda' || argv[i] === '-h') { console.log('Uso: coletar.mjs [--desde AAAA-MM-DD | --completo] [--sem-pagina] [--ministros-html <cópia salva da página> --ministros-data AAAA-MM-DD]'); process.exit(0); }
    else throw new Error(`argumento desconhecido: ${argv[i]}`);
  }
  if (a.ministrosHtml && !/^\d{4}-\d{2}-\d{2}$/.test(a.ministrosData ?? '')) throw new Error('--ministros-html exige --ministros-data AAAA-MM-DD (data em que a página foi salva)');
  if (a.desde && (!/^\d{4}-\d{2}-\d{2}$/.test(a.desde) || Number.isNaN(Date.parse(a.desde)))) throw new Error('--desde deve estar no formato AAAA-MM-DD');
  return a;
}

const mesDe = (iso) => iso.slice(0, 7).replace('-', '');
function mesSeguinte(aaaamm) {
  let a = Number(aaaamm.slice(0, 4)), m = Number(aaaamm.slice(4)) + 1;
  if (m > 12) { m = 1; a++; }
  return `${a}${String(m).padStart(2, '0')}`;
}
const fonte = (titulo, url, hoje) => ({ titulo, url, orgao: ORGAO, acessado_em: hoje });

/** Conferência com a página oficial: grava o que a página mostra e anota divergências com o CSV. */
function aplicarPagina(tema, pag) {
  if (!pag?.disponivel) return;
  tema.pagina_oficial = pag;
  tema.url_oficial = pag.url;
  if (!tema.tipo_precedente && pag.rotulo_tipo) {
    tema.tipo_precedente = pag.rotulo_tipo;
    tema.lacunas = tema.lacunas.filter((l) => l !== 'Tipo de precedente vazio no Temas.csv');
    tema.lacunas.push(`Tipo de precedente vazio no Temas.csv; a página oficial classifica como "${pag.rotulo_tipo}"`);
  }
  if (pag.situacao && chave(pag.situacao) !== chave(tema.situacao)) tema.lacunas.push(`Situação diverge: Temas.csv "${tema.situacao ?? 'vazio'}" × página oficial "${pag.situacao}"`);
  if (pag.orgao && tema.orgao && chave(pag.orgao) !== chave(tema.orgao)) tema.lacunas.push(`Órgão julgador diverge: Temas.csv ${tema.orgao_sigla} × página oficial "${pag.orgao}"`);
  // Só letras e números: a página (ISO-8859-1) troca aspas curvas por "?" e muda espaços.
  const so = (s) => chave(s).replace(/[^\p{L}\p{N}]/gu, '');
  if (pag.tese && tema.tese && so(pag.tese) !== so(tema.tese)) tema.lacunas.push('Texto da tese difere entre o Temas.csv e a página oficial; guardado o do Temas.csv');
  for (const pp of pag.processos) {
    const p = tema.processos.find((x) => chave(x.processo) === chave(pp.processo));
    if (!p) { tema.lacunas.push(`${pp.processo}/${pp.uf} aparece na página oficial, mas não no Processos.csv`); continue; }
    if (pp.uf && p.uf_origem && pp.uf !== p.uf_origem) tema.lacunas.push(`UF do ${p.processo} diverge: Processos.csv ${p.uf_origem} × página oficial ${pp.uf}`);
    if (pp.relator && p.relator && chave(pp.relator) !== chave(p.relator)) tema.lacunas.push(`Relator do ${p.processo} diverge: Processos.csv "${p.relator}" × página oficial "${pp.relator}"`);
    if (p.paradigma && pp.transito_em_julgado) tema.datas.transito_em_julgado = pp.transito_em_julgado;
  }
  for (const p of tema.processos) {
    if (!pag.processos.some((pp) => chave(pp.processo) === chave(p.processo))) tema.lacunas.push(`${p.processo} está no Processos.csv, mas não na página oficial`);
  }
  if (!tema.datas.transito_em_julgado) tema.lacunas.push('Data do trânsito em julgado não disponível em fonte oficial');
}

async function main() {
  const args = lerArgs(process.argv.slice(2));
  const hoje = hojeISO();
  const desde = args.completo ? '2000-01-01' : (args.desde ?? somarDias(hoje, -120));
  console.error(`[stj] modo ${args.completo ? 'completo' : 'incremental'} — julgamentos de temas com data >= ${desde}`);
  const colecoesCfg = JSON.parse(fs.readFileSync(path.join(AQUI, 'colecoes.json'), 'utf8'));
  const colecaoDe = new Map();
  for (const [nome, c] of Object.entries(colecoesCfg.colecoes)) for (const n of c.temas) colecaoDe.set(String(n), [...(colecaoDe.get(String(n)) ?? []), nome]);

  // 1. Pacotes do portal (lista de arquivos e datas de modificação).
  const [pkgTemas, pkgIntegras, pkgPautas, ...pkgEsp] = await Promise.all([
    pacote(PACOTE_TEMAS), pacote(PACOTE_INTEGRAS), pacote(PACOTE_PAUTAS),
    ...Object.values(ESPELHOS_POR_ORGAO).map((id) => pacote(id)),
  ]);
  const espPorSigla = Object.fromEntries(Object.keys(ESPELHOS_POR_ORGAO).map((s, i) => [s, pkgEsp[i]]));
  const recTemas = pkgTemas.resources.find((r) => /^temas\.csv$/i.test(r.name));
  const recProc = pkgTemas.resources.find((r) => /^processos\.csv$/i.test(r.name));
  if (!recTemas || !recProc) throw new Error('Temas.csv ou Processos.csv não encontrado no conjunto precedentes-qualificados');

  // 2. Temas e processos (sem duplicatas).
  const [csvT, csvP] = await Promise.all([obterRecurso(recTemas, CACHE, { tipo: 'text' }), obterRecurso(recProc, CACHE, { tipo: 'text' })]);
  const linhasT = lerCsv(csvT), linhasP = lerCsv(csvP);
  const { grupos, linhasDuplicadas } = agruparTemas(linhasT);
  const { porSeq, identicas } = agruparProcessos(linhasP);
  const temas = [];
  for (const [seq, linhas] of grupos) {
    const t = montarTema(linhas, porSeq.get(seq), { urlTemasCsv: recTemas.url, urlProcessosCsv: recProc.url, hoje });
    t.orgao = ORGAOS[t.orgao_sigla] ?? null;
    if (!t.orgao) t.lacunas.push(`Órgão julgador não informado no Temas.csv (sigla: ${t.orgao_sigla ?? 'vazia'})`);
    t.colecoes = colecaoDe.get(t.numero) ?? [];
    t.url_oficial = urlTema(t.numero, t.tipo_precedente_fonte === 'Tema' ? 'T' : 'E');
    temas.push(t);
  }
  const numeros = new Map();
  for (const t of temas) numeros.set(t.numero, (numeros.get(t.numero) ?? 0) + 1);
  const colisoes = [...numeros].filter(([, n]) => n > 1).map(([k]) => k);
  if (colisoes.length) throw new Error(`Números de tema repetidos com sequenciais diferentes: ${colisoes.join(', ')}`);
  console.error(`[stj] ${temas.length} temas (${linhasDuplicadas} linhas repetidas no Temas.csv, ${identicas} linhas idênticas no Processos.csv)`);

  // 3. Quais temas têm o julgamento (re)pesquisado.
  const anteriores = new Map(temas.map((t) => [t.numero, lerJson(path.join(DIR_TEMAS, `${t.numero}.json`))]));
  const alvo = temas.filter((t) => t.colecoes.length || datasDoTema(t).some((d) => d >= desde) || anteriores.get(t.numero)?.julgamento?.aguardando_fonte);

  // 4. Espelhos: só os meses das publicações (afetação, acórdão, embargos) e o mês seguinte.
  const mesesPorSigla = new Map();
  const mesesDoTema = new Map();
  for (const t of alvo) {
    const ms = new Set();
    for (const p of t.processos) for (const d of [p.data_publicacao_afetacao ?? p.data_afetacao, p.data_publicacao_acordao, p.data_publicacao_embargos]) if (d) { ms.add(mesDe(d)); ms.add(mesSeguinte(mesDe(d))); }
    if (t.datas.publicacao) { ms.add(mesDe(t.datas.publicacao)); ms.add(mesSeguinte(mesDe(t.datas.publicacao))); }
    mesesDoTema.set(t.numero, [...ms].sort());
    if (!espPorSigla[t.orgao_sigla]) continue;
    if (!mesesPorSigla.has(t.orgao_sigla)) mesesPorSigla.set(t.orgao_sigla, new Set());
    for (const m of ms) mesesPorSigla.get(t.orgao_sigla).add(m);
  }
  const indice = new Map();
  const mesesLidos = {};
  for (const [sigla, meses] of mesesPorSigla) mesesLidos[sigla] = await indexarEspelhos(espPorSigla[sigla], meses, CACHE, indice);
  console.error(`[stj] espelhos lidos: ${Object.entries(mesesLidos).map(([s, m]) => `${s} ${m.length}`).join(', ') || 'nenhum'}`);

  // 5. Julgamento de cada tema-alvo; íntegras quando falta o mérito nos espelhos.
  const dias = diasDeIntegras(pkgIntegras);
  const ultimoDiaIntegras = dataISO([...dias.keys()].sort().at(-1) ?? null);
  const integrasLidas = new Set();
  for (const t of alvo) {
    const regs = new Set(t.processos.map((p) => p.numero_registro).filter(Boolean));
    const sessoes = [];
    for (const r of regs) for (const item of indice.get(r) ?? []) sessoes.push(sessaoDeEspelho(item, t, hoje));
    const pesquisados = (mesesDoTema.get(t.numero) ?? []).filter((m) => (mesesLidos[t.orgao_sigla] ?? []).includes(m));
    let pendenciaIntegra = null;
    const diasIntegra = [];
    if (!sessoes.some((s) => s.etapa === 'merito')) {
      const datasPub = [...new Set([t.datas.publicacao, ...t.processos.map((p) => p.data_publicacao_acordao)].filter((d) => d && d >= INICIO_PROJETO))];
      for (const d of datasPub.sort()) {
        const dia = d.replaceAll('-', '');
        const rec = dias.get(dia);
        if (!rec) {
          pendenciaIntegra = `Texto oficial do julgamento ainda não disponível: espelho do mês da publicação (${d}) ainda não publicado ou sem o acórdão, e íntegras do dia ${d} ainda não publicadas no Portal de Dados Abertos (último dia disponível: ${ultimoDiaIntegras ?? '—'})`;
          continue;
        }
        diasIntegra.push(d); integrasLidas.add(d);
        for (const a of await buscarIntegras(dia, rec, regs, CACHE)) {
          if (!sessoes.some((s) => s.numero_registro === String(a.meta.numeroRegistro) && s.data_publicacao === d && s.processo === a.meta.processo)) sessoes.push(sessaoDeIntegra(a, t, hoje));
        }
      }
    }
    t.julgamento = montarJulgamento(t, sessoes, { mesesPesquisados: pesquisados, integrasPesquisadas: diasIntegra, pendenciaIntegra });
    if (!sessoes.length && !t.julgamento.lacunas.length && !pesquisados.length) t.julgamento = null;
  }
  for (const t of temas) {
    if (alvo.includes(t)) continue;
    const ant = anteriores.get(t.numero);
    if (ant?.julgamento) t.julgamento = ant.julgamento;
  }
  for (const t of temas) {
    if (t.julgamento?.sessoes?.length) {
      const fs_ = new Map();
      for (const s of t.julgamento.sessoes) if (s.fonte?.url) fs_.set(s.fonte.url, fonte(s.fonte.titulo.replace(/, (acórdão id|documento) .*$/, ''), s.fonte.url, hoje));
      t.fontes.push(...fs_.values());
    }
  }

  // 6. Página oficial: temas das coleções e linhas sem tipo (poucas páginas por dia).
  const conferidos = [];
  for (const t of temas) {
    const precisa = !args.semPagina && (t.colecoes.length || !t.tipo_precedente_fonte);
    let pag = null;
    if (precisa) {
      try {
        pag = await lerPaginaTema(t.numero, t.tipo_precedente_fonte === 'Tema' ? 'T' : 'E');
        if (!pag.disponivel && !t.tipo_precedente_fonte) pag = await lerPaginaTema(t.numero, 'T');
        if (pag.disponivel) { pag.verificado_em = hoje; conferidos.push(t.numero); } else t.lacunas.push(`Página oficial do tema não pôde ser conferida (${pag.motivo})`);
      } catch (e) { t.lacunas.push(`Página oficial do tema não pôde ser conferida (${e.message})`); pag = null; }
    }
    if (!pag?.disponivel) pag = anteriores.get(t.numero)?.pagina_oficial ?? null;
    aplicarPagina(t, pag);
    if (t.pagina_oficial) t.fontes.push({ titulo: 'STJ — Precedentes Qualificados: página do tema', url: t.pagina_oficial.url, orgao: ORGAO, acessado_em: t.pagina_oficial.verificado_em ?? hoje });
    else t.fontes.push(fonte('STJ — Precedentes Qualificados: página do tema (link público)', t.url_oficial, hoje));
  }

  // 7. Pautas futuras (sem partes, CNPJ nem advogados).
  const pautas = await lerPautas(pkgPautas, CACHE);
  let temasEmPauta = 0;
  for (const t of temas) {
    const ps = [];
    for (const p of t.processos) for (const x of pautas.porRegistro.get(p.numero_registro) ?? []) ps.push(x);
    t.pautas = ps.sort((a, b) => String(a.data_sessao).localeCompare(String(b.data_sessao)));
    if (ps.length) { temasEmPauta++; t.fontes.push(fonte(`STJ — Dados Abertos: pautas futuras (${pautas.arquivo.name})`, pautas.arquivo.url, hoje)); }
  }

  // 8. Gravação dos temas e do índice.
  for (const t of temas) gravarSeMudou(path.join(DIR_TEMAS, `${t.numero}.json`), { atualizado_em: hoje, ...t });
  const ordenados = [...temas].sort((a, b) => Number(a.numero) - Number(b.numero));
  const resumoMerito = (t) => {
    const ms = (t.julgamento?.sessoes ?? []).filter((s) => s.etapa === 'merito');
    const par = ms.find((s) => s.processo_paradigma) ?? ms[0];
    return par ? { processo: par.processo, data: par.data, resultado: par.resultado } : null;
  };
  gravarSeMudou(path.join(DIR_TEMAS, 'indice.json'), {
    atualizado_em: hoje,
    fonte: fonte('STJ — Dados Abertos: precedentes qualificados', urlPacote(PACOTE_TEMAS), hoje),
    total: ordenados.length,
    itens: ordenados.map((t) => ({
      numero: t.numero, id: t.id, tipo_precedente: t.tipo_precedente, situacao: t.situacao, orgao: t.orgao,
      relator: t.relator, datas: t.datas, colecoes: t.colecoes, tem_tese: Boolean(t.tese),
      sessoes: t.julgamento?.sessoes?.length ?? 0, merito: resumoMerito(t), aguardando_fonte: Boolean(t.julgamento?.aguardando_fonte),
      em_pauta: t.pautas.length > 0, url_oficial: t.url_oficial,
    })),
  });

  // 9. Ministros.
  let ministrosInfo;
  try {
    const local = args.ministrosHtml ? fs.readFileSync(args.ministrosHtml).toString('latin1') : null;
    const m = await lerMinistros(local);
    const dataFonte = local ? args.ministrosData : hoje;
    gravarSeMudou(path.join(DIR, 'ministros.json'), {
      atualizado_em: hoje,
      fonte: fonte(local ? 'STJ — Ministros em atividade (cópia da página oficial salva na data indicada)' : 'STJ — Ministros em atividade', PAGINA_MINISTROS, dataFonte),
      versao_pagina: m.versao,
      itens: m.itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      notas: [
        'cargo: texto que a página oficial mostra após o nome (cargo de direção); null quando não há.',
        'nome_destaque: partes do nome em negrito na página oficial, na ordem em que aparecem.',
      ],
      lacunas: [
        'Órgão julgador (Turma, Seção, Corte Especial) de cada ministro: não disponível em fonte oficial estruturada (a composição só é publicada em PDF); campo orgao_julgador fica null até curadoria.',
      ],
    });
    ministrosInfo = { total: m.itens.length, versao: m.versao, origem: local ? `cópia local salva em ${dataFonte}` : 'página oficial' };
  } catch (e) {
    const ant = lerJson(path.join(DIR, 'ministros.json'));
    ministrosInfo = { erro: e.message, arquivo_mantido: Boolean(ant), dados_de: ant?.fonte?.acessado_em ?? null };
    console.error(`[stj] ministros: ${e.message} (arquivo anterior mantido)`);
  }

  // 10. Meta.
  const lacunasFonte = temas.flatMap((t) => t.lacunas.filter((l) => /diverge|linhas com|Tipo de precedente vazio|não no Processos|não na página|difere entre/.test(l)).map((l) => `Tema ${t.numero}: ${l}`));
  const cand = temas.filter((t) => !t.colecoes.length && (t.criterios_icms.assunto_cnj_icms || t.criterios_icms.questao_ou_tese_menciona_icms) && datasDoTema(t).some((d) => d >= INICIO_PROJETO));
  const votosPendentes = temas.reduce((n, t) => n + (t.julgamento?.sessoes ?? []).filter((s) => s.votos_pre_extracao?.situacao_conferencia === 'pendente').length, 0);
  gravarSeMudou(path.join(DIR, 'meta.json'), {
    atualizado_em: new Date().toISOString(),
    ultima_execucao: { modo: args.completo ? 'completo' : 'incremental', desde, data: hoje, pagina_oficial: !args.semPagina },
    contagens: {
      temas: temas.length,
      por_tipo: Object.fromEntries([...new Set(temas.map((t) => t.tipo_precedente ?? 'não informado'))].map((k) => [k, temas.filter((t) => (t.tipo_precedente ?? 'não informado') === k).length])),
      com_tese: temas.filter((t) => t.tese).length,
      julgamento_pesquisado_nesta_execucao: alvo.length,
      temas_com_sessoes: temas.filter((t) => t.julgamento?.sessoes?.length).length,
      sessoes: temas.reduce((n, t) => n + (t.julgamento?.sessoes?.length ?? 0), 0),
      sessoes_com_votos_pendentes_de_conferencia: votosPendentes,
      aguardando_fonte: temas.filter((t) => t.julgamento?.aguardando_fonte).map((t) => t.numero),
      temas_em_pauta: temasEmPauta,
      colecoes: Object.fromEntries(Object.keys(colecoesCfg.colecoes).map((k) => [k, temas.filter((t) => t.colecoes.includes(k)).map((t) => t.numero)])),
      paginas_oficiais_conferidas: conferidos,
      espelhos_meses_lidos: mesesLidos,
      integras_dias_lidos: [...integrasLidas].sort(),
      ministros: ministrosInfo,
      duplicatas_removidas: { linhas_temas_csv: linhasDuplicadas, linhas_processos_csv_identicas: identicas },
      requisicoes: estatisticas.requisicoes, arquivos_do_cache: estatisticas.cache,
      arquivos_gravados: contagemGravacao.gravados + 1, arquivos_inalterados: contagemGravacao.inalterados,
    },
    fontes: [
      fonte('STJ — Dados Abertos: precedentes qualificados (Temas.csv e Processos.csv)', urlPacote(PACOTE_TEMAS), hoje),
      ...Object.values(ESPELHOS_POR_ORGAO).map((id) => fonte(`STJ — Dados Abertos: ${id}`, urlPacote(id), hoje)),
      fonte('STJ — Dados Abertos: íntegras de decisões terminativas e acórdãos do Diário da Justiça', urlPacote(PACOTE_INTEGRAS), hoje),
      fonte('STJ — Dados Abertos: pautas futuras (sem licença declarada no portal; só campos processuais)', urlPacote(PACOTE_PAUTAS), hoje),
      fonte('STJ — Ministros em atividade', PAGINA_MINISTROS, hoje),
      fonte('STJ — Precedentes Qualificados (página pública de cada tema)', 'https://processo.stj.jus.br/repetitivos/temas_repetitivos/', hoje),
    ],
    arquivos_fonte: { temas_csv_modificado: recTemas.last_modified, processos_csv_modificado: recProc.last_modified, ultimo_dia_integras: ultimoDiaIntegras, pautas: pautas.arquivo?.name ?? null },
    correspondencia_orgaos: ORGAOS,
    candidatos_icms_para_curadoria: cand.map((t) => ({ numero: t.numero, situacao: t.situacao, ...t.criterios_icms })),
    divergencias_da_fonte: lacunasFonte,
    observacoes: [
      'Votos individuais: só pré-extração do texto oficial, sempre com situacao_conferencia "pendente"; o site não os exibe antes da conferência.',
      'resultado: "unanimidade" ou "maioria" somente quando o texto oficial traz a expressão literal; "unanimidade-e-maioria" quando traz as duas (ex.: preliminar e mérito); null quando não traz nenhuma.',
      'Espelhos de acórdãos: o STJ publica o mês M por volta do fim do mês M+1 e só inclui acórdãos selecionados; íntegras: um arquivo por dia de publicação, com atraso de cerca de 20 dias.',
      'Coleções vêm de scripts/coleta/stj/colecoes.json (curadoria). Os temas 1304 e 1364 estão no grupo A pela questão/tese, embora o Temas.csv não lhes atribua código de assunto ICMS.',
      'Duplicatas: linhas do Temas.csv repetidas por causa de mais de um tema de repercussão geral do STF foram unidas (repercussao_geral_stf); linhas idênticas do Processos.csv foram removidas.',
      'Pautas futuras: partes, CNPJ, advogados e processos em segredo de justiça são descartados.',
    ],
  });
  console.error(`[stj] ok: ${temas.length} temas, ${alvo.length} pesquisados, gravados ${contagemGravacao.gravados} (inclui meta.json), inalterados ${contagemGravacao.inalterados}, requisições ${estatisticas.requisicoes} (cache ${estatisticas.cache})`);
}

main().catch((e) => { console.error(`[stj] erro fatal: ${e.stack || e.message}`); process.exit(1); });
