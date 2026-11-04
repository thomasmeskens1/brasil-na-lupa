import fs from "node:fs";
import path from "node:path";
import { montarFoto, type FonteFoto, type FonteFotoMeta, type FotoInfo } from "@/components/politico/fotos";

/**
 * Fotos oficiais (somente servidor / build): lê content/fotos/manifest.json, cópia do manifesto
 * do coletor (scripts/coleta/fotos). Só tem foto quem está no manifesto; o arquivo é servido
 * como estático em public/fotos (fora do pacote das funções).
 */
interface Manifesto {
  fontes: Partial<Record<FonteFoto, FonteFotoMeta>>;
  itens: Record<string, { arquivo: string }>;
}

let cache: Manifesto | null | undefined;
function manifesto(): Manifesto | null {
  if (cache === undefined) {
    try {
      cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "fotos", "manifest.json"), "utf8")) as Manifesto;
    } catch {
      cache = null;
    }
  }
  return cache;
}

export function fotoOficial(fonte: FonteFoto, id: string | number | null | undefined): FotoInfo | null {
  const m = manifesto();
  if (!m || id === null || id === undefined) return null;
  const chave = `${fonte}/${id}`;
  return m.itens[chave] ? montarFoto(fonte, String(id), m.fontes[fonte]) : null;
}

/** Crédito e permissão de uma fonte de fotos ativada (null se a fonte não está ativada). */
export function fonteDasFotos(fonte: FonteFoto): FonteFotoMeta | null {
  return manifesto()?.fontes[fonte] ?? null;
}
