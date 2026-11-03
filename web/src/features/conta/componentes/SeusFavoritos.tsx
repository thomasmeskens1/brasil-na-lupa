"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { obterEstadoConta } from "../cliente";
import { decisoesDosFavoritos, temFavoritos, type DecisaoFavorita } from "../filtro-favoritos";
import type { IndiceFavoritos } from "../indice";

const dataBr = (d: string | null) => (d ? d.split("-").reverse().join("/") : "data não informada");

type Estado = { fase: "oculto" } | { fase: "carregando" } | { fase: "vazio" } | { fase: "pronto"; itens: DecisaoFavorita[]; janela: number };

/**
 * "Seus favoritos" no topo da página inicial, só para quem tem sessão. A página continua
 * estática: os favoritos vêm de /api/conta/estado e as decisões do índice público.
 */
export function SeusFavoritos() {
  const [estado, setEstado] = useState<Estado>({ fase: "oculto" });

  useEffect(() => {
    let vivo = true;
    void obterEstadoConta().then(async (e) => {
      if (!vivo || !e.logado) return;
      if (!temFavoritos(e.favoritos)) {
        setEstado({ fase: "vazio" });
        return;
      }
      setEstado({ fase: "carregando" });
      try {
        const r = await fetch("/api/conta/indice");
        const indice = (await r.json()) as IndiceFavoritos;
        if (vivo) setEstado({ fase: "pronto", itens: decisoesDosFavoritos(indice, e.favoritos!), janela: indice.janelaDias });
      } catch {
        if (vivo) setEstado({ fase: "oculto" });
      }
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (estado.fase === "oculto") return null;
  return (
    <section aria-labelledby="titulo-favoritos" aria-busy={estado.fase === "carregando"} className="rounded-lg border border-borda bg-superficie p-4">
      <h2 id="titulo-favoritos" className="text-2xl">
        Seus favoritos
      </h2>
      {estado.fase === "vazio" ? (
        <p className="mt-2 text-sm text-[var(--cor-secundaria)]">
          Você ainda não tem favoritos. Use o botão “Favoritar” nas páginas de estados, políticos e propostas, ou escolha
          estados e temas em{" "}
          <Link href="/minha-conta" className="lk">
            Minha conta
          </Link>
          .
        </p>
      ) : estado.fase === "carregando" ? (
        <p className="mt-2 text-sm text-[var(--cor-secundaria)]">Carregando as decisões ligadas aos seus favoritos…</p>
      ) : (
        <>
          <p className="meta mt-1">
            Decisões dos últimos {estado.janela} dias ligadas aos seus favoritos, da mais recente para a mais antiga (ordem
            só pela data).
          </p>
          {estado.itens.length ? (
            <ul className="mt-3 space-y-2">
              {estado.itens.map((d) => (
                <li key={d.k} className="rounded-md border border-borda bg-[var(--cor-superficie-2)] px-3 py-2">
                  <p className="meta">
                    {d.c} · {dataBr(d.d)}
                  </p>
                  <Link href={d.h} className="lk font-semibold">
                    {d.t}
                  </Link>
                  <p className="meta">Aparece por: {d.motivos.join("; ")}.</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lacuna mt-2">Nenhuma decisão coletada nesse período está ligada aos seus favoritos.</p>
          )}
          <p className="mt-3 text-sm">
            <Link href="/minha-conta" className="lk">
              Editar meus favoritos
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
