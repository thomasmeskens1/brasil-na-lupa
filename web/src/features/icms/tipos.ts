/** Tipos do contrato de dados (dados/esquema.json → decisao). */

export type Caminho = "confaz" | "alesp" | "governador-sp" | "congresso" | "presidencia";

export type CasaVotacao = "camara" | "senado" | "alesp" | "confaz" | "congresso";

export type TipoVotacao = "nominal" | "simbolica" | "unanimidade-registrada" | "sem-votacao";

export interface Fonte {
  titulo: string;
  url: string;
  orgao?: string | null;
  acessado_em?: string | null;
}

export interface Mudanca {
  item: string;
  antes: string | null;
  depois: string | null;
  unidade?: string | null;
  vigencia?: string | null;
}

export interface Responsavel {
  nome: string;
  cargo?: string | null;
  ente?: string | null;
  papel?: string | null;
}

export interface Placar {
  sim?: number | null;
  nao?: number | null;
  abstencao?: number | null;
  obstrucao?: number | null;
  outros?: number | null;
}

export interface VotoIndividual {
  nome: string;
  partido?: string | null;
  voto: string;
}

export interface Votacao {
  casa: CasaVotacao;
  tipo: TipoVotacao;
  data?: string | null;
  descricao?: string | null;
  placar?: Placar | null;
  votacao_ref?: string | null;
  votos_individuais?: VotoIndividual[] | null;
  url?: string | null;
}

export interface Justificativa {
  texto: string | null;
  documento?: string | null;
  url?: string | null;
}

export interface JustificativaContraria {
  texto: string;
  autor?: string | null;
  url?: string | null;
}

export interface Decisao {
  id: string;
  titulo: string;
  resumo?: string | null;
  caminho: Caminho;
  instrumento: string;
  numero?: string | null;
  orgao?: string | null;
  datas: { decisao?: string | null; publicacao?: string | null; vigencia?: string | null };
  mudancas?: Mudanca[];
  responsaveis?: Responsavel[];
  votacoes?: Votacao[];
  justificativa?: Justificativa | null;
  justificativas_contrarias?: JustificativaContraria[];
  relacionados?: string[];
  termos?: string[];
  fontes: Fonte[];
  lacunas?: string[];
}

export interface ArquivoDecisoes {
  atualizado_em: string | null;
  itens: Decisao[];
  /** Verdadeiro quando os dados vêm do exemplo embutido (sem dados/icms/decisoes.json). */
  provisorio?: boolean;
}

export interface TermoGlossario {
  termo: string;
  explicacao: string;
}
