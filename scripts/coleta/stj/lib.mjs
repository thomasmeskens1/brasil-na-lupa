// Utilitários do coletor do STJ: HTTP com no máximo 2 requisições simultâneas e retentativas,
// cache local de arquivos do Portal de Dados Abertos (por recurso + data de modificação),
// leitura de CSV, leitura de ZIP (sem dependências), gravação atômica que não reescreve sem mudança.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const USER_AGENT =
  'voto-em-quem-coletor/1.0 (coleta automatica de dados abertos para site neutro de acompanhamento politico; Node.js)';

const MAX_PARALELO = 2;
let ativos = 0;
const fila = [];
export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, cache: 0, falhas: [] };

async function vaga() {
  if (ativos < MAX_PARALELO) { ativos++; return; }
  await new Promise((r) => fila.push(r));
  ativos++;
}
function liberar() { ativos--; const r = fila.shift(); if (r) r(); }
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET com no máximo 2 requisições simultâneas (no processo inteiro), até 6 tentativas,
 * espera crescente (2 s, 4 s, 8 s…) e respeito a Retry-After em 429/503.
 * tipo: 'json' | 'text' (UTF-8) | 'latin1' | 'buffer'. Retorna null em 404 quando opcional=true.
 * Não insiste em 403 (barreira anti-robô): falha na hora, sem contornar.
 */
export async function obter(url, { tipo = 'json', timeoutMs = 120000, opcional = false } = {}) {
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
      if ((res.status === 404 || res.status === 403) && opcional) return null;
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        estatisticas.bytes += buf.length;
        return decodificar(buf, tipo);
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

function decodificar(buf, tipo) {
  if (tipo === 'buffer') return buf;
  if (tipo === 'latin1') return buf.toString('latin1');
  const texto = buf.toString('utf8').replace(/^﻿/, '');
  return tipo === 'json' ? JSON.parse(texto) : texto;
}

/**
 * Baixa um recurso do CKAN usando cache local em <dirCache>, chaveado pelo id do recurso e pela
 * data de modificação informada pelo próprio portal. Arquivos que não mudaram não são baixados de novo.
 */
export async function obterRecurso(recurso, dirCache, { tipo = 'json' } = {}) {
  const marca = String(recurso.last_modified || recurso.metadata_modified || recurso.created || 'sem-data').replace(/[^0-9]/g, '');
  const ext = path.extname(new URL(recurso.url).pathname) || '.bin';
  const arq = path.join(dirCache, `${recurso.id}-${marca}${ext}`);
  let buf = null;
  try { buf = fs.readFileSync(arq); estatisticas.cache++; } catch { /* sem cache */ }
  if (!buf) {
    buf = await obter(recurso.url, { tipo: 'buffer', timeoutMs: 300000 });
    fs.mkdirSync(dirCache, { recursive: true });
    for (const velho of fs.readdirSync(dirCache)) if (velho.startsWith(`${recurso.id}-`)) fs.rmSync(path.join(dirCache, velho), { force: true });
    const tmp = `${arq}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, arq);
  }
  if (ext === '.gz' && tipo !== 'buffer') buf = zlib.gunzipSync(buf);
  return decodificar(buf, tipo);
}

/** CSV com separador ',' (Temas.csv, Processos.csv), aspas duplas, quebras de linha dentro de campos. */
export function lerCsv(texto, sep = ',') {
  const linhas = [];
  let linha = [], campo = '', aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  const cab = linhas.shift() || [];
  return linhas.filter((l) => l.length > 1).map((l) => Object.fromEntries(cab.map((k, i) => [k, l[i] ?? ''])));
}

/** Lê um ZIP comum (sem ZIP64) e devolve Map nome → Buffer. Só métodos 0 (guardado) e 8 (deflate). */
export function lerZip(buf) {
  const saida = new Map();
  let fim = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error('ZIP sem diretório central');
  const total = buf.readUInt16LE(fim + 10);
  let p = buf.readUInt32LE(fim + 16);
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP: entrada inválida');
    const metodo = buf.readUInt16LE(p + 10);
    const tamComp = buf.readUInt32LE(p + 20);
    const lenNome = buf.readUInt16LE(p + 28), lenExtra = buf.readUInt16LE(p + 30), lenCom = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nome = buf.subarray(p + 46, p + 46 + lenNome).toString('utf8');
    const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const dados = buf.subarray(ini, ini + tamComp);
    if (metodo === 0) saida.set(nome, Buffer.from(dados));
    else if (metodo === 8) saida.set(nome, zlib.inflateRawSync(dados));
    p += 46 + lenNome + lenExtra + lenCom;
  }
  return saida;
}

const ENTIDADES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', ordf: 'ª', sect: '§', deg: '°' };
/** HTML → texto simples (uma linha por bloco), com entidades decodificadas. */
export function htmlParaTexto(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d|\/span)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { const c = parseInt(h, 16); return c >= 0xe000 && c <= 0xf8ff ? ' ' : String.fromCodePoint(c); })
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, e) => {
      if (ENTIDADES[e.toLowerCase()]) return ENTIDADES[e.toLowerCase()];
      const t = { aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', atilde: 'ã', otilde: 'õ', acirc: 'â', ecirc: 'ê', ocirc: 'ô', ccedil: 'ç', agrave: 'à', uuml: 'ü' };
      const base = t[e.toLowerCase()];
      if (!base) return m;
      return e[0] === e[0].toUpperCase() ? base.toUpperCase() : base;
    })
    .split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join('\n');
}

/** Espaços e quebras de linha normalizados (para buscas literais no texto oficial). */
export const normalizarEspacos = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** JSON legível; elementos das listas grandes ficam um por linha. */
const COMPACTAS = new Set(['itens', 'processos', 'assuntos', 'pautas']);
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
const VOLATEIS = new Set(['atualizado_em', 'acessado_em', 'verificado_em']);
function semVolateis(o) {
  return JSON.stringify(o, (k, v) => (VOLATEIS.has(k) ? undefined : v));
}

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

export function hojeISO() {
  // Data no fuso de Brasília (UTC-3), formato AAAA-MM-DD.
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
export function somarDias(iso, dias) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10);
}
/** 'dd/mm/aaaa' → 'aaaa-mm-dd'; 'aaaammdd' → 'aaaa-mm-dd'; outros → null. */
export function dataISO(s) {
  if (!s) return null;
  let m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = String(s).trim().match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
