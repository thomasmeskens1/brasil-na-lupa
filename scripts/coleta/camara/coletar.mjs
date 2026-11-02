#!/usr/bin/env node
/**
 * Coletor automático da Câmara dos Deputados (dados abertos) — voto-em-quem.
 *
 * USO (Node 20+, sem dependências; rodar na raiz do repositório ou de qualquer lugar):
 *   node scripts/coleta/camara/coletar.mjs                 # rotina diária: últimos 7 dias
 *   node scripts/coleta/camara/coletar.mjs --desde 2026-10-01
 *   node scripts/coleta/camara/coletar.mjs --completo      # backfill: 2025 até o ano corrente
 *   Opções extras: --sem-presenca  --sem-despesas  --forcar-download (ignora ETag/Last-Modified e o cache)
 *                  --cota-oficial (consulta já a página oficial da cota de cada deputado)
 *
 * PRESENÇA E DESPESAS (presenca.mjs, despesas.mjs):
 *   presenca/<ano>.json          por deputado: dias de sessão, presenças, ausências justificadas e não
 *                                justificadas, sessões (serviço oficial de frequência + arquivos de eventos).
 *   presenca/dias-<ano>.json     cache por dia do serviço de frequência (sem justificativas).
 *   despesas/<ano>/<id>.json     CEAP: totais por mês e por tipo, contagem de documentos, total da página
 *                                oficial e diferença; link para os documentos na página da cota (sem CPF).
 *   despesas/<ano>/resumo.json   totais por deputado e por liderança.
 *   despesas/<ano>/pagina-oficial.json  totais da página oficial da cota (conferência semanal).
 *   Os arquivos em massa só são baixados quando ETag/Last-Modified mudam (guardados em meta.json,
 *   "arquivos_em_massa"); se o conteúdo baixado tiver o mesmo SHA-256, nada é reprocessado.
 *
 * O QUE GERA (somente em dados/camara/):
 *   parlamentares.json          deputados em exercício (API /deputados) + nome civil (arquivo deputados.json).
 *                               Não guarda CPF, data de nascimento nem outro dado pessoal.
 *   votacoes/indice-<ano>.json  { atualizado_em, ano, itens: resumo[] } — todas as votações do Plenário
 *                               (nominais, simbólicas e secretas) + votações nominais de comissões.
 *                               indice-2024.json só traz as votações do PLP 68/2024 e do PLP 108/2024.
 *   votacoes/<id>.json          detalhe: votos nominais (partido/UF no momento do voto), orientações de bancada,
 *                               placar contado a partir dos votos. Votação sem votos = "simbolica"
 *                               (votos vazio, placar null). Votação com participação registrada mas sem voto
 *                               individual = "secreta" (votos vazio; placar só com os totais da fonte).
 *   meta.json                   { atualizado_em, periodo, contagens, fontes, ultima_execucao }
 *
 * DE ONDE VEM (ver docs/pesquisa/fontes-federais.md):
 *   - Arquivos anuais em massa, regerados toda madrugada: votacoes-<ano>.json, votacoesVotos-<ano>.csv,
 *     votacoesOrientacoes-<ano>.csv, votacoesProposicoes-<ano>.csv (≈80 MB/ano, baixados inteiros).
 *   - API v2 (https://dadosabertos.camara.leg.br/api/v2) para: deputados em exercício; nomes dos órgãos;
 *     proposição de votações que o arquivo votacoesProposicoes não vincula (pelo id: {idProposição}-{seq});
 *     votações do PLP 68/2024 (id 2430143) e PLP 108/2024 (id 2438459) via /proposicoes/{id}/votacoes
 *     (exclui registros de órgãos administrativos, ex.: SECAP, que são encaminhamentos e não votações);
 *     e votações do Plenário dos últimos 3 dias que ainda não entraram no arquivo anual (o arquivo prevalece).
 *
 * MODO INCREMENTAL (padrão): baixa o arquivo anual do(s) ano(s) entre --desde e hoje, regrava o índice do
 * ano inteiro e só (re)gera o detalhe de votações com data >= --desde ou cujo arquivo ainda não existe.
 *
 * GRAVAÇÃO: atômica (temporário + rename). Arquivo cujo conteúdo não mudou (ignorando atualizado_em e
 * acessado_em) não é reescrito, para não poluir o histórico do git. meta.json muda a cada execução.
 *
 * LIMITES: no máximo 4 requisições simultâneas; até 6 tentativas com espera crescente e Retry-After;
 * User-Agent identificável. Sugestão de agendamento: diário entre 08h30 e 09h00 de Brasília (os arquivos
 * da Câmara ficam prontos por volta de 05h30).
 *
 * Código de saída: 0 = ok; 1 = erro fatal (nada é gravado pela metade; arquivos já gravados ficam válidos).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  obter, paraCada, lerCsv, lerJson, gravarSeMudou, hojeISO, somarDias, estatisticas, contagemGravacao,
} from './lib.mjs';
import { coletarPresencaEDespesas } from './complementos.mjs';

const API = 'https://dadosabertos.camara.leg.br/api/v2';
const ARQ = 'https://dadosabertos.camara.leg.br/arquivos';
const ORGAO = 'Câmara dos Deputados';
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DIR = path.join(RAIZ, 'dados', 'camara');
const DIR_VOT = path.join(DIR, 'votacoes');
const ID_PLENARIO = 180;
const PROPOSICOES_ACOMPANHADAS = [
  { id: '2430143', titulo: 'PLP 68/2024', tema: 'Reforma tributária' },
  { id: '2438459', titulo: 'PLP 108/2024', tema: 'Reforma tributária' },
];

// ---------- argumentos ----------
const args = process.argv.slice(2);
const hoje = hojeISO();
const anoAtual = Number(hoje.slice(0, 4));
const completo = args.includes('--completo');
let desde = somarDias(hoje, -7);
const iDesde = args.indexOf('--desde');
if (iDesde >= 0) {
  desde = args[iDesde + 1] || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || Number.isNaN(Date.parse(desde))) {
    console.error('Uso: --desde AAAA-MM-DD'); process.exit(1);
  }
}
if (completo) desde = '2025-01-01';
const anos = [];
for (let a = Math.max(Number(desde.slice(0, 4)), 2000); a <= anoAtual; a++) anos.push(a);
const forcar = args.includes('--forcar-download');
const cotaOficial = args.includes('--cota-oficial');
const comPresenca = !args.includes('--sem-presenca');
const comDespesas = !args.includes('--sem-despesas');
const inicio = Date.now();
const log =(...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(1)}s]`, ...m);

// ---------- auxiliares ----------
const fonte = (titulo, url) => ({ titulo, url, orgao: ORGAO, acessado_em: hoje });
const urlProposicao = (id) => `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`;
const num = (x) => (x === '' || x == null || Number.isNaN(Number(x)) ? null : Number(x));
const cmpPt = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' });
const arquivoVot = (id) => path.join(DIR_VOT, `${id}.json`);

const orgaos = new Map(); // idOrgao -> { sigla, nome, tipo }
async function carregarOrgaos(ids) {
  await paraCada([...new Set(ids)].filter((id) => id != null && !orgaos.has(id)), async (id) => {
    const r = await obter(`${API}/orgaos/${id}`, { opcional: true });
    const d = r?.dados;
    orgaos.set(id, d ? { sigla: d.sigla, nome: d.nome, tipo: d.tipoOrgao } : { sigla: null, nome: null, tipo: null });
  });
}

const proposicoesApi = new Map(); // id -> proposição | null
async function carregarProposicoes(ids) {
  await paraCada([...new Set(ids)].filter((id) => id && !proposicoesApi.has(id)), async (id) => {
    const r = await obter(`${API}/proposicoes/${id}`, { opcional: true });
    const d = r?.dados;
    proposicoesApi.set(id, d ? { id: String(d.id), sigla: d.siglaTipo, numero: d.numero, ano: d.ano, ementa: d.ementa } : null);
  });
}

function formatarProposicao(p) {
  if (!p) return null;
  const titulo = p.sigla && p.numero != null ? `${p.sigla} ${p.numero}/${p.ano}` : null;
  return { id: String(p.id), sigla: p.sigla || null, numero: num(p.numero), ano: num(p.ano), titulo,
    ementa: p.ementa || null, url: urlProposicao(p.id) };
}

/** Monta o arquivo de detalhe (contrato "votacao" de dados/esquema.json) a partir do registro normalizado. */
function montarDetalhe(r) {
  const lacunas = [];
  const comVoto = r.votos.filter((v) => v.voto);
  let tipo, placar = null, votos = [];
  if (!r.votos.length) {
    tipo = 'simbolica';
  } else if (!comVoto.length) {
    tipo = 'secreta';
    lacunas.push(`Votação secreta: a fonte registra a participação de ${r.votos.length} deputados, mas não o voto de cada um.`);
    if (r.totais && r.totais.sim + r.totais.nao + r.totais.outros > 0) {
      placar = { sim: r.totais.sim, nao: r.totais.nao, abstencao: null, obstrucao: null, outros: r.totais.outros };
      lacunas.push('Placar da votação secreta: a fonte informa só os totais de "Sim", "Não" e "outros".');
    } else lacunas.push('Placar não disponível em fonte oficial.');
  } else {
    tipo = 'nominal';
    votos = r.votos.slice().sort((a, b) => cmpPt(a.nome, b.nome) || cmpPt(a.parlamentar_id, b.parlamentar_id));
    placar = { sim: 0, nao: 0, abstencao: 0, obstrucao: 0, outros: 0 };
    for (const v of votos) {
      if (v.voto === 'Sim') placar.sim++;
      else if (v.voto === 'Não') placar.nao++;
      else if (v.voto === 'Abstenção') placar.abstencao++;
      else if (v.voto === 'Obstrução') placar.obstrucao++;
      else placar.outros++;
    }
    if (comVoto.length !== votos.length) lacunas.push(`${votos.length - comVoto.length} registro(s) sem tipo de voto na fonte.`);
    if (r.totais) {
      const outros = votos.length - placar.sim - placar.nao;
      if (r.totais.sim !== placar.sim || r.totais.nao !== placar.nao || r.totais.outros !== outros) {
        lacunas.push(`Os totais publicados pela fonte (Sim ${r.totais.sim}, Não ${r.totais.nao}, outros ${r.totais.outros}) diferem da contagem dos votos individuais.`);
      }
    }
  }
  const props = r.proposicoes.map(formatarProposicao);
  const prefixo = r.id.split('-')[0];
  const principal = props.find((p) => p.id === prefixo) || props[0] || null;
  if (!principal) lacunas.push('Proposição votada não informada pela fonte.');
  let resultado = null;
  if (r.aprovacao === 1) resultado = 'aprovada';
  else if (r.aprovacao === 0) resultado = 'rejeitada';
  else lacunas.push('Resultado não informado em campo próprio da fonte; ver descrição oficial.');
  const org = orgaos.get(r.idOrgao) || {};
  const detalhe = {
    id: r.id,
    casa: 'camara',
    data: r.data,
    // Hora do registro só quando cai no mesmo dia da votação (sessões que passam da meia-noite).
    hora: r.dataHora && r.dataHora.slice(0, 10) === r.data ? r.dataHora.slice(11, 16) : null,
    registrado_em: r.dataHora || null,
    orgao: r.idOrgao === ID_PLENARIO ? 'Plenário' : 'comissão',
    orgao_sigla: r.siglaOrgao || org.sigla || null,
    orgao_nome: org.nome || null,
    proposicao: principal,
    ...(props.length > 1 ? { proposicoes: props } : {}),
    descricao: r.descricao || null,
    descricao_abertura: r.abertura || null,
    resultado,
    tipo,
    placar,
    orientacoes: r.orientacoes.slice().sort((a, b) => cmpPt(a.bancada, b.bancada)),
    votos,
    url: r.idEvento ? `https://www.camara.leg.br/evento-legislativo/${r.idEvento}` : null,
    fonte: fonte(`Votação ${r.id} — Dados Abertos da Câmara dos Deputados`, `${API}/votacoes/${r.id}`),
    lacunas,
  };
  if (!r.orientacoes.length && tipo !== 'simbolica') lacunas.push('Nenhuma orientação de bancada registrada na fonte.');
  return detalhe;
}

function resumo(d) {
  return {
    id: d.id, data: d.data, hora: d.hora, orgao: d.orgao, orgao_sigla: d.orgao_sigla,
    proposicao: d.proposicao ? { id: d.proposicao.id, titulo: d.proposicao.titulo } : null,
    descricao: d.descricao, resultado: d.resultado, tipo: d.tipo, placar: d.placar,
  };
}

// ---------- fontes: arquivo anual em massa ----------
async function lerAnoEmMassa(ano) {
  const u = {
    votacoes: `${ARQ}/votacoes/json/votacoes-${ano}.json`,
    votos: `${ARQ}/votacoesVotos/csv/votacoesVotos-${ano}.csv`,
    orientacoes: `${ARQ}/votacoesOrientacoes/csv/votacoesOrientacoes-${ano}.csv`,
    proposicoes: `${ARQ}/votacoesProposicoes/csv/votacoesProposicoes-${ano}.csv`,
  };
  const t = { timeoutMs: 300000 };
  const [vot, votosTxt, oriTxt, propTxt] = await Promise.all([
    obter(u.votacoes, t), obter(u.votos, { ...t, tipo: 'text' }),
    obter(u.orientacoes, { ...t, tipo: 'text' }), obter(u.proposicoes, { ...t, tipo: 'text' }),
  ]);
  const agrupar = (linhas, campo = 'idVotacao') => {
    const m = new Map();
    for (const l of linhas) { if (!m.has(l[campo])) m.set(l[campo], []); m.get(l[campo]).push(l); }
    return m;
  };
  const votos = agrupar(lerCsv(votosTxt));
  const ori = agrupar(lerCsv(oriTxt));
  const prop = agrupar(lerCsv(propTxt));
  const registros = new Map();
  for (const v of vot.dados || []) {
    registros.set(v.id, {
      id: v.id, data: v.data, dataHora: v.dataHoraRegistro, idOrgao: v.idOrgao, siglaOrgao: v.siglaOrgao,
      idEvento: v.idEvento || null, aprovacao: v.aprovacao ?? null, descricao: v.descricao,
      abertura: v.ultimaAberturaVotacao?.descricao || null,
      totais: { sim: v.votosSim ?? 0, nao: v.votosNao ?? 0, outros: v.votosOutros ?? 0 },
      votos: (votos.get(v.id) || []).map((x) => ({
        parlamentar_id: x.deputado_id, nome: x.deputado_nome, partido: x.deputado_siglaPartido || null,
        uf: x.deputado_siglaUf || null, voto: x.voto || null,
      })),
      orientacoes: (ori.get(v.id) || []).map((x) => ({ bancada: x.siglaBancada, orientacao: x.orientacao || null })),
      proposicoes: (prop.get(v.id) || []).filter((x) => x.proposicao_id).map((x) => ({
        id: x.proposicao_id, sigla: x.proposicao_siglaTipo, numero: x.proposicao_numero, ano: x.proposicao_ano,
        ementa: x.proposicao_ementa,
      })),
      origem: 'arquivo',
    });
  }
  return { registros, urls: Object.values(u), totalVotos: [...votos.values()].reduce((s, a) => s + a.length, 0) };
}

// ---------- fonte: API, uma votação ----------
async function lerVotacaoApi(id) {
  const [det, vts, ori] = await Promise.all([
    obter(`${API}/votacoes/${id}`), obter(`${API}/votacoes/${id}/votos`), obter(`${API}/votacoes/${id}/orientacoes`),
  ]);
  const v = det.dados;
  return {
    id: v.id, data: v.data, dataHora: v.dataHoraRegistro, idOrgao: v.idOrgao, siglaOrgao: v.siglaOrgao,
    idEvento: v.idEvento || null, aprovacao: v.aprovacao ?? null, descricao: v.descricao,
    abertura: v.descUltimaAberturaVotacao || null,
    totais: null, // a API de detalhe não traz totais em campo próprio
    votos: (vts.dados || []).map((x) => ({
      parlamentar_id: String(x.deputado_.id), nome: x.deputado_.nome, partido: x.deputado_.siglaPartido || null,
      uf: x.deputado_.siglaUf || null, voto: x.tipoVoto || null,
    })),
    orientacoes: (ori.dados || []).map((x) => ({ bancada: x.siglaPartidoBloco, orientacao: x.orientacaoVoto || null })),
    proposicoes: (v.proposicoesAfetadas || []).map((p) => ({ id: String(p.id), sigla: p.siglaTipo, numero: p.numero, ano: p.ano, ementa: p.ementa })),
    origem: 'api',
  };
}

// ---------- parlamentares ----------
async function coletarParlamentares() {
  const urlApi = `${API}/deputados?itens=1000&ordem=ASC&ordenarPor=nome`;
  const urlBulk = `${ARQ}/deputados/json/deputados.json`;
  const [lista, cadastro] = await Promise.all([obter(urlApi), obter(urlBulk, { timeoutMs: 300000 })]);
  const civil = new Map();
  for (const d of cadastro.dados || []) civil.set(d.uri.split('/').pop(), d.nomeCivil || null); // só o nome civil
  const itens = (lista.dados || []).map((d) => ({
    id: String(d.id), nome: d.nome, nome_civil: civil.get(String(d.id)) || null, partido: d.siglaPartido || null,
    uf: d.siglaUf || null, em_exercicio: true, foto: d.urlFoto || null,
    url_oficial: `https://www.camara.leg.br/deputados/${d.id}`, email: d.email || null,
  })).sort((a, b) => cmpPt(a.nome, b.nome) || cmpPt(a.id, b.id));
  if (itens.length < 400) throw new Error(`Lista de deputados suspeita: ${itens.length} itens`);
  gravarSeMudou(path.join(DIR, 'parlamentares.json'), {
    atualizado_em: hoje,
    fonte: fonte('Deputados em exercício — Dados Abertos da Câmara dos Deputados', urlApi),
    legislatura: lista.dados[0]?.idLegislatura ?? null,
    itens,
  });
  return { n: itens.length, urls: [urlApi, urlBulk] };
}

// ---------- principal ----------
async function main() {
  log(`modo=${completo ? 'completo' : 'incremental'} desde=${desde} anos=${anos.join(',')}`);
  fs.mkdirSync(DIR_VOT, { recursive: true });
  const fontesUsadas = new Set();

  const parl = await coletarParlamentares();
  parl.urls.forEach((u) => fontesUsadas.add(u));
  log(`parlamentares: ${parl.n}`);

  // Votações das proposições acompanhadas (lista oficial por proposição).
  const acompanhadas = new Map(); // idVotacao -> [títulos]
  const listaAcomp = {};
  for (const p of PROPOSICOES_ACOMPANHADAS) {
    const u = `${API}/proposicoes/${p.id}/votacoes`;
    fontesUsadas.add(u);
    const r = await obter(u);
    listaAcomp[p.id] = r.dados || [];
  }
  const idsOrgAcomp = Object.values(listaAcomp).flat().map((v) => num(v.uriOrgao?.split('/').pop()));
  await carregarOrgaos(idsOrgAcomp);
  for (const p of PROPOSICOES_ACOMPANHADAS) {
    p.votacoes = [];
    for (const v of listaAcomp[p.id]) {
      const idOrg = num(v.uriOrgao?.split('/').pop());
      const tipoOrg = orgaos.get(idOrg)?.tipo || '';
      // Só Plenário e comissões; registros de órgãos administrativos (encaminhamentos) ficam de fora.
      if (idOrg !== ID_PLENARIO && !/^Comiss/i.test(tipoOrg)) continue;
      p.votacoes.push(v.id);
      if (!acompanhadas.has(v.id)) acompanhadas.set(v.id, { data: v.data, titulos: [] });
      acompanhadas.get(v.id).titulos.push(p.titulo);
    }
  }

  const detalhesPorAno = new Map(); // ano -> Map(id -> detalhe)
  const guardar = (d) => {
    const a = Number(d.data.slice(0, 4));
    if (!detalhesPorAno.has(a)) detalhesPorAno.set(a, new Map());
    detalhesPorAno.get(a).set(d.id, d);
  };
  const deveGravar = (d) => completo || d.data >= desde || !fs.existsSync(arquivoVot(d.id));
  let novosOuAtualizados = 0;
  const gravarDetalhe = (d) => { if (deveGravar(d) && gravarSeMudou(arquivoVot(d.id), d)) novosOuAtualizados++; };
  const vistos = new Set();

  for (const ano of anos) {
    log(`baixando arquivos em massa de ${ano}…`);
    const { registros, urls, totalVotos } = await lerAnoEmMassa(ano);
    urls.forEach((u) => fontesUsadas.add(u));
    const sel = [...registros.values()].filter((r) =>
      r.idOrgao === ID_PLENARIO || r.votos.length > 0 || acompanhadas.has(r.id));
    log(`${ano}: ${registros.size} votações no arquivo (${totalVotos} votos); selecionadas ${sel.length}`);
    await carregarOrgaos(sel.map((r) => r.idOrgao));
    // Proposição de votações que o arquivo votacoesProposicoes não vincula: pelo prefixo do id.
    const semProp = sel.filter((r) => !r.proposicoes.length);
    const faltam = [];
    for (const r of semProp) {
      const pre = r.id.split('-')[0];
      const antigo = lerJson(arquivoVot(r.id));
      if (antigo?.proposicao?.id === pre && !completo) {
        const p = antigo.proposicao;
        r.proposicoes = [{ id: p.id, sigla: p.sigla, numero: p.numero, ano: p.ano, ementa: p.ementa }];
      } else faltam.push(pre);
    }
    if (faltam.length) log(`${ano}: consultando ${new Set(faltam).size} proposições na API…`);
    await carregarProposicoes(faltam);
    for (const r of semProp) {
      if (r.proposicoes.length) continue;
      const p = proposicoesApi.get(r.id.split('-')[0]);
      if (p) r.proposicoes = [p];
    }
    for (const r of sel) {
      const d = montarDetalhe(r);
      guardar(d); gravarDetalhe(d); vistos.add(d.id);
    }
  }

  // Votações acompanhadas fora dos anos baixados (ex.: 2024) e Plenário recente ainda fora do arquivo anual.
  const extras = [];
  for (const [id, info] of acompanhadas) {
    if (vistos.has(id)) continue;
    const antigo = lerJson(arquivoVot(id));
    if (antigo && !completo) { guardar(antigo); vistos.add(id); } else extras.push(id);
  }
  const iniRecente = desde > somarDias(hoje, -3) ? desde : somarDias(hoje, -3);
  const uRec = `${API}/votacoes?dataInicio=${iniRecente}&dataFim=${hoje}&idOrgao=${ID_PLENARIO}&itens=200`;
  const rec = await obter(uRec);
  for (const v of rec.dados || []) if (!vistos.has(v.id) && !extras.includes(v.id)) extras.push(v.id);
  if (extras.length) log(`consultando ${extras.length} votações na API (fora dos arquivos anuais)…`);
  const regsApi = await Promise.all(extras.map(lerVotacaoApi));
  await carregarOrgaos(regsApi.map((r) => r.idOrgao));
  for (const r of regsApi) {
    const d = montarDetalhe(r);
    if (!acompanhadas.has(d.id) && d.data < '2025-01-01') continue;
    guardar(d); vistos.add(d.id);
    if (gravarSeMudou(arquivoVot(d.id), d)) novosOuAtualizados++;
  }
  if (regsApi.length) fontesUsadas.add(`${API}/votacoes/{id}, /votos, /orientacoes`);

  // Índices: anos baixados (ano inteiro) e anos só com votações acompanhadas.
  for (const [ano, mapa] of detalhesPorAno) {
    if (!anos.includes(ano) && ano >= 2025) {
      // Ano não baixado nesta execução: mescla com o índice existente.
      const idx = lerJson(path.join(DIR_VOT, `indice-${ano}.json`));
      for (const it of idx?.itens || []) if (!mapa.has(it.id)) { const d = lerJson(arquivoVot(it.id)); if (d) mapa.set(d.id, d); }
    }
    const itens = [...mapa.values()].sort((a, b) =>
      (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')) || cmpPt(a.id, b.id)).map(resumo);
    gravarSeMudou(path.join(DIR_VOT, `indice-${ano}.json`), {
      atualizado_em: hoje, ano,
      abrangencia: ano < 2025
        ? `Somente votações do Plenário e de comissões das proposições ${PROPOSICOES_ACOMPANHADAS.map((p) => p.titulo).join(' e ')}.`
        : 'Todas as votações do Plenário (nominais, simbólicas e secretas) e as votações nominais de comissões.',
      fonte: fonte(`Votações de ${ano} — Dados Abertos da Câmara dos Deputados`, `${ARQ}/votacoes/json/votacoes-${ano}.json`),
      itens,
    });
  }

  const compl = await coletarPresencaEDespesas({
    DIR, hoje, anoAtual, anos, completo, forcar, cotaOficial, comPresenca, comDespesas, log, fonte,
  });
  const titulosFonte = new Map();
  for (const [u, t] of compl.fontes) { fontesUsadas.add(u); titulosFonte.set(u, t); }

  // meta.json a partir de todos os índices gravados.
  const contagens = { parlamentares_em_exercicio: parl.n, votacoes: 0, nominais: 0, simbolicas: 0, secretas: 0, votos: 0, por_ano: {} };
  let ini = null, fim = null;
  for (const f of fs.readdirSync(DIR_VOT).filter((f) => /^indice-\d{4}\.json$/.test(f)).sort()) {
    const idx = lerJson(path.join(DIR_VOT, f));
    const c = { votacoes: 0, nominais: 0, simbolicas: 0, secretas: 0, votos: 0, plenario: 0, comissoes: 0 };
    for (const it of idx.itens) {
      c.votacoes++;
      c[it.tipo === 'nominal' ? 'nominais' : it.tipo === 'simbolica' ? 'simbolicas' : 'secretas']++;
      c[it.orgao === 'Plenário' ? 'plenario' : 'comissoes']++;
      if (it.tipo === 'nominal' && it.placar) c.votos += Object.values(it.placar).reduce((s, x) => s + x, 0);
      if (!ini || it.data < ini) ini = it.data;
      if (!fim || it.data > fim) fim = it.data;
    }
    contagens.por_ano[idx.ano] = c;
    for (const k of ['votacoes', 'nominais', 'simbolicas', 'secretas', 'votos']) contagens[k] += c[k];
  }
  contagens.presenca = compl.contagens.presenca;
  contagens.despesas = compl.contagens.despesas;
  const duracao = Math.round((Date.now() - inicio) / 1000);
  const meta = {
    atualizado_em: new Date().toISOString(),
    periodo: { inicio: ini, fim },
    contagens,
    proposicoes_acompanhadas: PROPOSICOES_ACOMPANHADAS.map((p) => ({
      id: p.id, titulo: p.titulo, tema: p.tema, url: urlProposicao(p.id), votacoes: p.votacoes,
    })),
    fontes: [...fontesUsadas].sort().map((u) => fonte(titulosFonte.get(u) ||
      (u.includes('/arquivos/') ? 'Arquivo de dados abertos (anual)' : 'API de Dados Abertos v2'), u)),
    observacoes: [
      'Presença: dias e sessões deliberativas por deputado conforme o serviço oficial de frequência da Câmara; sessões conjuntas do Congresso não entram (ver lacunas em presenca/<ano>.json).',
      'Despesas (CEAP): arquivo em massa anual, sem CPF; desde ago/2025 o arquivo não traz "PASSAGEM AÉREA - SIGEPA", que a página oficial soma (ver total_pagina_oficial em despesas/<ano>/resumo.json).',
    ],
    arquivos_em_massa: compl.arquivos,
    ultima_execucao: {
      modo: completo ? 'completo' : 'incremental', desde, anos_baixados: anos, duracao_segundos: duracao,
      requisicoes: estatisticas.requisicoes, retentativas: estatisticas.retentativas,
      votacoes_gravadas: novosOuAtualizados, arquivos_gravados: contagemGravacao.gravados + 1,
      arquivos_inalterados: contagemGravacao.inalterados,
      presenca: compl.execucao.presenca, despesas: compl.execucao.despesas,
      ...(compl.erros.length ? { erros: compl.erros } : {}),
    },
  };
  fs.writeFileSync(path.join(DIR, 'meta.json.tmp'), JSON.stringify(meta, null, 2) + '\n');
  fs.renameSync(path.join(DIR, 'meta.json.tmp'), path.join(DIR, 'meta.json'));
  log(`fim: ${contagens.votacoes} votações no total, ${novosOuAtualizados} detalhes gravados, ` +
    `${contagemGravacao.inalterados} inalterados, ${estatisticas.requisicoes} requisições, ${estatisticas.retentativas} retentativas.`);
  if (compl.erros.length) { console.error('ERROS em presença/despesas:', compl.erros.join(' | ')); process.exitCode = 1; }
}

main().catch((e) => { console.error('ERRO:', e.stack || e.message); process.exit(1); });
