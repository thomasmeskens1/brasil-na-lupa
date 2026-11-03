"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { Casa } from "../tipos";
import { compararVotos, normalizar, rotaParlamentar, rotuloVoto } from "../rotulos";

export interface LinhaRegistro {
  nome: string;
  partido: string | null;
  uf: string | null;
  /** Voto (votação nominal) ou registro de comparecimento (votação secreta). */
  valor: string | null;
  /** Id do parlamentar, quando há página de perfil. */
  pid?: string | null;
}

const CAMPO = "mt-1 block w-full rounded border border-[var(--cor-borda-forte)] bg-white px-2 py-1.5 text-sm text-gray-900";

function opcoes(valores: (string | null)[], ordenar = (a: string, b: string) => a.localeCompare(b, "pt-BR")) {
  return [...new Set(valores.filter((v): v is string => !!v))].sort(ordenar);
}

/**
 * Tabela de votos (ou de registros de comparecimento) em ordem alfabética, com busca por
 * nome e filtros por partido, estado e voto. Rola dentro do próprio contêiner.
 */
export function TabelaRegistros({
  casa,
  linhas,
  legenda,
  rotuloValor = "Voto",
}: {
  casa: Casa;
  linhas: LinhaRegistro[];
  legenda: string;
  rotuloValor?: string;
}) {
  const base = useId();
  const [busca, setBusca] = useState("");
  const [valor, setValor] = useState("");
  const [partido, setPartido] = useState("");
  const [uf, setUf] = useState("");

  const ordenadas = useMemo(() => [...linhas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [linhas]);
  const opValor = useMemo(() => opcoes(linhas.map((l) => l.valor), compararVotos), [linhas]);
  const opPartido = useMemo(() => opcoes(linhas.map((l) => l.partido)), [linhas]);
  const opUf = useMemo(() => opcoes(linhas.map((l) => l.uf)), [linhas]);

  const termo = normalizar(busca).trim();
  const filtradas = ordenadas.filter(
    (l) =>
      (!valor || l.valor === valor) &&
      (!partido || l.partido === partido) &&
      (!uf || l.uf === uf) &&
      (!termo || normalizar(l.nome).includes(termo)),
  );

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <label htmlFor={`${base}-v`} className="text-sm font-medium text-gray-900">
          {rotuloValor}
          <select id={`${base}-v`} value={valor} onChange={(e) => setValor(e.target.value)} className={CAMPO}>
            <option value="">Todos</option>
            {opValor.map((o) => (
              <option key={o} value={o}>
                {rotuloVoto(o)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="meta mt-2" aria-live="polite">
        Mostrando {filtradas.length} de {linhas.length}, em ordem alfabética.
      </p>
      <div
        className="mt-2 max-h-[32rem] overflow-auto rounded border border-borda"
        tabIndex={0}
        role="region"
        aria-label={legenda}
      >
        <table className="tabela">
          <caption className="sr-only">{legenda}</caption>
          <thead className="sticky top-0">
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">Partido</th>
              <th scope="col">Estado</th>
              <th scope="col">{rotuloValor}</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((l, i) => (
              <tr key={`${l.nome}-${i}`}>
                <td>
                  {l.pid ? (
                    <Link href={rotaParlamentar(casa, l.pid)} prefetch={false} className="lk">
                      {l.nome}
                    </Link>
                  ) : (
                    l.nome
                  )}
                </td>
                <td>{l.partido ?? "Não informado"}</td>
                <td>{l.uf ?? "Não informado"}</td>
                <td>{rotuloVoto(l.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtradas.length ? <p className="p-3 text-sm text-gray-800">Nenhum registro com esses filtros.</p> : null}
      </div>
    </div>
  );
}
