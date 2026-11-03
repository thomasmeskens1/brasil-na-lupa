import fs from "node:fs";
import path from "node:path";
import type { Caminho, DadoChave, FonteResumo, FormaDecisao, TituloSimples } from "@/components/decisao";

/**
 * Leitura (somente servidor / build) do que scripts/gerar-inicio.mjs grava em content/inicio/.
 * Arquivo ausente → valor vazio; a página mostra a lacuna, sem inventar dados.
 */

/**
 * Títulos em linguagem simples ainda em revisão: enquanto for false, os cartões usam o título
 * oficial. Para liberar, troque para true (o dado já vem de dados/titulos via gerar-inicio.mjs).
 */
export const TITULOS_SIMPLES_ATIVOS = true; // a regra fica em tituloAprovado() (só "estruturado" verificado)

export function simplesSeAtivo(s: TituloSimples | null | undefined): TituloSimples | null {
  return TITULOS_SIMPLES_ATIVOS ? (s ?? null) : null;
}

const cache = new Map<string, unknown>();

export function lerInicio<T>(relativo: string): T | null {
  if (cache.has(relativo)) return cache.get(relativo) as T | null;
  let v: T | null = null;
  try {
    v = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "inicio", relativo), "utf8")) as T;
  } catch {
    v = null;
  }
  cache.set(relativo, v);
  return v;
}

export interface DecisaoSemana {
  id: string;
  ordem: string;
  href: string;
  tituloOficial: string;
  subtitulo: string | null;
  caminho: Caminho;
  rotuloCaminho?: string;
  data: string | null;
  rotuloData?: string;
  forma: FormaDecisao | null;
  dado: DadoChave | null;
  quemDecidiu: string | null;
  fonte: FonteResumo | null;
  simples: TituloSimples | null;
}

export interface ArquivoDecisoes {
  gerado_em: string;
  periodo: { inicio: string; fim: string };
  itens: DecisaoSemana[];
}

export function getDecisoesSemana(): ArquivoDecisoes | null {
  return lerInicio<ArquivoDecisoes>("decisoes.json");
}

export interface Atualizacao {
  coletado_em: string | null;
  fontes: { pasta: string; em: string }[];
}

export function getAtualizacao(): Atualizacao | null {
  return lerInicio<Atualizacao>("atualizacao.json");
}

/** "2026-11-02T22:01:49Z" → { data: "02/11/2026", hora: "19:01" } no horário de Brasília. */
export function dataHoraBrasilia(iso: string | null | undefined): { data: string; hora: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...o }).format(d);
  return { data: f({ day: "2-digit", month: "2-digit", year: "numeric" }), hora: f({ hour: "2-digit", minute: "2-digit", hour12: false }) };
}
