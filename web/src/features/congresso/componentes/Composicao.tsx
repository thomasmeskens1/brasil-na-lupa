"use client";

/**
 * Composição das casas "hoje" (lista oficial de em exercício): barras horizontais numa única cor
 * neutra, ordenadas pelo tamanho da bancada (empate: ordem alfabética). Filtro por estado (UF),
 * que vale para a contagem por partido, e por partido, que vale para a contagem por estado.
 * A cor nunca é a única pista: o número aparece em texto em cada barra.
 */
import { useState } from "react";
import { FiltrosCompactos } from "@/components/tabela/FiltrosCompactos";

export interface DadosComposicao {
  titulo: string;
  membros: { singular: string; plural: string };
  /** [partido, UF] de cada parlamentar em exercício. */
  itens: [string, string][];
}

function contar(chaves: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const k of chaves) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
}

function Barras({ titulo, linhas, unidade }: { titulo: string; linhas: [string, number][]; unidade: { singular: string; plural: string } }) {
  const max = Math.max(1, ...linhas.map(([, n]) => n));
  return (
    <section className="min-w-0">
      <h3 className="font-semibold text-foreground">{titulo}</h3>
      {linhas.length ? (
        <ol className="mt-2 space-y-1.5">
          {linhas.map(([rotulo, n]) => (
            <li key={rotulo} className="grid grid-cols-[minmax(4.5rem,8rem)_1fr] items-center gap-2">
              <span className="truncate font-medium" title={rotulo}>
                {rotulo}
              </span>
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="block h-4 rounded-sm" style={{ width: `${(n / max) * 100}%`, minWidth: 4, background: "var(--cor-placar-2)" }} />
                <span className="shrink-0 tabular-nums">
                  {n}
                  <span className="sr-only"> {n === 1 ? unidade.singular : unidade.plural}</span>
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="lacuna mt-2 text-sm">Nenhum parlamentar com esse filtro.</p>
      )}
    </section>
  );
}

export function Composicao({ dados }: { dados: DadosComposicao }) {
  const [uf, setUf] = useState("");
  const [partido, setPartido] = useState("");
  const ufs = [...new Set(dados.itens.map(([, u]) => u))].sort();
  const partidos = [...new Set(dados.itens.map(([p]) => p))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const porPartido = contar(dados.itens.filter(([, u]) => !uf || u === uf).map(([p]) => p));
  const porEstado = contar(dados.itens.filter(([p]) => !partido || p === partido).map(([, u]) => u));
  const total = dados.itens.length;
  return (
    <div className="space-y-4">
      <FiltrosCompactos
        filtros={[
          { id: "uf", rotulo: "Estado (UF) — muda a contagem por partido", valor: uf, aoMudar: setUf, opcoes: ufs },
          { id: "partido", rotulo: "Partido — muda a contagem por estado", valor: partido, aoMudar: setPartido, opcoes: partidos },
        ]}
        contagem={`${total} ${dados.membros.plural} em exercício`}
        aoLimpar={() => {
          setUf("");
          setPartido("");
        }}
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Barras titulo={`Por partido${uf ? ` — ${uf}` : ""} (${porPartido.length})`} linhas={porPartido} unidade={dados.membros} />
        <Barras titulo={`Por estado${partido ? ` — ${partido}` : ""} (${porEstado.length})`} linhas={porEstado} unidade={dados.membros} />
      </div>
    </div>
  );
}
