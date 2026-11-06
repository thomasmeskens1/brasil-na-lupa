#!/usr/bin/env node
// Coletor dos canais OFICIAIS de participação para as proposições que o site já tem:
//   - Senado: Consulta Pública do e-Cidadania (www12.senado.leg.br/ecidadania/visualizacaomateria?id=CODIGO),
//     votos SIM e NÃO copiados da página oficial; conferência opcional (--csv) com o arquivo de dados
//     abertos "Proposições com votos" do e-Cidadania.
//   - Câmara: enquete da proposição (www.camara.leg.br/enquetes/ID), resultado copiado da página
//     oficial de resultados (/enquetes/ID/resultados). Não há endpoint de dados abertos para enquetes.
// Grava dados/participacao/{senado,camara}/<id>.json. Sem número disponível em fonte oficial,
// grava só o link e "Informação não disponível em fonte oficial". Pesquisa em docs/pesquisa/participacao-oficial.md.
//
// Uso: node scripts/coleta/participacao/coletar.mjs [--casa senado|camara|ambas] [--ids 1,2]
//        [--limite N] [--prazo-min M] [--csv] [--forcar]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gravarSeMudou, lerJson, lerCsv, hojeISO } from '../camara/lib.mjs';
import { ClienteHost, Bloqueado, SemTempo, USER_AGENT } from './http.mjs';
import {
  NAO_DISPONIVEL, URL_ECIDADANIA, URL_ENQUETE, URL_ENQUETE_RESULTADOS,
  extrairEcidadania, extrairEnqueteCamara, somarCsvEcidadania,
} from './extrair.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DADOS = path.join(RAIZ, 'dados');
const SAIDA = path.join(DADOS, 'participacao');
const CAMINHO_CSV = '/ecidadania/documentos/home/resultados/todas-as-proposicoes-com-votos-na-consulta-publica-csv';

function argumentos(argv) {
  const a = { casa: 'ambas', ids: null, limite: null, prazoMin: 20, csv: false, forcar: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--casa') a.casa = argv[++i];
    else if (k === '--ids') a.ids = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--limite') a.limite = Number(argv[++i]);
    else if (k === '--prazo-min') a.prazoMin = Number(argv[++i]);
    else if (k === '--csv') a.csv = true;
    else if (k === '--forcar') a.forcar = true;
  }
  if (!['senado', 'camara', 'ambas'].includes(a.casa)) throw new Error(`--casa inválida: ${a.casa}`);
  return a;
}

/** Proposições que o site já tem, a partir das votações coletadas (id da Câmara; código da matéria no Senado). */
export function proposicoesDoSite(casa, dadosDir = DADOS) {
  const dir = path.join(dadosDir, casa, 'votacoes');
  const mapa = new Map();
  let nomes = [];
  try { nomes = fs.readdirSync(dir).filter((n) => n.endsWith('.json')); } catch { return mapa; }
  for (const n of nomes) {
    const p = lerJson(path.join(dir, n))?.proposicao;
    if (!p) continue;
    const id = casa === 'senado' ? p.codigo_materia : p.id;
    if (id === null || id === undefined || !/^\d+$/.test(String(id))) continue;
    mapa.set(String(id), { id: String(id), identificacao: p.identificacao ?? p.titulo ?? null });
  }
  // Medidas provisórias e vetos: códigos oficiais gravados pelo coletor do Executivo (ids_oficiais).
  // Vetos só têm consulta no Senado (e-Cidadania); a enquete da Câmara é por proposição da Câmara.
  for (const sub of casa === 'senado' ? ['medidas-provisorias', 'vetos'] : ['medidas-provisorias']) {
    const d = path.join(dadosDir, 'executivo', sub);
    let arqs = [];
    try { arqs = fs.readdirSync(d).filter((n) => n.endsWith('.json') && !n.startsWith('indice')); } catch { continue; }
    for (const n of arqs) {
      const x = lerJson(path.join(d, n));
      const id = casa === 'senado' ? x?.ids_oficiais?.senado_materia : x?.ids_oficiais?.camara_proposicao;
      if (!id || !/^\d+$/.test(String(id)) || mapa.has(String(id))) continue;
      mapa.set(String(id), { id: String(id), identificacao: x.identificacao ?? null });
    }
  }
  return mapa;
}

const ESTAVEL = new Set(['encerrada', 'nao_passivel']);

/** Ordem de visita: nunca verificadas primeiro, depois as verificadas há mais tempo; encerradas só com --forcar. */
export function escolher(ids, { verificados = {}, situacoes = {}, limite = null, forcar = false } = {}) {
  const candidatos = ids.filter((id) => forcar || !ESTAVEL.has(situacoes[id]));
  candidatos.sort((a, b) => (verificados[a] ?? '').localeCompare(verificados[b] ?? '') || Number(a) - Number(b));
  return limite ? candidatos.slice(0, limite) : candidatos;
}

/** Monta o registro do Senado a partir da página oficial (e, se houver, da soma do CSV de dados abertos). */
export function registroSenado(prop, pag, { acessadoEm, csv = null }) {
  const url = URL_ECIDADANIA(prop.id);
  const temNumeros = pag && pag.eh_consulta && pag.situacao !== 'nao_passivel' && Number.isInteger(pag.sim) && Number.isInteger(pag.nao);
  let conferencia = null;
  if (csv && temNumeros) {
    const s = csv.soma.get(prop.id);
    conferencia = {
      fonte: 'Dados abertos do e-Cidadania: Proposições com votos (CSV)',
      dados_ate: csv.dados_ate,
      resultado: !s ? 'matéria ausente do arquivo' : s.sim === pag.sim && s.nao === pag.nao ? 'confere' : `diverge (arquivo: SIM ${s.sim}, NÃO ${s.nao})`,
    };
  }
  return {
    casa: 'senado',
    proposicao: { id: prop.id, identificacao: pag?.identificacao ?? prop.identificacao },
    canal: { nome: 'Consulta Pública do Portal e-Cidadania', orgao: 'Senado Federal', url },
    consulta: temNumeros
      ? {
        situacao: pag.situacao,
        rotulo_oficial: pag.rotulo_oficial,
        frase_oficial: pag.frase_oficial,
        apurado_ate: pag.apurado_ate,
        sim: pag.sim,
        nao: pag.nao,
      }
      : null,
    situacao: pag?.situacao ?? 'desconhecida',
    observacao_oficial: pag?.situacao === 'nao_passivel' ? pag.rotulo_oficial : null,
    lacuna: temNumeros ? null : NAO_DISPONIVEL,
    conferencia_dados_abertos: conferencia,
    fonte: { titulo: `Consulta Pública — e-Cidadania (Senado Federal), matéria ${prop.id}`, url, orgao: 'Senado Federal', acessado_em: acessadoEm },
  };
}

/** Monta o registro da Câmara a partir da página oficial de resultados da enquete. */
export function registroCamara(prop, pag, { acessadoEm }) {
  const temNumeros = !!pag && pag.opcoes.length > 0;
  return {
    casa: 'camara',
    proposicao: { id: prop.id, identificacao: prop.identificacao },
    canal: { nome: 'Enquete da Câmara dos Deputados', orgao: 'Câmara dos Deputados', url: URL_ENQUETE(prop.id) },
    enquete: temNumeros
      ? { situacao: pag.situacao, rotulo_oficial: pag.rotulo_oficial, desde: pag.desde, pergunta: pag.pergunta, opcoes: pag.opcoes }
      : null,
    situacao: pag?.situacao ?? 'desconhecida',
    lacuna: temNumeros ? null : NAO_DISPONIVEL,
    fonte: { titulo: `Resultados da enquete — Câmara dos Deputados, proposição ${prop.id}`, url: URL_ENQUETE_RESULTADOS(prop.id), orgao: 'Câmara dos Deputados', acessado_em: acessadoEm },
  };
}

async function baixarCsv(senado, { log, prazoMs }) {
  const r = await senado.obter(CAMINHO_CSV, { statusAceitos: [301, 302, 303, 307, 308] });
  let destino = r?.headers?.get?.('location');
  if (!destino) throw new Error('link do CSV de dados abertos do e-Cidadania sem redirecionamento');
  // O cabeçalho Location chega com bytes UTF-8 crus ("Proposições"); fetch os expõe como Latin-1.
  if (/[\u0080-ÿ]/.test(destino)) destino = Buffer.from(destino, 'latin1').toString('utf8');
  const u = new URL(destino, senado.base);
  const outro = new ClienteHost(u.host, { prazoMs, log, timeoutMs: 120000 });
  await outro.lerRobots();
  const caminho = u.pathname.split('/').map((p) => encodeURIComponent(decodeURIComponent(p))).join('/') + u.search;
  const arq = await outro.obter(caminho, { binario: true, aceitar: 'text/csv,*/*', tentativas: 2 });
  if (!arq) throw new Error(`CSV não encontrado em ${u.href}`);
  return { texto: arq.corpo.toString('latin1'), url: u.href, robots: outro.robots };
}

async function coletarCasa(casa, opcoes, meta, { log, prazoMs }) {
  const props = proposicoesDoSite(casa);
  const dir = path.join(SAIDA, casa);
  const verificados = meta.verificado_em?.[casa] ?? {};
  const situacoes = {};
  for (const id of props.keys()) situacoes[id] = lerJson(path.join(dir, `${id}.json`))?.situacao;
  const ids = opcoes.ids ? opcoes.ids.filter((id) => props.has(id)) : [...props.keys()];
  const limitePadrao = casa === 'camara' ? 600 : null;
  const fila = escolher(ids, { verificados, situacoes, limite: opcoes.limite ?? limitePadrao, forcar: opcoes.forcar || !!opcoes.ids });
  const host = casa === 'senado' ? 'www12.senado.leg.br' : 'www.camara.leg.br';
  const cliente = new ClienteHost(host, { prazoMs, log, pausaMs: 1000, timeoutMs: 20000 });
  const resumo = { proposicoes_no_site: props.size, visitadas: 0, com_numeros: 0, sem_numeros: 0, gravados: 0, interrompido: null, robots: null, csv: null };
  resumo.robots = await cliente.lerRobots();
  if (cliente.bloqueado) { resumo.interrompido = cliente.bloqueado; return resumo; }

  let csv = null;
  if (casa === 'senado' && opcoes.csv) {
    try {
      const b = await baixarCsv(cliente, { log, prazoMs });
      csv = somarCsvEcidadania(b.texto, lerCsv, fila);
      resumo.csv = { url: b.url, dados_ate: csv.dados_ate, robots: b.robots };
    } catch (e) {
      resumo.csv = { erro: e.message };
      log(`[senado] CSV de dados abertos não usado: ${e.message}`);
    }
  }

  const hoje = hojeISO();
  const agoraIso = new Date().toISOString();
  meta.verificado_em ??= {};
  meta.verificado_em[casa] ??= {};
  for (const id of fila) {
    if (!cliente.cabe()) { resumo.interrompido = 'orçamento de tempo esgotado'; break; }
    const prop = props.get(id);
    let pag = null;
    try {
      if (casa === 'senado') {
        const r = await cliente.obter(`/ecidadania/visualizacaomateria?id=${id}`, { tentativas: 3 });
        pag = r && r.status === 200 ? extrairEcidadania(r.corpo) : null;
      } else {
        // Proposição sem enquete responde 500; 2 tentativas e, persistindo, fica sem número.
        const r = await cliente.obter(`/enquetes/${id}/resultados`, { tentativas: 2, statusAceitos: [500] });
        pag = r && r.status === 200 ? extrairEnqueteCamara(r.corpo) : null;
      }
    } catch (e) {
      if (e instanceof Bloqueado) { resumo.interrompido = e.message; break; }
      if (e instanceof SemTempo) { resumo.interrompido = 'orçamento de tempo esgotado'; break; }
      log(`[${casa}] ${id}: ${e.message}; mantido o arquivo anterior`);
      continue;
    }
    resumo.visitadas++;
    const reg = casa === 'senado' ? registroSenado(prop, pag, { acessadoEm: hoje, csv }) : registroCamara(prop, pag, { acessadoEm: hoje });
    if (reg.lacuna) resumo.sem_numeros++; else resumo.com_numeros++;
    reg.atualizado_em = agoraIso;
    if (gravarSeMudou(path.join(dir, `${id}.json`), reg)) resumo.gravados++;
    meta.verificado_em[casa][id] = agoraIso;
  }
  resumo.requisicoes = cliente.estat.requisicoes;
  resumo.falhas = cliente.estat.falhas.slice(0, 20);
  return resumo;
}

async function principal() {
  const opcoes = argumentos(process.argv.slice(2));
  const log = (m) => console.log(m);
  const prazoMs = Date.now() + opcoes.prazoMin * 60000;
  const arqMeta = path.join(SAIDA, 'meta.json');
  const meta = lerJson(arqMeta) ?? {};
  const execucao = { inicio: new Date().toISOString(), user_agent: USER_AGENT, opcoes, casas: {} };
  for (const casa of opcoes.casa === 'ambas' ? ['senado', 'camara'] : [opcoes.casa]) {
    try {
      execucao.casas[casa] = await coletarCasa(casa, opcoes, meta, { log, prazoMs });
    } catch (e) {
      execucao.casas[casa] = { erro: e.message };
      log(`[${casa}] coleta interrompida: ${e.message}`);
    }
    log(`[${casa}] ${JSON.stringify({ ...execucao.casas[casa], robots: undefined })}`);
  }
  execucao.fim = new Date().toISOString();
  meta.descricao = 'Canais oficiais de participação (e-Cidadania do Senado e enquetes da Câmara) das proposições do site. Pesquisa: docs/pesquisa/participacao-oficial.md';
  meta.ultima_execucao = execucao;
  meta.atualizado_em = execucao.fim;
  gravarSeMudou(arqMeta, meta);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => { console.error(e); process.exit(1); });
}
