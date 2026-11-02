import fs from "node:fs";
import path from "node:path";
import type { Fonte, IndiceStf, IndiceStj, JulgamentoStf, MinistroStj, TemaStf, TemaStj, VotoConferido } from "./tipos";

/**
 * Leitura dos dados do STJ e do STF em web/content (somente servidor / build). Os índices
 * vêm de content/_gerado (scripts/gerar-executivo-justica.mjs). A pasta do STF pode não
 * existir: as funções devolvem listas vazias e a página mostra a seção em construção.
 */
function lerOpcional<T>(arquivo: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")) as T;
  } catch {
    return null;
  }
}

const NUM = /^\d{1,5}$/;
const ARQ = /^[A-Za-z0-9._-]{1,80}$/;

const VAZIO_STJ: IndiceStj = {
  atualizado_em: null,
  fonte: null,
  fontes: [],
  divergencias: {},
  total: 0,
  colecoes: {},
  com_pagina: [],
  itens: [],
  situacoes: [],
  orgaos: [],
  tipos: [],
};

let cacheStj: IndiceStj | null = null;
export function getIndiceStj(): IndiceStj {
  if (!cacheStj) cacheStj = lerOpcional<IndiceStj>(path.join(process.cwd(), "content", "_gerado", "justica-stj.json")) ?? VAZIO_STJ;
  return cacheStj;
}

export function getTemaStj(n: string): TemaStj | null {
  if (!NUM.test(n)) return null;
  const t = lerOpcional<TemaStj>(path.join(process.cwd(), "content", "stj", "temas", `${n}.json`));
  return t && String(t.numero) === n ? t : null;
}

/** Temas de cada coleção acompanhada (ex.: ICMS), do número mais alto para o mais baixo. */
export function temasPorColecaoStj(): { colecao: string; temas: TemaStj[] }[] {
  return Object.entries(getIndiceStj().colecoes).map(([colecao, nums]) => ({
    colecao,
    temas: nums
      .map((n) => getTemaStj(String(n)))
      .filter((t): t is TemaStj => !!t)
      .sort((a, b) => Number(b.numero) - Number(a.numero)),
  }));
}

let cacheVotos: VotoConferido[] | null = null;
/** Somente itens com conferência concluída ("conferido") ou marcados "incerto" (só resultado e lacunas). */
export function getVotosConferidos(tema: string): VotoConferido[] {
  if (!cacheVotos) {
    const c = lerOpcional<{ itens?: VotoConferido[] }>(path.join(process.cwd(), "content", "stj", "curadoria", "votos.json"));
    cacheVotos = (c?.itens ?? []).filter((i) => i.situacao_conferencia === "conferido" || i.situacao_conferencia === "incerto");
  }
  return cacheVotos.filter((i) => String(i.tema) === tema);
}

let cacheMin: Map<string, MinistroStj> | null = null;
export function getMinistrosStj(): Map<string, MinistroStj> {
  if (!cacheMin) {
    const m = lerOpcional<{ itens?: MinistroStj[] }>(path.join(process.cwd(), "content", "stj", "ministros.json"));
    cacheMin = new Map((m?.itens ?? []).map((x) => [x.id, x]));
  }
  return cacheMin;
}

// ---------------------------------------------------------------- STF
const VAZIO_STF: IndiceStf = {
  atualizado_em: null,
  fonte: null,
  total: 0,
  com_pagina: [],
  itens: [],
  julgamentos_por_tema: {},
  julgamentos_total: 0,
  julgamentos: [],
  fontes: [],
};

let cacheStf: IndiceStf | null = null;
export function getIndiceStf(): IndiceStf {
  if (!cacheStf) cacheStf = lerOpcional<IndiceStf>(path.join(process.cwd(), "content", "_gerado", "justica-stf.json")) ?? VAZIO_STF;
  return cacheStf;
}

export function getTemaStf(n: string): TemaStf | null {
  if (!NUM.test(n)) return null;
  const t = lerOpcional<TemaStf>(path.join(process.cwd(), "content", "stf", "repercussao-geral", `${n}.json`));
  return t && String(t.numero) === n ? t : null;
}

export function getJulgamentoStf(arquivo: string): JulgamentoStf | null {
  if (!ARQ.test(arquivo)) return null;
  return lerOpcional<JulgamentoStf>(path.join(process.cwd(), "content", "stf", "julgamentos", `${arquivo}.json`));
}

/** Julgamentos ligados a um tema: pelo campo do tema e pelo número do precedente no arquivo. */
export function julgamentosDoTemaStf(t: TemaStf): JulgamentoStf[] {
  const refs = new Set<string>(getIndiceStf().julgamentos_por_tema[String(t.numero)] ?? []);
  for (const r of [t.julgamento_ref].flat()) if (typeof r === "string") refs.add(r.replace(/^.*\//, "").replace(/\.json$/, ""));
  return [...refs].map(getJulgamentoStf).filter((j): j is JulgamentoStf => !!j);
}

export interface SumulaVinculante {
  numero?: number | string;
  titulo?: string | null;
  texto?: string | null;
  situacao?: string | null;
  julgamento_data?: string | null;
  publicacao_data?: string | null;
}

export function getSumulasVinculantes(): { itens: SumulaVinculante[]; fonte: Fonte | null; lacunas: string[] } {
  const s = lerOpcional<{ itens?: SumulaVinculante[]; fonte?: Fonte; lacunas?: string[] }>(
    path.join(process.cwd(), "content", "stf", "sumulas-vinculantes.json"),
  );
  return { itens: (s?.itens ?? []).filter((x) => x && typeof x === "object"), fonte: s?.fonte ?? null, lacunas: s?.lacunas ?? [] };
}

export function idsOuMarcador(ids: string[]): string[] {
  return ids.length ? ids : ["0"];
}
