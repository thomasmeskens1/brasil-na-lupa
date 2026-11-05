"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { nomePolitico, rotuloGenerico, tituloProposta } from "../acompanhamento";
import { obterEstadoConta } from "../cliente";
import { decisoesDosFavoritos, temFavoritos, type DecisaoFavorita } from "../filtro-favoritos";
import { hrefDoId, type TipoFavorito } from "../ids";
import type { IndiceFavoritos } from "../indice";
import { TEMAS, UFS } from "../regras";
import { useCatalogo } from "./useCatalogo";

const dataBr = (d: string | null) => (d ? d.split("-").reverse().join("/") : "data não informada");
/** Propostas mostradas aqui (as demais ficam na Minha conta). */
const MAX_PROPOSTAS = 6;
const PILULA =
  "inline-flex min-h-11 items-center rounded-full border border-[var(--cor-borda-forte)] bg-[var(--cor-superficie-2)] px-3 text-sm";

type Favoritos = Record<TipoFavorito, string[]>;
type Novidades = { fase: "carregando" } | { fase: "falhou" } | { fase: "pronto"; itens: DecisaoFavorita[]; janela: number };
type Estado = { fase: "oculto" } | { fase: "vazio" } | { fase: "pronto"; fav: Favoritos; novidades: Novidades };

/**
 * "Seus favoritos" no topo da página inicial, só para quem tem sessão. Sempre mostra o que a
 * pessoa acompanha (estados e temas escolhidos, políticos e propostas favoritados), com atalho
 * para cada página, e depois as decisões recentes ligadas a esses favoritos. A página continua
 * estática: os favoritos vêm de /api/conta/estado, os nomes do catálogo público e as decisões
 * do índice público; nenhum favorito sai do navegador para montar a lista.
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
      const fav = e.favoritos!;
      setEstado({ fase: "pronto", fav, novidades: { fase: "carregando" } });
      try {
        const r = await fetch("/api/conta/indice");
        const indice = (await r.json()) as IndiceFavoritos;
        if (vivo)
          setEstado({ fase: "pronto", fav, novidades: { fase: "pronto", itens: decisoesDosFavoritos(indice, fav), janela: indice.janelaDias } });
      } catch {
        if (vivo) setEstado({ fase: "pronto", fav, novidades: { fase: "falhou" } });
      }
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (estado.fase === "oculto") return null;
  return (
    <section aria-labelledby="titulo-favoritos" className="rounded-lg border border-borda bg-superficie p-4">
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
      ) : (
        <>
          <Acompanhando fav={estado.fav} />
          <NovidadesFavoritos n={estado.novidades} />
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

/** O que a pessoa acompanha, em ordem alfabética (sem ranking), com atalho para cada página. */
function Acompanhando({ fav }: { fav: Favoritos }) {
  const { partes, pronto } = useCatalogo([...fav.proposta, ...fav.politico]);
  const ufs = UFS.filter((u) => fav.uf.includes(u.sigla));
  const temas = TEMAS.filter((t) => fav.tema.includes(t.id));
  const politicos = fav.politico
    .map((id) => ({ id, nome: nomePolitico(partes, id) ?? rotuloGenerico(id), href: hrefDoId(id) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const propostas = fav.proposta.slice(0, MAX_PROPOSTAS).map((id) => ({ id, titulo: tituloProposta(partes, id) ?? rotuloGenerico(id), href: hrefDoId(id) }));

  return (
    <div className="mt-3 space-y-3" aria-busy={!pronto}>
      <h3 className="text-base font-semibold text-foreground">O que você acompanha</h3>
      {ufs.length ? (
        <Grupo titulo="Estados">
          {ufs.map((u) => (
            <li key={u.sigla}>
              <Link href={`/estados/${u.sigla.toLowerCase()}`} className={`${PILULA} lk`}>
                {u.nome}
              </Link>
            </li>
          ))}
        </Grupo>
      ) : null}
      {temas.length ? (
        <Grupo titulo="Temas">
          {temas.map((t) => (
            <li key={t.id}>
              <span className={PILULA}>{t.nome}</span>
            </li>
          ))}
        </Grupo>
      ) : null}
      {politicos.length ? (
        <Grupo titulo="Políticos">
          {politicos.map((p) => (
            <li key={p.id}>
              {p.href ? (
                <Link href={p.href} className={`${PILULA} lk`} prefetch={false}>
                  {p.nome}
                </Link>
              ) : (
                <span className={PILULA}>{p.nome}</span>
              )}
            </li>
          ))}
        </Grupo>
      ) : null}
      {propostas.length ? (
        <div>
          <p className="meta">Propostas</p>
          <ul className="mt-1 space-y-1">
            {propostas.map((p) => (
              <li key={p.id}>
                {p.href ? (
                  <Link href={p.href} className="lk inline-flex min-h-11 items-center text-sm" prefetch={false}>
                    {p.titulo}
                  </Link>
                ) : (
                  <span className="text-sm">{p.titulo}</span>
                )}
              </li>
            ))}
          </ul>
          {fav.proposta.length > MAX_PROPOSTAS ? (
            <p className="meta">
              E mais {fav.proposta.length - MAX_PROPOSTAS} em{" "}
              <Link href="/minha-conta" className="lk">
                Minha conta
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="meta">{titulo}</p>
      <ul className="mt-1 flex flex-wrap gap-2">{children}</ul>
    </div>
  );
}

/** Decisões recentes ligadas aos favoritos, só pela data (da mais recente para a mais antiga). */
function NovidadesFavoritos({ n }: { n: Novidades }) {
  return (
    <div className="mt-4" aria-busy={n.fase === "carregando"}>
      <h3 className="text-base font-semibold text-foreground">Novidades ligadas aos seus favoritos</h3>
      {n.fase === "carregando" ? (
        <p className="mt-1 text-sm text-[var(--cor-secundaria)]">Carregando as decisões ligadas aos seus favoritos…</p>
      ) : n.fase === "falhou" ? (
        <p className="lacuna mt-1">Não foi possível carregar as decisões agora. Tente de novo mais tarde.</p>
      ) : (
        <>
          <p className="meta mt-1">
            Decisões dos últimos {n.janela} dias, da mais recente para a mais antiga (ordem só pela data).
          </p>
          {n.itens.length ? (
            <ul className="mt-2 space-y-2">
              {n.itens.map((d) => (
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
        </>
      )}
    </div>
  );
}
