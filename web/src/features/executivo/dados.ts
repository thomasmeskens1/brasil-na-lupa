import fs from "node:fs";
import path from "node:path";
import { ouPrimeiro, recentes } from "../comum/prerender";
import type { IndiceExecutivo, MedidaProvisoria, Veto } from "./tipos";

/**
 * Leitura dos dados do Executivo federal em web/content (somente servidor / build).
 * content/_gerado/executivo.json é gerado por scripts/gerar-executivo-justica.mjs; o detalhe
 * vem de content/executivo/{medidas-provisorias,vetos}/<id>.json. As MPs e vetos recentes são
 * gerados no build; os demais, na primeira visita (os arquivos que essas rotas leem vão no
 * pacote da função: outputFileTracingIncludes em next.config.ts).
 */
function lerOpcional<T>(arquivo: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")) as T;
  } catch {
    return null;
  }
}

const VAZIO: IndiceExecutivo = {
  atualizado_em: null,
  periodo: null,
  fontes: [],
  contagens: null,
  fontes_mpv: [],
  fontes_vetos: [],
  fontes_normas: [],
  abrangencia_normas: null,
  mpvs: [],
  vetos: [],
  normas: { total: 0, anos: [], por_ano_tipo: {} },
};

let cache: IndiceExecutivo | null = null;

export function getIndiceExecutivo(): IndiceExecutivo {
  if (!cache) cache = lerOpcional<IndiceExecutivo>(path.join(process.cwd(), "content", "_gerado", "executivo.json")) ?? VAZIO;
  return cache;
}

const ID_MPV = /^mpv-\d{1,5}-\d{4}$/;
const ID_VETO = /^vet-\d{1,4}-\d{4}$/;

export function getMpv(id: string): MedidaProvisoria | null {
  if (!ID_MPV.test(id)) return null;
  const d = lerOpcional<MedidaProvisoria>(path.join(process.cwd(), "content", "executivo", "medidas-provisorias", `${id}.json`));
  return d && d.id === id ? d : null;
}

export function getVeto(id: string): Veto | null {
  if (!ID_VETO.test(id)) return null;
  const d = lerOpcional<Veto>(path.join(process.cwd(), "content", "executivo", "vetos", `${id}.json`));
  return d && d.id === id ? d : null;
}

/** Ids gerados no build; com cacheComponents a lista não pode ser vazia (o marcador vira 404). */
export function idsOuMarcador(ids: string[]): string[] {
  return ids.length ? ids : ["sem-dados"];
}

/** MPs geradas no build (página e imagem): as dos últimos 60 dias; as demais, na primeira visita. */
export function idsMpvNoBuild(): string[] {
  const todas = getIndiceExecutivo().mpvs;
  return idsOuMarcador(ouPrimeiro(recentes(todas, (m) => m.data), todas).map((m) => m.id));
}

/** Vetos gerados no build (página e imagem): os publicados nos últimos 60 dias. */
export function idsVetoNoBuild(): string[] {
  const todos = getIndiceExecutivo().vetos;
  return idsOuMarcador(ouPrimeiro(recentes(todos, (v) => v.data_publicacao), todos).map((v) => v.id));
}
