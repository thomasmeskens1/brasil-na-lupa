/**
 * Apresentação dos julgamentos do STJ e do STF no Cartão de Decisão (funções puras, seguras no
 * navegador). Títulos de reserva são trechos literais encurtados (tese, certidão, ementa);
 * o resultado "por unanimidade/por maioria" só aparece copiado do texto oficial.
 */
import type { DadoChave } from "@/components/decisao";
import { encurtar } from "@/features/executivo/apresentacao";
import type { JulgamentoStf, SessaoStj, TemaStf, TemaStj } from "./tipos";
import { rotuloOrgao } from "./rotulos";

export { encurtar, simplesLista, simplesUtil } from "@/features/executivo/apresentacao";

export const CLASSE_STF: Record<string, string> = {
  ADI: "Ação Direta de Inconstitucionalidade (ADI)",
  ADC: "Ação Declaratória de Constitucionalidade (ADC)",
  ADO: "Ação Direta de Inconstitucionalidade por Omissão (ADO)",
  ADPF: "Arguição de Descumprimento de Preceito Fundamental (ADPF)",
  RE: "Recurso Extraordinário (RE)",
  ARE: "Recurso Extraordinário com Agravo (ARE)",
};

/** "RE 1490708" → "Recurso Extraordinário (RE) 1490708"; sem nome conhecido, como na fonte. */
export function processoPorExtenso(ident: string | null | undefined): string | null {
  if (!ident) return null;
  const m = /^([A-Z]{2,4})\s+(.+)$/.exec(ident.trim());
  return m && CLASSE_STF[m[1]] ? `${CLASSE_STF[m[1]]} ${m[2]}` : ident;
}

/** "Tema Repetitivo 1265 · Primeira Seção do Superior Tribunal de Justiça (STJ)". */
export function nomeTemaStj(t: Pick<TemaStj, "tipo_precedente" | "numero" | "orgao">): string {
  return `${t.tipo_precedente ?? "Tema"} ${t.numero} · ${t.orgao ? `${rotuloOrgao(t.orgao)} do ` : ""}Superior Tribunal de Justiça (STJ)`;
}

export function nomeTemaStf(t: Pick<TemaStf, "numero" | "leading_case">): string {
  const lc = processoPorExtenso(t.leading_case?.identificacao);
  return `Tema ${t.numero} de repercussão geral · Supremo Tribunal Federal (STF)${lc ? ` · processo paradigma: ${lc}` : ""}`;
}

/** Trecho literal do resultado do mérito ("por maioria, …"), escolhendo o que fala da tese. */
export function resultadoMeritoStj(sessoes: SessaoStj[] | null | undefined): { expressao: string; trecho: string; data: string | null } | null {
  const merito = (sessoes ?? []).filter((s) => s.etapa === "merito" && (s.resultado_trechos ?? []).length);
  const s = merito[0];
  if (!s) return null;
  const tr = s.resultado_trechos!.find((x) => /tese/i.test(x.trecho)) ?? s.resultado_trechos![0];
  return { ...tr, data: s.data };
}

/** Dado-chave do cartão do tema do STJ: resultado literal do mérito ou, sem ele, a situação. */
export function dadoTemaStj(t: TemaStj): DadoChave | null {
  const r = resultadoMeritoStj(t.julgamento?.sessoes);
  if (r) return { tipo: "texto", rotulo: "Resultado do julgamento do mérito (texto oficial)", texto: `“${encurtar(r.trecho, 160)}”` };
  return t.situacao ? { tipo: "texto", rotulo: "Situação", texto: t.situacao } : null;
}

export function tituloReservaStj(t: Pick<TemaStj, "tese" | "questao" | "numero">): string {
  return encurtar(t.tese, 140) ?? encurtar(t.questao, 140) ?? `Tema ${t.numero} do Superior Tribunal de Justiça`;
}

export function tituloReservaStf(t: Pick<TemaStf, "tese" | "titulo" | "descricao" | "numero">): string {
  return encurtar(t.tese, 140) ?? encurtar(t.titulo, 140) ?? encurtar(t.descricao, 140) ?? `Tema ${t.numero} do Supremo Tribunal Federal`;
}

/** Tira o rótulo "Decisão:"/"Ementa:" do começo do texto oficial (o resto fica literal). */
export function semRotulo(t: string | null | undefined): string | null {
  return t ? t.replace(/^\s*(?:decis[ãa]o|ementa)\s*[:.]?\s*/i, "").trim() || null : null;
}

export function tituloReservaJulgamentoStf(j: { certidao?: string | null; ementa?: string | null; identificacao?: string | null }): string {
  return encurtar(semRotulo(j.certidao), 140) ?? encurtar(semRotulo(j.ementa), 140) ?? j.identificacao ?? "Julgamento do Supremo Tribunal Federal";
}

/** Trecho literal do mérito na certidão (ou o último trecho da certidão). */
export function resultadoCertidao(j: JulgamentoStf): string | null {
  const cert = (j.votacoes ?? []).filter((v) => v.origem !== "plenario-virtual" && v.trecho);
  return (cert.find((v) => /m[ée]rito/i.test(String(v.parte ?? ""))) ?? cert[cert.length - 1])?.trecho ?? null;
}

export function dadoResultadoStf(trecho: string | null | undefined, max = 220): DadoChave | null {
  return trecho ? { tipo: "texto", rotulo: "Resultado, como escrito na certidão de julgamento", texto: `“${encurtar(trecho, max)}”` } : null;
}

export const QUEM_STJ = (orgao: string | null | undefined, relator?: string | null) =>
  `${orgao ? rotuloOrgao(orgao) : "Órgão colegiado"} do Superior Tribunal de Justiça${relator ? ` · relator: ${relator}` : ""}`;

export const QUEM_STF = (orgao: string | null | undefined, relator?: string | null) =>
  `${orgao ? rotuloOrgao(orgao) : "Plenário"} do Supremo Tribunal Federal${relator ? ` · relator: ${relator}` : ""}`;
