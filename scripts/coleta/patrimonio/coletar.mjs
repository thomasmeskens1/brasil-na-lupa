#!/usr/bin/env node
// Coletor de PATRIMÔNIO DECLARADO — bens que cada parlamentar federal em exercício declarou ao
// Tribunal Superior Eleitoral (TSE) no registro da candidatura que o levou ao mandato atual.
// Fontes: Portal de Dados Abertos do TSE (consulta_cand e bem_candidato, cdn.tse.jus.br; leitura
// parcial do ZIP por HTTP Range, em fluxo), API de dados abertos da Câmara e do Senado.
//
// Saídas (somente em dados/patrimonio/): camara.json, senado.json, meta.json.
// Uso: node scripts/coleta/patrimonio/coletar.mjs [--forcar]   (sem --forcar: só se as listas mudaram ou a cada 7 dias)
//
// PRIVACIDADE: o CPF (da API da Câmara e do TSE) e a data de nascimento (API do Senado e TSE) são
// usados só em memória para o vínculo exato; nunca são gravados, nem impressos no log. A descrição
// livre de cada bem (DS_BEM_CANDIDATO) não é lida: grava-se só o tipo e o valor, como o TSE publica.
// REGRAS: robots.txt de cada host lido antes de qualquer outra requisição; pedidos um a um, com
// intervalo de 1 s às APIs das casas; User-Agent honesto.
import path from 'node:path';
import { cabecalho, listarZip, percorrerCsvRemoto } from '../eleitos/zip-remoto.mjs';
import { obter, carregarRobots, permitido, robotsCarregados, gravarAtomico, lerJson, hojeISO, RAIZ, estat } from '../autoria/lib.mjs';
import { soDigitos, cpfValido, dataIso, ehEleito, escolherCandidatura, vincularSenadores, acumularBem, itemParlamentar } from './bens.mjs';

const SAIDA = path.join(RAIZ, 'dados', 'patrimonio');
const CDN = 'https://cdn.tse.jus.br/estatistica/sead/odsele';
const FORCAR = process.argv.includes('--forcar');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const urlCand = (ano) => `${CDN}/consulta_cand/consulta_cand_${ano}.zip`;
const urlBens = (ano) => `${CDN}/bem_candidato/bem_candidato_${ano}.zip`;
const PAGINA = (ano) => `https://dadosabertos.tse.jus.br/dataset/candidatos-${ano}`;
const CARGO = { 5: 'Senador', 6: 'Deputado federal' };

async function zipTse(url) {
  const regras = await carregarRobots(new URL(url).host);
  if (!permitido(regras, url)) throw new Error(`bloqueado pelo robots.txt: ${url}`);
  const cab = await cabecalho(url);
  if (!cab.tamanho) throw new Error(`tamanho desconhecido: ${url}`);
  const entradas = await listarZip(url, cab.tamanho);
  const nome = url.split('/').pop().replace('.zip', '_BRASIL.csv');
  const entrada = entradas.find((e) => e.nome === nome);
  if (!entrada) throw new Error(`entrada ${nome} ausente em ${url}`);
  return { url, entrada, etag: cab.etag, last_modified: cab.last_modified };
}

/** Candidaturas de um ano para os cargos pedidos: [{ sq, ano, uf, cargo, cpf?, nascimento?, ... }]. */
async function lerCandidaturas(zip, ano, cargos, { comCpf, soEleitos }) {
  const out = [];
  let cpfsValidos = 0;
  await percorrerCsvRemoto(zip.url, zip.entrada, (c, ix) => {
    const cargo = Number(c[ix.CD_CARGO]);
    if (!cargos.has(cargo) || Number(c[ix.ANO_ELEICAO]) !== ano) return;
    if (soEleitos && !ehEleito(c[ix.CD_SIT_TOT_TURNO])) return;
    const r = {
      sq: c[ix.SQ_CANDIDATO], ano, uf: c[ix.SG_UF], cargo: CARGO[cargo], situacao: c[ix.DS_SIT_TOT_TURNO] || null,
      ordinaria: Number(c[ix.CD_TIPO_ELEICAO]) === 2 ? 1 : 0, turno: Number(c[ix.NR_TURNO]) || 1,
    };
    if (comCpf) { r.cpf = soDigitos(c[ix.NR_CPF_CANDIDATO]); if (cpfValido(r.cpf)) cpfsValidos++; }
    else r.nascimento = dataIso(c[ix.DT_NASCIMENTO]);
    out.push(r);
  });
  return { candidaturas: out, cpfsValidos };
}

async function lerBens(zip, sqs) {
  const mapa = new Map();
  await percorrerCsvRemoto(zip.url, zip.entrada, (c, ix) => {
    const sq = c[ix.SQ_CANDIDATO];
    if (!sqs.has(sq)) return;
    acumularBem(mapa, { sq, ordem: c[ix.NR_ORDEM_BEM_CANDIDATO], tipo: c[ix.DS_TIPO_BEM_CANDIDATO], valor: c[ix.VR_BEM_CANDIDATO], atualizado: c[ix.DT_ULT_ATUAL_BEM_CANDIDATO] });
  });
  return mapa;
}

/** Busca na API da casa, um pedido por vez com 1 s de intervalo. Nunca registra o conteúdo. */
async function porParlamentar(ids, url, extrair) {
  const out = new Map();
  const falhas = [];
  for (const id of ids) {
    try {
      const r = await obter(url(id));
      out.set(id, extrair(r.dados));
    } catch (e) {
      falhas.push(id);
      console.warn(`[patrimonio] ${url(id)}: ${e.message}`);
    }
    await dormir(1000);
  }
  return { out, falhas };
}

const fonteTse = (ano, zips, hoje) => [
  { titulo: `Candidatos ${ano} — Portal de Dados Abertos do TSE`, url: PAGINA(ano), orgao: 'Tribunal Superior Eleitoral (TSE)', acessado_em: hoje, arquivo: zips.cand[ano].url },
  { titulo: `Bens de candidatos ${ano} — Portal de Dados Abertos do TSE`, url: PAGINA(ano), orgao: 'Tribunal Superior Eleitoral (TSE)', acessado_em: hoje, arquivo: zips.bens[ano].url },
];

function montarSaida({ casa, hoje, itens, sem, fontes, criterio, total }) {
  const ord = (a, b) => Number(a) - Number(b);
  const obj = Object.fromEntries([...itens].sort(([a], [b]) => ord(a, b)));
  return {
    atualizado_em: hoje,
    casa,
    aviso: 'Valores declarados pelo próprio candidato à Justiça Eleitoral no registro da candidatura, como o TSE publica. Não é o patrimônio atual nem foi conferido pelo site. A descrição de cada bem não é reproduzida.',
    criterio_vinculo: criterio,
    fontes,
    robots_txt: robotsCarregados(),
    totais: {
      parlamentares_na_lista: total,
      com_vinculo: itens.size,
      com_bens_declarados: [...itens.values()].filter((i) => i.quantidade_bens > 0).length,
      sem_vinculo: sem.length,
    },
    sem_vinculo: sem.sort((a, b) => ord(a.id, b.id)),
    itens: obj,
  };
}

async function main() {
  const hoje = hojeISO();
  const inicio = Date.now();
  const meta = lerJson(path.join(SAIDA, 'meta.json')) ?? {};
  const camaraLista = (lerJson(path.join(RAIZ, 'dados/camara/parlamentares.json'))?.itens ?? []).filter((p) => /^\d+$/.test(String(p.id)));
  const senadoLista = (lerJson(path.join(RAIZ, 'dados/senado/parlamentares.json'))?.itens ?? []).filter((p) => /^\d+$/.test(String(p.id)));
  if (!camaraLista.length || !senadoLista.length) throw new Error('listas de parlamentares ausentes em dados/camara e dados/senado');

  // O TSE regera os arquivos todo dia (data de geração em cada linha), então a mudança deles não
  // indica dado novo: refaz a coleta quando as listas de parlamentares mudam ou a cada 7 dias.
  const assinatura = JSON.stringify({ camara: camaraLista.map((p) => p.id), senado: senadoLista.map((p) => [p.id, p.participacao]) });
  const dias = meta.atualizado_em ? (Date.parse(hoje) - Date.parse(meta.atualizado_em)) / 86400000 : Infinity;
  if (!FORCAR && meta.assinatura === assinatura && dias < 7) {
    console.log(`[patrimonio] listas de parlamentares sem mudança e última coleta há ${dias} dia(s); nada a fazer.`);
    return;
  }
  const zips = { cand: {}, bens: {} };
  for (const ano of [2018, 2022]) { zips.cand[ano] = await zipTse(urlCand(ano)); zips.bens[ano] = await zipTse(urlBens(ano)); }

  // ---- Câmara: CPF da API oficial (só em memória) → candidatura de deputado federal 2022 ----
  const camaraIds = camaraLista.map((p) => String(p.id));
  const cpfs = await porParlamentar(camaraIds, (id) => `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`, (d) => soDigitos(d?.dados?.cpf));
  const porCpf = new Map();
  for (const [id, cpf] of cpfs.out) if (cpfValido(cpf)) porCpf.set(cpf, [...(porCpf.get(cpf) ?? []), id]);
  const dep = await lerCandidaturas(zips.cand[2022], 2022, new Set([6]), { comCpf: true, soEleitos: false });
  const candPorDep = new Map();
  for (const c of dep.candidaturas) {
    const ids = porCpf.get(c.cpf);
    delete c.cpf;
    if (!ids || ids.length !== 1) continue;
    candPorDep.set(ids[0], [...(candPorDep.get(ids[0]) ?? []), c]);
  }
  cpfs.out.clear(); porCpf.clear();
  const semCamara = [];
  const vincCamara = new Map();
  for (const id of camaraIds) {
    const c = escolherCandidatura(candPorDep.get(id));
    if (c) vincCamara.set(id, c);
    else semCamara.push({ id, motivo: cpfs.falhas.includes(id) ? 'falha ao consultar a API da Câmara' : 'sem candidatura a deputado federal em 2022 com o mesmo CPF' });
  }

  // ---- Senado: data de nascimento da API do Senado (só em memória) + UF, entre eleitos senadores ----
  const senIds = senadoLista.map((p) => String(p.id));
  const nasc = await porParlamentar(senIds, (id) => `https://legis.senado.leg.br/dadosabertos/senador/${id}`, (d) => d?.DetalheParlamentar?.Parlamentar?.DadosBasicosParlamentar?.DataNascimento ?? null);
  const eleitosSen = [];
  for (const ano of [2018, 2022]) eleitosSen.push(...(await lerCandidaturas(zips.cand[ano], ano, new Set([5]), { comCpf: false, soEleitos: true })).candidaturas);
  const { vinculos: vincSenado, sem: semSenado } = vincularSenadores(
    senadoLista.map((p) => ({ id: String(p.id), uf: p.uf, titular: /titular/i.test(p.participacao ?? ''), nascimento: /^\d{4}-\d{2}-\d{2}$/.test(nasc.out.get(String(p.id)) ?? '') ? nasc.out.get(String(p.id)) : null })),
    eleitosSen,
  );
  for (const s of semSenado) if (nasc.falhas.includes(s.id)) s.motivo = 'falha ao consultar a API do Senado';
  nasc.out.clear();
  for (const e of eleitosSen) delete e.nascimento;

  // ---- Bens: só das candidaturas vinculadas ----
  const itensCamara = new Map();
  const bens2022 = await lerBens(zips.bens[2022], new Set([...vincCamara.values(), ...[...vincSenado.values()].filter((c) => c.ano === 2022)].map((c) => c.sq)));
  const bens2018 = await lerBens(zips.bens[2018], new Set([...vincSenado.values()].filter((c) => c.ano === 2018).map((c) => c.sq)));
  for (const [id, c] of vincCamara) itensCamara.set(id, itemParlamentar(c, bens2022.get(c.sq)));
  const itensSenado = new Map();
  for (const [id, c] of vincSenado) itensSenado.set(id, itemParlamentar(c, (c.ano === 2018 ? bens2018 : bens2022).get(c.sq)));

  const camara = montarSaida({
    casa: 'camara', hoje, itens: itensCamara, sem: semCamara, total: camaraIds.length,
    fontes: [...fonteTse(2022, zips, hoje), { titulo: 'Deputados em exercício — API de dados abertos da Câmara dos Deputados', url: 'https://dadosabertos.camara.leg.br/api/v2/deputados', orgao: 'Câmara dos Deputados', acessado_em: hoje }],
    criterio: 'CPF idêntico: o CPF de cada deputado na API oficial da Câmara (/deputados/{id}) é igual ao CPF da candidatura a deputado federal em 2022 no arquivo de candidatos do TSE (eleito ou suplente). O CPF é usado só durante a coleta e não é gravado. Sem correspondência exata, o deputado fica sem vínculo.',
  });
  const senado = montarSaida({
    casa: 'senado', hoje, itens: itensSenado, sem: semSenado, total: senIds.length,
    fontes: [...fonteTse(2018, zips, hoje), ...fonteTse(2022, zips, hoje), { titulo: 'Detalhe do senador — API de dados abertos do Senado Federal', url: 'https://legis.senado.leg.br/dadosabertos/senador/{código}', orgao: 'Senado Federal', acessado_em: hoje }],
    criterio: 'A API do Senado não publica CPF. Vínculo só para senador titular cuja data de nascimento na API oficial do Senado é idêntica à de um único candidato eleito para senador na mesma UF, nos arquivos de candidatos do TSE de 2018 ou 2022. Nome não é usado. A data de nascimento é usada só durante a coleta e não é gravada. Suplentes em exercício e casos sem correspondência única ficam sem vínculo.',
  });
  const mudou = [gravarAtomico(path.join(SAIDA, 'camara.json'), camara), gravarAtomico(path.join(SAIDA, 'senado.json'), senado)].some(Boolean);
  gravarAtomico(path.join(SAIDA, 'meta.json'), {
    atualizado_em: hoje,
    ultima_execucao: new Date().toISOString(),
    resultado: mudou ? 'atualizado' : 'sem mudança no resultado',
    assinatura,
    totais: { camara: camara.totais, senado: senado.totais },
    cpfs_validos_no_tse_2022_deputado_federal: dep.cpfsValidos,
    requisicoes: estat.requisicoes,
  });
  console.log(`[patrimonio] Câmara: ${camara.totais.com_vinculo}/${camaraIds.length} com vínculo; Senado: ${senado.totais.com_vinculo}/${senIds.length} (${Math.round((Date.now() - inicio) / 1000)} s).`);
}

main().catch((e) => { console.error(`[patrimonio] falhou: ${e.message}`); process.exit(1); });
