"use client";

/**
 * Busca única da página inicial. O índice (public/inicio/busca.json, gerado no build) só é baixado
 * ao focar o campo; a busca roda no navegador e nada do que é digitado é enviado.
 * Resultados agrupados por tipo, na ordem fixa dos grupos; dentro do grupo, parlamentares em ordem
 * alfabética e o resto do mais recente para o mais antigo (diretriz 6). Sem destaque editorial.
 */
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { normalizar } from "@/features/representantes/BuscaLocal";

type Linha = [number, string, string | null, string, string | number];
interface Indice {
  t: string[];
  u?: { stj?: string; stf?: string };
  i: Linha[];
}
interface Pronto {
  idx: Indice;
  chaves: string[];
}

const POR_GRUPO = 5;
const GRUPOS_ALFABETICOS = new Set([0, 1, 2, 12]);
/** Cidades (grupo 12) aparecem primeiro; os demais seguem a ordem fixa dos grupos. */
const CIDADES = 12;
const posicao = (g: number) => (g === CIDADES ? -1 : g);
/** Texto pesquisável: nas cidades, só o nome e a UF (senão "cidade" ou "eleito" casariam com todas). */
const chave = (idx: Indice, l: Linha) => normalizar(l[0] === CIDADES ? l[1] : `${idx.t[l[0]]} ${l[1]} ${l[4]}`);

let promessa: Promise<Pronto | null> | null = null;
function carregar(): Promise<Pronto | null> {
  promessa ??= fetch("/inicio/busca.json")
    .then((r) => (r.ok ? (r.json() as Promise<Indice>) : null))
    .then((idx) => (idx ? { idx, chaves: idx.i.map((l) => chave(idx, l)) } : null))
    .catch(() => {
      promessa = null;
      return null;
    });
  return promessa;
}

function resolverHref(h: string, u: Indice["u"]): string {
  // "@m:uf/slug" = página da cidade; "@q:uf/slug" = quem foi eleito na cidade.
  const c = /^@(m|q):([a-z]{2})\/([a-z0-9-]+)$/.exec(h);
  if (c) return c[1] === "m" ? `/municipios/${c[2]}/${c[3]}` : `/quem-me-representa/${c[2]}?cidade=${c[3]}#na-sua-cidade`;
  const m = /^@(stj|stf):(\d+)$/.exec(h);
  if (m) return (u?.[m[1] as "stj" | "stf"] ?? "").replaceAll("{n}", m[2]);
  return h;
}

function dataBr(v: string | null) {
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})/.exec(v) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

export function BuscaUnica() {
  const id = useId();
  const [q, setQ] = useState("");
  const [dados, setDados] = useState<Pronto | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [abertos, setAbertos] = useState<Set<number>>(new Set());

  function preparar() {
    if (dados) return;
    void carregar().then((d) => (d ? setDados(d) : setFalhou(true)));
  }

  const grupos = useMemo(() => {
    const termos = normalizar(q).split(" ").filter(Boolean);
    if (!dados || !termos.length || normalizar(q).length < 2) return null;
    const por = new Map<number, Linha[]>();
    dados.idx.i.forEach((l, k) => {
      const c = dados.chaves[k];
      if (termos.every((t) => c.includes(t))) {
        const g = por.get(l[0]) ?? [];
        g.push(l);
        por.set(l[0], g);
      }
    });
    for (const [g, l] of por) {
      if (GRUPOS_ALFABETICOS.has(g)) l.sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
      else l.sort((a, b) => (b[2] ?? "").localeCompare(a[2] ?? "") || a[1].localeCompare(b[1], "pt-BR"));
    }
    return [...por.entries()].sort((a, b) => posicao(a[0]) - posicao(b[0]));
  }, [q, dados]);

  const total = grupos?.reduce((s, [, l]) => s + l.length, 0) ?? 0;

  return (
    <div>
      <form role="search" aria-label="Buscar em todo o site" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor={`${id}-q`} className="block text-lg font-semibold">
          Buscar cidade, político, lei, votação ou tema
        </label>
        <input
          id={`${id}-q`}
          type="search"
          value={q}
          onFocus={preparar}
          onChange={(e) => {
            setQ(e.target.value);
            setAbertos(new Set());
            preparar();
          }}
          placeholder="Ex.: sua cidade, nome do deputado, MEI, gasolina"
          aria-describedby={`${id}-ajuda`}
          className="mt-1 w-full rounded-md border border-[var(--cor-borda-forte)] bg-white px-3 py-2 text-base"
        />
        <p id={`${id}-ajuda`} className="meta mt-1">
          Busca em cidades, parlamentares, votações, medidas provisórias, vetos, leis federais, decisões do ICMS e temas do STJ e do STF.
          Roda neste aparelho: o que você digita não é enviado.
        </p>
      </form>
      <div aria-live="polite" className="mt-3">
        {falhou ? <p className="lacuna">Não foi possível carregar o índice de busca. Tente de novo mais tarde.</p> : null}
        {!dados && q.length >= 2 && !falhou ? <p>Carregando o índice…</p> : null}
        {grupos ? (
          total ? (
            <p className="sr-only">
              {total} {total === 1 ? "resultado" : "resultados"}
              {grupos.length > 1 ? `, em ${grupos.length} grupos` : ""}.
            </p>
          ) : (
            <p className="lacuna">Nada encontrado para “{q}”.</p>
          )
        ) : null}
      </div>
      {grupos && total ? (
        <div className="mt-2 space-y-4">
          {grupos.map(([g, l]) => {
            const todos = abertos.has(g);
            const vis = todos ? l : l.slice(0, POR_GRUPO);
            return (
              <section key={g} aria-labelledby={`${id}-g${g}`}>
                {/* h2: a busca fica logo abaixo do h1 da página inicial (sem salto de nível). */}
                <h2 id={`${id}-g${g}`} className="titulo-simples text-base">
                  {dados!.idx.t[g]}{" "}
                  <span className="font-normal text-[var(--cor-secundaria)]">
                    <span aria-hidden="true">· </span>
                    {l.length}
                    <span className="sr-only"> {l.length === 1 ? "resultado" : "resultados"}</span>
                  </span>
                </h2>
                <ul className="mt-1 divide-y divide-[var(--cor-borda)] rounded border border-[var(--cor-borda)]">
                  {vis.map((r) => {
                    const href = resolverHref(r[3], dados!.idx.u);
                    const externo = /^https?:\/\//.test(href);
                    const extra = [dataBr(r[2]), r[4] || null].filter(Boolean).join(" · ");
                    const conteudo = (
                      <>
                        <span className="block">{r[1]}</span>
                        {extra || externo ? (
                          <span className="block text-sm text-[var(--cor-secundaria)]">
                            {extra}
                            {externo ? `${extra ? " · " : ""}abre o site oficial` : ""}
                          </span>
                        ) : null}
                      </>
                    );
                    return (
                      <li key={`${r[3]}-${r[1]}`}>
                        {externo ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="block min-h-11 px-3 py-2 hover:bg-[var(--cor-superficie)]">
                            {conteudo}
                            <span className="sr-only"> (abre em nova aba)</span>
                          </a>
                        ) : (
                          <Link href={href} className="block min-h-11 px-3 py-2 hover:bg-[var(--cor-superficie)]">
                            {conteudo}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {l.length > POR_GRUPO ? (
                  <button
                    type="button"
                    className="botao mt-2"
                    aria-expanded={todos}
                    onClick={() =>
                      setAbertos((s) => {
                        const n = new Set(s);
                        if (todos) n.delete(g);
                        else n.add(g);
                        return n;
                      })
                    }
                  >
                    {todos ? "Mostrar menos" : `Mostrar todos (${l.length})`}
                    <span className="sr-only"> em {dados!.idx.t[g]}</span>
                  </button>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
