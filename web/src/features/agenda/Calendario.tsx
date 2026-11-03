"use client";

/**
 * Calendário mensal do Plenário: em cada dia, o número de votações registradas (Câmara e Senado)
 * e um contorno quando há sessão marcada (agendada). Os meses vêm prontos do servidor; os botões
 * só trocam o mês exibido. Funciona como tabela (leitor de tela lê dia, votações e sessões).
 */
import { useState } from "react";
import type { DiaAgenda } from "./dados";

export interface CalendarioProps {
  /** Meses disponíveis, "AAAA-MM", em ordem. */
  meses: string[];
  /** Mês aberto de início. */
  inicial: string;
  dias: Record<string, DiaAgenda>;
  /** Data de referência (hoje no momento da coleta), AAAA-MM-DD. */
  hoje: string;
}

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = [
  ["D", "domingo"],
  ["S", "segunda-feira"],
  ["T", "terça-feira"],
  ["Q", "quarta-feira"],
  ["Q", "quinta-feira"],
  ["S", "sexta-feira"],
  ["S", "sábado"],
];

function semanasDoMes(mes: string): (string | null)[][] {
  const [a, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const celulas: (string | null)[] = Array.from({ length: primeiro }, () => null);
  for (let d = 1; d <= total; d++) celulas.push(`${mes}-${String(d).padStart(2, "0")}`);
  while (celulas.length % 7) celulas.push(null);
  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

function rotuloMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return `${NOMES_MES[m - 1]} de ${a}`;
}

export function Calendario({ meses, inicial, dias, hoje }: CalendarioProps) {
  const [i, setI] = useState(Math.max(0, meses.indexOf(inicial)));
  const mes = meses[i];
  if (!mes) return null;
  const semanas = semanasDoMes(mes);
  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="botao" onClick={() => setI((v) => v - 1)} disabled={i === 0} aria-label="Mês anterior">
          <span aria-hidden="true">‹</span>
        </button>
        <p className="text-lg font-semibold capitalize" aria-live="polite">
          {rotuloMes(mes)}
        </p>
        <button type="button" className="botao" onClick={() => setI((v) => v + 1)} disabled={i === meses.length - 1} aria-label="Próximo mês">
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <table className="mt-3 w-full table-fixed border-collapse text-center">
        <caption className="sr-only">
          Calendário de {rotuloMes(mes)}: número de votações registradas em cada dia; contorno indica sessão marcada.
        </caption>
        <thead>
          <tr>
            {SEMANA.map(([c, n]) => (
              <th key={n} scope="col" className="py-1 text-sm font-semibold text-[var(--cor-secundaria)]">
                <abbr title={n} className="no-underline">
                  {c}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanas.map((s, k) => (
            <tr key={k}>
              {s.map((d, j) => {
                if (!d) return <td key={j} />;
                const info = dias[d];
                const n = info?.total ?? 0;
                const marcada = !!info?.marcada;
                const partes = [
                  n ? `${n} ${n === 1 ? "votação" : "votações"}` : "nenhuma votação registrada",
                  info?.sessoes ? `${info.sessoes} ${info.sessoes === 1 ? "sessão" : "sessões"}` : "sem sessão na agenda",
                  marcada ? "sessão marcada" : null,
                  d === hoje ? "data da coleta" : null,
                ].filter(Boolean);
                return (
                  <td key={j} className="p-0.5">
                    <div
                      className={`flex min-h-11 flex-col items-center justify-center rounded border ${
                        marcada ? "border-2 border-[var(--cor-acento)]" : info?.sessoes ? "border-[var(--cor-borda)]" : "border-transparent"
                      } ${n ? "bg-[var(--cor-acento-fundo)]" : ""} ${d === hoje ? "underline decoration-2 underline-offset-4" : ""}`}
                    >
                      <span className="text-sm">{Number(d.slice(8))}</span>
                      {n ? (
                        <span className="text-xs font-bold leading-none" aria-hidden="true">
                          {n}
                        </span>
                      ) : null}
                      <span className="sr-only">: {partes.join(", ")}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="meta mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <li>
          <span className="mr-1 inline-block rounded bg-[var(--cor-acento-fundo)] px-1 font-bold" aria-hidden="true">
            3
          </span>
          número de votações registradas no dia
        </li>
        <li>
          <span className="mr-1 inline-block h-4 w-5 rounded border-2 border-[var(--cor-acento)] align-middle" aria-hidden="true" />
          sessão marcada
        </li>
        <li>
          <span className="mr-1 underline decoration-2 underline-offset-4" aria-hidden="true">
            2
          </span>
          data da coleta
        </li>
      </ul>
    </div>
  );
}
