"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { FonteLink } from "@/components/FonteLink";
import { formatarData, normalizar } from "@/features/congresso/rotulos";
import type { LinhaNorma } from "../tipos";

interface Arquivo {
  tipos: string[];
  n: LinhaNorma[];
}

const CAMPO = "mt-1 block w-full rounded border border-[#7b8794] bg-white px-2 py-1.5 text-sm text-gray-900";
const POR_PAGINA = 30;

/**
 * Leis, leis complementares e decretos: índice estático (public/executivo/normas.json) baixado
 * pelo navegador; busca e filtros rodam localmente.
 */
export function BuscaNormas() {
  const base = useId();
  const [dados, setDados] = useState<{ tipos: string[]; linhas: (LinhaNorma & { _t: string; _b: string })[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("");
  const [ano, setAno] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    let ativo = true;
    fetch("/executivo/normas.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Arquivo) => {
        if (!ativo) return;
        const linhas = j.n.map((l) => {
          const t = typeof l[1] === "number" ? (j.tipos[l[1]] ?? "") : String(l[1]);
          return Object.assign([...l] as LinhaNorma, { _t: t, _b: normalizar(`${l[2] ?? ""} ${l[4]} ${l[5] ?? ""} ${l[8].join(" ")}`) });
        });
        setDados({ tipos: j.tipos, linhas });
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, []);

  const anos = useMemo(() => (dados ? [...new Set(dados.linhas.map((l) => l[3].slice(0, 4)).filter(Boolean))].sort().reverse() : []), [dados]);
  const termos = normalizar(texto).split(/\s+/).filter(Boolean);
  const filtradas = dados
    ? dados.linhas.filter((l) => (!tipo || l._t === tipo) && (!ano || l[3].startsWith(ano)) && termos.every((t) => l._b.includes(t)))
    : [];

  function mudar(set: (v: string) => void) {
    return (e: { target: { value: string } }) => {
      setLimite(POR_PAGINA);
      set(e.target.value);
    };
  }

  return (
    <div>
      <form role="search" aria-label="Buscar leis e decretos" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <label htmlFor={`${base}-t`} className="text-sm font-medium text-gray-900">
            Buscar na ementa, no número ou no projeto de origem
            <input id={`${base}-t`} type="search" value={texto} onChange={mudar(setTexto)} placeholder="Ex.: ICMS, 15.164, PL 3819" className={CAMPO} />
          </label>
          <label htmlFor={`${base}-y`} className="text-sm font-medium text-gray-900">
            Tipo
            <select id={`${base}-y`} value={tipo} onChange={mudar(setTipo)} className={CAMPO}>
              <option value="">Todos</option>
              {(dados?.tipos ?? []).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label htmlFor={`${base}-a`} className="text-sm font-medium text-gray-900">
            Ano de assinatura
            <select id={`${base}-a`} value={ano} onChange={mudar(setAno)} className={CAMPO}>
              <option value="">Todos</option>
              {anos.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>
      </form>

      <div aria-live="polite" className="mt-3">
        {erro ? (
          <p className="lacuna text-sm">Não foi possível carregar a lista. Tente recarregar a página.</p>
        ) : !dados ? (
          <p className="meta">Carregando a lista de leis e decretos…</p>
        ) : (
          <p className="meta">
            {filtradas.length === 1 ? "1 norma encontrada" : `${filtradas.length} normas encontradas`}, da mais recente para a mais antiga.
          </p>
        )}
      </div>

      <ul className="mt-3 space-y-3">
        {filtradas.slice(0, limite).map((l) => (
          <li key={l[0]} className="cartao">
            <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-gray-900">Assinada em {formatarData(l[3])}</span>
              <span className="selo">{l._t}</span>
              <span>{l._t === "Decreto" ? "Ato individual do Presidente da República" : "Aprovada pelo Congresso Nacional"}</span>
            </p>
            <h3 className="mt-2 text-base font-semibold text-gray-900">{l[2] ?? "Nome oficial não informado"}</h3>
            {l[5] ? <p className="meta mt-1">Nome dado pelo Senado: {l[5]}</p> : null}
            <p className="mt-1 text-sm leading-relaxed text-gray-800">{l[4] || "Ementa não disponível em fonte oficial"}</p>
            <dl className="mt-2 space-y-1 text-sm text-gray-800">
              <div>
                <dt className="inline font-medium text-gray-900">Publicação no Diário Oficial da União: </dt>
                <dd className="inline">{l[7].length ? l[7].join("; ") : "Informação não disponível em fonte oficial"}</dd>
              </div>
              {l[8].length ? (
                <div>
                  <dt className="inline font-medium text-gray-900">Projeto de origem: </dt>
                  <dd className="inline">{l[8].join("; ")}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {l[6] ? (
                <FonteLink href={l[6]} tipo="oficial">
                  Texto no Planalto
                </FonteLink>
              ) : (
                <span className="lacuna text-sm">Link do Planalto não disponível</span>
              )}
              {l[10] ? (
                <FonteLink href={l[10]} tipo="oficial">
                  Ficha no Senado Federal
                </FonteLink>
              ) : null}
              {l[9] ? (
                <Link href={`/executivo/vetos/${l[9]}`} prefetch={false} className="lk text-sm">
                  Veto desta lei
                </Link>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
      {filtradas.length > limite ? (
        <button
          type="button"
          onClick={() => setLimite((n) => n + POR_PAGINA)}
          className="mt-4 rounded border border-[#7b8794] bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-superficie"
        >
          Mostrar mais {Math.min(POR_PAGINA, filtradas.length - limite)} de {filtradas.length - limite} restantes
        </button>
      ) : null}
    </div>
  );
}
