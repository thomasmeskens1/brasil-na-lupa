// Utilitários do coletor de Atibaia: HTTP educado (no máximo 2 requisições simultâneas,
// intervalo mínimo entre inícios de requisição, retentativas), gravação atômica que não
// reescreve arquivos sem mudança, e datas no fuso de Brasília.
import fs from 'node:fs';
import path from 'node:path';

export const USER_AGENT =
  'voto-em-quem-coletor/1.0 (coleta automatica de dados publicos para site neutro de acompanhamento politico; Node.js)';

const MAX_PARALELO = 2;
const INTERVALO_MS = 1200; // espaço mínimo entre o início de duas requisições
let ativos = 0;
let ultimoInicio = 0;
const fila = [];
export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function vaga() {
  if (ativos >= MAX_PARALELO) await new Promise((r) => fila.push(r));
  ativos++;
  const agora = Date.now();
  const espera = ultimoInicio + INTERVALO_MS - agora;
  ultimoInicio = Math.max(agora, ultimoInicio + INTERVALO_MS);
  if (espera > 0) await dormir(espera);
}
function liberar() { ativos--; const r = fila.shift(); if (r) r(); }

const TRANSITORIOS = new Set([408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);

/**
 * GET com no máximo 2 requisições simultâneas, intervalo mínimo entre inícios,
 * até 6 tentativas com espera crescente (3 s, 6 s, 12 s…) e respeito ao Retry-After.
 * tipo: 'json' | 'text' | 'latin1' | 'buffer'. Retorna null em 404 quando opcional=true.
 */
export async function obter(url, { tipo = 'json', timeoutMs = 90000, opcional = false } = {}) {
  const maxTentativas = 6;
  for (let t = 1; t <= maxTentativas; t++) {
    await vaga();
    let espera = 0;
    try {
      estatisticas.requisicoes++;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: tipo === 'json' ? 'application/json' : '*/*' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      if (res.status === 404 && opcional) return null;
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        estatisticas.bytes += buf.length;
        if (tipo === 'buffer') return buf;
        if (tipo === 'latin1') return buf.toString('latin1');
        const texto = buf.toString('utf8').replace(/^﻿/, '');
        return tipo === 'json' ? JSON.parse(texto) : texto;
      }
      if (!TRANSITORIOS.has(res.status)) {
        throw Object.assign(new Error(`HTTP ${res.status} em ${url}`), { definitivo: true });
      }
      const ra = Number(res.headers.get('retry-after'));
      espera = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 120) * 1000 : 0;
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

/** Executa fn sobre os itens com no máximo `n` em andamento ao mesmo tempo. */
export async function emLotes(itens, n, fn) {
  const resultados = new Array(itens.length);
  let i = 0;
  async function trabalhador() {
    while (i < itens.length) { const k = i++; resultados[k] = await fn(itens[k], k); }
  }
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, trabalhador));
  return resultados;
}

/** JSON legível; elementos das listas grandes ficam um por linha. */
const COMPACTAS = new Set(['itens', 'presentes', 'meses_coletados']);
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
      const s = COMPACTAS.has(k) && Array.isArray(x) && x.length && x.every((e) => e && typeof e === 'object')
        ? '[\n' + x.map((e) => ind2 + '  ' + JSON.stringify(e)).join(',\n') + '\n' + ind2 + ']'
        : formatar(x, nivel + 1);
      return `${ind2}${JSON.stringify(k)}: ${s}`;
    }).join(',\n') + '\n' + ind + '}';
  }
  return JSON.stringify(v);
}

export function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

// Campos que mudam a cada execução e não contam como mudança de conteúdo.
const VOLATEIS = new Set(['atualizado_em', 'acessado_em', 'ultima_execucao', 'processado_em',
  'consultado_em', 'verificado_em']);
function semVolateis(o) {
  return JSON.stringify(o, (k, v) => (VOLATEIS.has(k) ? undefined : v));
}

export const contagemGravacao = { gravados: 0, inalterados: 0, arquivos: [] };

/**
 * Grava atomicamente (arquivo temporário + rename). Se o conteúdo, ignorando os
 * campos voláteis (datas de execução), for igual ao existente, não reescreve.
 */
export function gravarSeMudou(arquivo, obj) {
  const antigo = lerJson(arquivo);
  if (antigo && semVolateis(antigo) === semVolateis(obj)) { contagemGravacao.inalterados++; return false; }
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, formatar(obj) + '\n', 'utf8');
  fs.renameSync(tmp, arquivo);
  contagemGravacao.gravados++;
  contagemGravacao.arquivos.push(arquivo);
  return true;
}

export function hojeISO() {
  // Data no fuso de Brasília (UTC-3), formato AAAA-MM-DD.
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
export function somarDias(iso, dias) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10);
}
export function diasEntre(a, b) {
  return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
}

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
  'setembro', 'outubro', 'novembro', 'dezembro'];

/** Remove acentos e baixa a caixa (para comparação). */
export function semAcento(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
export function mesDoNome(nome) {
  const n = semAcento(nome.trim());
  const i = MESES.findIndex((m) => semAcento(m) === n);
  return i < 0 ? null : i + 1;
}
/** Monta AAAA-MM-DD validando a data no calendário; null se inválida. */
export function dataISO(ano, mes, dia) {
  const a = Number(ano), m = Number(mes), d = Number(dia);
  if (!a || !m || !d) return null;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}
