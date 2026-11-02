"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { FonteLink } from "@/components/FonteLink";
import { normalizar } from "@/features/congresso/rotulos";

type Linha = [
  id: string,
  tipo: number | string,
  numero: string | null,
  data: string,
  ementaPublica: string,
  edicao: string | null,
  edicaoData: string | null,
  pagina: number | null,
  url: string | null,
  outras: [string | null, string | null, number | null, string | null][],
  comOmissao: 0 | 1,
];

const CAMPO = "mt-1 block w-full rounded border border-[#7b8794] bg-white px-2 py-1.5 text-sm text-gray-900";
const POR_PAGINA = 30;

function data(v: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "data não informada";
}

/**
 * Leis, leis complementares e decretos de Atibaia (índice estático public/atibaia/normas.json).
 * Mostra só a ementa pública: nomes de particulares aparecem como "[nome de particular omitido]".
 */
export function BuscaNormasAtibaia() {
  const base = useId();
  const [dados, setDados] = useState<{ tipos: string[]; n: (Linha & { _t: string })[]; busca: string[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("");
  const [ano, setAno] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    let ativo = true;
    fetch("/atibaia/normas.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { tipos: string[]; n: Linha[] }) => {
        if (!ativo) return;
        const n = j.n.map((l) => Object.assign([...l] as Linha, { _t: typeof l[1] === "number" ? (j.tipos[l[1]] ?? "") : String(l[1]) }));
        setDados({ tipos: j.tipos, n, busca: n.map((l) => normalizar(`${l._t} ${l[2] ?? ""} ${l[4]}`)) });
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, []);

  const anos = useMemo(() => (dados ? [...new Set(dados.n.map((l) => l[3].slice(0, 4)).filter(Boolean))].sort().reverse() : []), [dados]);
  const termos = normalizar(texto).split(/\s+/).filter(Boolean);
  const filtradas = dados
    ? dados.n.filter((l, i) => (!tipo || l._t === tipo) && (!ano || l[3].startsWith(ano)) && termos.every((t) => dados.busca[i].includes(t)))
    : [];

  function mudar(set: (v: string) => void) {
    return (e: { target: { value: string } }) => {
      setLimite(POR_PAGINA);
      set(e.target.value);
    };
  }

  return (
    <div>
      <form role="search" aria-label="Buscar leis e decretos de Atibaia" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <label htmlFor={`${base}-t`} className="text-sm font-medium text-gray-900">
            Buscar na ementa ou no número
            <input id={`${base}-t`} type="search" value={texto} onChange={mudar(setTexto)} placeholder="Ex.: crédito suplementar, 11.549" className={CAMPO} />
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
            Ano do ato
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
            {filtradas.length === 1 ? "1 ato encontrado" : `${filtradas.length} atos encontrados`}, do mais recente para o mais antigo.
          </p>
        )}
      </div>

      <ul className="mt-3 space-y-3">
        {filtradas.slice(0, limite).map((l) => (
          <li key={l[0]} className="cartao">
            <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-gray-900">{data(l[3])}</span>
              <span className="selo">{l._t}</span>
              <span>{l._t === "Decreto" ? "Ato individual do prefeito, sem votação" : "Lei municipal aprovada pela Câmara Municipal"}</span>
            </p>
            <h3 className="mt-2 text-base font-semibold text-gray-900">
              {l._t} nº {l[2] ?? "não informado"}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-800">{l[4]}</p>
            {l[10] ? (
              <p className="meta mt-1">
                Nomes de particulares e documentos pessoais foram omitidos nesta ementa; o texto completo está no documento
                oficial.
              </p>
            ) : null}
            <p className="mt-2">
              {l[8] ? (
                <FonteLink href={l[8]} tipo="pdf">
                  Imprensa Oficial nº {l[5] ?? "?"}, de {data(l[6])}
                  {l[7] ? `, p. ${l[7]}` : ""}
                </FonteLink>
              ) : (
                <span className="lacuna text-sm">Link da publicação não disponível</span>
              )}
            </p>
            {l[9].length ? (
              <p className="meta mt-1">
                Também publicado em:{" "}
                {l[9].map((o, k) => (
                  <span key={k}>
                    {k ? "; " : ""}
                    {o[3] ? (
                      <a href={o[3]} target="_blank" rel="noopener noreferrer" className="lk">
                        edição nº {o[0]}, de {data(o[1])}
                        {o[2] ? `, p. ${o[2]}` : ""}
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                    ) : (
                      `edição nº ${o[0]}`
                    )}
                  </span>
                ))}
              </p>
            ) : null}
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
