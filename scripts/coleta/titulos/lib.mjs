// Utilitários do gerador de títulos: HTTP educado (no máximo 2 requisições simultâneas no processo,
// intervalo mínimo por servidor, Crawl-delay e Disallow do robots.txt respeitados), cache local fora do
// git (scripts/coleta/titulos/.cache) e gravação atômica que não regrava arquivo sem mudança.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..', '..');
export const DADOS = path.join(RAIZ, 'dados');
export const SAIDA = path.join(DADOS, 'titulos');
export const CACHE = path.join(AQUI, '.cache');

export const USER_AGENT =
  'BrasilNaLupa-coletor/1.0 (titulos em linguagem simples para site neutro de acompanhamento politico; Node.js)';

const MAX_PARALELO = 2;
const INTERVALO_PADRAO_MS = 400; // entre duas requisições ao mesmo servidor
let ativos = 0;
const fila = [];
const proximoPorHost = new Map();
const robotsPorHost = new Map();
export const estatisticas = { requisicoes: 0, cache: 0, bloqueadas_robots: 0, falhas: [] };

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function vaga() {
  if (ativos < MAX_PARALELO) { ativos++; return; }
  await new Promise((r) => fila.push(r));
  ativos++;
}
function liberar() { ativos--; const r = fila.shift(); if (r) r(); }

/** Lê e interpreta o robots.txt do servidor (grupo "*" e grupos que citem o nosso agente). */
async function robots(host) {
  if (robotsPorHost.has(host)) return robotsPorHost.get(host);
  const p = (async () => {
    const regras = { disallow: [], allow: [], crawlDelayMs: 0, lido: false };
    try {
      const res = await fetch(`https://${host}/robots.txt`, {
        headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30000), redirect: 'follow',
      });
      if (!res.ok) return regras; // sem robots.txt legível: nenhuma restrição declarada
      const texto = await res.text();
      if (/<html/i.test(texto.slice(0, 500))) return regras;
      regras.lido = true;
      let grupoAplica = false, emGrupo = false;
      for (const bruta of texto.split(/\r?\n/)) {
        const linha = bruta.replace(/#.*/, '').trim();
        if (!linha) continue;
        const [k, ...resto] = linha.split(':');
        const chave = k.trim().toLowerCase(), valor = resto.join(':').trim();
        if (chave === 'user-agent') {
          if (!emGrupo) grupoAplica = false;
          emGrupo = true;
          const ua = valor.toLowerCase();
          if (ua === '*' || ua.includes('brasilnalupa')) grupoAplica = true;
          continue;
        }
        emGrupo = false;
        if (!grupoAplica) continue;
        if (chave === 'disallow' && valor) regras.disallow.push(valor);
        else if (chave === 'allow' && valor) regras.allow.push(valor);
        else if (chave === 'crawl-delay') regras.crawlDelayMs = Math.max(regras.crawlDelayMs, Number(valor) * 1000 || 0);
      }
    } catch { /* falha de rede ao ler robots: segue sem restrição declarada */ }
    return regras;
  })();
  robotsPorHost.set(host, p);
  return p;
}

function casa(padrao, caminho) {
  const re = new RegExp('^' + padrao.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
  return re.test(caminho);
}
export async function permitido(url) {
  const u = new URL(url);
  const r = await robots(u.host);
  const caminho = u.pathname + u.search;
  const bloq = r.disallow.filter((d) => casa(d, caminho)).sort((a, b) => b.length - a.length)[0];
  if (!bloq) return true;
  const lib = r.allow.filter((a) => casa(a, caminho)).sort((a, b) => b.length - a.length)[0];
  return Boolean(lib && lib.length >= bloq.length);
}

/**
 * GET com cache em disco. ttlDias: idade máxima do cache (Infinity = nunca expira).
 * Retorna { corpo, url_final, obtido_em } ou null (404, bloqueio do robots.txt ou falha definitiva).
 * semRede=true: só usa o cache.
 */
export async function obter(url, { tipo = 'json', ttlDias = 7, semRede = false, cacheTambemFalha = true, apenasCacheValido = false } = {}) {
  const chave = crypto.createHash('sha1').update(url).digest('hex');
  const arq = path.join(CACHE, chave.slice(0, 2), `${chave}.json`);
  const emCache = lerJson(arq);
  if (emCache && (semRede || Date.now() - Date.parse(emCache.obtido_em) < ttlDias * 86400000)) {
    estatisticas.cache++;
    return emCache.corpo === null ? null : emCache;
  }
  if (apenasCacheValido) return undefined; // sem cache válido: quem chamou decide se gasta a requisição
  if (semRede) return null;
  if (!(await permitido(url))) { estatisticas.bloqueadas_robots++; return null; }
  const host = new URL(url).host;
  const r = await robots(host);
  const intervalo = Math.max(INTERVALO_PADRAO_MS, r.crawlDelayMs);
  for (let t = 1; t <= 4; t++) {
    await vaga();
    let espera = 0, resultado;
    try {
      const agora = Date.now();
      const prox = proximoPorHost.get(host) || 0;
      proximoPorHost.set(host, Math.max(agora, prox) + intervalo);
      if (prox > agora) await dormir(prox - agora);
      estatisticas.requisicoes++;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: tipo === 'json' ? 'application/json' : 'text/html,*/*' },
        signal: AbortSignal.timeout(60000), redirect: 'follow',
      });
      if (res.ok) {
        const texto = (await res.text()).replace(/^﻿/, '');
        const corpo = tipo === 'json' ? JSON.parse(texto) : texto;
        resultado = { corpo, url_final: res.url, obtido_em: new Date().toISOString() };
      } else if (res.status === 404 || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        resultado = { corpo: null, url_final: res.url, status: res.status, obtido_em: new Date().toISOString() };
      } else {
        const ra = Number(res.headers.get('retry-after'));
        espera = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) * 1000 : 3000 * 2 ** (t - 1);
      }
    } catch (e) {
      espera = 3000 * 2 ** (t - 1);
      if (t === 4) estatisticas.falhas.push(`${url}: ${e.message}`);
    } finally {
      liberar();
    }
    if (resultado) {
      if (resultado.corpo !== null || cacheTambemFalha) gravarCache(arq, resultado);
      return resultado.corpo === null ? null : resultado;
    }
    if (t < 4) await dormir(espera);
  }
  return emCache && emCache.corpo !== null ? emCache : null; // rede falhou: usa cache vencido, se houver
}

function gravarCache(arq, obj) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const tmp = `${arq}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, arq);
}

export function lerJson(arq) {
  try { return JSON.parse(fs.readFileSync(arq, 'utf8').replace(/^﻿/, '')); } catch { return null; }
}

/** Lista os .json de um diretório (sem subpastas), em ordem estável. */
export function jsonsDe(dir, filtro = () => true) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json') && filtro(f)).sort()
      .map((f) => ({ arquivo: path.join(dir, f), nome: f.replace(/\.json$/, '') }));
  } catch { return []; }
}

export const contagemGravacao = { gravados: 0, inalterados: 0 };
/** Campos que mudam a cada execução e não contam como mudança de conteúdo. */
const VOLATEIS = new Set(['atualizado_em', 'gerado_em']);
function semVolateis(obj) {
  return JSON.stringify(obj, (k, v) => (VOLATEIS.has(k) ? undefined : v));
}
/** Grava em arquivo temporário e renomeia; não regrava se só os campos voláteis mudaram. */
export function gravarSeMudou(arquivo, obj) {
  const antigo = lerJson(arquivo);
  if (antigo && semVolateis(antigo) === semVolateis(obj)) { contagemGravacao.inalterados++; return false; }
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, arquivo);
  contagemGravacao.gravados++;
  return true;
}

export function hojeISO() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
export function dataBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}
export function diasEntre(a, b) {
  return Math.round((Date.parse(b.slice(0, 10) + 'T12:00:00Z') - Date.parse(a.slice(0, 10) + 'T12:00:00Z')) / 86400000);
}
