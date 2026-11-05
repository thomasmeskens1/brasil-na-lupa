// Contas do Governador: rota aberta "Prestação de Contas" do Estado na API de dados abertos do TCE-RJ
// (GET /api/v1/prestacao_contas_estado; campos Ente, Ano, Indicador, Processo, Responsavel).
import { API, URL_DOCS, LICENCA, fonte, hojeISO, conclusaoDoIndicador } from './lib.mjs';

export const CAMINHO_ESTADO = '/api/v1/prestacao_contas_estado';
export const URL_ESTADO = `${API}/prestacao_contas_estado`;
const ENTE = 'ESTADO DO RIO DE JANEIRO';
const CAMPOS = ['Ente', 'Ano', 'Indicador', 'Processo', 'Responsavel'];

export const fonteEstado = () => fonte('API de Dados Abertos do TCE-RJ — Prestação de Contas (Estado)', URL_ESTADO, { documentacao: URL_DOCS, licenca: LICENCA });

/** Confere o formato e devolve Map(ano → registro). Erro se a rota mudar de formato. */
export function lerRegistrosEstado(dados) {
  if (!Array.isArray(dados)) throw new Error('prestacao_contas_estado: resposta não é uma lista');
  const porAno = new Map();
  for (const r of dados) {
    for (const c of CAMPOS) if (!(c in r)) throw new Error(`prestacao_contas_estado: campo ausente "${c}"`);
    if (String(r.Ente).trim() !== ENTE) continue;
    const ano = Number(r.Ano);
    if (!Number.isInteger(ano)) throw new Error(`prestacao_contas_estado: ano inválido "${r.Ano}"`);
    if (porAno.has(ano)) throw new Error(`prestacao_contas_estado: exercício ${ano} repetido`);
    porAno.set(ano, r);
  }
  return porAno;
}

export function montarExercicioGovernador(ano, r) {
  const indicador = r ? String(r.Indicador).trim() : null;
  const conclusao = conclusaoDoIndicador(indicador);
  const lacunas = [];
  if (!r) lacunas.push(`Exercício de ${ano} não consta na rota "Prestação de Contas" da API de dados abertos do TCE-RJ até a coleta`);
  else if (!conclusao) lacunas.push(`A API de dados abertos do TCE-RJ registra o indicador "${indicador}" para o exercício de ${ano}; o parecer prévio não consta como emitido`);
  lacunas.push(
    'A API não informa data da sessão, relator, colegiado, votação, ressalvas, determinações nem o link do inteiro teor do parecer',
    'A documentação da API não define o campo "Indicador"; o valor é reproduzido literalmente da rota "Prestação de Contas"',
    'O campo "Responsavel" é reproduzido como consta na API; a fonte não informa se corresponde a quem exerceu o mandato durante todo o exercício',
    `Julgamento das contas de ${ano} pela Assembleia Legislativa do Estado do Rio de Janeiro (Alerj) não coletado`,
  );
  return {
    id: `tce-rj-contas-governador-${ano}`,
    tribunal: 'tce-rj',
    natureza: 'parecer-previo',
    titulo: `Parecer prévio do Tribunal de Contas do Estado do Rio de Janeiro sobre as contas do Governador — exercício ${ano}`,
    processo: { classe: 'Prestação de Contas', numero: r ? String(r.Processo).trim() || null : null, incidente_ou_registro: null, url: null },
    orgao: null,
    sessao: null,
    sessao_literal: null,
    relator: null,
    relator_registros: [],
    data_julgamento: null,
    data_publicacao: null,
    certidao_literal: null,
    parecer: {
      conclusao,
      com_ressalvas: null,
      conclusao_literal: null,
      indicador_na_fonte: indicador,
      ressalvas: [],
      ressalvas_fonte: null,
      alertas: [],
      contas_de: 'Governador do Estado do Rio de Janeiro',
      exercicio: String(ano),
    },
    responsavel_na_fonte: r ? String(r.Responsavel).trim() || null : null,
    determinacoes_e_recomendacoes: null,
    votacoes: [],
    quorum: null,
    julgamento_politico: null,
    documentos: [],
    situacao_conferencia: 'automatico-estruturado',
    coletado_em: hojeISO(),
    fontes: [fonteEstado()],
    lacunas,
  };
}
