"use client";

/**
 * Busca de deputado federal ou senador em exercício pelo nome, partido ou estado (UF), nas duas
 * casas ao mesmo tempo. Resultados em ordem alfabética (nunca por desempenho), até 8 por vez,
 * com link para o perfil. A lista vem pronta do servidor; nada do que é digitado sai do navegador.
 */
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { normalizar, rotaParlamentar } from "../rotulos";
import type { Casa } from "../tipos";

/** [casa, id, nome, partido, UF] */
export type ItemBuscaParlamentar = [Casa, string, string, string, string];

const MAX = 8;
const CARGO: Record<Casa, string> = { camara: "Deputado(a) federal", senado: "Senador(a)" };

export function BuscaParlamentar({ itens }: { itens: ItemBuscaParlamentar[] }) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const indexados = useMemo(() => itens.map((i) => ({ i, t: normalizar(`${i[2]} ${i[3]} ${i[4]}`) })), [itens]);
  const termos = normalizar(texto).split(/\s+/).filter(Boolean);
  const ativo = termos.join("").length >= 2;
  const achados = ativo ? indexados.filter(({ t }) => termos.every((x) => t.includes(x))).map(({ i }) => i) : [];
  const mostrados = achados.slice(0, MAX);

  return (
    <div role="search" aria-label="Buscar parlamentar">
      <label htmlFor={id} className="block font-titulo text-lg font-extrabold text-foreground">
        Encontre um deputado federal ou senador
        <span className="mt-1 block font-sans text-sm font-normal text-[var(--cor-secundaria)]">
          Pelo nome, partido ou estado (UF). Ex.: Silva, PT, SP
        </span>
        <input
          id={id}
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
          aria-describedby={`${id}-contagem`}
          className="mt-2 block w-full rounded-xl border border-[var(--cor-borda-forte)] bg-white px-4 py-3 text-lg text-foreground"
        />
      </label>
      <p id={`${id}-contagem`} aria-live="polite" className="mt-2 text-sm text-[var(--cor-secundaria)]">
        {ativo
          ? achados.length
            ? `${achados.length} ${achados.length === 1 ? "parlamentar encontrado" : "parlamentares encontrados"}${achados.length > MAX ? `; mostrando os ${MAX} primeiros em ordem alfabética` : ", em ordem alfabética"}`
            : "Nenhum parlamentar em exercício com esse nome, partido ou estado."
          : `${itens.length.toLocaleString("pt-BR")} parlamentares em exercício nas listas oficiais.`}
      </p>
      {mostrados.length ? (
        <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {mostrados.map(([casa, pid, nome, partido, uf]) => (
            <li key={`${casa}-${pid}`}>
              <Link href={rotaParlamentar(casa, pid)} className="bloco-secao min-h-11 flex-col !gap-0.5 p-3">
                <span className="font-semibold text-foreground">{nome}</span>
                <span className="text-sm text-[var(--cor-secundaria)]">
                  {CARGO[casa]} · {partido || "partido não informado"}
                  {uf ? `-${uf}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
