// Utilitários do coletor do TCE-RS: robots.txt de cada host lido antes da primeira requisição a ele (sem robots
// legível = host bloqueado), uma requisição por vez por host, com a pausa do Crawl-delay ou a mínima do coletor,
// retentativas educadas, parada diante de desafio anti-bot/CAPTCHA/login, gravação atômica sem reescrever
// arquivo inalterado e orçamento de tempo (COLETA_ORCAMENTO_MIN).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
export const SAIDA = path.join(RAIZ, 'dados', 'tribunais-contas', 'tce-rs');
export const ORGAO = 'Tribunal de Contas do Estado do Rio Grande do Sul (TCE-RS)';
export const USER_AGENT = 'BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)';

// Hosts acessados e pausa mínima entre requisições ao mesmo host (o Crawl-delay do robots.txt prevalece se maior).
// Robots lidos em 06/11/2026: dados.tce.rs.gov.br "Disallow: /api/" e "Crawl-Delay: 10"; portal.tce.rs.gov.br
// "Disallow: /aplicprod/"; tcers.tc.br "Allow: /" para "*" (com "Content-Signal: search=yes,ai-train=no,use=reference").
export const HOSTS = { 'dados.tce.rs.gov.br': 10000, 'portal.tce.rs.gov.br': 3000, 'tcers.tc.br': 3000 };

export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Orçamento de tempo ---------- */

const INICIO = Date.now();
const ORCAMENTO_MS = (() => {
  const v = Number(process.env.COLETA_ORCAMENTO_MIN);
  return Number.isFinite(v) && v > 0 ? v * 60000 : Infinity;
})();
export const restanteMs = () => ORCAMENTO_MS - (Date.now() - INICIO);

/* ---------- robots.txt ---------- */

/** Regras do grupo do nosso agente (ou de "User-agent: *"). */
export function lerRobots(texto) {
  const grupos = [];
  let atual = null;
  for (const bruta of String(texto).split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, '').trim();
    const m = linha.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const campo = m[1].toLowerCase();
    const valor = m[2].trim();
    if (campo === 'user-agent') {
      if (!atual || atual.regras) { atual = { agentes: [], disallow: [], allow: [], crawlDelayS: null, regras: false }; grupos.push(atual); }
      atual.agentes.push(valor.toLowerCase());
    } else if (atual) {
      atual.regras = true;
      if (campo === 'disallow' && valor) atual.disallow.push(valor);
      else if (campo === 'allow' && valor) atual.allow.push(valor);
      else if (campo === 'crawl-delay' && Number(valor) > 0) atual.crawlDelayS = Number(valor);
    }
  }
  const nosso = grupos.find((g) => g.agentes.some((a) => a !== '*' && 'brasilnalupa-coletor'.startsWith(a)));
  const g = nosso || grupos.find((x) => x.agentes.includes('*')) || { disallow: [], allow: [], crawlDelayS: null };
  return { disallow: g.disallow, allow: g.allow, crawlDelayS: g.crawlDelayS };
}

function casaPadrao(padrao, caminho) {
  const re = new RegExp('^' + padrao.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
  return re.test(caminho);
}

/** true se o caminho é permitido (a regra mais longa vence; empate favorece Allow). */
export function caminhoPermitido(regras, caminho) {
  const d = Math.max(-1, ...regras.disallow.filter((p) => casaPadrao(p, caminho)).map((p) => p.length));
  const a = Math.max(-1, ...(regras.allow || []).filter((p) => casaPadrao(p, caminho)).map((p) => p.length));
  return d < 0 || a >= d;
}

const robots = new Map(); // host -> { regras, status } | { bloqueado: motivo }
const ultima = new Map();

async function pausa(host) {
  const r = robots.get(host);
  const intervalo = Math.max(HOSTS[host], (r?.regras?.crawlDelayS || 0) * 1000);
  const falta = (ultima.get(host) || 0) + intervalo - Date.now();
  if (falta > 0) await dormir(falta);
  ultima.set(host, Date.now());
}

/** Lê o robots.txt do host (uma vez por execução). Erro de rede ou 5xx: host bloqueado nesta execução. */
export async function carregarRobots(host) {
  if (robots.has(host)) return robots.get(host);
  await pausa(host);
  estatisticas.requisicoes++;
  let info;
  try {
    const res = await fetch(`https://${host}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60000) });
    const texto = res.ok ? await res.text() : '';
    if (res.status >= 500 || res.status === 401 || res.status === 403 || res.status === 429) info = { bloqueado: `robots.txt de ${host} devolveu HTTP ${res.status}` };
    else info = { status: res.status, regras: lerRobots(texto) };
  } catch (e) {
    info = { bloqueado: `robots.txt de ${host} inacessível (${e.cause?.code || e.message})` };
  }
  robots.set(host, info);
  return info;
}

export const resumoRobots = () => Object.fromEntries([...robots].map(([h, r]) => [h, r.bloqueado ? { bloqueado: r.bloqueado } : { status: r.status, disallow: r.regras.disallow, crawl_delay_s: r.regras.crawlDelayS }]));

function erroDefinitivo(msg, extra = {}) {
  estatisticas.falhas.push(msg);
  return Object.assign(new Error(msg), { definitivo: true, ...extra });
}

function conferir(url) {
  const u = new URL(url);
  if (!(u.hostname in HOSTS) || u.protocol !== 'https:') throw erroDefinitivo(`host fora da lista do coletor: ${u.hostname}`);
  const r = robots.get(u.hostname);
  if (!r) throw new Error(`robots.txt de ${u.hostname} ainda não lido`);
  if (r.bloqueado) throw erroDefinitivo(r.bloqueado, { bloqueio: true });
  if (!caminhoPermitido(r.regras, u.pathname + u.search)) throw erroDefinitivo(`caminho proibido pelo robots.txt: ${u.hostname}${u.pathname}`);
  return u.hostname;
}

/** Página de desafio anti-bot, CAPTCHA ou login: parar e registrar, nunca contornar. */
export function pareceBloqueio(tipo, inicio) {
  return /text\/html/i.test(tipo || '') && /captcha|cf-chl|challenge-platform|Just a moment|recaptcha|keycloak|login\.tce/i.test(inicio);
}

/**
 * Requisição com pausa por host e até 4 tentativas. Retorna { texto, bytes, tipo, ultimaModificacao, status }.
 * esperado: regex do Content-Type aceito; aceitar404: devolve null em vez de erro.
 */
export async function pedir(url, { metodo = 'GET', corpo = null, esperado = null, timeoutMs = 180000, aceitar404 = false } = {}) {
  const host = conferir(url);
  for (let t = 1; t <= 4; t++) {
    await pausa(host);
    estatisticas.requisicoes++;
    let res;
    try {
      const headers = { 'User-Agent': USER_AGENT, Accept: 'application/json, text/html;q=0.9, */*;q=0.5' };
      if (corpo) headers['Content-Type'] = 'application/json';
      res = await fetch(url, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(Math.max(10000, Math.min(timeoutMs, restanteMs()))), redirect: 'follow' });
      conferir(res.url || url);
    } catch (e) {
      if (e.definitivo || t === 4) { if (!e.definitivo) estatisticas.falhas.push(`${url}: ${e.cause?.code || e.message}`); throw e; }
      estatisticas.retentativas++;
      await dormir(5000 * t);
      continue;
    }
    const tipo = res.headers.get('content-type') || '';
    const texto = await res.text();
    estatisticas.bytes += Buffer.byteLength(texto);
    console.error(`[tce-rs] HTTP ${res.status} ${metodo} ${Math.round(Buffer.byteLength(texto) / 1024)} KB ${url}`);
    if (res.ok) {
      if (pareceBloqueio(tipo, texto.slice(0, 5000))) throw erroDefinitivo(`possível desafio anti-bot/CAPTCHA/login em ${url}; coleta interrompida sem contornar`, { bloqueio: true });
      if (esperado && !esperado.test(tipo)) throw erroDefinitivo(`tipo inesperado (${tipo}) em ${url}`);
      return { texto, tipo, status: res.status, ultimaModificacao: res.headers.get('last-modified') };
    }
    if (res.status === 404 && aceitar404) return null;
    if (res.status === 403 || res.status === 401) throw erroDefinitivo(`HTTP ${res.status} em ${url}: acesso recusado pelo servidor; não contornado`, { bloqueio: true, status: res.status });
    if (![408, 429, 500, 502, 503, 504].includes(res.status) || t === 4) throw erroDefinitivo(`HTTP ${res.status} em ${url}`, { status: res.status });
    estatisticas.retentativas++;
    const ra = Number(res.headers.get('retry-after'));
    await dormir(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 120) * 1000 : 8000 * t);
  }
  throw new Error(`falha em ${url}`);
}

/* ---------- Arquivos ---------- */

export function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

const VOLATEIS = new Set(['atualizado_em', 'acessado_em', 'ultima_execucao', 'coletado_em', 'duracao_s', 'estatisticas_http']);
const semVolateis = (o) => JSON.stringify(o, (k, v) => (VOLATEIS.has(k) ? undefined : v));
export const contagemGravacao = { gravados: [], inalterados: [] };

/** Grava atomicamente só se o conteúdo (sem campos voláteis) mudou. */
export function gravarSeMudou(arquivo, obj, { compacto = false } = {}) {
  const antigo = lerJson(arquivo);
  const rel = path.relative(RAIZ, arquivo).replace(/\\/g, '/');
  if (antigo && semVolateis(antigo) === semVolateis(obj)) { contagemGravacao.inalterados.push(rel); return false; }
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1) + '\n', 'utf8');
  fs.renameSync(tmp, arquivo);
  contagemGravacao.gravados.push(rel);
  return true;
}

/* ---------- Texto ---------- */

export const hojeISO = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

export function fonte(titulo, url, extra = {}) {
  return { titulo, url, orgao: ORGAO, acessado_em: hojeISO(), ...extra };
}

/** 'DD/MM/AAAA' → 'AAAA-MM-DD'; 'AAAA-MM-DDT...' → 'AAAA-MM-DD'; senão null. */
export function dataISO(s) {
  const t = String(s ?? '');
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Chave de comparação exata: sem acento, maiúsculas, apóstrofo como espaço, espaços simples. */
export function chaveNome(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/['’‘´`]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function slug(s) {
  return chaveNome(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Texto sem marcas HTML, entidades básicas decodificadas e espaços normalizados. */
const ACENTOS = { acute: '́', grave: '̀', tilde: '̃', circ: '̂', cedil: '̧', uml: '̈' };
export function semHtml(s) {
  return String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&([a-z])(acute|grave|tilde|circ|cedil|uml);/gi, (m, l, d) => (l + ACENTOS[d.toLowerCase()]).normalize('NFC'))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
}
