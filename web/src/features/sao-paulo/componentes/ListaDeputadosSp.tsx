"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { normalizar } from "@/features/congresso/rotulos";
import type { DeputadoSp } from "../tipos";

const CAMPO = "mt-1 block w-full rounded border border-[var(--cor-borda-forte)] bg-white px-2 py-1.5 text-sm text-gray-900";

/** Deputados estaduais em ordem alfabética, com busca por nome e filtro por partido. */
export function ListaDeputadosSp({ deputados }: { deputados: DeputadoSp[] }) {
  const base = useId();
  const [busca, setBusca] = useState("");
  const [partido, setPartido] = useState("");
  const partidos = useMemo(
    () => [...new Set(deputados.map((d) => d.partido).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [deputados],
  );
  const termo = normalizar(busca).trim();
  const filtrados = deputados.filter((d) => (!partido || d.partido === partido) && (!termo || normalizar(d.nome).includes(termo)));

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label htmlFor={`${base}-b`} className="text-sm font-medium text-gray-900">
          Buscar pelo nome
          <input id={`${base}-b`} type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className={CAMPO} />
        </label>
        <label htmlFor={`${base}-p`} className="text-sm font-medium text-gray-900">
          Partido
          <select id={`${base}-p`} value={partido} onChange={(e) => setPartido(e.target.value)} className={CAMPO}>
            <option value="">Todos</option>
            {partidos.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="meta mt-2" aria-live="polite">
        Mostrando {filtrados.length} de {deputados.length}, em ordem alfabética.
      </p>
      <div className="mt-2 max-h-[40rem] overflow-auto rounded border border-borda" tabIndex={0} role="region" aria-label="Deputados estaduais">
        <table className="tabela">
          <caption className="sr-only">Deputados estaduais em exercício, em ordem alfabética</caption>
          <thead className="sticky top-0">
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">Partido</th>
              <th scope="col">
                Votos em Plenário <span className="sr-only">(votações nominais com registro)</span>
              </th>
              <th scope="col">Votos em comissões</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link href={`/sao-paulo/deputados/${d.id}`} prefetch={false} className="lk">
                    {d.nome}
                  </Link>
                </td>
                <td>{d.partido ?? "Não informado"}</td>
                <td>{d.n_plenario}</td>
                <td>{d.n_comissao}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtrados.length ? <p className="p-3 text-sm text-gray-800">Nenhum deputado com esses filtros.</p> : null}
      </div>
    </div>
  );
}
