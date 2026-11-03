// Cliente HTTP por host do SAPL: lê o robots.txt antes de qualquer outra requisição, respeita o
// Crawl-delay (no mínimo 61 s entre o início de duas requisições ao mesmo host, contando desde a
// primeira, inclusive a do robots.txt e as retentativas), nunca acessa caminho proibido e nunca
// baixa /materia/docacessorio/. Hosts diferentes têm relógios independentes (podem rodar em paralelo).
import { USER_AGENT } from '../../alesp/lib.mjs';

export { USER_AGENT };
export const INTERVALO_MINIMO_S = 61;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Interpreta o robots.txt: regras do grupo "*" (e de um grupo com o nosso agente, se houver). */
export function interpretarRobots(texto) {
  const grupos = [];
  let atual = null;
  let ultimaFoiAgente = false;
  for (const bruta of String(texto || '').split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, '').trim();
    if (!linha) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(linha);
    if (!m) continue;
    const campo = m[1].toLowerCase();
    const valor = m[2].trim();
    if (campo === 'user-agent') {
      if (!ultimaFoiAgente) { atual = { agentes: [], disallow: [], allow: [], crawl_delay: null }; grupos.push(atual); }
      atual.agentes.push(valor.toLowerCase());
      ultimaFoiAgente = true;
      continue;
    }
    ultimaFoiAgente = false;
    if (!atual) continue;
    if (campo === 'disallow' && valor) atual.disallow.push(valor);
    else if (campo === 'allow' && valor) atual.allow.push(valor);
    else if (campo === 'crawl-delay') { const n = Number(valor); if (Number.isFinite(n)) atual.crawl_delay = n; }
  }
  const nosso = USER_AGENT.toLowerCase();
  const especifico = grupos.find((g) => g.agentes.some((a) => a !== '*' && nosso.includes(a)));
  const geral = grupos.find((g) => g.agentes.includes('*'));
  const g = especifico || geral || { disallow: [], allow: [], crawl_delay: null };
  return { disallow: g.disallow, allow: g.allow, crawl_delay: g.crawl_delay };
}

function casaPadrao(padrao, caminho) {
  // Curingas "*" e âncora "$" do padrão de robots.txt.
  const re = new RegExp('^' + padrao.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')
    .replace(/\\\$$/, '$'));
  return re.test(caminho);
}

/** O caminho (com query) é permitido pelas regras? A regra mais longa vence (Allow empata a favor). */
export function permitido(regras, caminho) {
  if (/^\/materia\/docacessorio\//i.test(caminho)) return false; // proibido sempre (regra do projeto)
  let melhor = { tam: -1, ok: true };
  for (const p of regras.disallow) if (casaPadrao(p, caminho) && p.length > melhor.tam) melhor = { tam: p.length, ok: false };
  for (const p of regras.allow) if (casaPadrao(p, caminho) && p.length >= melhor.tam) melhor = { tam: p.length, ok: true };
  return melhor.ok;
}

export class ClienteHost {
  /**
   * host: nome do host; prazoMs: instante (epoch ms) a partir do qual nenhuma requisição começa;
   * ultimaAnterior: ISO da última requisição de execuções anteriores (meta.json), para o intervalo valer entre execuções.
   */
  constructor(host, { prazoMs, ultimaAnterior = null, log = () => {}, fetchImpl = fetch, dormirImpl = dormir, agora = Date.now } = {}) {
    this.host = host;
    this.base = `https://${host}`;
    this.prazoMs = prazoMs;
    this.log = log;
    this.fetch = fetchImpl;
    this.dormir = dormirImpl;
    this.agora = agora;
    this.intervaloS = INTERVALO_MINIMO_S;
    this.proximaMs = ultimaAnterior ? Date.parse(ultimaAnterior) + this.intervaloS * 1000 : 0;
    this.ultimaEm = ultimaAnterior;
    this.regras = null;
    this.robots = null;
    this.requisicoes = 0;
    this.falhas = [];
  }

  /** Cabe mais uma requisição antes do prazo (com folga para a resposta)? */
  cabe(folgaMs = 45000) {
    return Math.max(this.agora(), this.proximaMs) + folgaMs <= this.prazoMs;
  }

  async _bruto(caminho, aceitar) {
    const espera = this.proximaMs - this.agora();
    if (espera > 0) await this.dormir(espera);
    const inicio = this.agora();
    this.proximaMs = inicio + this.intervaloS * 1000;
    this.ultimaEm = new Date(inicio).toISOString();
    this.requisicoes++;
    const url = this.base + caminho;
    const res = await this.fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: aceitar },
      signal: AbortSignal.timeout(120000),
      redirect: 'follow',
    });
    const texto = (await res.text()).replace(/^﻿/, '');
    return { status: res.status, texto, url };
  }

  /** Primeira requisição de toda execução: o robots.txt. Ajusta o intervalo ao Crawl-delay declarado. */
  async lerRobots() {
    const r = await this._bruto('/robots.txt', 'text/plain');
    const regras = r.status === 200 ? interpretarRobots(r.texto) : { disallow: [], allow: [], crawl_delay: null };
    this.regras = regras;
    if (regras.crawl_delay != null) this.intervaloS = Math.max(INTERVALO_MINIMO_S, Math.ceil(regras.crawl_delay) + 1);
    this.proximaMs = Date.parse(this.ultimaEm) + this.intervaloS * 1000;
    this.robots = {
      lido_em: this.ultimaEm, status: r.status, crawl_delay_s: regras.crawl_delay,
      intervalo_usado_s: this.intervaloS, disallow: regras.disallow,
    };
    this.log(`robots.txt HTTP ${r.status}; Crawl-delay ${regras.crawl_delay ?? '(não declarado)'}; intervalo ${this.intervaloS} s`);
    return this.robots;
  }

  /**
   * GET JSON da API. Retorna o objeto, ou null em 404. Erros 429/5xx: até 2 retentativas, cada uma
   * também no intervalo do host. Lança erro se o robots.txt não foi lido ou o caminho é proibido.
   */
  async json(caminho) {
    if (!this.regras) throw new Error('robots.txt ainda não lido');
    if (!permitido(this.regras, caminho)) throw new Error(`caminho proibido pelo robots.txt: ${caminho}`);
    for (let t = 1; t <= 3; t++) {
      let r;
      try {
        r = await this._bruto(caminho, 'application/json');
      } catch (e) {
        this.falhas.push(`${caminho}: ${e.message}`);
        if (t === 3 || !this.cabe()) throw e;
        continue;
      }
      if (r.status === 404) return null;
      if (r.status >= 200 && r.status < 300) {
        try { return JSON.parse(r.texto); } catch { throw new Error(`resposta não é JSON em ${caminho}`); }
      }
      this.falhas.push(`${caminho}: HTTP ${r.status}`);
      if (![408, 429, 500, 502, 503, 504].includes(r.status) || t === 3 || !this.cabe()) {
        throw Object.assign(new Error(`HTTP ${r.status} em ${caminho}`), { status: r.status });
      }
    }
    return null;
  }
}
