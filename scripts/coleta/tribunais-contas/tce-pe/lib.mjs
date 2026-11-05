// Utilitários do coletor do TCE-PE: HTTP sequencial (uma requisição por vez, pausa mínima entre elas),
// leitura do robots.txt antes de qualquer outra requisição, decodificação ISO-8859-1, orçamento de tempo
// e gravação atômica que não reescreve arquivo sem mudança de conteúdo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
export const SAIDA = path.join(RAIZ, 'dados', 'tribunais-contas', 'tce-pe');

export const USER_AGENT = 'BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)';
export const ORGAO = 'Tribunal de Contas do Estado de Pernambuco (TCE-PE)';
export const BASE_API = 'https://sistemas.tcepe.tc.br/DadosAbertos';

// Únicos hosts acessados pelo coletor. Os links para etce.tcepe.tc.br (documento e processo) são só guardados.
const HOSTS_PERMITIDOS = new Set(['sistemas.tcepe.tc.br']);
const PAUSA_MS = 1500;

export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Orçamento de tempo (COLETA_ORCAMENTO_MIN) ---------- */

const INICIO = Date.now();
const ORCAMENTO_MS = (() => {
  const v = Number(process.env.COLETA_ORCAMENTO_MIN);
  return Number.isFinite(v) && v > 0 ? v * 60000 : Infinity;
})();
export function restanteMs() { return ORCAMENTO_MS - (Date.now() - INICIO); }
export function orcamentoEsgotado(margemMs = 0) { return restanteMs() <= margemMs; }

/* ---------- robots.txt ---------- */

let robots = null; // { status, regras: [{ tipo, caminho }] }

/** Interpreta as regras para "User-agent: *" e para o nosso agente. 404 = sem regras. */
export function interpretarRobots(texto) {
  const regras = [];
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
      if (ua === '*' || 'brasilnalupa-coletor'.startsWith(ua) || ua.startsWith('brasilnalupa')) aplica = true;
    } else {
      emGrupo = false;
      if (aplica && (campo === 'disallow' || campo === 'allow') && valor) regras.push({ tipo: campo, caminho: valor });
    }
  }
  return regras;
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
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/plain, */*' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
  const buf = Buffer.from(await res.arrayBuffer());
  estatisticas.bytes += buf.length;
  return { res, buf };
}

/** Lê o robots.txt do host da API antes de qualquer outra requisição. */
export async function lerRobots() {
  const url = 'https://sistemas.tcepe.tc.br/robots.txt';
  const { res, buf } = await bruto(url, 60000);
  if (res.status === 404) robots = { status: 404, regras: [] };
  else if (res.ok) robots = { status: res.status, regras: interpretarRobots(buf.toString('latin1')) };
  else throw new Error(`robots.txt respondeu HTTP ${res.status}; coleta interrompida por precaução`);
  ultimo = Date.now();
  return robots;
}

/* ---------- HTTP ---------- */

let ultimo = 0;
let fila = Promise.resolve();

/** Decodifica o corpo pelo charset do Content-Type (a API usa ISO-8859-1). */
export function decodificar(buf, contentType) {
  const cs = (String(contentType || '').match(/charset=([^;]+)/i)?.[1] || 'utf-8').trim().toLowerCase();
  const rotulo = /8859-1|latin-?1|windows-1252/.test(cs) ? 'latin1' : 'utf-8';
  return new TextDecoder(rotulo).decode(buf).replace(/^﻿/, '');
}

function sinaisDeBloqueio(texto) {
  return /captcha|cf-challenge|are you a robot|acesso negado|access denied/i.test(texto.slice(0, 4000));
}

/** GET sequencial: uma requisição por vez, pausa ≥ 1,5 s, até 4 tentativas. Retorna o texto decodificado. */
export function obter(url, { timeoutMs = 300000 } = {}) {
  const tarefa = fila.then(() => obterAgora(url, timeoutMs));
  fila = tarefa.catch(() => {});
  return tarefa;
}

// Disjuntor: depois de 2 consultas seguidas que falharam em todas as tentativas, o servidor é tratado como
// indisponível e nenhuma requisição nova é feita nesta execução (não insistir num servidor sobrecarregado).
let falhasSeguidas = 0;
export const DISJUNTOR = 2;
export function apiIndisponivel() { return falhasSeguidas >= DISJUNTOR; }

async function obterAgora(url, timeoutMs) {
  if (!robots) throw new Error('robots.txt ainda não lido');
  if (apiIndisponivel()) throw Object.assign(new Error('API tratada como indisponível nesta execução (falhas seguidas)'), { definitivo: true, disjuntor: true });
  const u = new URL(url);
  if (!HOSTS_PERMITIDOS.has(u.hostname)) throw new Error(`host fora da lista do coletor: ${u.hostname}`);
  if (!caminhoPermitido(robots.regras, u.pathname + u.search)) throw new Error(`caminho proibido pelo robots.txt: ${u.pathname}`);
  for (let t = 1; t <= 4; t++) {
    const espera = PAUSA_MS - (Date.now() - ultimo);
    if (espera > 0) await dormir(espera);
    try {
      const t0 = Date.now();
      const { res, buf } = await bruto(url, Math.max(5000, Math.min(timeoutMs, restanteMs())));
      ultimo = Date.now();
      console.error(`[tce-pe] HTTP ${res.status} ${Math.round((ultimo - t0) / 1000)} s ${buf.length} B ${url}`);
      const texto = decodificar(buf, res.headers.get('content-type'));
      if (res.ok) {
        if (sinaisDeBloqueio(texto) && !/^\s*[{[]/.test(texto)) throw Object.assign(new Error(`possível desafio anti-robô em ${url}; coleta interrompida`), { definitivo: true });
        falhasSeguidas = 0;
        return texto;
      }
      if (res.status >= 300 && res.status < 400) throw Object.assign(new Error(`redirecionamento inesperado (HTTP ${res.status}) em ${url}`), { definitivo: true });
      if (![408, 429, 500, 502, 503, 504].includes(res.status)) throw Object.assign(new Error(`HTTP ${res.status} em ${url}`), { definitivo: true });
      if (t === 4) throw new Error(`HTTP ${res.status} em ${url}`);
    } catch (e) {
      ultimo = Date.now();
      console.error(`[tce-pe] tentativa ${t} falhou: ${e.message} (${url})`);
      if (e.definitivo || t === 4 || orcamentoEsgotado(60000)) { falhasSeguidas++; estatisticas.falhas.push(`${url}: ${e.message}`); throw e; }
    }
    estatisticas.retentativas++;
    await dormir(15000 * 2 ** (t - 1)); // 15 s, 30 s, 60 s
  }
  throw new Error('inalcançável');
}

/** Percent-encoding em ISO-8859-1, o que a API entende (ex.: "Prestação" → "Presta%E7%E3o"). */
export function codificarLatin1(v) {
  return [...String(v)].map((c) => {
    const n = c.codePointAt(0);
    if (/[A-Za-z0-9\-_.~]/.test(c)) return c;
    if (n > 255) throw new Error(`caractere fora do ISO-8859-1 no filtro: ${c}`);
    return '%' + n.toString(16).toUpperCase().padStart(2, '0');
  }).join('');
}

/** Consulta uma entidade da API em JSON; devolve { url, conteudo }. */
export async function consultar(entidade, params) {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${codificarLatin1(v)}`).join('&');
  const url = `${BASE_API}/${entidade}!json${qs ? '?' + qs : ''}`;
  const texto = await obter(url);
  return { url, conteudo: lerResposta(texto, entidade) };
}

/** Valida o envelope { resposta: { status, entidade, conteudo } } da API. */
export function lerResposta(texto, entidade) {
  let j;
  try { j = JSON.parse(texto); } catch { throw new Error(`${entidade}: resposta não é JSON`); }
  const r = j?.resposta;
  if (!r || r.status !== 'OK' || !Array.isArray(r.conteudo)) throw new Error(`${entidade}: resposta inesperada (status ${r?.status ?? '?'})`);
  if (Number(r.tamanhoResultado) >= Number(r.limiteResultado || Infinity)) throw new Error(`${entidade}: resultado atingiu o limite da API; refine o filtro`);
  return r.conteudo;
}

/* ---------- Gravação ---------- */

export function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

const VOLATEIS = new Set(['atualizado_em', 'acessado_em', 'ultima_execucao', 'coletado_em', 'duracao_s', 'estatisticas_http']);
export function semVolateis(o) {
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

/* ---------- Texto ---------- */

export function hojeISO() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); // fuso de Brasília
}

export function fonte(titulo, url, acessado_em = hojeISO()) {
  return { titulo, url, orgao: ORGAO, acessado_em };
}

/** Id em kebab-case sem acento ("Belém de São Francisco" → "belem-de-sao-francisco"). */
export function slug(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** "AAAA-MM-DD..." → "AAAA-MM-DD" (null se não casar). */
export function dataISO(s) {
  const m = String(s || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Link literal da API (aceita só http/https; vazio → null). */
export function link(u) {
  const s = String(u || '').trim();
  return /^https?:\/\//i.test(s) ? s : null;
}
