// Utilitários do coletor do TCE-PR: robots.txt lido antes de qualquer requisição, uma requisição por vez
// com pausa mínima de 1 s, retentativas, download em streaming (sem guardar o CSV), gravação atômica que
// não reescreve arquivo sem mudança e extração de texto de PDF com Python isolado.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
export const SAIDA = path.join(RAIZ, 'dados', 'tribunais-contas', 'tce-pr');
export const ORGAO = 'Tribunal de Contas do Estado do Paraná (TCE-PR)';
export const USER_AGENT = 'BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)';

// Único host acessado. robots.txt lido em 05/11/2026: "User-agent: *" / "Disallow:" (vazio, libera tudo).
export const HOST = 'viajuris.tce.pr.gov.br';
const PAUSA_MIN_MS = 1000;

export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

let ultimaRequisicao = 0;
let robots = null; // { disallow: string[], crawlDelayS: number|null, texto }

async function pausa() {
  const intervalo = Math.max(PAUSA_MIN_MS, (robots?.crawlDelayS || 0) * 1000);
  const falta = ultimaRequisicao + intervalo - Date.now();
  if (falta > 0) await dormir(falta);
  ultimaRequisicao = Date.now();
}

/** Lê as regras do grupo "User-agent: *" (ou do nosso agente) de um robots.txt. */
export function lerRobots(texto) {
  const grupos = [];
  let atual = null;
  for (const bruta of String(texto).split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, '').trim();
    const m = linha.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const campo = m[1].toLowerCase();
    const valor = m[2].trim();
    if (campo === 'user-agent') {
      if (!atual || atual.regras) { atual = { agentes: [], disallow: [], allow: [], crawlDelayS: null, regras: false }; grupos.push(atual); }
      atual.agentes.push(valor.toLowerCase());
    } else if (atual) {
      atual.regras = true;
      if (campo === 'disallow' && valor) atual.disallow.push(valor);
      else if (campo === 'allow' && valor) atual.allow.push(valor);
      else if (campo === 'crawl-delay' && Number(valor) > 0) atual.crawlDelayS = Number(valor);
    }
  }
  const nosso = grupos.find((g) => g.agentes.some((a) => a !== '*' && 'brasilnalupa-coletor'.startsWith(a)));
  const g = nosso || grupos.find((x) => x.agentes.includes('*')) || { disallow: [], allow: [], crawlDelayS: null };
  return { disallow: g.disallow, allow: g.allow, crawlDelayS: g.crawlDelayS };
}

/** true se o caminho (com query) é permitido pelas regras (Allow mais longo vence). */
export function caminhoPermitido(regras, caminho) {
  const casa = (p) => caminho.startsWith(p.replace(/\*.*$/, '').replace(/\$$/, ''));
  const d = Math.max(-1, ...regras.disallow.filter(casa).map((p) => p.length));
  const a = Math.max(-1, ...(regras.allow || []).filter(casa).map((p) => p.length));
  return d < 0 || a >= d;
}

function conferirUrl(url) {
  const u = new URL(url);
  if (u.hostname !== HOST || u.protocol !== 'https:') throw Object.assign(new Error(`host fora da lista do coletor: ${u.hostname}`), { definitivo: true });
  if (!robots) throw new Error('robots.txt ainda não lido');
  if (!caminhoPermitido(robots, u.pathname + u.search)) throw Object.assign(new Error(`caminho proibido pelo robots.txt: ${u.pathname}`), { definitivo: true });
}

/** Primeira requisição da execução: o robots.txt do host. Sem ele (erro de rede), o coletor não segue. */
export async function carregarRobots() {
  await pausa();
  estatisticas.requisicoes++;
  const res = await fetch(`https://${HOST}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60000) });
  const texto = res.ok ? await res.text() : '';
  if (res.status >= 500) throw new Error(`robots.txt indisponível (HTTP ${res.status}); coleta suspensa`);
  robots = { ...lerRobots(texto), status: res.status, texto: texto.slice(0, 2000) };
  return robots;
}

function bloqueio(res, inicio) {
  // Desafio anti-bot, CAPTCHA ou login: parar e registrar, nunca contornar.
  const tipo = res.headers.get('content-type') || '';
  if (/text\/html/i.test(tipo) && /captcha|challenge|cf-chl|recaptcha|Login/i.test(inicio)) return true;
  return false;
}

/**
 * GET com pausa ≥ 1 s, até 4 tentativas. Retorna a Response aberta (corpo ainda não lido).
 * sinal: AbortSignal opcional (orçamento de tempo).
 */
export async function abrir(url, { timeoutMs = 300000, sinal = null, esperado = null } = {}) {
  conferirUrl(url);
  for (let t = 1; t <= 4; t++) {
    await pausa();
    estatisticas.requisicoes++;
    let res;
    try {
      const sinais = [AbortSignal.timeout(timeoutMs), sinal].filter(Boolean);
      res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' }, signal: AbortSignal.any(sinais), redirect: 'follow' });
      conferirUrl(res.url || url);
    } catch (e) {
      if (e.definitivo || sinal?.aborted || t === 4) { estatisticas.falhas.push(`${url}: ${e.message}`); throw e; }
      estatisticas.retentativas++;
      await dormir(3000 * t);
      continue;
    }
    if (res.ok) {
      const tipo = res.headers.get('content-type') || '';
      if (esperado && !esperado.test(tipo)) {
        const inicio = (await res.text()).slice(0, 4000);
        const motivo = bloqueio(res, inicio) ? 'possível desafio anti-bot/CAPTCHA/login' : `tipo inesperado ${tipo}`;
        const e = Object.assign(new Error(`${motivo} em ${url}; coleta interrompida sem contornar`), { definitivo: true, bloqueio: true });
        estatisticas.falhas.push(e.message);
        throw e;
      }
      return res;
    }
    await res.body?.cancel().catch(() => {});
    if (![408, 429, 500, 502, 503, 504].includes(res.status) || t === 4) {
      const e = Object.assign(new Error(`HTTP ${res.status} em ${url}`), { definitivo: true, status: res.status });
      estatisticas.falhas.push(e.message);
      throw e;
    }
    estatisticas.retentativas++;
    const ra = Number(res.headers.get('retry-after'));
    await dormir(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 120) * 1000 : 5000 * t);
  }
  throw new Error(`falha em ${url}`);
}

/** Lê o corpo como texto UTF-8 em pedaços, entregando cada pedaço a aoPedaco (streaming). Retorna sha256 e bytes. */
export async function lerEmStreaming(res, aoPedaco) {
  const hash = crypto.createHash('sha256');
  const dec = new TextDecoder('utf-8');
  let bytes = 0;
  for await (const pedaco of res.body) {
    hash.update(pedaco);
    bytes += pedaco.length;
    aoPedaco(dec.decode(pedaco, { stream: true }));
  }
  aoPedaco(dec.decode());
  estatisticas.bytes += bytes;
  return { sha256: hash.digest('hex'), bytes };
}

export async function lerBinario(res, limiteBytes) {
  const partes = [];
  let total = 0;
  for await (const p of res.body) {
    total += p.length;
    if (total > limiteBytes) throw new Error(`arquivo maior que ${Math.round(limiteBytes / 1e6)} MB`);
    partes.push(p);
  }
  estatisticas.bytes += total;
  return Buffer.concat(partes);
}

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

// Campos que mudam a cada execução e não contam como mudança de conteúdo.
const VOLATEIS = new Set(['atualizado_em', 'acessado_em', 'ultima_execucao', 'coletado_em', 'duracao_s', 'estatisticas_http']);
const semVolateis = (o) => JSON.stringify(o, (k, v) => (VOLATEIS.has(k) ? undefined : v));

export const contagemGravacao = { gravados: [], inalterados: [] };

/** Grava atomicamente (temporário + rename) só se o conteúdo, sem campos voláteis, mudou. */
export function gravarSeMudou(arquivo, obj) {
  const antigo = lerJson(arquivo);
  const rel = path.relative(RAIZ, arquivo).replace(/\\/g, '/');
  if (antigo && semVolateis(antigo) === semVolateis(obj)) { contagemGravacao.inalterados.push(rel); return false; }
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1) + '\n', 'utf8');
  fs.renameSync(tmp, arquivo);
  contagemGravacao.gravados.push(rel);
  return true;
}

/** Data no fuso de Brasília (UTC-3). */
export const hojeISO = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

export function fonte(titulo, url, acessado_em = hojeISO()) {
  return { titulo, url, orgao: ORGAO, acessado_em };
}

/** 'DD/MM/AAAA[ HH:MM:SS]' → 'AAAA-MM-DD' (null se não casar). */
export function dataISO(s) {
  const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Normaliza para comparação exata (sem acento, maiúsculas, espaços simples). */
export function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Python com pdfplumber: TCEPR_PYTHON, .venv local, .venv do TCE-SP, ou o do sistema. */
export function acharPython() {
  if (process.env.TCEPR_PYTHON) return process.env.TCEPR_PYTHON;
  const cands = [AQUI, path.join(AQUI, '..', 'tce-sp')].flatMap((d) => [path.join(d, '.venv', 'Scripts', 'python.exe'), path.join(d, '.venv', 'bin', 'python')]);
  for (const c of cands) if (fs.existsSync(c)) return c;
  return process.platform === 'win32' ? 'python' : 'python3';
}

export function temPdfplumber() {
  try {
    execFileSync(acharPython(), ['-I', '-c', 'import pdfplumber'], { stdio: 'ignore', timeout: 60000, windowsHide: true });
    return true;
  } catch { return false; }
}

/**
 * Texto das últimas páginas de um PDF (onde fica a deliberação), com pdfplumber. O PDF é gravado numa
 * pasta temporária nova e vazia e o Python roda isolado (-I) nela. Retorna { texto, paginas_lidas, total_paginas, legivel }.
 */
export function textoFinalDoPdf(buf, maxPaginas = 8) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcepr-pdf-'));
  try {
    const arq = path.join(dir, 'documento.pdf');
    fs.writeFileSync(arq, buf);
    const out = execFileSync(acharPython(), ['-I', path.join(AQUI, 'extrair_pdf.py'), arq, String(maxPaginas)], {
      cwd: dir, timeout: 180000, maxBuffer: 64 * 1024 * 1024, windowsHide: true,
    });
    return JSON.parse(out.toString('utf8'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
