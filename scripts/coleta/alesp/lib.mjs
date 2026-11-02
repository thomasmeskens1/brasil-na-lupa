// Utilitários do coletor ALESP / Governo de SP: HTTP com no máximo 2 requisições simultâneas,
// retentativas, gravação atômica que não reescreve arquivos sem mudança, texto a partir de HTML.
import fs from 'node:fs';
import path from 'node:path';

export const USER_AGENT =
  'voto-em-quem-coletor/1.0 (coleta automatica de dados abertos para site neutro de acompanhamento politico; Node.js)';

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
 * espera crescente e respeito a Retry-After. tipo: 'json' | 'text' | 'bin' (Buffer).
 * Retorna null em 404 quando opcional=true.
 */
export async function obter(url, { tipo = 'json', timeoutMs = 90000, opcional = false } = {}) {
  const maxTentativas = 5;
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
        if (tipo === 'bin') {
          const b = Buffer.from(await res.arrayBuffer());
          estatisticas.bytes += b.length;
          return b;
        }
        const texto = (await res.text()).replace(/^﻿/, '');
        estatisticas.bytes += texto.length;
        return tipo === 'json' ? JSON.parse(texto) : texto;
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

/** Executa fn sobre cada item; o paralelismo real é limitado por obter(). */
export async function paraCada(itens, fn) {
  return Promise.all(itens.map((x, i) => fn(x, i)));
}

/** JSON legível; elementos das listas grandes ficam um por linha. */
const COMPACTAS = new Set(['votos', 'itens', 'autores', 'linhas']);
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

export function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

// Campos que mudam a cada execução e não contam como mudança de conteúdo.
function semVolateis(o) {
  return JSON.stringify(o, (k, v) => (k === 'atualizado_em' || k === 'acessado_em' || k === 'ultima_execucao' ? undefined : v));
}

export const contagemGravacao = { gravados: 0, inalterados: 0 };

/** Grava atomicamente (temporário + rename) só se o conteúdo (sem campos voláteis) mudou. */
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

export function hojeISO() {
  // Data no fuso de Brasília (UTC-3), formato AAAA-MM-DD.
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
export function somarDias(iso, dias) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10);
}
export function diasEntre(ini, fim) {
  const r = [];
  for (let d = ini; d <= fim; d = somarDias(d, 1)) r.push(d);
  return r;
}

/** Normaliza nome para comparação exata (sem acento, maiúsculas, espaços simples). */
export function normalizarNome(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

const ENTIDADES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', ordf: 'ª', deg: '°', sect: '§',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  middot: '·', para: '¶', sup1: '¹', sup2: '²', sup3: '³', frac12: '½', frac14: '¼', frac34: '¾', bull: '•',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í',
  Oacute: 'Ó', Uacute: 'Ú', agrave: 'à', Agrave: 'À', egrave: 'è', ograve: 'ò', acirc: 'â', ecirc: 'ê',
  icirc: 'î', ocirc: 'ô', ucirc: 'û', Acirc: 'Â', Ecirc: 'Ê', Ocirc: 'Ô', atilde: 'ã', otilde: 'õ',
  Atilde: 'Ã', Otilde: 'Õ', ccedil: 'ç', Ccedil: 'Ç', uuml: 'ü', Uuml: 'Ü', auml: 'ä', ouml: 'ö', ntilde: 'ñ',
  Ntilde: 'Ñ', times: '×', divide: '÷', plusmn: '±', shy: '', zwnj: '', euro: '€', copy: '©', reg: '®',
};
export function decodificarEntidades(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return e in ENTIDADES ? ENTIDADES[e] : m;
  });
}

/** Converte o HTML do DOE em linhas de texto (sem comentários, estilos e marcações). */
export function htmlParaLinhas(html) {
  const t = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script|xml)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d|table)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  return decodificarEntidades(t).split('\n').map((x) => x.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean);
}
