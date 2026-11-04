/**
 * Nome próprio em CAIXA ALTA vindo da fonte oficial (ex.: "MINISTRO HERMAN BENJAMIN", nos dados do
 * STJ e do TCU). O texto visível fica exatamente como publicado; o leitor de tela e a leitura em
 * voz alta recebem a mesma frase em capitalização normal ("Ministro Herman Benjamin"), para não
 * soletrar as palavras. Siglas conhecidas (STJ, TCU…) e números romanos continuam em maiúsculas.
 * Texto que não está em caixa alta passa direto.
 *
 *   import { NomeProprio } from "@/components/glossario";
 *   <p>Relator: <NomeProprio>{a.relator}</NomeProprio></p>
 */
import { capitalizacaoNormal, emCaixaAlta } from "./marcarSiglas";

export function NomeProprio({ children }: { children?: string | null }) {
  const t = children ?? "";
  if (!emCaixaAlta(t)) return <>{t}</>;
  return (
    <>
      <span aria-hidden="true">{t}</span>
      {/* data-ler: a leitura em voz alta (components/ouvir/extrair.ts) lê este trecho .sr-only. */}
      <span className="sr-only" data-ler="">
        {capitalizacaoNormal(t)}
      </span>
    </>
  );
}
