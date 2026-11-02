/** Tipos do contrato de dados (dados/esquema.json → parlamentar, votacao, meta_coleta). */

export type Casa = "camara" | "senado";

export type TipoVotacaoCongresso = "nominal" | "simbolica" | "secreta";

export interface FonteCongresso {
  titulo?: string | null;
  url: string;
  orgao?: string | null;
  acessado_em?: string | null;
}

export interface PlacarCongresso {
  sim?: number | null;
  nao?: number | null;
  abstencao?: number | null;
  obstrucao?: number | null;
  outros?: number | null;
}

export interface Parlamentar {
  id: string;
  nome: string;
  nome_civil?: string | null;
  partido?: string | null;
  uf?: string | null;
  em_exercicio?: boolean | null;
  foto?: string | null;
  url_oficial?: string | null;
  email?: string | null;
  bloco?: string | null;
  participacao?: string | null;
  /** Gerado no build: está na lista oficial de parlamentares em exercício coletada. */
  na_lista_atual: boolean;
  /** Para quem não está na lista atual: data do registro de votação de onde vêm partido e UF. */
  registro_de?: string | null;
}

export interface ProposicaoCongresso {
  id?: string | null;
  sigla?: string | null;
  numero?: number | null;
  ano?: number | null;
  titulo?: string | null;
  identificacao?: string | null;
  ementa?: string | null;
  url?: string | null;
}

export interface VotoRegistrado {
  parlamentar_id?: string | null;
  nome: string;
  partido?: string | null;
  uf?: string | null;
  voto: string | null;
  voto_codigo?: string | null;
}

export interface Comparecimento {
  parlamentar_id?: string | null;
  nome: string;
  partido?: string | null;
  uf?: string | null;
  registro?: string | null;
  situacao?: string | null;
}

export interface Orientacao {
  bancada: string;
  orientacao: string | null;
}

export interface ConferenciaPlacar {
  texto_oficial?: string | null;
  painel_orientacao?: string | null;
  placares_no_texto?: string[];
}

/** Arquivo de detalhe: dados/<casa>/votacoes/<id>.json */
export interface VotacaoDetalhe {
  id: string;
  casa: Casa;
  data: string | null;
  hora: string | null;
  orgao?: string | null;
  orgao_sigla?: string | null;
  orgao_nome?: string | null;
  sessao?: { numero?: number | null; tipo?: string | null; presidente?: string | null } | null;
  proposicao?: ProposicaoCongresso | null;
  proposicoes?: ProposicaoCongresso[];
  descricao?: string | null;
  descricao_abertura?: string | null;
  materia_votada?: string | null;
  resultado?: string | null;
  tipo: TipoVotacaoCongresso;
  placar?: PlacarCongresso | null;
  placar_origem?: string | null;
  conferencia_placar?: ConferenciaPlacar | string | null;
  orientacoes?: Orientacao[];
  votos?: VotoRegistrado[];
  comparecimento?: Comparecimento[];
  texto_oficial_sessao?: string | null;
  url?: string | null;
  fonte?: FonteCongresso | null;
  fontes?: FonteCongresso[];
  lacunas?: (string | Record<string, unknown>)[];
}

/** Resumo gerado no build (scripts/gerar-congresso.mjs). */
export interface ResumoVotacao {
  id: string;
  data: string | null;
  hora: string | null;
  tipo: TipoVotacaoCongresso | null;
  resultado: string | null;
  orgao: string | null;
  proposicao: { id: string | null; titulo: string | null; sigla: string | null; ementa: string | null } | null;
  descricao: string | null;
  placar: PlacarCongresso | null;
}

export interface IndiceCasa {
  casa: Casa;
  atualizado_em: string | null;
  lista_atualizada_em: string | null;
  lista_fonte: FonteCongresso | null;
  fontes: FonteCongresso[];
  periodo: { inicio?: string; fim?: string } | null;
  observacoes: string[];
  parlamentares: Parlamentar[];
  votacoes: ResumoVotacao[];
  /** id do parlamentar → [índice em votacoes, voto registrado] */
  votos_por_parlamentar: Record<string, [number, string | null][]>;
}
