// Utilitários do coletor do TCE-RJ: HTTP sequencial com pausa mínima de 1 s, leitura do robots.txt antes
// de qualquer outra requisição, orçamento de tempo (COLETA_ORCAMENTO_MIN) e gravação atômica que não
// reescreve arquivo sem mudança de conteúdo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
export const SAIDA = path.join(RAIZ, 'dados', 'tribunais-contas', 'tce-rj');

export const USER_AGENT = 'BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)';
export const ORGAO = 'Tribunal de Contas do Estado do Rio de Janeiro (TCE-RJ)';
export const HOST = 'dados.tcerj.tc.br';
export const API = `https://${HOST}/api/v1`;
export const URL_DOCS = `${API}/docs`;
export const LICENCA = 'Open Database License (ODbL), declarada na documentação da API';

const PAUSA_MS = 1500;
export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- orçamento de tempo ---------- */

const INICIO = Date.now();
const orcamentoMin = Number(process.env.COLETA_ORCAMENTO_MIN || 10);
export const ORCAMENTO_MS = (Number.isFinite(orcamentoMin) && orcamentoMin > 0 ? orcamentoMin : 10) * 60000;
export const restanteMs = () => ORCAMENTO_MS - (Date.now() - INICIO);
export const orcamentoEsgotado = () => restanteMs() <= 0;

/* ---------- robots.txt ---------- */

/** Regras do grupo "User-agent: *" (ou do nosso agente): lista de prefixos proibidos e permitidos. */
export function lerRobots(texto) {
  const grupos = [];
  let atual = null;
  let ultimaFoiAgente = false;
  for (const bruta of String(texto || '').split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, '').trim();
    const m = linha.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const campo = m[1].toLowerCase();
    const valor = m[2].trim();
    if (campo === 'user-agent') {
      if (!ultimaFoiAgente) { atual = { agentes: [], disallow: [], allow: [] }; grupos.push(atual); }
      atual.agentes.push(valor.toLowerCase());
      ultimaFoiAgente = true;
      continue;
    }
    ultimaFoiAgente = false;
    if (!atual) continue;
    if (campo === 'disallow' && valor) atual.disallow.push(valor);
    if (campo === 'allow' && valor) atual.allow.push(valor);
  }
  const nosso = grupos.find((g) => g.agentes.some((a) => a !== '*' && 'brasilnalupa-coletor'.startsWith(a)));
  const geral = grupos.find((g) => g.agentes.includes('*'));
  return nosso || geral || { agentes: [], disallow: [], allow: [] };
}

/** true se o caminho é permitido (regra mais longa vence; Allow vence empate). */
export function permitido(regras, caminho) {
  let melhor = { tam: -1, ok: true };
  for (const [lista, ok] of [[regras.disallow, false], [regras.allow, true]]) {
    for (const p of lista) {
      if (caminho.startsWith(p) && (p.length > melhor.tam || (p.length === melhor.tam && ok))) melhor = { tam: p.length, ok };
    }
  }
  return melhor.ok;
}

let robots = null; // { texto, regras, status }

async function requisitar(url, timeoutMs) {
  estatisticas.requisicoes++;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/plain, */*' },
    signal: AbortSignal.timeout(Math.max(5000, Math.min(timeoutMs, restanteMs()))),
    redirect: 'manual',
  });
  const buf = Buffer.from(await res.arrayBuffer());
  estatisticas.bytes += buf.length;
  await dormir(PAUSA_MS);
  return { res, texto: buf.toString('utf8').replace(/^﻿/, '') };
}

/** Lê o robots.txt do host (primeira requisição da execução). Sem robots (404) = nada proibido. */
export async function carregarRobots() {
  if (robots) return robots;
  const url = `https://${HOST}/robots.txt`;
  const { res, texto } = await requisitar(url, 30000);
  if (res.status === 200) robots = { status: 200, texto, regras: lerRobots(texto) };
  else if (res.status === 404) robots = { status: 404, texto: '', regras: lerRobots('') };
  else throw Object.assign(new Error(`robots.txt de ${HOST} respondeu HTTP ${res.status}; coleta interrompida`), { definitivo: true });
  return robots;
}

/** Sinais de desafio anti-robô, CAPTCHA ou login: a coleta para e registra, sem contornar. */
export function pareceBloqueio(res, texto) {
  if ([401, 403].includes(res.status)) return `HTTP ${res.status}`;
  if (res.status >= 300 && res.status < 400) return `redirecionamento para ${res.headers.get('location') || '?'}`;
  if (/captcha|cf-chl|challenge-platform|just a moment|acesso negado|fa[çc]a login/i.test(texto.slice(0, 4000))) return 'página de desafio, CAPTCHA ou login';
  return null;
}

/** GET JSON da API, só depois do robots.txt e só em caminho permitido. Até 4 tentativas. */
export async function obterJson(caminho) {
  const r = await carregarRobots();
  if (!permitido(r.regras, caminho)) throw Object.assign(new Error(`caminho proibido pelo robots.txt: ${caminho}`), { definitivo: true });
  const url = `https://${HOST}${caminho}`;
  for (let t = 1; t <= 4; t++) {
    if (orcamentoEsgotado()) throw Object.assign(new Error('orçamento de tempo esgotado'), { orcamento: true });
    try {
      const { res, texto } = await requisitar(url, 120000);
      const bloqueio = pareceBloqueio(res, texto);
      if (bloqueio) throw Object.assign(new Error(`bloqueio em ${url}: ${bloqueio}; coleta interrompida sem contornar`), { definitivo: true });
      if (res.ok) {
        try { return { dados: JSON.parse(texto), url }; } catch { throw Object.assign(new Error(`resposta não é JSON em ${url}`), { definitivo: true }); }
      }
      if (![408, 429, 500, 502, 503, 504].includes(res.status)) throw Object.assign(new Error(`HTTP ${res.status} em ${url}`), { definitivo: true });
      if (t === 4) throw new Error(`HTTP ${res.status} em ${url}`);
      const ra = Number(res.headers.get('retry-after'));
      estatisticas.retentativas++;
      await dormir(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) * 1000 : 3000 * 2 ** (t - 1));
    } catch (e) {
      if (e.definitivo || e.orcamento || t === 4) { estatisticas.falhas.push(`${url}: ${e.message}`); throw e; }
      estatisticas.retentativas++;
      await dormir(3000 * 2 ** (t - 1));
    }
  }
  return null;
}

/* ---------- gravação ---------- */

export function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

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
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, arquivo);
  contagemGravacao.gravados.push(rel);
  return true;
}

/* ---------- texto ---------- */

export function hojeISO() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); // fuso de Brasília
}

export function fonte(titulo, url, extra = {}) {
  return { titulo, url, orgao: ORGAO, acessado_em: hojeISO(), ...extra };
}

/** Sem acento, maiúsculas, espaços simples: só para comparação exata. */
export function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

export function kebab(s) {
  return normalizar(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Indicadores que a fonte publica como parecer emitido; qualquer outro valor não vira conclusão. */
export const INDICADORES_CONCLUSIVOS = new Set(['FAVORÁVEL', 'CONTRÁRIO']);
export const conclusaoDoIndicador = (ind) => (INDICADORES_CONCLUSIVOS.has(String(ind || '').trim()) ? String(ind).trim() : null);
