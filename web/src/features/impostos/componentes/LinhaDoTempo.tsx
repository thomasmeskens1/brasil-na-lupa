/**
 * Linha do tempo da Reforma Tributária do consumo. É uma lista ordenada com texto (o traço e os
 * pontos são só decoração), e o ano em curso é marcado com aria-current. Cada item leva a
 * fonte oficial (diretriz 2).
 */
import { DATA_CONSULTA } from "../fontes";
import { LINHA_DO_TEMPO } from "../dados";
import { LinkFonte } from "./LinkFonte";

export function LinhaDoTempo() {
  const anoAtual = DATA_CONSULTA.slice(0, 4);
  return (
    <ol className="relative ml-3 space-y-6 border-l-2 border-[var(--cor-borda-forte)] pl-6">
      {LINHA_DO_TEMPO.map((m) => {
        const atual = m.quando === anoAtual;
        return (
          <li key={m.quando} className="revelar relative" aria-current={atual ? "step" : undefined}>
            <span
              aria-hidden="true"
              className={`absolute -left-[2.0625rem] top-1 block h-4 w-4 rounded-full border-2 ${
                atual ? "border-[var(--cor-acento)] bg-[var(--cor-acento)]" : "border-[var(--cor-borda-forte)] bg-superficie"
              }`}
            />
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-gray-900">
              <span className={atual ? "selo selo-escuro text-base" : "selo text-base"}>{m.quando}</span>
              <span>{m.titulo}</span>
              {atual ? <span className="text-sm font-semibold text-[var(--cor-acento)]">(ano atual)</span> : null}
            </h3>
            <ul className="mt-2 space-y-2">
              {m.itens.map((it) => (
                <li key={it.texto} className="leading-relaxed text-gray-800">
                  {it.texto}{" "}
                  <span className="block">
                    <LinkFonte chave={it.fonte} curto />
                  </span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
