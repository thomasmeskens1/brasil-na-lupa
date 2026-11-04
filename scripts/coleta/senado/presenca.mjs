#!/usr/bin/env node
/**
 * Presença em Plenário do Senado Federal → dados/senado/presenca/<ano>.json e sessoes-<ano>.json
 *
 * USO (Node 20+, sem dependências):
 *   node scripts/coleta/senado/presenca.mjs              # ano corrente (horário de Brasília)
 *   node scripts/coleta/senado/presenca.mjs --ano 2026
 *
 * O QUE A FONTE OFICIAL TRAZ (verificado em 03/11/2026):
 *   - Sessões do Plenário: GET /plenario/agenda/mes/{AAAAMM01} (tipo da sessão, situação, data, código).
 *     Daqui saem as sessões deliberativas (ordinárias e extraordinárias) encerradas no ano.
 *   - NÃO há, nos Dados Abertos do Senado (legis.senado.leg.br/dadosabertos) nem nos Dados Abertos
 *     Administrativos (adm.senado.gov.br), lista de presença por sessão ou frequência por senador: o detalhe
 *     da sessão (/plenario/encontro/{codigo} e /resumo) e o resultado (/plenario/resultado/{data}) não trazem
 *     quem compareceu, e a página do senador e a de transparência também não. Por isso os campos de
 *     presença por sessão ficam null, com o texto "Informação não disponível em fonte oficial" (diretriz 1).
 *   - Registro oficial de cada senador nas votações do ano: GET /votacao?dataInicio=&dataFim= (lista de
 *     cada votação, com a sigla de comparecimento: Sim, Não, "Presente – Não registrou voto", "Licença
 *     saúde", "Não Compareceu" etc.; descrições em /plenario/lista/tiposComparecimento). É registro POR
 *     VOTAÇÃO, não por sessão: é contado literalmente, sem converter em presença.
 *   - Licenças oficiais: GET /senador/{codigo}/licencas?dataInicio=&dataFim= (períodos e tipo).
 *   - Senadores em exercício: GET /senador/lista/atual.
 *
 * REGRAS: robots.txt de cada host lido antes de qualquer outra requisição; no máximo 2 requisições
 * simultâneas; retentativas com espera crescente (429/5xx/rede); gravação atômica (temporário + rename)
 * e só se o conteúdo mudar (ignorando atualizado_em, acessado_em, verificado_em).
 *
 * Este arquivo também exporta os utilitários de rede e gravação usados por despesas.mjs.
 */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = 'https://legis.senado.leg.br/dadosabertos';
export const USER_AGENT = 'BrasilNaLupa-coletor/1.0 (coleta diaria de dados abertos; +https://github.com/thomasmeskens1/brasil-na-lupa)';
export const ORGAO = 'Senado Federal';
export const NAO_DISPONIVEL = 'Informação não disponível em fonte oficial';
const MAX_PARALELO = 2;
const TENTATIVAS = 5;
const INTERVALO_MIN_MS = 250; // por host; o Senado pede menos de 10 requisições por segundo

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const SAIDA_SENADO = path.resolve(AQUI, '../../../dados/senado');

export const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // Brasília
export const fonte = (titulo, url, dia) => ({ titulo, url, orgao: ORGAO, acessado_em: dia });
export const cmpPt = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { sensitivity: 'base' });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- robots.txt ----------
const regrasRobots = new Map(); // host → { disallow, allow, sem_arquivo?, erro? }

/** Interpreta o grupo "User-agent: *" de um robots.txt. */
export function lerRobots(texto) {
  const regras = { disallow: [], allow: [] };
  let noGrupo = false, viuRegra = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, '').trim();
    const m = linha.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const campo = m[1].toLowerCase(), valor = m[2].trim();
    if (campo === 'user-agent') { if (viuRegra) { noGrupo = false; viuRegra = false; } if (valor === '*') noGrupo = true; continue; }
    viuRegra = true;
    if (!noGrupo) continue;
    if (campo === 'disallow' && valor) regras.disallow.push(valor);
    if (campo === 'allow' && valor) regras.allow.push(valor);
  }
  return regras;
}

/** true se o caminho é permitido pelas regras (regra mais longa vence; Allow ganha empate). */
export function permitido(regras, url) {
  if (!regras) return false;
  const u = new URL(url);
  const alvo = u.pathname + u.search;
  let melhor = { tam: -1, ok: true };
  for (const p of regras.disallow) if (alvo.startsWith(p) && p.length > melhor.tam) melhor = { tam: p.length, ok: false };
  for (const p of regras.allow) if (alvo.startsWith(p) && p.length >= melhor.tam) melhor = { tam: p.length, ok: true };
  return melhor.ok;
}

/**
 * Lê o robots.txt do host antes de qualquer outra requisição a ele. Sem arquivo (403/404 ou página HTML no
 * lugar do arquivo): host sem restrição declarada, registrado como tal. Erro de rede: host tratado como bloqueado.
 */
export async function carregarRobots(host) {
  if (regrasRobots.has(host)) return regrasRobots.get(host);
  try {
    const res = await fetch(`https://${host}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30000) });
    estat.requisicoes++;
    const corpo = await res.text();
    if (res.ok && !/<html/i.test(corpo)) regrasRobots.set(host, lerRobots(corpo));
    else regrasRobots.set(host, { disallow: [], allow: [], sem_arquivo: `HTTP ${res.status}${/<html/i.test(corpo) ? ' (página HTML, não é robots.txt)' : ''}` });
  } catch (e) {
    regrasRobots.set(host, { disallow: ['/'], allow: [], erro: e.message });
  }
  return regrasRobots.get(host);
}
export const robotsCarregados = () => Object.fromEntries([...regrasRobots].sort(([a], [b]) => a.localeCompare(b)).map(([h, r]) => [h, {
  disallow: r.disallow, allow: r.allow, ...(r.sem_arquivo ? { sem_arquivo: r.sem_arquivo } : {}), ...(r.erro ? { erro: r.erro } : {}),
}]));

// ---------- HTTP: até 2 simultâneas, retentativas ----------
export const estat = { requisicoes: 0, retentativas: 0, bytes: 0 };
let ativos = 0;
const fila = [];
const ultimoAcesso = new Map();
async function comVaga(fn) {
  if (ativos >= MAX_PARALELO) await new Promise((r) => fila.push(r));
  ativos++;
  try { return await fn(); } finally { ativos--; const prox = fila.shift(); if (prox) prox(); }
}

/** GET com robots.txt conferido; tipo 'json' | 'text'. Retorna também ETag e Last-Modified em `meta`. */
export async function obter(url, { tipo = 'json', timeoutMs = 120_000 } = {}) {
  const host = new URL(url).host;
  const regras = await carregarRobots(host);
  if (!permitido(regras, url)) throw Object.assign(new Error(`bloqueado pelo robots.txt: ${url}`), { definitivo: true });
  return comVaga(async () => {
    let ultimoErro;
    for (let t = 1; t <= TENTATIVAS; t++) {
      const desde = Date.now() - (ultimoAcesso.get(host) ?? 0);
      if (desde < INTERVALO_MIN_MS) await esperar(INTERVALO_MIN_MS - desde);
      ultimoAcesso.set(host, Date.now());
      estat.requisicoes++;
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: tipo === 'json' ? 'application/json' : '*/*' },
          redirect: 'follow', signal: AbortSignal.timeout(timeoutMs),
        });
        if (r.ok) {
          const texto = (await r.text()).replace(/^﻿/, '');
          estat.bytes += texto.length;
          return tipo === 'json' ? JSON.parse(texto) : texto;
        }
        ultimoErro = new Error(`HTTP ${r.status} em ${url}`);
        if (r.status !== 429 && r.status !== 408 && r.status < 500) throw Object.assign(ultimoErro, { definitivo: true });
        const ra = Number(r.headers.get('retry-after'));
        if (t < TENTATIVAS) { estat.retentativas++; await esperar(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) * 1000 : 1500 * 2 ** (t - 1)); }
      } catch (e) {
        if (e.definitivo) throw e;
        ultimoErro = e;
        if (t < TENTATIVAS) { estat.retentativas++; await esperar(1500 * 2 ** (t - 1) + Math.random() * 500); }
      }
    }
    throw new Error(`Falha após ${TENTATIVAS} tentativas: ${url} (${ultimoErro?.message})`);
  });
}

/** Executa fn para cada item (o limite de 2 simultâneas é aplicado em obter). */
export async function paraCada(itens, fn) {
  const fila2 = [...itens];
  await Promise.all(Array.from({ length: MAX_PARALELO }, async () => { while (fila2.length) await fn(fila2.shift()); }));
}

// ---------- arquivos: escrita atômica, só se mudou ----------
const VOLATEIS = new Set(['atualizado_em', 'acessado_em', 'verificado_em']);
const semVolateis = (o) => JSON.stringify(o, (k, v) => (VOLATEIS.has(k) ? undefined : v));
export async function lerJson(arq) {
  if (!existsSync(arq)) return null;
  try { return JSON.parse(await readFile(arq, 'utf8')); } catch { return null; }
}
/** JSON legível; elementos das listas grandes ficam um por linha (diff pequeno no git). */
const COMPACTAS = new Set(['itens', 'sessoes', 'por_mes', 'por_tipo', 'por_fornecedor', 'por_registro', 'licencas_no_ano']);
export function formatar(v, nivel = 0) {
  const ind = '  '.repeat(nivel), ind2 = '  '.repeat(nivel + 1);
  if (Array.isArray(v)) return v.length ? '[\n' + v.map((x) => ind2 + formatar(x, nivel + 1)).join(',\n') + '\n' + ind + ']' : '[]';
  if (v && typeof v === 'object') {
    const ks = Object.keys(v);
    if (!ks.length) return '{}';
    return '{\n' + ks.map((k) => {
      const x = v[k];
      const s = COMPACTAS.has(k) && Array.isArray(x) && x.length
        ? '[\n' + x.map((e) => ind2 + '  ' + JSON.stringify(e)).join(',\n') + '\n' + ind2 + ']'
        : formatar(x, nivel + 1);
      return `${ind2}${JSON.stringify(k)}: ${s}`;
    }).join(',\n') + '\n' + ind + '}';
  }
  return JSON.stringify(v);
}
export const gravacoes = { gravados: 0, inalterados: 0 };
export async function gravarSeMudou(arq, obj) {
  const antigo = await lerJson(arq);
  if (antigo && semVolateis(antigo) === semVolateis(obj)) { gravacoes.inalterados++; return false; }
  await mkdir(path.dirname(arq), { recursive: true });
  const tmp = `${arq}.${process.pid}.tmp`;
  await writeFile(tmp, formatar(obj) + '\n', 'utf8');
  await rename(tmp, arq);
  gravacoes.gravados++;
  return true;
}

/** Senadores em exercício (/senador/lista/atual) → [{ id, nome, partido, uf, url_oficial }]. */
export async function senadoresEmExercicio() {
  const d = await obter(`${BASE}/senador/lista/atual`);
  const lista = d?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar ?? [];
  if (lista.length < 70) throw new Error(`Lista de senadores suspeita (${lista.length} itens); nada gravado`);
  return lista.map(({ IdentificacaoParlamentar: p = {}, Mandato: m = {} }) => ({
    id: String(p.CodigoParlamentar), nome: p.NomeParlamentar ?? null, partido: p.SiglaPartidoParlamentar ?? null,
    uf: p.UfParlamentar ?? m.UfParlamentar ?? null, url_oficial: p.UrlPaginaParlamentar ?? null,
  }));
}

// ---------- leitores (puros, testados offline) ----------
const lista = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const limpar = (s) => (s == null ? null : String(s).replace(/\s+/g, ' ').trim() || null);

/**
 * Sessões deliberativas do Senado encerradas, a partir das sessões da agenda mensal.
 * Critério literal: Casa "SF", tipo começando por "SESSÃO DELIBERATIVA" (ordinária ou extraordinária;
 * "SESSÃO NÃO DELIBERATIVA" fica fora) e situação "Encerrada". Sessão "Em andamento" fica fora até encerrar.
 */
export function sessoesDeliberativas(sessoesAgenda, ano) {
  const vistos = new Set();
  const saida = [];
  for (const s of sessoesAgenda) {
    const tipo = limpar(s.TipoSessao);
    if (s.Casa !== 'SF' || !/^SESSÃO DELIBERATIVA\b/i.test(tipo ?? '') || limpar(s.SituacaoSessao) !== 'Encerrada') continue;
    if (!String(s.Data ?? '').startsWith(`${ano}-`) || vistos.has(String(s.CodigoSessao))) continue;
    vistos.add(String(s.CodigoSessao));
    saida.push({
      codigo: String(s.CodigoSessao), data: s.Data, hora: s.Hora ?? null, numero: limpar(s.NumeroSessao), tipo,
      situacao: limpar(s.SituacaoSessao), modalidade: limpar(s.DescricaoTipoPresenca),
      url: `${BASE}/plenario/encontro/${s.CodigoSessao}`,
    });
  }
  return saida.sort((a, b) => a.data.localeCompare(b.data) || (a.hora ?? '').localeCompare(b.hora ?? '') || a.codigo.localeCompare(b.codigo));
}

/** Contagem por tipo de sessão na agenda (para o relatório; inclui as não deliberativas). */
export function contagemTipos(sessoesAgenda, ano) {
  const c = {};
  for (const s of sessoesAgenda) {
    if (!String(s.Data ?? '').startsWith(`${ano}-`)) continue;
    const k = `${s.Casa} | ${limpar(s.TipoSessao)} | ${limpar(s.SituacaoSessao)}`;
    c[k] = (c[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Registro de cada senador nas votações (lista oficial de /votacao), contado por sigla, com a descrição
 * oficial. Nada é convertido em presença ou ausência. → Map(id → { votacoes, por_registro: [{ codigo, registro, quantidade }] })
 */
export function registrosEmVotacoes(votacoes, tipos, ano) {
  const por = new Map();
  for (const v of votacoes) {
    if (!String(v.dataSessao ?? '').startsWith(`${ano}-`)) continue;
    for (const x of v.votos ?? []) {
      if (x.codigoParlamentar == null) continue;
      const id = String(x.codigoParlamentar);
      if (!por.has(id)) por.set(id, { votacoes: 0, cont: new Map() });
      const p = por.get(id);
      p.votacoes++;
      const cod = x.siglaVotoParlamentar ?? null;
      const c = p.cont.get(cod) ?? { codigo: cod, registro: tipos.get(cod) ?? x.descricaoVotoParlamentar ?? cod ?? NAO_DISPONIVEL, quantidade: 0 };
      c.quantidade++;
      p.cont.set(cod, c);
    }
  }
  const saida = new Map();
  for (const [id, p] of por) {
    saida.set(id, { votacoes: p.votacoes, por_registro: [...p.cont.values()].sort((a, b) => b.quantidade - a.quantidade || cmpPt(a.registro, b.registro)) });
  }
  return saida;
}

/** Licenças do senador que alcançam o ano (fonte: /senador/{codigo}/licencas). */
export function licencasNoAno(json, ano) {
  const ls = lista(json?.LicencaParlamentar?.Parlamentar?.Licencas?.Licenca);
  return ls
    .filter((l) => (l.DataInicio ?? '') <= `${ano}-12-31` && (l.DataFim == null || l.DataFim >= `${ano}-01-01`))
    .map((l) => ({ inicio: l.DataInicio ?? null, fim: l.DataFim ?? null, tipo: limpar(l.DescricaoTipoAfastamento) ?? NAO_DISPONIVEL }))
    .sort((a, b) => (a.inicio ?? '').localeCompare(b.inicio ?? '') || cmpPt(a.tipo, b.tipo));
}

export const DEFINICOES_PRESENCA = {
  sessoes_deliberativas: 'Sessões do Plenário do Senado Federal do tipo "Sessão Deliberativa Ordinária" ou "Sessão Deliberativa Extraordinária" com situação "Encerrada" na agenda oficial do Plenário (Dados Abertos do Senado). Sessões não deliberativas, especiais, de debates temáticos e as do Congresso Nacional ficam fora.',
  dias_com_sessoes_deliberativas: 'Dias distintos com ao menos uma dessas sessões.',
  presenca: `Presença por sessão e frequência por senador: o Senado não publica esses dados em fonte oficial de dados abertos. Por isso dias_com_sessao, dias_presenca, dias_ausencia_justificada, dias_ausencia_nao_justificada, sessoes_registradas, sessoes_presenca e sessoes_ausencia ficam vazios (null): "${NAO_DISPONIVEL}".`,
  registros_em_votacoes: 'Registro oficial do senador em cada votação do ano listada pelo serviço de votações do Senado (nominais e secretas), contado por tipo de registro como consta da fonte (ex.: "Sim", "Não", "Presente – Não registrou voto", "Licença saúde", "Não Compareceu"). É um registro por votação, não por sessão, e não equivale a presença na sessão.',
  licencas_no_ano: 'Licenças oficiais do senador (período e tipo de afastamento) que alcançam o ano, como constam do serviço de licenças do Senado.',
};

// ---------- coleta ----------
export async function coletarPresenca({ ano, hoje, dir, log = console.error }) {
  // robots.txt antes de tudo
  await carregarRobots(new URL(BASE).host);

  const fimMes = ano === Number(hoje.slice(0, 4)) ? Number(hoje.slice(5, 7)) : 12;
  const agenda = [];
  for (let m = 1; m <= fimMes; m++) {
    const d = await obter(`${BASE}/plenario/agenda/mes/${ano}${String(m).padStart(2, '0')}01`);
    agenda.push(...lista(d?.AgendaPlenario?.Sessoes?.Sessao));
  }
  const sessoes = sessoesDeliberativas(agenda, ano).filter((s) => s.data <= hoje);
  const dias = [...new Set(sessoes.map((s) => s.data))];

  const [senadores, tiposJson] = await Promise.all([senadoresEmExercicio(), obter(`${BASE}/plenario/lista/tiposComparecimento`)]);
  const tipos = new Map(lista(tiposJson?.ListaTiposComparecimento?.TiposComparecimento?.TipoComparecimento).map((t) => [t.Sigla, t.Descricao]));
  const fimPeriodo = ano === Number(hoje.slice(0, 4)) ? hoje : `${ano}-12-31`;
  const urlVot = `${BASE}/votacao?dataInicio=${ano}-01-01&dataFim=${fimPeriodo}`;
  const votacoes = await obter(urlVot, { timeoutMs: 180_000 });
  if (!Array.isArray(votacoes)) throw new Error('Resposta inesperada de /votacao');
  const votacoesAno = votacoes.filter((v) => String(v.dataSessao ?? '').startsWith(`${ano}-`));
  const registros = registrosEmVotacoes(votacoesAno, tipos, ano);

  const licencas = new Map();
  const urlLic = (id) => `${BASE}/senador/${id}/licencas?dataInicio=${ano}0101&dataFim=${fimPeriodo.replaceAll('-', '')}`;
  await paraCada(senadores, async (s) => { licencas.set(s.id, licencasNoAno(await obter(urlLic(s.id)), ano)); });
  log(`presença ${ano}: ${sessoes.length} sessões deliberativas em ${dias.length} dias; ${votacoesAno.length} votações; ${senadores.length} senadores`);

  const itens = senadores.map((s) => {
    const r = registros.get(s.id);
    return {
      parlamentar_id: s.id, nome_na_fonte: s.nome, partido_na_fonte: s.partido, uf_na_fonte: s.uf,
      presenca: NAO_DISPONIVEL,
      dias_com_sessao: null, dias_presenca: null, dias_ausencia_justificada: null, dias_ausencia_nao_justificada: null,
      dias_outra_frequencia: null, sessoes_registradas: null, sessoes_presenca: null, sessoes_ausencia: null,
      presencas_registradas_dados_abertos: null, periodo_na_fonte: null,
      registros_em_votacoes: r ? { votacoes: r.votacoes, por_registro: r.por_registro } : { votacoes: 0, por_registro: [] },
      licencas_no_ano: licencas.get(s.id) ?? [],
      url_oficial: s.url_oficial,
    };
  }).sort((a, b) => cmpPt(a.nome_na_fonte, b.nome_na_fonte) || cmpPt(a.parlamentar_id, b.parlamentar_id));

  const fAgenda = fonte(`Agenda do Plenário do Senado Federal ${ano} (Dados Abertos)`, `${BASE}/plenario/agenda/mes/{AAAAMM01}`, hoje);
  const lacunas = [
    `Presença por sessão: ${NAO_DISPONIVEL}. O Senado não publica, nos Dados Abertos Legislativos nem nos Dados Abertos Administrativos, a lista de presença das sessões nem a frequência dos senadores; o detalhe da sessão (/plenario/encontro/{codigo}) e o resultado do dia (/plenario/resultado/{data}) não trazem quem compareceu.`,
    'Os registros nas votações (registros_em_votacoes) vêm da lista oficial de cada votação e não são convertidos em presença ou ausência na sessão: há sessões deliberativas sem votação registrada no serviço de votações e votações simbólicas, que não têm lista.',
    'Sessões do Congresso Nacional (sessões conjuntas) não entram na contagem de sessões deliberativas do Senado.',
  ];
  const totais = {
    senadores: itens.length, sessoes_deliberativas: sessoes.length, dias_com_sessoes_deliberativas: dias.length,
    votacoes_com_lista_oficial: votacoesAno.length, senadores_com_licenca_no_ano: itens.filter((i) => i.licencas_no_ano.length).length,
  };
  await gravarSeMudou(path.join(dir, `${ano}.json`), {
    atualizado_em: hoje, ano, casa: 'senado',
    abrangencia: 'Sessões deliberativas do Plenário do Senado Federal no ano e registro de cada senador em exercício nas votações do ano. Presença por sessão não disponível em fonte oficial.',
    presenca_por_sessao: NAO_DISPONIVEL,
    totais, definicoes: DEFINICOES_PRESENCA,
    fonte: fAgenda,
    fontes_complementares: [
      fonte(`Votações do Senado Federal ${ano} (Dados Abertos)`, urlVot, hoje),
      fonte('Tipos de comparecimento em votação (Dados Abertos do Senado)', `${BASE}/plenario/lista/tiposComparecimento`, hoje),
      fonte('Licenças dos senadores (Dados Abertos do Senado)', `${BASE}/senador/{codigo}/licencas?dataInicio=${ano}0101`, hoje),
      fonte('Senadores em exercício (Dados Abertos do Senado)', `${BASE}/senador/lista/atual`, hoje),
    ],
    robots_txt: robotsCarregados(),
    lacunas, itens,
  });
  await gravarSeMudou(path.join(dir, `sessoes-${ano}.json`), {
    atualizado_em: hoje, ano, casa: 'senado', criterio: DEFINICOES_PRESENCA.sessoes_deliberativas,
    fonte: fAgenda, contagem_por_tipo_na_agenda: contagemTipos(agenda, ano), sessoes,
  });
  return totais;
}

function lerArgs(argv) {
  const a = { ano: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ano') a.ano = Number(argv[++i]);
    else if (argv[i].startsWith('--ano=')) a.ano = Number(argv[i].slice(6));
    else if (argv[i] === '--completo') { /* aceito por compatibilidade com o workflow: a coleta já é do ano inteiro */ }
    else if (argv[i] === '--ajuda' || argv[i] === '-h') { console.log('Uso: presenca.mjs [--ano AAAA]'); process.exit(0); }
    else throw new Error(`Argumento desconhecido: ${argv[i]}`);
  }
  if (a.ano != null && !(a.ano >= 2019 && a.ano <= 2100)) throw new Error('--ano inválido');
  return a;
}

async function principal() {
  const t0 = Date.now();
  const hoje = hojeISO();
  const { ano = null } = lerArgs(process.argv.slice(2));
  const anoAlvo = ano ?? Number(hoje.slice(0, 4));
  if (anoAlvo > Number(hoje.slice(0, 4))) throw new Error('--ano no futuro');
  const totais = await coletarPresenca({ ano: anoAlvo, hoje, dir: path.join(SAIDA_SENADO, 'presenca') });
  console.error(`[senado/presença] ${JSON.stringify(totais)}; arquivos gravados ${gravacoes.gravados}, inalterados ${gravacoes.inalterados}; ` +
    `${estat.requisicoes} requisições (${estat.retentativas} retentativas); ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => { console.error(`[senado/presença] ERRO: ${e.message}`); process.exit(1); });
}
