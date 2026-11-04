/**
 * Seção educativa "Impostos": como os principais impostos funcionam hoje e como ficam com a
 * Reforma Tributária do consumo (Emenda Constitucional nº 132/2023 e Lei Complementar nº
 * 214/2025). Todo texto vem de documento oficial listado em fontes.ts (diretrizes 1 e 2).
 */
import type { NomeFigImposto } from "./FigurinhaImposto";
import type { FONTES } from "./fontes";

/** Quem cobra. O IBS é dividido entre estados e municípios (competência compartilhada). */
export type Esfera = "federal" | "estadual" | "municipal";

/** O que é tributado. */
export type Base = "consumo" | "renda" | "patrimonio";

/** Chave de uma fonte oficial em FONTES. */
export type ChaveFonte = keyof typeof FONTES;

export interface Mudanca {
  /** Quando (texto curto: "2027", "2029 a 2032", "1º/1/2026"). */
  quando: string;
  oque: string;
  fonte: ChaveFonte;
}

export interface LinkDecisao {
  rotulo: string;
  href: string;
  /** Linha de apoio (ex.: placar oficial e data). */
  detalhe?: string;
}

export interface Imposto {
  slug: string;
  /** Sigla ou nome curto usado no cartão. */
  sigla: string;
  /** Nome completo (diretriz 9). */
  nome: string;
  figura: NomeFigImposto;
  esferas: Esfera[];
  base: Base;
  /** Situação na reforma, em palavras neutras (ex.: "Extinto em 2027"). */
  situacao: string;
  /** Uma frase para o cartão. */
  resumo: string;
  quemCobra: string;
  sobreOQue: string;
  quemDecide: string;
  exemplo: string;
  /** Comparação "hoje × a partir de 2027". */
  hoje: string;
  depois2027: string;
  mudancas: Mudanca[];
  /** Fontes da ficha (quem cobra, sobre o quê, quem decide). */
  fontes: ChaveFonte[];
  /** Termos do glossário explicados na página do imposto. */
  termos: string[];
  decisoes?: LinkDecisao[];
  /** Faz parte da Reforma Tributária do consumo (mostra as justificativas oficiais). */
  reforma: boolean;
  /** Página do site com decisões sobre o imposto (ex.: ICMS em São Paulo). */
  paginaDecisoes?: LinkDecisao;
  /** Tabela oficial (ex.: faixas do Imposto de Renda). */
  tabela?: TabelaOficial;
}

export interface TabelaOficial {
  legenda: string;
  colunas: string[];
  linhas: string[][];
  fonte: ChaveFonte;
  nota?: string;
}
