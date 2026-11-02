"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { FonteLink } from "@/components/FonteLink";
import { normalizar } from "@/features/congresso/rotulos";
import { SIGLAS_SP, formatarDataSp, lerHash, nomeSiglaSp } from "../rotulos";

type Linha = [
  id: string,
  sigla: string,
  numero: number,
  ano: number,
  ementa: string,
  data: string,
  autores: string,
  etapa: string | null,
  ultData: string | null,
  ultDescricao: string | null,
  url: string | null,
  urlNorma: string | null,
  temComissao: 0 | 1,
  plenario: string[],
  coletadoEm: string | null,
];

const CAMPO = "mt-1 block w-full rounded border border-[#7b8794] bg-white px-2 py-1.5 text-sm text-gray-900";
const POR_PAGINA = 30;

/** Proposições da ALESP (PL, PLC, PEC, PDL, PR): índice estático baixado pelo navegador. */
export function BuscaProjetosSp() {
  const base = useId();
  const [dados, setDados] = useState<{ p: Linha[]; busca: string[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [sigla, setSigla] = useState("");
  const [ano, setAno] = useState("");
  const [fixo, setFixo] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    let ativo = true;
    fetch("/sao-paulo/projetos.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { p: Linha[] }) => {
        if (!ativo) return;
        const h = lerHash();
        if (h.q) setTexto(h.q);
        if (h.id) setFixo(h.id);
        setDados({ p: j.p, busca: j.p.map((l) => normalizar(`${l[1]} ${l[2]}/${l[3]} ${l[4]} ${l[6]}`)) });
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, []);

  const anos = useMemo(() => (dados ? [...new Set(dados.p.map((l) => String(l[3])))].sort().reverse() : []), [dados]);
  const termos = normalizar(texto).split(/\s+/).filter(Boolean);
  const filtradas = dados
    ? dados.p.filter(
        (l, i) => (!fixo || l[0] === fixo) && (!sigla || l[1] === sigla) && (!ano || String(l[3]) === ano) && termos.every((t) => dados.busca[i].includes(t)),
      )
    : [];

  function mudar(set: (v: string) => void) {
    return (e: { target: { value: string } }) => {
      setLimite(POR_PAGINA);
      set(e.target.value);
    };
  }

  return (
    <div>
      <form role="search" aria-label="Buscar projetos da ALESP" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <label htmlFor={`${base}-t`} className="text-sm font-medium text-gray-900">
            Buscar na ementa, no número ou no autor
            <input id={`${base}-t`} type="search" value={texto} onChange={mudar(setTexto)} placeholder="Ex.: ICMS, 869/2026" className={CAMPO} />
          </label>
          <label htmlFor={`${base}-s`} className="text-sm font-medium text-gray-900">
            Tipo
            <select id={`${base}-s`} value={sigla} onChange={mudar(setSigla)} className={CAMPO}>
              <option value="">Todos</option>
              {Object.entries(SIGLAS_SP).map(([s, n]) => (
                <option key={s} value={s}>
                  {n} ({s})
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${base}-a`} className="text-sm font-medium text-gray-900">
            Ano de apresentação
            <select id={`${base}-a`} value={ano} onChange={mudar(setAno)} className={CAMPO}>
              <option value="">Todos</option>
              {anos.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>
      </form>

      {fixo ? (
        <p className="aviso mt-3 text-sm text-gray-900">
          Mostrando só o projeto indicado no link.{" "}
          <button type="button" className="lk" onClick={() => setFixo("")}>
            Ver todos os projetos
          </button>
        </p>
      ) : null}

      <div aria-live="polite" className="mt-3">
        {erro ? (
          <p className="lacuna text-sm">Não foi possível carregar a lista. Tente recarregar a página.</p>
        ) : !dados ? (
          <p className="meta">Carregando a lista de projetos…</p>
        ) : (
          <p className="meta">
            {filtradas.length === 1 ? "1 projeto encontrado" : `${filtradas.length} projetos encontrados`}, do mais recente para o mais antigo.
          </p>
        )}
      </div>

      <ul className="mt-3 space-y-3">
        {filtradas.slice(0, limite).map((l) => (
          <li key={l[0]} className="cartao">
            <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-gray-900">Apresentado em {formatarDataSp(l[5])}</span>
              <span className="selo">{nomeSiglaSp(l[1])}</span>
              {l[7] ? <span>Etapa: {l[7]}</span> : null}
            </p>
            <h3 className="mt-2 text-base font-semibold text-gray-900">
              {l[1]} {l[2]}/{l[3]}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-800">{l[4] || "Ementa não disponível em fonte oficial"}</p>
            <dl className="mt-2 space-y-1 text-sm text-gray-800">
              <div>
                <dt className="inline font-medium text-gray-900">Autoria: </dt>
                <dd className="inline">{l[6] || "Informação não disponível em fonte oficial"}</dd>
              </div>
              {l[8] || l[9] ? (
                <div>
                  <dt className="inline font-medium text-gray-900">Última tramitação{l[8] ? ` (${formatarDataSp(l[8])})` : ""}: </dt>
                  <dd className="inline">{l[9] ?? "Informação não disponível em fonte oficial"}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {l[10] ? (
                <FonteLink href={l[10]} tipo="oficial">
                  Página do projeto na ALESP
                </FonteLink>
              ) : null}
              {l[11] ? (
                <FonteLink href={l[11]} tipo="oficial">
                  Norma publicada
                </FonteLink>
              ) : null}
              {l[13].map((id, k) => (
                <Link key={id} href={`/sao-paulo/votacoes/${id}`} prefetch={false} className="lk text-sm">
                  Votação nominal em Plenário{l[13].length > 1 ? ` (${k + 1})` : ""}
                </Link>
              ))}
              {l[12] ? (
                <Link href={`/sao-paulo/votacoes#p=${l[0]}`} prefetch={false} className="lk text-sm">
                  Votações em comissões
                </Link>
              ) : null}
            </p>
            {l[14] ? <p className="meta mt-1">Situação coletada em {formatarDataSp(l[14])}.</p> : null}
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
