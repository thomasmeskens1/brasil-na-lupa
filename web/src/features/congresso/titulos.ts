import fs from "node:fs";
import path from "node:path";
import type { ArquivoTitulos, TituloSimples } from "@/components/decisao/tipos";
import { tituloSimplesDe } from "@/components/decisao/rotulos";
import type { Casa } from "./tipos";

/**
 * Títulos em linguagem simples (dados/titulos/<casa>.json → content/titulos/, copiado por
 * sync-data.mjs). Somente servidor / build. Arquivo ausente = sem título simples (vale o oficial).
 */
const cache = new Map<Casa, ArquivoTitulos | null>();

function arquivo(casa: Casa): ArquivoTitulos | null {
  if (!cache.has(casa)) {
    let d: ArquivoTitulos | null = null;
    try {
      d = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "titulos", `${casa}.json`), "utf8")) as ArquivoTitulos;
    } catch {
      d = null;
    }
    cache.set(casa, d);
  }
  return cache.get(casa) ?? null;
}

export function tituloSimplesVotacao(casa: Casa, id: string): TituloSimples | null {
  return tituloSimplesDe(arquivo(casa), id);
}
