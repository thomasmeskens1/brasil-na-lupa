"use client";

/**
 * "Reações no site, por estado": só para quem tem conta (Política de Privacidade, versão 5,
 * item 9.2). Mostra os totais de curtir e não curtir desta proposta nos estados com o mínimo de
 * pessoas, em ordem alfabética do estado (sem ranking), com o mesmo tratamento visual para os dois
 * lados. Não é pesquisa: só quem tem conta, reagiu e informou o estado onde vota.
 */
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { obterEstadoConta } from "@/features/conta/cliente";
import { UFS } from "@/features/conta/regras";

interface Total {
  uf: string;
  curtidas: number;
  naoCurtidas: number;
}
type Estado =
  | { fase: "oculto" }
  | { fase: "carregando" }
  | { fase: "indisponivel" }
  | { fase: "pronto"; minimo: number; minhaUf: string | null; estados: Total[] };

const nomeUf = (s: string) => UFS.find((u) => u.sigla === s)?.nome ?? s;
const n = (v: number) => v.toLocaleString("pt-BR");

export function ManifestacoesPorEstado({ proposta }: { proposta: string }) {
  const id = useId();
  const [e, setE] = useState<Estado>({ fase: "oculto" });

  useEffect(() => {
    let vivo = true;
    void obterEstadoConta().then(async (c) => {
      if (!vivo || !c.logado) return;
      setE({ fase: "carregando" });
      try {
        const r = await fetch(`/api/conta/manifestacoes?proposta=${encodeURIComponent(proposta)}`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as { minimo: number; minhaUf: string | null; estados: Total[] };
        if (vivo) setE({ fase: "pronto", ...d });
      } catch {
        if (vivo) setE({ fase: "indisponivel" });
      }
    });
    return () => {
      vivo = false;
    };
  }, [proposta]);

  if (e.fase === "oculto") return null;
  return (
    <section aria-labelledby={`${id}-t`} className="rounded-xl border border-borda bg-superficie p-4" aria-busy={e.fase === "carregando"}>
      <h2 id={`${id}-t`} className="text-lg font-bold">
        Reações no site, por estado
      </h2>
      <p className="mt-1 text-sm text-[var(--cor-secundaria)]">
        Opinião de usuários do site, não pesquisa nem dado oficial: só quem tem conta, reagiu a esta proposta e informou o
        estado onde vota. Um estado só aparece com {e.fase === "pronto" ? e.minimo : 10} pessoas ou mais.
      </p>
      {e.fase === "carregando" ? <p className="mt-3 text-sm">Carregando…</p> : null}
      {e.fase === "indisponivel" ? <p className="lacuna mt-3">Os totais por estado não estão disponíveis agora.</p> : null}
      {e.fase === "pronto" ? (
        <>
          {e.estados.length ? (
            <ul className="mt-3 divide-y divide-[var(--cor-borda)] rounded border border-[var(--cor-borda)] bg-white text-sm">
              {e.estados.map((t) => (
                <li key={t.uf} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="font-semibold">
                    {nomeUf(t.uf)}
                    {t.uf === e.minhaUf ? <span className="font-normal text-[var(--cor-secundaria)]"> (seu estado)</span> : null}
                  </span>
                  <span className="flex gap-2">
                    <span className="pilula-numero">
                      Curtiram <strong>{n(t.curtidas)}</strong>
                    </span>
                    <span className="pilula-numero">
                      Não curtiram <strong>{n(t.naoCurtidas)}</strong>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm">Nenhum estado chegou a {e.minimo} pessoas nesta proposta.</p>
          )}
          <p className="mt-3 text-sm">
            {e.minhaUf ? null : (
              <>
                <Link href="/minha-conta#estado-eleitoral" className="lk">
                  Informe o estado onde você vota
                </Link>{" "}
                para que as suas reações entrem nestes totais.{" "}
              </>
            )}
            <Link href="/participar/mais-manifestacoes" className="lk">
              Ver as propostas com mais manifestações
            </Link>
            .
          </p>
        </>
      ) : null}
    </section>
  );
}
