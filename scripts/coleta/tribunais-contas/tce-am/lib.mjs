// Utilitários do coletor do TCE-AM: HTTP sequencial com pausa mínima, leitura do robots.txt antes de
// qualquer outra requisição ao host, corte de respostas grandes, orçamento de tempo e gravação atômica
// que não reescreve arquivo sem mudança de conteúdo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
export const SAIDA = path.join(RAIZ, 'dados', 'tribunais-contas', 'tce-am');

export const USER_AGENT = 'BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)';
export const ORGAO_FONTE = 'Tribunal de Contas do Estado do Amazonas (TCE-AM)';

// Único host consultado. Os PDFs (jurisprudencia-fs.tce.am.gov.br) só são linkados, nunca baixados.
export const HOST_API = 'jurisprudencia-api.tce.am.gov.br';
const HOSTS_PERMITIDOS = new Set([HOST_API]);

export const PAUSA_MS = 1200;
export const LIMITE_BYTES = 4 * 1024 * 1024; // resposta maior que isso é cortada e a janela é dividida

export const estatisticas = { requisicoes: 0, retentativas: 0, bytes: 0, cortes: 0, falhas: [] };
export const robots = {}; // host -> { status, regras: [caminhos proibidos], observacao }

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Orçamento de tempo (COLETA_ORCAMENTO_MIN) ---------- */

const INICIO = Date.now();
export function orcamentoMs() {
  const min = Number(process.env.COLETA_ORCAMENTO_MIN);
  return Number.isFinite(min) && min > 0 ? min * 60000 : Infinity;
}
export function semTempo(margemMs = 0) {
  return Date.now() - INICIO + margemMs >= orcamentoMs();
}
export const decorridoS = () => Math.round((Date.now() - INICIO) / 1000);

/* ---------- robots.txt ---------- */

/** Lê as regras "Disallow" do grupo "User-agent: *" ou do nosso agente. Texto que não é robots vale como sem regras. */
export function lerRobots(texto) {
  const regras = [];
  let grupoAplica = false;
  let emUa = false;
  for (const linhaBruta of String(texto).split(/\r?\n/)) {
    const linha = linhaBruta.replace(/#.*/, '').trim();
    const m = linha.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const campo = m[1].toLowerCase();
    const valor = m[2].trim();
    if (campo === 'user-agent') {
      if (!emUa) grupoAplica = false;
      emUa = true;
      if (valor === '*' || /brasilnalupa/i.test(valor)) grupoAplica = true;
      continue;
    }
    emUa = false;
    if (campo === 'disallow' && grupoAplica && valor) regras.push(valor);
  }
  return regras;
}

export function caminhoProibido(regras, caminho) {
  return regras.some((r) => {
    if (r === '/') return true;
    const re = new RegExp('^' + r.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    return re.test(caminho);
  });
}

let ultimaRequisicao = 0;
async function pausa() {
  const espera = ultimaRequisicao + PAUSA_MS - Date.now();
  if (espera > 0) await dormir(espera);
  ultimaRequisicao = Date.now();
}

async function lerCorpo(res, limite) {
  const leitor = res.body.getReader();
  const partes = [];
  let n = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    partes.push(value);
    n += value.length;
    if (n > limite) { await leitor.cancel(); return { cortado: true, n }; }
  }
  return { cortado: false, n, texto: Buffer.concat(partes).toString('utf8') };
}

async function conferirRobots(host) {
  if (robots[host]) return robots[host];
  await pausa();
  estatisticas.requisicoes++;
  const url = `https://${host}/robots.txt`;
  let info;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30000) });
    const corpo = await lerCorpo(res, 200000);
    const tipo = res.headers.get('content-type') || '';
    if (res.status === 200 && /text\/plain/i.test(tipo) && !corpo.cortado) {
      info = { status: 200, regras: lerRobots(corpo.texto), observacao: 'robots.txt lido' };
    } else {
      info = { status: res.status, regras: [], observacao: `sem robots.txt válido (HTTP ${res.status}, ${tipo || 'sem tipo'}): nenhuma regra a respeitar` };
    }
  } catch (e) {
    // Sem resposta do robots.txt não há como saber as regras: o coletor não segue.
    throw Object.assign(new Error(`robots.txt de ${host} inacessível (${e.message}); coleta interrompida`), { definitivo: true });
  }
  robots[host] = info;
  return info;
}

/**
 * GET JSON sequencial (uma requisição por vez, pausa ≥ PAUSA_MS), até 4 tentativas.
 * Retorna { dados } ou { cortado: true } quando a resposta passa de `limite` bytes.
 */
export async function obterJson(url, { limite = LIMITE_BYTES, timeoutMs = 180000 } = {}) {
  const u = new URL(url);
  if (!HOSTS_PERMITIDOS.has(u.hostname)) throw Object.assign(new Error(`host fora da lista do coletor: ${u.hostname}`), { definitivo: true });
  const rb = await conferirRobots(u.hostname);
  if (caminhoProibido(rb.regras, u.pathname)) throw Object.assign(new Error(`caminho proibido pelo robots.txt: ${u.pathname}`), { definitivo: true });
  for (let t = 1; t <= 4; t++) {
    await pausa();
    estatisticas.requisicoes++;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
      const tipo = res.headers.get('content-type') || '';
      if (res.ok && !/json/i.test(tipo)) {
        // HTML no lugar de JSON pode ser desafio anti-bot ou login: não se contorna, para.
        throw Object.assign(new Error(`resposta não-JSON (${tipo}) em ${url}: possível bloqueio; coleta interrompida`), { definitivo: true, bloqueio: true });
      }
      if (res.ok) {
        const c = await lerCorpo(res, limite);
        estatisticas.bytes += c.n;
        if (c.cortado) { estatisticas.cortes++; return { cortado: true }; }
        return { dados: JSON.parse(c.texto) };
      }
      if ([401, 403].includes(res.status)) throw Object.assign(new Error(`HTTP ${res.status} (acesso negado) em ${url}; coleta interrompida`), { definitivo: true, bloqueio: true });
      if (![408, 429, 500, 502, 503, 504].includes(res.status)) throw Object.assign(new Error(`HTTP ${res.status} em ${url}`), { definitivo: true });
      if (t === 4) throw new Error(`HTTP ${res.status} em ${url}`);
    } catch (e) {
      if (e.definitivo || t === 4) { estatisticas.falhas.push(`${url}: ${e.message}`); throw e; }
    }
    estatisticas.retentativas++;
    await dormir(3000 * 2 ** (t - 1));
  }
  return null;
}

/* ---------- Arquivos ---------- */

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

export function hojeISO() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); // fuso de Brasília
}

export function fonte(titulo, url, extra = {}) {
  return { titulo, url, orgao: ORGAO_FONTE, acessado_em: hojeISO(), ...extra };
}

/** Sem acento, maiúsculas, espaços simples. */
export function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Nome em kebab-case sem acento (mesmo padrão dos ids de município do site). */
export function slug(s) {
  return normalizar(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
