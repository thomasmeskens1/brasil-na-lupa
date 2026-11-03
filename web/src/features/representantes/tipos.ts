import type { FonteResumo } from "@/components/decisao";

/** Formatos gerados por scripts/gerar-inicio.mjs (content/inicio/uf/ e public/quem-me-representa/). */

export interface Eleito {
  cargo: string;
  nome: string;
  nome_completo?: string;
  partido: string | null;
  ano: number | null;
  situacao: string | null;
  eleicao_suplementar?: string;
  data_eleicao?: string;
  /** Página do mandato atual no site (só com vínculo exato à lista em exercício). */
  href?: string;
}

export interface ArquivoUf {
  uf: string;
  nome_uf: string;
  atualizado_em: string | null;
  aviso: string | null;
  fontes: FonteResumo[];
  itens: Eleito[];
  municipios: { nome: string; slug: string }[];
  eleitos_2026: { status: string | null; aviso: string | null; fontes: FonteResumo[]; itens: Eleito[] } | null;
}

export interface ArquivoMunicipio {
  nome: string;
  uf: string;
  nome_uf?: string;
  ano: number;
  atualizado_em: string | null;
  itens: Eleito[];
  fontes: FonteResumo[];
}

export interface MetaEleitos {
  atualizado_em: string | null;
  ultima_execucao: string | null;
  aviso: string | null;
  lacunas: string[];
  fontes: FonteResumo[];
  glossario: Record<string, string>;
}
