// Utilitários do coletor de agenda e pauta do Plenário: HTTP com no máximo 2 requisições
// simultâneas e retentativas, gravação atômica que não reescreve arquivo sem mudança, datas.
// Só usa módulos do próprio Node (20+).
import fs from 'node:fs';
import path from 'node:path';

export const USER_AGENT =
  'BrasilNaLupa-coletor/1.0 (coleta automatica de dados abertos para site neutro de acompanhamento politico; Node.js)';

const MAX_PARALELO = 2;
let ativos = 0;
const fila = [];
export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };

async function vaga() {
  if (ativos < MAX_PARALELO) { ativos++; return; }
  await new Promise((r) => fila.push(r));
  ativos++;
}
function liberar() { ativos--; const r = fila.shift(); if (r) r(); }
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET com no máximo 2 requisições simultâneas (no processo inteiro), até 5 tentativas,
 * espera crescente (2 s, 4 s, 8 s…) e respeito ao Retry-After em 429/503.
 * tipo: 'json' | 'text'. Retorna null em 404 quando opcional=true.
 */
export async function obter(url, { tipo = 'json', timeoutMs = 60000, opcional = false, userAgent = USER_AGENT } = {}) {
  const maxTentativas = 5;
  for (let t = 1; t <= maxTentativas; t++) {
    await vaga();
    let espera = 0;
    try {
      estatisticas.requisicoes++;
      const res = await fetch(url, {
        headers: { 'User-Agent': userAgent, Accept: tipo === 'json' ? 'application/json' : 'text/html,*/*' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      if (res.status === 404 && opcional) return null;
      if (res.ok) {
        const texto = (await res.text()).replace(/^﻿/, '');
        estatisticas.bytes += texto.length;
        if (tipo !== 'json') return texto;
        // O Senado responde 200 com corpo vazio quando o encontro ainda não tem pauta publicada.
        if (!texto.trim()) return null;
        try { return JSON.parse(texto); } catch (e) {
          throw Object.assign(new Error(`JSON inválido em ${url}: ${e.message}`), { definitivo: true });
        }
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
}

/** Executa fn para cada item; o limite real de simultaneidade é o de obter(). */
export async function paraCada(itens, fn) {
  return Promise.all(itens.map((x, i) => fn(x, i)));
}

export function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

// Campos que mudam a cada execução e não contam como mudança de conteúdo.
const VOLATEIS = new Set(['atualizado_em', 'acessado_em', 'verificado_em']);
function semVolateis(o) {
  return JSON.stringify(o, (k, v) => (VOLATEIS.has(k) ? undefined : v));
}

export const contagemGravacao = { gravados: 0, inalterados: 0 };

/**
 * Grava atomicamente (arquivo temporário + rename). Se o conteúdo, ignorando
 * atualizado_em/acessado_em/verificado_em, for igual ao existente, não reescreve.
 * `forcar` grava mesmo assim (usado só no meta.json, que registra a execução).
 */
export function gravarSeMudou(arquivo, obj, { forcar = false } = {}) {
  const antigo = lerJson(arquivo);
  if (!forcar && antigo && semVolateis(antigo) === semVolateis(obj)) { contagemGravacao.inalterados++; return false; }
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, arquivo);
  contagemGravacao.gravados++;
  return true;
}

/** Data no fuso de Brasília (UTC-3), AAAA-MM-DD. */
export function hojeISO() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
export function somarDias(iso, dias) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10);
}
/** Primeiro dia de cada mês entre inicio e fim (inclusive), AAAA-MM-01. */
export function mesesEntre(inicio, fim) {
  const out = [];
  let a = Number(inicio.slice(0, 4)), m = Number(inicio.slice(5, 7));
  const fa = Number(fim.slice(0, 4)), fm = Number(fim.slice(5, 7));
  while (a < fa || (a === fa && m <= fm)) {
    out.push(`${a}-${String(m).padStart(2, '0')}-01`);
    m++; if (m > 12) { m = 1; a++; }
  }
  return out;
}

/** Texto oficial com espaços normalizados; null se vazio. */
export function limpar(t) {
  if (t == null) return null;
  const s = String(t).replace(/\s+/g, ' ').trim();
  return s || null;
}

/** "9:00" → "09:00"; null se não reconhecer. */
export function hora(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

/** Garante lista (o JSON do Senado devolve objeto quando há um só elemento). */
export const lista = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

/**
 * Categoria neutra da situação a partir do texto oficial. Texto não reconhecido → "não informado".
 * "não realizada" é mantida porque é o que a fonte do Senado diz ("Sessão não realizada").
 */
export function categoriaSituacao(oficial) {
  const s = (oficial || '').toLowerCase();
  if (!s) return 'não informado';
  if (s.includes('cancelad')) return 'cancelada';
  if (s.includes('não realizada') || s.includes('nao realizada')) return 'não realizada';
  if (s.includes('andamento')) return 'em andamento';
  if (s.includes('encerrad')) return 'encerrada';
  if (s.includes('agendad') || s.includes('convocad')) return 'agendada';
  return 'não informado';
}
