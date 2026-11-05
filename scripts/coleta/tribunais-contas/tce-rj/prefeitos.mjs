// Contas dos Prefeitos: rota aberta "Prestação de Contas" dos Municípios na API de dados abertos do TCE-RJ
// (GET /api/v1/prestacao_contas_municipio; campos Municipio, Regiao, Ano, Indicador, Processo, Responsavel).
// A capital não está na rota: o Município do Rio de Janeiro é fiscalizado pelo TCM-RJ.
//
// Identificação do município: nome da API comparado de forma EXATA (sem acento, maiúsculas) com a lista de
// entes do Siconfi já gravada em dados/municipios/entes.json (código IBGE, nome oficial e id). Três nomes da
// API são grafados de outro modo; a equivalência abaixo foi conferida à mão (cada um é o único município
// fluminense restante, fora a capital) e está escrita explicitamente, sem comparação por semelhança.
import fs from 'node:fs';
import path from 'node:path';
import { API, URL_DOCS, LICENCA, RAIZ, fonte, normalizar, kebab, conclusaoDoIndicador } from './lib.mjs';

export const CAMINHO_MUNICIPIOS = '/api/v1/prestacao_contas_municipio';
export const URL_MUNICIPIOS = `${API}/prestacao_contas_municipio`;
const CAMPOS = ['Municipio', 'Regiao', 'Ano', 'Indicador', 'Processo', 'Responsavel'];

/** Nome na API (normalizado) → nome no Siconfi (normalizado). Conferido em 05/11/2026. */
export const GRAFIAS_DA_FONTE = {
  'ARMACAO DE BUZIOS': 'ARMACAO DOS BUZIOS',
  'SAO FRANCISCO DO ITABAPOANA': 'SAO FRANCISCO DE ITABAPOANA',
  'TRAJANO DE MORAIS': 'TRAJANO DE MORAES',
};

export const ARQ_ENTES = path.join(RAIZ, 'dados', 'municipios', 'entes.json');

/** Mapa normalizado → { codigo_ibge, nome, id } dos municípios do RJ no Siconfi. */
export function carregarEntesRj(entes = JSON.parse(fs.readFileSync(ARQ_ENTES, 'utf8'))) {
  const campos = entes.campos;
  const i = (c) => campos.indexOf(c);
  const m = new Map();
  for (const linha of entes.itens) {
    if (linha[i('uf')] !== 'rj') continue;
    m.set(normalizar(linha[i('nome')]), { codigo_ibge: String(linha[i('cod_ibge')]), nome: linha[i('nome')], id: linha[i('slug')] });
  }
  return m;
}

export function identificarMunicipio(nomeFonte, entesRj) {
  const n = normalizar(nomeFonte);
  const e = entesRj.get(GRAFIAS_DA_FONTE[n] ?? n);
  if (e) return { ...e, nome_na_fonte: nomeFonte, identificacao: GRAFIAS_DA_FONTE[n] ? 'grafia-conferida' : 'nome-exato' };
  return { id: kebab(nomeFonte), nome: nomeFonte, codigo_ibge: null, nome_na_fonte: nomeFonte, identificacao: 'sem-correspondencia' };
}

export const fonteMunicipios = () => fonte('API de Dados Abertos do TCE-RJ — Prestação de Contas (Municípios)', URL_MUNICIPIOS, { documentacao: URL_DOCS, licenca: LICENCA });

/** Confere o formato e agrupa por município: Map(nome literal → Map(ano → registro)). */
export function agruparMunicipios(dados) {
  if (!Array.isArray(dados)) throw new Error('prestacao_contas_municipio: resposta não é uma lista');
  const porMun = new Map();
  for (const r of dados) {
    for (const c of CAMPOS) if (!(c in r)) throw new Error(`prestacao_contas_municipio: campo ausente "${c}"`);
    const nome = String(r.Municipio).trim();
    const ano = Number(r.Ano);
    if (!nome || !Number.isInteger(ano)) throw new Error(`prestacao_contas_municipio: registro inválido ${JSON.stringify(r)}`);
    if (!porMun.has(nome)) porMun.set(nome, new Map());
    const anos = porMun.get(nome);
    if (anos.has(ano)) throw new Error(`prestacao_contas_municipio: ${nome} ${ano} repetido`);
    anos.set(ano, r);
  }
  return porMun;
}

function montarItem(mun, ano, r) {
  const indicador = r ? String(r.Indicador).trim() : null;
  const conclusao = conclusaoDoIndicador(indicador);
  const lacunas = [];
  if (!r) lacunas.push(`Exercício de ${ano} não consta na rota "Prestação de Contas" da API de dados abertos do TCE-RJ até a coleta`);
  else if (!conclusao) lacunas.push(`A API de dados abertos do TCE-RJ registra o indicador "${indicador}" para o exercício de ${ano}; o parecer prévio não consta como emitido`);
  lacunas.push(
    'A API não informa data da sessão, relator, ressalvas, determinações nem o link do inteiro teor do parecer',
    'A documentação da API não define o campo "Indicador"; o valor é reproduzido literalmente da rota "Prestação de Contas"',
    `Julgamento das contas pela Câmara Municipal de ${mun.nome} não coletado`,
  );
  return {
    id: `tce-rj-contas-prefeito-${mun.id}-${ano}`,
    tribunal: 'tce-rj',
    natureza: 'parecer-previo',
    titulo: `Parecer prévio do Tribunal de Contas do Estado do Rio de Janeiro sobre as contas do Prefeito de ${mun.nome} — exercício ${ano}`,
    processo: { classe: 'Prestação de Contas', numero: r ? String(r.Processo).trim() || null : null, incidente_ou_registro: null, url: null },
    orgao: null,
    relator: null,
    data_julgamento: null,
    data_transito_em_julgado: null,
    parecer: {
      conclusao,
      com_ressalvas: null,
      indicador_na_fonte: indicador,
      ressalvas: [],
      alertas: [],
      contas_de: `Prefeito de ${mun.nome}`,
      exercicio: String(ano),
    },
    responsavel_na_fonte: r ? String(r.Responsavel).trim() || null : null,
    link_voto_na_fonte: null,
    julgamento_politico: null,
    situacao_conferencia: 'automatico-estruturado',
    fontes: [fonteMunicipios()],
    lacunas,
  };
}

/** Arquivo de um município ({ arquivo, identificacao }): um item por exercício, do primeiro ano da rota até o último exercício encerrado. */
export function montarMunicipio(nomeFonte, anos, entesRj, { inicio, fim }) {
  const mun = identificarMunicipio(nomeFonte, entesRj);
  const regiao = [...anos.values()].map((r) => String(r.Regiao).trim()).find(Boolean) ?? null;
  const itens = [];
  for (let ano = inicio; ano <= fim; ano++) itens.push(montarItem(mun, ano, anos.get(ano)));
  const observacoes = [
    'Dados da API de dados abertos do TCE-RJ, "conforme cadastrados", segundo a própria documentação; a rota não traz relator, data nem inteiro teor.',
  ];
  if (mun.identificacao === 'grafia-conferida') observacoes.push(`A API grafa o município como "${nomeFonte}"; o nome e o código IBGE exibidos são os do cadastro de entes do Siconfi (Tesouro Nacional).`);
  if (mun.identificacao === 'sem-correspondencia') observacoes.push(`Nome "${nomeFonte}" sem correspondência exata no cadastro de entes do Siconfi; código IBGE não informado.`);
  const arquivo = {
    atualizado_em: new Date().toISOString(),
    municipio: { id: mun.id, nome: mun.nome, uf: 'RJ', codigo_ibge: mun.codigo_ibge, nome_na_fonte: nomeFonte, regiao_na_fonte: regiao },
    tribunal: 'tce-rj',
    periodo: { inicio, fim },
    contagens: {
      exercicios: itens.length,
      com_parecer_em_fonte_aberta: itens.filter((i) => i.parecer.conclusao).length,
      sem_fonte_aberta: itens.filter((i) => !i.parecer.conclusao).length,
    },
    fontes: [fonteMunicipios()],
    observacoes,
    itens,
  };
  return { arquivo, identificacao: mun.identificacao };
}
