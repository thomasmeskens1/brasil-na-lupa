import fs from "node:fs";
import path from "node:path";
import type { ArquivoTitulos } from "@/components/decisao";

/**
 * Títulos em linguagem simples (dados/titulos/<secao>.json, copiados para content/_gerado por
 * scripts/gerar-executivo-justica.mjs). Somente servidor / build. Sem o arquivo, as páginas usam
 * o título oficial (tituloSimplesDe devolve null).
 */
const cache = new Map<string, ArquivoTitulos | null>();

export function getTitulos(secao: "executivo" | "stj" | "stf"): ArquivoTitulos | null {
  if (!cache.has(secao)) {
    let arq: ArquivoTitulos | null = null;
    try {
      arq = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "_gerado", `titulos-${secao}.json`), "utf8")) as ArquivoTitulos;
    } catch {
      arq = null;
    }
    cache.set(secao, arq);
  }
  return cache.get(secao) ?? null;
}
