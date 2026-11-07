"use client";

/**
 * Calendário mensal do Plenário: em cada dia, o número de votações registradas (Câmara e Senado)
 * e um contorno quando há sessão marcada (agendada). Os meses vêm prontos do servidor; os botões
 * só trocam os meses exibidos. Funciona como tabela (leitor de tela lê dia, votações e sessões).
 *
 * No celular aparece um mês por vez e as setas andam de 1 em 1 (mais fácil de seguir numa tela
 * estreita). Da largura lg em diante aparecem dois meses lado a lado (o aberto e o seguinte) e as
 * setas andam de 2 em 2. Os dois conjuntos de setas existem no HTML; o CSS mostra só o da largura
 * atual, e o escondido (display: none) também some para o leitor de tela.
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

/** "novembro e dezembro de 2026" ou "dezembro de 2026 e janeiro de 2027". */
function rotuloPar(meses: string[]) {
  const [x, y] = meses;
  if (!y) return rotuloMes(x);
  const [ax, mx] = x.split("-").map(Number);
  const [ay, my] = y.split("-").map(Number);
  return ax === ay ? `${NOMES_MES[mx - 1]} e ${NOMES_MES[my - 1]} de ${ay}` : `${rotuloMes(x)} e ${rotuloMes(y)}`;
}

interface TabelaMesProps {
  mes: string;
  dias: Record<string, DiaAgenda>;
  hoje: string;
  /** Mostra o nome do mês acima da grade (só no desktop, quando há dois meses lado a lado). */
  comTitulo: boolean;
}

function TabelaMes({ mes, dias, hoje, comTitulo }: TabelaMesProps) {
  const semanas = semanasDoMes(mes);
  return (
    <div>
      {comTitulo ? (
        <p className="mb-1 hidden text-center font-semibold text-[var(--cor-secundaria)] first-letter:uppercase lg:block" aria-hidden="true">
          {rotuloMes(mes)}
        </p>
      ) : null}
      <table className="w-full table-fixed border-collapse text-center">
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
    </div>
  );
}

interface SetasProps {
  rotulo: string;
  anterior: { rotulo: string; ir: () => void } | null;
  proximo: { rotulo: string; ir: () => void } | null;
  className: string;
}

function Setas({ rotulo, anterior, proximo, className }: SetasProps) {
  return (
    <div className={`items-center justify-between gap-2 ${className}`}>
      <button type="button" className="botao" onClick={anterior?.ir} disabled={!anterior} aria-label={anterior?.rotulo ?? "Sem meses anteriores"}>
        <span aria-hidden="true">‹</span>
      </button>
      <p className="text-center text-lg font-semibold first-letter:uppercase" aria-live="polite">
        {rotulo}
      </p>
      <button type="button" className="botao" onClick={proximo?.ir} disabled={!proximo} aria-label={proximo?.rotulo ?? "Sem meses seguintes"}>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}

export function Calendario({ meses, inicial, dias, hoje }: CalendarioProps) {
  const [i, setI] = useState(Math.max(0, meses.indexOf(inicial)));
  const mes = meses[i];
  if (!mes) return null;
  // Par do desktop: começa no mês aberto; se ele for o último, mostra o anterior e ele.
  const ini = Math.max(0, Math.min(i, meses.length - 2));
  const par = meses.slice(ini, ini + 2);
  const iniAnt = Math.max(0, ini - 2);
  const iniProx = Math.max(0, Math.min(ini + 2, meses.length - 2));
  const antes = iniAnt < ini ? meses.slice(iniAnt, iniAnt + 2) : [];
  const depois = iniProx > ini ? meses.slice(iniProx, iniProx + 2) : [];
  const ant = meses[i - 1];
  const prox = meses[i + 1];
  return (
    <div className="max-w-xl lg:max-w-none">
      <Setas
        className="flex lg:hidden"
        rotulo={rotuloMes(mes)}
        anterior={ant ? { rotulo: `Ver ${rotuloMes(ant)}`, ir: () => setI(i - 1) } : null}
        proximo={prox ? { rotulo: `Ver ${rotuloMes(prox)}`, ir: () => setI(i + 1) } : null}
      />
      <Setas
        className="hidden lg:flex"
        rotulo={rotuloPar(par)}
        anterior={antes.length ? { rotulo: `Ver ${rotuloPar(antes)}`, ir: () => setI(iniAnt) } : null}
        proximo={depois.length ? { rotulo: `Ver ${rotuloPar(depois)}`, ir: () => setI(iniProx) } : null}
      />
      <div className="mt-3 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {par.map((m) => (
          <div key={m} className={m === mes ? "" : "hidden lg:block"}>
            <TabelaMes mes={m} dias={dias} hoje={hoje} comTitulo={par.length > 1} />
          </div>
        ))}
      </div>
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
