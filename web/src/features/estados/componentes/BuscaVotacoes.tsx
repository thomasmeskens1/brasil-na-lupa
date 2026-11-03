"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CartaoDecisao } from "@/components/decisao";
import { FiltrosCompactos, normalizarBusca } from "@/components/tabela";
import { dadoVotacao, formaDecisao } from "../apresentacao";
import { lerHash, nomeProposicao, rotuloVoto } from "../rotulos";
import type { FormaVotacao } from "../tipos";

/** Linha de public/estados/<uf>/votacoes.json (ver scripts/gerar-estados.mjs). */
export type LinhaVotacao = [
  id: string,
  data: string,
  hora: string,
  tipo: 0 | 1,
  orgao: number,
  prop: number,
  descricao: string,
  resultado: string | null,
  placar: Record<string, number> | null,
  forma: FormaVotacao,
  nVotos: number,
  url: string | null,
  votos: [number, number][] | null,
  presidente: string | null,
  coletadoEm: string | null,
  tipoTexto?: string | null,
];

export interface ArquivoVotacoes {
  o: string[];
  p: [string | null, string | null, string, string | null][];
  n: [string, string | null][];
  t: string[];
  v: LinhaVotacao[];
}

export interface ContextoCasa {
  uf: string;
  base: string;
  casaSigla: string;
  casaNome: string;
  caminho: string;
  rotuloCaminho: string;
  membros: string;
  siglas: Record<string, string>;
}

const POR_PAGINA = 20;

/** Votos de uma deliberação de comissão, na ordem publicada pela fonte. */
function VotosComissao({ a, l, aberto, ctx }: { a: ArquivoVotacoes; l: LinhaVotacao; aberto: boolean; ctx: ContextoCasa }) {
  const votos = l[12] ?? [];
  if (!votos.length) return null;
  return (
    <details className="cartao-decisao__acima rounded-md border border-borda bg-superficie" open={aberto}>
      <summary className="pr-3">Ver {votos.length === 1 ? "o voto registrado" : `os ${votos.length} votos registrados`}</summary>
      <div className="border-t border-borda px-3 pb-3 pt-2">
        {l[13] ? <p className="meta">Presidente da votação, segundo a fonte: {l[13]}</p> : null}
        <ul className="mt-1 divide-y divide-[var(--cor-borda)]">
          {votos.map(([ni, ti], k) => {
            const [nome, pid] = a.n[ni] ?? ["", null];
            return (
              <li key={k} className="flex flex-wrap justify-between gap-x-3 py-2">
                {pid ? (
                  <Link href={`${ctx.base}/deputados/${pid}`} prefetch={false} className="lk inline-flex min-h-11 items-center">
                    {nome}
                  </Link>
                ) : (
                  <span className="inline-flex min-h-11 items-center">{nome}</span>
                )}
                <span className="inline-flex items-center font-semibold">{rotuloVoto(a.t[ti])}</span>
              </li>
            );
          })}
        </ul>
        <p className="meta mt-2">
          Partido na data do voto: não informado pela fonte. Quando a deliberação reúne mais de uma comissão, o mesmo
          deputado pode aparecer mais de uma vez, como publicado.
        </p>
      </div>
    </details>
  );
}

/** Votações da Assembleia (Plenário e comissões): índice estático baixado pelo navegador. */
export function BuscaVotacoes({ ctx }: { ctx: ContextoCasa }) {
  const [a, setA] = useState<(ArquivoVotacoes & { busca: string[] }) | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [onde, setOnde] = useState("");
  const [ano, setAno] = useState("");
  const [orgao, setOrgao] = useState("");
  const [fixo, setFixo] = useState<{ id?: string; p?: string }>({});
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    let ativo = true;
    const lerFixo = () => {
      const h = lerHash();
      if (h.q) setTexto(h.q);
      setFixo(h.id || h.p ? { id: h.id, p: h.p } : {});
    };
    fetch(`/estados/${ctx.uf}/votacoes.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: ArquivoVotacoes) => {
        if (!ativo) return;
        const busca = j.v.map((l) => {
          const p = l[5] >= 0 ? j.p[l[5]] : null;
          return normalizarBusca(`${p?.[1] ?? ""} ${p?.[2] ?? ""} ${l[6]} ${j.o[l[4]] ?? ""}`);
        });
        lerFixo();
        setA({ ...j, busca });
      })
      .catch(() => ativo && setErro(true));
    window.addEventListener("hashchange", lerFixo);
    return () => {
      ativo = false;
      window.removeEventListener("hashchange", lerFixo);
    };
  }, [ctx.uf]);

  const anos = useMemo(() => (a ? [...new Set(a.v.map((l) => l[1].slice(0, 4)).filter(Boolean))].sort().reverse() : []), [a]);
  const orgaos = useMemo(
    () => (a ? [...new Set(a.v.filter((l) => l[3] === 1).map((l) => a.o[l[4]]).filter(Boolean))].sort((x, y) => x.localeCompare(y, "pt-BR")) : []),
    [a],
  );
  const termos = normalizarBusca(texto).split(/\s+/).filter(Boolean);
  const filtradas = a
    ? a.v.filter(
        (l, i) =>
          (!fixo.id || l[0] === fixo.id) &&
          (!fixo.p || (l[5] >= 0 && a.p[l[5]][0] === fixo.p)) &&
          (!onde || String(l[3]) === onde) &&
          (!ano || l[1].startsWith(ano)) &&
          (!orgao || a.o[l[4]] === orgao) &&
          termos.every((t) => a.busca[i].includes(t)),
      )
    : [];
  const resto = filtradas.length - Math.min(limite, filtradas.length);
  const prop = fixo.p && a ? a.p.find((p) => p[0] === fixo.p) : null;

  function com(set: (v: string) => void) {
    return (v: string) => {
      setLimite(POR_PAGINA);
      set(v);
    };
  }

  return (
    <div className="space-y-4">
      <FiltrosCompactos
        busca={{ valor: texto, aoMudar: com(setTexto), rotulo: "Buscar no projeto, na ementa ou na descrição", dica: "Ex.: PL 869/2026, ICMS" }}
        filtros={[
          { id: "onde", rotulo: "Onde foi votado", valor: onde, aoMudar: com(setOnde), opcoes: [{ valor: "0", rotulo: "Plenário" }, { valor: "1", rotulo: "Comissões" }], todos: "Plenário e comissões" },
          { id: "ano", rotulo: "Ano", valor: ano, aoMudar: com(setAno), opcoes: anos },
          ...(orgaos.length ? [{ id: "orgao", rotulo: "Comissão", valor: orgao, aoMudar: com(setOrgao), opcoes: orgaos, todos: "Todas" }] : []),
        ]}
        contagem={
          erro
            ? null
            : !a
              ? "Carregando a lista de votações…"
              : `Mostrando ${Math.min(limite, filtradas.length).toLocaleString("pt-BR")} de ${filtradas.length.toLocaleString("pt-BR")} ${
                  filtradas.length === 1 ? "votação" : "votações"
                }, da mais recente para a mais antiga`
        }
        aoLimpar={() => {
          setTexto("");
          setOnde("");
          setAno("");
          setOrgao("");
          setLimite(POR_PAGINA);
        }}
      />
      {erro ? <p className="lacuna">Não foi possível carregar a lista. Tente recarregar a página.</p> : null}
      {fixo.id || fixo.p ? (
        <p className="aviso">
          {fixo.id ? "Mostrando só a votação indicada no link." : `Mostrando só as votações sobre ${prop?.[1] ?? "a proposição indicada no link"}.`}{" "}
          <button
            type="button"
            className="botao mt-2"
            onClick={() => {
              setFixo({});
              history.replaceState(null, "", window.location.pathname);
            }}
          >
            Ver todas as votações
          </button>
        </p>
      ) : null}

      <ul className="space-y-3">
        {a
          ? filtradas.slice(0, limite).map((l) => {
              const p = l[5] >= 0 ? a.p[l[5]] : null;
              const plen = l[3] === 0;
              const nome = nomeProposicao(p?.[1] ?? null, ctx.siglas);
              const local = plen ? "votação em Plenário" : `votação em comissão${a.o[l[4]] ? `: ${a.o[l[4]]}` : ""}`;
              return (
                <CartaoDecisao
                  key={l[0]}
                  as="li"
                  href={plen ? `${ctx.base}/votacoes/${l[0]}` : `${ctx.base}/votacoes#id=${l[0]}`}
                  tituloOficial={p?.[2] || l[6] || "Ementa não disponível em fonte oficial"}
                  subtituloOficial={[nome ?? "Proposição não informada", local].join(" · ")}
                  caminho={ctx.caminho}
                  rotuloCaminho={ctx.rotuloCaminho}
                  data={l[1] || null}
                  rotuloData="votado em"
                  forma={plen ? formaDecisao(l[9]) : l[12]?.length ? "votacao-nominal" : formaDecisao(l[9])}
                  dado={dadoVotacao({ forma: l[9], placar: l[8], resultado: l[7], descricao: l[6], plenario: plen })}
                  quemDecidiu={plen ? `${ctx.membros[0].toUpperCase()}${ctx.membros.slice(1)} (${ctx.casaSigla})` : `Membros da comissão (${ctx.casaSigla})`}
                  fonte={l[11] ? { url: l[11], titulo: plen ? "Registro oficial da votação" : "Página da proposição", orgao: ctx.casaSigla, acessado_em: l[14], tipo: /\.pdf($|\?)/i.test(l[11]) ? "pdf" : "oficial" } : null}
                  compartilhar={plen}
                >
                  {plen ? (
                    <p className="text-[var(--cor-secundaria)]">
                      {l[15] ? `${l[15]}. ` : ""}
                      {l[10] ? `${l[10].toLocaleString("pt-BR")} votos individuais publicados.` : l[9] === "nominal" ? "Votos individuais não publicados." : "Sem voto individual registrado."}
                      {l[6] && p ? ` Descrição oficial: ${l[6]}` : ""}
                    </p>
                  ) : (
                    <VotosComissao a={a} l={l} aberto={fixo.id === l[0]} ctx={ctx} />
                  )}
                </CartaoDecisao>
              );
            })
          : null}
      </ul>
      {resto > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="botao" onClick={() => setLimite((n) => n + POR_PAGINA)}>
            Mostrar mais {Math.min(POR_PAGINA, resto).toLocaleString("pt-BR")}
          </button>
          <button type="button" className="botao" onClick={() => setLimite(filtradas.length)}>
            Mostrar todas ({filtradas.length.toLocaleString("pt-BR")})
          </button>
        </div>
      ) : null}
    </div>
  );
}
