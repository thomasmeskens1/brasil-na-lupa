// Cliente HTTP do coletor Ágape (Alese/SE e ALBA/BA) e das bases de normas.
//   - robots.txt de cada host é a PRIMEIRA requisição a esse host e vale desde então
//     (leitura conforme a RFC 9309: linhas em branco não separam grupos, a regra mais longa vence).
//   - No máximo 2 requisições simultâneas no processo inteiro; retentativas com espera crescente.
//   - Nenhuma requisição começa depois do prazo (orçamento de tempo); caminho proibido nunca é pedido.
//   - Sem contornar bloqueio: 401/403/captcha encerram o fluxo daquele host.
export const USER_AGENT =
  'brasil-na-lupa-coletor/1.0 (coleta automatica de dados abertos para o site neutro de acompanhamento politico Brasil na Lupa; Node.js)';

const MAX_PARALELO = 2;
let ativos = 0;
const fila = [];
async function vaga() {
  if (ativos < MAX_PARALELO) { ativos++; return; }
  await new Promise((r) => fila.push(r));
  ativos++;
}
function liberar() { ativos--; const r = fila.shift(); if (r) r(); }
const dormirPadrao = (ms) => new Promise((r) => setTimeout(r, ms));

/** Interpreta o robots.txt segundo a RFC 9309 e devolve as regras que valem para o nosso agente. */
export function interpretarRobots(texto, agente = USER_AGENT) {
  const grupos = [];
  let atual = null;
  let lendoAgentes = false;
  for (const bruta of String(texto || '').split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, '').trim();
    if (!linha) continue; // linha em branco não encerra grupo (RFC 9309, seção 2.2)
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(linha);
    if (!m) continue;
    const campo = m[1].toLowerCase();
    const valor = m[2].trim();
    if (campo === 'user-agent') {
      if (!lendoAgentes) { atual = { agentes: [], disallow: [], allow: [] }; grupos.push(atual); }
      atual.agentes.push(valor.toLowerCase());
      lendoAgentes = true;
      continue;
    }
    lendoAgentes = false;
    if (!atual) continue;
    if (campo === 'disallow' && valor) atual.disallow.push(valor);
    else if (campo === 'allow' && valor) atual.allow.push(valor);
  }
  const produto = agente.toLowerCase().split('/')[0];
  const especificos = grupos.filter((g) => g.agentes.some((a) => a !== '*' && produto.includes(a)));
  const usados = especificos.length ? especificos : grupos.filter((g) => g.agentes.includes('*'));
  return {
    disallow: usados.flatMap((g) => g.disallow),
    allow: usados.flatMap((g) => g.allow),
    grupo: especificos.length ? 'especifico' : usados.length ? '*' : 'nenhum',
  };
}

function casaPadrao(padrao, caminho) {
  const re = new RegExp('^' + padrao.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/\\\$$/, '$'));
  return re.test(caminho);
}

/** Caminho (com query) permitido? Regra mais longa vence; empate favorece Allow. */
export function permitido(regras, caminho) {
  let melhor = { tam: -1, ok: true };
  for (const p of regras.disallow) if (casaPadrao(p, caminho) && p.length > melhor.tam) melhor = { tam: p.length, ok: false };
  for (const p of regras.allow) if (casaPadrao(p, caminho) && p.length >= melhor.tam) melhor = { tam: p.length, ok: true };
  return melhor.ok;
}

export class Bloqueado extends Error {}
export class SemTempo extends Error {}

export class ClienteHost {
  /** host: nome do host; prazoMs: instante a partir do qual nenhuma requisição começa. */
  constructor(host, { prazoMs = Infinity, log = () => {}, fetchImpl = fetch, dormir = dormirPadrao, agora = Date.now, pausaMs = 400 } = {}) {
    Object.assign(this, { host, prazoMs, log, fetch: fetchImpl, dormir, agora, pausaMs });
    this.base = `https://${host}`;
    this.regras = null;
    this.robots = null;
    this.bloqueado = null;
    this.estat = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };
    this.cookies = new Map();
  }

  cabe(folgaMs = 30000) { return this.agora() + folgaMs <= this.prazoMs; }

  async _bruto(caminho, { metodo = 'GET', corpo = null, aceitar = '*/*', timeoutMs = 120000 } = {}) {
    if (this.agora() >= this.prazoMs) throw new SemTempo(`orçamento de tempo esgotado antes de ${caminho}`);
    await vaga();
    try {
      this.estat.requisicoes++;
      const headers = { 'User-Agent': USER_AGENT, Accept: aceitar };
      if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
      if (corpo) headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const res = await this.fetch(this.base + caminho, {
        method: metodo, headers, body: corpo ? String(corpo) : undefined,
        signal: AbortSignal.timeout(timeoutMs), redirect: 'follow',
      });
      for (const c of res.headers?.getSetCookie?.() || []) {
        const m = /^([^=;]+)=([^;]*)/.exec(c);
        if (m) this.cookies.set(m[1].trim(), m[2]);
      }
      const texto = (await res.text()).replace(/^﻿/, '');
      this.estat.bytes += texto.length;
      return { status: res.status, texto, headers: res.headers };
    } finally {
      liberar();
      if (this.pausaMs) await this.dormir(this.pausaMs);
    }
  }

  /** Primeira requisição ao host: o robots.txt. 404 = sem restrições declaradas. */
  async lerRobots() {
    const r = await this._bruto('/robots.txt', { aceitar: 'text/plain' });
    const ehTexto = r.status === 200 && !/^\s*</.test(r.texto);
    this.regras = ehTexto ? interpretarRobots(r.texto) : { disallow: [], allow: [], grupo: 'nenhum' };
    this.robots = {
      host: this.host, lido_em: new Date(this.agora()).toISOString(), status: r.status,
      observacao: ehTexto ? null : r.status === 200 ? 'resposta não é robots.txt (página HTML): sem regras declaradas' : 'robots.txt inexistente: sem regras declaradas',
      grupo_aplicado: this.regras.grupo, disallow: this.regras.disallow, allow: this.regras.allow,
      raiz_permitida: permitido(this.regras, '/'),
    };
    this.log(`[${this.host}] robots.txt HTTP ${r.status}; grupo ${this.regras.grupo}; Disallow ${this.regras.disallow.join(' ') || '(nenhum)'}`);
    return this.robots;
  }

  permite(caminho) {
    if (!this.regras) throw new Error(`robots.txt de ${this.host} ainda não lido`);
    return permitido(this.regras, caminho);
  }

  /**
   * Requisição com retentativas (408/429/5xx/erro de rede). tipo 'json' | 'texto'.
   * 404 → null. 401/403 → Bloqueado (não contorna). Caminho proibido → Bloqueado, sem requisição.
   */
  async obter(caminho, { tipo = 'json', metodo = 'GET', corpo = null, tentativas = 4, timeoutMs, aceitar404 = true } = {}) {
    if (!this.permite(caminho)) throw new Bloqueado(`caminho proibido pelo robots.txt de ${this.host}: ${caminho}`);
    if (this.bloqueado) throw new Bloqueado(this.bloqueado);
    for (let t = 1; t <= tentativas; t++) {
      let r = null;
      let erro = null;
      try {
        r = await this._bruto(caminho, { metodo, corpo, aceitar: tipo === 'json' ? 'application/json' : 'text/html,*/*', timeoutMs });
      } catch (e) {
        if (e instanceof SemTempo) throw e;
        erro = e;
      }
      if (r) {
        if (r.status === 404 && aceitar404) return null;
        if (r.status === 401 || r.status === 403 || /captcha/i.test(r.texto.slice(0, 5000))) {
          this.bloqueado = `${this.host} respondeu ${r.status}${/captcha/i.test(r.texto.slice(0, 5000)) ? ' (captcha)' : ''}; coleta deste host interrompida sem tentativa de contorno`;
          throw new Bloqueado(this.bloqueado);
        }
        if (r.status >= 200 && r.status < 300) {
          if (tipo !== 'json') return { texto: r.texto, headers: r.headers };
          try { return { json: JSON.parse(r.texto), headers: r.headers }; } catch { erro = new Error(`resposta não é JSON em ${caminho}`); }
        } else if (![408, 425, 429, 500, 502, 503, 504].includes(r.status)) {
          const e = new Error(`HTTP ${r.status} em ${this.host}${caminho}`);
          e.status = r.status;
          this.estat.falhas.push(e.message);
          throw e;
        } else {
          erro = Object.assign(new Error(`HTTP ${r.status} em ${this.host}${caminho}`), { status: r.status });
        }
      }
      if (t === tentativas || !this.cabe()) { this.estat.falhas.push(erro.message); throw erro; }
      this.estat.retentativas++;
      await this.dormir(Math.min(30000, 2000 * 2 ** (t - 1)));
    }
    return null;
  }

  async json(caminho, opcoes) { const r = await this.obter(caminho, { ...opcoes, tipo: 'json' }); return r; }
  async texto(caminho, opcoes) { const r = await this.obter(caminho, { ...opcoes, tipo: 'texto' }); return r?.texto ?? null; }
}
