// Utilitários do coletor do TCM-PA: robots.txt lido antes de qualquer requisição (sem ele, nada é
// baixado), uma requisição por vez com pausa mínima, retentativas, gravação atômica que não reescreve
// arquivo sem mudança e extração de texto do PDF com Python isolado (-I) numa pasta temporária vazia.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
export const SAIDA = path.join(RAIZ, 'dados', 'tribunais-contas', 'tcm-pa');
export const ORGAO = 'Tribunal de Contas dos Municípios do Estado do Pará (TCM-PA)';
export const USER_AGENT = 'BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)';

// Único host acessado (site oficial do TCM-PA e o Diário Oficial Eletrônico em /doe/).
export const HOST = 'www.tcmpa.tc.br';
const PAUSA_MIN_MS = 1500;

export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

let ultimaRequisicao = 0;
let robots = null;

async function pausa() {
  const intervalo = Math.max(PAUSA_MIN_MS, (robots?.crawlDelayS || 0) * 1000);
  const falta = ultimaRequisicao + intervalo - Date.now();
  if (falta > 0) await dormir(falta);
  ultimaRequisicao = Date.now();
}

/**
 * Regras do robots.txt para o nosso agente: o grupo com o nome do coletor ou, na falta, "User-agent: *".
 * Também guarda a linha Content-Signal do grupo (registrada no meta.json).
 */
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
      if (!atual || atual.regras) { atual = { agentes: [], disallow: [], allow: [], crawlDelayS: null, sinal: null, regras: false }; grupos.push(atual); }
      atual.agentes.push(valor.toLowerCase());
    } else if (atual) {
      atual.regras = true;
      if (campo === 'disallow' && valor) atual.disallow.push(valor);
      else if (campo === 'allow' && valor) atual.allow.push(valor);
      else if (campo === 'crawl-delay' && Number(valor) > 0) atual.crawlDelayS = Number(valor);
      else if (campo === 'content-signal') atual.sinal = valor;
    }
  }
  const nosso = grupos.find((g) => g.agentes.some((a) => a !== '*' && 'brasilnalupa-coletor'.startsWith(a)));
  const g = nosso || grupos.find((x) => x.agentes.includes('*')) || { disallow: [], allow: [], crawlDelayS: null, sinal: null };
  return { disallow: g.disallow, allow: g.allow, crawlDelayS: g.crawlDelayS, sinal: g.sinal };
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
  if (!robots) throw Object.assign(new Error('robots.txt ainda não lido'), { definitivo: true });
  if (!caminhoPermitido(robots, u.pathname + u.search)) throw Object.assign(new Error(`caminho proibido pelo robots.txt: ${u.pathname}`), { definitivo: true });
}

/**
 * Primeira requisição da execução: o robots.txt. Se não puder ser lido (erro de rede, 4xx ou 5xx,
 * ou resposta que não é texto), a coleta para: robots inacessível vale como bloqueio total.
 */
export async function carregarRobots() {
  await pausa();
  estatisticas.requisicoes++;
  const res = await fetch(`https://${HOST}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60000) });
  const tipo = res.headers.get('content-type') || '';
  if (!res.ok || !/text\/plain/i.test(tipo)) {
    await res.body?.cancel().catch(() => {});
    throw Object.assign(new Error(`robots.txt inacessível (HTTP ${res.status}, ${tipo || 'sem tipo'}); tratado como bloqueio total, nada coletado`), { bloqueio: true });
  }
  const texto = await res.text();
  robots = { ...lerRobots(texto), status: res.status };
  return robots;
}

function pareceBloqueio(inicio) {
  return /captcha|challenge|cf-chl|just a moment|recaptcha|acesso negado/i.test(inicio);
}

/** GET com pausa, até 4 tentativas. esperado: regex do Content-Type aceito. Retorna a Response aberta. */
export async function abrir(url, { timeoutMs = 180000, esperado = null } = {}) {
  conferirUrl(url);
  for (let t = 1; t <= 4; t++) {
    await pausa();
    estatisticas.requisicoes++;
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
      conferirUrl(res.url || url);
    } catch (e) {
      if (e.definitivo || t === 4) { estatisticas.falhas.push(`${url}: ${e.message}`); throw e; }
      estatisticas.retentativas++;
      await dormir(4000 * t);
      continue;
    }
    if (res.ok) {
      const tipo = res.headers.get('content-type') || '';
      if (esperado && !esperado.test(tipo)) {
        const inicio = (await res.text()).slice(0, 4000);
        const motivo = pareceBloqueio(inicio) ? 'possível desafio anti-robô/CAPTCHA' : `tipo inesperado ${tipo}`;
        const e = Object.assign(new Error(`${motivo} em ${url}; coleta interrompida sem contornar`), { definitivo: true, bloqueio: pareceBloqueio(inicio) });
        estatisticas.falhas.push(e.message);
        throw e;
      }
      return res;
    }
    const corpo = (await res.text().catch(() => '')).slice(0, 4000);
    if (res.status === 403 || res.status === 429 && t === 4 || pareceBloqueio(corpo)) {
      const e = Object.assign(new Error(`HTTP ${res.status} em ${url}${pareceBloqueio(corpo) ? ' (desafio anti-robô)' : ''}; coleta interrompida sem contornar`), { definitivo: true, bloqueio: true });
      estatisticas.falhas.push(e.message);
      throw e;
    }
    if (![408, 429, 500, 502, 503, 504].includes(res.status) || t === 4) {
      const e = Object.assign(new Error(`HTTP ${res.status} em ${url}`), { definitivo: true, status: res.status });
      estatisticas.falhas.push(e.message);
      throw e;
    }
    estatisticas.retentativas++;
    const ra = Number(res.headers.get('retry-after'));
    await dormir(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 120) * 1000 : 6000 * t);
  }
  throw new Error(`falha em ${url}`);
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

/** Normaliza para comparação exata (sem acento, maiúsculas, espaços simples). */
export function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Python com pdfplumber/pypdfium2: TCMPA_PYTHON, .venv local, .venv do TCE-SP/ALESP, ou o do sistema. */
export function acharPython() {
  if (process.env.TCMPA_PYTHON) return process.env.TCMPA_PYTHON;
  const pastas = [AQUI, path.join(AQUI, '..', 'tce-sp'), path.join(RAIZ, 'scripts', 'coleta', 'alesp')];
  const cands = pastas.flatMap((d) => [path.join(d, '.venv', 'Scripts', 'python.exe'), path.join(d, '.venv', 'bin', 'python')]);
  for (const c of cands) if (fs.existsSync(c)) return c;
  return process.platform === 'win32' ? 'python' : 'python3';
}

export function temLeitorPdf() {
  try {
    execFileSync(acharPython(), ['-I', '-c', 'import pypdfium2'], { stdio: 'ignore', timeout: 60000, windowsHide: true });
    return true;
  } catch { return false; }
}

/** Texto de cada página do PDF (colunas lidas em ordem). Retorna { paginas: string[], total_paginas }. */
export function textoDoPdf(buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcmpa-pdf-'));
  try {
    const arq = path.join(dir, 'documento.pdf');
    fs.writeFileSync(arq, buf);
    const out = execFileSync(acharPython(), ['-I', path.join(AQUI, 'extrair_pdf.py'), arq], {
      cwd: dir, timeout: 300000, maxBuffer: 256 * 1024 * 1024, windowsHide: true,
    });
    return JSON.parse(out.toString('utf8'));
  } finally {
    // No Windows a pasta às vezes fica presa por um instante; a falha ao apagar não invalida o texto lido.
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* pasta temporária fica para o sistema limpar */ }
  }
}
