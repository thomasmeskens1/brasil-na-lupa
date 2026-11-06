#!/usr/bin/env node
/**
 * Coletor do Tribunal de Contas dos Municípios do Estado do Pará (TCM-PA) — Brasil na Lupa.
 *
 * Gera, em dados/tribunais-contas/tcm-pa/:
 *   contas-prefeitos/<municipio>.json  pareceres prévios sobre as contas de governo das Prefeituras (um item por resolução)
 *   edicoes.json                       edições do Diário Oficial Eletrônico já lidas (para a coleta incremental)
 *   meta.json                          execução, contagens, fontes, restrições e lacunas
 * O TCM-PA não emite parecer sobre as contas do Governador (isso é do TCE-PA).
 *
 * Fonte: as edições em PDF do Diário Oficial Eletrônico do TCM-PA (www.tcmpa.tc.br/doe/), onde são
 * publicadas as resoluções de parecer prévio. A lista de edições é lida da tabela do site; cada PDF é
 * baixado uma vez, o texto é extraído (pypdfium2, Python isolado) e o PDF é descartado.
 *
 * Uso (Node 20.3+):
 *   node scripts/coleta/tribunais-contas/tcm-pa/coletar.mjs               rotina diária (edições novas e pendentes)
 *   node scripts/coleta/tribunais-contas/tcm-pa/coletar.mjs --completo    relê a lista inteira de edições
 *   node scripts/coleta/tribunais-contas/tcm-pa/coletar.mjs --reprocessar refaz os itens a partir do cache de texto (TCMPA_CACHE)
 * Ambiente: COLETA_ORCAMENTO_MIN (padrão 20) limita o tempo; o que faltar fica pendente para a próxima execução.
 *   TCMPA_PYTHON: Python com pypdfium2 (vem com o pdfplumber). TCMPA_CACHE: pasta local opcional para guardar o
 *   texto extraído (uso de desenvolvimento; nunca versionada).
 *
 * Acesso: só www.tcmpa.tc.br; robots.txt lido antes de tudo e respeitado (inacessível = nada é baixado);
 * uma requisição por vez, pausa ≥ 1,5 s (ou o Crawl-delay); User-Agent "BrasilNaLupa-coletor/1.0". Desafio
 * anti-robô ou CAPTCHA interrompe a coleta (nunca é contornado). A consulta de processos (SPE, com reCAPTCHA)
 * e o atosoficiais.com.br (desafio Cloudflare) não são acessados.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  SAIDA, HOST, carregarRobots, abrir, lerBinario, sha256, gravarSeMudou, contagemGravacao, estatisticas,
  lerJson, hojeISO, fonte, temLeitorPdf, textoDoPdf, acharPython,
} from './lib.mjs';
import { URL_LISTA, URL_PAGINA_DOE, urlPagina, lerPaginaLista } from './edicoes.mjs';
import { pareceresDaEdicao } from './parecer.mjs';
import { carregarMunicipiosPA, casarMunicipio, montarItem, preferir, montarArquivoMunicipio } from './municipios.mjs';
import { montarMeta } from './meta.mjs';

const inicio = Date.now();
const ORCAMENTO_MS = Math.max(1, Number(process.env.COLETA_ORCAMENTO_MIN || 20)) * 60000;
const prazo = inicio + ORCAMENTO_MS - 60000;
const DIR_PREF = path.join(SAIDA, 'contas-prefeitos');
const ARQ_EDICOES = path.join(SAIDA, 'edicoes.json');
const ARQ_META = path.join(SAIDA, 'meta.json');
const CACHE = process.env.TCMPA_CACHE ? path.resolve(process.env.TCMPA_CACHE) : null;

function argumentos(argv) {
  const a = { completo: false, reprocessar: false };
  for (const x of argv) {
    if (x === '--completo') a.completo = true;
    else if (x === '--reprocessar') a.reprocessar = true;
    else if (x === '--ajuda' || x === '-h') { console.log('Uso: coletar.mjs [--completo] [--reprocessar]'); process.exit(0); }
    else throw new Error(`argumento desconhecido: ${x}`);
  }
  if (a.reprocessar && !CACHE) throw new Error('--reprocessar precisa de TCMPA_CACHE');
  return a;
}

const arqCache = (url) => path.join(CACHE, `${crypto.createHash('sha1').update(url).digest('hex')}.json`);

/** Itens e registros já gravados (para a coleta incremental). */
function carregarEstado() {
  const itens = new Map();
  if (fs.existsSync(DIR_PREF)) {
    for (const n of fs.readdirSync(DIR_PREF).filter((x) => x.endsWith('.json'))) {
      for (const it of lerJson(path.join(DIR_PREF, n))?.itens || []) itens.set(it.id, it);
    }
  }
  const meta = lerJson(ARQ_META) || {};
  const edicoes = new Map((lerJson(ARQ_EDICOES)?.edicoes || []).map((e) => [e.url, e]));
  return {
    itens,
    semExercicio: new Map((meta.pareceres_sem_exercicio || []).map((r) => [r.numero, r])),
    naoCasados: new Map((meta.pareceres_municipio_nao_casado || []).map((r) => [r.numero, r])),
    descartes: meta.contagens?.blocos_descartados || {},
    edicoes,
  };
}

/** Lê a tabela de edições até achar só edições conhecidas (ou tudo, com --completo). */
async function listarEdicoes(estado, completo) {
  let novas = 0;
  let total = null;
  for (let pagina = 1; pagina <= 400; pagina++) {
    const res = await abrir(urlPagina(pagina), { esperado: /text\/html/i, timeoutMs: 60000 });
    const { total: t, linhas } = lerPaginaLista(await res.text());
    total = t ?? total;
    const oficiais = linhas.filter((l) => l.oficial);
    if (!oficiais.length) break;
    let desconhecidas = 0;
    for (const l of oficiais) {
      if (estado.edicoes.has(l.url)) continue;
      desconhecidas++;
      estado.edicoes.set(l.url, { url: l.url, numero: l.numero, titulo: l.titulo, data: l.data, arquivo: l.arquivo, situacao: 'pendente' });
    }
    novas += desconhecidas;
    if (!completo && !desconhecidas) break;
    if (linhas.length > oficiais.length) break; // a tabela já passou para as edições não oficiais
  }
  return { novas, total };
}

/** Registra os pareceres de uma edição no estado. */
function registrar(estado, edicao, pareceres, municipios) {
  let n = 0;
  for (const p of pareceres) {
    const mun = casarMunicipio(p.municipio_literal, municipios.porNome);
    const breve = { numero: p.numero, municipio_literal: p.municipio_literal, exercicio: p.exercicio, motivo: p.motivo_sem_exercicio, edicao: edicao.titulo, data_publicacao: edicao.data, url: edicao.url, transcricao: p.citacao, bruto: p };
    if (!mun) {
      const ant = estado.naoCasados.get(p.numero);
      if (!ant || (ant.transcricao && !p.citacao)) estado.naoCasados.set(p.numero, breve);
      continue;
    }
    if (!p.exercicio) {
      const ant = estado.semExercicio.get(p.numero);
      if (!ant || (ant.transcricao && !p.citacao)) estado.semExercicio.set(p.numero, { ...breve, municipio: mun.id });
      continue;
    }
    const item = montarItem(p, mun, edicao);
    item.municipio_id = mun.id;
    estado.itens.set(item.id, preferir(estado.itens.get(item.id), item));
    n++;
  }
  return n;
}

async function lerEdicao(edicao) {
  if (CACHE && fs.existsSync(arqCache(edicao.url))) return lerJson(arqCache(edicao.url));
  const res = await abrir(edicao.url, { esperado: /application\/pdf|octet-stream/i, timeoutMs: 240000 });
  const buf = await lerBinario(res, 80 * 1024 * 1024);
  const texto = textoDoPdf(buf);
  texto.sha256 = sha256(buf);
  texto.bytes = buf.length;
  if (CACHE) { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(arqCache(edicao.url), JSON.stringify(texto)); }
  return texto;
}

function gravarTudo(estado, municipios, extra) {
  const porMun = new Map();
  for (const it of estado.itens.values()) {
    const id = it.municipio_id || null;
    if (!id) continue;
    if (!porMun.has(id)) porMun.set(id, []);
    porMun.get(id).push(it);
  }
  const lidas = [...estado.edicoes.values()].filter((e) => e.situacao === 'lida').map((e) => e.data).sort();
  const periodo = lidas.length ? `de ${lidas[0].split('-').reverse().join('/')} a ${lidas[lidas.length - 1].split('-').reverse().join('/')}` : null;
  for (const m of municipios.lista) {
    const itens = porMun.get(m.id);
    const arq = path.join(DIR_PREF, `${m.id}.json`);
    if (itens?.length) gravarSeMudou(arq, montarArquivoMunicipio(m, itens, periodo));
    else if (fs.existsSync(arq)) fs.rmSync(arq); // município sem item válido depois de reprocessar
  }
  const edicoes = [...estado.edicoes.values()].sort((a, b) => b.data.localeCompare(a.data) || b.url.localeCompare(a.url));
  gravarSeMudou(ARQ_EDICOES, { atualizado_em: new Date().toISOString(), tribunal: 'tcm-pa', fonte: fonte('Calendário DOE TCM-PA (lista de edições)', URL_LISTA), edicoes });
  gravarSeMudou(ARQ_META, montarMeta({ estado, municipios, porMun, edicoes, inicio, ...extra }));
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const municipios = carregarMunicipiosPA();
  const estado = carregarEstado();
  if (args.reprocessar) {
    estado.itens.clear(); estado.semExercicio.clear(); estado.naoCasados.clear();
    for (const k of Object.keys(estado.descartes)) delete estado.descartes[k];
  }
  let robots = null;
  if (!args.reprocessar) {
    robots = await carregarRobots();
    console.log(`robots.txt lido (HTTP ${robots.status}); Content-Signal do grupo "*": ${robots.sinal || 'nenhum'}`);
  }
  const leitor = temLeitorPdf();
  if (!leitor) console.error(`Python com pypdfium2 não encontrado (${acharPython()}); os PDFs ficam pendentes.`);

  let listagem = { novas: 0, total: null };
  let interrompidoPor = null;
  if (!args.reprocessar) {
    try { listagem = await listarEdicoes(estado, args.completo); } catch (e) { interrompidoPor = `lista de edições: ${e.message}`; console.error(interrompidoPor); }
  }
  console.log(`edições novas na lista: ${listagem.novas}`);

  const fila = [...estado.edicoes.values()]
    .filter((e) => (args.reprocessar ? e.situacao === 'lida' : ['pendente', 'erro'].includes(e.situacao)))
    .sort((a, b) => b.data.localeCompare(a.data));
  let lidas = 0;
  for (const e of leitor || args.reprocessar ? fila : []) {
    if (interrompidoPor) break;
    if (Date.now() > prazo) { interrompidoPor = 'orçamento de tempo esgotado; o restante fica pendente'; break; }
    try {
      const t = await lerEdicao(e);
      const { pareceres, descartes } = pareceresDaEdicao((t.paginas || []).join('\n'));
      for (const [k, v] of Object.entries(descartes)) estado.descartes[k] = (estado.descartes[k] || 0) + v;
      if (!args.reprocessar) Object.assign(e, { situacao: 'lida', sha256: t.sha256, bytes: t.bytes, paginas: t.total_paginas, lido_em: hojeISO(), erro: undefined });
      e.resolucoes_de_parecer = pareceres.length;
      e.pareceres_exibidos = registrar(estado, e, pareceres, municipios);
      lidas++;
      if (lidas % 25 === 0) { console.log(`${lidas}/${fila.length} edições lidas`); gravarTudo(estado, municipios, { robots, interrompidoPor: 'execução em andamento', args }); }
    } catch (err) {
      console.error(`${e.titulo} (${e.url}): ${err.message}`);
      if (err.bloqueio) { interrompidoPor = err.message; break; }
      Object.assign(e, { situacao: err.status === 404 ? 'indisponivel' : 'erro', erro: err.message.slice(0, 200) });
    }
  }
  gravarTudo(estado, municipios, { robots, interrompidoPor, args, leitor, lidasNestaExecucao: lidas });
  console.log(`edições lidas nesta execução: ${lidas}; itens: ${estado.itens.size}; sem exercício: ${estado.semExercicio.size}; município não casado: ${estado.naoCasados.size}`);
  console.log(`arquivos gravados: ${contagemGravacao.gravados.length}; inalterados: ${contagemGravacao.inalterados.length}; requisições: ${estatisticas.requisicoes} (${HOST})`);
  if (interrompidoPor && !/orçamento/.test(interrompidoPor)) process.exitCode = 1;
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
