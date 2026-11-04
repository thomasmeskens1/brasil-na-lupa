// Utilitários dos coletores de municípios: User-Agent do projeto, nomes e endereços (slug) de
// municípios, cliente HTTP "educado" para APIs oficiais (robots.txt antes de tudo, intervalo
// mínimo entre requisições ao mesmo host, retentativas curtas) e gravação atômica.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerJson, gravarSeMudou as gravarBruto, hojeISO } from '../alesp/lib.mjs';
import { interpretarRobots, permitido } from '../estados/sapl/http.mjs';

export { lerJson, hojeISO, interpretarRobots, permitido };

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '../../..');
export const DIR_MUNICIPIOS = path.join(RAIZ, 'dados', 'municipios');

/** User-Agent honesto: identifica o projeto e a finalidade. */
export const USER_AGENT =
  'BrasilNaLupa-coletor/1.0 (Brasil na Lupa: coleta automatica de dados abertos oficiais para site neutro de acompanhamento politico; Node.js)';

/** Grava sem campos undefined; não regrava arquivo sem mudança. */
export const gravarSeMudou = (arq, obj) => gravarBruto(arq, JSON.parse(JSON.stringify(obj)));

/** Grava JSON compacto (uma linha por item de "itens") atomicamente, só se mudou. Para arquivos grandes. */
export function gravarCompacto(arq, obj) {
  const limpo = JSON.parse(JSON.stringify(obj));
  const { itens, ...resto } = limpo;
  const linhas = itens && typeof itens === 'object' && !Array.isArray(itens)
    ? Object.entries(itens).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`)
    : null;
  const corpo = JSON.stringify(resto, null, 2);
  const NL = '\n';
  const texto = linhas
    ? corpo.slice(0, -2) + (Object.keys(resto).length ? ',' : '') + NL + '  "itens": {' + NL + linhas.join(',' + NL) + NL + '  }' + NL + '}' + NL
    : JSON.stringify(limpo) + NL;
  try { if (fs.readFileSync(arq, 'utf8') === texto) return false; } catch { /* novo */ }
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const tmp = `${arq}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, texto, 'utf8');
  fs.renameSync(tmp, arq);
  return true;
}

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sem acentos, minúsculas, espaços simples. */
export function semAcento(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Endereço do município: "São José dos Campos" → "sao-jose-dos-campos"; "Pau-d'Arco" → "pau-darco". */
export function slugCidade(nome) {
  return semAcento(nome).replace(/['’`´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Chave de comparação de nomes (sem acento, sem hífen/apóstrofo, "d'" e "d " iguais). */
export function chaveNome(nome) {
  return semAcento(nome).replace(/['’`´-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Cliente de um host com intervalo mínimo entre o início de duas requisições (contando desde a
 * primeira) e robots.txt lido antes de qualquer outra. Para hosts sem Crawl-delay usa o intervalo
 * padrão informado; com Crawl-delay usa o maior dos dois.
 */
export class ClienteEducado {
  constructor(base, { intervaloMs = 1500, prazoMs = Infinity, fetchImpl = fetch, dormirImpl = dormir, agora = Date.now, log = () => {} } = {}) {
    this.base = base.replace(/\/$/, '');
    this.intervaloMs = intervaloMs;
    this.prazoMs = prazoMs;
    this.fetch = fetchImpl;
    this.dormir = dormirImpl;
    this.agora = agora;
    this.log = log;
    this.proximaMs = 0;
    this.regras = null;
    this.robots = null;
    this.requisicoes = 0;
    this.falhas = [];
  }

  cabe(folgaMs = 30000) {
    return Math.max(this.agora(), this.proximaMs) + folgaMs <= this.prazoMs;
  }

  async _bruto(caminho, aceitar) {
    const espera = this.proximaMs - this.agora();
    if (espera > 0) await this.dormir(espera);
    this.proximaMs = this.agora() + this.intervaloMs;
    this.requisicoes++;
    const res = await this.fetch(this.base + caminho, {
      headers: { 'User-Agent': USER_AGENT, Accept: aceitar },
      signal: AbortSignal.timeout(120000),
      redirect: 'follow',
    });
    const texto = (await res.text()).replace(/^﻿/, '');
    return { status: res.status, texto };
  }

  async lerRobots() {
    const r = await this._bruto('/robots.txt', 'text/plain');
    // 404 = sem restrições declaradas; robots em HTML (página de erro) também não declara regras.
    const valido = r.status === 200 && !/^\s*</.test(r.texto);
    const regras = valido ? interpretarRobots(r.texto) : { disallow: [], allow: [], crawl_delay: null };
    this.regras = regras;
    if (regras.crawl_delay != null) this.intervaloMs = Math.max(this.intervaloMs, (Math.ceil(regras.crawl_delay) + 1) * 1000);
    this.proximaMs = this.agora() + this.intervaloMs;
    this.robots = { status: r.status, crawl_delay_s: regras.crawl_delay, intervalo_usado_s: this.intervaloMs / 1000, disallow: regras.disallow };
    return this.robots;
  }

  /** GET JSON; null em 404. Até 3 tentativas em 429/5xx/erro de rede. */
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
      await this.dormir(this.intervaloMs * t);
    }
    return null;
  }
}

/** fetch que troca o User-Agent pelo do projeto (para reaproveitar clientes que fixam outro). */
export function fetchComNossoAgente(fetchImpl = fetch) {
  return (url, op = {}) => fetchImpl(url, { ...op, headers: { ...(op.headers || {}), 'User-Agent': USER_AGENT } });
}
