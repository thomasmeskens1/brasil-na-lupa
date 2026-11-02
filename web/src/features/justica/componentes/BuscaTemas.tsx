"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { FonteLink } from "@/components/FonteLink";
import { formatarData, normalizar } from "@/features/congresso/rotulos";

/** Tema já decodificado do índice estático (STJ ou STF). */
export interface TemaBusca {
  numero: string;
  tipo: string | null;
  situacao: string | null;
  orgao: string | null;
  relator: string | null;
  titulo: string | null;
  questao: string | null;
  tese: string | null;
  colecoes: string[];
  href: string | null;
  url: string | null;
  data: string | null;
  /** Linha extra de contexto (ex.: processo paradigma). */
  extra?: string | null;
}

const CAMPO = "mt-1 block w-full rounded border border-[#7b8794] bg-white px-2 py-1.5 text-sm text-gray-900";
const POR_PAGINA = 25;

function opcoes(v: (string | null)[]) {
  return [...new Set(v.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Busca de temas no navegador sobre um índice estático baixado só quando o leitor usa a busca.
 * `decodificar` converte o formato compacto do arquivo; nada do que é digitado sai do navegador.
 */
export function BuscaTemas<T>({
  arquivo,
  decodificar,
  rotuloTribunal,
  rotuloQuestao,
  colecoes,
}: {
  arquivo: string;
  decodificar: (j: T) => TemaBusca[];
  rotuloTribunal: string;
  rotuloQuestao: string;
  colecoes: Record<string, string>;
}) {
  const base = useId();
  const [temas, setTemas] = useState<(TemaBusca & { _b: string })[] | null>(null);
  const [erro, setErro] = useState(false);
  const pedido = useRef(false);
  const [texto, setTexto] = useState("");
  const [situacao, setSituacao] = useState("");
  const [orgao, setOrgao] = useState("");
  const [tipo, setTipo] = useState("");
  const [colecao, setColecao] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  const carregar = useCallback(() => {
    if (pedido.current) return;
    pedido.current = true;
    fetch(arquivo)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: T) =>
        setTemas(decodificar(j).map((t) => ({ ...t, _b: normalizar(`${t.numero} ${t.titulo ?? ""} ${t.questao ?? ""} ${t.tese ?? ""} ${t.relator ?? ""}`) }))),
      )
      .catch(() => {
        pedido.current = false;
        setErro(true);
      });
  }, [arquivo, decodificar]);

  const opSit = useMemo(() => opcoes((temas ?? []).map((t) => t.situacao)), [temas]);
  const opOrg = useMemo(() => opcoes((temas ?? []).map((t) => t.orgao)), [temas]);
  const opTipo = useMemo(() => opcoes((temas ?? []).map((t) => t.tipo)), [temas]);
  const termos = normalizar(texto).split(/\s+/).filter(Boolean);
  const ativo = termos.length > 0 || !!situacao || !!orgao || !!tipo || !!colecao;
  const filtrados =
    temas && ativo
      ? temas.filter(
          (t) =>
            (!situacao || t.situacao === situacao) &&
            (!orgao || t.orgao === orgao) &&
            (!tipo || t.tipo === tipo) &&
            (!colecao || t.colecoes.includes(colecao)) &&
            termos.every((x) => (/^\d+$/.test(x) ? t.numero === x || t._b.includes(x) : t._b.includes(x))),
        )
      : [];

  function mudar(set: (v: string) => void) {
    return (e: { target: { value: string } }) => {
      carregar();
      setLimite(POR_PAGINA);
      set(e.target.value);
    };
  }

  const selects: [string, string, (v: string) => void, string[], string][] = [
    ["s", situacao, setSituacao, opSit, "Situação"],
    ["o", orgao, setOrgao, opOrg, "Órgão julgador"],
    ["y", tipo, setTipo, opTipo, "Tipo"],
  ];

  return (
    <div>
      <form role="search" aria-label={`Buscar temas do ${rotuloTribunal}`} onSubmit={(e) => e.preventDefault()} onFocus={carregar}>
        <label htmlFor={`${base}-t`} className="block text-sm font-medium text-gray-900">
          Buscar pelo número ou por palavras da questão, da tese ou do relator
          <input id={`${base}-t`} type="search" value={texto} onChange={mudar(setTexto)} placeholder="Ex.: ICMS, honorários, 1369" className={CAMPO} />
        </label>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {selects.map(([k, v, set, ops, rot]) =>
            ops.length > 1 || !temas ? (
              <label key={k} htmlFor={`${base}-${k}`} className="text-sm font-medium text-gray-900">
                {rot}
                <select id={`${base}-${k}`} value={v} onChange={mudar(set)} className={CAMPO}>
                  <option value="">Todos</option>
                  {ops.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            ) : null,
          )}
          <label htmlFor={`${base}-c`} className="text-sm font-medium text-gray-900">
            Coleção acompanhada
            <select id={`${base}-c`} value={colecao} onChange={mudar(setColecao)} className={CAMPO}>
              <option value="">Todas</option>
              {Object.entries(colecoes).map(([k, r]) => (
                <option key={k} value={k}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>

      <div aria-live="polite" className="mt-4">
        {erro ? (
          <p className="lacuna text-sm">Não foi possível carregar o índice de temas. Tente recarregar a página.</p>
        ) : !ativo ? (
          <p className="meta">Digite um termo ou escolha um filtro para ver os temas encontrados.</p>
        ) : !temas ? (
          <p className="meta">Carregando o índice de temas…</p>
        ) : (
          <p className="meta">
            {filtrados.length === 1 ? "1 tema encontrado" : `${filtrados.length} temas encontrados`}, do número mais alto para o mais baixo.
          </p>
        )}
      </div>

      <ul className="mt-3 space-y-3">
        {filtrados.slice(0, limite).map((t) => (
          <li key={t.numero} className="cartao">
            <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-gray-900">
                {t.tipo ?? "Tema"} {t.numero}
              </span>
              {t.situacao ? <span className="selo">{t.situacao}</span> : null}
              {t.orgao ? <span>{t.orgao}</span> : null}
              {t.data ? <span>· {formatarData(t.data)}</span> : null}
            </p>
            {t.titulo ? <h3 className="mt-2 text-base font-semibold text-gray-900">{t.titulo}</h3> : null}
            <p className="mt-2 text-sm leading-relaxed text-gray-800">
              <span className="font-medium text-gray-900">{rotuloQuestao}: </span>
              {t.questao ?? "Não disponível em fonte oficial"}
            </p>
            {t.tese ? (
              <details className="mt-2">
                <summary className="text-sm">Tese firmada (texto oficial)</summary>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-800">{t.tese}</p>
              </details>
            ) : (
              <p className="meta mt-2">Sem tese registrada na fonte oficial.</p>
            )}
            {t.relator ? <p className="meta mt-2">Relator: {t.relator}</p> : null}
            {t.extra ? <p className="meta mt-1">{t.extra}</p> : null}
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {t.href ? (
                <Link href={t.href} prefetch={false} className="lk text-sm font-medium">
                  Ver julgamentos e detalhes do tema {t.numero}
                </Link>
              ) : null}
              {t.url ? (
                <FonteLink href={t.url} tipo="oficial">
                  Página oficial do tema
                </FonteLink>
              ) : null}
            </p>
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
