// Utilitários do coletor de autoria aprovada (Câmara e Senado). Node 20+, sem dependências.
// REGRAS: robots.txt de cada host lido antes de qualquer outra requisição a ele; no máximo 2
// requisições simultâneas no processo inteiro; User-Agent honesto; gravação atômica.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const SAIDA = path.join(RAIZ, 'dados', 'autoria');

export const USER_AGENT =
  'Brasil na Lupa - coletor de autoria/1.0 (coleta diaria de dados abertos para site neutro de acompanhamento politico; Node.js; +https://github.com/thomasmeskens1/quem-votar)';

export const MAX_PARALELO = 2;
export const estat = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- robots.txt ---------- */
const regrasRobots = new Map();

/** Interpreta o grupo "User-agent: *" de um robots.txt → { disallow: [], allow: [] }. */
export function lerRobots(texto) {
  const disallow = [], allow = [];
  let noGrupo = false, viuRegra = false;
  for (const bruta of String(texto).split(/\r?\n/)) {
    const linha = bruta.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(linha);
    if (!m) continue;
    const campo = m[1].toLowerCase(), valor = m[2].trim();
    if (campo === 'user-agent') {
      if (viuRegra) { noGrupo = false; viuRegra = false; }
      if (valor === '*') noGrupo = true;
      continue;
    }
    if (campo !== 'allow' && campo !== 'disallow') continue;
    viuRegra = true;
    if (!noGrupo || !valor) continue;
    (campo === 'allow' ? allow : disallow).push(valor);
  }
  return { disallow, allow };
}

function casa(regra, caminho) {
  const re = new RegExp('^' + regra.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
  return re.test(caminho);
}

/** A regra mais longa vence; empate favorece Allow (RFC 9309). */
export function permitido(regras, url) {
  const u = new URL(url);
  const caminho = u.pathname + u.search;
  let melhor = null;
  for (const r of regras.disallow) if (casa(r, caminho) && (!melhor || r.length > melhor.len)) melhor = { len: r.length, ok: false };
  for (const r of regras.allow) if (casa(r, caminho) && (!melhor || r.length >= melhor.len)) melhor = { len: r.length, ok: true };
  return melhor ? melhor.ok : true;
}

/**
 * Lê o robots.txt do host antes de qualquer outra requisição a ele. Sem arquivo (403/404 ou página
 * HTML no lugar do robots.txt) = sem regras; falha de rede = tudo bloqueado (não coleta).
 */
export async function carregarRobots(host, buscar = fetch) {
  if (regrasRobots.has(host)) return regrasRobots.get(host);
  try {
    estat.requisicoes++;
    const res = await buscar(`https://${host}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30000) });
    const corpo = await res.text();
    if (res.ok && !/<html/i.test(corpo)) regrasRobots.set(host, { ...lerRobots(corpo), consultado: true });
    else regrasRobots.set(host, { disallow: [], allow: [], sem_arquivo: `HTTP ${res.status}${/<html/i.test(corpo) ? ' (página HTML, não é robots.txt)' : ''}` });
  } catch (e) {
    regrasRobots.set(host, { disallow: ['/'], allow: [], erro: e.message });
  }
  return regrasRobots.get(host);
}

export const robotsCarregados = () =>
  Object.fromEntries([...regrasRobots].sort(([a], [b]) => a.localeCompare(b)).map(([h, r]) => [h, {
    consultado_em: hojeISO(),
    situacao: r.erro ? `falha ao ler (${r.erro}); coleta bloqueada` : r.sem_arquivo ? `sem robots.txt (${r.sem_arquivo})` : 'lido',
    disallow: r.disallow,
  }]));

/* ---------- HTTP com limite de 2 simultâneas ---------- */
let ativos = 0;
const fila = [];
async function vaga() {
  if (ativos < MAX_PARALELO) { ativos++; return; }
  await new Promise((r) => fila.push(r));
  ativos++;
}
function liberar() { ativos--; const r = fila.shift(); if (r) r(); }
export const _ativos = () => ativos;

/**
 * GET com robots.txt conferido, até 5 tentativas, espera crescente e respeito a Retry-After.
 * tipo 'json' | 'text'. `anterior` = { etag, last_modified } → devolve { naoMudou: true } em 304.
 * Retorna { dados, etag, last_modified }.
 */
export async function obter(url, { tipo = 'json', timeoutMs = 120000, anterior = null, buscar = fetch } = {}) {
  const host = new URL(url).host;
  const regras = await carregarRobots(host, buscar);
  if (!permitido(regras, url)) throw Object.assign(new Error(`bloqueado pelo robots.txt: ${url}`), { definitivo: true });
  const max = 5;
  for (let t = 1; t <= max; t++) {
    await vaga();
    let espera = 0;
    try {
      estat.requisicoes++;
      const headers = { 'User-Agent': USER_AGENT, Accept: tipo === 'json' ? 'application/json' : '*/*' };
      if (anterior?.etag) headers['If-None-Match'] = anterior.etag;
      if (anterior?.last_modified) headers['If-Modified-Since'] = anterior.last_modified;
      const res = await buscar(url, { headers, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
      if (res.status === 304) return { naoMudou: true };
      if (res.ok) {
        const texto = (await res.text()).replace(/^﻿/, '');
        estat.bytes += texto.length;
        return {
          dados: tipo === 'json' ? JSON.parse(texto) : texto,
          etag: res.headers.get('etag') || null,
          last_modified: res.headers.get('last-modified') || null,
        };
      }
      if (![408, 429, 500, 502, 503, 504].includes(res.status)) {
        throw Object.assign(new Error(`HTTP ${res.status} em ${url}`), { definitivo: true });
      }
      const ra = Number(res.headers.get('retry-after'));
      espera = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) * 1000 : 0;
      if (t === max) throw new Error(`HTTP ${res.status} em ${url}`);
    } catch (e) {
      if (e.definitivo || t === max) { estat.falhas.push(`${url}: ${e.message}`); throw e; }
    } finally {
      liberar();
    }
    estat.retentativas++;
    await dormir(Math.max(espera, 1500 * 2 ** (t - 1)));
  }
  throw new Error(`sem resposta: ${url}`);
}

/** Executa fn sobre cada item; o paralelismo real é limitado por obter(). */
export async function paraCada(itens, fn) {
  return Promise.all(itens.map((x, i) => fn(x, i)));
}

/* ---------- CSV (separador ';', aspas duplas) ---------- */
/** Chama fn(objeto) para cada linha de dados; a primeira linha é o cabeçalho. */
export function percorrerCsv(texto, fn, sep = ';') {
  let cab = null, linha = [], campo = '', aspas = false;
  const fechar = () => {
    linha.push(campo); campo = '';
    if (!cab) cab = linha.map((c) => c.trim());
    else if (linha.length > 1) fn(Object.fromEntries(cab.map((k, i) => [k, linha[i] ?? ''])));
    linha = [];
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n') fechar();
    else if (c !== '\r') campo += c;
  }
  if (campo !== '' || linha.length) fechar();
}

/* ---------- arquivos ---------- */
export function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

/** Grava em arquivo temporário e renomeia (atômico); não reescreve se o conteúdo não mudou. */
export function gravarAtomico(arquivo, dados) {
  const txt = JSON.stringify(dados, null, 1) + '\n';
  try { if (fs.readFileSync(arquivo, 'utf8') === txt) return false; } catch { /* novo */ }
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, txt);
  fs.renameSync(tmp, arquivo);
  return true;
}

export function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/** Início da legislatura atual (57ª, 2023–2027), comum a Câmara e Senado. */
export const INICIO_LEGISLATURA = '2023-02-01';
export const LEGISLATURA = 57;
