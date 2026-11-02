// Utilitários do coletor do TCE-SP: HTTP com no máximo 2 requisições simultâneas, retentativas,
// bloqueio de hosts proibidos pelo robots.txt, gravação atômica que não reescreve arquivo sem mudança,
// leitura de ZIP (sem dependências) e extração de texto de PDF com Python isolado.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
export const SAIDA = path.join(RAIZ, 'dados', 'tribunais-contas', 'tce-sp');

export const USER_AGENT =
  'voto-em-quem-coletor/1.0 (coleta automatica de dados abertos para site neutro de acompanhamento politico; Node.js)';

// Hosts que o robots.txt proíbe (www10: "Disallow: /"; doe: "/pdf/") ou que recusam acesso (www2: 403).
// O coletor nunca os acessa: o que estiver lá entra só por curadoria humana.
const HOSTS_PROIBIDOS = new Set(['www10.tce.sp.gov.br', 'www2.tce.sp.gov.br', 'doe.tce.sp.gov.br']);
const HOSTS_PERMITIDOS = new Set(['www.tce.sp.gov.br', 'transparencia.tce.sp.gov.br']);

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

function conferirHost(url) {
  const h = new URL(url).hostname;
  if (HOSTS_PROIBIDOS.has(h)) throw Object.assign(new Error(`host proibido pelo robots.txt: ${h}`), { definitivo: true });
  if (!HOSTS_PERMITIDOS.has(h)) throw Object.assign(new Error(`host fora da lista do coletor: ${h}`), { definitivo: true });
}

/**
 * GET com no máximo 2 requisições simultâneas, até 5 tentativas com espera crescente e Retry-After.
 * tipo: 'text' | 'bin'. Retorna { corpo, cabecalhos, url } ou null em 404 quando opcional=true.
 */
export async function obter(url, { tipo = 'text', timeoutMs = 120000, opcional = false } = {}) {
  conferirHost(url);
  const maxTentativas = 5;
  for (let t = 1; t <= maxTentativas; t++) {
    await vaga();
    let espera = 0;
    try {
      estatisticas.requisicoes++;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      conferirHost(res.url || url);
      if (res.status === 404 && opcional) return null;
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        estatisticas.bytes += buf.length;
        const cabecalhos = Object.fromEntries(res.headers.entries());
        return { corpo: tipo === 'bin' ? buf : buf.toString('utf8').replace(/^﻿/, ''), cabecalhos, url: res.url || url };
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

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

// Campos que mudam a cada execução e não contam como mudança de conteúdo.
const VOLATEIS = new Set(['atualizado_em', 'acessado_em', 'ultima_execucao', 'coletado_em', 'duracao_s', 'estatisticas_http']);
function semVolateis(o) {
  return JSON.stringify(o, (k, v) => (VOLATEIS.has(k) ? undefined : v));
}

export const contagemGravacao = { gravados: [], inalterados: [] };

/** Grava atomicamente (temporário + rename) só se o conteúdo, sem campos voláteis, mudou. */
export function gravarSeMudou(arquivo, obj) {
  const antigo = lerJson(arquivo);
  const rel = path.relative(RAIZ, arquivo).replace(/\\/g, '/');
  if (antigo && semVolateis(antigo) === semVolateis(obj)) { contagemGravacao.inalterados.push(rel); return false; }
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, arquivo);
  contagemGravacao.gravados.push(rel);
  return true;
}

export function hojeISO() {
  // Data no fuso de Brasília (UTC-3).
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

export function fonte(titulo, url, acessado_em = hojeISO()) {
  return { titulo, url, orgao: 'Tribunal de Contas do Estado de São Paulo (TCE-SP)', acessado_em };
}

/** 'DD/MM/AAAA' ou 'DD-MM-AAAA' → 'AAAA-MM-DD' (null se não casar). */
export function dataISO(s) {
  const m = String(s || '').match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Lê as entradas de um arquivo ZIP (métodos 0 e 8) a partir do diretório central. */
export function lerZip(buf) {
  let fim = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error('ZIP inválido: diretório central não encontrado');
  const total = buf.readUInt16LE(fim + 10);
  let p = buf.readUInt32LE(fim + 16);
  const entradas = [];
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP inválido: entrada central');
    const metodo = buf.readUInt16LE(p + 10);
    const tamComp = buf.readUInt32LE(p + 20);
    const lenNome = buf.readUInt16LE(p + 28), lenExtra = buf.readUInt16LE(p + 30), lenCom = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nome = buf.subarray(p + 46, p + 46 + lenNome).toString('utf8');
    const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const dados = buf.subarray(ini, ini + tamComp);
    if (metodo !== 0 && metodo !== 8) throw new Error(`ZIP: método ${metodo} não suportado`);
    entradas.push({ nome, conteudo: metodo === 8 ? zlib.inflateRawSync(dados) : Buffer.from(dados) });
    p += 46 + lenNome + lenExtra + lenCom;
  }
  return entradas;
}

/** Python do venv local (scripts/coleta/tribunais-contas/tce-sp/.venv), ou TCESP_PYTHON, ou o do sistema. */
export function acharPython() {
  if (process.env.TCESP_PYTHON) return process.env.TCESP_PYTHON;
  for (const c of [path.join(AQUI, '.venv', 'Scripts', 'python.exe'), path.join(AQUI, '.venv', 'bin', 'python')]) {
    if (fs.existsSync(c)) return c;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

export function conferirPython() {
  execFileSync(acharPython(), ['-I', '-c', 'import pdfplumber'], { stdio: 'ignore', timeout: 60000, windowsHide: true });
}

/**
 * Extrai o texto de um PDF (Buffer) com pdfplumber. O PDF é gravado numa pasta temporária nova e vazia,
 * e o Python roda em modo isolado (-I) com essa pasta como diretório atual. Retorna { paginas, legivel }.
 */
export function textoDoPdf(buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcesp-pdf-'));
  try {
    const arq = path.join(dir, 'documento.pdf');
    fs.writeFileSync(arq, buf);
    const out = execFileSync(acharPython(), ['-I', path.join(AQUI, 'extrair_pdf.py'), arq], {
      cwd: dir, timeout: 300000, maxBuffer: 256 * 1024 * 1024, windowsHide: true,
    });
    return JSON.parse(out.toString('utf8'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Normaliza para comparação (sem acento, maiúsculas, espaços simples). */
export function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

const ENTIDADES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', ordm: 'º', ordf: 'ª' };
export function decodificarEntidades(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return e in ENTIDADES ? ENTIDADES[e] : m;
  });
}
