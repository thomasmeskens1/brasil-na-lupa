"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { acompanharPropostas, nomePolitico, rotuloGenerico, type PropostaAcompanhada } from "../acompanhamento";
import { enviarJson, mensagemDeErro } from "../cliente";
import { hrefDoId, type TipoFavorito } from "../ids";
import { TEMAS, UFS } from "../regras";
import { useCatalogo } from "./useCatalogo";

export const dataBr = (d: string | null) => (d ? d.split("-").reverse().join("/") : "data não informada");
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export interface FavoritosIniciais {
  propostas: string[];
  politicos: string[];
  ufs: string[];
  temas: string[];
}

const BOTAO_REMOVER =
  "inline-flex min-h-11 items-center rounded border border-[var(--cor-borda-forte)] bg-superficie px-3 text-sm font-medium text-foreground hover:bg-[var(--cor-superficie-2)] disabled:opacity-60";

function Remover({ nome, onClick, ocupado }: { nome: string; onClick: () => void; ocupado: boolean }) {
  return (
    <button type="button" className={BOTAO_REMOVER} onClick={onClick} disabled={ocupado}>
      Remover<span className="sr-only"> dos favoritos: {nome}</span>
    </button>
  );
}

function Proposta({ p, remover, ocupado }: { p: PropostaAcompanhada; remover: () => void; ocupado: boolean }) {
  const titulo = p.titulo ?? rotuloGenerico(p.id);
  return (
    <li className="rounded-lg border border-borda bg-[var(--cor-superficie-2)] p-3">
      <p className="meta">
        {p.orgao ?? "Órgão não informado"} · {dataBr(p.data)}
      </p>
      {p.href ? (
        <Link href={p.href} className="lk font-semibold" prefetch={false}>
          {titulo}
        </Link>
      ) : (
        <span className="font-semibold">{titulo}</span>
      )}
      {p.situacao ? (
        <p className="mt-1 text-sm">
          <span className="font-semibold">Situação oficial:</span> {maiuscula(p.situacao.toLowerCase())}
        </p>
      ) : null}
      {p.atualizacoes.length ? (
        <div className="mt-2">
          <p className="text-sm font-semibold">Outras votações da mesma proposta (mais recentes primeiro)</p>
          <ul className="mt-1 space-y-1 text-sm">
            {p.atualizacoes.map((a) => (
              <li key={a.id}>
                {a.href ? (
                  <Link href={a.href} className="lk" prefetch={false}>
                    {dataBr(a.data)}
                    {a.resultado ? ` — ${maiuscula(a.resultado)}` : ""}
                  </Link>
                ) : (
                  dataBr(a.data)
                )}
                {a.posterior ? <span className="meta"> · depois da votação que você favoritou</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : p.titulo ? (
        <p className="meta mt-1">Nenhuma outra votação desta proposta foi registrada nas fontes coletadas.</p>
      ) : (
        <p className="meta mt-1">Este item não está mais no período coletado; a página dele pode não estar disponível.</p>
      )}
      <div className="mt-2">
        <Remover nome={titulo} onClick={remover} ocupado={ocupado} />
      </div>
    </li>
  );
}

/**
 * "Meus favoritos": propostas (com as votações mais recentes da mesma proposta e a situação
 * oficial), políticos, estados e temas, cada um com o botão Remover. Os nomes vêm do catálogo
 * público; nenhum favorito sai do navegador para montar a lista.
 */
export function MeusFavoritos({ inicial }: { inicial: FavoritosIniciais }) {
  const router = useRouter();
  const [fav, setFav] = useState(inicial);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const { partes, pronto } = useCatalogo([...fav.propostas, ...fav.politicos]);

  async function remover(tipo: TipoFavorito, ref: string, nome: string) {
    setOcupado(ref);
    setErro(null);
    const r = await enviarJson<{ erro?: string }>("/api/conta/favoritos", { tipo, ref, favorito: false });
    setOcupado(null);
    if (!r.ok) {
      setErro(mensagemDeErro(r.dados?.erro));
      return;
    }
    const campo = ({ proposta: "propostas", politico: "politicos", uf: "ufs", tema: "temas" } as const)[tipo];
    setFav((f) => ({ ...f, [campo]: f[campo].filter((x) => x !== ref) }));
    setAnuncio(`Removido dos favoritos: ${nome}.`);
    router.refresh();
  }

  const propostas = acompanharPropostas(partes, fav.propostas);
  const total = fav.propostas.length + fav.politicos.length + fav.ufs.length + fav.temas.length;
  const titulo = "text-lg font-bold text-foreground";

  return (
    <div className="space-y-6" aria-busy={!pronto}>
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
      {erro ? (
        <p role="alert" className="aviso text-sm">
          {erro}
        </p>
      ) : null}
      {total === 0 ? (
        <p className="lacuna">
          Você ainda não tem favoritos. Use o botão “Favoritar” nas páginas de propostas, políticos e estados, ou escolha
          estados e temas logo abaixo.
        </p>
      ) : null}

      <section aria-labelledby="fav-propostas" className="space-y-2">
        <h3 id="fav-propostas" className={titulo}>
          Propostas ({fav.propostas.length})
        </h3>
        {fav.propostas.length ? (
          <>
            <p className="meta">
              Da movimentação mais recente para a mais antiga (ordem só pela data). Cada uma mostra a situação oficial,
              quando a fonte informa, e as outras votações da mesma proposta.
            </p>
            {!pronto ? <p className="meta">Carregando as atualizações…</p> : null}
            <ul className="space-y-3">
              {propostas.map((p) => (
                <Proposta
                  key={p.id}
                  p={p}
                  ocupado={ocupado === p.id}
                  remover={() => void remover("proposta", p.id, p.titulo ?? rotuloGenerico(p.id))}
                />
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-[var(--cor-secundaria)]">Nenhuma proposta favorita. Use “Favoritar” na página da votação ou da decisão.</p>
        )}
      </section>

      <section aria-labelledby="fav-politicos" className="space-y-2">
        <h3 id="fav-politicos" className={titulo}>
          Políticos ({fav.politicos.length})
        </h3>
        {fav.politicos.length ? (
          <ul className="space-y-2">
            {fav.politicos.map((id) => {
              const nome = nomePolitico(partes, id) ?? rotuloGenerico(id);
              const href = hrefDoId(id);
              return (
                <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borda p-3">
                  {href ? (
                    <Link href={href} className="lk" prefetch={false}>
                      {nome}
                    </Link>
                  ) : (
                    <span>{nome}</span>
                  )}
                  <Remover nome={nome} ocupado={ocupado === id} onClick={() => void remover("politico", id, nome)} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-[var(--cor-secundaria)]">Nenhum político favorito. Use “Favoritar” na página do deputado ou senador.</p>
        )}
      </section>

      <section aria-labelledby="fav-estados" className="space-y-2">
        <h3 id="fav-estados" className={titulo}>
          Estados ({fav.ufs.length})
        </h3>
        {fav.ufs.length ? (
          <ul className="flex flex-wrap gap-2">
            {fav.ufs.map((s) => {
              const nome = UFS.find((u) => u.sigla === s)?.nome ?? s;
              return (
                <li key={s} className="inline-flex items-center gap-2 rounded-lg border border-borda py-1 pl-3 pr-1">
                  <Link href={`/estados/${s.toLowerCase()}`} className="lk" prefetch={false}>
                    {nome} ({s})
                  </Link>
                  <Remover nome={nome} ocupado={ocupado === s} onClick={() => void remover("uf", s, nome)} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-[var(--cor-secundaria)]">Nenhum estado favorito.</p>
        )}
      </section>

      <section aria-labelledby="fav-temas" className="space-y-2">
        <h3 id="fav-temas" className={titulo}>
          Temas ({fav.temas.length})
        </h3>
        {fav.temas.length ? (
          <ul className="flex flex-wrap gap-2">
            {fav.temas.map((t) => {
              const nome = TEMAS.find((x) => x.id === t)?.nome ?? t;
              return (
                <li key={t} className="inline-flex items-center gap-2 rounded-lg border border-borda py-1 pl-3 pr-1">
                  <span>{nome}</span>
                  <Remover nome={nome} ocupado={ocupado === t} onClick={() => void remover("tema", t, nome)} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-[var(--cor-secundaria)]">Nenhum tema favorito.</p>
        )}
      </section>
    </div>
  );
}
