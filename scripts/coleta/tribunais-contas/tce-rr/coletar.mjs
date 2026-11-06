#!/usr/bin/env node
/**
 * Coletor do Tribunal de Contas do Estado de Roraima (TCE-RR) — Brasil na Lupa.
 *
 * Fontes oficiais:
 *   - Portal da Transparência do TCE-RR, página "Decisões e Acórdãos": a API que a própria página usa
 *     (POST https://transparencia.tcerr.tc.br/api/sessoes/deliberacao) lista as deliberações da série "Parecer Prévio";
 *   - o texto de cada parecer no SEI do TCE-RR (link público com código de verificação, HTML em ISO-8859-1).
 * Gera, em dados/tribunais-contas/tce-rr/:
 *   pareceres.json                    índice de todos os pareceres da série, com os campos lidos do texto (evita reler)
 *   contas-governador/<exercicio>.json parecer prévio sobre as contas do Governador
 *   contas-prefeitos/<municipio>.json  pareceres sobre as contas de governo de cada prefeitura (15 municípios)
 *   meta.json                         execução, contagens, fontes, restrições e lacunas
 *
 * Uso (Node 20+):
 *   node scripts/coleta/tribunais-contas/tce-rr/coletar.mjs             lista a série e lê só os pareceres novos
 *   node scripts/coleta/tribunais-contas/tce-rr/coletar.mjs --completo  relê o texto de todos os pareceres
 *   COLETA_ORCAMENTO_MIN=15 node ...                                    para limpo ao fim do orçamento
 *
 * Regras de acesso: lê o robots.txt de transparencia.tcerr.tc.br e de sei.tcerr.tc.br antes de tudo (404 em
 * 06/11/2026: sem regras) e o respeita; robots inacessível = host bloqueado nesta execução. Uma requisição por vez,
 * pausa mínima de 2 s (ou o Crawl-delay, se maior), User-Agent identificado; sem login, token ou CAPTCHA.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerRobots, gravarSeMudou, contagemGravacao, estatisticas, hojeISO, fonte, lerJson, restanteMs, servidorIndisponivel, normalizar, SAIDA, HOST_API, HOST_SEI } from './lib.mjs';
import { listarPareceres, baixarDocumento, URL_PAGINA } from './fonte.mjs';
import { htmlParaTexto } from './html.mjs';
import { lerParecer } from './extrair.mjs';
import { interpretar } from './interpretar.mjs';
import { carregarMunicipiosRR } from './municipios.mjs';
import { montarGovernador, montarMunicipio } from './montar.mjs';

export const VERSAO_LEITURA = 1;
const MARGEM_MS = 90000;
const ARQ_INDICE = path.join(SAIDA, 'pareceres.json');

function argumentos(argv) {
  const a = { completo: false };
  for (const x of argv) {
    if (x === '--completo') a.completo = true;
    else if (x === '--ajuda' || x === '-h') { console.log('Uso: coletar.mjs [--completo]'); process.exit(0); }
    else throw new Error(`argumento desconhecido: ${x}`);
  }
  return a;
}

/** Campos lidos de um parecer que ficam no índice (sem o texto integral). */
export function leituraDe(html, truncado, porNome) {
  const p = lerParecer(htmlParaTexto(html));
  if (!p.numero) return { versao: VERSAO_LEITURA, lido_em: hojeISO(), erro: 'cabeçalho "Parecer Prévio nº" não localizado no documento' };
  // Pareceres antigos digitalizados: o documento do SEI só traz a imagem da página, sem texto.
  if (!p.assunto && !p.orgao && !p.processo && !p.ementa) return { versao: VERSAO_LEITURA, lido_em: hojeISO(), sem_texto: true, numero_documento: p.numero, ente: { tipo: 'outro', nome_literal: null } };
  const i = interpretar(p, porNome);
  return {
    versao: VERSAO_LEITURA,
    lido_em: hojeISO(),
    truncado: !!truncado,
    numero_documento: p.numero,
    processo: p.processo,
    assunto: p.assunto,
    orgao: p.orgao,
    responsavel: p.responsavel,
    relator: p.relator,
    revisor: p.revisor,
    ementa: p.ementa && p.ementa.length > 2000 ? `${p.ementa.slice(0, 2000)}…` : p.ementa,
    publicacao_literal: p.publicacao_literal,
    anotacoes_literal: p.anotacoes_literal,
    sessao_literal: p.sessao_literal,
    data_sessao: p.data_sessao,
    data_publicacao: i.data_publicacao,
    exercicio: i.exercicio,
    exercicio_fonte: i.exercicio_fonte,
    divergencia: i.divergencia,
    ente: i.ente.tipo === 'governo-estadual' ? { tipo: 'governo-estadual' }
      : i.ente.tipo === 'municipio' ? { tipo: 'municipio', nome_literal: normalizar(i.ente.municipio.nome) }
        : i.ente.tipo === 'municipio-nao-casado' ? { tipo: 'municipio', nome_literal: i.ente.nome_literal }
          : { tipo: 'outro', nome_literal: null },
    tipo_contas: i.tipo_contas,
    conclusao: i.conclusao,
    conclusao_literal: i.conclusao_literal,
    lacunas_leitura: i.lacunas,
  };
}

async function main() {
  const inicio = Date.now();
  const args = argumentos(process.argv.slice(2));
  const anoFim = Number(hojeISO().slice(0, 4)) - 1; // contas de um exercício são prestadas no ano seguinte
  const { porNome, fonte: fonteMunicipios } = carregarMunicipiosRR();
  const erros = [];

  const robotsApi = await lerRobots(HOST_API);
  const robotsSei = await lerRobots(HOST_SEI);

  // ---- Lista oficial da série "Parecer Prévio"
  let lista = null;
  try { lista = await listarPareceres(); } catch (e) { erros.push(`Lista da série Parecer Prévio: ${e.message}`); }
  const indiceAntigo = lerJson(ARQ_INDICE);
  const porId = new Map((indiceAntigo?.itens ?? []).map((x) => [x.id, x]));
  if (lista) {
    const vistos = new Set();
    for (const d of lista.itens) {
      vistos.add(d.id);
      const ant = porId.get(d.id);
      porId.set(d.id, { ...d, leitura: ant?.leitura ?? null });
    }
    for (const [id, x] of porId) if (!vistos.has(id)) porId.set(id, { ...x, fora_da_lista_em: x.fora_da_lista_em ?? hojeISO() });
  }

  // ---- Texto dos pareceres novos (ou todos, com --completo), do mais recente para o mais antigo
  const pendentes = [...porId.values()]
    .filter((x) => !x.fora_da_lista_em && (args.completo || !x.leitura || x.leitura.versao !== VERSAO_LEITURA || x.leitura.erro))
    .sort((a, b) => b.id - a.id);
  let lidos = 0;
  let interrompido = false;
  const gravarIndice = () => gravarSeMudou(ARQ_INDICE, {
    atualizado_em: new Date().toISOString(),
    descricao: 'Índice da série “Parecer Prévio” do Portal da Transparência do TCE-RR, com os campos lidos do texto oficial de cada parecer no SEI. Serve para não reler documentos já lidos.',
    versao_leitura: VERSAO_LEITURA,
    consulta: lista?.consulta ?? indiceAntigo?.consulta ?? null,
    total: porId.size,
    itens: [...porId.values()].sort((a, b) => b.id - a.id),
  });
  for (const x of pendentes) {
    if (restanteMs() < MARGEM_MS) { interrompido = true; break; }
    if (servidorIndisponivel()) break;
    try {
      const { html, truncado } = await baixarDocumento(x);
      x.leitura = leituraDe(html, truncado, porNome);
      lidos++;
    } catch (e) {
      erros.push(`Parecer ${x.numero} (${x.id}): ${e.message}`);
      x.leitura = { versao: VERSAO_LEITURA, lido_em: hojeISO(), erro: e.message };
      if (e.robots) break;
    }
    if (lidos && lidos % 25 === 0) gravarIndice();
  }
  gravarIndice();
  const restantes = [...porId.values()].filter((x) => !x.fora_da_lista_em && (!x.leitura || x.leitura.versao !== VERSAO_LEITURA)).length;

  // ---- Montagem dos arquivos do site
  const validos = [...porId.values()].filter((x) => !x.fora_da_lista_em && x.leitura && !x.leitura.erro);
  const urlConsulta = lista?.consulta ?? indiceAntigo?.consulta ?? URL_PAGINA;
  const gov = [];
  const porMun = new Map();
  const naoCasados = [];
  const outrosEntes = [];
  const semTexto = [];
  for (const x of validos) {
    const lei = x.leitura;
    const e = { del: x, lei };
    if (lei.sem_texto) { semTexto.push({ id: x.id, numero: x.numero, url: x.url }); continue; }
    if (lei.ente.tipo === 'governo-estadual') { gov.push(e); continue; }
    const mun = lei.ente.nome_literal ? porNome.get(normalizar(lei.ente.nome_literal)) : null;
    if (mun) { if (!porMun.has(mun.id)) porMun.set(mun.id, { mun, entradas: [] }); porMun.get(mun.id).entradas.push(e); }
    else if (lei.ente.tipo === 'municipio') naoCasados.push({ id: x.id, numero: x.numero, orgao_literal: lei.orgao, url: x.url });
    else outrosEntes.push({ id: x.id, numero: x.numero, orgao_literal: lei.orgao, url: x.url });
  }
  const g = montarGovernador(gov, urlConsulta);
  const dirGov = path.join(SAIDA, 'contas-governador');
  const dirPref = path.join(SAIDA, 'contas-prefeitos');
  const gerados = new Set();
  for (const [ano, item] of g.arquivos) { const f = path.join(dirGov, `${ano}.json`); gravarSeMudou(f, item); gerados.add(f); }
  const resumoMun = {};
  for (const { mun, entradas } of [...porMun.values()].sort((a, b) => a.mun.id.localeCompare(b.mun.id))) {
    const d = montarMunicipio(mun, entradas, urlConsulta, anoFim);
    resumoMun[mun.id] = d.contagens;
    if (!d.itens.length) continue;
    const f = path.join(dirPref, `${mun.id}.json`);
    gravarSeMudou(f, d);
    gerados.add(f);
  }
  // Arquivos antigos sem correspondente só são apagados quando a lista e todas as leituras estão completas.
  const removidos = [];
  if (lista && !restantes && !erros.length) {
    for (const dir of [dirGov, dirPref]) {
      for (const n of (fs.existsSync(dir) ? fs.readdirSync(dir) : [])) {
        const f = path.join(dir, n);
        if (n.endsWith('.json') && !gerados.has(f)) { fs.rmSync(f); removidos.push(path.relative(SAIDA, f).replace(/\\/g, '/')); }
      }
    }
  }

  // ---- meta
  const exGov = [...g.arquivos.keys()].sort((a, b) => a - b);
  const primeiroGov = exGov[0] ?? null;
  const faltamGov = [];
  for (let a = primeiroGov ?? anoFim + 1; a <= anoFim; a++) if (!g.arquivos.has(a)) faltamGov.push(a);
  const porConclusao = {};
  const itensSite = [...g.arquivos.values(), ...[...porMun.values()].flatMap(({ mun, entradas }) => montarMunicipio(mun, entradas, urlConsulta, anoFim).itens)];
  for (const it of itensSite) { const k = it.parecer.conclusao ?? 'conclusão não reconhecida'; porConclusao[k] = (porConclusao[k] || 0) + 1; }
  const meta = {
    atualizado_em: new Date().toISOString(),
    ultima_execucao: new Date().toISOString(),
    tribunal: 'tce-rr',
    modo: args.completo ? 'completo' : 'incremental',
    interrompido_por_orcamento: interrompido,
    contagens: {
      pareceres_na_serie: lista ? lista.itens.length : null,
      pareceres_lidos_nesta_execucao: lidos,
      pareceres_pendentes_de_leitura: restantes,
      pareceres_com_erro_de_leitura: [...porId.values()].filter((x) => x.leitura?.erro).length,
      pareceres_governo_do_estado: gov.length,
      exercicios_governador: exGov.length,
      municipios_com_pareceres: Object.values(resumoMun).filter((c) => c.pareceres).length,
      pareceres_municipais_contas_de_governo: Object.values(resumoMun).reduce((s, c) => s + c.pareceres, 0),
      pareceres_municipais_outros: Object.values(resumoMun).reduce((s, c) => s + c.outros_pareceres, 0),
      pareceres_sem_exercicio: g.semExercicio.length + Object.values(resumoMun).reduce((s, c) => s + c.itens_sem_exercicio, 0),
      pareceres_municipio_nao_identificado: naoCasados.length,
      pareceres_de_outros_orgaos: outrosEntes.length,
      pareceres_digitalizados_sem_texto: semTexto.length,
      itens_exibidos_por_conclusao: porConclusao,
    },
    contas_governador: { exercicios: exGov, exercicios_sem_parecer_na_serie: faltamGov, sem_exercicio: g.semExercicio, outros_pareceres_sem_pagina: g.fora },
    municipios: resumoMun,
    municipio_nao_identificado: naoCasados,
    outros_orgaos: outrosEntes,
    digitalizados_sem_texto: semTexto,
    fontes: [
      fonte('Portal da Transparência do TCE-RR — Decisões e Acórdãos (série “Parecer Prévio”)', URL_PAGINA),
      fonte('API usada pela página oficial (lista de deliberações; não documentada como dados abertos)', 'https://transparencia.tcerr.tc.br/api/sessoes/deliberacao'),
      fonte('SEI do TCE-RR — texto oficial de cada parecer (link público com código de verificação)', 'https://sei.tcerr.tc.br/sei/'),
      { ...fonteMunicipios, observacao: 'Lista oficial de municípios usada para ligar o nome escrito no parecer ao código IBGE' },
    ],
    robots_e_restricoes: [
      `robots.txt de ${HOST_API} (HTTP ${robotsApi.status ?? 'sem resposta'}${robotsApi.bloqueio ? `: ${robotsApi.bloqueio}` : robotsApi.status === 404 ? ', sem regras' : `, ${robotsApi.regras.length} regras`}) e de ${HOST_SEI} (HTTP ${robotsSei.status ?? 'sem resposta'}${robotsSei.bloqueio ? `: ${robotsSei.bloqueio}` : robotsSei.status === 404 ? ', sem regras' : `, ${robotsSei.regras.length} regras`}) lidos no início de cada execução; robots inacessível bloqueia o host.`,
      'Uma requisição por vez, pausa mínima de 2 s (ou o Crawl-delay, se maior), User-Agent identificado; sem login, token ou CAPTCHA.',
      'Cada parecer é lido uma única vez (índice em pareceres.json); documentos grandes são lidos só até 900 KB, onde ficam cabeçalho, ementa e decisão.',
      'Nomes de advogados, procuradores e servidores do cabeçalho não são copiados; só o campo “Responsável” (gestores das contas).',
    ],
    observacoes: [
      'A série “Parecer Prévio” reúne os pareceres do Pleno e das Câmaras desde a década de 1990; o exercício, o órgão, o relator e a conclusão vêm do texto de cada parecer.',
      'O campo “ano” da lista nem sempre é o exercício das contas; o exercício é o escrito no assunto (ou, na falta, no órgão ou na ementa) do parecer.',
      'A data de publicação da lista é a de inclusão no SEI; a data de publicação mostrada é a do diário oficial escrita no topo do documento.',
      'Julgamento das contas pela Assembleia Legislativa e pelas Câmaras Municipais ainda não coletado.',
    ],
    lacunas: [
      ...(faltamGov.length ? [`Contas do Governador: exercícios sem parecer prévio na série (${faltamGov.join(', ')})`] : []),
      ...(semTexto.length ? [`${semTexto.length} pareceres antigos (anos 1990) estão no SEI só como imagem digitalizada, sem texto; ente, exercício e conclusão não foram lidos`] : []),
      ...(naoCasados.length ? [`${naoCasados.length} pareceres trazem no campo “Órgão” um nome de município diferente do nome oficial (ex.: “${naoCasados[0].orgao_literal}”) e não foram ligados a nenhum município`] : []),
      'Pareceres sobre contas de gestão, tomadas de contas e tomadas de contas especiais ficam guardados em “outros_pareceres” e ainda não são exibidos',
    ],
    removidos,
    erros,
    estatisticas_http: { ...estatisticas, falhas: estatisticas.falhas.slice(0, 20) },
    duracao_s: Math.round((Date.now() - inicio) / 1000),
  };
  gravarSeMudou(path.join(SAIDA, 'meta.json'), meta);
  console.log(JSON.stringify({ contagens: meta.contagens, governador: exGov, interrompido, erros: erros.slice(0, 10), gravados: contagemGravacao.gravados.length, inalterados: contagemGravacao.inalterados.length, http: { requisicoes: estatisticas.requisicoes, bytes: estatisticas.bytes } }, null, 2));
  if (erros.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
}
