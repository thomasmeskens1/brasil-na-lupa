import type { FonteResumo } from "@/components/decisao";
import type { FonteFoto, FonteFotoMeta } from "@/components/politico/fotos";

/** Formatos gerados por scripts/gerar-representantes.mjs (public/quem-me-representa/r/). */

export interface IndicadoresBrutos {
  /** Proposições de autoria transformadas em norma: total e como primeiro signatário. */
  aut?: { n: number; n1: number };
  /** Presença em Plenário (Câmara): dias presentes, dias com sessão, ausências justificadas e não justificadas. */
  pr?: { d: number; t: number; aj: number | null; an: number | null; ini: string | null; fim: string | null };
}

export interface PessoaBase {
  k: string;
  c: string;
  n: string;
  uf: string;
  p: string | null;
  a: number | null;
  s: string | null;
  /** Vínculo exato com a lista oficial em exercício. */
  v?: { casa: "camara" | "senado" | "alesp"; id: string };
  h?: string;
  nc?: string;
  pa?: { p: string; em: string | null };
  uo?: string;
  i?: IndicadoresBrutos;
  /** 1 quando há foto oficial de fonte com permissão de uso (public/fotos/<casa>/<id>.webp). */
  f?: 1;
}

export interface MetaAutoria {
  periodo: { inicio: string; fim: string } | null;
  criterio: string | null;
  atualizado_em: string | null;
  fontes: FonteResumo[];
}

export interface MetaPresenca {
  ano: number | null;
  atualizado_em: string | null;
  definicao: string;
  fonte: FonteResumo | null;
}

export interface ArquivoBase {
  gerado_em: string;
  eleitos: { atualizado_em: string | null; aviso: string | null; fontes: FonteResumo[] };
  listas: { camara: FonteResumo | null; senado: FonteResumo | null; alesp: FonteResumo | null };
  autoria: { camara: MetaAutoria | null; senado: MetaAutoria | null };
  presenca: { camara: MetaPresenca | null };
  /** Crédito e permissão de cada fonte de fotos ativada. */
  fotos?: Partial<Record<FonteFoto, FonteFotoMeta>>;
  partidos: string[];
  pessoas: PessoaBase[];
}

export interface ArquivoMun {
  uf: string;
  nome_uf: string;
  ano: number;
  atualizado_em: string | null;
  cargos: string[];
  fontes: FonteResumo[];
  municipios: [string, string][];
  /** [nome de urna, índice do cargo, partido, índice do município, situação] */
  p: [string, number, string | null, number, string | null][];
}

export interface ItemAutoria {
  identificacao: string | null;
  tipo?: string | null;
  ementa: string | null;
  data_apresentacao: string | null;
  situacao: string | null;
  data_situacao: string | null;
  url: string;
  urn_norma?: string | null;
  norma?: { descricao: string | null; tipo: string | null; data_assinatura: string | null; publicacao: string | null } | null;
  ordem: number | null;
}

export interface ArquivoAutoria {
  casa: "camara" | "senado";
  id: string;
  periodo: { inicio: string; fim: string } | null;
  itens: ItemAutoria[];
}

/** Pessoa já pronta para a busca e o cartão (todas as esferas). */
export interface Pessoa {
  key: string;
  cargo: string;
  nome: string;
  /** Sigla da UF; null para Presidência (todo o país). */
  uf: string | null;
  cidade?: { nome: string; slug: string };
  partido: string | null;
  ano: number | null;
  situacao: string | null;
  base?: PessoaBase;
  /** Fonte própria (Presidência da República). */
  fonte?: FonteResumo;
  /** Texto normalizado para a busca. */
  busca: string;
}
