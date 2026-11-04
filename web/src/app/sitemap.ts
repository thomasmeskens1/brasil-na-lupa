import type { MetadataRoute } from "next";
import { ufsComDados } from "@/features/estados/dados";
import { UFS } from "@/features/estados/ufs";
import { SITE } from "./site";

/** Mapa do site para os buscadores: seções principais e páginas de cada estado. */
export default function sitemap(): MetadataRoute.Sitemap {
  const secoes = [
    "",
    "/quem-me-representa",
    "/impostos",
    "/congresso",
    "/executivo",
    "/justica",
    "/tribunais-de-contas",
    "/estados",
    "/municipios",
    "/agenda",
    "/metodologia",
    "/participar",
    "/privacidade",
    "/acessibilidade",
  ];
  const estados = ufsComDados().flatMap((uf) => [`/estados/${uf}`, `/estados/${uf}/leis-e-decretos`]);
  const representantes = UFS.map((u) => `/quem-me-representa/${u.uf}`);
  return [...secoes, ...estados, ...representantes].map((p) => ({
    url: `${SITE}${p}`,
    changeFrequency: p === "" || p === "/congresso" || p === "/agenda" ? "hourly" : "daily",
  }));
}
