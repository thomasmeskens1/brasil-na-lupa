// Utilitários do coletor do TCE-RR: HTTP sequencial (uma requisição por vez, pausa mínima entre elas),
// leitura do robots.txt de cada host antes de qualquer outra requisição a ele, leitura parcial de documentos
// grandes, orçamento de tempo e gravação atômica que não reescreve arquivo sem mudança de conteúdo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
export const SAIDA = path.join(RAIZ, 'dados', 'tribunais-contas', 'tce-rr');

export const USER_AGENT = 'BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)';
export const ORGAO = 'Tribunal de Contas do Estado de Roraima (TCE-RR)';

// Únicos hosts acessados: a API do Portal da Transparência (lista de deliberações) e o SEI (texto dos pareceres).
export const HOST_API = 'transparencia.tcerr.tc.br';
export const HOST_SEI = 'sei.tcerr.tc.br';
const HOSTS_PERMITIDOS = new Set([HOST_API, HOST_SEI]);
const PAUSA_MS = 2000;

export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Orçamento de tempo (COLETA_ORCAMENTO_MIN) ---------- */

const INICIO = Date.now();
const ORCAMENTO_MS = (() => {
  const v = Number(process.env.COLETA_ORCAMENTO_MIN);
  return Number.isFinite(v) && v > 0 ? v * 60000 : Infinity;
})();
export function restanteMs() { return ORCAMENTO_MS - (Date.now() - INICIO); }

/* ---------- robots.txt ---------- */

const robots = new Map(); // host -> { status, regras, crawlDelayS }

/** Interpreta as regras para "User-agent: *" e para o nosso agente. */
export function interpretarRobots(texto) {
  const regras = [];
  let crawlDelayS = null;
  let aplica = false;
  let emGrupo = false;
  for (const bruta of String(texto).split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, '').trim();
    const m = linha.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const campo = m[1].toLowerCase();
    const valor = m[2].trim();
    if (campo === 'user-agent') {
      if (!emGrupo) aplica = false;
      emGrupo = true;
      const ua = valor.toLowerCase();
      if (ua === '*' || ua.startsWith('brasilnalupa')) aplica = true;
    } else {
      emGrupo = false;
      if (!aplica) continue;
      if ((campo === 'disallow' || campo === 'allow') && valor) regras.push({ tipo: campo, caminho: valor });
      if (campo === 'crawl-delay' && Number(valor) > 0) crawlDelayS = Math.max(crawlDelayS ?? 0, Number(valor));
    }
  }
  return { regras, crawlDelayS };
}

/** true se o caminho é permitido (regra mais longa vence; empate favorece allow). */
export function caminhoPermitido(regras, caminho) {
  let melhor = null;
  for (const r of regras) {
    const re = new RegExp('^' + r.caminho.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(caminho) && (!melhor || r.caminho.length > melhor.caminho.length || (r.caminho.length === melhor.caminho.length && r.tipo === 'allow'))) melhor = r;
  }
  return !melhor || melhor.tipo === 'allow';
}

async function bruto(url, opcoes, timeoutMs, limiteBytes = Infinity) {
  estatisticas.requisicoes++;
  const res = await fetch(url, { ...opcoes, headers: { 'User-Agent': USER_AGENT, ...(opcoes.headers || {}) }, signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
  const partes = [];
  let total = 0;
  let truncado = false;
  const leitor = res.body?.getReader();
  while (leitor) {
    const { done, value } = await leitor.read();
    if (done) break;
    partes.push(value);
    total += value.length;
    // Documentos do SEI chegam a 2 MB por causa de imagens embutidas no fim; o texto vem antes.
    if (total >= limiteBytes) { truncado = true; await leitor.cancel().catch(() => {}); break; }
  }
  estatisticas.bytes += total;
  return { res, buf: Buffer.concat(partes.map((p) => Buffer.from(p))), truncado };
}

/**
 * Lê o robots.txt de um host antes de qualquer outra requisição a ele. 404 = sem regras; qualquer outra falha
 * (erro de rede, 5xx, 403) é tratada como bloqueio total do host nesta execução.
 */
export async function lerRobots(host) {
  let r;
  try {
    const { res, buf } = await bruto(`https://${host}/robots.txt`, {}, 60000, 512 * 1024);
    if (res.status === 404 || res.status === 410) r = { status: res.status, regras: [], crawlDelayS: null };
    else if (res.ok) r = { status: res.status, ...interpretarRobots(buf.toString('utf8')) };
    else r = { status: res.status, regras: [{ tipo: 'disallow', caminho: '/' }], crawlDelayS: null, bloqueio: `robots.txt respondeu HTTP ${res.status}` };
  } catch (e) {
    r = { status: null, regras: [{ tipo: 'disallow', caminho: '/' }], crawlDelayS: null, bloqueio: `robots.txt inacessível (${e.message})` };
  }
  robots.set(host, r);
  ultimo = Date.now();
  return r;
}

export function robotsDe(host) { return robots.get(host) ?? null; }

/* ---------- HTTP ---------- */

let ultimo = 0;
let fila = Promise.resolve();

/** Decodifica pelo charset do Content-Type (o SEI usa ISO-8859-1; a API, UTF-8). */
export function decodificar(buf, contentType) {
  const cs = (String(contentType || '').match(/charset=([^;]+)/i)?.[1] || 'utf-8').trim().toLowerCase();
  const rotulo = /8859-1|latin-?1/.test(cs) ? 'latin1' : /1252/.test(cs) ? 'windows-1252' : 'utf-8';
  return new TextDecoder(rotulo).decode(buf).replace(/^﻿/, '');
}

function sinaisDeBloqueio(texto) {
  return /captcha|cf-challenge|are you a robot|just a moment|access denied/i.test(texto.slice(0, 4000));
}

// Disjuntor: depois de 3 requisições seguidas que falharam em todas as tentativas, nenhuma requisição nova
// é feita nesta execução (não insistir num servidor sobrecarregado).
let falhasSeguidas = 0;
export function servidorIndisponivel() { return falhasSeguidas >= 3; }

/** Requisição sequencial com pausa e até 3 tentativas. Retorna { texto, truncado, status }. */
export function requisitar(url, { metodo = 'GET', corpo = null, limiteBytes = Infinity, timeoutMs = 120000 } = {}) {
  const tarefa = fila.then(() => requisitarAgora(url, metodo, corpo, limiteBytes, timeoutMs));
  fila = tarefa.catch(() => {});
  return tarefa;
}

async function requisitarAgora(url, metodo, corpo, limiteBytes, timeoutMs) {
  const u = new URL(url);
  if (!HOSTS_PERMITIDOS.has(u.hostname)) throw new Error(`host fora da lista do coletor: ${u.hostname}`);
  const rb = robots.get(u.hostname);
  if (!rb) throw new Error(`robots.txt de ${u.hostname} ainda não lido`);
  if (!caminhoPermitido(rb.regras, u.pathname + u.search)) throw Object.assign(new Error(`caminho proibido pelo robots.txt: ${u.pathname}`), { definitivo: true, robots: true });
  if (servidorIndisponivel()) throw Object.assign(new Error('servidor tratado como indisponível nesta execução (falhas seguidas)'), { definitivo: true, disjuntor: true });
  const pausa = Math.max(PAUSA_MS, (rb.crawlDelayS ?? 0) * 1000);
  const opcoes = metodo === 'POST'
    ? { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(corpo ?? {}) }
    : { method: 'GET', headers: { Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' } };
  for (let t = 1; t <= 3; t++) {
    const espera = pausa - (Date.now() - ultimo);
    if (espera > 0) await dormir(espera);
    try {
      const t0 = Date.now();
      const { res, buf, truncado } = await bruto(url, opcoes, Math.max(5000, Math.min(timeoutMs, restanteMs())), limiteBytes);
      ultimo = Date.now();
      console.error(`[tce-rr] ${metodo} HTTP ${res.status} ${Math.round((ultimo - t0) / 100) / 10} s ${buf.length} B${truncado ? ' (parcial)' : ''} ${url}`);
      const texto = decodificar(buf, res.headers.get('content-type'));
      if (res.ok) {
        if (!/^\s*[{[]/.test(texto) && sinaisDeBloqueio(texto)) throw Object.assign(new Error(`possível desafio anti-robô em ${url}; coleta interrompida`), { definitivo: true });
        falhasSeguidas = 0;
        return { texto, truncado, status: res.status };
      }
      if (res.status >= 300 && res.status < 400) throw Object.assign(new Error(`redirecionamento inesperado (HTTP ${res.status})`), { definitivo: true });
      if (![408, 429, 500, 502, 503, 504].includes(res.status)) throw Object.assign(new Error(`HTTP ${res.status}`), { definitivo: true });
      if (t === 3) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      ultimo = Date.now();
      console.error(`[tce-rr] tentativa ${t} falhou: ${e.message} (${url})`);
      if (e.definitivo || t === 3 || restanteMs() < 60000) {
        if (!e.robots) falhasSeguidas++;
        estatisticas.falhas.push(`${url}: ${e.message}`);
        throw e;
      }
    }
    estatisticas.retentativas++;
    await dormir(10000 * 2 ** (t - 1)); // 10 s, 20 s
  }
  throw new Error('inalcançável');
}

/* ---------- Gravação ---------- */

export function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

const VOLATEIS = new Set(['atualizado_em', 'acessado_em', 'ultima_execucao', 'coletado_em', 'duracao_s', 'estatisticas_http']);
export function semVolateis(o) {
  return JSON.stringify(o, (k, v) => (VOLATEIS.has(k) ? undefined : v));
}

export const contagemGravacao = { gravados: [], inalterados: [] };

/** Grava atomicamente (temporário + rename) só se o conteúdo, sem campos voláteis, mudou. */
export function gravarSeMudou(arquivo, obj) {
  const antigo = lerJson(arquivo);
  const rel = path.relative(RAIZ, arquivo).replace(/\\/g, '/');
  if (antigo && semVolateis(antigo) === semVolateis(obj)) { contagemGravacao.inalterados.push(rel); return false; }
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, arquivo);
  contagemGravacao.gravados.push(rel);
  return true;
}

/* ---------- Texto ---------- */

export function hojeISO() {
  return new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10); // fuso de Boa Vista (UTC−4)
}

export function fonte(titulo, url, acessado_em = hojeISO()) {
  return { titulo, url, orgao: ORGAO, acessado_em };
}

/** Sem acentos, minúsculas, espaços simples (só para comparação exata de nomes). */
export function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** "dd/mm/aaaa" → "aaaa-mm-dd" (null se a data não existir). */
export function dataBR(s) {
  const m = String(s || '').match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (!m) return null;
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(a, mes - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== d) return null;
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
