import type { FonteResumo } from "@/components/decisao";
import { lerInicio } from "@/features/inicio/dados";

/** Agenda do Plenário gerada por scripts/gerar-inicio.mjs (content/inicio/agenda.json). */

export type CasaAgenda = "camara" | "senado" | "congresso";

export interface SessaoAgenda {
  id: string;
  casa: CasaAgenda;
  casa_nome: string;
  data: string;
  hora: string | null;
  tipo: string | null;
  tipo_oficial: string | null;
  descricao_oficial: string | null;
  situacao: string | null;
  situacao_oficial: string | null;
  link_oficial: string | null;
  fonte: FonteResumo | null;
  votacoes_no_dia: number | null;
  itens_pauta: number;
}

export interface ItemPauta {
  ordem: number | null;
  titulo: string | null;
  ementa: string | null;
  url: string | null;
  relatores: string[];
  desfecho: string;
  desfecho_texto_oficial: string | null;
  votacoes: { casa: "camara" | "senado"; id: string }[];
  fonte: FonteResumo | null;
}

export interface DiaAgenda {
  votacoes: Partial<Record<CasaAgenda, number>>;
  total: number;
  marcada: boolean;
  sessoes: number;
}

export interface ArquivoAgenda {
  atualizado_em: string | null;
  periodo: { inicio: string; fim: string; referencia?: string; regra?: string } | null;
  tempo_real: boolean;
  aviso: string | null;
  fontes: FonteResumo[];
  regra_votacoes: string | null;
  sessoes: SessaoAgenda[];
  dias: Record<string, DiaAgenda>;
  ultimas: Partial<Record<CasaAgenda, { sessao: SessaoAgenda; itens: ItemPauta[] }>>;
}

export function getAgenda(): ArquivoAgenda | null {
  return lerInicio<ArquivoAgenda>("agenda.json");
}

export const ORDEM_CASAS: CasaAgenda[] = ["camara", "senado", "congresso"];

export const NOME_CASA: Record<CasaAgenda, string> = {
  camara: "Câmara dos Deputados",
  senado: "Senado Federal",
  congresso: "Congresso Nacional (sessão conjunta)",
};

/** Sessões agendadas a partir da data de referência, em ordem cronológica. */
export function proximasSessoes(a: ArquivoAgenda): SessaoAgenda[] {
  const ref = a.periodo?.referencia ?? a.atualizado_em?.slice(0, 10) ?? "";
  return a.sessoes.filter((s) => s.situacao === "agendada" && s.data >= ref);
}
