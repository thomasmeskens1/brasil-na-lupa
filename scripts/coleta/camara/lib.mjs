// Utilitários do coletor da Câmara: HTTP com limite de paralelismo e retentativas,
// leitura de CSV dos arquivos em massa, gravação atômica que não reescreve arquivos sem mudança.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

export const USER_AGENT =
  'BrasilNaLupa-coletor/1.0 (coleta automatica de dados abertos para site neutro de acompanhamento politico; Node.js)';

const MAX_PARALELO = 4;
let ativos = 0;
const fila = [];
export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };

async function vaga() {
  if (ativos < MAX_PARALELO) { ativos++; return; }
  await new Promise((r) => fila.push(r));
  ativos++;
}
function liberar() { ativos--; const r = fila.shift(); if (r) r(); }
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET com no máximo 4 requisições simultâneas (no processo inteiro), até 6 tentativas,
 * espera crescente (2 s, 4 s, 8 s…) e respeito ao cabeçalho Retry-After em 429/503.
 * tipo: 'json' | 'text'. Retorna null em 404 quando opcional=true.
 */
export async function obter(url, { tipo = 'json', timeoutMs = 60000, opcional = false } = {}) {
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

/**
 * Download binário condicional (If-None-Match / If-Modified-Since), com o mesmo limite de
 * paralelismo e as mesmas retentativas de obter(). `anterior` = { etag, last_modified } guardado
 * em meta.json. Retorna { naoMudou: true } em 304 ou { buf, etag, last_modified, sha256 }.
 */
export async function obterArquivo(url, { anterior = null, timeoutMs = 300000 } = {}) {
  const maxTentativas = 6;
  for (let t = 1; t <= maxTentativas; t++) {
    await vaga();
    let espera = 0;
    try {
      estatisticas.requisicoes++;
      const headers = { 'User-Agent': USER_AGENT, Accept: '*/*' };
      if (anterior?.etag) headers['If-None-Match'] = anterior.etag;
      if (anterior?.last_modified) headers['If-Modified-Since'] = anterior.last_modified;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
      if (res.status === 304) return { naoMudou: true };
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        estatisticas.bytes += buf.length;
        return {
          buf, etag: res.headers.get('etag') || null, last_modified: res.headers.get('last-modified') || null,
          sha256: crypto.createHash('sha256').update(buf).digest('hex'),
        };
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

/**
 * Leitor mínimo de ZIP (só Node): lê o diretório central e devolve [{ nome, dados: Buffer }].
 * Suporta os métodos 0 (armazenado) e 8 (deflate) e o registro ZIP64 de tamanhos/deslocamento.
 * zlib sozinho não lê o contêiner ZIP; aqui só a descompressão de cada entrada usa inflateRaw.
 */
export function lerZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP inválido: fim do diretório central não encontrado');
  let total = buf.readUInt16LE(eocd + 10);
  let cdOff = buf.readUInt32LE(eocd + 16);
  if (cdOff === 0xffffffff || total === 0xffff) {
    const loc = eocd - 20; // localizador ZIP64
    if (loc < 0 || buf.readUInt32LE(loc) !== 0x07064b50) throw new Error('ZIP64 sem localizador');
    const z64 = Number(buf.readBigUInt64LE(loc + 8));
    total = Number(buf.readBigUInt64LE(z64 + 32));
    cdOff = Number(buf.readBigUInt64LE(z64 + 48));
  }
  const saida = [];
  let p = cdOff;
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP inválido: entrada do diretório central');
    const metodo = buf.readUInt16LE(p + 10);
    let comp = buf.readUInt32LE(p + 20), tam = buf.readUInt32LE(p + 24);
    const lNome = buf.readUInt16LE(p + 28), lExtra = buf.readUInt16LE(p + 30), lCom = buf.readUInt16LE(p + 32);
    let local = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + lNome);
    // Campo extra ZIP64 (id 0x0001): tamanho, comprimido, deslocamento — só os que estão saturados.
    let e = p + 46 + lNome; const fimExtra = e + lExtra;
    while (e + 4 <= fimExtra) {
      const id = buf.readUInt16LE(e), len = buf.readUInt16LE(e + 2);
      if (id === 1) {
        let q = e + 4;
        if (tam === 0xffffffff) { tam = Number(buf.readBigUInt64LE(q)); q += 8; }
        if (comp === 0xffffffff) { comp = Number(buf.readBigUInt64LE(q)); q += 8; }
        if (local === 0xffffffff) { local = Number(buf.readBigUInt64LE(q)); }
      }
      e += 4 + len;
    }
    p = fimExtra + lCom;
    if (nome.endsWith('/')) continue;
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error(`ZIP inválido: cabeçalho local de ${nome}`);
    const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const bruto = buf.subarray(ini, ini + comp);
    let dados;
    if (metodo === 0) dados = Buffer.from(bruto);
    else if (metodo === 8) dados = zlib.inflateRawSync(bruto);
    else throw new Error(`ZIP: método de compressão ${metodo} não suportado (${nome})`);
    if (dados.length !== tam) throw new Error(`ZIP: tamanho inesperado em ${nome}`);
    saida.push({ nome, dados });
  }
  return saida;
}

/** Executa fn sobre cada item; o paralelismo real é controlado por obter(). */
export async function paraCada(itens, fn) {
  return Promise.all(itens.map((x, i) => fn(x, i)));
}

/** CSV dos arquivos em massa da Câmara: separador ';', aspas duplas, UTF-8 (BOM já removido). */
export function lerCsv(texto) {
  const linhas = [];
  let linha = [], campo = '', aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ';') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  const cab = linhas.shift() || [];
  return linhas.filter((l) => l.length > 1).map((l) => Object.fromEntries(cab.map((k, i) => [k, l[i] ?? ''])));
}

/**
 * Igual a lerCsv, mas sem montar objetos: chama fn(campos, indice) para cada linha de dados,
 * onde indice[nomeDaColuna] = posição. Usa bem menos memória nos arquivos grandes (CEAP ≈ 75 MB).
 */
export function percorrerCsv(texto, fn) {
  const n = texto.length;
  let pos = 0, indice = null;
  while (pos < n) {
    const campos = [];
    for (;;) {
      let valor;
      if (texto.charCodeAt(pos) === 34) { // aspas
        let ini = pos + 1, partes = '';
        for (;;) {
          const q = texto.indexOf('"', ini);
          if (q < 0) { partes += texto.slice(ini); pos = n; break; }
          if (texto.charCodeAt(q + 1) === 34) { partes += texto.slice(ini, q + 1); ini = q + 2; continue; }
          partes += texto.slice(ini, q); pos = q + 1; break;
        }
        valor = partes;
      } else {
        let fim = pos;
        while (fim < n) { const c = texto.charCodeAt(fim); if (c === 59 || c === 10 || c === 13) break; fim++; }
        valor = texto.slice(pos, fim); pos = fim;
      }
      campos.push(valor);
      const c = texto.charCodeAt(pos);
      if (c === 59) { pos++; continue; }
      if (c === 13) pos++;
      if (texto.charCodeAt(pos) === 10) pos++;
      break;
    }
    if (!indice) { indice = Object.fromEntries(campos.map((k, i) => [k, i])); continue; }
    if (campos.length > 1) fn(campos, indice);
  }
  return indice;
}

export function sha256(texto) {
  return crypto.createHash('sha256').update(texto).digest('hex');
}

/** JSON legível; elementos das listas grandes (votos, orientacoes, itens) ficam um por linha. */
const COMPACTAS = new Set(['votos', 'orientacoes', 'itens', 'proposicoes', 'documentos', 'registros', 'por_mes', 'por_tipo']);
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
  return JSON.stringify(o, (k, v) => (k === 'atualizado_em' || k === 'acessado_em' ? undefined : v));
}

export const contagemGravacao = { gravados: 0, inalterados: 0 };

/**
 * Grava atomicamente (arquivo temporário + rename). Se o conteúdo, ignorando
 * atualizado_em/acessado_em, for igual ao arquivo existente, não reescreve.
 * Retorna true se gravou.
 */
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
