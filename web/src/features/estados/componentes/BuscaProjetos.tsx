"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SeloFonte } from "@/components/decisao";
import { NomeProprio, TextoComSiglas } from "@/components/glossario";
import { FiltrosCompactos, normalizarBusca } from "@/components/tabela";
import { NAO_DISPONIVEL, formatarData, lerHash, nomeSigla } from "../rotulos";
import type { ContextoCasa } from "./BuscaVotacoes";
import { MostrarMais } from "@/components/lista/MostrarMais";

type Linha = [
  id: string,
  sigla: string,
  numero: number,
  ano: number,
  ementa: string,
  data: string,
  autores: string,
  etapa: string | null,
  ultData: string | null,
  ultDescricao: string | null,
  url: string | null,
  urlNorma: string | null,
  temComissao: 0 | 1,
  plenario: string[],
  coletadoEm: string | null,
];

const POR_PAGINA = 20;

/** Proposições da Assembleia: índice estático baixado pelo navegador; a busca roda nele. */
export function BuscaProjetos({ ctx }: { ctx: ContextoCasa }) {
  const [dados, setDados] = useState<{ p: Linha[]; siglas: Record<string, string>; busca: string[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [sigla, setSigla] = useState("");
  const [ano, setAno] = useState("");
  const [fixo, setFixo] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    let ativo = true;
    const lerFixo = () => {
      const h = lerHash();
      if (h.q) setTexto(h.q);
      setFixo(h.id ?? "");
    };
    fetch(`/estados/${ctx.uf}/projetos.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { p: Linha[]; siglas?: Record<string, string> }) => {
        if (!ativo) return;
        lerFixo();
        setDados({ p: j.p, siglas: { ...ctx.siglas, ...(j.siglas ?? {}) }, busca: j.p.map((l) => normalizarBusca(`${l[1]} ${l[2]}/${l[3]} ${l[4]} ${l[6]}`)) });
      })
      .catch(() => ativo && setErro(true));
    window.addEventListener("hashchange", lerFixo);
    return () => {
      ativo = false;
      window.removeEventListener("hashchange", lerFixo);
    };
  }, [ctx.uf, ctx.siglas]);

  const anos = useMemo(() => (dados ? [...new Set(dados.p.map((l) => String(l[3])))].sort().reverse() : []), [dados]);
  const opSiglas = useMemo(
    () => (dados ? [...new Set(dados.p.map((l) => l[1]))].sort().map((s) => ({ valor: s, rotulo: nomeSigla(s, dados.siglas) ?? s })) : []),
    [dados],
  );
  const termos = normalizarBusca(texto).split(/\s+/).filter(Boolean);
  const filtradas = dados
    ? dados.p.filter((l, i) => (!fixo || l[0] === fixo) && (!sigla || l[1] === sigla) && (!ano || String(l[3]) === ano) && termos.every((t) => dados.busca[i].includes(t)))
    : [];
  const resto = filtradas.length - Math.min(limite, filtradas.length);

  function com(set: (v: string) => void) {
    return (v: string) => {
      setLimite(POR_PAGINA);
      set(v);
    };
  }

  return (
    <div className="space-y-4">
      <FiltrosCompactos
        busca={{ valor: texto, aoMudar: com(setTexto), rotulo: "Buscar na ementa, no número ou no autor", dica: "Ex.: ICMS, 869/2026" }}
        filtros={[
          { id: "sigla", rotulo: "Tipo", valor: sigla, aoMudar: com(setSigla), opcoes: opSiglas },
          { id: "ano", rotulo: "Ano de apresentação", valor: ano, aoMudar: com(setAno), opcoes: anos },
        ]}
        contagem={
          erro
            ? null
            : !dados
              ? "Carregando a lista de projetos…"
              : `Mostrando ${Math.min(limite, filtradas.length).toLocaleString("pt-BR")} de ${filtradas.length.toLocaleString("pt-BR")} ${
                  filtradas.length === 1 ? "projeto" : "projetos"
                }, do mais recente para o mais antigo`
        }
        aoLimpar={() => {
          setTexto("");
          setSigla("");
          setAno("");
          setLimite(POR_PAGINA);
        }}
      />
      {erro ? <p className="lacuna">Não foi possível carregar a lista. Tente recarregar a página.</p> : null}
      {fixo ? (
        <p className="aviso">
          Mostrando só o projeto indicado no link.{" "}
          <button
            type="button"
            className="botao mt-2"
            onClick={() => {
              setFixo("");
              history.replaceState(null, "", window.location.pathname);
            }}
          >
            Ver todos os projetos
          </button>
        </p>
      ) : null}

      <ul className="space-y-3">
        {dados
          ? filtradas.slice(0, limite).map((l) => (
              <li key={l[0]} className="cartao">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--cor-secundaria)]">
                  <span className="selo">{nomeSigla(l[1], dados.siglas)}</span>
                  <span>apresentado em {formatarData(l[5])}</span>
                </p>
                <h3 className="mt-2 text-lg font-semibold leading-snug">{l[4] ? <TextoComSiglas>{l[4]}</TextoComSiglas> : "Ementa não disponível em fonte oficial"}</h3>
                <p className="mt-1 text-[var(--cor-secundaria)]">
                  {nomeSigla(l[1], dados.siglas)?.replace(/\s*\([^)]*\)$/, "")} {l[2]}/{l[3]}
                </p>
                <dl className="mt-2 space-y-1">
                  <div>
                    <dt className="inline font-semibold">Autoria: </dt>
                    <dd className="inline">{l[6] ? <NomeProprio>{l[6]}</NomeProprio> : NAO_DISPONIVEL}</dd>
                  </div>
                  {l[7] ? (
                    <div>
                      <dt className="inline font-semibold">Etapa: </dt>
                      <dd className="inline">{l[7]}</dd>
                    </div>
                  ) : null}
                  {l[8] || l[9] ? (
                    <div>
                      <dt className="inline font-semibold">Última tramitação{l[8] ? ` (${formatarData(l[8])})` : ""}: </dt>
                      <dd className="inline">{l[9] ? <TextoComSiglas>{l[9]}</TextoComSiglas> : NAO_DISPONIVEL}</dd>
                    </div>
                  ) : null}
                </dl>
                {l[13].length || l[12] ? (
                  <ul className="mt-2 flex flex-wrap gap-x-4">
                    {l[13].map((id, k) => (
                      <li key={id}>
                        <Link href={`${ctx.base}/votacoes/${id}`} prefetch={false} className="lk inline-flex min-h-11 items-center">
                          Votação em Plenário{l[13].length > 1 ? ` (${k + 1})` : ""}
                        </Link>
                      </li>
                    ))}
                    {l[12] ? (
                      <li>
                        <Link href={`${ctx.base}/votacoes#p=${l[0]}`} prefetch={false} className="lk inline-flex min-h-11 items-center">
                          Votações em comissões
                        </Link>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-x-4">
                  {l[10] ? <SeloFonte compacto fonte={{ url: l[10], titulo: "Página do projeto", orgao: `Página do projeto (${ctx.casaSigla})`, acessado_em: l[14] }} /> : null}
                  {l[11] ? <SeloFonte compacto fonte={{ url: l[11], orgao: "Norma publicada" }} /> : null}
                  {!l[10] && !l[11] ? <p className="lacuna mt-2">Link oficial não disponível na fonte.</p> : null}
                </div>
              </li>
            ))
          : null}
      </ul>
      <MostrarMais
        visiveis={filtradas.length - resto}
        total={filtradas.length}
        passo={POR_PAGINA}
        itens={{ singular: "projeto", plural: "projetos" }}
        genero="m"
        aoMostrar={setLimite}
      />
    </div>
  );
}
