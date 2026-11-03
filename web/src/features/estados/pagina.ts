import { notFound } from "next/navigation";
import { getIndiceEstado } from "./dados";
import type { IndiceEstado } from "./tipos";
import { getUf, type UfInfo } from "./ufs";

/** UF com dados coletados, ou 404 (endereço em minúsculas, como gerado). */
export function exigirUf(uf: string): { u: UfInfo; ind: IndiceEstado } {
  const u = getUf(uf);
  const ind = u && u.uf === uf ? getIndiceEstado(u.uf) : null;
  if (!u || !ind) notFound();
  return { u, ind };
}

/** Mesma checagem, sem 404 (para generateMetadata). */
export function ufComDados(uf: string): { u: UfInfo; ind: IndiceEstado } | null {
  const u = getUf(uf);
  const ind = u && u.uf === uf ? getIndiceEstado(u.uf) : null;
  return u && ind ? { u, ind } : null;
}

export function maiuscula(t: string): string {
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}
