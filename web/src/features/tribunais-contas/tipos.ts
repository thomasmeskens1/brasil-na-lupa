/**
 * Tipos dos dados dos tribunais de contas (dados/tribunais-contas, copiados para web/content).
 * Só os campos usados pelo site; o formato completo está em dados/esquema.json
 * (tribunal_contas_orgao e julgamento, com natureza, parecer, quorum e julgamento_politico).
 */
export interface FonteTc {
  titulo: string;
  url: string;
  orgao?: string | null;
  acessado_em?: string | null;
  sha256?: string | null;
  observacao?: string | null;
}

export type Lacuna = string | { descricao?: string };

export interface OrgaoTc {
  id: string;
  nome: string;
  esfera: "federal" | "estadual" | "distrital" | "municipal" | string;
  uf: string | null;
  jurisdiciona: string | null;
  site_oficial: string | null;
  fontes: FonteTc[];
  situacao_coleta: "ativa" | "planejada" | string;
  robots_e_restricoes: string | string[] | null;
  conferencia?: string | null;
  lacunas?: Lacuna[];
}

export interface RegistroOrgaos {
  atualizado_em: string | null;
  contagens?: { total: number; ativa: number; planejada: number };
  itens: OrgaoTc[];
}

export interface ItemLiteral {
  numero?: string | null;
  texto: string;
  grupo?: string | null;
}

export interface DocumentoTc {
  titulo: string;
  url: string;
  sha256?: string | null;
  tamanho?: string | null;
  acessado_em?: string | null;
}

/* ---------- TCU ---------- */

export interface ItemColecao {
  id: string;
  numero: string;
  orgao: string;
  data_julgamento: string;
  relator: string;
}

export interface MetaTcu {
  atualizado_em: string | null;
  periodo?: string | null;
  fontes?: FonteTc[];
  contagens?: {
    acordaos?: number;
    por_ano?: Record<string, { total: number; por_colegiado?: Record<string, number>; por_tipo?: Record<string, number>; com_sumario?: number }>;
  };
  colecoes?: Record<string, { titulo: string; itens: ItemColecao[]; ausentes?: unknown[] }>;
}

export interface JulgamentoCongresso {
  casa: "congresso";
  mensagem: string | null;
  ementa: string | null;
  situacao_literal: string | null;
  data_situacao: string | null;
  colegiado_atual: string | null;
  tramitando: string | null;
  recebimento_parecer_tcu: { data: string | null; texto_literal: string | null; documento?: { titulo: string; url: string } | null } | null;
  deliberacao: unknown;
  norma_gerada: unknown;
  url: string | null;
  fonte: FonteTc | null;
  lacunas?: Lacuna[];
}

export interface CuradoriaPresidente {
  exercicio: string;
  acordao_key: string;
  acordao: string;
  processo_no_documento: string | null;
  origem: string | null;
  documento: DocumentoTc | null;
  metodo: string | null;
  conclusao: string | null;
  ressalvas: ItemLiteral[];
  alertas: ItemLiteral[];
  recomendacoes?: ItemLiteral[];
  determinacoes?: ItemLiteral[];
  lacunas?: Lacuna[];
}

export interface ExercicioPresidente {
  exercicio: string;
  acordao: { id: string; numero: string; orgao: string; data_julgamento: string; relator: string; url: string } | null;
  conclusao_parecer: string | null;
  julgamento_politico: JulgamentoCongresso | null;
  lacunas?: Lacuna[];
  curadoria: CuradoriaPresidente | null;
}

export interface AcordaoTcu {
  id: string;
  natureza: "acordao" | "parecer-previo" | string;
  colecoes: string[];
  titulo: string;
  numero: string;
  ata: string | null;
  tipo: string | null;
  processo: { url: string | null } | null;
  orgao: string | null;
  relator: string | null;
  data_julgamento: string | null;
  data_publicacao: string | null;
  situacao: string | null;
  sumario: string | null;
  certidao_literal: string | null;
  documentos: DocumentoTc[];
  fontes: FonteTc[];
  lacunas: Lacuna[];
  parecer?: { contas_de?: string; exercicio?: string; conclusao?: string | null } | null;
  julgamento_politico?: JulgamentoCongresso | null;
}

/* ---------- TCE (contas do Governador e dos Prefeitos) ---------- */

export interface RegistroRelator {
  texto: string;
  documento: string;
  url: string | null;
}

export interface VotacaoAlespLigada {
  votacao_ref: string;
  data: string | null;
  orgao: string | null;
  tipo: string | null;
  descricao: string | null;
  resultado: string | null;
  placar: { sim?: number; nao?: number; abstencao?: number; obstrucao?: number; outros?: number } | null;
  votos_por_tipo?: Record<string, number> | null;
  url: string | null;
}

export interface JulgamentoAlesp {
  casa: "alesp" | string;
  proposicao: { id: string; sigla: string; numero: number; ano: number; ementa: string | null; url: string | null } | null;
  situacao_literal: string | null;
  data_situacao: string | null;
  votacoes: VotacaoAlespLigada[];
  fonte: FonteTc | null;
  lacunas?: Lacuna[];
}

export interface ParecerTce {
  conclusao: string | null;
  com_ressalvas?: boolean | null;
  conclusao_literal?: string | null;
  ressalvas: string[];
  ressalvas_fonte?: { documento: string; url: string; trecho?: string } | null;
  alertas: string[];
  contas_de: string;
  exercicio: string;
  documento?: (DocumentoTc & { texto_legivel?: boolean }) | null;
}

export interface ParecerPrevioTce {
  id: string;
  tribunal: string;
  titulo: string;
  processo: { classe: string | null; numero: string | null; url: string | null } | null;
  orgao: string | null;
  sessao?: string | null;
  sessao_literal?: string | null;
  relator: string | null;
  relator_registros?: RegistroRelator[];
  data_julgamento: string | null;
  data_publicacao?: string | null;
  data_transito_em_julgado?: string | null;
  certidao_literal?: string | null;
  /** "por unanimidade", "por maioria" — trecho literal da decisão, quando a fonte traz. */
  votacao_literal?: string | null;
  parecer: ParecerTce;
  determinacoes_e_recomendacoes?: { documento: string; url: string; itens: ItemLiteral[] } | null;
  votacoes?: { votantes_literal?: string | null; presidente?: string | null }[];
  quorum?: { presentes: string[]; vencidos: string[]; voto_desempate: string | null; declaracoes_de_voto: string[] } | null;
  julgamento_politico: JulgamentoAlesp | null;
  documentos?: DocumentoTc[];
  link_voto_na_fonte?: string | null;
  coletado_em?: string | null;
  fontes: FonteTc[];
  lacunas: Lacuna[];
}

export interface ContasPrefeitos {
  atualizado_em: string | null;
  municipio: { id: string; nome: string; uf: string; codigo_ibge?: string };
  periodo?: { inicio: number; fim: number };
  contagens?: { exercicios: number; com_parecer_em_fonte_aberta: number; sem_fonte_aberta: number };
  fontes: FonteTc[];
  observacoes?: string[];
  itens: ParecerPrevioTce[];
}

export interface MetaTce {
  atualizado_em: string | null;
  fontes?: FonteTc[];
  robots_e_restricoes?: string[];
  observacoes?: string[];
}
