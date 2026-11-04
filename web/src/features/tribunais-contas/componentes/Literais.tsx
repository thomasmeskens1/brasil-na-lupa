import type { ItemLiteral, RegistroRelator } from "../tipos";
import { FonteLink } from "@/components/FonteLink";
import { NomeProprio, TextoComSiglas } from "@/components/glossario";
import { ListaRecolhivel } from "@/components/lista/ListaRecolhivel";

/**
 * Lista literal (ressalvas, alertas, recomendações, determinações) com contador e "Mostrar mais"
 * (ListaRecolhivel): os primeiros itens aparecem, os demais a um toque. Os grupos e números são
 * os do documento oficial, na ordem publicada; o título do grupo aparece no primeiro item dele.
 */
export function ListaLiteral({
  itens,
  um,
  varios,
  explicacao,
  inicial = 5,
}: {
  itens: (ItemLiteral | string)[];
  um: string;
  varios: string;
  explicacao?: string;
  inicial?: number;
}) {
  if (!itens.length) return null;
  const lista: ItemLiteral[] = itens.map((i) => (typeof i === "string" ? { texto: i } : i));
  return (
    <section className="space-y-2">
      <h4 className="text-base font-semibold text-gray-900">
        {lista.length === 1 ? `1 ${um}` : `${lista.length} ${varios}`}
        <span className="font-normal text-[var(--cor-secundaria)]"> — texto oficial</span>
      </h4>
      {explicacao ? <p className="text-base text-[var(--cor-secundaria)]">{explicacao}</p> : null}
      <ListaRecolhivel
        rotulo={{ singular: um, plural: varios }}
        inicial={inicial}
        className="space-y-2"
        itens={lista.map((i, n) => {
          const nivel = i.numero ? Math.min(i.numero.split(".").length - 1, 3) : 0;
          const novoGrupo = i.grupo && i.grupo !== lista[n - 1]?.grupo;
          return (
            <div key={n}>
              {novoGrupo ? <p className="mb-1 mt-3 text-base font-semibold text-gray-900">{i.grupo}</p> : null}
              <p className="flex gap-2 text-base leading-relaxed text-gray-900" style={nivel ? { paddingLeft: `${nivel * 0.75}rem` } : undefined}>
                {i.numero ? <span className="shrink-0 font-semibold tabular-nums text-[var(--cor-secundaria)]">{i.numero}</span> : null}
                <span className="min-w-0">
                  <TextoComSiglas>{i.texto}</TextoComSiglas>
                </span>
              </p>
            </div>
          );
        })}
      />
    </section>
  );
}

/**
 * Como cada documento oficial registra o relator, lado a lado. Quando a coleta registra que as
 * fontes divergem, um aviso neutro explica que os registros são mostrados sem correção.
 */
export function RegistrosRelator({ registros, divergem }: { registros: RegistroRelator[]; divergem: boolean }) {
  if (!registros.length) return null;
  return (
    <div>
      {divergem ? (
        <p className="aviso text-base">
          Os documentos oficiais registram o relator de formas diferentes. Os registros aparecem abaixo exatamente como
          publicados, sem correção.
        </p>
      ) : null}
      <ul className={`mt-3 grid grid-cols-1 gap-3 ${registros.length > 2 ? "lg:grid-cols-3" : ""} ${registros.length > 1 ? "md:grid-cols-2" : ""}`}>
        {registros.map((r, k) => (
          <li key={k} className="cartao text-base">
            <p className="font-semibold text-gray-900">
              <NomeProprio>{r.texto}</NomeProprio>
            </p>
            <p className="mt-1 text-[var(--cor-secundaria)]">
              Segundo:{" "}
              {r.url ? (
                <FonteLink href={r.url} tipo={/\.pdf($|\?)/i.test(r.url) ? "pdf" : "oficial"} className="text-base!">
                  {r.documento}
                </FonteLink>
              ) : (
                r.documento
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
