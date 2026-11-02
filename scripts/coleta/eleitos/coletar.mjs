#!/usr/bin/env node
// Coletor de ELEITOS — quem o Tribunal Superior Eleitoral (TSE) registrou como eleito para cada cargo.
// Fonte: Portal de Dados Abertos do TSE (arquivos em cdn.tse.jus.br, ligados a partir de
// dadosabertos.tse.jus.br). Baixa só o necessário (pedidos parciais HTTP Range ao ZIP) e lê em fluxo.
//
// Saídas (somente em dados/eleitos/):
//   municipios.json             códigos TSE e IBGE, nome e UF de cada município
//   <uf>.json                   eleitos 2022 (governador, vice, senadores, deputados) + senadores 2018
//                               (mandato até 2027) + prefeitos, vices e vereadores de 2024 por município
//   eleitos-2026/<uf>.json      eleitos de 2026 (aguardando posse), se o TSE já publicou
//   meta.json                   contagens por cargo, conferência com o número oficial de vagas, lacunas
//
// Uso: node scripts/coleta/eleitos/coletar.mjs [--forcar]
// Privacidade (diretriz 12): as colunas de CPF, data de nascimento, e-mail, título de eleitor, gênero,
// cor/raça, estado civil, instrução, ocupação e bens nunca são lidas nem gravadas.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { cabecalho, listarZip, percorrerCsvRemoto, estatisticas } from './zip-remoto.mjs';
import { gravarSeMudou, lerJson, hojeISO, contagemGravacao } from '../camara/lib.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SAIDA = path.join(RAIZ, 'dados/eleitos');
const CDN = 'https://cdn.tse.jus.br/estatistica/sead/odsele';
const FORCAR = process.argv.includes('--forcar');

const UFS = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
};

// Código do cargo no TSE → nome exibido e ordem neutra (hierarquia do cargo, depois nome).
const CARGOS = {
  3: { nome: 'Governador', ordem: 1 }, 4: { nome: 'Vice-governador', ordem: 2 }, 5: { nome: 'Senador', ordem: 3 },
  6: { nome: 'Deputado federal', ordem: 4 }, 7: { nome: 'Deputado estadual', ordem: 5 },
  8: { nome: 'Deputado distrital', ordem: 5 }, 11: { nome: 'Prefeito', ordem: 1 },
  12: { nome: 'Vice-prefeito', ordem: 2 }, 13: { nome: 'Vereador', ordem: 3 },
};
const CARGOS_GERAIS = new Set([3, 4, 5, 6, 7, 8]);
const CARGOS_MUNICIPAIS = new Set([11, 12, 13]);
// Situação de totalização (CD_SIT_TOT_TURNO) que significa eleito. Suplente, não eleito e 2º turno ficam fora.
const ELEITO = { 1: 'eleito', 2: 'eleito por QP', 3: 'eleito por média' };

const fonteCand = (ano) => `${CDN}/consulta_cand/consulta_cand_${ano}.zip`;
const fonteVagas = (ano) => `${CDN}/consulta_vagas/consulta_vagas_${ano}.zip`;
const FONTE_MUNICIPIOS = `${CDN}/municipio_tse_ibge/municipio_tse_ibge.zip`;
const PAGINA = {
  2018: 'https://dadosabertos.tse.jus.br/dataset/candidatos-2018',
  2022: 'https://dadosabertos.tse.jus.br/dataset/candidatos-2022',
  2024: 'https://dadosabertos.tse.jus.br/dataset/candidatos-2024',
  2026: 'https://dadosabertos.tse.jus.br/dataset/candidatos-2026',
  municipios: 'https://dadosabertos.tse.jus.br/dataset/codigos-oficiais-de-uf-e-municipios-segundo-o-tse-e-o-ibge',
};
const PARLAMENTARES = {
  camara: 'dados/camara/parlamentares.json',
  senado: 'dados/senado/parlamentares.json',
  alesp: 'dados/alesp/parlamentares.json',
};

const upper = (s) => String(s || '').toLocaleUpperCase('pt-BR').replace(/\s+/g, ' ').trim();
const cmp = (a, b) => a.localeCompare(b, 'pt-BR');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- leitura das fontes ----------

async function abrir(url) {
  const cab = await cabecalho(url);
  if (!cab.tamanho) throw new Error(`Tamanho desconhecido: ${url}`);
  return { url, ...cab, entradas: await listarZip(url, cab.tamanho) };
}

function entradaBrasil(zip, prefixo) {
  const e = zip.entradas.find((x) => x.nome === `${prefixo}_BRASIL.csv`);
  if (!e) throw new Error(`Entrada ${prefixo}_BRASIL.csv ausente em ${zip.url}`);
  return e;
}

/** Eleitos de um ano: lista de registros já filtrados (só colunas do exercício da função). */
async function lerEleitos(zip, ano, cargosAceitos, ocorrencias, vagas) {
  const porSq = new Map();
  const e = entradaBrasil(zip, `consulta_cand_${ano}`);
  const linhas = await percorrerCsvRemoto(zip.url, e, (c, ix) => {
    const cargo = Number(c[ix.CD_CARGO]);
    const sit = Number(c[ix.CD_SIT_TOT_TURNO]);
    if (!cargosAceitos.has(cargo) || !ELEITO[sit]) return;
    const tipo = Number(c[ix.CD_TIPO_ELEICAO]);
    const sq = c[ix.SQ_CANDIDATO];
    const [d, m, a] = String(c[ix.DT_ELEICAO]).split('/');
    const reg = {
      ano: Number(c[ix.ANO_ELEICAO]), turno: Number(c[ix.NR_TURNO]), cd_eleicao: c[ix.CD_ELEICAO],
      suplementar: tipo !== 2, ds_eleicao: c[ix.DS_ELEICAO], data_eleicao: a && m && d ? `${a}-${m}-${d}` : null,
      uf: c[ix.SG_UF], ue: c[ix.SG_UE], nome_ue: c[ix.NM_UE], cd_cargo: cargo,
      sq_candidato: sq, numero: c[ix.NR_CANDIDATO], nome_completo: c[ix.NM_CANDIDATO],
      nome_urna: c[ix.NM_URNA_CANDIDATO], partido: c[ix.SG_PARTIDO], situacao: ELEITO[sit],
    };
    if (reg.ano !== ano) return;
    const ant = porSq.get(sq);
    if (ant) { ocorrencias.duplicados = (ocorrencias.duplicados || 0) + 1; if (ant.turno >= reg.turno) return; }
    porSq.set(sq, reg);
  }, (l) => l.includes('ELEITO'));
  ocorrencias.linhas_lidas = linhas;
  // Eleição suplementar (nova eleição para vaga anulada, publicada no mesmo arquivo do ciclo): para
  // cada local e cargo, preenche as vagas oficiais começando pela eleição mais recente. Eleitos de
  // eleições anteriores só ficam enquanto couberem nas vagas (ex.: MT 2018 — um senador da eleição
  // ordinária + um da suplementar de 2020). Um grupo da mesma data que não cabe inteiro é descartado.
  const grupos = new Map();
  for (const r of porSq.values()) {
    const k = `${r.uf}|${r.ue}|${r.cd_cargo}`;
    const g = grupos.get(k) || new Map();
    const d = r.data_eleicao || '';
    g.set(d, [...(g.get(d) || []), r]);
    grupos.set(k, g);
  }
  const saida = [];
  for (const [k, g] of grupos) {
    const datas = [...g.keys()].sort().reverse();
    const temSuplementar = [...g.values()].some((rs) => rs.some((r) => r.suplementar));
    if (!temSuplementar) { for (const rs of g.values()) saida.push(...rs); continue; }
    let livres = vagas.get(k) ?? Infinity;
    for (const d of datas) {
      const rs = g.get(d);
      if (rs.length <= livres) { saida.push(...rs); livres -= rs.length; }
      else if (livres === 0) {
        // A eleição mais recente já preencheu todas as vagas: os eleitos anteriores foram substituídos.
        ocorrencias.substituidos_por_eleicao_suplementar = (ocorrencias.substituidos_por_eleicao_suplementar || 0) + rs.length;
      } else {
        // Substituição parcial: o arquivo não diz qual eleito anterior perdeu a vaga. Mantém todos e avisa.
        saida.push(...rs); livres = 0;
        (ocorrencias.substituicao_parcial ??= []).push({ chave: k, data_eleicao_anterior: d });
      }
    }
  }
  ocorrencias.eleitos_em_eleicao_suplementar = saida.filter((r) => r.suplementar).length;
  for (const r of saida) {
    if (ocorrencias.substituicao_parcial?.some((x) => x.chave === `${r.uf}|${r.ue}|${r.cd_cargo}`)) r.substituicao_parcial = true;
  }
  return saida;
}

/** Vagas oficiais: Map "uf|ue|cargo" → quantidade (só eleição ordinária); data de posse em `posses`. */
const posses = new Map();
async function lerVagas(zip, ano) {
  const vagas = new Map();
  const e = entradaBrasil(zip, `consulta_vagas_${ano}`);
  await percorrerCsvRemoto(zip.url, e, (c, ix) => {
    if (Number(c[ix.CD_TIPO_ELEICAO]) !== 2) return;
    const k = `${c[ix.SG_UF]}|${c[ix.SG_UE]}|${Number(c[ix.CD_CARGO])}`;
    vagas.set(k, (vagas.get(k) || 0) + Number(c[ix.QT_VAGA]));
    const [d, m, a] = String(c[ix.DT_POSSE] || '').split('/');
    if (a && m && d) posses.set(k, `${a}-${m}-${d}`);
  });
  return vagas;
}

async function lerMunicipios(zip) {
  const e = zip.entradas.find((x) => x.nome.endsWith('.csv'));
  const itens = [];
  await percorrerCsvRemoto(zip.url, e, (c, ix) => {
    const uf = c[ix.SG_UF];
    if (!UFS[uf]) return;
    // Nome: o do IBGE (grafia oficial com preposições em minúsculas); o do TSE só quando difere.
    const it = {
      codigo_tse: c[ix.CD_MUNICIPIO_TSE], codigo_ibge: c[ix.CD_MUNICIPIO_IBGE] || null,
      nome: c[ix.NM_MUNICIPIO_IBGE] || c[ix.NM_MUNICIPIO_TSE], uf,
    };
    if (c[ix.NM_MUNICIPIO_TSE] && c[ix.NM_MUNICIPIO_TSE] !== it.nome) it.nome_tse = c[ix.NM_MUNICIPIO_TSE];
    itens.push(it);
  });
  itens.sort((a, b) => cmp(a.uf, b.uf) || cmp(a.nome, b.nome) || cmp(a.codigo_tse, b.codigo_tse));
  return itens;
}

// ---------- vínculo com os parlamentares já coletados ----------

function carregarParlamentares() {
  const casas = {};
  for (const [casa, rel] of Object.entries(PARLAMENTARES)) {
    const j = lerJson(path.join(RAIZ, rel));
    const porChave = new Map();
    for (const p of j?.itens || []) {
      const k = `${p.uf}|${upper(p.nome)}`;
      porChave.set(k, [...(porChave.get(k) || []), p]);
    }
    casas[casa] = { porChave, total: j?.itens?.length || 0, atualizado_em: j?.atualizado_em || null };
  }
  return casas;
}

function casaDoCargo(r) {
  if (r.cd_cargo === 6) return 'camara';
  if (r.cd_cargo === 5) return 'senado';
  if (r.cd_cargo === 7 && r.uf === 'SP') return 'alesp';
  return null;
}

/**
 * Vínculo só por correspondência EXATA (nome de urna = nome parlamentar, sem diferença de letras ou
 * acentos, ignorando maiúsculas/minúsculas) + mesma UF, e ÚNICA nos dois sentidos. Senão, null.
 */
function vincular(registros, casas, cont) {
  const chaves = new Map();
  for (const r of registros) {
    const casa = casaDoCargo(r);
    if (!casa) continue;
    const k = `${casa}|${r.uf}|${upper(r.nome_urna)}`;
    chaves.set(k, (chaves.get(k) || 0) + 1);
  }
  for (const r of registros) {
    const casa = casaDoCargo(r);
    r.parlamentar_casa = null; r.parlamentar_id = null; r.vinculo_confianca = null;
    if (!casa) continue;
    cont[casa] ??= { exata: 0, sem_vinculo: 0 };
    const cand = casas[casa].porChave.get(`${r.uf}|${upper(r.nome_urna)}`) || [];
    if (cand.length === 1 && chaves.get(`${casa}|${r.uf}|${upper(r.nome_urna)}`) === 1) {
      r.parlamentar_casa = casa; r.parlamentar_id = String(cand[0].id); r.vinculo_confianca = 'exata';
      cont[casa].exata++;
    } else cont[casa].sem_vinculo++;
  }
}

// ---------- montagem das saídas ----------

/** Nome completo só quando dois eleitos do mesmo grupo (ano, cargo, local) têm o mesmo nome de urna. */
function desambiguar(registros) {
  const n = new Map();
  for (const r of registros) { const k = `${r.ano}|${r.cd_cargo}|${r.ue}|${upper(r.nome_urna)}`; n.set(k, (n.get(k) || 0) + 1); }
  let usados = 0;
  for (const r of registros) {
    r.precisa_nome_completo = n.get(`${r.ano}|${r.cd_cargo}|${r.ue}|${upper(r.nome_urna)}`) > 1;
    if (r.precisa_nome_completo) usados++;
  }
  return usados;
}

const ordenar = (a, b) => CARGOS[a.cd_cargo].ordem - CARGOS[b.cd_cargo].ordem
  || cmp(upper(a.nome_urna), upper(b.nome_urna)) || a.ano - b.ano || cmp(a.sq_candidato, b.sq_candidato);

function itemGeral(r) {
  const it = { cargo: CARGOS[r.cd_cargo].nome, nome_urna: r.nome_urna };
  if (r.precisa_nome_completo) it.nome_completo = r.nome_completo;
  Object.assign(it, {
    partido: r.partido, numero: Number(r.numero), uf: r.uf, situacao: r.situacao, ano: r.ano, turno: r.turno,
    sq_candidato: r.sq_candidato, parlamentar_casa: r.parlamentar_casa, parlamentar_id: r.parlamentar_id,
    vinculo_confianca: r.vinculo_confianca,
  });
  return suplementar(it, r);
}

/** Só quando o eleito vem de eleição suplementar: nome oficial e data dessa eleição. */
function suplementar(it, r) {
  if (r.suplementar) { it.eleicao_suplementar = r.ds_eleicao; it.data_eleicao = r.data_eleicao; }
  return it;
}

function itemMunicipal(r) {
  const it = { cargo: CARGOS[r.cd_cargo].nome, nome_urna: r.nome_urna };
  if (r.precisa_nome_completo) it.nome_completo = r.nome_completo;
  return Object.assign(it, {
    partido: r.partido, numero: Number(r.numero), situacao: r.situacao, turno: r.turno, sq_candidato: r.sq_candidato,
  }) && suplementar(it, r);
}

/** Aviso quando uma eleição suplementar preencheu só parte das vagas de um cargo. */
function lacunasDoGrupo(rs) {
  const cargos = [...new Set(rs.filter((r) => r.substituicao_parcial).map((r) => CARGOS[r.cd_cargo].nome))];
  if (!cargos.length) return {};
  return { lacunas: cargos.map((c) => `${c}: uma eleição suplementar preencheu parte das vagas, mas o arquivo do TSE `
    + 'continua listando como eleitos todos os vencedores da eleição anterior e não informa qual deles perdeu a vaga. '
    + 'Por isso aparecem mais eleitos do que vagas; consulte a Justiça Eleitoral para saber quem ocupa cada vaga.') };
}

function fonte(titulo, url, hoje) {
  return { titulo, url, orgao: 'Tribunal Superior Eleitoral (TSE)', acessado_em: hoje };
}

const AVISO = 'Lista de quem o Tribunal Superior Eleitoral registrou como eleito no resultado da eleição. '
  + 'Não é a lista de quem ocupa o cargo hoje: cassações, renúncias, mortes, licenças e posses de suplentes '
  + 'não aparecem aqui. Eleições suplementares publicadas pelo TSE no arquivo do ciclo são consideradas.';

const LACUNA_POSSE = 'A data de posse (data_posse) é reproduzida exatamente como está no arquivo de vagas do TSE. '
  + 'Para senadores e deputados eleitos em 2026 o arquivo informa datas em abril e maio de 2027 (ex.: 02/05/2027), '
  + 'que devem ser conferidas com o calendário oficial de posse de cada casa legislativa; nenhuma correção manual foi feita.';

const LACUNA_DIVULGACAND = 'Página do candidato no DivulgaCandContas (sistema de divulgação de candidaturas do TSE): '
  + 'o endereço de cada página usa um código interno de eleição que não consta dos dados abertos, e o sistema '
  + 'bloqueia acesso automatizado; por isso o link individual não é gerado. O código do candidato no TSE '
  + '(sq_candidato) permite a consulta em https://divulgacandcontas.tse.jus.br/divulga/#/home.';

/** Conferência eleitos × vagas oficiais: { por_cargo, diferencas }. */
function conferir(registros, vagas, cargos, rotuloLocal) {
  const eleitos = new Map();
  for (const r of registros) { const k = `${r.uf}|${r.ue}|${r.cd_cargo}`; eleitos.set(k, (eleitos.get(k) || 0) + 1); }
  const porCargo = {}, diferencas = [];
  const chaves = new Set([...vagas.keys(), ...eleitos.keys()]);
  for (const k of [...chaves].sort(cmp)) {
    const [uf, ue, cargoS] = k.split('|');
    const cargo = Number(cargoS);
    if (!cargos.has(cargo)) continue;
    const nome = CARGOS[cargo].nome;
    porCargo[nome] ??= { vagas_oficiais: 0, eleitos_no_arquivo: 0, diferenca: 0 };
    const v = vagas.get(k) || 0, e = eleitos.get(k) || 0;
    porCargo[nome].vagas_oficiais += v; porCargo[nome].eleitos_no_arquivo += e;
    if (v !== e) diferencas.push({ uf, local: rotuloLocal(uf, ue), cargo: nome, vagas_oficiais: v, eleitos_no_arquivo: e });
  }
  for (const c of Object.values(porCargo)) c.diferenca = c.eleitos_no_arquivo - c.vagas_oficiais;
  return { por_cargo: porCargo, diferencas };
}

function contarPorCargo(registros) {
  const out = {};
  for (const r of [...registros].sort(ordenar)) {
    const k = CARGOS[r.cd_cargo].nome;
    out[k] ??= { total: 0, eleito: 0, 'eleito por QP': 0, 'eleito por média': 0 };
    out[k].total++; out[k][r.situacao]++;
  }
  return out;
}

// ---------- execução ----------

async function main() {
  const inicio = new Date();
  const hoje = hojeISO();
  const metaAnterior = lerJson(path.join(SAIDA, 'meta.json'));

  const urls = {
    cand_2018: fonteCand(2018), cand_2022: fonteCand(2022), cand_2024: fonteCand(2024), cand_2026: fonteCand(2026),
    vagas_2018: fonteVagas(2018), vagas_2022: fonteVagas(2022), vagas_2024: fonteVagas(2024), vagas_2026: fonteVagas(2026),
    municipios: FONTE_MUNICIPIOS,
  };
  // 2026: o arquivo pode ainda não existir (404) — nesse caso a pasta eleitos-2026 não é gerada.
  const versoes = {};
  for (const [k, u] of Object.entries(urls)) {
    try { versoes[k] = await cabecalho(u); } catch (e) {
      if (k.endsWith('2026') && /HTTP 404/.test(e.message)) { versoes[k] = null; continue; }
      throw e;
    }
  }
  const assinaturaParl = sha(Object.values(PARLAMENTARES).map((r) => {
    try { return fs.readFileSync(path.join(RAIZ, r), 'utf8'); } catch { return ''; }
  }).join('\n'));
  const assinatura = sha(JSON.stringify({ versoes, assinaturaParl, v: 8 }));
  if (!FORCAR && metaAnterior?.assinatura_entradas === assinatura) {
    console.log('Fontes do TSE e listas de parlamentares sem mudança desde a última execução; nada a fazer.');
    return;
  }

  const zips = {};
  for (const k of Object.keys(urls)) if (versoes[k]) zips[k] = await abrir(urls[k]);

  console.log('Lendo códigos de municípios…');
  const municipios = await lerMunicipios(zips.municipios);
  const munPorCodigo = new Map(municipios.map((m) => [m.codigo_tse, m]));
  const rotulo = (uf, ue) => (ue === uf ? UFS[uf] || uf : munPorCodigo.get(ue)?.nome || ue);

  const ocorr = {};
  console.log('Lendo vagas oficiais…');
  const vagas = {};
  for (const ano of [2018, 2022, 2024, 2026]) if (zips[`vagas_${ano}`]) vagas[ano] = await lerVagas(zips[`vagas_${ano}`], ano);

  console.log('Lendo eleitos de 2018 (senadores com mandato até 2027)…');
  const e2018 = await lerEleitos(zips.cand_2018, 2018, new Set([5]), (ocorr[2018] = {}), vagas[2018] || new Map());
  console.log('Lendo eleitos de 2022…');
  const e2022 = await lerEleitos(zips.cand_2022, 2022, CARGOS_GERAIS, (ocorr[2022] = {}), vagas[2022] || new Map());
  console.log('Lendo eleitos de 2024 (municipais)…');
  const e2024 = await lerEleitos(zips.cand_2024, 2024, CARGOS_MUNICIPAIS, (ocorr[2024] = {}), vagas[2024] || new Map());
  let e2026 = null;
  if (zips.cand_2026) {
    console.log('Lendo eleitos de 2026…');
    e2026 = await lerEleitos(zips.cand_2026, 2026, CARGOS_GERAIS, (ocorr[2026] = {}), vagas[2026] || new Map());
  }
  const casas = carregarParlamentares();
  const atuais = [...e2018, ...e2022];
  const vinculos = { mandato_atual: {}, eleitos_2026: {} };
  vincular(atuais, casas, vinculos.mandato_atual);
  if (e2026) vincular(e2026, casas, vinculos.eleitos_2026);
  const nomesCompletos = desambiguar(atuais) + desambiguar(e2024) + (e2026 ? desambiguar(e2026) : 0);

  // Fontes por arquivo
  const fGeral = [
    fonte('Candidatos 2022 — Portal de Dados Abertos do TSE (situação de totalização)', PAGINA[2022], hoje),
    fonte('Candidatos 2018 — Portal de Dados Abertos do TSE (senadores eleitos em 2018)', PAGINA[2018], hoje),
  ];
  const fMun = fonte('Candidatos 2024 — Portal de Dados Abertos do TSE (situação de totalização)', PAGINA[2024], hoje);
  const fCod = fonte('Códigos oficiais de UF e municípios segundo o TSE e o IBGE', PAGINA.municipios, hoje);

  const tamanhos = {};
  const gravar = (rel, obj) => {
    const arq = path.join(SAIDA, rel);
    gravarSeMudou(arq, obj);
    tamanhos[rel] = fs.statSync(arq).size;
  };

  gravar('municipios.json', { atualizado_em: hoje, fonte: fCod, total: municipios.length, itens: municipios });

  const porUf = (lista) => {
    const m = new Map(Object.keys(UFS).map((uf) => [uf, []]));
    for (const r of lista) m.get(r.uf)?.push(r);
    return m;
  };
  const atuaisUf = porUf(atuais), munUf = porUf(e2024);
  for (const uf of Object.keys(UFS)) {
    const grupos = new Map();
    for (const r of munUf.get(uf)) grupos.set(r.ue, [...(grupos.get(r.ue) || []), r]);
    const mun = [...grupos.entries()].map(([ue, rs]) => ({
      codigo_tse: ue, codigo_ibge: munPorCodigo.get(ue)?.codigo_ibge ?? null,
      nome: munPorCodigo.get(ue)?.nome || rs[0].nome_ue, ano: 2024,
      itens: rs.sort(ordenar).map(itemMunicipal),
      ...lacunasDoGrupo(rs),
    })).sort((a, b) => cmp(a.nome, b.nome));
    const lacunas = [LACUNA_DIVULGACAND, ...(lacunasDoGrupo(atuaisUf.get(uf)).lacunas || [])];
    if (uf === 'DF') lacunas.push('O Distrito Federal não tem municípios nem eleição municipal: não há prefeitos nem vereadores.');
    gravar(`${uf.toLowerCase()}.json`, {
      atualizado_em: hoje, uf, nome_uf: UFS[uf], aviso: AVISO,
      fontes: [...fGeral, fMun, fCod],
      estaduais_federais: { itens: atuaisUf.get(uf).sort(ordenar).map(itemGeral) },
      municipios: mun,
      lacunas,
    });
  }
  if (e2026) {
    const u26 = porUf(e2026);
    const f26 = fonte('Candidatos 2026 — Portal de Dados Abertos do TSE (situação de totalização)', PAGINA[2026], hoje);
    for (const uf of Object.keys(UFS)) {
      gravar(`eleitos-2026/${uf.toLowerCase()}.json`, {
        atualizado_em: hoje, uf, nome_uf: UFS[uf], status: 'aguardando posse',
        aviso: 'Eleitos em 2026 segundo o resultado registrado pelo Tribunal Superior Eleitoral, aguardando posse '
          + '(data da posse de cada cargo conforme o arquivo de vagas do TSE). '
          + 'A diplomação e decisões da Justiça Eleitoral ainda podem alterar a lista.',
        fontes: [f26, fonte('Vagas por cargo 2026 (com data de posse) — Portal de Dados Abertos do TSE', PAGINA[2026], hoje)],
        itens: u26.get(uf).sort(ordenar).map((r) => ({
          ...itemGeral(r), status: 'aguardando posse', data_posse: posses.get(`${r.uf}|${r.ue}|${r.cd_cargo}`) ?? null,
        })),
        lacunas: [LACUNA_DIVULGACAND, LACUNA_POSSE],
      });
    }
  }
  // Datas de posse de 2026 por cargo, como o arquivo de vagas do TSE informa (para conferência humana).
  const posses2026 = {};
  for (const [k, d] of posses) {
    const [, , cargo] = k.split('|');
    if (!e2026 || !CARGOS_GERAIS.has(Number(cargo)) || !d.startsWith('2027')) continue;
    const nome = CARGOS[cargo].nome;
    posses2026[nome] = [...new Set([...(posses2026[nome] || []), d])].sort();
  }

  // Conferência com as vagas oficiais (arquivo "consulta_vagas" do TSE)
  const conf = {
    '2018 (senadores)': conferir(e2018, vagas[2018], new Set([5]), rotulo),
    2022: conferir(e2022, vagas[2022], CARGOS_GERAIS, rotulo),
    2024: conferir(e2024, vagas[2024], CARGOS_MUNICIPAIS, rotulo),
  };
  if (e2026) conf[2026] = conferir(e2026, vagas[2026], CARGOS_GERAIS, rotulo);
  const senTot = (conf['2018 (senadores)'].por_cargo.Senador?.eleitos_no_arquivo || 0)
    + (conf[2022].por_cargo.Senador?.eleitos_no_arquivo || 0);
  const de = conf[2022].por_cargo;
  const cadeiras = {
    'Deputado federal': { oficial: 513, eleitos_no_arquivo: de['Deputado federal']?.eleitos_no_arquivo || 0 },
    Senador: { oficial: 81, eleitos_no_arquivo: senTot, observacao: 'Soma dos eleitos de 2018 (54 vagas) e de 2022 (27 vagas).' },
    Governador: { oficial: 27, eleitos_no_arquivo: de.Governador?.eleitos_no_arquivo || 0 },
    'Vice-governador': { oficial: 27, eleitos_no_arquivo: de['Vice-governador']?.eleitos_no_arquivo || 0 },
    'Deputado estadual e distrital': {
      oficial: 1059,
      eleitos_no_arquivo: (de['Deputado estadual']?.eleitos_no_arquivo || 0) + (de['Deputado distrital']?.eleitos_no_arquivo || 0),
    },
  };
  for (const c of Object.values(cadeiras)) c.diferenca = c.eleitos_no_arquivo - c.oficial;

  const fontesMeta = Object.entries(urls).map(([k, u]) => ({
    chave: k, url: u, tamanho_bytes: versoes[k]?.tamanho ?? null, etag: versoes[k]?.etag ?? null,
    last_modified: versoes[k]?.last_modified ?? null, publicado: !!versoes[k],
  }));
  const meta = {
    atualizado_em: hoje,
    ultima_execucao: inicio.toISOString(),
    duracao_s: Math.round((Date.now() - inicio) / 1000),
    assinatura_entradas: assinatura,
    aviso: AVISO,
    contagens: {
      municipios: municipios.length,
      municipios_com_eleitos_2024: new Set(e2024.map((r) => r.ue)).size,
      eleitos_2018_senadores: contarPorCargo(e2018),
      eleitos_2022: contarPorCargo(e2022),
      eleitos_2024: contarPorCargo(e2024),
      eleitos_2026: e2026 ? contarPorCargo(e2026) : null,
      nomes_completos_para_desambiguar: nomesCompletos,
      vinculos_parlamentares: vinculos,
      parlamentares_consultados: Object.fromEntries(Object.entries(casas).map(([k, v]) => [k, { arquivo: PARLAMENTARES[k], total: v.total, atualizado_em: v.atualizado_em }])),
      registros_ignorados: ocorr,
    },
    datas_posse_2026_no_arquivo_tse: e2026 ? posses2026 : null,
    conferencia_cadeiras: cadeiras,
    conferencia_vagas: conf,
    tamanhos_bytes: tamanhos,
    trafego: { requisicoes: estatisticas.requisicoes, bytes_baixados: estatisticas.bytes_baixados, retentativas: estatisticas.retentativas },
    fontes: [
      fonte('Candidatos 2018, 2022, 2024 e 2026 e vagas por cargo — Portal de Dados Abertos do TSE', 'https://dadosabertos.tse.jus.br/dataset/?groups=candidatos', hoje),
      fCod,
    ],
    arquivos_fonte: fontesMeta,
    glossario: {
      'eleito por QP': 'Eleito por quociente partidário: vaga obtida porque o partido ou federação atingiu votos suficientes para ela, e o candidato foi um dos mais votados da legenda.',
      'eleito por média': 'Eleito na distribuição das sobras: vagas que restam depois do quociente partidário, distribuídas pelas maiores médias de votos.',
      sq_candidato: 'Código sequencial que o TSE dá a cada candidatura.',
    },
    lacunas: [
      AVISO,
      'Os arquivos do TSE registram o resultado da eleição (quem foi ELEITO), não quem está no cargo hoje: cassações de mandato, renúncias, mortes, afastamentos, posse de suplentes e mudanças de partido depois da eleição não aparecem. Para saber quem está em exercício, use as listas das casas legislativas (dados/camara, dados/senado, dados/alesp).',
      'O partido é o da candidatura na eleição; pode ser diferente do partido atual.',
      'Eleições suplementares (novas eleições depois de cassações ou indeferimentos) que o TSE publica no mesmo arquivo do ciclo eleitoral foram consideradas: para cada local e cargo vale a eleição mais recente com eleitos, e o item traz o nome e a data da eleição suplementar. Locais onde a vaga ainda não foi preenchida por eleição suplementar aparecem nas diferenças da conferência.',
      'Municípios sem eleito para um cargo (listados em conferencia_vagas, com 0 eleitos) são locais em que o TSE não registra vencedor válido na eleição de 2024 e ainda não publicou eleição suplementar com eleitos; neles a informação não está disponível em fonte oficial nestes arquivos.',
      'Votos anulados ou candidaturas sub judice: candidatos com situação de totalização vazia ("#NULO") não são contados como eleitos, o que explica parte das diferenças entre eleitos e vagas oficiais.',
      'Presidente e vice-presidente da República não estão incluídos (fora do escopo pedido para esta seção).',
      'Suplentes de senador e suplentes de deputado e vereador não estão incluídos.',
      LACUNA_DIVULGACAND,
      LACUNA_POSSE,
      'Vínculo com dados/camara, dados/senado e dados/alesp: só por nome de urna idêntico ao nome parlamentar (ignorando maiúsculas e minúsculas) na mesma UF, e quando a correspondência é única; nos demais casos o vínculo fica vazio (null), sem tentativa de adivinhar. Eleitos que não estão em exercício hoje (licenciados, ministros, cassados) não têm vínculo porque as listas das casas são de quem está em exercício.',
      'Nome completo só aparece quando dois eleitos do mesmo cargo e local têm o mesmo nome de urna.',
      'Dados pessoais não ligados ao exercício da função (CPF, data de nascimento, e-mail, título de eleitor, gênero, cor ou raça, estado civil, instrução, ocupação, bens) não são lidos nem gravados.',
    ],
  };
  gravar('meta.json', meta);
  // Tamanho do próprio meta.json só fica certo na próxima execução; registra agora a contagem final.
  console.log(JSON.stringify({ contagens: meta.contagens, cadeiras, gravacao: contagemGravacao, trafego: meta.trafego }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
