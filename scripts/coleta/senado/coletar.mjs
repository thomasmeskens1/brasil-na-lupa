#!/usr/bin/env node
/**
 * Coletor automático do Senado Federal (Dados Abertos Legislativos).
 *
 * USO (Node 20+, sem dependências):
 *   node scripts/coleta/senado/coletar.mjs                     # incremental: últimos 7 dias
 *   node scripts/coleta/senado/coletar.mjs --desde 2026-10-01  # incremental a partir da data
 *   node scripts/coleta/senado/coletar.mjs --completo          # backfill 2025-01-01 até hoje
 *
 * Rotina diária sugerida (evitar horário "redondo", pedido do Senado): 08:37 de Brasília
 *   node scripts/coleta/senado/coletar.mjs --desde <hoje-7>   (o padrão já é hoje-7)
 * e uma reconciliação mensal com --completo.
 *
 * GERA (em dados/senado/, contrato em dados/esquema.json):
 *   parlamentares.json            senadores em exercício (/senador/lista/atual), sem CPF
 *   votacoes/indice-<ano>.json    resumo das votações do ano (2025, 2026; 2024 só reforma tributária)
 *   votacoes/<id>.json            detalhe: voto de cada senador, orientações de bancada, conferência do placar
 *   meta.json                     { atualizado_em, verificado_em, periodo, contagens, fontes }
 *
 * FONTES (serviços novos; os desativados em 01/02/2026 não são usados):
 *   GET /votacao?dataInicio=&dataFim=            votações nominais/secretas com votos (por ano ou período)
 *   GET /votacao?sigla=PLP&numero=68|108&ano=2024 reforma tributária (inclui votações de 2024)
 *   GET /plenario/votacao/orientacaoBancada/{ini}/{fim}  orientações e placar do painel (liga por sequencialVotacao)
 *   GET /plenario/lista/tiposComparecimento      descrição oficial das siglas de comparecimento
 *   GET /senador/lista/atual                     senadores em exercício
 *
 * REGRAS APLICADAS:
 *   - id da votação = codigoSessaoVotacao (sempre presente; sequencialVotacao às vezes vem nulo).
 *   - tipo: "nominal" (votos individuais), "secreta" (votacaoSecreta = "S": NENHUM voto individual é
 *     atribuído; a lista oficial de comparecimento vai em "comparecimento") ou "simbolica" (sem votos).
 *   - placar nominal = contagem dos votos (Sim, Não, Abstenção, Obstrução; "outros" = Presidente art. 51 RISF),
 *     conferido com o placar do texto oficial (informe legislativo) e com o painel de orientação.
 *     Divergência não é corrigida: fica registrada em "conferencia_placar" e em "lacunas".
 *   - placar secreto = totais oficiais (totalVotos*), também conferidos.
 *   - Escrita atômica (arquivo temporário + rename); arquivo só é regravado se o conteúdo mudar
 *     (ignorando os campos "atualizado_em" e "acessado_em").
 *   - Máximo de 2 requisições simultâneas; retentativas com espera crescente em 429/5xx/erro de rede.
 */
import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://legis.senado.leg.br/dadosabertos';
const PAGINA_MATERIA = 'https://www25.senado.leg.br/web/atividade/materias/-/materia';
const USER_AGENT = 'voto-em-quem-coletor/1.0 (coleta diaria de dados abertos; +https://github.com/thomasmeskens1/quem-votar)';
const ORGAO = 'Senado Federal';
const ANOS_COMPLETO = [2025, 2026];
const REFORMA_TRIBUTARIA = [{ sigla: 'PLP', numero: 68, ano: 2024 }, { sigla: 'PLP', numero: 108, ano: 2024 }];
const MAX_PARALELO = 2;
const TENTATIVAS = 5;

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SAIDA = path.resolve(AQUI, '../../../dados/senado');
const DIR_VOT = path.join(SAIDA, 'votacoes');

// ---------- argumentos ----------
function lerArgs(argv) {
  const a = { completo: false, desde: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--completo') a.completo = true;
    else if (argv[i] === '--desde') a.desde = argv[++i];
    else if (argv[i].startsWith('--desde=')) a.desde = argv[i].slice(8);
    else if (argv[i] === '--ajuda' || argv[i] === '-h') { console.log('Uso: coletar.mjs [--desde AAAA-MM-DD | --completo]'); process.exit(0); }
    else throw new Error(`Argumento desconhecido: ${argv[i]}`);
  }
  if (a.desde && !/^\d{4}-\d{2}-\d{2}$/.test(a.desde)) throw new Error('--desde deve estar no formato AAAA-MM-DD');
  if (a.desde && Number.isNaN(Date.parse(a.desde))) throw new Error('--desde inválida');
  return a;
}

const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // horário de Brasília
const menosDias = (iso, n) => new Date(Date.parse(iso) - n * 86400e3).toISOString().slice(0, 10);
const semHifen = (iso) => iso.replaceAll('-', '');

// ---------- HTTP: limite de paralelismo + retentativas ----------
let ativos = 0;
const fila = [];
const estat = { requisicoes: 0, retentativas: 0 };
async function comVaga(fn) {
  if (ativos >= MAX_PARALELO) await new Promise((r) => fila.push(r));
  ativos++;
  try { return await fn(); } finally { ativos--; const prox = fila.shift(); if (prox) prox(); }
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function obterJson(url) {
  return comVaga(async () => {
    let ultimoErro;
    for (let t = 1; t <= TENTATIVAS; t++) {
      estat.requisicoes++;
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          redirect: 'follow',
          signal: AbortSignal.timeout(90_000),
        });
        if (r.ok) return await r.json();
        ultimoErro = new Error(`HTTP ${r.status} em ${url}`);
        if (r.status !== 429 && r.status < 500) throw Object.assign(ultimoErro, { definitivo: true });
        const ra = Number(r.headers.get('retry-after'));
        if (t < TENTATIVAS) { estat.retentativas++; await esperar(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1500 * 2 ** (t - 1)); }
      } catch (e) {
        if (e.definitivo) throw e;
        ultimoErro = e;
        if (t < TENTATIVAS) { estat.retentativas++; await esperar(1500 * 2 ** (t - 1) + Math.random() * 500); }
      }
    }
    throw new Error(`Falha após ${TENTATIVAS} tentativas: ${url} (${ultimoErro?.message})`);
  });
}

// ---------- arquivos: escrita atômica, só se mudou ----------
function semCamposVolateis(x) {
  if (Array.isArray(x)) return x.map(semCamposVolateis);
  if (x && typeof x === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(x)) if (k !== 'atualizado_em' && k !== 'acessado_em' && k !== 'verificado_em') o[k] = semCamposVolateis(v);
    return o;
  }
  return x;
}
async function lerJsonSeExistir(arq) {
  if (!existsSync(arq)) return null;
  try { return JSON.parse(await readFile(arq, 'utf8')); } catch { return null; }
}
const gravados = { escritos: 0, inalterados: 0 };
async function gravarSeMudou(arq, obj) {
  const antigo = await lerJsonSeExistir(arq);
  if (antigo && JSON.stringify(semCamposVolateis(antigo)) === JSON.stringify(semCamposVolateis(obj))) { gravados.inalterados++; return false; }
  await mkdir(path.dirname(arq), { recursive: true });
  const tmp = `${arq}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  await rename(tmp, arq);
  gravados.escritos++;
  return true;
}

// ---------- fontes ----------
const fonte = (titulo, url, dia) => ({ titulo, url, orgao: ORGAO, acessado_em: dia });

async function tiposComparecimento() {
  const d = await obterJson(`${BASE}/plenario/lista/tiposComparecimento`);
  const m = new Map();
  for (const t of d?.ListaTiposComparecimento?.TiposComparecimento?.TipoComparecimento ?? []) m.set(t.Sigla, t.Descricao);
  return m;
}

async function coletarParlamentares(dia) {
  const url = `${BASE}/senador/lista/atual`;
  const d = await obterJson(url);
  const lista = d?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar ?? [];
  if (lista.length < 70) throw new Error(`Lista de senadores suspeita (${lista.length} itens); nada gravado`);
  const itens = lista.map(({ IdentificacaoParlamentar: p = {}, Mandato: m = {} }) => ({
    id: String(p.CodigoParlamentar),
    nome: p.NomeParlamentar ?? null,
    nome_civil: p.NomeCompletoParlamentar ?? null,
    partido: p.SiglaPartidoParlamentar ?? null,
    uf: p.UfParlamentar ?? m.UfParlamentar ?? null,
    em_exercicio: true,
    foto: p.UrlFotoParlamentar ?? null,
    url_oficial: p.UrlPaginaParlamentar ?? null,
    email: p.EmailParlamentar ?? null,
    bloco: p.Bloco?.NomeBloco ?? null,
    participacao: m.DescricaoParticipacao ?? null,
  })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { atualizado_em: new Date().toISOString(), fonte: fonte('Senado Federal: Senadores em Exercício (Dados Abertos)', url, dia), itens };
}

// ---------- placar ----------
const CODIGO_SIM = 'Sim', CODIGO_NAO = 'Não', CODIGO_ABST = 'Abstenção', CODIGO_PRES = 'Presidente (art. 51 RISF)';
const CODIGOS_OBSTRUCAO = new Set(['P-OD', 'OB', 'Obstrução']);

function contarVotos(votos) {
  const p = { sim: 0, nao: 0, abstencao: 0, obstrucao: 0, outros: 0 };
  for (const v of votos) {
    const c = v.siglaVotoParlamentar;
    if (c === CODIGO_SIM) p.sim++;
    else if (c === CODIGO_NAO) p.nao++;
    else if (c === CODIGO_ABST) p.abstencao++;
    else if (CODIGOS_OBSTRUCAO.has(c)) p.obstrucao++;
    else if (c === CODIGO_PRES) p.outros++;
  }
  return p;
}

/** Extrai placares escritos no texto oficial, ex.: "(Sim: 75; Não: 1; Presidente: 1; Total: 77)" ou "Sim 41, Não1, Abst. 1, Total 43". */
export function placaresDoTexto(texto) {
  if (!texto) return [];
  const out = [];
  const S = '[\\s:=\\u2013\\u2014-]*'; // separadores vistos: "Sim: 75", "Sim 41", "sim – 65", "Sim - 64", "Não1"
  const rotulo = (r) => new RegExp(`${r}${S}(\\d+)`, 'i');
  for (const m of texto.matchAll(new RegExp(`\\bSim${S}\\d+[^\\n]{0,140}?Total${S}\\d+`, 'gi'))) {
    const t = m[0], num = (re) => { const x = t.match(re); return x ? Number(x[1]) : null; };
    out.push({
      trecho: t,
      sim: num(rotulo('\\bSim')),
      nao: num(rotulo('\\bN[ãa]o')),
      abstencao: num(rotulo('\\bAbst(?:en[çc][ãa]o|en[çc][õo]es)?\\.?')),
      presidente: num(rotulo('\\bPres(?:idente|\\.)')),
      total: num(rotulo('\\bTotal')),
    });
  }
  return out;
}

function conferir(placar, textoOficial, ob) {
  const segs = placaresDoTexto(textoOficial);
  // Compara só as categorias escritas no texto e o total (categoria ausente no texto não é presumida).
  const totalCalc = (placar.sim ?? 0) + (placar.nao ?? 0) + (placar.abstencao ?? 0) + (placar.outros ?? 0);
  // Votação secreta não traz o voto do Presidente (outros = null); nesse caso o texto pode somá-lo ao total.
  const bate = (s) => s.sim === placar.sim && s.total === totalCalc + (placar.outros == null ? (s.presidente ?? 0) : 0) &&
    (s.nao == null || s.nao === placar.nao) && (s.abstencao == null || s.abstencao === placar.abstencao) &&
    (s.presidente == null || placar.outros == null || s.presidente === placar.outros);
  const texto = segs.length === 0 ? 'sem placar no texto' : segs.some(bate) ? 'confere' : 'placar nao localizado no texto';
  let painel = 'indisponivel', refPainel = null;
  if (ob) {
    refPainel = { sim: ob.qtdVotosSim ?? null, nao: ob.qtdVotosNao ?? null, abstencao: ob.qtdVotosAbstencao ?? null, obstrucao: ob.qtdObstrucoes ?? null };
    painel = refPainel.sim === placar.sim && refPainel.nao === placar.nao && (refPainel.abstencao ?? 0) === (placar.abstencao ?? 0) ? 'confere' : 'diverge';
  }
  return { texto_oficial: texto, placares_no_texto: segs.map((s) => s.trecho), painel_orientacao: painel, placar_painel: refPainel };
}

// ---------- votação ----------
const RESULTADO = { A: 'aprovada', R: 'rejeitada' };

function montarVotacao(v, ob, tipos, dia, colecoes) {
  const id = String(v.codigoSessaoVotacao);
  const lacunas = [];
  const secreta = v.votacaoSecreta === 'S';
  const brutos = v.votos ?? [];
  const descr = (x) => {
    const c = x.siglaVotoParlamentar;
    if ([CODIGO_SIM, CODIGO_NAO, CODIGO_ABST, CODIGO_PRES, 'Votou'].includes(c)) return c;
    return x.descricaoVotoParlamentar ?? tipos.get(c) ?? c;
  };
  const pessoa = (x) => ({
    parlamentar_id: x.codigoParlamentar != null ? String(x.codigoParlamentar) : null,
    nome: x.nomeParlamentar ?? null, partido: x.siglaPartidoParlamentar ?? null, uf: x.siglaUFParlamentar ?? null,
  });
  const temVotoNominal = brutos.some((x) => [CODIGO_SIM, CODIGO_NAO, CODIGO_ABST].includes(x.siglaVotoParlamentar));
  const tipo = secreta ? 'secreta' : temVotoNominal ? 'nominal' : 'simbolica';

  let placar = null, placar_origem = null, conferencia = null, votos = [], comparecimento = [];
  const texto = v.informeLegislativo?.texto ?? null;
  if (tipo === 'nominal') {
    votos = brutos.map((x) => ({ ...pessoa(x), voto: descr(x), voto_codigo: x.siglaVotoParlamentar }));
    placar = contarVotos(brutos);
    placar_origem = 'contagem dos votos individuais';
    conferencia = conferir(placar, texto, ob);
  } else if (tipo === 'secreta') {
    comparecimento = brutos.map((x) => ({ ...pessoa(x), registro: descr(x), registro_codigo: x.siglaVotoParlamentar }));
    placar = { sim: v.totalVotosSim ?? null, nao: v.totalVotosNao ?? null, abstencao: v.totalVotosAbstencao ?? null, obstrucao: ob?.qtdObstrucoes ?? null, outros: null };
    placar_origem = 'totais oficiais da votação secreta';
    if (placar.sim == null) { placar = null; lacunas.push('Placar da votação secreta não disponível em fonte oficial'); }
    else conferencia = conferir(placar, texto, ob);
    lacunas.push('Votação secreta: o voto de cada senador não é divulgado; a lista mostra apenas o registro oficial de comparecimento');
  } else {
    lacunas.push('Votação sem registro nominal: não há voto individual a atribuir');
  }
  if (conferencia && conferencia.texto_oficial !== 'confere' && conferencia.painel_orientacao !== 'confere') lacunas.push('O placar não pôde ser conferido com outro registro oficial da sessão');
  if (conferencia?.painel_orientacao === 'diverge') lacunas.push('O placar calculado difere do placar do painel de orientação de bancada; ver conferência');

  const orientacoes = (ob?.orientacoesLideranca ?? []).map((o) => ({ bancada: o.partido ?? null, orientacao: o.voto ?? null, data_hora: o.dataHora ?? null }))
    .sort((a, b) => (a.bancada ?? '').localeCompare(b.bancada ?? '', 'pt-BR') || (a.data_hora ?? '').localeCompare(b.data_hora ?? '')); // ordem neutra (alfabética)
  if (!ob) lacunas.push('Orientação de bancada não disponível em fonte oficial para esta votação');
  else if (!orientacoes.length) lacunas.push('Nenhuma orientação de bancada registrada');
  const hora = ob?.dataInicioVotacao?.slice(11, 16) ?? null;
  if (!hora) lacunas.push('Horário da votação não disponível em fonte oficial');
  const resultado = RESULTADO[v.resultadoVotacao] ?? null;
  if (!resultado) lacunas.push('Resultado não disponível em fonte oficial');

  const urlApi = v.idProcesso != null ? `${BASE}/votacao?idProcesso=${v.idProcesso}` : `${BASE}/votacao?dataInicio=${v.dataSessao}&dataFim=${v.dataSessao}`;
  const urlPagina = v.codigoMateria != null ? `${PAGINA_MATERIA}/${v.codigoMateria}` : null;
  const fontes = [fonte(`Senado Federal: votação ${v.identificacao ?? ''} em ${v.dataSessao} (Dados Abertos)`.replace('  ', ' '), urlApi, dia)];
  if (ob) fontes.push(fonte('Senado Federal: orientação de bancada da sessão (Dados Abertos)', `${BASE}/plenario/votacao/orientacaoBancada/${semHifen(v.dataSessao)}`, dia));
  if (urlPagina) fontes.push(fonte(`Senado Federal: página da matéria ${v.identificacao ?? ''}`.trim(), `${urlPagina}/votacoes`, dia));

  return {
    id, casa: 'senado', data: v.dataSessao, hora,
    orgao: v.informeLegislativo?.nomeColegiado ?? 'Plenário',
    sessao: { codigo: v.codigoSessao ?? null, numero: v.numeroSessao ?? null, tipo: ob?.tipoSessao ?? v.siglaTipoSessao ?? null, presidente: ob?.presidenteSessao ?? null },
    sequencial_votacao: v.sequencialVotacao ?? null,
    proposicao: {
      id: v.idProcesso != null ? String(v.idProcesso) : null, codigo_materia: v.codigoMateria ?? null,
      sigla: v.sigla ?? null, numero: v.numero != null ? Number(v.numero) : null, ano: v.ano ?? null,
      identificacao: v.identificacao ?? null, ementa: v.ementa ?? null, url: urlPagina,
    },
    descricao: v.descricaoVotacao ?? null,
    materia_votada: ob?.descricaoMateria ?? null,
    resultado, resultado_codigo: v.resultadoVotacao ?? null,
    tipo, placar, placar_origem, conferencia_placar: conferencia,
    orientacoes, votos, comparecimento,
    texto_oficial_sessao: texto,
    colecoes,
    fonte: fontes[0], fontes, lacunas,
    atualizado_em: new Date().toISOString(),
  };
}

const resumo = (d) => ({
  id: d.id, data: d.data, hora: d.hora, proposicao: d.proposicao.identificacao, proposicao_id: d.proposicao.id,
  ementa: d.proposicao.ementa, descricao: d.descricao, resultado: d.resultado, tipo: d.tipo, placar: d.placar,
  conferencia: d.conferencia_placar ? { texto_oficial: d.conferencia_placar.texto_oficial, painel_orientacao: d.conferencia_placar.painel_orientacao } : null,
  colecoes: d.colecoes,
});

// ---------- execução ----------
async function principal() {
  const t0 = Date.now();
  const args = lerArgs(process.argv.slice(2));
  const dia = hojeISO();
  const inicio = args.completo ? `${ANOS_COMPLETO[0]}-01-01` : (args.desde ?? menosDias(dia, 7));
  if (inicio > dia) throw new Error('--desde não pode ser no futuro');
  console.error(`[senado] modo ${args.completo ? 'completo' : 'incremental'}: ${inicio} a ${dia}`);

  // 1. Consultas (períodos de até 1 ano por chamada)
  const periodos = [];
  for (let a = Number(inicio.slice(0, 4)); a <= Number(dia.slice(0, 4)); a++) {
    periodos.push([a === Number(inicio.slice(0, 4)) ? inicio : `${a}-01-01`, a === Number(dia.slice(0, 4)) ? dia : `${a}-12-31`]);
  }
  const [tipos, parlamentares] = await Promise.all([tiposComparecimento(), coletarParlamentares(dia)]);
  const brutas = new Map(); // id -> votação bruta
  const colecoesPor = new Map();
  for (const [ini, fim] of periodos) {
    const lista = await obterJson(`${BASE}/votacao?dataInicio=${ini}&dataFim=${fim}`);
    if (!Array.isArray(lista)) throw new Error(`Resposta inesperada de /votacao (${ini} a ${fim})`);
    for (const v of lista) brutas.set(String(v.codigoSessaoVotacao), v);
  }
  for (const p of REFORMA_TRIBUTARIA) {
    const lista = await obterJson(`${BASE}/votacao?sigla=${p.sigla}&numero=${p.numero}&ano=${p.ano}`);
    for (const v of Array.isArray(lista) ? lista : []) {
      if (v.sigla !== p.sigla || Number(v.numero) !== p.numero || Number(v.ano) !== p.ano) continue; // filtro conferido
      const id = String(v.codigoSessaoVotacao);
      brutas.set(id, v);
      colecoesPor.set(id, ['reforma-tributaria']);
    }
  }

  // 2. Orientação de bancada: por período e, para datas fora dele (ex.: 2024), por dia
  const obPorSeq = new Map();
  const addOb = (d) => { for (const o of d?.votacoes ?? []) if (o.sequencialVotacao != null) obPorSeq.set(o.sequencialVotacao, o); };
  for (const [ini, fim] of periodos) addOb(await obterJson(`${BASE}/plenario/votacao/orientacaoBancada/${semHifen(ini)}/${semHifen(fim)}`));
  const datasFora = [...new Set([...brutas.values()].map((v) => v.dataSessao).filter((d) => d < inicio || d > dia))];
  await Promise.all(datasFora.map(async (d) => addOb(await obterJson(`${BASE}/plenario/votacao/orientacaoBancada/${semHifen(d)}`))));

  // 3. Detalhes
  const detalhes = [];
  for (const [id, v] of brutas) {
    const ob = v.sequencialVotacao != null ? obPorSeq.get(v.sequencialVotacao) : null;
    const d = montarVotacao(v, ob ?? null, tipos, dia, colecoesPor.get(id) ?? []);
    detalhes.push(d);
    await gravarSeMudou(path.join(DIR_VOT, `${id}.json`), d);
  }

  // 4. Índices por ano (completo: reconstrói; incremental: mescla com o existente)
  const porAno = new Map();
  for (const d of detalhes) { const a = d.data.slice(0, 4); if (!porAno.has(a)) porAno.set(a, []); porAno.get(a).push(resumo(d)); }
  const anosIndice = new Set([...porAno.keys(), ...(args.completo ? ANOS_COMPLETO.map(String) : [])]);
  for (const ano of anosIndice) {
    const arq = path.join(DIR_VOT, `indice-${ano}.json`);
    const mapa = new Map();
    if (!args.completo) for (const it of (await lerJsonSeExistir(arq))?.itens ?? []) mapa.set(it.id, it);
    for (const it of porAno.get(ano) ?? []) mapa.set(it.id, it);
    const itens = [...mapa.values()].sort((a, b) => (a.data + (a.hora ?? '') + a.id).localeCompare(b.data + (b.hora ?? '') + b.id));
    const escopo = ANOS_COMPLETO.map(String).includes(ano)
      ? 'Todas as votações registradas no serviço de votações do Senado no ano'
      : 'Somente votações do PLP 68/2024 e do PLP 108/2024 (reforma tributária)';
    await gravarSeMudou(arq, { atualizado_em: new Date().toISOString(), ano: Number(ano), escopo, fonte: fonte('Senado Federal: votações (Dados Abertos)', `${BASE}/votacao?dataInicio=${ano}-01-01&dataFim=${ano}-12-31`, dia), itens });
  }
  await gravarSeMudou(path.join(SAIDA, 'parlamentares.json'), parlamentares);

  // 5. Meta (contagens lidas dos índices gravados)
  const contagens = { parlamentares_em_exercicio: parlamentares.itens.length, votacoes_por_ano: {}, votacoes_por_tipo: {}, conferencia_texto_oficial: {}, conferencia_painel: {}, reforma_tributaria: 0, arquivos_de_detalhe: 0 };
  for (const f of (await readdir(DIR_VOT)).filter((f) => /^indice-\d{4}\.json$/.test(f)).sort()) {
    const idx = await lerJsonSeExistir(path.join(DIR_VOT, f));
    contagens.votacoes_por_ano[idx.ano] = idx.itens.length;
    for (const it of idx.itens) {
      contagens.votacoes_por_tipo[it.tipo] = (contagens.votacoes_por_tipo[it.tipo] ?? 0) + 1;
      if (it.conferencia) {
        contagens.conferencia_texto_oficial[it.conferencia.texto_oficial] = (contagens.conferencia_texto_oficial[it.conferencia.texto_oficial] ?? 0) + 1;
        contagens.conferencia_painel[it.conferencia.painel_orientacao] = (contagens.conferencia_painel[it.conferencia.painel_orientacao] ?? 0) + 1;
      }
      if (it.colecoes?.includes('reforma-tributaria')) contagens.reforma_tributaria++;
    }
  }
  contagens.arquivos_de_detalhe = (await readdir(DIR_VOT)).filter((f) => /^\d+\.json$/.test(f)).length;
  const metaArq = path.join(SAIDA, 'meta.json');
  const metaAnt = await lerJsonSeExistir(metaArq);
  const mudou = gravados.escritos > 0 || !metaAnt;
  const meta = {
    atualizado_em: mudou ? new Date().toISOString() : metaAnt.atualizado_em,
    verificado_em: new Date().toISOString(),
    periodo: { inicio: `${ANOS_COMPLETO[0]}-01-01`, fim: dia, ultima_execucao: { modo: args.completo ? 'completo' : 'incremental', inicio, fim: dia }, adicional: 'Votações do PLP 68/2024 e do PLP 108/2024 no Senado, inclusive as de 2024' },
    contagens,
    fontes: [
      fonte('Senado Federal: votações nominais e secretas', `${BASE}/votacao`, dia),
      fonte('Senado Federal: orientação de bancada', `${BASE}/plenario/votacao/orientacaoBancada/{inicio}/{fim}`, dia),
      fonte('Senado Federal: tipos de comparecimento em votação', `${BASE}/plenario/lista/tiposComparecimento`, dia),
      fonte('Senado Federal: senadores em exercício', `${BASE}/senador/lista/atual`, dia),
    ],
    observacoes: [
      'Votações simbólicas não constam do serviço de votações do Senado (aparecem só no texto da tramitação) e não são coletadas aqui.',
      'Votação secreta: nenhum voto individual é atribuído; só o registro oficial de comparecimento.',
      'Os registros de ausência podem diferir entre o serviço de dados abertos e a página da matéria (ex.: "Presente – Não registrou voto" na API e "Não Compareceu" na página); o coletor guarda o registro da API, sem corrigir.',
    ],
  };
  await mkdir(SAIDA, { recursive: true });
  const tmp = `${metaArq}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  await rename(tmp, metaArq);

  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  console.error(`[senado] ${detalhes.length} votações processadas; arquivos gravados ${gravados.escritos}, inalterados ${gravados.inalterados}; ` +
    `${estat.requisicoes} requisições (${estat.retentativas} retentativas); ${seg}s`);
  console.error(`[senado] contagens: ${JSON.stringify(contagens)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => { console.error(`[senado] ERRO: ${e.message}`); process.exit(1); });
}
