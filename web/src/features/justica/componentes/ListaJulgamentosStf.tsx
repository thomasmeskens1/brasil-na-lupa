import Link from "next/link";
import { formatarData } from "@/features/congresso/rotulos";
import type { ResumoJulgamentoStf } from "../tipos";
import { rotuloEtapa, rotuloResultadoJulgamento } from "../rotulos";

/** Lista de julgamentos do STF (mais recentes primeiro), com o resultado literal por parte. */
export function ListaJulgamentosStf({ itens, nivel = 3 }: { itens: ResumoJulgamentoStf[]; nivel?: 3 | 4 }) {
  const H = `h${nivel}` as "h3" | "h4";
  const ordenados = [...itens].sort((a, b) => (b.data_julgamento ?? "").localeCompare(a.data_julgamento ?? ""));
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {ordenados.map((j) => (
        <li key={j.id} className="cartao">
          <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-gray-900">{formatarData(j.data_julgamento)}</span>
            <span className="selo">{j.ambiente === "virtual" ? "Plenário Virtual" : j.ambiente === "presencial" ? "Sessão presencial" : "Sessão não informada"}</span>
            {j.tema ? <span>Tema {j.tema} de repercussão geral</span> : null}
          </p>
          <H className="mt-2 text-base font-semibold">
            <Link href={`/justica/stf/julgamentos/${j.id}`} prefetch={false} className="lk">
              {j.identificacao ?? j.id}
            </Link>
          </H>
          {j.relator ? <p className="meta mt-1">Relator: {j.relator}</p> : null}
          <ul className="mt-1 space-y-0.5 text-sm text-gray-800">
            {(j.resultados ?? []).map((r, i) => (
              <li key={i}>
                {rotuloEtapa(r.parte ?? null)}: {rotuloResultadoJulgamento(r.resultado) ?? "resultado não informado"}
                {r.vencidos?.length ? ` (vencidos: ${[...r.vencidos].sort((a, b) => a.localeCompare(b, "pt-BR")).join(", ")})` : ""}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
