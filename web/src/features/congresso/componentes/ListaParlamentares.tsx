"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { normalizar } from "../rotulos";

export interface LinhaParlamentar {
  id: string;
  nome: string;
  partido: string | null;
  uf: string | null;
  href: string;
  naListaAtual: boolean;
  nominais: number;
}

const CAMPO = "mt-1 block w-full rounded border border-[#7b8794] bg-white px-2 py-1.5 text-sm text-gray-900";

function opcoes(v: (string | null)[]) {
  return [...new Set(v.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Lista de parlamentares em ordem alfabética, com busca por nome e filtros por partido e estado. */
export function ListaParlamentares({
  linhas,
  legenda,
  rotuloForaDaLista,
}: {
  linhas: LinhaParlamentar[];
  legenda: string;
  rotuloForaDaLista: string;
}) {
  const base = useId();
  const [busca, setBusca] = useState("");
  const [partido, setPartido] = useState("");
  const [uf, setUf] = useState("");
  const [incluirFora, setIncluirFora] = useState(false);

  const ordenadas = useMemo(() => [...linhas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [linhas]);
  const universo = incluirFora ? ordenadas : ordenadas.filter((l) => l.naListaAtual);
  const opPartido = useMemo(() => opcoes(universo.map((l) => l.partido)), [universo]);
  const opUf = useMemo(() => opcoes(universo.map((l) => l.uf)), [universo]);
  const nFora = linhas.filter((l) => !l.naListaAtual).length;

  const termo = normalizar(busca).trim();
  const filtradas = universo.filter(
    (l) =>
      (!partido || l.partido === partido) &&
      (!uf || l.uf === uf) &&
      (!termo || normalizar(l.nome).includes(termo)),
  );

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label htmlFor={`${base}-b`} className="text-sm font-medium text-gray-900">
          Buscar pelo nome
          <input id={`${base}-b`} type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className={CAMPO} />
        </label>
        <label htmlFor={`${base}-p`} className="text-sm font-medium text-gray-900">
          Partido
          <select id={`${base}-p`} value={partido} onChange={(e) => setPartido(e.target.value)} className={CAMPO}>
            <option value="">Todos</option>
            {opPartido.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label htmlFor={`${base}-u`} className="text-sm font-medium text-gray-900">
          Estado (UF)
          <select id={`${base}-u`} value={uf} onChange={(e) => setUf(e.target.value)} className={CAMPO}>
            <option value="">Todos</option>
            {opUf.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
      </div>
      {nFora ? (
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-900">
          <input
            type="checkbox"
            checked={incluirFora}
            onChange={(e) => setIncluirFora(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            {rotuloForaDaLista} ({nFora})
          </span>
        </label>
      ) : null}
      <p className="meta mt-2" aria-live="polite">
        Mostrando {filtradas.length} de {universo.length}, em ordem alfabética.
      </p>
      <div className="mt-2 max-h-[40rem] overflow-auto rounded border border-borda" tabIndex={0} role="region" aria-label={legenda}>
        <table className="tabela">
          <caption className="sr-only">{legenda}</caption>
          <thead className="sticky top-0">
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">Partido</th>
              <th scope="col">Estado</th>
              <th scope="col">Votações nominais com registro</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={l.href} prefetch={false} className="lk">
                    {l.nome}
                  </Link>
                  {!l.naListaAtual ? <span className="meta block">Fora da lista atual de em exercício</span> : null}
                </td>
                <td>{l.partido ?? "Não informado"}</td>
                <td>{l.uf ?? "Não informado"}</td>
                <td>{l.nominais}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtradas.length ? <p className="p-3 text-sm text-gray-800">Nenhum parlamentar com esses filtros.</p> : null}
      </div>
    </div>
  );
}
