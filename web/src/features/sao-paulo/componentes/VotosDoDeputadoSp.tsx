"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { normalizar } from "@/features/congresso/rotulos";
import { compararVotosSp, formatarDataSp, rotuloVotoSp } from "../rotulos";

export interface LinhaVotoDeputadoSp {
  id: string;
  plenario: boolean;
  data: string | null;
  orgao: string | null;
  proposicao: string | null;
  ementa: string | null;
  descricao: string | null;
  resultado: string | null;
  voto: string;
  registros: number;
  marcador: string | null;
}

/** Partes do arquivo público de votações usadas aqui (ver BuscaVotacoesSp). */
interface ArquivoVotacoes {
  o: string[];
  p: [string | null, string | null, string, string | null][];
  n: [string, string | null][];
  t: string[];
  v: [string, string, string, 0 | 1, number, number, string, string | null, number | null, number | null, number, string | null, [number, number][] | null, string | null][];
}

/** Votos do deputado nas comissões, lidos do índice estático (compartilhado entre os perfis e com a busca). */
function linhasDeComissao(a: ArquivoVotacoes, pid: string): LinhaVotoDeputadoSp[] {
  const nomes = new Set(a.n.flatMap(([, id], i) => (id === pid ? [i] : [])));
  const out: LinhaVotoDeputadoSp[] = [];
  for (const l of a.v) {
    if (l[3] !== 1 || !l[12]) continue;
    const votos = l[12].filter(([ni]) => nomes.has(ni)).map(([, ti]) => a.t[ti] ?? "");
    if (!votos.length) continue;
    const p = l[5] >= 0 ? a.p[l[5]] : null;
    out.push({
      id: l[0],
      plenario: false,
      data: l[1] || null,
      orgao: a.o[l[4]] ?? null,
      proposicao: p?.[1] ?? null,
      ementa: null,
      descricao: l[6] || null,
      resultado: null,
      voto: [...new Set(votos)].join(" / "),
      registros: votos.length,
      marcador: null,
    });
  }
  return out;
}

const CAMPO = "mt-1 block w-full rounded border border-[var(--cor-borda-forte)] bg-white px-2 py-1.5 text-sm text-gray-900";
const POR_PAGINA = 40;

/** Votos de um deputado estadual nas votações nominais (Plenário e comissões), do mais recente ao mais antigo. */
export function VotosDoDeputadoSp({ pid, plenario, nComissao }: { pid: string; plenario: LinhaVotoDeputadoSp[]; nComissao: number }) {
  const base = useId();
  const [comissoes, setComissoes] = useState<LinhaVotoDeputadoSp[] | null>(nComissao ? null : []);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (!nComissao) return;
    let ativo = true;
    fetch("/sao-paulo/votacoes.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: ArquivoVotacoes) => ativo && setComissoes(linhasDeComissao(j, pid)))
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [pid, nComissao]);
  const linhas = useMemo(
    () => [...plenario, ...(comissoes ?? [])].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "") || Number(b.plenario) - Number(a.plenario)),
    [plenario, comissoes],
  );
  const [busca, setBusca] = useState("");
  const [onde, setOnde] = useState("");
  const [voto, setVoto] = useState("");
  const [ano, setAno] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  const indexadas = useMemo(
    () => linhas.map((l) => normalizar(`${l.proposicao ?? ""} ${l.ementa ?? ""} ${l.descricao ?? ""} ${l.orgao ?? ""}`)),
    [linhas],
  );
  const opVoto = useMemo(() => [...new Set(linhas.map((l) => l.voto))].sort(compararVotosSp), [linhas]);
  const opAno = useMemo(() => [...new Set(linhas.map((l) => l.data?.slice(0, 4)).filter((x): x is string => !!x))].sort().reverse(), [linhas]);
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  const filtradas = linhas.filter(
    (l, i) =>
      (!onde || (onde === "p") === l.plenario) &&
      (!voto || l.voto === voto) &&
      (!ano || l.data?.startsWith(ano)) &&
      termos.every((t) => indexadas[i].includes(t)),
  );

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
          Buscar no projeto ou no texto
          <input id={`${base}-b`} type="search" value={busca} onChange={mudar(setBusca)} className={CAMPO} />
        </label>
        <label htmlFor={`${base}-o`} className="text-sm font-medium text-gray-900">
          Onde foi votado
          <select id={`${base}-o`} value={onde} onChange={mudar(setOnde)} className={CAMPO}>
            <option value="">Plenário e comissões</option>
            <option value="p">Plenário</option>
            <option value="c">Comissões</option>
          </select>
        </label>
        <label htmlFor={`${base}-v`} className="text-sm font-medium text-gray-900">
          Voto (texto oficial)
          <select id={`${base}-v`} value={voto} onChange={mudar(setVoto)} className={CAMPO}>
            <option value="">Todos</option>
            {opVoto.map((o) => (
              <option key={o} value={o}>
                {rotuloVotoSp(o)}
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
      </div>
      {erro ? <p className="lacuna mt-2 text-sm">Não foi possível carregar os votos em comissões. Tente recarregar a página.</p> : null}
      {!comissoes && !erro ? <p className="meta mt-2">Carregando os votos em comissões…</p> : null}
      <p className="meta mt-2" aria-live="polite">
        {filtradas.length === 1 ? "1 votação" : `${filtradas.length} votações`} de {linhas.length}, da mais recente para a mais antiga.
      </p>
      <ul className="mt-2 space-y-2">
        {filtradas.slice(0, limite).map((l) => (
          <li key={l.id} className="cartao">
            <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-gray-900">{formatarDataSp(l.data)}</span>
              <span className="selo">{l.plenario ? "Plenário" : "Comissão"}</span>
              {!l.plenario && l.orgao ? <span>{l.orgao}</span> : null}
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              <Link href={l.plenario ? `/sao-paulo/votacoes/${l.id}` : `/sao-paulo/votacoes#id=${l.id}`} prefetch={false} className="lk">
                {l.proposicao ?? (l.descricao || "Proposição não informada")}
              </Link>
            </p>
            {l.ementa ? <p className="mt-0.5 text-sm text-gray-800">{l.ementa}</p> : null}
            {l.descricao && l.proposicao ? (
              <p className="meta mt-1">
                {l.plenario ? "Descrição no relatório" : "Deliberação"}: {l.descricao}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-gray-900">
              <span className="font-medium">Voto registrado: </span>
              <strong>{rotuloVotoSp(l.voto)}</strong>
              {l.registros > 1 ? <span className="meta"> ({l.registros} registros na fonte)</span> : null}
              {l.marcador ? <span className="meta"> · letra “{l.marcador}” antes do nome (sem legenda no documento)</span> : null}
              {l.plenario && l.resultado ? <span className="meta"> · resultado: {l.resultado}</span> : null}
            </p>
          </li>
        ))}
      </ul>
      {!filtradas.length ? <p className="mt-2 text-sm text-gray-800">Nenhuma votação com esses filtros.</p> : null}
      {filtradas.length > limite ? (
        <button
          type="button"
          onClick={() => setLimite((n) => n + POR_PAGINA)}
          className="mt-3 rounded border border-[var(--cor-borda-forte)] bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-superficie"
        >
          Mostrar mais {Math.min(POR_PAGINA, filtradas.length - limite)} de {filtradas.length - limite} restantes
        </button>
      ) : null}
    </div>
  );
}
