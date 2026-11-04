// Utilitários do coletor do TCU (Tribunal de Contas da União).
//
// MÓDULO PROMOVÍVEL: nada aqui é específico do TCU, exceto a lista de hosts permitidos (HOSTS_PERMITIDOS),
// que é passada por quem chama. Quando houver um segundo tribunal de contas usando o mesmo padrão,
// este arquivo pode ser promovido para scripts/coleta/tribunais-contas/comum/lib.mjs (decisão do
// orquestrador; hoje cada tribunal tem o seu, para que dois agentes nunca escrevam no mesmo arquivo).
//
// O que oferece:
//  - HTTP com no máximo 2 requisições simultâneas, intervalo mínimo por host, até 4 tentativas com espera
//    crescente (e Retry-After), User-Agent identificável;
//  - lista de hosts permitidos: qualquer host fora dela é recusado ANTES da requisição (o TCU proíbe robôs
//    de IA em sites.tcu.gov.br; a pesquisa pesquisa.apps.tcu.gov.br tem firewall anti-robô — nunca acessados);
//  - leitura do robots.txt de cada host (grupo "User-agent: *") e recusa de caminho bloqueado;
//  - gravação atômica (temporário + rename) que não reescreve arquivo cujo conteúdo não mudou
//    (campos de data voláteis não contam como mudança).
import fs from 'node:fs';
import path from 'node:path';

export const USER_AGENT =
  'brasil-na-lupa-coletor-tcu/1.0 (robo de coleta diaria de dados publicos; +https://github.com/thomasmeskens1/brasil-na-lupa)';

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
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const INTERVALO_MS = 500;
const proximoHorario = new Map();
async function respeitarIntervalo(host) {
  const agora = Date.now();
  const quando = Math.max(agora, proximoHorario.get(host) ?? 0);
  proximoHorario.set(host, quando + INTERVALO_MS);
  if (quando > agora) await dormir(quando - agora);
}

// ---------- hosts permitidos ----------
let hostsPermitidos = new Set();
/** Define os únicos hosts que o coletor pode acessar. */
export function definirHostsPermitidos(lista) { hostsPermitidos = new Set(lista); }
function conferirHost(url) {
  const host = new URL(url).host;
  if (!hostsPermitidos.has(host)) {
    throw Object.assign(new Error(`host fora da lista permitida (não acessado): ${host}`), { definitivo: true });
  }
  return host;
}

// ---------- robots.txt ----------
const regrasRobots = new Map();
async function carregarRobots(host) {
  if (regrasRobots.has(host)) return regrasRobots.get(host);
  let regras;
  try {
    const res = await fetch(`https://${host}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30000) });
    estatisticas.requisicoes++;
    const corpo = await res.text();
    if (res.ok && !/<html/i.test(corpo)) regras = lerRobots(corpo);
    else regras = { disallow: [], allow: [], sem_arquivo: `HTTP ${res.status}` };
  } catch (e) {
    regras = { disallow: ['/'], allow: [], erro: e.message }; // sem robots legível por erro de rede → não acessa
  }
  regrasRobots.set(host, regras);
  return regras;
}
function lerRobots(texto) {
  const regras = { disallow: [], allow: [], crawl_delay: null };
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
    if (campo === 'crawl-delay' && Number(valor) > 0) regras.crawl_delay = Number(valor);
  }
  return regras;
}
function permitidoPorRobots(url) {
  const u = new URL(url);
  const r = regrasRobots.get(u.host);
  if (!r) return false;
  const alvo = u.pathname + u.search;
  let melhor = { tam: -1, ok: true };
  for (const p of r.disallow) if (alvo.startsWith(p) && p.length > melhor.tam) melhor = { tam: p.length, ok: false };
  for (const p of r.allow) if (alvo.startsWith(p) && p.length >= melhor.tam) melhor = { tam: p.length, ok: true };
  return melhor.ok;
}
export const robotsCarregados = () => Object.fromEntries([...regrasRobots].map(([h, r]) => [h, {
  disallow: r.disallow, allow: r.allow,
  ...(r.crawl_delay ? { crawl_delay: r.crawl_delay } : {}),
  ...(r.sem_arquivo ? { sem_arquivo: r.sem_arquivo } : {}),
  ...(r.erro ? { erro: r.erro } : {}),
}]));

// ---------- HTTP ----------
/**
 * GET JSON com no máximo 2 requisições simultâneas e até 4 tentativas (esperas de 3 s, 6 s, 12 s; em 429,
 * 30 s × tentativa ou Retry-After). Recusa host fora da lista e caminho bloqueado no robots.txt.
 * Não insiste em 403/499 (bloqueio anti-robô): falha na hora, sem contornar.
 */
export async function obterJson(url, { timeoutMs = 240000 } = {}) {
  const host = conferirHost(url);
  const robots = await carregarRobots(host);
  if (!permitidoPorRobots(url)) throw Object.assign(new Error(`bloqueado pelo robots.txt: ${url}`), { definitivo: true });
  const maxTentativas = 4;
  for (let t = 1; t <= maxTentativas; t++) {
    await respeitarIntervalo(host);
    if (robots.crawl_delay) await dormir(robots.crawl_delay * 1000);
    await vaga();
    let espera = 0;
    try {
      estatisticas.requisicoes++;
      estatisticas.por_host[host] = (estatisticas.por_host[host] || 0) + 1;
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
      const buf = Buffer.from(await res.arrayBuffer());
      if (res.ok) {
        estatisticas.bytes += buf.length;
        return JSON.parse(buf.toString('utf8').replace(/^﻿/, ''));
      }
      if (![408, 429, 500, 502, 503, 504].includes(res.status)) {
        throw Object.assign(new Error(`HTTP ${res.status} em ${url}`), { definitivo: true });
      }
      const ra = Number(res.headers.get('retry-after'));
      espera = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 120) * 1000 : res.status === 429 ? 30000 * t : 0;
      if (t === maxTentativas) throw new Error(`HTTP ${res.status} em ${url}`);
    } catch (e) {
      if (e.definitivo || t === maxTentativas) { estatisticas.falhas.push(`${url}: ${e.message}`); throw e; }
    } finally {
      liberar();
    }
    estatisticas.retentativas++;
    await dormir(Math.max(espera, 3000 * 2 ** (t - 1)));
  }
}

// ---------- JSON ----------
const COMPACTAS = new Set(['itens']);
/** JSON legível; em listas "itens", um objeto por linha (diffs pequenos no git). */
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
// Campos de data que mudam a cada execução e não contam como mudança de conteúdo.
const VOLATEIS = new Set(['atualizado_em', 'acessado_em', 'ultima_execucao']);
const semVolateis = (o) => JSON.stringify(o, (k, v) => (VOLATEIS.has(k) ? undefined : v));
export const contagemGravacao = { gravados: 0, inalterados: 0 };
/** Grava atomicamente (temporário + rename); não reescreve se só mudaram campos voláteis. */
export function gravarSeMudou(arquivo, obj) {
  const antigo = lerJson(arquivo);
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
/** 'dd/mm/aaaa' → 'aaaa-mm-dd'; outros → null. */
export function dataISO(s) {
  const m = String(s ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}
