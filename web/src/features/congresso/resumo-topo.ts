/**
 * Dados do resumo no topo do perfil do parlamentar (somente servidor / build): salário (subsídio),
 * patrimônio declarado ao TSE e propostas apresentadas. Só copia números oficiais; nada de nota,
 * ranking ou comparação. Presença e cota vêm de resumo-parlamentar.ts.
 */
import fs from "node:fs";
import path from "node:path";
import type { FonteResumo } from "@/components/decisao/tipos";
import type { Casa } from "./tipos";

function ler<T>(...partes: string[]): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", ...partes), "utf8")) as T;
  } catch {
    return null;
  }
}
const cache = new Map<string, unknown>();
function lerCache<T>(...partes: string[]): T | null {
  const k = partes.join("/");
  if (!cache.has(k)) cache.set(k, ler<T>(...partes));
  return cache.get(k) as T | null;
}

/* ---------------- Salário (subsídio) ---------------- */

/**
 * Subsídio mensal dos membros do Congresso Nacional: o mesmo valor para todos os deputados
 * federais e senadores (Decreto Legislativo nº 172/2022, art. 1º). Conferido no texto oficial
 * publicado pela Câmara dos Deputados (Legislação Informatizada) em 07/11/2026.
 */
export const SUBSIDIO = {
  valor: 46366.19,
  desde: "2025-02-01",
  ato: "Decreto Legislativo nº 172, de 21 de dezembro de 2022",
  publicacao: "Diário Oficial da União, Seção 1, 26/12/2022, p. 1 (republicação)",
  escalonamento: [
    { desde: "2023-01-01", valor: 39293.32 },
    { desde: "2023-04-01", valor: 41650.92 },
    { desde: "2024-02-01", valor: 44008.52 },
    { desde: "2025-02-01", valor: 46366.19 },
  ],
  fonte: {
    url: "https://www2.camara.leg.br/legin/fed/decleg/2022/decretolegislativo-172-21-dezembro-2022-793529-republicacao-166629-pl.html",
    titulo: "Decreto Legislativo nº 172/2022 (texto oficial)",
    orgao: "Câmara dos Deputados",
    acessado_em: "2026-11-07",
  } satisfies FonteResumo,
};

/* ---------------- Patrimônio declarado (TSE) ---------------- */

export interface PatrimonioItem {
  eleicao: number;
  cargo: string;
  uf: string;
  sq_candidato: string;
  situacao_na_eleicao: string | null;
  total: number;
  quantidade_bens: number;
  bens: [string, number][];
  ultima_atualizacao_tse: string | null;
}

interface PatrimonioArquivo {
  atualizado_em: string;
  aviso: string;
  criterio_vinculo: string;
  fontes: { titulo: string; url: string; orgao: string; acessado_em: string }[];
  sem_vinculo: { id: string; motivo: string }[];
  itens: Record<string, PatrimonioItem>;
}

export interface Patrimonio {
  item: PatrimonioItem | null;
  /** Motivo oficial da falta de vínculo (ou null quando o arquivo não existe). */
  motivo: string | null;
  aviso: string | null;
  criterio: string | null;
  fonte: FonteResumo | null;
}

export function patrimonioDe(casa: Casa, id: string): Patrimonio {
  const a = lerCache<PatrimonioArquivo>("patrimonio", `${casa}.json`);
  if (!a) return { item: null, motivo: null, aviso: null, criterio: null, fonte: null };
  const item = a.itens[id] ?? null;
  const ano = item?.eleicao ?? 2022;
  const f = a.fontes.find((x) => x.titulo.startsWith(`Bens de candidatos ${ano}`)) ?? a.fontes[0];
  return {
    item,
    motivo: item ? null : a.sem_vinculo.find((s) => s.id === id)?.motivo ?? "não consta da lista de em exercício usada na coleta",
    aviso: a.aviso,
    criterio: a.criterio_vinculo,
    fonte: f ? { url: f.url, titulo: f.titulo, orgao: "TSE", acessado_em: f.acessado_em } : null,
  };
}

/* ---------------- Propostas apresentadas ---------------- */

export interface ContagemPropostas {
  total: number;
  primeiro_signatario?: number;
  por_tipo: Record<string, number>;
}

interface ApresentadasArquivo {
  atualizado_em: string;
  periodo: { inicio: string; fim: string };
  tipos: { sigla: string; nome: string }[];
  criterio: string;
  fontes: { titulo: string; url: string; orgao: string; acessado_em: string }[];
  consultados?: string[];
  parlamentares: Record<string, ContagemPropostas>;
}

interface AprovadasArquivo {
  criterio: string;
  consultados?: string[];
  autores: Record<string, [string, number | null][]>;
  proposicoes: Record<string, { identificacao: string | null; ementa: string | null; url: string; data_apresentacao: string | null }>;
}

export interface Propostas {
  disponivel: boolean;
  contagem: ContagemPropostas | null;
  tipos: { sigla: string; nome: string }[];
  periodo: { inicio: string; fim: string } | null;
  criterio: string | null;
  fonte: FonteResumo | null;
  /** Proposições de autoria transformadas em norma (lista do coletor de autoria). */
  viraramNorma: { id: string; identificacao: string | null; ementa: string | null; url: string; ordem: number | null }[];
  criterioNorma: string | null;
}

export function propostasDe(casa: Casa, id: string): Propostas {
  const a = lerCache<ApresentadasArquivo>("autoria", casa, "apresentadas.json");
  const ap = lerCache<AprovadasArquivo>("autoria", casa, "aprovadas.json");
  const consultado = a ? (a.consultados ? a.consultados.includes(id) : true) : false;
  const contagem = a?.parlamentares[id] ?? (consultado ? { total: 0, primeiro_signatario: casa === "camara" ? 0 : undefined, por_tipo: {} } : null);
  const f = a?.fontes[casa === "camara" ? a.fontes.length - 1 : 0];
  const viraramNorma = (ap?.autores[id] ?? []).flatMap(([pid, ordem]) => {
    const p = ap?.proposicoes[pid];
    return p ? [{ id: pid, identificacao: p.identificacao, ementa: p.ementa, url: p.url, ordem }] : [];
  });
  return {
    disponivel: !!contagem,
    contagem,
    tipos: a?.tipos ?? [],
    periodo: a?.periodo ?? null,
    criterio: a?.criterio ?? null,
    fonte: f
      ? {
          url: casa === "camara" ? "https://dadosabertos.camara.leg.br/swagger/api.html#staticfile" : f.url.replace("{código}", encodeURIComponent(id)),
          titulo: casa === "camara" ? "Arquivos de proposições e autores" : "Processos legislativos por autor",
          orgao: casa === "camara" ? "Câmara dos Deputados" : "Senado Federal",
          acessado_em: f.acessado_em,
        }
      : null,
    viraramNorma,
    criterioNorma: ap?.criterio ?? null,
  };
}
