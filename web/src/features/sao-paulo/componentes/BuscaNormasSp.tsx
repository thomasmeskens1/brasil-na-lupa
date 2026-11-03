"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { FonteLink } from "@/components/FonteLink";
import { normalizar } from "@/features/congresso/rotulos";
import { formatarDataSp, lerHash } from "../rotulos";

type Linha = [
  id: string,
  tipo: number | string,
  titulo: string | null,
  dataAto: string,
  dataPublicacao: string,
  ementa: string | null,
  url: string | null,
  retificacao: 0 | 1,
  projetoTexto: string | null,
  projeto: [rotulo: string, idInterno: string | null, urlAlesp: string | null] | null,
  razoesVeto: string | null,
  texto: string | null,
  coletadoEm: string | null,
];

const CAMPO = "mt-1 block w-full rounded border border-[var(--cor-borda-forte)] bg-white px-2 py-1.5 text-sm text-gray-900";
const POR_PAGINA = 30;

function caminho(tipo: string): string {
  if (tipo === "Decreto") return "Ato individual do governador, sem votação";
  if (tipo.startsWith("Veto")) return "Ato individual do governador sobre projeto aprovado pela Assembleia";
  return "Lei estadual aprovada pela Assembleia Legislativa";
}

/** Leis, decretos e vetos do governador de SP: índice estático baixado pelo navegador. */
export function BuscaNormasSp() {
  const base = useId();
  const [dados, setDados] = useState<{ tipos: string[]; n: (Linha & { _t: string })[]; busca: string[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("");
  const [ano, setAno] = useState("");
  const [retif, setRetif] = useState(true);
  const [fixo, setFixo] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    let ativo = true;
    fetch("/sao-paulo/normas.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { tipos: string[]; n: Linha[] }) => {
        if (!ativo) return;
        const n = j.n.map((l) => Object.assign([...l] as Linha, { _t: typeof l[1] === "number" ? (j.tipos[l[1]] ?? "") : String(l[1]) }));
        const h = lerHash();
        if (h.q) setTexto(h.q);
        if (h.id) setFixo(h.id);
        setDados({ tipos: j.tipos, n, busca: n.map((l) => normalizar(`${l[2] ?? ""} ${l[5] ?? ""} ${l[8] ?? ""} ${l[9]?.[0] ?? ""}`)) });
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, []);

  const anos = useMemo(() => (dados ? [...new Set(dados.n.map((l) => l[4].slice(0, 4)).filter(Boolean))].sort().reverse() : []), [dados]);
  const termos = normalizar(texto).split(/\s+/).filter(Boolean);
  const filtradas = dados
    ? dados.n.filter(
        (l, i) =>
          (!fixo || l[0] === fixo) &&
          (!tipo || (tipo === "vetos" ? l._t.startsWith("Veto") : l._t === tipo)) &&
          (!ano || l[4].startsWith(ano)) &&
          (retif || !l[7]) &&
          termos.every((t) => dados.busca[i].includes(t)),
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
      <form role="search" aria-label="Buscar leis, decretos e vetos do Estado de São Paulo" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <label htmlFor={`${base}-t`} className="text-sm font-medium text-gray-900">
            Buscar no título, na ementa ou no projeto
            <input id={`${base}-t`} type="search" value={texto} onChange={mudar(setTexto)} placeholder="Ex.: ICMS, 18.499, PL 1315/2023" className={CAMPO} />
          </label>
          <label htmlFor={`${base}-y`} className="text-sm font-medium text-gray-900">
            Tipo
            <select id={`${base}-y`} value={tipo} onChange={mudar(setTipo)} className={CAMPO}>
              <option value="">Todos</option>
              {(dados?.tipos ?? []).map((t) => (
                <option key={t}>{t}</option>
              ))}
              <option value="vetos">Vetos (total e parcial)</option>
            </select>
          </label>
          <label htmlFor={`${base}-a`} className="text-sm font-medium text-gray-900">
            Ano de publicação
            <select id={`${base}-a`} value={ano} onChange={mudar(setAno)} className={CAMPO}>
              <option value="">Todos</option>
              {anos.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-900">
          <input type="checkbox" checked={retif} onChange={(e) => setRetif(e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>Incluir retificações (correções publicadas de atos anteriores)</span>
        </label>
      </form>

      {fixo ? (
        <p className="aviso mt-3 text-sm text-gray-900">
          Mostrando só o ato indicado no link.{" "}
          <button type="button" className="lk" onClick={() => setFixo("")}>
            Ver todos os atos
          </button>
        </p>
      ) : null}

      <div aria-live="polite" className="mt-3">
        {erro ? (
          <p className="lacuna text-sm">Não foi possível carregar a lista. Tente recarregar a página.</p>
        ) : !dados ? (
          <p className="meta">Carregando a lista de leis, decretos e vetos…</p>
        ) : (
          <p className="meta">
            {filtradas.length === 1 ? "1 ato encontrado" : `${filtradas.length} atos encontrados`}, do mais recente para o mais antigo.
          </p>
        )}
      </div>

      <ul className="mt-3 space-y-3">
        {filtradas.slice(0, limite).map((l) => {
          const veto = l._t.startsWith("Veto");
          return (
            <li key={l[0]} className="cartao">
              <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-gray-900">Publicado em {formatarDataSp(l[4])}</span>
                <span className="selo">{l._t}</span>
                {l[7] ? <span className="selo">Retificação</span> : null}
                <span>{caminho(l._t)}</span>
              </p>
              <h3 className="mt-2 text-base font-semibold text-gray-900">{l[2] ?? "Título não informado"}</h3>
              {l[3] ? <p className="meta mt-0.5">Data do ato: {formatarDataSp(l[3])}</p> : null}
              {l[5] ? (
                <p className="mt-1 text-sm leading-relaxed text-gray-800">{l[5]}</p>
              ) : !veto ? (
                <p className="mt-1 text-sm text-gray-800">Ementa não disponível em fonte oficial</p>
              ) : null}
              {l[8] ? <p className="meta mt-1">Origem, como publicada: {l[8]}</p> : null}
              {l[9] ? (
                <p className="mt-1 text-sm text-gray-900">
                  <span className="font-medium">{veto ? "Projeto vetado: " : "Projeto de origem: "}</span>
                  {l[9][0]}
                  {l[9][1] ? (
                    <>
                      {" · "}
                      <Link href={`/sao-paulo/projetos#id=${l[9][1]}`} prefetch={false} className="lk">
                        ver na lista de projetos
                      </Link>
                    </>
                  ) : null}
                  {l[9][2] ? (
                    <>
                      {" · "}
                      <FonteLink href={l[9][2]} tipo="oficial">
                        página do projeto na ALESP
                      </FonteLink>
                    </>
                  ) : null}
                </p>
              ) : null}
              {l[10] ? (
                <details className="mt-3 rounded border border-borda">
                  <summary className="px-3 py-2 text-sm">Razões do veto (texto integral publicado)</summary>
                  <p className="whitespace-pre-line border-t border-borda px-3 py-2 text-sm leading-relaxed text-gray-800">{l[10]}</p>
                </details>
              ) : veto ? (
                <p className="lacuna mt-2 text-sm">Razões do veto não disponíveis em fonte oficial coletada.</p>
              ) : null}
              {l[11] ? (
                <details className="mt-3 rounded border border-borda">
                  <summary className="px-3 py-2 text-sm">Texto da retificação publicado</summary>
                  <p className="whitespace-pre-line border-t border-borda px-3 py-2 text-sm leading-relaxed text-gray-800">{l[11]}</p>
                </details>
              ) : null}
              <p className="mt-2">
                {l[6] ? (
                  <FonteLink href={l[6]} tipo="oficial">
                    Publicação no Diário Oficial do Estado
                  </FonteLink>
                ) : (
                  <span className="lacuna text-sm">Link da publicação não disponível</span>
                )}
                {l[12] ? <span className="meta block">Coletado em {formatarDataSp(l[12])}</span> : null}
              </p>
            </li>
          );
        })}
      </ul>
      {filtradas.length > limite ? (
        <button
          type="button"
          onClick={() => setLimite((n) => n + POR_PAGINA)}
          className="mt-4 rounded border border-[var(--cor-borda-forte)] bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-superficie"
        >
          Mostrar mais {Math.min(POR_PAGINA, filtradas.length - limite)} de {filtradas.length - limite} restantes
        </button>
      ) : null}
    </div>
  );
}
