/**
 * Texto pronto e neutro para compartilhar (engajamento, seção 5.4), montado SÓ com campos do
 * documento oficial: título exibido, nome oficial, forma e data da decisão, dado-chave (placar
 * completo quando houver) e fonte. Nenhum dado do visitante, nenhum adjetivo, emoji ou hashtag.
 *
 *   montarTextoCompartilhar({
 *     titulo: "Câmara aprova texto do Senado que cria o Comitê Gestor do IBS",
 *     linhaOficial: "Projeto de Lei Complementar 108/2024",
 *     forma: "votacao-nominal", data: "2025-12-15",
 *     dado: { tipo: "placar", itens: placarOficial({ sim: 330, nao: 104, outros: 1 }) },
 *     fonte: { orgao: "Câmara dos Deputados" },
 *   })
 *   // "Placar do Poder: Câmara aprova … (Projeto de Lei Complementar 108/2024, votação nominal em
 *   //  15/12/2025). Placar oficial: Sim 330, Não 104, Outros 1. Fonte oficial: Câmara dos Deputados."
 *
 * O link NÃO entra no texto: o BotaoCompartilhar o envia à parte (Web Share) ou o acrescenta
 * no fim (WhatsApp), para não aparecer duplicado.
 */
import type { DadoChave, FonteResumo, FormaDecisao } from "../decisao/tipos";
import { FORMAS, dadoEmTexto, formatarData } from "../decisao/rotulos";

export const MARCA = "Placar do Poder";

/** Forma curta para o texto (sem a explicação longa). */
const FORMA_CURTA: Record<FormaDecisao, string> = {
  "votacao-nominal": "votação nominal",
  "votacao-simbolica": "votação simbólica",
  "votacao-secreta": "votação secreta",
  colegiado: "decisão de colegiado",
  "ato-individual": "ato individual",
  julgamento: "julgamento",
};

export interface DadosTextoCompartilhar {
  titulo: string;
  /** Nome oficial por extenso (ex.: "Convênio ICMS 127/2026"). */
  linhaOficial?: string | null;
  forma?: FormaDecisao | null;
  /** Data da decisão, AAAA-MM-DD. */
  data?: string | null;
  dado?: DadoChave | null;
  fonte?: Pick<FonteResumo, "orgao" | "titulo"> | null;
}

export function montarTextoCompartilhar(d: DadosTextoCompartilhar): string {
  const partes: string[] = [];
  const contexto = [
    d.linhaOficial?.trim(),
    d.forma ? `${FORMA_CURTA[d.forma]}${d.data ? ` em ${formatarData(d.data)}` : ""}` : d.data ? formatarData(d.data) : "",
  ].filter(Boolean);
  partes.push(`${MARCA}: ${d.titulo.trim().replace(/[.]$/, "")}${contexto.length ? ` (${contexto.join(", ")})` : ""}.`);
  const dado = dadoEmTexto(d.dado);
  if (dado) partes.push(dado);
  const fonte = d.fonte?.orgao || d.fonte?.titulo;
  if (fonte) partes.push(`Fonte oficial: ${fonte}.`);
  return partes.join(" ").replace(/\s{2,}/g, " ");
}

/** Mantida para quem precisa da forma longa (ex.: alt de imagem). */
export function formaPorExtenso(f: FormaDecisao): string {
  return FORMAS[f];
}
