// Base dos coletores de fontes abertas estaduais sem SAPL (PE e DF), Brasil na Lupa. Node 20+, sem dependências.
// - HTTP: robots.txt de cada host lido ANTES de qualquer outra requisição ao host; Disallow/Allow obedecidos;
//   intervalo mínimo entre requisições ao mesmo host (Crawl-delay + 1 s, ou INTERVALO_PADRAO_S se não declarado);
//   User-Agent honesto que cita o projeto. Orçamento de tempo: nenhuma requisição começa depois do prazo.
// - Privacidade (diretriz 12): textos passam pelo mascaramento de scripts/coleta/atibaia/privacidade.mjs e todo
//   objeto é conferido antes de gravar (sem chaves de CPF/IP/login/telefone, sem CPF formatado, e-mail só institucional).
// - Nada é deduzido: campo ausente na fonte fica null e a lacuna é anotada.
import { ementaPublica } from '../../atibaia/privacidade.mjs';
import { lerJson, gravarSeMudou as gravarBruto, hojeISO } from '../../alesp/lib.mjs';

export { lerJson, hojeISO };
export const gravarSeMudou = (arq, obj) => gravarBruto(arq, JSON.parse(JSON.stringify(obj)));

export const USER_AGENT =
  'BrasilNaLupa-coletor/1.0 (Brasil na Lupa: site neutro de acompanhamento politico com dados abertos oficiais; coleta automatica de baixo volume)';
export const INTERVALO_PADRAO_S = 2;
export const VOTO_INDISPONIVEL = 'Informação não disponível em fonte oficial';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- robots.txt
export function interpretarRobots(texto, agente = 'brasilnalupa') {
  const grupos = [];
  let atual = null, ultimaFoiAgente = false;
  for (const bruta of String(texto || '').split(/\r?\n/)) {
    const linha = bruta.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(linha);
    if (!m) continue;
    const campo = m[1].toLowerCase(), valor = m[2].trim();
    if (campo === 'user-agent') {
      if (!ultimaFoiAgente || !atual) { atual = { agentes: [], disallow: [], allow: [], crawl_delay_s: null }; grupos.push(atual); }
      atual.agentes.push(valor.toLowerCase());
      ultimaFoiAgente = true;
      continue;
    }
    ultimaFoiAgente = false;
    if (!atual) continue;
    if (campo === 'disallow' && valor) atual.disallow.push(valor);
    else if (campo === 'allow' && valor) atual.allow.push(valor);
    else if (campo === 'crawl-delay' && Number.isFinite(Number(valor))) atual.crawl_delay_s = Number(valor);
  }
  const ua = USER_AGENT.toLowerCase();
  const meu = grupos.find((g) => g.agentes.some((a) => a !== '*' && (ua.includes(a) || a.includes(agente))));
  const g = meu || grupos.find((x) => x.agentes.includes('*'));
  return { disallow: g?.disallow || [], allow: g?.allow || [], crawl_delay_s: g?.crawl_delay_s ?? null };
}

function casaPadrao(padrao, caminho) {
  const re = new RegExp('^' + padrao.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
  return re.test(caminho);
}
/** true se o caminho (com query) é permitido: a regra mais longa vence; Allow vence empate. */
export function permitido(regras, caminho) {
  let melhor = null;
  for (const [tipo, lista] of [['disallow', regras.disallow], ['allow', regras.allow]]) {
    for (const p of lista) {
      if (casaPadrao(p, caminho) && (!melhor || p.length > melhor.p.length || (p.length === melhor.p.length && tipo === 'allow'))) melhor = { tipo, p };
    }
  }
  return !melhor || melhor.tipo === 'allow';
}

// ---------------------------------------------------------------- cliente HTTP
export class Cliente {
  constructor({ prazoMs, log = () => {}, fetchImpl = fetch, dormirImpl = dormir, agora = Date.now, intervaloPadraoS = INTERVALO_PADRAO_S } = {}) {
    Object.assign(this, { prazoMs, log, fetchImpl, dormirImpl, agora, intervaloPadraoS });
    this.robots = new Map(); // host → regras
    this.proxima = new Map(); // host → epoch ms
    this.requisicoes = 0;
    this.falhas = [];
  }

  cabe(folgaMs = 20000) { return this.agora() + folgaMs <= this.prazoMs; }

  async _esperarVez(host, intervaloS) {
    const falta = (this.proxima.get(host) || 0) - this.agora();
    if (falta > 0) await this.dormirImpl(falta);
    this.proxima.set(host, this.agora() + intervaloS * 1000);
  }

  async _robots(host) {
    if (this.robots.has(host)) return this.robots.get(host);
    await this._esperarVez(host, this.intervaloPadraoS);
    const url = `https://${host}/robots.txt`;
    const lido_em = new Date(this.agora()).toISOString();
    let r;
    try {
      this.requisicoes++;
      const res = await this.fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/plain,*/*' }, signal: AbortSignal.timeout(60000) });
      const corpo = await res.text();
      const tipo = res.headers?.get?.('content-type') || '';
      if (res.status >= 500) r = { status: res.status, bloqueado: true, observacao: `robots.txt respondeu HTTP ${res.status}; host não coletado nesta execução` };
      else if (res.status >= 400) r = { status: res.status, observacao: `sem robots.txt (HTTP ${res.status}): nenhuma restrição declarada (RFC 9309)` };
      else if (/html/i.test(tipo) || /^\s*</.test(corpo)) r = { status: res.status, observacao: 'o endereço devolve uma página HTML, não um robots.txt: nenhuma restrição declarada' };
      else r = { status: res.status, ...interpretarRobots(corpo), observacao: 'robots.txt lido e obedecido' };
    } catch (e) {
      r = { status: null, bloqueado: true, observacao: `robots.txt inacessível (${e.message}); host não coletado nesta execução` };
    }
    const regras = { url, lido_em, disallow: [], allow: [], crawl_delay_s: null, bloqueado: false, ...r };
    regras.intervalo_usado_s = regras.crawl_delay_s != null ? Math.max(this.intervaloPadraoS, Math.ceil(regras.crawl_delay_s) + 1) : this.intervaloPadraoS;
    this.robots.set(host, regras);
    this.log(`robots.txt de ${host}: ${regras.observacao}; intervalo ${regras.intervalo_usado_s} s`);
    return regras;
  }

  resumoRobots() {
    return Object.fromEntries([...this.robots].map(([h, r]) => [h, { url: r.url, status: r.status, lido_em: r.lido_em, crawl_delay_s: r.crawl_delay_s, intervalo_usado_s: r.intervalo_usado_s, disallow: r.disallow, observacao: r.observacao }]));
  }

  /** GET/POST com robots.txt, intervalo por host e até 3 tentativas (429/5xx/rede). Devolve o texto ou null (404). */
  async texto(url, { metodo = 'GET', corpo = null, tipoCorpo = 'application/json', aceitar = '*/*' } = {}) {
    const u = new URL(url);
    const regras = await this._robots(u.host);
    if (regras.bloqueado || !permitido(regras, u.pathname + u.search)) throw Object.assign(new Error(`bloqueado pelo robots.txt de ${u.host}: ${u.pathname}`), { robots: true });
    for (let t = 1; t <= 3; t++) {
      if (!this.cabe()) throw Object.assign(new Error('orçamento de tempo esgotado'), { orcamento: true });
      await this._esperarVez(u.host, regras.intervalo_usado_s * (t > 1 ? 3 : 1));
      this.requisicoes++;
      let res;
      try {
        const headers = { 'User-Agent': USER_AGENT, Accept: aceitar };
        if (corpo != null) headers['Content-Type'] = tipoCorpo;
        res = await this.fetchImpl(url, { method: metodo, headers, body: corpo == null ? undefined : (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)), signal: AbortSignal.timeout(120000) });
      } catch (e) {
        this.falhas.push(`${metodo} ${url}: ${e.message}`);
        if (t === 3) throw e;
        continue;
      }
      if (res.status === 404) return null;
      if (res.ok) return (await res.text()).replace(/^﻿/, '');
      this.falhas.push(`${metodo} ${url}: HTTP ${res.status}`);
      if (![408, 429, 500, 502, 503, 504].includes(res.status) || t === 3) throw Object.assign(new Error(`HTTP ${res.status} em ${url}`), { status: res.status });
    }
    return null;
  }

  async json(url, op = {}) {
    const t = await this.texto(url, { aceitar: 'application/json', ...op });
    if (t == null) return null;
    try { return JSON.parse(t); } catch { throw new Error(`resposta não é JSON em ${url}`); }
  }
}

// ---------------------------------------------------------------- textos e datas
export const limpar = (s) => (s == null ? null : String(s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim() || null);

/** Texto oficial com nomes de particulares e documentos mascarados. pendente = há trecho em dúvida. */
export function textoPublico(texto, regras = []) {
  const t = limpar(texto);
  if (!t) return { texto: t, pendente: false };
  const r = ementaPublica(t, regras);
  return { texto: r.ementa_publica, pendente: r.duvidas.length > 0 };
}
export const LACUNA_PRIVACIDADE =
  'Trecho com possível nome de particular aguardando conferência; mostrado como "[trecho em dúvida …]" até a curadoria (diretriz 12).';

/** "dd/mm/aaaa" ou "aaaa-mm-dd[T…]" → "aaaa-mm-dd"; datas impossíveis ou posteriores a hoje → null. */
export function dataISO(v, hoje = hojeISO()) {
  const s = limpar(v);
  if (!s) return null;
  let m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  let iso = m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  if (!iso && (m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) iso = `${m[1]}-${m[2]}-${m[3]}`;
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso || iso > hoje || iso < '1800-01-01') return null;
  return iso;
}

export const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const chaveNome = (s) => semAcento(s).toUpperCase().replace(/\s+/g, ' ').trim();
export const slug = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** E-mail só se for de domínio institucional da Casa. */
export function emailInstitucional(email, dominios) {
  const e = limpar(email)?.toLowerCase();
  if (!e || !/^[^@\s]+@[^@\s]+$/.test(e)) return null;
  const dom = e.split('@')[1];
  return dominios.some((d) => dom === d || dom.endsWith(`.${d}`)) ? e : null;
}

// ---------------------------------------------------------------- conferência de privacidade antes de gravar
const CHAVES_PROIBIDAS = /^(cpf|rg|ip|ipusuario|loginrede|usuariologin|login|telefone|celular|nascimento|datanascimento|endereco|cep|matricula)$/i;
/** Lança erro se o objeto tiver chave proibida, CPF formatado ou documento pessoal em texto. */
export function conferirPrivacidade(obj, caminho = '$') {
  if (Array.isArray(obj)) { obj.forEach((x, i) => conferirPrivacidade(x, `${caminho}[${i}]`)); return; }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (CHAVES_PROIBIDAS.test(k.replace(/_/g, ''))) throw new Error(`privacidade: chave proibida "${k}" em ${caminho}`);
      conferirPrivacidade(v, `${caminho}.${k}`);
    }
    return;
  }
  // Número com cara de CPF (com ou sem pontos) ou de RG formatado; a palavra "CPF" sozinha pode estar numa ementa.
  if (typeof obj === 'string' && (/(?<![\d.\/])\d{3}\.\d{3}\.\d{3}\s*-\s*\d{2}(?![\d\/])/.test(obj) || /(?<![\d.])\d{1,2}\.\d{3}\.\d{3}\s*-\s*[\dXx](?![\d\/])/.test(obj))) {
    throw new Error(`privacidade: documento pessoal em ${caminho}`);
  }
}

export const fonte = (titulo, url, orgao, hoje) => ({ titulo, url, orgao, acessado_em: hoje });
