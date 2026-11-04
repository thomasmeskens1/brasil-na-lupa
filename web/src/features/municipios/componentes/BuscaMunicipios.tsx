"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MostrarMais } from "@/components/lista/MostrarMais";
import { FiltrosCompactos, normalizarBusca } from "@/components/tabela";

/** Linha de public/municipios/lista.json: [uf, cidade, nome, flags, capital]. */
type Linha = [string, string, string, number, number];
export const F_VOTACOES = 1;
export const F_LEIS = 2;
export const F_FINANCAS = 4;
export const F_CAMARA = 8;

export interface OpcaoUf {
  uf: string;
  sigla: string;
  nome: string;
}

const COM_DADOS = [
  { valor: "qualquer", rotulo: "Qualquer dado coletado" },
  { valor: "votacoes", rotulo: "Votações da Câmara" },
  { valor: "leis", rotulo: "Leis e decretos" },
  { valor: "financas", rotulo: "Finanças" },
  { valor: "em-breve", rotulo: "Ainda sem dados (em breve)" },
];

function passa(flags: number, filtro: string): boolean {
  if (!filtro) return true;
  if (filtro === "qualquer") return flags > 0;
  if (filtro === "em-breve") return flags === 0;
  if (filtro === "votacoes") return (flags & F_VOTACOES) > 0;
  if (filtro === "leis") return (flags & F_LEIS) > 0;
  if (filtro === "financas") return (flags & F_FINANCAS) > 0;
  return true;
}

function oQueTem(flags: number): string {
  const p = [flags & F_VOTACOES ? "votações" : null, flags & F_CAMARA && !(flags & F_VOTACOES) ? "Câmara" : null, flags & F_LEIS ? "leis" : null, flags & F_FINANCAS ? "finanças" : null].filter(Boolean);
  return p.length ? `Com dados de ${p.join(", ")}` : "Em breve";
}

/** Busca por nome e UF entre todos os municípios; a lista é baixada e filtrada no navegador. */
export function BuscaMunicipios({ ufs }: { ufs: OpcaoUf[] }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState("");
  const [com, setCom] = useState("");
  const [limite, setLimite] = useState(60);

  useEffect(() => {
    let vivo = true;
    fetch("/municipios/lista.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { m: Linha[] }) => vivo && setLinhas(d.m ?? []))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, []);

  const siglas = useMemo(() => new Map(ufs.map((u) => [u.uf, u.sigla])), [ufs]);
  const filtradas = useMemo(() => {
    const q = normalizarBusca(busca.trim());
    return (linhas ?? []).filter(([u, , nome, flags]) => (!uf || u === uf) && passa(flags, com) && (!q || normalizarBusca(nome).includes(q)));
  }, [linhas, busca, uf, com]);
  const visiveis = filtradas.slice(0, limite);

  if (erro) return <p className="lacuna">Não foi possível carregar a lista de municípios. Tente recarregar a página.</p>;

  return (
    <div className="space-y-4">
      <FiltrosCompactos
        busca={{ valor: busca, aoMudar: (v) => (setBusca(v), setLimite(60)), rotulo: "Buscar pelo nome do município", dica: "Ex.: Atibaia" }}
        filtros={[
          { id: "uf", rotulo: "Estado (UF)", valor: uf, aoMudar: (v) => (setUf(v), setLimite(60)), opcoes: ufs.filter((u) => u.uf !== "df").map((u) => ({ valor: u.uf, rotulo: u.nome })) },
          { id: "com", rotulo: "Com dados de", valor: com, aoMudar: (v) => (setCom(v), setLimite(60)), opcoes: COM_DADOS, todos: "Todos os municípios" },
        ]}
        contagem={linhas ? `Mostrando ${visiveis.length.toLocaleString("pt-BR")} de ${filtradas.length.toLocaleString("pt-BR")} municípios` : "Carregando a lista de municípios…"}
        aoLimpar={() => {
          setBusca("");
          setUf("");
          setCom("");
          setLimite(60);
        }}
      />
      {linhas && !filtradas.length ? <p className="lacuna">Nenhum município encontrado com esses filtros.</p> : null}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visiveis.map(([u, slug, nome, flags]) => {
          const sigla = siglas.get(u) ?? u.toUpperCase();
          const corpo = (
            <>
              <span className="block font-semibold leading-snug text-foreground">
                {nome} <span className="font-normal text-[var(--cor-texto-apoio)]">({sigla})</span>
              </span>
              <span className="block text-sm text-[var(--cor-texto-apoio)]">{oQueTem(flags)}</span>
            </>
          );
          return (
            <li key={`${u}/${slug}`}>
              {flags ? (
                <Link href={`/municipios/${u}/${slug}`} prefetch={false} className="bloco-secao min-h-11 flex-col gap-1">
                  {corpo}
                </Link>
              ) : (
                <div className="bloco-secao min-h-11 flex-col gap-1">{corpo}</div>
              )}
            </li>
          );
        })}
      </ul>
      {linhas ? <MostrarMais visiveis={visiveis.length} total={filtradas.length} passo={60} itens={{ singular: "município", plural: "municípios" }} aoMostrar={setLimite} todos={false} /> : null}
    </div>
  );
}
