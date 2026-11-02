import fs from "node:fs";
import path from "node:path";
import type { FonteCongresso } from "./tipos";

/**
 * Presença em Plenário e gastos da cota parlamentar dos deputados (somente servidor / build).
 * Presença: content/_gerado/presenca-camara-<ano>.json (scripts/gerar-executivo-justica.mjs).
 * Cota: content/camara/despesas/<ano>/<id>.json, um arquivo por deputado.
 */
function lerOpcional<T>(arquivo: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")) as T;
  } catch {
    return null;
  }
}

const ID = /^\d{1,10}$/;

export interface PresencaItem {
  parlamentar_id: string;
  nome_na_fonte?: string | null;
  dias_com_sessao: number | null;
  dias_presenca: number | null;
  dias_ausencia_justificada: number | null;
  dias_ausencia_nao_justificada: number | null;
  dias_outra_frequencia: Record<string, number> | null;
  sessoes_registradas: number | null;
  sessoes_presenca: number | null;
  sessoes_ausencia: number | null;
  periodo_na_fonte?: { inicio?: string | null; fim?: string | null } | null;
}

export interface PresencaAno {
  ano: number;
  atualizado_em: string | null;
  abrangencia: string | null;
  totais: { sessoes_deliberativas?: number; dias_com_sessoes_deliberativas?: number } | null;
  fonte: FonteCongresso | null;
  fontes_complementares: FonteCongresso[];
  sem_registro_no_servico: { data: string; descricao: string | null }[];
  por_id: Record<string, PresencaItem>;
}

function anosEm(dir: string, re: RegExp): number[] {
  try {
    return fs
      .readdirSync(dir)
      .map((n) => re.exec(n)?.[1])
      .filter((x): x is string => !!x)
      .map(Number)
      .sort((a, b) => b - a);
  } catch {
    return [];
  }
}

const cachePresenca = new Map<number, PresencaAno | null>();
function presencaAno(ano: number): PresencaAno | null {
  if (!cachePresenca.has(ano)) {
    cachePresenca.set(ano, lerOpcional<PresencaAno>(path.join(process.cwd(), "content", "_gerado", `presenca-camara-${ano}.json`)));
  }
  return cachePresenca.get(ano) ?? null;
}

let anosPresenca: number[] | null = null;
/** Presença do deputado em cada ano coletado (do mais recente ao mais antigo). */
export function presencaDoDeputado(id: string): { ano: PresencaAno; item: PresencaItem }[] {
  if (!ID.test(id)) return [];
  anosPresenca ??= anosEm(path.join(process.cwd(), "content", "_gerado"), /^presenca-camara-(\d{4})\.json$/);
  return anosPresenca
    .map((a) => presencaAno(a))
    .filter((p): p is PresencaAno => !!p)
    .flatMap((p) => (p.por_id[id] ? [{ ano: p, item: p.por_id[id] }] : []));
}

export interface GastoTipo {
  tipo: string;
  total?: number | null;
  total_liquido?: number | null;
  documentos?: number | null;
}

export interface CotaAno {
  ano: number;
  atualizado_em?: string | null;
  total_liquido: number | null;
  documentos_qtd?: number | null;
  total_pagina_oficial: number | null;
  pagina_oficial?: { total?: number | null; diferenca_para_arquivo?: number | null; por_tipo?: GastoTipo[] } | null;
  por_mes?: { mes: number; documentos?: number | null; total_liquido: number | null }[];
  por_tipo?: GastoTipo[];
  fonte?: FonteCongresso | null;
  url_documentos?: string | null;
  lacunas?: (string | Record<string, unknown>)[];
}

export interface FontePaginaCota {
  consultado_em?: string | null;
  fonte?: FonteCongresso | null;
}

let anosCota: number[] | null = null;
const cacheFontePagina = new Map<number, FontePaginaCota | null>();

/** Fonte da página oficial da cota no ano (só o cabeçalho; o arquivo completo é grande). */
function fontePagina(ano: number): FontePaginaCota | null {
  if (!cacheFontePagina.has(ano)) {
    const d = lerOpcional<FontePaginaCota>(path.join(process.cwd(), "content", "camara", "despesas", String(ano), "pagina-oficial.json"));
    cacheFontePagina.set(ano, d ? { consultado_em: d.consultado_em ?? null, fonte: d.fonte ?? null } : null);
  }
  return cacheFontePagina.get(ano) ?? null;
}

/** Gastos da cota do deputado em cada ano coletado (do mais recente ao mais antigo). */
export function cotaDoDeputado(id: string): { cota: CotaAno; pagina: FontePaginaCota | null }[] {
  if (!ID.test(id)) return [];
  anosCota ??= anosEm(path.join(process.cwd(), "content", "camara", "despesas"), /^(\d{4})$/);
  return anosCota.flatMap((ano) => {
    const c = lerOpcional<CotaAno>(path.join(process.cwd(), "content", "camara", "despesas", String(ano), `${id}.json`));
    return c ? [{ cota: { ...c, ano: c.ano ?? ano }, pagina: fontePagina(ano) }] : [];
  });
}
