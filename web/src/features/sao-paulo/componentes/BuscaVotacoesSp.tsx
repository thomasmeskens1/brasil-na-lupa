"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { FonteLink } from "@/components/FonteLink";
import { normalizar } from "@/features/congresso/rotulos";
import { formatarDataSp, lerHash, nomeSiglaSp, rotuloVotoSp } from "../rotulos";

type Linha = [
  id: string,
  data: string,
  hora: string,
  tipo: 0 | 1,
  orgao: number,
  prop: number,
  descricao: string,
  resultado: string | null,
  sim: number | null,
  nao: number | null,
  nVotos: number,
  url: string | null,
  votos: [number, number][] | null,
  presidente: string | null,
];

interface Arquivo {
  o: string[];
  p: [string | null, string | null, string, string | null][];
  n: [string, string | null][];
  t: string[];
  v: Linha[];
}

const CAMPO = "mt-1 block w-full rounded border border-[var(--cor-borda-forte)] bg-white px-2 py-1.5 text-sm text-gray-900";
const POR_PAGINA = 30;

/** Votos de uma deliberação de comissão, na ordem publicada pela ALESP. */
function VotosComissao({ a, l, aberto }: { a: Arquivo; l: Linha; aberto: boolean }) {
  const votos = l[12] ?? [];
  return (
    <details className="mt-3 rounded border border-borda" open={aberto}>
      <summary className="px-3 py-2 text-sm">
        Ver {votos.length === 1 ? "o voto registrado" : `os ${votos.length} votos registrados`}
      </summary>
      <div className="border-t border-borda px-3 py-2">
        {l[13] ? <p className="meta">Presidente da votação, segundo a fonte: {l[13]}</p> : null}
        <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Votos registrados na comissão">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Deputado</th>
                <th scope="col">Voto (texto oficial)</th>
              </tr>
            </thead>
            <tbody>
              {votos.map(([ni, ti], k) => {
                const [nome, pid] = a.n[ni] ?? ["", null];
                return (
                  <tr key={k}>
                    <td>
                      {pid ? (
                        <Link href={`/sao-paulo/deputados/${pid}`} prefetch={false} className="lk">
                          {nome}
                        </Link>
                      ) : (
                        nome
                      )}
                    </td>
                    <td>{rotuloVotoSp(a.t[ti])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="meta mt-2">
          Partido na data do voto: não informado pela fonte. Quando a deliberação reúne mais de uma comissão, o mesmo
          deputado pode aparecer mais de uma vez, como publicado.
        </p>
      </div>
    </details>
  );
}

/** Votações nominais da ALESP (Plenário e comissões): índice estático baixado pelo navegador. */
export function BuscaVotacoesSp() {
  const base = useId();
  const [a, setA] = useState<(Arquivo & { busca: string[] }) | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("");
  const [ano, setAno] = useState("");
  const [orgao, setOrgao] = useState("");
  const [fixo, setFixo] = useState<{ id?: string; p?: string }>({});
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    let ativo = true;
    fetch("/sao-paulo/votacoes.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Arquivo) => {
        if (!ativo) return;
        const busca = j.v.map((l) => {
          const p = l[5] >= 0 ? j.p[l[5]] : null;
          return normalizar(`${p?.[1] ?? ""} ${p?.[2] ?? ""} ${l[6]} ${j.o[l[4]] ?? ""}`);
        });
        const h = lerHash();
        if (h.q) setTexto(h.q);
        if (h.id || h.p) setFixo({ id: h.id, p: h.p });
        setA({ ...j, busca });
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, []);

  const anos = useMemo(() => (a ? [...new Set(a.v.map((l) => l[1].slice(0, 4)).filter(Boolean))].sort().reverse() : []), [a]);
  const orgaos = useMemo(
    () => (a ? [...new Set(a.v.filter((l) => l[3] === 1).map((l) => a.o[l[4]]).filter(Boolean))].sort((x, y) => x.localeCompare(y, "pt-BR")) : []),
    [a],
  );
  const termos = normalizar(texto).split(/\s+/).filter(Boolean);
  const filtradas = a
    ? a.v.filter(
        (l, i) =>
          (!fixo.id || l[0] === fixo.id) &&
          (!fixo.p || (l[5] >= 0 && a.p[l[5]][0] === fixo.p)) &&
          (!tipo || String(l[3]) === tipo) &&
          (!ano || l[1].startsWith(ano)) &&
          (!orgao || a.o[l[4]] === orgao) &&
          termos.every((t) => a.busca[i].includes(t)),
      )
    : [];

  function mudar(set: (v: string) => void) {
    return (e: { target: { value: string } }) => {
      setLimite(POR_PAGINA);
      set(e.target.value);
    };
  }

  const prop = fixo.p && a ? a.p.find((p) => p[0] === fixo.p) : null;

  return (
    <div>
      <form role="search" aria-label="Buscar votações da ALESP" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_2fr]">
          <label htmlFor={`${base}-t`} className="text-sm font-medium text-gray-900">
            Buscar no projeto, na ementa ou na descrição
            <input id={`${base}-t`} type="search" value={texto} onChange={mudar(setTexto)} placeholder="Ex.: PL 869/2026, ICMS" className={CAMPO} />
          </label>
          <label htmlFor={`${base}-y`} className="text-sm font-medium text-gray-900">
            Onde foi votado
            <select id={`${base}-y`} value={tipo} onChange={mudar(setTipo)} className={CAMPO}>
              <option value="">Plenário e comissões</option>
              <option value="0">Plenário</option>
              <option value="1">Comissões</option>
            </select>
          </label>
          <label htmlFor={`${base}-a`} className="text-sm font-medium text-gray-900">
            Ano
            <select id={`${base}-a`} value={ano} onChange={mudar(setAno)} className={CAMPO}>
              <option value="">Todos</option>
              {anos.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label htmlFor={`${base}-o`} className="text-sm font-medium text-gray-900">
            Comissão
            <select id={`${base}-o`} value={orgao} onChange={mudar(setOrgao)} className={CAMPO}>
              <option value="">Todas</option>
              {orgaos.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
      </form>

      {fixo.id || fixo.p ? (
        <p className="aviso mt-3 text-sm text-gray-900">
          {fixo.id ? "Mostrando só a votação indicada no link." : `Mostrando só as votações sobre ${prop?.[1] ?? "a proposição indicada no link"}.`}{" "}
          <button type="button" className="lk" onClick={() => setFixo({})}>
            Ver todas as votações
          </button>
        </p>
      ) : null}

      <div aria-live="polite" className="mt-3">
        {erro ? (
          <p className="lacuna text-sm">Não foi possível carregar a lista. Tente recarregar a página.</p>
        ) : !a ? (
          <p className="meta">Carregando a lista de votações…</p>
        ) : (
          <p className="meta">
            {filtradas.length === 1 ? "1 votação encontrada" : `${filtradas.length} votações encontradas`}, da mais recente para a mais antiga.
          </p>
        )}
      </div>

      <ul className="mt-3 space-y-3">
        {a
          ? filtradas.slice(0, limite).map((l) => {
              const p = l[5] >= 0 ? a.p[l[5]] : null;
              const plen = l[3] === 0;
              return (
                <li key={l[0]} className="cartao">
                  <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-gray-900">
                      {formatarDataSp(l[1])}
                      {l[2] ? `, ${l[2]}` : ""}
                    </span>
                    <span className="selo">{plen ? "Votação nominal em Plenário" : "Votação nominal em comissão"}</span>
                    {plen && l[7] ? <span className="selo">{l[7]}</span> : null}
                  </p>
                  {!plen ? <p className="meta mt-1">{a.o[l[4]]}</p> : null}
                  <h3 className="mt-2 text-base font-semibold text-gray-900">
                    {plen ? (
                      <Link href={`/sao-paulo/votacoes/${l[0]}`} prefetch={false} className="lk">
                        {p?.[1] ?? l[6]}
                      </Link>
                    ) : (
                      (p?.[1] ?? "Proposição não informada")
                    )}
                    {p?.[1] ? <span className="meta ml-2 font-normal">{nomeSiglaSp(p[1].split(" ")[0])}</span> : null}
                  </h3>
                  {p?.[2] ? <p className="mt-1 text-sm leading-relaxed text-gray-800">{p[2]}</p> : null}
                  <p className="mt-2 text-sm text-gray-900">
                    <span className="font-medium">{plen ? "Descrição no relatório: " : "Deliberação (texto oficial): "}</span>
                    {l[6] || "Descrição não disponível em fonte oficial"}
                  </p>
                  {plen ? (
                    <p className="mt-1 text-sm text-gray-800">
                      {l[8] != null ? `Placar oficial: ${l[8]} Sim, ${l[9]} Não. ` : "Placar não lido do relatório oficial. "}
                      {l[10] ? `${l[10]} votos individuais publicados.` : "Votos individuais não publicados."}
                    </p>
                  ) : null}
                  {!plen ? <VotosComissao a={a} l={l} aberto={fixo.id === l[0]} /> : null}
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {plen ? (
                      <Link href={`/sao-paulo/votacoes/${l[0]}`} prefetch={false} className="lk text-sm">
                        Ver placar e votos
                      </Link>
                    ) : null}
                    {l[11] ? (
                      <FonteLink href={l[11]} tipo={plen ? "pdf" : "oficial"}>
                        {plen ? "Relatório de Verificação de Votação" : "Página da proposição na ALESP"}
                      </FonteLink>
                    ) : null}
                  </p>
                </li>
              );
            })
          : null}
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
