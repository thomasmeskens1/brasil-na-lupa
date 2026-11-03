// Cliente HTTP do coletor de participação oficial (e-Cidadania do Senado e enquetes da Câmara).
//   - O robots.txt de cada host é a PRIMEIRA requisição a esse host (leitura conforme a RFC 9309:
//     linhas em branco não separam grupos; a regra mais longa vence; empate favorece Allow).
//   - No máximo 2 requisições simultâneas no processo inteiro, pausa entre requisições,
//     retentativas com espera crescente e tempo limite curto por requisição.
//   - Nenhuma requisição começa depois do prazo (orçamento de tempo).
//   - Sem contornar bloqueio: 401/403/captcha encerram a coleta daquele host.
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

/** Interpreta o robots.txt (RFC 9309) e devolve as regras que valem para o nosso agente. */
export function interpretarRobots(texto, agente = USER_AGENT) {
  const grupos = [];
  let atual = null;
  let lendoAgentes = false;
  for (const bruta of String(texto || '').split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, '').trim();
    if (!linha) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(linha);
    if (!m) continue;
    const campo = m[1].toLowerCase();
    const valor = m[2].trim();
    if (campo === 'user-agent') {
      if (!lendoAgentes) { atual = { agentes: [], disallow: [], allow: [], crawlDelay: null }; grupos.push(atual); }
      atual.agentes.push(valor.toLowerCase());
      lendoAgentes = true;
      continue;
    }
    lendoAgentes = false;
    if (!atual) continue;
    if (campo === 'disallow' && valor) atual.disallow.push(valor);
    else if (campo === 'allow' && valor) atual.allow.push(valor);
    else if (campo === 'crawl-delay' && Number(valor) > 0) atual.crawlDelay = Number(valor);
  }
  const produto = agente.toLowerCase().split('/')[0];
  const especificos = grupos.filter((g) => g.agentes.some((a) => a !== '*' && produto.includes(a)));
  const usados = especificos.length ? especificos : grupos.filter((g) => g.agentes.includes('*'));
  const atrasos = usados.map((g) => g.crawlDelay).filter(Boolean);
  return {
    disallow: usados.flatMap((g) => g.disallow),
    allow: usados.flatMap((g) => g.allow),
    crawlDelay: atrasos.length ? Math.max(...atrasos) : null,
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
  constructor(host, { prazoMs = Infinity, log = () => {}, fetchImpl = fetch, dormir = dormirPadrao, agora = Date.now, pausaMs = 1000, timeoutMs = 20000 } = {}) {
    Object.assign(this, { host, prazoMs, log, fetch: fetchImpl, dormir, agora, pausaMs, timeoutMs });
    this.base = `https://${host}`;
    this.regras = null;
    this.robots = null;
    this.bloqueado = null;
    this.estat = { requisicoes: 0, retentativas: 0, bytes: 0, falhas: [] };
  }

  cabe(folgaMs = 15000) { return this.agora() + folgaMs <= this.prazoMs; }

  async _bruto(caminho, { aceitar = '*/*', binario = false } = {}) {
    if (this.agora() >= this.prazoMs) throw new SemTempo(`orçamento de tempo esgotado antes de ${caminho}`);
    await vaga();
    try {
      this.estat.requisicoes++;
      const res = await this.fetch(this.base + caminho, {
        headers: { 'User-Agent': USER_AGENT, Accept: aceitar },
        signal: AbortSignal.timeout(this.timeoutMs), redirect: 'manual',
      });
      const corpo = binario ? Buffer.from(await res.arrayBuffer()) : (await res.text()).replace(/^﻿/, '');
      this.estat.bytes += corpo.length;
      return { status: res.status, corpo, headers: res.headers };
    } finally {
      liberar();
      const espera = Math.max(this.pausaMs, (this.regras?.crawlDelay || 0) * 1000);
      if (espera) await this.dormir(espera);
    }
  }

  /** Primeira requisição ao host: o robots.txt. 404 ou resposta HTML = sem regras declaradas. */
  async lerRobots() {
    const r = await this._bruto('/robots.txt', { aceitar: 'text/plain' });
    const texto = String(r.corpo);
    const ehTexto = r.status === 200 && !/^\s*</.test(texto);
    if (r.status === 401 || r.status === 403) {
      this.regras = { disallow: ['/'], allow: [], crawlDelay: null, grupo: 'bloqueio' };
      this.bloqueado = `${this.host} respondeu ${r.status} ao robots.txt; host não coletado`;
    } else {
      this.regras = ehTexto ? interpretarRobots(texto) : { disallow: [], allow: [], crawlDelay: null, grupo: 'nenhum' };
    }
    this.robots = {
      host: this.host, lido_em: new Date(this.agora()).toISOString(), status: r.status,
      observacao: this.bloqueado ?? (ehTexto ? null : r.status === 200 ? 'resposta não é robots.txt (página HTML): sem regras declaradas' : 'robots.txt inexistente: sem regras declaradas'),
      grupo_aplicado: this.regras.grupo, disallow: this.regras.disallow, allow: this.regras.allow,
      crawl_delay: this.regras.crawlDelay,
    };
    this.log(`[${this.host}] robots.txt HTTP ${r.status}; grupo ${this.regras.grupo}; Disallow ${this.regras.disallow.join(' ') || '(nenhum)'}`);
    return this.robots;
  }

  permite(caminho) {
    if (!this.regras) throw new Error(`robots.txt de ${this.host} ainda não lido`);
    return permitido(this.regras, caminho);
  }

  /**
   * GET com retentativas (408/429/5xx/erro de rede). Retorna { status, corpo, headers }.
   * 404 → null. 401/403/captcha → Bloqueado. Caminho proibido → Bloqueado, sem requisição.
   * Redirecionamentos não são seguidos: o chamador decide (o destino pode ser outro host).
   */
  async obter(caminho, { tentativas = 3, binario = false, aceitar = 'text/html,*/*', statusAceitos = [] } = {}) {
    if (this.bloqueado) throw new Bloqueado(this.bloqueado);
    if (!this.permite(caminho)) throw new Bloqueado(`caminho proibido pelo robots.txt de ${this.host}: ${caminho}`);
    let erro = null;
    for (let t = 1; t <= tentativas; t++) {
      let r = null;
      try {
        r = await this._bruto(caminho, { aceitar, binario });
      } catch (e) {
        if (e instanceof SemTempo) throw e;
        erro = e;
      }
      if (r) {
        const inicio = binario ? '' : String(r.corpo).slice(0, 5000);
        if (r.status === 404) return null;
        if (r.status === 401 || r.status === 403 || /captcha/i.test(inicio)) {
          this.bloqueado = `${this.host} respondeu ${r.status}${/captcha/i.test(inicio) ? ' (captcha)' : ''}; coleta deste host interrompida sem tentativa de contorno`;
          throw new Bloqueado(this.bloqueado);
        }
        if ((r.status >= 200 && r.status < 400) || statusAceitos.includes(r.status)) return r;
        erro = Object.assign(new Error(`HTTP ${r.status} em ${this.host}${caminho}`), { status: r.status });
        if (![408, 425, 429, 500, 502, 503, 504].includes(r.status)) { this.estat.falhas.push(erro.message); throw erro; }
      }
      if (t === tentativas || !this.cabe()) { this.estat.falhas.push(erro.message); throw erro; }
      this.estat.retentativas++;
      await this.dormir(Math.min(20000, 2000 * 2 ** (t - 1)));
    }
    throw erro;
  }
}
