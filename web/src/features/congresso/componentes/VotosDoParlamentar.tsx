"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { Casa } from "../tipos";
import { compararVotos, formatarData, normalizar, rotaVotacao, rotuloResultadoCurto, rotuloVoto } from "../rotulos";

export interface LinhaVotoParlamentar {
  /** Id da votação. */
  id: string;
  data: string | null;
  titulo: string | null;
  descricao: string | null;
  voto: string | null;
  resultado: string | null;
}

const CAMPO = "mt-1 block w-full rounded border border-[#7b8794] bg-white px-2 py-1.5 text-sm text-gray-900";
const POR_PAGINA = 50;

/** Votos de um parlamentar nas votações nominais, da mais recente para a mais antiga. */
export function VotosDoParlamentar({
  casa,
  linhas,
  legenda,
}: {
  casa: Casa;
  linhas: LinhaVotoParlamentar[];
  legenda: string;
}) {
  const base = useId();
  const [busca, setBusca] = useState("");
  const [voto, setVoto] = useState("");
  const [ano, setAno] = useState("");
  const [resultado, setResultado] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  const indexadas = useMemo(
    () => linhas.map((l) => ({ ...l, texto: normalizar(`${l.titulo ?? ""} ${l.descricao ?? ""}`) })),
    [linhas],
  );
  const opVoto = useMemo(
    () => [...new Set(linhas.map((l) => l.voto).filter((v): v is string => !!v))].sort(compararVotos),
    [linhas],
  );
  const opAno = useMemo(
    () => [...new Set(linhas.map((l) => l.data?.slice(0, 4)).filter((v): v is string => !!v))].sort().reverse(),
    [linhas],
  );

  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  const filtradas = indexadas.filter(
    (l) =>
      (!voto || l.voto === voto) &&
      (!ano || l.data?.startsWith(ano)) &&
      (!resultado || (resultado === "nao-informado" ? !l.resultado : l.resultado === resultado)) &&
      termos.every((t) => l.texto.includes(t)),
  );
  const visiveis = filtradas.slice(0, limite);

  function mudar(set: (v: string) => void) {
    return (e: { target: { value: string } }) => {
      setLimite(POR_PAGINA);
      set(e.target.value);
    };
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label htmlFor={`${base}-b`} className="text-sm font-medium text-gray-900">
          Buscar na proposição ou no texto
          <input id={`${base}-b`} type="search" value={busca} onChange={mudar(setBusca)} className={CAMPO} />
        </label>
        <label htmlFor={`${base}-v`} className="text-sm font-medium text-gray-900">
          Voto
          <select id={`${base}-v`} value={voto} onChange={mudar(setVoto)} className={CAMPO}>
            <option value="">Todos</option>
            {opVoto.map((o) => (
              <option key={o} value={o}>
                {rotuloVoto(o)}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${base}-a`} className="text-sm font-medium text-gray-900">
          Ano
          <select id={`${base}-a`} value={ano} onChange={mudar(setAno)} className={CAMPO}>
            <option value="">Todos</option>
            {opAno.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label htmlFor={`${base}-r`} className="text-sm font-medium text-gray-900">
          Resultado da votação
          <select id={`${base}-r`} value={resultado} onChange={mudar(setResultado)} className={CAMPO}>
            <option value="">Todos</option>
            <option value="aprovada">Aprovada</option>
            <option value="rejeitada">Rejeitada</option>
            <option value="nao-informado">Não informado na fonte</option>
          </select>
        </label>
      </div>
      <p className="meta mt-2" aria-live="polite">
        {filtradas.length === 1 ? "1 votação" : `${filtradas.length} votações`} de {linhas.length}, da mais recente para a
        mais antiga.
      </p>
      <div className="mt-2 overflow-x-auto rounded border border-borda" tabIndex={0} role="region" aria-label={legenda}>
        <table className="tabela min-w-[40rem]">
          <caption className="sr-only">{legenda}</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Proposição e o que foi votado</th>
              <th scope="col">Voto</th>
              <th scope="col">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{formatarData(l.data)}</td>
                <td>
                  <Link href={rotaVotacao(casa, l.id)} prefetch={false} className="lk font-medium">
                    {l.titulo ?? "Proposição não informada"}
                  </Link>
                  <span className="mt-0.5 block text-gray-800">{l.descricao || "Descrição não disponível em fonte oficial"}</span>
                </td>
                <td className="font-semibold">{rotuloVoto(l.voto)}</td>
                <td>{rotuloResultadoCurto(l.resultado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtradas.length ? <p className="p-3 text-sm text-gray-800">Nenhuma votação com esses filtros.</p> : null}
      </div>
      {filtradas.length > limite ? (
        <button
          type="button"
          onClick={() => setLimite((n) => n + POR_PAGINA)}
          className="mt-3 rounded border border-[#7b8794] bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-superficie"
        >
          Mostrar mais {Math.min(POR_PAGINA, filtradas.length - limite)} de {filtradas.length - limite} restantes
        </button>
      ) : null}
    </div>
  );
}
