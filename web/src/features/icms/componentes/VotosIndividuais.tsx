"use client";

import { useId, useMemo, useState } from "react";

export interface LinhaVoto {
  nome: string;
  partido: string | null;
  uf: string | null;
  voto: string;
}

/** Tabela dos votos individuais (votação nominal), em ordem alfabética, com filtros. */
export function VotosIndividuais({ votos, legenda }: { votos: LinhaVoto[]; legenda: string }) {
  const base = useId();
  const [busca, setBusca] = useState("");
  const [voto, setVoto] = useState("");
  const [partido, setPartido] = useState("");

  const ordenados = useMemo(() => [...votos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [votos]);
  const opcoesVoto = useMemo(() => [...new Set(votos.map((v) => v.voto))].sort((a, b) => a.localeCompare(b, "pt-BR")), [votos]);
  const opcoesPartido = useMemo(
    () => [...new Set(votos.map((v) => v.partido).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [votos],
  );
  const temUf = votos.some((v) => v.uf);

  const termo = busca
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
  const filtrados = ordenados.filter(
    (v) =>
      (!voto || v.voto === voto) &&
      (!partido || v.partido === partido) &&
      (!termo ||
        v.nome
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .includes(termo)),
  );

  const campo = "mt-1 block w-full rounded border border-[#7b8794] bg-white px-2 py-1.5 text-sm text-gray-900";

  return (
    <div className="mt-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label htmlFor={`${base}-b`} className="text-sm font-medium text-gray-900">
          Buscar pelo nome
          <input id={`${base}-b`} type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className={campo} />
        </label>
        <label htmlFor={`${base}-v`} className="text-sm font-medium text-gray-900">
          Voto
          <select id={`${base}-v`} value={voto} onChange={(e) => setVoto(e.target.value)} className={campo}>
            <option value="">Todos</option>
            {opcoesVoto.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        {opcoesPartido.length ? (
          <label htmlFor={`${base}-p`} className="text-sm font-medium text-gray-900">
            Partido
            <select id={`${base}-p`} value={partido} onChange={(e) => setPartido(e.target.value)} className={campo}>
              <option value="">Todos</option>
              {opcoesPartido.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <p className="meta mt-2" aria-live="polite">
        Mostrando {filtrados.length} de {votos.length} votos, em ordem alfabética.
      </p>
      <div className="mt-2 max-h-[28rem] overflow-auto rounded border border-borda" tabIndex={0} role="region" aria-label={legenda}>
        <table className="tabela">
          <caption className="sr-only">{legenda}</caption>
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">Partido</th>
              {temUf ? <th scope="col">Estado</th> : null}
              <th scope="col">Voto</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((v, i) => (
              <tr key={`${v.nome}-${i}`}>
                <td>{v.nome}</td>
                <td>{v.partido ?? "Não informado"}</td>
                {temUf ? <td>{v.uf ?? "Não informado"}</td> : null}
                <td>{v.voto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
