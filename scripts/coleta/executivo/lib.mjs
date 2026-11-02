// Utilitários do coletor do Executivo federal: HTTP com no máximo 2 requisições simultâneas
// (no processo inteiro), retentativas com espera crescente, intervalo mínimo por servidor,
// gravação atômica que não reescreve arquivo sem mudança.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// O Planalto derruba conexões com User-Agent curto (docs/pesquisa/fontes-federais.md, seção 4.1).
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) voto-em-quem-coletor/1.0 (coleta diaria de dados abertos oficiais; site neutro de acompanhamento politico)';

const MAX_PARALELO = 2;
// Intervalo mínimo entre inícios de requisição por servidor (ms).
const INTERVALO = { 'www.planalto.gov.br': 800, 'legis.senado.leg.br': 150, 'dadosabertos.camara.leg.br': 150 };
let ativos = 0;
const fila = [];
const ultimoInicio = new Map();
export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };

async function vaga() {
  if (ativos < MAX_PARALELO) { ativos++; return; }
  await new Promise((r) => fila.push(r));
  ativos++;
}
function liberar() { ativos--; const r = fila.shift(); if (r) r(); }
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function respeitarIntervalo(url) {
  const host = new URL(url).host;
  const min = INTERVALO[host] ?? 300;
  for (;;) {
    const espera = (ultimoInicio.get(host) ?? 0) + min - Date.now();
    if (espera <= 0) break;
    await dormir(espera);
  }
  ultimoInicio.set(host, Date.now());
}

/**
 * GET (ou HEAD) com até 6 tentativas, espera 2 s, 4 s, 8 s… e Retry-After em 429/503.
 * tipo: 'json' | 'text' | 'latin1' | 'buffer' | 'head'.
 * opcional=true: 404/410 devolve null em vez de erro.
 * Retorna { dados, url (final, após redirecionamentos), status, tipoConteudo }.
 */
export async function obter(url, { tipo = 'json', timeoutMs = 60000, opcional = false, accept } = {}) {
  const maxTentativas = 6;
  for (let t = 1; t <= maxTentativas; t++) {
    await vaga();
    let espera = 0;
    try {
      await respeitarIntervalo(url);
      estatisticas.requisicoes++;
      const res = await fetch(url, {
        method: tipo === 'head' ? 'HEAD' : 'GET',
        headers: { 'User-Agent': USER_AGENT, Accept: accept || (tipo === 'json' ? 'application/json' : '*/*') },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      if ((res.status === 404 || res.status === 410) && opcional) return null;
      if (res.ok) {
        const base = { url: res.url, status: res.status, tipoConteudo: res.headers.get('content-type') || '' };
        if (tipo === 'head') return { ...base, dados: null };
        const buf = Buffer.from(await res.arrayBuffer());
        estatisticas.bytes += buf.length;
        if (tipo === 'buffer') return { ...base, dados: buf };
        const texto = (tipo === 'latin1' ? buf.toString('latin1') : buf.toString('utf8')).replace(/^﻿/, '');
        return { ...base, dados: tipo === 'json' ? JSON.parse(texto) : texto };
      }
      if (![408, 429, 500, 502, 503, 504].includes(res.status)) {
        throw Object.assign(new Error(`HTTP ${res.status} em ${url}`), { definitivo: true });
      }
      const ra = Number(res.headers.get('retry-after'));
      espera = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) * 1000 : 0;
      if (t === maxTentativas) throw new Error(`HTTP ${res.status} em ${url}`);
    } catch (e) {
      if (e.definitivo || t === maxTentativas) { estatisticas.falhas.push(`${url}: ${e.message}`); throw e; }
    } finally {
      liberar();
    }
    estatisticas.retentativas++;
    await dormir(Math.max(espera, 2000 * 2 ** (t - 1)));
  }
  return null;
}

/** Executa fn sobre cada item; o paralelismo real é controlado por obter(). */
export const paraCada = (itens, fn) => Promise.all(itens.map((x, i) => fn(x, i)));

/** Garante lista: a API antiga do Senado devolve objeto quando há um único elemento. */
export const lista = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** "31/12/2025" → "2025-12-31"; mantém ISO; null se vazio. */
export function dataISO(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const i = String(s).match(/^(\d{4}-\d{2}-\d{2})/);
  return i ? i[1] : null;
}

export function hojeISO() { // data em Brasília (UTC-3)
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
export function somarDias(iso, dias) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10);
}

/** JSON legível; elementos das listas grandes ficam um por linha. */
const COMPACTAS = new Set(['itens', 'votos', 'prazos', 'votacoes']);
export function formatar(v, nivel = 0) {
  const ind = '  '.repeat(nivel), ind2 = '  '.repeat(nivel + 1);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return '[\n' + v.map((x) => ind2 + formatar(x, nivel + 1)).join(',\n') + '\n' + ind + ']';
  }
  if (v && typeof v === 'object') {
    const ks = Object.keys(v);
    if (!ks.length) return '{}';
    return '{\n' + ks.map((k) => {
      const x = v[k];
      const s = COMPACTAS.has(k) && Array.isArray(x) && x.length
        ? '[\n' + x.map((e) => ind2 + '  ' + JSON.stringify(e)).join(',\n') + '\n' + ind2 + ']'
        : formatar(x, nivel + 1);
      return `${ind2}${JSON.stringify(k)}: ${s}`;
    }).join(',\n') + '\n' + ind + '}';
  }
  return JSON.stringify(v);
}
/** Normaliza para o que JSON consegue representar (undefined some, NaN vira null). */
const paraJson = (o) => JSON.parse(JSON.stringify(o));

export function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

// Campos que mudam a cada execução e não contam como mudança de conteúdo.
const VOLATEIS = new Set(['atualizado_em', 'acessado_em', 'ultima_execucao', 'coletado_em']);
const semVolateis = (o) => JSON.stringify(o, (k, v) => (VOLATEIS.has(k) ? undefined : v));

export const contagemGravacao = { gravados: 0, inalterados: 0 };

/** Grava atomicamente (temporário + rename) só se o conteúdo, sem campos voláteis, mudou. */
export function gravarSeMudou(arquivo, obj) {
  obj = paraJson(obj);
  const antigo = lerJson(arquivo);
  if (antigo && semVolateis(antigo) === semVolateis(obj)) { contagemGravacao.inalterados++; return false; }
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, formatar(obj) + '\n', 'utf8');
  fs.renameSync(tmp, arquivo);
  contagemGravacao.gravados++;
  return true;
}

export const fonte = (titulo, url, orgao, acessado_em) => ({ titulo, url, orgao, acessado_em });

/** Remove acentos e caixa, para comparar nomes. */
export const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
