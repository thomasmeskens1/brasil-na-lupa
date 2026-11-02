import fs from "node:fs";
import path from "node:path";
import type { ArquivoTitulos, TituloSimples } from "@/components/decisao/tipos";
import { TITULOS_SIMPLES_ATIVOS } from "@/components/decisao/rotulos";
import type {
  AcordaoTcu,
  ContasPrefeitos,
  CuradoriaPresidente,
  ExercicioPresidente,
  FonteTc,
  ItemColecao,
  MetaTce,
  MetaTcu,
  OrgaoTc,
  ParecerPrevioTce,
  RegistroOrgaos,
} from "./tipos";

/**
 * Leitura dos dados dos tribunais de contas em web/content/tribunais-contas (somente servidor /
 * build). Os arquivos são pequenos e lidos diretamente; os índices anuais de acórdãos (vários MB)
 * nunca são lidos pelas páginas: a busca usa public/tribunais-de-contas/<orgao>/acordaos-<ano>.json,
 * gerado por scripts/gerar-tribunais-contas.mjs. O rastreamento de arquivos exclui content/
 * (next.config.ts): as páginas são geradas no build.
 *
 * Tudo é organizado pelo id do órgão (tcu, tce-sp, tce-mg…): um tribunal novo aparece no site
 * assim que a coleta grava a pasta dele no mesmo formato.
 */
const ID = /^[a-z0-9-]{2,40}$/;
const KEY = /^ACORDAO-COMPLETO-\d{1,12}$/;

function base(...partes: string[]): string {
  return path.join(process.cwd(), "content", "tribunais-contas", ...partes);
}

function lerOpcional<T>(arquivo: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")) as T;
  } catch {
    return null;
  }
}

function listar(dir: string, re: RegExp): string[] {
  try {
    return fs.readdirSync(dir).filter((n) => re.test(n));
  } catch {
    return [];
  }
}

let cacheOrgaos: RegistroOrgaos | null = null;

export function getOrgaos(): RegistroOrgaos {
  if (!cacheOrgaos) cacheOrgaos = lerOpcional<RegistroOrgaos>(base("orgaos.json")) ?? { atualizado_em: null, itens: [] };
  return cacheOrgaos;
}

export function getOrgao(id: string): OrgaoTc | null {
  return getOrgaos().itens.find((o) => o.id === id) ?? null;
}

export function orgaoDisponivel(o: OrgaoTc): boolean {
  return o.situacao_coleta === "ativa";
}

/** Sigla exibida (TCU, TCE-SP, TC-DF, TCM-SP), formada pelo id oficial do registro. */
export function siglaOrgao(o: Pick<OrgaoTc, "id">): string {
  return o.id.toUpperCase();
}

export function getMetaTcu(orgao = "tcu"): MetaTcu | null {
  return ID.test(orgao) ? lerOpcional<MetaTcu>(base(orgao, "meta.json")) : null;
}

export function getMetaTce(orgao: string): MetaTce | null {
  return ID.test(orgao) ? lerOpcional<MetaTce>(base(orgao, "meta.json")) : null;
}

/* ---------- Contas do Presidente (TCU) ---------- */

export function temContasPresidente(orgao: string): boolean {
  return ID.test(orgao) && fs.existsSync(base(orgao, "contas-do-presidente.json"));
}

export interface ContasPresidente {
  atualizado_em: string | null;
  descricao: string | null;
  exercicios: ExercicioPresidente[];
}

export function getContasPresidente(orgao: string): ContasPresidente | null {
  if (!temContasPresidente(orgao)) return null;
  const d = lerOpcional<{ atualizado_em: string | null; descricao: string | null; exercicios: Omit<ExercicioPresidente, "curadoria">[] }>(
    base(orgao, "contas-do-presidente.json"),
  );
  if (!d) return null;
  const exercicios = d.exercicios
    .map((e) => {
      const c = /^\d{4}$/.test(e.exercicio) ? lerOpcional<CuradoriaPresidente>(base(orgao, "curadoria", `contas-presidente-${e.exercicio}.json`)) : null;
      // A curadoria só vale para o mesmo acórdão registrado no exercício.
      const curadoria = c && e.acordao && c.acordao_key === e.acordao.id ? c : null;
      return { ...e, curadoria };
    })
    .sort((a, b) => b.exercicio.localeCompare(a.exercicio));
  return { atualizado_em: d.atualizado_em, descricao: d.descricao, exercicios };
}

/* ---------- Acórdãos (coleções com página própria) ---------- */

export function temAcordaos(orgao: string): boolean {
  return ID.test(orgao) && listar(base(orgao, "acordaos"), /^indice-\d{4}\.json$/).length > 0;
}

/** Anos com índice de busca, do mais recente para o mais antigo. */
export function anosAcordaos(orgao: string): number[] {
  if (!ID.test(orgao)) return [];
  return listar(base(orgao, "acordaos"), /^indice-\d{4}\.json$/)
    .map((n) => Number(n.slice(7, 11)))
    .sort((a, b) => b - a);
}

export interface ColecaoTcu {
  id: string;
  titulo: string;
  itens: ItemColecao[];
}

export function colecoesAcordaos(orgao: string): ColecaoTcu[] {
  const m = getMetaTcu(orgao);
  return Object.entries(m?.colecoes ?? {}).map(([id, c]) => ({
    id,
    titulo: c.titulo,
    itens: [...c.itens].sort((a, b) => (b.data_julgamento ?? "").localeCompare(a.data_julgamento ?? "")),
  }));
}

/** KEYs com página própria (as das coleções). */
export function keysComPagina(orgao: string): string[] {
  return [...new Set(colecoesAcordaos(orgao).flatMap((c) => c.itens.map((i) => i.id)))].filter((k) => KEY.test(k));
}

export function getAcordao(orgao: string, key: string): AcordaoTcu | null {
  if (!ID.test(orgao) || !KEY.test(key) || !keysComPagina(orgao).includes(key)) return null;
  const a = lerOpcional<AcordaoTcu>(base(orgao, "acordaos", `${key}.json`));
  return a && a.id === key ? a : null;
}

/* ---------- Contas do Governador (TCE) ---------- */

export function temContasGovernador(orgao: string): boolean {
  return ID.test(orgao) && listar(base(orgao, "contas-governador"), /^\d{4}\.json$/).length > 0;
}

export function getContasGovernador(orgao: string): ParecerPrevioTce[] {
  if (!ID.test(orgao)) return [];
  return listar(base(orgao, "contas-governador"), /^\d{4}\.json$/)
    .sort()
    .reverse()
    .map((n) => lerOpcional<ParecerPrevioTce>(base(orgao, "contas-governador", n)))
    .filter((x): x is ParecerPrevioTce => !!x?.parecer);
}

/* ---------- Contas dos Prefeitos (TCE / TCM) ---------- */

export function municipiosComContas(orgao: string): { id: string; nome: string }[] {
  if (!ID.test(orgao)) return [];
  return listar(base(orgao, "contas-prefeitos"), /^[a-z0-9-]+\.json$/)
    .map((n) => {
      const d = lerOpcional<ContasPrefeitos>(base(orgao, "contas-prefeitos", n));
      return d ? { id: n.slice(0, -5), nome: d.municipio?.nome ?? n.slice(0, -5) } : null;
    })
    .filter((x): x is { id: string; nome: string } => !!x)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function getContasPrefeitos(orgao: string, municipio: string): ContasPrefeitos | null {
  if (!ID.test(orgao) || !ID.test(municipio)) return null;
  const d = lerOpcional<ContasPrefeitos>(base(orgao, "contas-prefeitos", `${municipio}.json`));
  if (!d?.itens) return null;
  return { ...d, itens: [...d.itens].sort((a, b) => b.parecer.exercicio.localeCompare(a.parecer.exercicio)) };
}

/** Parâmetros gerados no build; com cacheComponents a lista não pode ser vazia (o marcador vira 404). */
export function ouMarcador<T extends Record<string, string>>(lista: T[], marcador: T): T[] {
  return lista.length ? lista : [marcador];
}

export interface ResumoAcordaos {
  anos: { ano: number; total: number; sem_sumario_por_privacidade: number }[];
  lacunas: string[];
  fontes: FonteTc[];
}

/** Resumo dos índices de acórdãos gravado no build por scripts/gerar-tribunais-contas.mjs. */
export function getResumoAcordaos(orgao: string): ResumoAcordaos | null {
  if (!ID.test(orgao)) return null;
  return lerOpcional<ResumoAcordaos>(path.join(process.cwd(), "content", "_gerado", `tc-${orgao}-acordaos.json`));
}

let cacheTitulos: ArquivoTitulos | null | undefined;

/**
 * Títulos em linguagem simples da seção (dados/titulos/tribunais-contas.json; contrato em
 * dados/esquema.json → titulo_simples). Procura em content/titulos e, no build local, em
 * ../dados/titulos. Sem o arquivo, vale o título oficial.
 */
export function getTitulosTc(): ArquivoTitulos | null {
  if (!TITULOS_SIMPLES_ATIVOS) return null;
  if (cacheTitulos !== undefined) return cacheTitulos;
  const lido =
    lerOpcional<ArquivoTitulos>(path.join(process.cwd(), "content", "titulos", "tribunais-contas.json")) ??
    lerOpcional<ArquivoTitulos>(path.join(process.cwd(), "..", "dados", "titulos", "tribunais-contas.json"));
  cacheTitulos = lido?.itens && typeof lido.itens === "object" ? lido : null;
  return cacheTitulos;
}

/** Título simples do primeiro identificador encontrado (ex.: KEY do acórdão, id do parecer). */
export function tituloSimplesTc(...ids: (string | null | undefined)[]): TituloSimples | null {
  const t = getTitulosTc();
  for (const id of ids) if (id && t?.itens[id]) return t.itens[id];
  return null;
}
