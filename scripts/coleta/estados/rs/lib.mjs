// Utilitários dos coletores estaduais (RS e MG): HTTP que lê e obedece o robots.txt de cada host
// antes da primeira requisição (Disallow/Allow com curingas, Crawl-delay), no máximo 2 requisições
// simultâneas, intervalo mínimo por host, retentativas, cookies de sessão, orçamento de tempo e
// gravação atômica que não regrava arquivo sem mudança (reaproveitada do coletor da ALESP).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export {
  formatar, lerJson, gravarSeMudou, contagemGravacao, hojeISO, somarDias, diasEntre,
  normalizarNome, decodificarEntidades, htmlParaLinhas,
} from '../../alesp/lib.mjs';

export const USER_AGENT =
  'brasil-na-lupa-coletor/1.0 (coleta automatica de dados abertos para site neutro de acompanhamento politico; Node.js)';
const TOKEN_UA = 'brasil-na-lupa-coletor';

export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [], bloqueadas_robots: [] };
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- orçamento de tempo ----------
const INICIO = Date.now();
const ORCAMENTO_MS = Math.max(1, Number(process.env.COLETA_ORCAMENTO_MIN || 20)) * 60000;
/** Milissegundos restantes do orçamento (COLETA_ORCAMENTO_MIN, padrão 20 minutos). */
export const restanteMs = () => ORCAMENTO_MS - (Date.now() - INICIO);
export const decorridoS = () => ((Date.now() - INICIO) / 1000).toFixed(1);
export const log = (...m) => console.log(`[${decorridoS()}s]`, ...m);

// ---------- robots.txt ----------
/** Interpreta um robots.txt e devolve { regras: [{allow, padrao}], crawlDelay } do grupo aplicável. */
export function interpretarRobots(texto, token = TOKEN_UA) {
  const grupos = [];
  let atual = null, ultimoFoiAgente = false;
  for (const bruta of String(texto || '').split(/\r?\n/)) {
    const linha = bruta.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(linha);
    if (!m) continue;
    const campo = m[1].toLowerCase(), valor = m[2].trim();
    if (campo === 'user-agent') {
      if (!atual || !ultimoFoiAgente) { atual = { agentes: [], regras: [], crawlDelay: null }; grupos.push(atual); }
      atual.agentes.push(valor.toLowerCase());
      ultimoFoiAgente = true;
      continue;
    }
    ultimoFoiAgente = false;
    if (!atual) continue;
    if (campo === 'allow' || campo === 'disallow') {
      if (valor) atual.regras.push({ allow: campo === 'allow', padrao: valor });
    } else if (campo === 'crawl-delay') {
      const n = Number(valor);
      if (Number.isFinite(n) && n >= 0) atual.crawlDelay = n;
    }
  }
  const t = token.toLowerCase();
  const especifico = grupos.filter((g) => g.agentes.some((a) => a !== '*' && t.includes(a)));
  const escolhidos = especifico.length ? especifico : grupos.filter((g) => g.agentes.includes('*'));
  return {
    regras: escolhidos.flatMap((g) => g.regras),
    crawlDelay: escolhidos.reduce((m, g) => (g.crawlDelay != null ? Math.max(m ?? 0, g.crawlDelay) : m), null),
  };
}

function padraoParaRegex(p) {
  let fimAncorado = false;
  if (p.endsWith('$')) { fimAncorado = true; p = p.slice(0, -1); }
  const corpo = p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + corpo + (fimAncorado ? '$' : ''));
}

/** Regra mais longa vence; empate favorece Allow (RFC 9309). caminho = path + query. */
export function permitidoPorRobots(regras, caminho) {
  let melhor = null;
  for (const r of regras) {
    if (!padraoParaRegex(r.padrao).test(caminho)) continue;
    const tam = r.padrao.length;
    if (!melhor || tam > melhor.tam || (tam === melhor.tam && r.allow)) melhor = { tam, allow: r.allow, padrao: r.padrao };
  }
  return melhor ? { permitido: melhor.allow, regra: melhor.padrao } : { permitido: true, regra: null };
}

const robotsCache = new Map(); // origem → Promise<{ regras, crawlDelay, status, situacao }>
export const robotsRelatorio = {}; // origem → resumo para o meta.json

async function robotsDe(origem) {
  if (!robotsCache.has(origem)) {
    robotsCache.set(origem, (async () => {
      const url = `${origem}/robots.txt`;
      let status = 0, texto = '', tipo = '';
      try {
        estatisticas.requisicoes++;
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60000) });
        status = res.status; tipo = res.headers.get('content-type') || '';
        texto = await res.text();
      } catch (e) { status = 0; texto = String(e.message); }
      let r;
      if (status >= 200 && status < 300) {
        // Página HTML no lugar do robots.txt (SPA) não traz regras válidas: nada a obedecer além do padrão.
        r = { ...interpretarRobots(/text\/html/i.test(tipo) ? '' : texto), situacao: /text\/html/i.test(tipo) ? 'sem robots.txt (o servidor devolve uma página HTML)' : 'lido' };
      } else if (status >= 400 && status < 500) {
        r = { regras: [], crawlDelay: null, situacao: `inexistente (HTTP ${status}): sem restrições` };
      } else {
        // RFC 9309: erro de servidor ou de rede ao ler o robots.txt = bloqueio total.
        r = { regras: [{ allow: false, padrao: '/' }], crawlDelay: null, situacao: `inacessível (HTTP ${status || 'falha de rede'}): tratado como bloqueio total (RFC 9309)` };
      }
      robotsRelatorio[origem] = { url, status, situacao: r.situacao, crawl_delay: r.crawlDelay, regras: r.regras.length };
      return r;
    })());
  }
  return robotsCache.get(origem);
}

export class BloqueadoPorRobots extends Error {
  constructor(url, regra) { super(`bloqueado pelo robots.txt (${regra}): ${url}`); this.bloqueado = true; }
}

/** Confere se a URL pode ser acessada (lê o robots.txt do host se ainda não leu). */
export async function podeAcessar(url) {
  const u = new URL(url);
  const rb = await robotsDe(u.origin);
  return { ...permitidoPorRobots(rb.regras, u.pathname + u.search), robots: rb };
}

// ---------- fila: 2 simultâneas no processo, intervalo mínimo por host ----------
const MAX_PARALELO = 2;
let ativos = 0;
const fila = [];
async function vaga() {
  if (ativos < MAX_PARALELO) { ativos++; return; }
  await new Promise((r) => fila.push(r));
  ativos++;
}
function liberar() { ativos--; const r = fila.shift(); if (r) r(); }

const intervaloHost = new Map(); // host → ms mínimos entre requisições (definido pelo coletor)
const proximaVez = new Map();
export function definirIntervalo(host, ms) { intervaloHost.set(host, ms); }
async function aguardarHost(host, crawlDelayS) {
  const minimo = Math.max(intervaloHost.get(host) ?? 500, (crawlDelayS ?? 0) * 1000);
  const agora = Date.now();
  const quando = Math.max(agora, proximaVez.get(host) ?? 0);
  proximaVez.set(host, quando + minimo);
  if (quando > agora) await dormir(quando - agora);
}

// ---------- cookies (sessão do LEGIS) ----------
export class PoteDeCookies {
  constructor() { this.c = new Map(); }
  guardar(res) {
    const lista = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const sc of lista) {
      const [par] = sc.split(';');
      const i = par.indexOf('=');
      if (i > 0) this.c.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
    }
  }
  cabecalho() { return [...this.c].map(([k, v]) => `${k}=${v}`).join('; '); }
}

/**
 * Requisição HTTP. tipo: 'json' | 'text' | 'bin' | 'latin1'. metodo/corpo para POST de formulário.
 * Redirecionamentos seguidos manualmente (cada destino também passa pelo robots.txt).
 * Lança BloqueadoPorRobots sem tocar o servidor quando o robots.txt proíbe o caminho.
 */
export async function obter(url, { tipo = 'json', timeoutMs = 45000, opcional = false, metodo = 'GET', corpo = null, cookies = null, maxTentativas = 4 } = {}) {
  let alvo = url, met = metodo, bod = corpo;
  for (let salto = 0; salto < 6; salto++) {
    const ok = await podeAcessar(alvo);
    if (!ok.permitido) { estatisticas.bloqueadas_robots.push(alvo); throw new BloqueadoPorRobots(alvo, ok.regra); }
    const r = await tentar(alvo, met, bod, ok.robots.crawlDelay, { tipo, timeoutMs, opcional, cookies, maxTentativas });
    if (!r.redirecionar) return r.valor;
    alvo = new URL(r.redirecionar, alvo).href;
    if (r.status !== 307 && r.status !== 308) { met = 'GET'; bod = null; }
  }
  throw new Error(`redirecionamentos demais em ${url}`);
}

async function tentar(alvo, met, bod, crawlDelay, { tipo, timeoutMs, opcional, cookies, maxTentativas }) {
  const host = new URL(alvo).host;
  for (let t = 1; ; t++) {
    let espera = 0;
    await vaga();
    try {
      await aguardarHost(host, crawlDelay);
      estatisticas.requisicoes++;
      const headers = { 'User-Agent': USER_AGENT, Accept: tipo === 'json' ? 'application/json' : '*/*' };
      if (cookies?.c.size) headers.Cookie = cookies.cabecalho();
      if (bod) headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const res = await fetch(alvo, { method: met, body: bod, headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
      cookies?.guardar(res);
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get('location');
        await res.arrayBuffer();
        if (!loc) throw Object.assign(new Error(`redirecionamento sem destino em ${alvo}`), { definitivo: true });
        return { redirecionar: loc, status: res.status };
      }
      if (res.status === 404 && opcional) { await res.arrayBuffer(); return { valor: null }; }
      if (res.ok) {
        const b = Buffer.from(await res.arrayBuffer());
        estatisticas.bytes += b.length;
        if (tipo === 'bin') return { valor: b };
        if (tipo === 'latin1') return { valor: b.toString('latin1') };
        const texto = b.toString('utf8').replace(/^﻿/, '');
        return { valor: tipo === 'json' ? JSON.parse(texto) : texto };
      }
      await res.arrayBuffer();
      if (![408, 429, 500, 502, 503, 504].includes(res.status)) {
        throw Object.assign(new Error(`HTTP ${res.status} em ${alvo}`), { definitivo: true });
      }
      const ra = Number(res.headers.get('retry-after'));
      espera = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 120) * 1000 : 0;
      if (t >= maxTentativas) throw Object.assign(new Error(`HTTP ${res.status} em ${alvo}`), { definitivo: true });
    } catch (e) {
      if (e.definitivo || t >= maxTentativas) { estatisticas.falhas.push(`${alvo}: ${e.message}`); throw e; }
    } finally {
      liberar();
    }
    estatisticas.retentativas++;
    await dormir(Math.max(espera, 3000 * 2 ** (t - 1)));
  }
}

/** Executa fn sobre cada item; o paralelismo real é limitado por obter(). */
export const paraCada = (itens, fn) => Promise.all(itens.map((x, i) => fn(x, i)));

// ---------- datas ----------
/** "11/08/2026 14:00:00" → { data: '2026-08-11', hora: '14:00' } */
export function dataBR(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(String(s || '').trim());
  return m ? { data: `${m[3]}-${m[2]}-${m[1]}`, hora: m[4] ? `${m[4]}:${m[5]}` : null } : { data: null, hora: null };
}

// ---------- privacidade (diretriz 12) ----------
const OMITIDO = '[nome de particular omitido]';
const CONECTIVOS = '(?:d[aeo]s?|e|von|van|di|du)';
const NOME = `[A-ZÀ-Ý][\\p{L}'’.-]+(?:\\s+(?:${CONECTIVOS}\\s+)?[A-ZÀ-Ý][\\p{L}'’.-]+)+`;
// Gatilhos que, em ementas, costumam anteceder o nome de um cidadão comum (homenagens, títulos,
// denominações de bens públicos, desapropriações). Conservador: só substitui sequências de 2+ palavras
// iniciadas por maiúscula logo após o gatilho.
const GATILHOS = [
  'ao\\s+(?:Senhor|Sr\\.|cidadão|Doutor|Dr\\.|Padre|Pastor|Professor|Prof\\.)',
  'à\\s+(?:Senhora|Sra\\.|cidadã|Doutora|Dra\\.|Irmã|Professora|Profa\\.)',
  'aos\\s+(?:Senhores|Srs\\.)',
  '(?:Cidadão|Cidadã)\\s+(?:Honorári[oa]|Emérit[oa]|Gaúch[oa]|Rio-Grandense|Mineir[oa]|Benemérit[oa])\\s+(?:a[o]?|à)',
  '(?:passa\\s+a\\s+denominar-se|denominad[oa])\\s+(?:(?:Escola|Rodovia|Avenida|Rua|Praça|Ponte|Viaduto|Hospital|Centro|Parque|Estação|Ginásio|Estadual|Municipal|de|do|da)\\s+)*',
  'propriedade\\s+de',
  'em\\s+favor\\s+de',
];
// Apelido em aposto logo após o nome (", o Fulano") também é omitido.
const RE_PARTIC = new RegExp(`((?:${GATILHOS.join('|')})\\s*)(["“]?)(${NOME}(?:,\\s+(?:o|a)\\s+[A-ZÀ-Ý][\\p{L}'’.-]+)?)`, 'gu');
/** Substitui, em textos oficiais, nomes de particulares por "[nome de particular omitido]". */
export function omitirParticulares(texto) {
  if (!texto) return { texto, omitido: false };
  let omitido = false;
  const t = String(texto).replace(RE_PARTIC, (m, gat, aspas) => { omitido = true; return `${gat}${aspas}${OMITIDO}`; });
  return { texto: t, omitido };
}
/** Proponente/autor: mantém só quem exerce função pública; senão omite. */
const PUBLICOS = /^(Deputad[oa]|Deputado\(a\)|Dep\.|Poder |Governador|Governadora|Vice-Governador|Mesa|Comiss|Bancada|Bloco|Frente|Tribunal|Defensoria|Minist[ée]rio P[úu]blico|Procurador|Presid[êe]ncia|Presidente|Partido|Lideran|L[íi]der|Col[ée]gio|Grupo|Assembleia|Executivo|Judici[áa]rio|Conselho)/i;
export function autorPublico(nome) {
  const n = String(nome || '').trim();
  if (!n) return { nome: null, omitido: false };
  return PUBLICOS.test(n) ? { nome: n, omitido: false } : { nome: OMITIDO, omitido: true };
}

/** Mantém o campo de data de coleta antigo quando o resto do item não mudou (evita regravar sem mudança). */
export function manterDataColeta(novo, antigo, campo = 'coletado_em') {
  if (!antigo) return novo;
  const a = JSON.stringify({ ...antigo, [campo]: null }), b = JSON.stringify({ ...novo, [campo]: null });
  return a === b ? { ...novo, [campo]: antigo[campo] } : novo;
}

// ---------- PDF (só MG usa) ----------
/** Python com pdfplumber: COLETA_PYTHON, venv da UF, venv da ALESP, ou python do sistema. */
export function acharPython(dirUf) {
  if (process.env.COLETA_PYTHON) return process.env.COLETA_PYTHON;
  const cands = [];
  for (const base of [dirUf, path.resolve(dirUf, '../../alesp')]) {
    cands.push(path.join(base, '.venv', 'Scripts', 'python.exe'), path.join(base, '.venv', 'bin', 'python'));
  }
  for (const c of cands) if (fs.existsSync(c)) return c;
  return process.platform === 'win32' ? 'python' : 'python3';
}
/**
 * Extrai o texto de um PDF com "python -I" num diretório temporário novo e vazio (o PDF é dado
 * não confiável; -I impede importar módulos do diretório atual ou do PDF).
 */
export function extrairTextoPdf(buf, { script, python }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estados-pdf-'));
  const arq = path.join(dir, 'documento.pdf');
  try {
    fs.writeFileSync(arq, buf);
    const out = execFileSync(python, ['-I', script, arq], {
      cwd: dir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: Number(process.env.COLETA_PDF_TIMEOUT_S || 90) * 1000, killSignal: "SIGKILL", windowsHide: true,
    });
    return JSON.parse(out);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { /* pasta temporária presa pelo SO: não impede a coleta */ }
  }
}
