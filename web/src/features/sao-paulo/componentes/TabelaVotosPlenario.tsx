"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { normalizar } from "@/features/congresso/rotulos";
import { compararVotosSp, rotuloVotoSp } from "../rotulos";

export interface LinhaVotoPlenario {
  nome: string;
  partido: string | null;
  voto: string;
  marcador: string | null;
  /** Id do deputado, só quando o nome impresso é idêntico ao da lista oficial. */
  pid: string | null;
  /** Verdadeiro quando o nome impresso não tem correspondência exata na lista oficial. */
  semCorrespondencia: boolean;
}

const CAMPO = "mt-1 block w-full rounded border border-[var(--cor-borda-forte)] bg-white px-2 py-1.5 text-sm text-gray-900";

function opcoes(v: (string | null)[], ordenar = (a: string, b: string) => a.localeCompare(b, "pt-BR")) {
  return [...new Set(v.filter((x): x is string => !!x))].sort(ordenar);
}

/** Votos individuais de uma votação de Plenário, em ordem alfabética, com busca e filtros. */
export function TabelaVotosPlenario({ linhas }: { linhas: LinhaVotoPlenario[] }) {
  const base = useId();
  const [busca, setBusca] = useState("");
  const [partido, setPartido] = useState("");
  const [voto, setVoto] = useState("");
  const ordenadas = useMemo(() => [...linhas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [linhas]);
  const opPartido = useMemo(() => opcoes(linhas.map((l) => l.partido)), [linhas]);
  const opVoto = useMemo(() => opcoes(linhas.map((l) => l.voto), compararVotosSp), [linhas]);
  const termo = normalizar(busca).trim();
  const filtradas = ordenadas.filter(
    (l) => (!partido || l.partido === partido) && (!voto || l.voto === voto) && (!termo || normalizar(l.nome).includes(termo)),
  );

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label htmlFor={`${base}-b`} className="text-sm font-medium text-gray-900">
          Buscar pelo nome
          <input id={`${base}-b`} type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className={CAMPO} />
        </label>
        <label htmlFor={`${base}-p`} className="text-sm font-medium text-gray-900">
          Partido ou federação
          <select id={`${base}-p`} value={partido} onChange={(e) => setPartido(e.target.value)} className={CAMPO}>
            <option value="">Todos</option>
            {opPartido.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label htmlFor={`${base}-v`} className="text-sm font-medium text-gray-900">
          Voto
          <select id={`${base}-v`} value={voto} onChange={(e) => setVoto(e.target.value)} className={CAMPO}>
            <option value="">Todos</option>
            {opVoto.map((o) => (
              <option key={o} value={o}>
                {rotuloVotoSp(o)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="meta mt-2" aria-live="polite">
        Mostrando {filtradas.length} de {linhas.length}, em ordem alfabética.
      </p>
      <div className="mt-2 max-h-[36rem] overflow-auto rounded border border-borda" tabIndex={0} role="region" aria-label="Votos individuais">
        <table className="tabela">
          <caption className="sr-only">Votos individuais, em ordem alfabética</caption>
          <thead className="sticky top-0">
            <tr>
              <th scope="col">Deputado (como impresso)</th>
              <th scope="col">Partido</th>
              <th scope="col">Voto</th>
              <th scope="col">Letra antes do nome</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((l, i) => (
              <tr key={`${l.nome}-${i}`}>
                <td>
                  {l.pid ? (
                    <Link href={`/sao-paulo/deputados/${l.pid}`} prefetch={false} className="lk">
                      {l.nome}
                    </Link>
                  ) : (
                    <>
                      {l.nome}
                      <span className="meta block">
                        {l.semCorrespondencia
                          ? "Como impresso no documento, sem correspondência exata na lista oficial; sem link"
                          : "Fora da lista atual de deputados em exercício; sem perfil"}
                      </span>
                    </>
                  )}
                </td>
                <td>{l.partido ?? "Não informado"}</td>
                <td>{rotuloVotoSp(l.voto)}</td>
                <td>{l.marcador ? `${l.marcador} (sem legenda no documento)` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtradas.length ? <p className="p-3 text-sm text-gray-800">Nenhum registro com esses filtros.</p> : null}
      </div>
    </div>
  );
}
