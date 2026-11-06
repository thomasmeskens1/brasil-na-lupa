"use client";

/**
 * Lista "Propostas com mais manifestações" (Política de Privacidade, versão 5, item 9.2). Só para
 * quem tem conta. Critério único e público: número de reações (curtir + não curtir somados, sem
 * peso para um lado); empate pelo id. Só propostas com o mínimo de pessoas. No Brasil ou num estado.
 */
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { rotuloGenerico, tituloProposta } from "@/features/conta/acompanhamento";
import { obterEstadoConta } from "@/features/conta/cliente";
import { FormEntrar } from "@/features/conta/componentes/FormEntrar";
import { useCatalogo } from "@/features/conta/componentes/useCatalogo";
import { hrefDoId } from "@/features/conta/ids";
import { UFS } from "@/features/conta/regras";

interface Item {
  proposta: string;
  curtidas: number;
  naoCurtidas: number;
  total: number;
}
type Estado =
  | { fase: "verificando" }
  | { fase: "sem-conta" }
  | { fase: "carregando" }
  | { fase: "indisponivel" }
  | { fase: "pronto"; minimo: number; minhaUf: string | null; itens: Item[] };

const n = (v: number) => v.toLocaleString("pt-BR");

export function MaisManifestacoes() {
  const id = useId();
  const [uf, setUf] = useState("");
  const [e, setE] = useState<Estado>({ fase: "verificando" });

  useEffect(() => {
    let vivo = true;
    void obterEstadoConta().then(async (c) => {
      if (!vivo) return;
      if (!c.logado) {
        setE({ fase: "sem-conta" });
        return;
      }
      setE({ fase: "carregando" });
      try {
        const r = await fetch(`/api/conta/manifestacoes?lista=1${uf ? `&uf=${uf}` : ""}`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as { minimo: number; minhaUf: string | null; itens: Item[] };
        if (vivo) setE({ fase: "pronto", ...d });
      } catch {
        if (vivo) setE({ fase: "indisponivel" });
      }
    });
    return () => {
      vivo = false;
    };
  }, [uf]);

  const itens = e.fase === "pronto" ? e.itens : [];
  const { partes } = useCatalogo(itens.map((i) => i.proposta));

  if (e.fase === "verificando") return <p className="text-sm">Carregando…</p>;
  if (e.fase === "sem-conta") {
    return (
      <div className="space-y-3">
        <p className="aviso text-sm">A lista aparece só para quem tem conta. Para entrar ou criar a conta, basta o e-mail.</p>
        <FormEntrar voltar="/participar/mais-manifestacoes" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${id}-uf`} className="block text-sm font-semibold">
          Onde
        </label>
        <select
          id={`${id}-uf`}
          value={uf}
          onChange={(ev) => setUf(ev.target.value)}
          className="mt-1 min-h-11 w-full max-w-xs rounded-md border border-[var(--cor-borda-forte)] bg-white px-3 text-base"
        >
          <option value="">Brasil (todas as reações)</option>
          {UFS.map((u) => (
            <option key={u.sigla} value={u.sigla}>
              {u.nome} (quem informou este estado)
            </option>
          ))}
        </select>
      </div>
      <div aria-live="polite" aria-busy={e.fase === "carregando"}>
        {e.fase === "carregando" ? <p className="text-sm">Carregando…</p> : null}
        {e.fase === "indisponivel" ? <p className="lacuna">A lista não está disponível agora. Tente de novo mais tarde.</p> : null}
        {e.fase === "pronto" ? (
          e.itens.length ? (
            <ol className="space-y-2">
              {e.itens.map((it, i) => {
                const titulo = tituloProposta(partes, it.proposta) ?? rotuloGenerico(it.proposta);
                const href = hrefDoId(it.proposta);
                return (
                  <li key={it.proposta} className="rounded-md border border-borda bg-white px-3 py-2">
                    <p className="meta">
                      {i + 1}º · {n(it.total)} {it.total === 1 ? "reação" : "reações"}
                    </p>
                    {href ? (
                      <Link href={href} className="lk font-semibold" prefetch={false}>
                        {titulo}
                      </Link>
                    ) : (
                      <span className="font-semibold">{titulo}</span>
                    )}
                    <p className="mt-1 flex flex-wrap gap-2 text-sm">
                      <span className="pilula-numero">
                        Curtiram <strong>{n(it.curtidas)}</strong>
                      </span>
                      <span className="pilula-numero">
                        Não curtiram <strong>{n(it.naoCurtidas)}</strong>
                      </span>
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm">
              Nenhuma proposta chegou a {e.minimo} pessoas {uf ? "neste estado" : "ainda"}. A lista começa a aparecer quando
              houver reações suficientes.
            </p>
          )
        ) : null}
        {e.fase === "pronto" && !e.minhaUf ? (
          <p className="mt-3 text-sm">
            <Link href="/minha-conta#estado-eleitoral" className="lk">
              Informe o estado onde você vota
            </Link>{" "}
            para que as suas reações entrem na lista do seu estado.
          </p>
        ) : null}
      </div>
    </div>
  );
}
