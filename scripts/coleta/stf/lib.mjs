// Utilitários do coletor do STF: HTTP com no máximo 2 requisições simultâneas e retentativas,
// verificação do robots.txt antes de qualquer acesso ao portal, decodificação UTF-8/windows-1252,
// gravação atômica que não reescreve arquivo sem mudança de conteúdo.
import fs from 'node:fs';
import path from 'node:path';
import { mascararObjeto } from './privacidade.mjs';

// Identificação do coletor. Observação: o firewall de jurisprudencia.stf.jus.br recusa (HTTP 403) alguns
// User-Agents (ex.: com a palavra "Node.js"); este, com link do repositório, é aceito. Não é contorno:
// o coletor continua se identificando como robô.
export const USER_AGENT =
  'voto-em-quem-coletor/1.0 (coleta automatica de dados publicos; +https://github.com/thomasmeskens1/quem-votar)';

const MAX_PARALELO = 2;
let ativos = 0;
const fila = [];
export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [], por_host: {} };

async function vaga() {
  if (ativos < MAX_PARALELO) { ativos++; return; }
  await new Promise((r) => fila.push(r));
  ativos++;
}
function liberar() { ativos--; const r = fila.shift(); if (r) r(); }
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Intervalo mínimo entre o início de duas requisições ao mesmo host (o portal responde HTTP 429
// depois de algumas centenas de requisições seguidas sem intervalo).
const INTERVALO_MS = { 'portal.stf.jus.br': 1200, default: 400 };
const proximoHorario = new Map();
async function respeitarIntervalo(host) {
  const passo = INTERVALO_MS[host] ?? INTERVALO_MS.default;
  const agora = Date.now();
  const quando = Math.max(agora, proximoHorario.get(host) ?? 0);
  proximoHorario.set(host, quando + passo);
  if (quando > agora) await dormir(quando - agora);
}
/** Pausa todas as próximas requisições ao host (usado após HTTP 429). */
function pausarHost(host, ms) { proximoHorario.set(host, Math.max(proximoHorario.get(host) ?? 0, Date.now() + ms)); }

// ---------- robots.txt ----------
const regrasRobots = new Map(); // host → { disallow: [], allow: [] } (grupo "User-agent: *")

/** Lê o robots.txt do host (grupo "*") e guarda as regras. Falha de leitura → host tratado como bloqueado. */
export async function carregarRobots(host) {
  if (regrasRobots.has(host)) return regrasRobots.get(host);
  let texto = null;
  try {
    const res = await fetch(`https://${host}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30000) });
    estatisticas.requisicoes++;
    const corpo = await res.text();
    if (res.ok && !/<html/i.test(corpo)) texto = corpo;
    else regrasRobots.set(host, { disallow: [], allow: [], sem_arquivo: `HTTP ${res.status}${/<html/i.test(corpo) ? ' (página HTML, não é robots.txt)' : ''}` });
  } catch (e) {
    regrasRobots.set(host, { disallow: ['/'], allow: [], erro: e.message });
  }
  if (texto !== null) {
    const regras = { disallow: [], allow: [], texto: texto.trim() };
    let noGrupo = false, viuRegra = false;
    for (const bruta of texto.split(/\r?\n/)) {
      const linha = bruta.replace(/#.*/, '').trim();
      const m = linha.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
      if (!m) continue;
      const campo = m[1].toLowerCase(), valor = m[2].trim();
      if (campo === 'user-agent') { if (viuRegra) { noGrupo = false; viuRegra = false; } if (valor === '*') noGrupo = true; continue; }
      viuRegra = true;
      if (!noGrupo) continue;
      if (campo === 'disallow' && valor) regras.disallow.push(valor);
      if (campo === 'allow' && valor) regras.allow.push(valor);
    }
    regrasRobots.set(host, regras);
  }
  return regrasRobots.get(host);
}

/** true se o caminho da URL é permitido pelo robots.txt já carregado (regra mais longa vence). */
export function permitidoPorRobots(url) {
  const u = new URL(url);
  const r = regrasRobots.get(u.host);
  if (!r) return false;
  const alvo = u.pathname + u.search;
  let melhor = { tam: -1, ok: true };
  for (const p of r.disallow) if (alvo.startsWith(p) && p.length > melhor.tam) melhor = { tam: p.length, ok: false };
  for (const p of r.allow) if (alvo.startsWith(p) && p.length >= melhor.tam) melhor = { tam: p.length, ok: true };
  return melhor.ok;
}
export const robotsCarregados = () => Object.fromEntries([...regrasRobots].map(([h, r]) => [h, { disallow: r.disallow, allow: r.allow, ...(r.sem_arquivo ? { sem_arquivo: r.sem_arquivo } : {}), ...(r.erro ? { erro: r.erro } : {}) }]));

// ---------- HTTP ----------
/**
 * GET/POST com no máximo 2 requisições simultâneas, intervalo mínimo por host, até 4 tentativas com espera
 * crescente (2 s, 4 s, 8 s; em HTTP 429, 30 s, 60 s, 90 s, pausando o host) e respeito a Retry-After. Antes de cada acesso confere o robots.txt do host; caminho bloqueado = erro (nunca acessa).
 * tipo: 'json' | 'text' (UTF-8) | 'cp1252' (windows-1252). opcional=true → null em 404.
 * Não insiste em 403 (barreira anti-robô): falha na hora, sem contornar.
 */
export async function obter(url, { tipo = 'json', corpo = null, timeoutMs = 120000, opcional = false } = {}) {
  const host = new URL(url).host;
  await carregarRobots(host);
  if (!permitidoPorRobots(url)) throw Object.assign(new Error(`bloqueado pelo robots.txt: ${url}`), { definitivo: true });
  const maxTentativas = 4;
  for (let t = 1; t <= maxTentativas; t++) {
    await respeitarIntervalo(host);
    await vaga();
    let espera = 0;
    try {
      estatisticas.requisicoes++;
      estatisticas.por_host[host] = (estatisticas.por_host[host] || 0) + 1;
      const headers = { 'User-Agent': USER_AGENT, Accept: tipo === 'json' ? 'application/json' : '*/*' };
      if (corpo) headers['Content-Type'] = 'application/json';
      const res = await fetch(url, {
        method: corpo ? 'POST' : 'GET', headers, body: corpo ? JSON.stringify(corpo) : undefined,
        signal: AbortSignal.timeout(timeoutMs), redirect: 'follow',
      });
      const buf = Buffer.from(await res.arrayBuffer());
      if (res.status === 404 && opcional) return null;
      if (res.ok) {
        estatisticas.bytes += buf.length;
        return decodificar(buf, tipo);
      }
      if (![408, 429, 500, 502, 503, 504].includes(res.status)) {
        throw Object.assign(new Error(`HTTP ${res.status} em ${url}`), { definitivo: true });
      }
      const ra = Number(res.headers.get('retry-after'));
      espera = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 120) * 1000 : res.status === 429 ? 30000 * t : 0;
      if (res.status === 429) { estatisticas.http429 = (estatisticas.http429 || 0) + 1; pausarHost(host, espera); }
      if (t === maxTentativas) throw new Error(`HTTP ${res.status} em ${url}`);
    } catch (e) {
      if (e.definitivo || t === maxTentativas) { estatisticas.falhas.push(`${url}: ${e.message}`); throw e; }
    } finally {
      liberar();
    }
    estatisticas.retentativas++;
    await dormir(Math.max(espera, 2000 * 2 ** (t - 1)));
  }
}

function decodificar(buf, tipo) {
  if (tipo === 'cp1252') return new TextDecoder('windows-1252').decode(buf);
  const texto = buf.toString('utf8').replace(/^﻿/, '');
  return tipo === 'json' ? JSON.parse(texto) : texto;
}

// ---------- texto ----------
const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', ordf: 'ª', sect: '§', deg: '°', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…' };
const ACENTOS = { aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', atilde: 'ã', otilde: 'õ', acirc: 'â', ecirc: 'ê', ocirc: 'ô', ccedil: 'ç', agrave: 'à', uuml: 'ü' };
export function entidades(s) {
  return String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, e) => {
      const k = e.toLowerCase();
      if (ENT[k]) return ENT[k];
      const b = ACENTOS[k];
      if (!b) return m;
      return e[0] === e[0].toUpperCase() ? b.toUpperCase() : b;
    });
}
/** HTML → linhas de texto (uma por bloco), com entidades decodificadas. */
export function htmlParaLinhas(html) {
  return entidades(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/td|\/th|\/h\d|\/dd|\/dt)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean);
}
export const normalizarEspacos = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
/** Chave de comparação de nomes: sem acentos, maiúsculas, sem "MIN."/"MINISTRO(A)". */
export function chaveNome(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/^\s*(MIN\.|MINISTR[OA])\s+/, '').replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------- JSON ----------
const COMPACTAS = new Set(['itens', 'votos', 'assuntos', 'temas', 'sumulas']);
export function formatar(v, nivel = 0) {
  const ind = '  '.repeat(nivel), ind2 = '  '.repeat(nivel + 1);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return '[\n' + v.map((x) => ind2 + formatar(x, nivel + 1)).join(',\n') + '\n' + ind + ']';
  }
  if (v && typeof v === 'object') {
    const ks = Object.keys(v).filter((k) => v[k] !== undefined);
    if (!ks.length) return '{}';
    return '{\n' + ks.map((k) => {
      const x = v[k];
      const s = COMPACTAS.has(k) && Array.isArray(x) && x.length
        ? '[\n' + x.map((e) => ind2 + '  ' + JSON.stringify(e)).join(',\n') + '\n' + ind2 + ']'
        : formatar(x, nivel + 1);
      return `${ind2}${JSON.stringify(k)}: ${s}`;
    }).join(',\n') + '\n' + ind + '}';
  }
  return v === undefined ? 'null' : JSON.stringify(v);
}
export function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}
// Campos que mudam a cada execução e não contam como mudança de conteúdo.
const VOLATEIS = new Set(['atualizado_em', 'acessado_em', 'verificado_em', 'ultima_execucao', 'estatisticas']);
const semVolateis = (o) => JSON.stringify(o, (k, v) => (VOLATEIS.has(k) ? undefined : v));
export const contagemGravacao = { gravados: 0, inalterados: 0 };
/** Grava atomicamente (temporário + rename); não reescreve se só mudaram campos voláteis. */
export function gravarSeMudou(arquivo, obj) {
  const antigo = lerJson(arquivo);
  // Diretriz 12: todo texto gravado passa pelo mascaramento de nomes de particulares e documentos.
  mascararObjeto(obj, antigo);
  if (antigo && semVolateis(antigo) === semVolateis(obj)) { contagemGravacao.inalterados++; return false; }
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, formatar(obj) + '\n', 'utf8');
  fs.renameSync(tmp, arquivo);
  contagemGravacao.gravados++;
  return true;
}

// ---------- datas ----------
/** Data de hoje no fuso de Brasília (UTC-3), AAAA-MM-DD. */
export const hojeISO = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
export function somarDias(iso, dias) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10);
}
/** 'dd/mm/aaaa' | 'd.m.aaaa' | 'aaaa-mm-dd…' → 'aaaa-mm-dd'; outros → null. */
export function dataISO(s) {
  if (!s) return null;
  let m = String(s).match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
