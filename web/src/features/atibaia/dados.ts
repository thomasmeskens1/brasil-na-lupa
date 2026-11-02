import fs from "node:fs";
import path from "node:path";

/**
 * Leitura dos dados de Atibaia em web/content/_gerado/atibaia.json (gerado por
 * scripts/gerar-atibaia.mjs; somente servidor / build). Das normas, só a ementa pública
 * (com nomes de particulares omitidos) chega até aqui.
 */
export interface FonteAtibaia {
  titulo: string;
  url: string;
  orgao?: string | null;
  acessado_em?: string | null;
}

export interface MesFinancas {
  mes: number;
  nome: string;
  com_dados: boolean;
  consultado_em: string | null;
  url_despesas: string | null;
  url_receitas: string | null;
  receita: number | null;
  despesa: Partial<Record<"empenhado" | "liquidado" | "pago" | "reforco" | "anulacao", number>>;
  nao_lidos: number;
  receita_por_orgao: [string, number][];
  receita_por_fonte: [string, number][];
  despesa_por_orgao: [string, Partial<Record<string, number>>][];
}

export interface AnoFinancas {
  ano: number;
  atualizado_em: string | null;
  fonte: FonteAtibaia | null;
  aviso_oficial: string | null;
  atualizacao_informada: { despesas: string | null; receitas: string | null; url: string } | null;
  ultimo_mes_com_dados: { mes: number; nome: string; verificado_em: string } | null;
  metodo: string | null;
  lacunas: string[];
  meses: MesFinancas[];
}

export interface NormaAtibaiaResumo {
  id: string;
  tipo: string;
  numero: string | null;
  data: string | null;
  ementa_publica: string;
  url: string | null;
  edicao: string | null;
  edicao_data: string | null;
  pagina: number | null;
}

export interface IndiceAtibaia {
  atualizado_em: string | null;
  fontes: FonteAtibaia[];
  vereadores: {
    atualizado_em: string | null;
    fonte: FonteAtibaia | null;
    criterio: string | null;
    sessao: { descricao: string; data: string; ausentes_registrados: string | null } | null;
    conferencia: { ata_anterior: string; url: string; mesma_lista: boolean } | null;
    itens: { id: string; nome: string; partido: string | null; cargo_na_mesa: string | null }[];
    mesa: { cargo: string; nome: string }[];
    lacunas: string[];
  } | null;
  normas: {
    total: number;
    por_ano_tipo: Record<string, number>;
    fonte: FonteAtibaia | null;
    atualizado_em: string | null;
    coberturas: { ano: number | null; primeira_edicao?: string; ultima_edicao?: string; observacao?: string }[];
    criterio: string | null;
    recentes: NormaAtibaiaResumo[];
  };
  financas: AnoFinancas[];
}

const VAZIO: IndiceAtibaia = {
  atualizado_em: null,
  fontes: [],
  vereadores: null,
  normas: { total: 0, por_ano_tipo: {}, fonte: null, atualizado_em: null, coberturas: [], criterio: null, recentes: [] },
  financas: [],
};

let cache: IndiceAtibaia | null = null;

export function getIndiceAtibaia(): IndiceAtibaia {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "_gerado", "atibaia.json"), "utf8")) as IndiceAtibaia;
  } catch {
    cache = VAZIO;
  }
  return cache;
}
