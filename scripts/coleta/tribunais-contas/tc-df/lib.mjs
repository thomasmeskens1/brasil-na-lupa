// Utilitários do coletor do TC-DF: HTTP sequencial (uma requisição por vez, pausa mínima entre elas), leitura do
// robots.txt antes de qualquer outra requisição, download de PDF para pasta temporária (nunca para o repositório),
// extração de texto com pdftotext (poppler) e gravação atômica que não reescreve arquivo sem mudança de conteúdo.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { get } from './https.mjs';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
export const SAIDA = path.join(RAIZ, 'dados', 'tribunais-contas', 'tc-df');

export const USER_AGENT = 'BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)';
export const ORGAO = 'Tribunal de Contas do Distrito Federal (TCDF)';
export const HOST = 'www2.tc.df.gov.br';
const PAUSA_MS = 2000;
const LIMITE_PDF = 120e6; // o maior RAPP publicado tem ~74 MB

export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Orçamento de tempo (COLETA_ORCAMENTO_MIN) ---------- */

const INICIO = Date.now();
const ORCAMENTO_MS = (() => {
  const v = Number(process.env.COLETA_ORCAMENTO_MIN);
  return Number.isFinite(v) && v > 0 ? v * 60000 : Infinity;
})();
export const restanteMs = () => ORCAMENTO_MS - (Date.now() - INICIO);

/* ---------- robots.txt ---------- */

let robots = null; // { status, regras, crawlDelayS }

/** Regras para "User-agent: *" e para o nosso agente; também o Crawl-delay. */
export function interpretarRobots(texto) {
  const regras = [];
  let crawlDelayS = null;
  let aplica = false;
  let emGrupo = false;
  for (const bruta of String(texto).split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, '').trim();
    const m = linha.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const campo = m[1].toLowerCase();
    const valor = m[2].trim();
    if (campo === 'user-agent') {
      if (!emGrupo) aplica = false;
      emGrupo = true;
      const ua = valor.toLowerCase();
      if (ua === '*' || ua.startsWith('brasilnalupa')) aplica = true;
    } else {
      emGrupo = false;
      if (!aplica) continue;
      if ((campo === 'disallow' || campo === 'allow') && valor) regras.push({ tipo: campo, caminho: valor });
      if (campo === 'crawl-delay' && Number(valor) > 0) crawlDelayS = Math.max(crawlDelayS ?? 0, Number(valor));
    }
  }
  return { regras, crawlDelayS };
}

/** true se o caminho é permitido (regra mais longa vence; empate favorece allow). */
export function caminhoPermitido(regras, caminho) {
  let melhor = null;
  for (const r of regras) {
    const re = new RegExp('^' + r.caminho.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(caminho) && (!melhor || r.caminho.length > melhor.caminho.length || (r.caminho.length === melhor.caminho.length && r.tipo === 'allow'))) melhor = r;
  }
  return !melhor || melhor.tipo === 'allow';
}

async function bruto(url, timeoutMs) {
  estatisticas.requisicoes++;
  return get(url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' }, timeoutMs });
}

/** Lê o robots.txt do host antes de qualquer outra requisição. 404 = sem regras; outro erro = coleta bloqueada. */
export async function lerRobots() {
  const res = await bruto(`https://${HOST}/robots.txt`, 60000);
  const texto = await res.text();
  estatisticas.bytes += texto.length;
  if (res.status === 404) robots = { status: 404, regras: [], crawlDelayS: null };
  else if (res.ok) robots = { status: res.status, ...interpretarRobots(texto) };
  else throw Object.assign(new Error(`robots.txt respondeu HTTP ${res.status}; coleta não feita por precaução`), { bloqueio: true });
  ultimo = Date.now();
  return robots;
}

/* ---------- HTTP ---------- */

let ultimo = 0;

function sinaisDeBloqueio(texto) {
  return /captcha|cf-challenge|are you a robot|acesso negado|access denied/i.test(String(texto).slice(0, 4000));
}

/** GET com pausa ≥ 2 s (ou o Crawl-delay), até 3 tentativas. Devolve a Response (corpo ainda não lido). */
export async function abrir(url, { esperado = null, timeoutMs = 120000 } = {}) {
  if (!robots) throw new Error('robots.txt ainda não lido');
  const u = new URL(url);
  if (u.hostname !== HOST) throw new Error(`host fora da lista do coletor: ${u.hostname}`);
  if (!caminhoPermitido(robots.regras, u.pathname + u.search)) throw Object.assign(new Error(`caminho proibido pelo robots.txt: ${u.pathname}`), { bloqueio: true });
  const pausa = Math.max(PAUSA_MS, (robots.crawlDelayS ?? 0) * 1000);
  for (let t = 1; t <= 3; t++) {
    const espera = pausa - (Date.now() - ultimo);
    if (espera > 0) await dormir(espera);
    try {
      const res = await bruto(url, Math.max(5000, Math.min(timeoutMs, restanteMs())));
      ultimo = Date.now();
      console.error(`[tc-df] HTTP ${res.status} ${url}`);
      if (res.ok) {
        const tipo = res.headers.get('content-type') || '';
        if (esperado && !esperado.test(tipo)) {
          const amostra = await res.text();
          if (sinaisDeBloqueio(amostra)) throw Object.assign(new Error(`possível desafio anti-robô em ${url}; coleta interrompida`), { bloqueio: true });
          throw Object.assign(new Error(`tipo inesperado (${tipo}) em ${url}`), { definitivo: true });
        }
        return res;
      }
      res.cancelar();
      if (res.status >= 300 && res.status < 400) throw Object.assign(new Error(`redirecionamento inesperado (HTTP ${res.status}) em ${url}`), { definitivo: true });
      if ([401, 403, 429].includes(res.status)) throw Object.assign(new Error(`HTTP ${res.status} em ${url} (acesso recusado)`), { bloqueio: true });
      if (![408, 500, 502, 503, 504].includes(res.status)) throw Object.assign(new Error(`HTTP ${res.status} em ${url}`), { definitivo: true, status: res.status });
      if (t === 3) throw new Error(`HTTP ${res.status} em ${url}`);
    } catch (e) {
      ultimo = Date.now();
      if (e.bloqueio || e.definitivo || t === 3) { estatisticas.falhas.push(`${url}: ${e.message}`); throw e; }
      console.error(`[tc-df] tentativa ${t} falhou: ${e.message}`);
    }
    estatisticas.retentativas++;
    await dormir(15000 * t);
  }
  throw new Error('inalcançável');
}

/** GET de JSON (API REST do WordPress do site do TCDF). Devolve { dados, cabecalhos }. */
export async function obterJson(url) {
  const res = await abrir(url, { esperado: /json/i });
  const texto = await res.text();
  estatisticas.bytes += texto.length;
  return { dados: JSON.parse(texto), total: Number(res.headers.get('x-wp-total')) || null, paginas: Number(res.headers.get('x-wp-totalpages')) || null };
}

/**
 * Baixa um PDF para uma pasta temporária nova (fora do repositório), extrai o texto com pdftotext e apaga a pasta.
 * Devolve { texto, sha256, bytes, paginas }.
 */
export async function textoDoPdf(url) {
  const res = await abrir(url, { esperado: /pdf|octet-stream/i, timeoutMs: 600000 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcdf-pdf-'));
  try {
    const arq = path.join(dir, 'documento.pdf');
    const hash = crypto.createHash('sha256');
    const fd = fs.openSync(arq, 'w');
    let total = 0;
    try {
      for await (const p of res.body) {
        total += p.length;
        if (total > LIMITE_PDF) throw new Error(`arquivo maior que ${Math.round(LIMITE_PDF / 1e6)} MB`);
        hash.update(p);
        fs.writeSync(fd, p);
      }
    } finally { fs.closeSync(fd); }
    estatisticas.bytes += total;
    const texto = execFileSync(PDFTOTEXT, ['-enc', 'UTF-8', '-q', arq, '-'], { cwd: dir, timeout: 600000, maxBuffer: 512 * 1024 * 1024, windowsHide: true }).toString('utf8');
    return { texto, sha256: hash.digest('hex'), bytes: total, paginas: (texto.match(/\f/g) || []).length };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const PDFTOTEXT = process.env.TCDF_PDFTOTEXT || 'pdftotext';

export function temPdftotext() {
  // "-v" sai com código 0 (poppler) ou 99 (xpdf); só a ausência do programa conta como indisponível.
  try { execFileSync(PDFTOTEXT, ['-v'], { stdio: 'ignore', timeout: 30000, windowsHide: true }); return true; } catch (e) { return e.status === 99; }
}

/* ---------- Gravação ---------- */

export function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

const VOLATEIS = new Set(['atualizado_em', 'acessado_em', 'ultima_execucao', 'coletado_em', 'duracao_s', 'estatisticas_http']);
export const semVolateis = (o) => JSON.stringify(o, (k, v) => (VOLATEIS.has(k) ? undefined : v));

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

/* ---------- Texto ---------- */

export const hojeISO = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); // Brasília

export function fonte(titulo, url, acessado_em = hojeISO()) {
  return { titulo, url, orgao: ORGAO, acessado_em };
}
