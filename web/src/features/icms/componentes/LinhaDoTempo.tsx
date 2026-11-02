"use client";

import Link from "next/link";
import { useState } from "react";
import { CAMINHOS, CAMINHO_CURTO, formatarData } from "../rotulos";
import type { Caminho } from "../tipos";

export interface ItemLinha {
  id: string;
  titulo: string;
  resumo: string | null;
  caminho: Caminho;
  ato: string;
  data: string | null;
  semVotoDeParlamentares: boolean;
}

/** Linha do tempo das decisões (mais recentes primeiro), com filtro por caminho. */
export function LinhaDoTempo({ itens }: { itens: ItemLinha[] }) {
  const [filtro, setFiltro] = useState<Caminho | "todos">("todos");
  const contagem = (c: Caminho) => itens.filter((i) => i.caminho === c).length;
  const visiveis = filtro === "todos" ? itens : itens.filter((i) => i.caminho === filtro);

  const botao = (valor: Caminho | "todos", rotulo: string, n: number) => {
    const ativo = filtro === valor;
    return (
      <button
        key={valor}
        type="button"
        aria-pressed={ativo}
        disabled={n === 0}
        onClick={() => setFiltro(valor)}
        className={`rounded-full border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:border-dashed disabled:text-[#52606d] ${
          ativo ? "border-acento bg-acento text-white" : "border-[#7b8794] bg-white text-gray-900 hover:bg-superficie"
        }`}
      >
        {rotulo} <span className={ativo ? "text-white" : "text-[#3e4c59]"}>({n})</span>
      </button>
    );
  };

  return (
    <div>
      <div role="group" aria-label="Filtrar decisões pelo caminho" className="flex flex-wrap gap-2">
        {botao("todos", "Todos os caminhos", itens.length)}
        {CAMINHOS.map((c) => botao(c.id, CAMINHO_CURTO[c.id], contagem(c.id)))}
      </div>
      <p className="meta mt-3" aria-live="polite">
        {visiveis.length === 1 ? "1 decisão" : `${visiveis.length} decisões`}
        {filtro === "todos" ? "" : ` pelo caminho ${CAMINHO_CURTO[filtro]}`}, da mais recente para a mais antiga.
      </p>
      {visiveis.length ? (
        <ol className="mt-4 space-y-4 border-l-2 border-[#9aa5b1] pl-5">
          {visiveis.map((i) => (
            <li key={i.id} className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-[1.72rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-acento"
              />
              <article className="cartao">
                <p className="meta flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">{formatarData(i.data)}</span>
                  <span className="selo">{CAMINHO_CURTO[i.caminho]}</span>
                  <span>{i.ato}</span>
                </p>
                <h3 className="mt-2 text-base font-semibold text-gray-900">
                  <Link href={`/impostos/icms/${i.id}`} className="lk">
                    {i.titulo}
                  </Link>
                </h3>
                {i.resumo ? <p className="mt-1 text-sm leading-relaxed text-gray-800">{i.resumo}</p> : null}
                {i.semVotoDeParlamentares ? (
                  <p className="mt-2 text-xs font-medium text-[#323f4b]">
                    Sem votação de deputados ou senadores.
                  </p>
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className="lacuna mt-4 text-sm">Nenhuma decisão registrada por este caminho.</p>
      )}
    </div>
  );
}
