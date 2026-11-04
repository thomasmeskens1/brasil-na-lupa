/** Tipos dos dados do STJ e do STF (dados/esquema.json → julgamento, ministro). */
import type { FonteCongresso } from "@/features/congresso/tipos";

export type Fonte = FonteCongresso;

export interface ResumoTemaStj {
  numero: string;
  id: string;
  tipo_precedente: string | null;
  situacao: string | null;
  orgao: string | null;
  relator: string[];
  datas: { afetacao?: string | null; julgamento?: string | null; publicacao?: string | null; transito_em_julgado?: string | null };
  colecoes: string[];
  tem_tese: boolean;
  sessoes: number;
  em_pauta: boolean;
  url_oficial: string | null;
}

/** content/_gerado/justica-stj.json */
export interface IndiceStj {
  atualizado_em: string | null;
  fonte: Fonte | null;
  fontes: Fonte[];
  divergencias: Record<string, string[]>;
  total: number;
  colecoes: Record<string, string[]>;
  com_pagina: string[];
  itens: ResumoTemaStj[];
  situacoes: string[];
  orgaos: string[];
  tipos: string[];
  /** Contagens do índice inteiro (scripts/gerar-executivo-justica.mjs). */
  contagens?: { por_situacao: Record<string, number>; por_tipo: Record<string, number>; com_tese: number };
}

export interface ProcessoStj {
  processo: string;
  relator?: string | null;
  paradigma?: boolean | null;
  tribunal_origem?: string | null;
  tribunal_origem_sigla?: string | null;
  uf_origem?: string | null;
  data_afetacao?: string | null;
  data_julgamento?: string | null;
  data_publicacao_acordao?: string | null;
}

export interface SessaoStj {
  etapa: string | null;
  processo: string | null;
  processo_paradigma?: boolean | null;
  orgao: string | null;
  tipo?: string | null;
  tipo_decisao_fonte?: string | null;
  data: string | null;
  data_publicacao?: string | null;
  relator_fonte?: string | null;
  decisao?: string | null;
  resultado?: string | null;
  resultado_trechos?: { expressao: string; trecho: string }[];
  lacunas?: (string | Record<string, unknown>)[];
  tese_juridica?: string | null;
  fonte?: Fonte | null;
  /** Pré-extração automática: nunca exibida. */
  votos_pre_extracao?: unknown;
}

export interface TemaStj {
  numero: string;
  tipo_precedente: string | null;
  orgao: string | null;
  situacao: string | null;
  questao: string | null;
  tese: string | null;
  informacoes_complementares?: string | null;
  delimitacao_julgado?: string | null;
  assuntos?: { descricao: string }[];
  repercussao_geral_stf?: { numero: string; descricao?: string | null }[];
  relator: string[];
  datas: ResumoTemaStj["datas"];
  processos: ProcessoStj[];
  colecoes: string[];
  url_oficial: string | null;
  pagina_oficial?: { ramo_do_direito?: string | null; ultima_atualizacao?: string | null; verificado_em?: string | null } | null;
  julgamento?: { sessoes: SessaoStj[]; aguardando_fonte?: boolean; lacunas?: (string | Record<string, unknown>)[] } | null;
  pautas?: { processo?: string | null; data_sessao?: string | null; orgao_julgador_sigla?: string | null; relator?: string | null }[];
  fontes?: Fonte[];
  lacunas?: (string | Record<string, unknown>)[];
  atualizado_em?: string | null;
}

export interface EtapaConferida {
  etapa: string | null;
  resultado: string | null;
  resultado_trecho: string | null;
  relator: string | null;
  relator_acordao: string | null;
  acompanharam: string[];
  vencidos: string[];
  ausentes: { nome: string; motivo_texto: string | null }[];
  impedidos: string[];
  presidente: string | null;
  voto_vista: string[];
}

export interface VotoConferido {
  tema: string;
  acordao_id: string;
  processo: string;
  data_julgamento: string | null;
  orgao: string | null;
  etapas: EtapaConferida[];
  texto_fonte_url: string | null;
  texto_fonte_titulo?: string | null;
  trecho_literal: string | null;
  situacao_conferencia: string;
  lacunas: string[];
  ministros_ids?: Record<string, string>;
}

export interface MinistroStj {
  id: string;
  nome: string;
  nome_destaque?: string | null;
  url_oficial?: string | null;
}

/** Linha de public/justica/stj-temas.json. */
export type LinhaTemaStj = [
  numero: string,
  tipo: string | null,
  situacao: string | null,
  orgao: string | null,
  relator: string | null,
  questao: string | null,
  tese: string | null,
  colecoes: string[],
  comPagina: 0 | 1,
  data: string | null,
  url: 1 | string | null,
  titulo?: string | null,
  /** Acrescentados para a lista com filtros: tema do dia a dia, etiqueta estruturada, */
  temaDiaADia?: string | null,
  etiqueta?: string | null,
  /** expressões literais do resultado do mérito ("Por unanimidade", "Por maioria"), trecho oficial cortado */
  resultado?: string[],
  trechoResultado?: string | null,
  /** qual data está na posição 9: "j" julgamento, "a" afetação. */
  tipoData?: "j" | "a" | null,
];

// ---------------------------------------------------------------- STF (contrato "julgamento")
export interface VotoStf {
  ministro: string;
  nome_na_composicao_atual?: string | null;
  tipo_voto?: string | null;
  acompanha?: string | null;
  data?: string | null;
  url_voto?: string | null;
  textos?: { titulo?: string | null; url: string }[];
}

export interface VotacaoStf {
  /** "certidao" (texto oficial do resultado) ou "plenario-virtual" (votos estruturados publicados pelo STF). */
  origem?: string | null;
  parte?: string | null;
  descricao?: string | null;
  resultado?: string | null;
  trecho?: string | null;
  vencidos?: string[];
  vencidos_trechos?: string[];
  impedidos?: string[];
  ausentes?: (string | { nome: string; motivo_texto?: string | null })[];
  presidente?: string | null;
  relator?: { ministro?: string | null } | null;
  relatorio_url?: string | null;
  voto_relator_url?: string | null;
  votos?: VotoStf[];
  url?: string | null;
}

export interface JulgamentoStf {
  id?: string;
  tribunal?: string;
  colecoes?: string[];
  processo?: { classe?: string | null; numero?: string | null; identificacao?: string | null; url?: string | null } | null;
  precedente?: { tipo?: string | null; numero?: string | number | null; tese?: string | null; questao?: string | null } | null;
  orgao?: string | null;
  sessao?: { ambiente?: string | null; inicio?: string | null; fim?: string | null; trecho_oficial?: string | null } | string | null;
  relator?: string | null;
  redator_acordao?: string | null;
  data_julgamento?: string | null;
  data_publicacao?: string | null;
  certidao_literal?: string | null;
  certidao_fonte?: { titulo?: string | null; url: string } | null;
  ementa?: string | null;
  participacao?: Record<string, { nomes?: string[]; trechos?: string[] }> | null;
  votacoes?: VotacaoStf[];
  conferencia_votos_x_certidao?: { resultado?: string | null; detalhe?: string | null } | null;
  situacao_conferencia?: string | null;
  fontes?: Fonte[];
  lacunas?: (string | Record<string, unknown>)[];
  atualizado_em?: string | null;
}

export interface ResumoJulgamentoStf {
  id: string;
  identificacao?: string | null;
  tema?: string | null;
  tipo?: string | null;
  data_julgamento?: string | null;
  ambiente?: string | null;
  relator?: string | null;
  resultados?: { parte?: string | null; resultado?: string | null; vencidos?: string[] }[];
  colecoes?: string[];
  /** Acrescentados pelo gerador: trecho literal do resultado do mérito na certidão, inícios dos textos, fonte. */
  resultado_trecho?: string | null;
  certidao_inicio?: string | null;
  ementa_inicio?: string | null;
  orgao?: string | null;
  acessado_em?: string | null;
  url?: string | null;
  tema_dia_a_dia?: string | null;
  etiqueta?: string | null;
}

export interface TemaStf {
  numero: number | string;
  titulo?: string | null;
  descricao?: string | null;
  assuntos?: string[];
  tese?: string | null;
  data_tese?: string | null;
  relator?: string | null;
  situacao?: { repercussao_geral?: string | null; data_repercussao_geral?: string | null; andamento?: string | null; data_andamento?: string | null } | null;
  leading_case?: { identificacao?: string | null; url?: string | null } | null;
  url?: string | null;
  colecoes?: string[];
  julgamento_ref?: string | string[] | null;
  fontes?: Fonte[];
  lacunas?: (string | Record<string, unknown>)[];
  atualizado_em?: string | null;
}

export interface IndiceStf {
  atualizado_em: string | null;
  fonte: Fonte | null;
  total: number;
  com_pagina: string[];
  itens: { numero: number | string; titulo?: string | null; relator?: string | null; situacao?: string | null; andamento?: string | null; colecoes?: string[]; leading_case?: string | null; tem_tese?: boolean }[];
  julgamentos_por_tema: Record<string, string[]>;
  julgamentos_total: number;
  julgamentos: ResumoJulgamentoStf[];
  fontes: Fonte[];
  contagens?: { por_situacao: Record<string, number>; por_andamento: Record<string, number>; com_tese: number };
}

/** Linha de public/justica/stf-temas.json. */
export type LinhaTemaStf = [
  numero: string,
  titulo: string | null,
  situacao: string | null,
  andamento: string | null,
  relator: string | null,
  leadingCase: string | null,
  tese: string | null,
  colecoes: string[],
  comPagina: 0 | 1,
  url: string | null,
  descricao: string | null,
  tituloSimples?: string | null,
  temaDiaADia?: string | null,
  etiqueta?: string | null,
  resultado?: string[],
  trechoResultado?: string | null,
  data?: string | null,
  /** "j" julgamento ligado, "t" data da tese, "r" análise da repercussão geral. */
  tipoData?: "j" | "t" | "r" | null,
  orgao?: string | null,
];
