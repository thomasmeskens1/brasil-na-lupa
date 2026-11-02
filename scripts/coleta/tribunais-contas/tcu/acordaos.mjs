// Leitura da API de acórdãos do TCU (dados abertos) e normalização para o índice anual.
//
// Fonte única: GET https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos?inicio={n}&quantidade={q}
// - sem chave; JSON; ordem: mais recentes primeiro; não aceita filtros (ano, número…), só paginação;
// - campos: key, tipo, anoAcordao, titulo, numeroAcordao, numeroAta, colegiado, dataSessao (DD/MM/AAAA),
//   relator, situacao, sumario, urlArquivo (RTF), urlArquivoPdf, urlAcordao;
// - NÃO traz processo, assunto, texto do acórdão, quórum, vencidos, interessados nem partes.
import { obterJson, dataISO, dormir } from './lib.mjs';
import { tratarSumario } from './privacidade.mjs';

export const API = 'https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos';
export const ANO_INICIAL = 2025; // --completo limitado a 2025 em diante (hoje: 2025-2026)

// Link oficial de cada acórdão (pesquisa de jurisprudência do TCU). Em 02/11/2026, o campo urlAcordao da API
// seguiu este modelo em 100% dos 32.556 acórdãos de 2025-2026; por isso o índice grava o modelo uma vez no
// cabeçalho ("url_modelo", com {id}) e só grava "url" no item quando ela for diferente do modelo.
export const URL_MODELO = 'https://contas.tcu.gov.br/pesquisaJurisprudencia/#/detalhamento/11/*/KEY:%22{id}%22/DTRELEVANCIA%2520desc%252C%2520NUMACORDAOINT%2520desc/false/1/false';
export const urlOficial = (it) => it.url ?? URL_MODELO.replace('{id}', it.id);

const urlPagina = (inicio, quantidade) => `${API}?inicio=${inicio}&quantidade=${quantidade}`;

/** Registro bruto da API → item do índice (só campos literais da API; nada deduzido). */
export function normalizar(r, hoje) {
  const numero = String(r.numeroAcordao ?? '').trim() || null;
  const ano = Number(r.anoAcordao) || null;
  const sumario = tratarSumario(r.sumario, r.key);
  return {
    id: r.key,
    numero,
    ano,
    colegiado: r.colegiado ?? null,
    tipo: r.tipo ?? null,
    titulo: r.titulo ?? null,
    ata: r.numeroAta ?? null,
    data_sessao: dataISO(r.dataSessao),
    relator: r.relator ?? null,
    situacao: r.situacao ?? null,
    processo: null, // a API não traz o número do processo
    assunto: null, // a API não traz o campo assunto
    sumario: sumario.texto,
    ...(sumario.aviso ? { aviso_privacidade: sumario.aviso } : {}),
    ...(r.urlAcordao && r.urlAcordao !== URL_MODELO.replace('{id}', r.key) ? { url: r.urlAcordao } : {}),
    url_pdf: r.urlArquivoPdf ?? null,
    coletado_em: hoje,
  };
}

function validar(lista, url) {
  if (!Array.isArray(lista)) throw new Error(`resposta inesperada (não é lista) em ${url}`);
  for (const r of lista) if (!r || typeof r.key !== 'string' || !r.key) throw new Error(`registro sem key em ${url}`);
  return lista;
}

async function pagina(inicio, quantidade) {
  const url = urlPagina(inicio, quantidade);
  return validar(await obterJson(url), url);
}

// DEFEITO DA FONTE (observado em 02/11/2026): quando há requisições simultâneas à API — nossas ou de outros
// usuários —, a resposta pode vir misturada com registros de outra página (ex.: pedido de 500 devolveu 520
// ou 1500; uma página de 2026 veio com 1000 acórdãos de 2019). Por isso:
//  - as páginas são pedidas UMA DE CADA VEZ (nunca em paralelo neste host);
//  - cada página pede quantidade+1 registros a partir do último da página anterior (âncora) e só é aceita se
//    vier com o tamanho exato, sem KEY repetida e começando pela âncora (continuidade);
//  - a primeira página (sem âncora) só é aceita quando duas leituras seguidas vêm idênticas;
//  - página fora do padrão é pedida de novo (até 8 vezes, com espera crescente).
const MAX_TENTATIVAS_PAGINA = 8;
export const anomalias = { paginas_rejeitadas: 0, exemplos: [] };

function conferirPagina(lista, quantidade, ancora) {
  if (lista.length !== quantidade) return `tamanho ${lista.length} (pedido ${quantidade})`;
  if (new Set(lista.map((r) => r.key)).size !== lista.length) return 'KEY repetida na página';
  if (ancora && lista[0].key !== ancora) {
    const k = lista.findIndex((r) => r.key === ancora);
    return k < 0 ? 'âncora ausente (página descontínua)' : `âncora na posição ${k} (registros novos inseridos no topo durante a leitura)`;
  }
  return null;
}

async function paginaConferida(inicio, quantidade, ancora, log) {
  let anterior = null;
  for (let t = 1; t <= MAX_TENTATIVAS_PAGINA; t++) {
    const lista = await pagina(inicio, quantidade);
    const problema = conferirPagina(lista, quantidade, ancora);
    if (problema && problema.startsWith('âncora na posição') && t >= 2) {
      // Repetiu na segunda leitura: acórdãos novos entraram no topo da lista durante a leitura (a lista
      // deslocou). Aproveita a partir da âncora; os novos do topo entram na próxima execução.
      const k = lista.findIndex((r) => r.key === ancora);
      if (k > 0 && k <= 100) { log(`    página inicio=${inicio}: lista deslocada em ${k} (acórdãos novos no topo); aproveitada a partir da âncora`); return lista.slice(k); }
    }
    if (!problema) {
      if (ancora) return lista;
      const assinatura = lista.map((r) => r.key).join(',');
      if (anterior === assinatura) return lista; // primeira página: duas leituras idênticas
      anterior = assinatura;
      continue;
    }
    anomalias.paginas_rejeitadas++;
    if (anomalias.exemplos.length < 10) anomalias.exemplos.push(`inicio=${inicio}: ${problema}`);
    log(`    página inicio=${inicio} rejeitada (${problema}); nova tentativa ${t}/${MAX_TENTATIVAS_PAGINA}`);
    anterior = null;
    await dormir(4000 * t);
  }
  throw new Error(`página inicio=${inicio} não veio íntegra após ${MAX_TENTATIVAS_PAGINA} tentativas`);
}

/**
 * Lê páginas conferidas do mais novo para o mais antigo e chama parar(lista) após cada página; para quando
 * parar devolver true ou ao atingir maxPaginas. Devolve { registros, paginas, completo }.
 */
async function lerSequencial({ quantidade, maxPaginas, parar, log }) {
  const registros = [];
  let inicio = 0, ancora = null;
  for (let p = 0; p < maxPaginas; p++) {
    const pedido = ancora ? quantidade + 1 : quantidade;
    const lista = await paginaConferida(inicio, pedido, ancora, log);
    const novos = ancora ? lista.slice(1) : lista;
    registros.push(...novos);
    const ult = lista[lista.length - 1];
    const fim = parar(novos);
    log(`  página ${p} (inicio=${inicio}): ${novos.length} registros; último: ${ult.titulo} (${ult.dataSessao})${fim ? ' — fim' : ''}`);
    if (fim) return { registros, paginas: p + 1, completo: true };
    inicio += ancora ? quantidade : quantidade - 1;
    ancora = ult.key;
    await dormir(500);
  }
  return { registros, paginas: maxPaginas, completo: false };
}

/** Incremental: do mais novo até a primeira página que contém uma KEY já conhecida (a página inteira é aproveitada). */
export function lerIncremental(conhecidas, { quantidade = 200, maxPaginas = 60, log = () => {} } = {}) {
  return lerSequencial({ quantidade, maxPaginas, log, parar: (novos) => novos.some((r) => conhecidas.has(r.key)) });
}

/** Completo: do mais novo até a primeira página em que todos os acórdãos são de ano anterior a ANO_INICIAL. */
export function lerCompleto({ quantidade = 1000, maxPaginas = 80, log = () => {} } = {}) {
  return lerSequencial({ quantidade, maxPaginas, log, parar: (novos) => novos.every((r) => Number(r.anoAcordao) < ANO_INICIAL) });
}
