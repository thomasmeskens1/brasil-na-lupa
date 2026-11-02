/**
 * Termo técnico com explicação em balão (diretriz 9; engajamento, seção 7). Sublinhado
 * pontilhado; tocar abre a definição, que vem dos glossários já existentes das seções.
 * Sem definição encontrada, mostra só o texto (nenhuma definição é inventada).
 *
 *   import { Termo } from "@/components/glossario";
 *   <p>O imposto é <Termo termo="Ad rem">ad rem</Termo>, cobrado por litro.</p>
 *   <Termo termo="CONFAZ" />                                  // texto = "CONFAZ"
 *   <Termo termo="Obstrução" definicao="…" />                  // definição própria (de fonte oficial)
 *   <Termo termo="Base de cálculo" glossario={glossarioIcms} /> // glossário lido de content/
 *
 * Primeira ocorrência na página: escreva o nome por extenso no texto; as seguintes podem usar
 * a sigla com <Termo>.
 */
import { BalaoTermo } from "./BalaoTermo";
import { definicaoDe, type EntradaGlossario } from "./glossarios";

export interface TermoProps {
  /** Termo procurado no glossário (ex.: "Obstrução", "CONFAZ"). */
  termo: string;
  /** Texto visível; padrão: o próprio termo. */
  children?: string;
  /** Definição explícita (pula a busca). */
  definicao?: string;
  /** Glossário extra, consultado antes do geral. */
  glossario?: readonly EntradaGlossario[];
}

export function Termo({ termo, children, definicao, glossario }: TermoProps) {
  const texto = children ?? termo;
  const e = definicao ? { termo, explicacao: definicao } : definicaoDe(termo, glossario);
  if (!e) return <>{texto}</>;
  return <BalaoTermo texto={texto} titulo={e.termo} definicao={e.explicacao} />;
}
