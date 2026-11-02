"use client";

/**
 * Comparador lado a lado (2 a 5 parlamentares da mesma casa). O estado fica SÓ na URL
 * (?casa=camara&ids=1,2,3): nada é guardado no aparelho nem enviado. Sem nota, índice ou ranking:
 * só dados oficiais e listas de votações em que os escolhidos votaram igual ou diferente.
 * Os votos vêm de public/congresso/votos-<casa>.json (um caractere por votação nominal).
 */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Casa } from "../tipos";
import { CASA_NOME, formatarData, normalizar, rotaParlamentar, rotaVotacao, rotuloResultadoCurto, rotuloVoto } from "../rotulos";
import { tituloOficialVotacao } from "../lista";

export interface ParlamentarComparar {
  id: string;
  nome: string;
  partido: string | null;
  uf: string | null;
  lista: boolean;
  presenca: string | null;
  presencaUrl: string | null;
  gastos: string | null;
  gastosUrl: string | null;
}

interface ArquivoVotos {
  rotulos: string[];
  /** [id, data, título simples, proposição, descrição, resultado] */
  v: [string, string, string, string, string, string][];
  p: Record<string, string>;
}

const MAX = 5;
const VOTOU = new Set(["Sim", "Não", "Abstenção"]);
const PASSO = 20;

function Lista({ titulo, itens, casa, escolhidos, rotulos, arq }: {
  titulo: string;
  itens: number[];
  casa: Casa;
  escolhidos: ParlamentarComparar[];
  rotulos: string[];
  arq: ArquivoVotos;
}) {
  const [n, setN] = useState(PASSO);
  return (
    <details className="rounded-md border border-borda bg-white">
      <summary className="pr-3">
        {titulo} <span className="font-normal text-[var(--cor-secundaria)]">({itens.length.toLocaleString("pt-BR")})</span>
      </summary>
      <div className="border-t border-borda px-3 pb-3 pt-2">
        {itens.length ? (
          <ol className="space-y-3">
            {itens.slice(0, n).map((i) => {
              const [id, data, ts, prop, desc, res] = arq.v[i];
              return (
                <li key={id} className="border-b border-borda pb-2 last:border-0">
                  <Link href={rotaVotacao(casa, id)} className="lk font-semibold">
                    {ts || tituloOficialVotacao({ proposicao: prop || null, descricao: desc })}
                  </Link>
                  <p className="text-sm text-[var(--cor-secundaria)]">
                    {formatarData(data)} · votação nominal · resultado: {rotuloResultadoCurto(res || null).toLowerCase()}
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {escolhidos.map((p) => (
                      <li key={p.id}>
                        {p.nome}: <strong>{rotuloVoto(rotulos[arq.p[p.id].charCodeAt(i) - 65])}</strong>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm">Nenhuma votação.</p>
        )}
        {itens.length > n ? (
          <button type="button" className="botao mt-3" onClick={() => setN((x) => x + PASSO)}>
            Mostrar mais {Math.min(PASSO, itens.length - n)}
          </button>
        ) : null}
      </div>
    </details>
  );
}

export function Comparador({ dados, coleta }: { dados: Record<Casa, ParlamentarComparar[]>; coleta: Record<Casa, string> }) {
  const sp = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();
  const casa: Casa = sp.get("casa") === "senado" ? "senado" : "camara";
  const porId = useMemo(() => new Map(dados[casa].map((p) => [p.id, p])), [dados, casa]);
  const ids = [...new Set((sp.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => porId.has(s)))].slice(0, MAX);
  const escolhidos = ids.map((id) => porId.get(id)!);
  const [busca, setBusca] = useState("");
  const [arq, setArq] = useState<{ casa: Casa; d: ArquivoVotos } | null>(null);
  const [erro, setErro] = useState(false);

  function ir(c: Casa, novos: string[]) {
    const q = new URLSearchParams({ casa: c });
    if (novos.length) q.set("ids", novos.join(","));
    router.replace(`${caminho}?${q.toString()}`, { scroll: false });
  }

  const precisaVotos = escolhidos.length > 0;
  useEffect(() => {
    if (!precisaVotos || arq?.casa === casa) return;
    let vivo = true;
    fetch(`/congresso/votos-${casa}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ArquivoVotos) => vivo && setArq({ casa, d }))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [precisaVotos, casa, arq?.casa]);

  const d = arq?.casa === casa ? arq.d : null;
  const votaram = (id: string) => {
    if (!d) return null;
    const s = d.p[id] ?? "";
    let n = 0;
    for (let i = 0; i < s.length; i++) if (s[i] !== "." && VOTOU.has(d.rotulos[s.charCodeAt(i) - 65])) n++;
    return n;
  };
  // Poucas centenas de votações × até 5 pessoas: cálculo direto a cada renderização.
  const iguais: number[] = [];
  const diferentes: number[] = [];
  if (d && escolhidos.length >= 2) {
    const ss = escolhidos.map((p) => d.p[p.id] ?? "");
    for (let i = 0; i < d.v.length; i++) {
      const rs = ss.map((s) => (s[i] && s[i] !== "." ? d.rotulos[s.charCodeAt(i) - 65] : null));
      if (!rs.every((r) => r && VOTOU.has(r))) continue;
      (rs.every((r) => r === rs[0]) ? iguais : diferentes).push(i);
    }
  }

  const t = normalizar(busca.trim());
  const sugestoes = t.length >= 2 ? dados[casa].filter((p) => !ids.includes(p.id) && normalizar(`${p.nome} ${p.partido ?? ""} ${p.uf ?? ""}`).includes(t)).slice(0, 8) : [];
  const membro = casa === "camara" ? "deputado" : "senador";

  return (
    <div className="space-y-6">
      <div role="group" aria-label="Casa" className="flex flex-wrap gap-2">
        {(["camara", "senado"] as Casa[]).map((c) => (
          <button key={c} type="button" aria-pressed={casa === c} className={casa === c ? "botao botao-escuro" : "botao"} onClick={() => casa !== c && ir(c, [])}>
            {CASA_NOME[c]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="comparar-busca">
          {ids.length >= MAX ? `Limite de ${MAX} parlamentares atingido` : `Adicionar ${membro} (digite o nome, o partido ou a UF)`}
          <input
            id="comparar-busca"
            type="search"
            disabled={ids.length >= MAX}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="mt-1 block w-full rounded border border-[#7b8794] bg-white px-3 text-base"
            placeholder="Ex.: Silva"
          />
        </label>
        {sugestoes.length ? (
          <ul className="flex flex-wrap gap-2" aria-label="Sugestões">
            {sugestoes.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="botao text-left"
                  onClick={() => {
                    ir(casa, [...ids, p.id]);
                    setBusca("");
                  }}
                >
                  <span aria-hidden="true">+</span> {p.nome} ({p.partido ?? "–"}-{p.uf ?? "–"})
                </button>
              </li>
            ))}
          </ul>
        ) : t.length >= 2 ? (
          <p className="text-sm text-[var(--cor-secundaria)]">Nenhum {membro} encontrado.</p>
        ) : null}
      </div>

      {escolhidos.length ? (
        <ul className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${escolhidos.length >= 3 ? "lg:grid-cols-3" : ""} ${escolhidos.length >= 4 ? "xl:grid-cols-5" : ""}`}>
          {escolhidos.map((p) => {
            const n = votaram(p.id);
            return (
              <li key={p.id} className="flex flex-col rounded-lg border border-borda bg-white p-3">
                <Link href={rotaParlamentar(casa, p.id)} className="lk text-lg font-semibold">
                  {p.nome}
                </Link>
                <dl className="mt-2 space-y-1.5">
                  {[
                    ["Partido", p.partido ?? "não informado"],
                    ["Estado (UF)", p.uf ?? "não informado"],
                  ].map(([r, v]) => (
                    <div key={r}>
                      <dt className="text-sm text-[var(--cor-secundaria)]">{r}</dt>
                      <dd className="font-semibold">{v}</dd>
                    </div>
                  ))}
                  {[
                    ["Presença em Plenário em 2026", p.presenca, p.presencaUrl, "dias com presença / dias de sessão deliberativa em exercício"],
                    ["Cota parlamentar em 2026", p.gastos, p.gastosUrl, null],
                  ].map(([r, v, u, det]) => (
                    <div key={r as string}>
                      <dt className="text-sm text-[var(--cor-secundaria)]">{r}</dt>
                      <dd>
                        {v ? <span className="font-semibold tabular-nums">{v}</span> : <span className="lacuna text-sm">Não disponível nos dados coletados</span>}
                        {v && det ? <span className="block text-sm text-[var(--cor-secundaria)]">{det}</span> : null}
                        {v && u ? (
                          <a href={u as string} className="lk flex min-h-11 w-fit items-center text-sm" target="_blank" rel="noopener noreferrer">
                            Fonte: Câmara dos Deputados ↗<span className="sr-only"> (abre em nova aba)</span>
                          </a>
                        ) : null}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-sm text-[var(--cor-secundaria)]">Votações nominais em que votou (Sim, Não ou Abstenção)</dt>
                    <dd className="font-semibold tabular-nums">{n === null ? (erro ? "Não foi possível carregar" : "Carregando…") : `${n} de ${d!.v.length}`}</dd>
                  </div>
                </dl>
                {!p.lista ? <p className="meta mt-2">Não consta da lista atual de em exercício.</p> : null}
                <button type="button" className="botao mt-auto self-start" onClick={() => ir(casa, ids.filter((x) => x !== p.id))}>
                  Remover<span className="sr-only"> {p.nome}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="lacuna">Nenhum parlamentar escolhido. Use a busca acima ou o botão “+ Comparar” no perfil de cada parlamentar.</p>
      )}

      {escolhidos.length === 1 ? <p>Escolha mais um parlamentar para ver as votações em que votaram igual ou diferente.</p> : null}

      {escolhidos.length >= 2 ? (
        <section aria-labelledby="comparar-votos" className="space-y-3">
          <h2 id="comparar-votos" className="text-xl font-bold">
            Nas mesmas votações nominais
          </h2>
          <p>
            Só entram as votações nominais em que todos os escolhidos registraram Sim, Não ou Abstenção. “Igual”: todos registraram o
            mesmo voto; “diferente”: pelo menos um registrou outro. Obstrução, ausência e demais registros ficam de fora. Da votação
            mais recente para a mais antiga. Fonte: registros de votação do {CASA_NOME[casa]}, coletados em {coleta[casa]}.
          </p>
          {d ? (
            <>
              <Lista titulo="Votaram diferente" itens={diferentes} casa={casa} escolhidos={escolhidos} rotulos={d.rotulos} arq={d} />
              <Lista titulo="Votaram igual" itens={iguais} casa={casa} escolhidos={escolhidos} rotulos={d.rotulos} arq={d} />
            </>
          ) : (
            <p className="text-[var(--cor-secundaria)]">{erro ? "Não foi possível carregar os votos. Tente recarregar a página." : "Carregando os votos…"}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
