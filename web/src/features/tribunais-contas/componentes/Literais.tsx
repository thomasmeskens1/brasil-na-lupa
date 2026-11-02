import type { ItemLiteral, RegistroRelator } from "../tipos";
import { FonteLink } from "@/components/FonteLink";
import { Recolhivel } from "./Basicos";

/**
 * Lista literal (ressalvas, alertas, recomendações, determinações) com contador no resumo e
 * recolhida por padrão. Os grupos e números são os do documento oficial, na ordem publicada.
 */
export function ListaLiteral({
  itens,
  um,
  varios,
  explicacao,
  aberto = false,
}: {
  itens: (ItemLiteral | string)[];
  um: string;
  varios: string;
  explicacao?: string;
  aberto?: boolean;
}) {
  if (!itens.length) return null;
  const lista: ItemLiteral[] = itens.map((i) => (typeof i === "string" ? { texto: i } : i));
  const grupos: { grupo: string | null; itens: ItemLiteral[] }[] = [];
  for (const i of lista) {
    const g = i.grupo ?? null;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.grupo === g) ultimo.itens.push(i);
    else grupos.push({ grupo: g, itens: [i] });
  }
  return (
    <Recolhivel
      aberto={aberto}
      resumo={
        <span>
          <strong className="font-semibold">{lista.length === 1 ? `1 ${um}` : `${lista.length} ${varios}`}</strong>
          <span className="text-[#3e4c59]"> — texto oficial</span>
        </span>
      }
    >
      {explicacao ? <p className="mb-3 text-base text-[#3e4c59]">{explicacao}</p> : null}
      <div className="space-y-4">
        {grupos.map((g, k) => (
          <div key={k}>
            {g.grupo ? <h4 className="text-base font-semibold text-gray-900">{g.grupo}</h4> : null}
            <ol className="mt-2 space-y-2">
              {g.itens.map((i, n) => {
                const nivel = i.numero ? Math.min(i.numero.split(".").length - 1, 3) : 0;
                return (
                  <li key={n} className="flex gap-2 text-base leading-relaxed text-gray-900" style={nivel ? { paddingLeft: `${nivel * 0.75}rem` } : undefined}>
                    {i.numero ? <span className="shrink-0 font-semibold tabular-nums text-[#3e4c59]">{i.numero}</span> : null}
                    <span className="min-w-0">{i.texto}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </Recolhivel>
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
            <p className="font-semibold text-gray-900">{r.texto}</p>
            <p className="mt-1 text-[#3e4c59]">
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
