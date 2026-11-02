"use client";

import Link from "next/link";
import { useId, useMemo, useState, type ReactNode } from "react";
import { formatarData, normalizar } from "@/features/congresso/rotulos";

export interface ItemFiltravel {
  id: string;
  href: string;
  titulo: string;
  data: string | null;
  ano: string;
  /** Valor do filtro de situação/categoria. */
  grupo: string;
  /** Etiquetas exibidas no cartão (texto). */
  etiquetas: string[];
  texto: string | null;
  detalhe?: string | null;
}

const CAMPO = "mt-1 block w-full rounded border border-[#7b8794] bg-white px-2 py-1.5 text-sm text-gray-900";
const POR_PAGINA = 40;

/**
 * Lista filtrável no navegador (ano, grupo e busca no texto), em ordem cronológica decrescente.
 * Usada nas listas de medidas provisórias e de vetos. Nada do que é digitado sai do navegador.
 */
export function FiltroLista({
  itens,
  rotuloGrupo,
  grupos,
  rotuloBusca,
  exemplo,
  vazio,
}: {
  itens: ItemFiltravel[];
  rotuloGrupo: string;
  grupos: string[];
  rotuloBusca: string;
  exemplo: string;
  vazio: ReactNode;
}) {
  const base = useId();
  const [texto, setTexto] = useState("");
  const [ano, setAno] = useState("");
  const [grupo, setGrupo] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  const anos = useMemo(() => [...new Set(itens.map((i) => i.ano).filter(Boolean))].sort().reverse(), [itens]);
  const indice = useMemo(() => itens.map((i) => normalizar(`${i.titulo} ${i.texto ?? ""} ${i.detalhe ?? ""}`)), [itens]);
  const termos = normalizar(texto).split(/\s+/).filter(Boolean);
  const filtrados = itens.filter(
    (i, n) => (!ano || i.ano === ano) && (!grupo || i.grupo === grupo) && termos.every((t) => indice[n].includes(t)),
  );

  function mudar(set: (v: string) => void) {
    return (e: { target: { value: string } }) => {
      setLimite(POR_PAGINA);
      set(e.target.value);
    };
  }

  if (!itens.length) return <>{vazio}</>;

  return (
    <div>
      <form role="search" aria-label={rotuloBusca} onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <label htmlFor={`${base}-t`} className="text-sm font-medium text-gray-900">
            {rotuloBusca}
            <input id={`${base}-t`} type="search" value={texto} onChange={mudar(setTexto)} placeholder={exemplo} className={CAMPO} />
          </label>
          <label htmlFor={`${base}-a`} className="text-sm font-medium text-gray-900">
            Ano
            <select id={`${base}-a`} value={ano} onChange={mudar(setAno)} className={CAMPO}>
              <option value="">Todos</option>
              {anos.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label htmlFor={`${base}-g`} className="text-sm font-medium text-gray-900">
            {rotuloGrupo}
            <select id={`${base}-g`} value={grupo} onChange={mudar(setGrupo)} className={CAMPO}>
              <option value="">Todas</option>
              {grupos.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
      </form>
      <p className="meta mt-3" aria-live="polite">
        {filtrados.length === 1 ? "1 encontrado" : `${filtrados.length} encontrados`}, do mais recente para o mais antigo.
      </p>
      <ul className="mt-3 space-y-3">
        {filtrados.slice(0, limite).map((i) => (
          <li key={i.id} className="cartao">
            <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-gray-900">{formatarData(i.data)}</span>
              {i.etiquetas.map((e) => (
                <span key={e} className="selo">
                  {e}
                </span>
              ))}
            </p>
            <h3 className="mt-2 text-base font-semibold text-gray-900">
              <Link href={i.href} prefetch={false} className="lk">
                {i.titulo}
              </Link>
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-800">{i.texto || "Ementa não disponível em fonte oficial"}</p>
            {i.detalhe ? <p className="meta mt-1">{i.detalhe}</p> : null}
          </li>
        ))}
      </ul>
      {filtrados.length > limite ? (
        <button
          type="button"
          onClick={() => setLimite((n) => n + POR_PAGINA)}
          className="mt-4 rounded border border-[#7b8794] bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-superficie"
        >
          Mostrar mais {Math.min(POR_PAGINA, filtrados.length - limite)} de {filtrados.length - limite} restantes
        </button>
      ) : null}
    </div>
  );
}
