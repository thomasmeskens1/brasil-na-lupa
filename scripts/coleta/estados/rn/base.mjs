// Base comum dos coletores estaduais RN e ES (Brasil na Lupa).
// - HTTP: reaproveita obter() do coletor ALESP (mesmo User-Agent, no máximo 2 requisições simultâneas,
//   5 tentativas com espera crescente) e acrescenta, por host, a leitura do robots.txt ANTES de qualquer
//   outra requisição, a obediência a Disallow/Allow e Crawl-delay.
// - Privacidade (diretriz 12): textos oficiais passam pelo mascaramento do coletor de Atibaia
//   (nomes de particulares → "[nome de particular omitido]", documentos → "[documento omitido]");
//   e todo objeto é verificado antes da gravação (nenhuma chave de CPF/telefone/nascimento,
//   nenhum CPF formatado, e-mail só institucional).
// - Orçamento de tempo: COLETA_ORCAMENTO_MIN (padrão 20 minutos).
// Este arquivo também é importado por scripts/coleta/estados/es/ (mesmo dono).
import fs from 'node:fs';
import path from 'node:path';
import { obter, dormir, lerJson, gravarSeMudou, hojeISO, estatisticas, contagemGravacao, normalizarNome, USER_AGENT } from '../../alesp/lib.mjs';
import { ementaPublica } from '../../atibaia/privacidade.mjs';

export { lerJson, gravarSeMudou, hojeISO, estatisticas, contagemGravacao, normalizarNome, USER_AGENT };

// ---------------------------------------------------------------- robots.txt
const ROBOTS = new Map(); // host → { status, crawl_delay_s, disallow[], allow[], lido_em, observacao } | Promise
const ULTIMA = new Map(); // host → horário (ms) da última requisição liberada (para Crawl-delay)
const MEU_AGENTE = 'BrasilNaLupa-coletor';

/** Interpreta o robots.txt: regras do grupo que cita nosso agente; senão, do grupo "*". */
export function interpretarRobots(texto) {
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
  const meu = grupos.find((g) => g.agentes.some((a) => a !== '*' && MEU_AGENTE.toLowerCase().includes(a)));
  const g = meu || grupos.find((x) => x.agentes.includes('*'));
  return { disallow: g?.disallow || [], allow: g?.allow || [], crawl_delay_s: g?.crawl_delay_s ?? null };
}

function casaPadrao(padrao, caminho) {
  const re = new RegExp('^' + padrao.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
  return re.test(caminho);
}
/** true se o caminho é permitido (regra mais longa vence; Allow vence empate). */
export function permitido(regras, caminho) {
  let melhor = null;
  for (const [tipo, lista] of [['disallow', regras.disallow], ['allow', regras.allow]]) {
    for (const p of lista) {
      if (casaPadrao(p, caminho) && (!melhor || p.length > melhor.p.length || (p.length === melhor.p.length && tipo === 'allow'))) melhor = { tipo, p };
    }
  }
  return !melhor || melhor.tipo === 'allow';
}

async function carregarRobots(host) {
  const url = `https://${host}/robots.txt`;
  const lido_em = new Date().toISOString();
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/plain,*/*' }, signal: AbortSignal.timeout(60000) });
    estatisticas.requisicoes++;
  } catch (e) {
    // Sem resposta: por cautela, nada é coletado do host nesta execução.
    return { url, status: null, lido_em, bloqueado: true, disallow: ['/'], allow: [], crawl_delay_s: null, observacao: `robots.txt inacessível (${e.message}); host não coletado nesta execução` };
  }
  const corpo = await res.text();
  if (res.status >= 500) {
    return { url, status: res.status, lido_em, bloqueado: true, disallow: ['/'], allow: [], crawl_delay_s: null, observacao: `robots.txt respondeu HTTP ${res.status}; host não coletado nesta execução` };
  }
  if (!res.ok) return { url, status: res.status, lido_em, bloqueado: false, disallow: [], allow: [], crawl_delay_s: null, observacao: `sem robots.txt (HTTP ${res.status}): nenhuma restrição declarada` };
  const tipo = res.headers.get('content-type') || '';
  if (/html/i.test(tipo) || /^\s*</.test(corpo)) {
    return { url, status: res.status, lido_em, bloqueado: false, disallow: [], allow: [], crawl_delay_s: null, observacao: 'o endereço devolve uma página HTML, não um robots.txt: nenhuma restrição declarada' };
  }
  const r = interpretarRobots(corpo);
  return { url, status: res.status, lido_em, bloqueado: false, ...r, observacao: 'robots.txt lido e obedecido' };
}

/** Lê (uma vez por execução) o robots.txt do host. */
export async function robotsDe(host) {
  if (!ROBOTS.has(host)) ROBOTS.set(host, carregarRobots(host));
  const r = await ROBOTS.get(host);
  ROBOTS.set(host, r);
  return r;
}
/** Resumo dos robots lidos, para meta.json. */
export function resumoRobots() {
  const o = {};
  for (const [h, r] of ROBOTS) if (!(r instanceof Promise)) o[h] = { url: r.url, status: r.status, lido_em: r.lido_em, crawl_delay_s: r.crawl_delay_s, disallow: r.disallow, allow: r.allow, observacao: r.observacao };
  return o;
}

/** GET respeitando robots.txt (lido antes da 1.ª requisição ao host) e Crawl-delay. */
export async function buscar(url, opcoes = {}) {
  const u = new URL(url);
  const r = await robotsDe(u.host);
  if (r.bloqueado || !permitido(r, u.pathname + u.search)) {
    throw Object.assign(new Error(`bloqueado pelo robots.txt de ${u.host}: ${u.pathname}`), { robots: true });
  }
  if (r.crawl_delay_s) {
    // Fila por host: cada requisição espera o intervalo declarado desde a anterior.
    const anterior = ULTIMA.get(u.host) || Promise.resolve(0);
    const minha = anterior.then(async (t) => {
      const falta = t + r.crawl_delay_s * 1000 - Date.now();
      if (falta > 0) await dormir(falta);
      return Date.now();
    });
    ULTIMA.set(u.host, minha);
    await minha;
  }
  return obter(url, opcoes);
}

/** Executa fn sobre os itens com no máximo n tarefas ao mesmo tempo (o limite de rede segue em obter()). */
export async function emLotes(itens, fn, n = 2) {
  const res = new Array(itens.length);
  let i = 0;
  async function trabalhador() { while (i < itens.length) { const k = i++; res[k] = await fn(itens[k], k); } }
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, trabalhador));
  return res;
}

// ---------------------------------------------------------------- orçamento de tempo
export function criarOrcamento(reservaMin = 2) {
  const min = Number(process.env.COLETA_ORCAMENTO_MIN);
  const total = Number.isFinite(min) && min > 0 ? min : 20;
  const inicio = Date.now();
  const fim = inicio + total * 60000;
  return {
    minutos: total,
    inicio,
    /** true enquanto ainda há tempo (descontada a reserva para gravar índices e meta). */
    resta: () => Date.now() < fim - reservaMin * 60000,
    decorrido: () => (Date.now() - inicio) / 1000,
  };
}

// ---------------------------------------------------------------- privacidade
/**
 * Texto oficial pronto para gravar: documentos pessoais e nomes de particulares mascarados
 * (regras do coletor de Atibaia). Trechos em dúvida ficam como "[trecho em dúvida <hash>]",
 * nunca em claro. Devolve { texto, mascarado, duvidas }.
 */
export function textoPublico(texto, regras = []) {
  if (texto == null || texto === '') return { texto: texto ?? null, mascarado: false, duvidas: 0 };
  const limpo = String(texto).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  const r = ementaPublica(limpo, regras);
  return { texto: r.ementa_publica, mascarado: r.ementa_publica !== limpo, duvidas: r.duvidas.length };
}

const CHAVES_PROIBIDAS = /^(cpf|cpf_cnpj|cnpj_cpf|rg|telefone|celular|fone|datanascimento|data_nascimento|nascimento|endereco|cep|pessoaid)$/i;
const CPF_FORMATADO = /(?<![\d.\/])\d{3}\.\d{3}\.\d{3}\s*-\s*\d{2}(?![\d\/])/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const EMAIL_INSTITUCIONAL = /@(?:[a-z0-9-]+\.)*(?:al\.es\.gov\.br|al\.rn\.leg\.br|al\.rn\.gov\.br)$/i;

/** Lança erro se o objeto tiver dado pessoal proibido (rede de segurança antes de gravar). */
export function verificarPrivacidade(obj, onde = '') {
  const visitar = (v, cam) => {
    if (Array.isArray(v)) { v.forEach((x, i) => visitar(x, `${cam}[${i}]`)); return; }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (CHAVES_PROIBIDAS.test(k)) throw new Error(`privacidade: chave proibida "${k}" em ${onde}${cam}`);
        visitar(x, `${cam}.${k}`);
      }
      return;
    }
    if (typeof v === 'string') {
      if (CPF_FORMATADO.test(v)) throw new Error(`privacidade: padrão de CPF em ${onde}${cam}`);
      for (const e of v.match(EMAIL) || []) {
        if (!EMAIL_INSTITUCIONAL.test(e)) throw new Error(`privacidade: e-mail não institucional em ${onde}${cam}`);
      }
    }
  };
  visitar(obj, '');
  return true;
}

/** Grava (atômico, só se mudou) depois de verificar a privacidade. */
export function gravar(arquivo, obj) {
  verificarPrivacidade(obj, path.basename(arquivo));
  return gravarSeMudou(arquivo, obj);
}

// ---------------------------------------------------------------- utilidades
/** "29/10/2026 17:12:36" → { data: '2026-10-29', hora: '17:12' } */
export function dataBR(s) {
  const m = /^\s*(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(s || '');
  return m ? { data: `${m[3]}-${m[2]}-${m[1]}`, hora: m[4] ? `${m[4]}:${m[5]}` : null } : { data: null, hora: null };
}
/** Data AAAA-MM-DD da parte de data de um ISO (sem conversão de fuso: o texto da fonte). */
export const dataISO = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? s.slice(0, 10) : null);

export function listarJson(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('indice-') && f !== 'meta.json');
}

/** Índice anual de votações a partir dos detalhes gravados (mesmo formato da ALESP + uf/casa). */
export function gravarIndicesVotacoes(dirVot, { uf, casa, hoje }) {
  const porAno = new Map();
  for (const f of listarJson(dirVot)) {
    const v = lerJson(path.join(dirVot, f));
    if (!v?.data) continue;
    const ano = Number(v.data.slice(0, 4));
    if (!porAno.has(ano)) porAno.set(ano, []);
    porAno.get(ano).push({
      id: v.id, uf: v.uf, casa: v.casa, data: v.data, hora: v.hora, orgao: v.orgao, orgao_sigla: v.orgao_sigla, orgao_nome: v.orgao_nome,
      proposicao: v.proposicao ? { id: v.proposicao.id, sigla: v.proposicao.sigla, numero: v.proposicao.numero, ano: v.proposicao.ano } : null,
      descricao: v.descricao, resultado: v.resultado, tipo: v.tipo, placar: v.placar,
      votos_publicados: (v.votos || []).length, url: v.url, tem_lacunas: (v.lacunas || []).length > 0,
    });
  }
  const cont = {};
  for (const [ano, itens] of porAno) {
    itens.sort((a, b) => b.data.localeCompare(a.data) || String(b.hora || '').localeCompare(String(a.hora || '')) || a.id.localeCompare(b.id));
    const porTipo = {};
    for (const i of itens) porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1;
    cont[ano] = {
      votacoes: itens.length, por_tipo: porTipo,
      plenario: itens.filter((i) => i.orgao === 'Plenário').length,
      comissoes: itens.filter((i) => i.orgao !== 'Plenário').length,
      com_votos_individuais: itens.filter((i) => i.votos_publicados > 0).length,
      votos: itens.reduce((s, i) => s + i.votos_publicados, 0),
    };
    gravar(path.join(dirVot, `indice-${ano}.json`), { atualizado_em: hoje, uf, casa, ano, itens });
  }
  return cont;
}
