import fs from "node:fs";
import path from "node:path";
import type { CidadeMun, IndiceMunicipios, MunicipioPresente, VotacaoMun } from "./tipos";

/**
 * Leitura dos dados da seção Municípios em web/content/_gerado/municipios (gerados por
 * scripts/gerar-municipios.mjs; somente servidor / build). Atibaia continua lida por
 * features/atibaia/dados.ts (adaptador: os dados não mudaram de pasta).
 */
const GERADO = () => path.join(process.cwd(), "content", "_gerado", "municipios");
const UF = /^[a-z]{2}$/;
const SLUG = /^[a-z0-9-]{1,80}$/;
const ID = /^[A-Za-z0-9-]{1,60}$/;

function lerOpcional<T>(arquivo: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")) as T;
  } catch {
    return null;
  }
}

const VAZIO: IndiceMunicipios = {
  gerado_em: null,
  total_municipios: 0,
  presentes: [],
  fontes: [],
  financas_relatorios: [],
  financas_atualizado_em: null,
  registro_atualizado_em: null,
};

let indice: IndiceMunicipios | null = null;

export function getIndiceMunicipios(): IndiceMunicipios {
  if (!indice) indice = lerOpcional<IndiceMunicipios>(path.join(GERADO(), "indice.json")) ?? VAZIO;
  return indice;
}

let porChave: Map<string, MunicipioPresente> | null = null;

export function getPresente(uf: string, slug: string): MunicipioPresente | null {
  if (!porChave) porChave = new Map(getIndiceMunicipios().presentes.map((m) => [`${m.uf}/${m.slug}`, m]));
  return porChave.get(`${uf}/${slug}`) ?? null;
}

const cache = new Map<string, CidadeMun | null>();

export function getCidade(uf: string, slug: string): CidadeMun | null {
  if (!UF.test(uf) || !SLUG.test(slug) || !getPresente(uf, slug)) return null;
  const k = `${uf}/${slug}`;
  if (!cache.has(k)) cache.set(k, lerOpcional<CidadeMun>(path.join(GERADO(), uf, `${slug}.json`)));
  return cache.get(k) ?? null;
}

export function getVotacaoMun(uf: string, slug: string, id: string): VotacaoMun | null {
  if (!ID.test(id) || !getCidade(uf, slug)?.camara) return null;
  const v = lerOpcional<VotacaoMun>(path.join(GERADO(), uf, slug, "v", `${id}.json`));
  if (!v || v.id !== id) return null;
  // Diretriz 5: voto individual só em votação nominal.
  return { ...v, votos: v.tipo === "nominal" ? v.votos : [] };
}

/** Com cacheComponents a lista de parâmetros não pode ser vazia: o marcador vira 404. */
export function ouMarcador<T>(lista: T[], marcador: T): T[] {
  return lista.length ? lista : [marcador];
}

export function baseCidade(uf: string, slug: string): string {
  return `/municipios/${uf}/${slug}`;
}
