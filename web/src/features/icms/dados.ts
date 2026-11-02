import fs from "node:fs";
import path from "node:path";
import { DECISOES_EXEMPLO } from "./fixture";
import { GLOSSARIO_BASE } from "./glossario-base";
import type { ArquivoTitulos } from "@/components/decisao/tipos";
import type { ArquivoDecisoes, Decisao, TermoGlossario } from "./tipos";

/**
 * Leitura dos dados do ICMS em web/content (copiados de ../dados por
 * scripts/sync-data.mjs). Somente servidor / build. Os caminhos usam segmentos
 * fixos para restringir o rastreamento de arquivos do Next a cada arquivo.
 */
function lerOpcional<T>(arquivo: string): T | null {
  if (!fs.existsSync(arquivo)) return null;
  return JSON.parse(fs.readFileSync(arquivo, "utf8")) as T;
}

let cacheDecisoes: ArquivoDecisoes | null = null;

/** Decisões em ordem cronológica decrescente (data da decisão, depois publicação). */
export function getDecisoes(): ArquivoDecisoes {
  if (cacheDecisoes) return cacheDecisoes;
  const lido = lerOpcional<ArquivoDecisoes>(path.join(process.cwd(), "content", "icms", "decisoes.json"));
  const base = lido && Array.isArray(lido.itens) ? { ...lido, provisorio: false } : DECISOES_EXEMPLO;
  const chave = (d: Decisao) => d.datas?.decisao ?? d.datas?.publicacao ?? d.datas?.vigencia ?? "";
  const itens = [...base.itens].sort((a, b) => chave(b).localeCompare(chave(a)) || a.id.localeCompare(b.id));
  cacheDecisoes = { ...base, itens };
  return cacheDecisoes;
}

const cacheTitulos = new Map<string, ArquivoTitulos | null>();

function lerTitulos(arquivo: string, alternativo: string): ArquivoTitulos | null {
  try {
    const lido = lerOpcional<ArquivoTitulos>(arquivo) ?? lerOpcional<ArquivoTitulos>(alternativo);
    return lido && lido.itens && typeof lido.itens === "object" ? lido : null;
  } catch {
    return null;
  }
}

/**
 * Títulos em linguagem simples (dados/titulos/<secao>.json, contrato em dados/esquema.json →
 * titulo_simples). Procura em content/titulos e, no build local, em ../dados/titulos. Sem o
 * arquivo, os cartões usam o título oficial. Caminhos fixos por seção (rastreamento do Next).
 */
export function getTitulos(secao: "icms" | "stj" | "stf"): ArquivoTitulos | null {
  if (cacheTitulos.has(secao)) return cacheTitulos.get(secao) ?? null;
  const cwd = process.cwd();
  const t =
    secao === "icms"
      ? lerTitulos(path.join(cwd, "content", "titulos", "icms.json"), path.join(cwd, "..", "dados", "titulos", "icms.json"))
      : secao === "stj"
        ? lerTitulos(path.join(cwd, "content", "titulos", "stj.json"), path.join(cwd, "..", "dados", "titulos", "stj.json"))
        : lerTitulos(path.join(cwd, "content", "titulos", "stf.json"), path.join(cwd, "..", "dados", "titulos", "stf.json"));
  cacheTitulos.set(secao, t);
  return t;
}

export function getDecisao(id: string): Decisao | null {
  return getDecisoes().itens.find((d) => d.id === id) ?? null;
}

/** Normaliza para comparar termos sem diferença de maiúsculas e acentos. */
export function chaveTermo(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

type GlossarioBruto =
  | { itens?: unknown[]; termos?: unknown[] }
  | unknown[]
  | Record<string, unknown>;

interface TermoIndexado extends TermoGlossario {
  chaves: string[];
}

/** Chaves de busca: termo sem parênteses, conteúdo dos parênteses e sigla. */
function chavesDe(termo: string, sigla: string | null): string[] {
  const k = [termo.replace(/\s*\(.*\)\s*$/, "")];
  const par = /\(([^)]+)\)\s*$/.exec(termo);
  if (par) k.push(par[1]);
  if (sigla) k.push(sigla);
  return [...new Set(k.map(chaveTermo))];
}

/** Aceita lista de { termo, sigla?, explicacao|definicao|descricao } ou mapa termo → explicação. */
function normalizarGlossario(bruto: GlossarioBruto | null): TermoIndexado[] {
  if (!bruto) return [];
  const lista: unknown[] = Array.isArray(bruto)
    ? bruto
    : Array.isArray((bruto as { itens?: unknown[] }).itens)
      ? (bruto as { itens: unknown[] }).itens
      : Array.isArray((bruto as { termos?: unknown[] }).termos)
        ? (bruto as { termos: unknown[] }).termos
        : Object.entries(bruto).map(([termo, explicacao]) => ({ termo, explicacao }));
  const saida: TermoIndexado[] = [];
  for (const i of lista) {
    if (!i || typeof i !== "object") continue;
    const o = i as Record<string, unknown>;
    const termo = o.termo ?? o.nome;
    const sigla = typeof o.sigla === "string" ? o.sigla : null;
    const explicacao = o.explicacao ?? o.definicao ?? o.descricao;
    if (typeof termo !== "string" || typeof explicacao !== "string") continue;
    const rotulo = sigla && !termo.includes(sigla) ? `${termo} (${sigla})` : termo;
    saida.push({ termo: rotulo, explicacao, chaves: chavesDe(termo, sigla) });
  }
  return saida;
}

let cacheGlossario: Map<string, TermoGlossario> | null = null;

/**
 * Glossário: content/glossario.json, depois content/icms/glossario.json; os termos
 * que faltarem nos dois vêm da lista base do site (definições breves e neutras).
 */
export function getGlossario(): Map<string, TermoGlossario> {
  if (cacheGlossario) return cacheGlossario;
  const mapa = new Map<string, TermoGlossario>();
  const fontes = [
    normalizarGlossario(lerOpcional<GlossarioBruto>(path.join(process.cwd(), "content", "glossario.json"))),
    normalizarGlossario(lerOpcional<GlossarioBruto>(path.join(process.cwd(), "content", "icms", "glossario.json"))),
    GLOSSARIO_BASE.map((t) => ({ ...t, chaves: chavesDe(t.termo, null) })),
  ];
  for (const lista of fontes) {
    for (const { chaves, ...t } of lista) {
      for (const k of chaves) if (!mapa.has(k)) mapa.set(k, t);
    }
  }
  cacheGlossario = mapa;
  return mapa;
}

/** Termos de uma decisão encontrados no glossário (os ausentes são ignorados). */
export function termosDaDecisao(d: Decisao): TermoGlossario[] {
  const g = getGlossario();
  const vistos = new Set<string>();
  const saida: TermoGlossario[] = [];
  for (const t of d.termos ?? []) {
    const k = chaveTermo(t);
    const item = g.get(k);
    if (item && !vistos.has(k)) {
      vistos.add(k);
      saida.push(item);
    }
  }
  return saida;
}

/** Voto de um parlamentar numa votação coletada (dados/<casa>/votacoes/<id>.json). */
export interface VotacaoColetada {
  id: string;
  votos?: { nome: string; partido?: string | null; uf?: string | null; voto: string }[];
}

/** Votação nominal coletada pela rotina da Câmara ou do Senado, se o arquivo existir. */
export function getVotacaoColetada(casa: string, id: string | null | undefined): VotacaoColetada | null {
  if (!id || !/^[A-Za-z0-9.-]+$/.test(id)) return null;
  if (casa === "camara") return lerOpcional(path.join(process.cwd(), "content", "camara", "votacoes", `${id}.json`));
  if (casa === "senado") return lerOpcional(path.join(process.cwd(), "content", "senado", "votacoes", `${id}.json`));
  return null;
}
