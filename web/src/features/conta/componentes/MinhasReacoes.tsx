"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { rotuloGenerico, tituloProposta } from "../acompanhamento";
import type { MinhaReacao } from "../dados";
import { enviarJson, mensagemDeErro } from "../cliente";
import { hrefDoId } from "../ids";
import { useCatalogo } from "./useCatalogo";

/**
 * "Minhas reações": cada proposta em que a pessoa reagiu, com o botão "Apagar esta reação".
 * Ordem alfabética do título (não há data guardada da reação).
 */
export function MinhasReacoes({ inicial }: { inicial: MinhaReacao[] }) {
  const router = useRouter();
  const [lista, setLista] = useState(inicial);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const { partes, pronto } = useCatalogo(lista.map((r) => r.proposta));

  async function apagar(proposta: string, nome: string) {
    setOcupado(proposta);
    setErro(null);
    const r = await enviarJson<{ erro?: string }>("/api/conta/reacoes", { proposta, valor: 0 });
    setOcupado(null);
    if (!r.ok) {
      setErro(mensagemDeErro(r.dados?.erro));
      return;
    }
    setLista((l) => l.filter((x) => x.proposta !== proposta));
    setAnuncio(`Reação apagada: ${nome}.`);
    router.refresh();
  }

  if (!lista.length) return <p className="text-sm text-[var(--cor-secundaria)]">Você não tem reações registradas.</p>;

  const itens = lista
    .map((r) => ({ ...r, titulo: tituloProposta(partes, r.proposta) ?? rotuloGenerico(r.proposta) }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));

  return (
    <div className="space-y-2" aria-busy={!pronto}>
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
      {erro ? (
        <p role="alert" className="aviso text-sm">
          {erro}
        </p>
      ) : null}
      <ul className="space-y-2">
        {itens.map((r) => {
          const href = hrefDoId(r.proposta);
          return (
            <li key={r.proposta} className="rounded-lg border border-borda p-3">
              <p className="meta">Sua reação: {r.valor === 1 ? "curti" : "não curti"}</p>
              {href ? (
                <Link href={href} className="lk" prefetch={false}>
                  {r.titulo}
                </Link>
              ) : (
                <span>{r.titulo}</span>
              )}
              <div className="mt-2">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded border border-[var(--cor-borda-forte)] bg-superficie px-3 text-sm font-medium text-foreground hover:bg-[var(--cor-superficie-2)] disabled:opacity-60"
                  disabled={ocupado === r.proposta}
                  onClick={() => void apagar(r.proposta, r.titulo)}
                >
                  Apagar esta reação<span className="sr-only">: {r.titulo}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
