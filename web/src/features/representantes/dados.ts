import { lerInicio } from "@/features/inicio/dados";
import { UFS } from "./cargos";
import type { ArquivoUf, MetaEleitos } from "./tipos";

/** Leitura (somente servidor / build) dos eleitos por UF gerados por scripts/gerar-inicio.mjs. */

export function ufValida(uf: string): boolean {
  return UFS.some((u) => u.sigla.toLowerCase() === uf);
}

export function getUf(uf: string): ArquivoUf | null {
  if (!ufValida(uf)) return null;
  return lerInicio<ArquivoUf>(`uf/${uf}.json`);
}

export function getMetaEleitos(): MetaEleitos | null {
  return lerInicio<MetaEleitos>("eleitos-meta.json");
}
