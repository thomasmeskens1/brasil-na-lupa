"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TextoComSiglas } from "@/components/glossario";
import { FiltrosCompactos, normalizarBusca } from "@/components/tabela";
import { compararVotos, formatarData, rotuloVoto } from "../rotulos";
import type { ArquivoVotacoes } from "./BuscaVotacoes";
import { MostrarMais } from "@/components/lista/MostrarMais";

export interface LinhaVotoDeputado {
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

/** Votos do deputado nas comissões, lidos do índice estático (o mesmo da busca de votações). */
function linhasDeComissao(a: ArquivoVotacoes, pid: string): LinhaVotoDeputado[] {
  const nomes = new Set(a.n.flatMap(([, id], i) => (id === pid ? [i] : [])));
  const out: LinhaVotoDeputado[] = [];
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
      ementa: p?.[2] || null,
      descricao: l[6] || null,
      resultado: null,
      voto: [...new Set(votos)].join(" / "),
      registros: votos.length,
      marcador: null,
    });
  }
  return out;
}

const POR_PAGINA = 30;

/** Votos de um deputado nas votações nominais (Plenário e comissões), do mais recente ao mais antigo. */
export function VotosDoDeputado({ uf, base, pid, plenario, nComissao }: { uf: string; base: string; pid: string; plenario: LinhaVotoDeputado[]; nComissao: number }) {
  const [comissoes, setComissoes] = useState<LinhaVotoDeputado[] | null>(nComissao ? null : []);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (!nComissao) return;
    let ativo = true;
    fetch(`/estados/${uf}/votacoes.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: ArquivoVotacoes) => ativo && setComissoes(linhasDeComissao(j, pid)))
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [uf, pid, nComissao]);
  const linhas = useMemo(
    () => [...plenario, ...(comissoes ?? [])].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "") || Number(b.plenario) - Number(a.plenario)),
    [plenario, comissoes],
  );
  const [busca, setBusca] = useState("");
  const [onde, setOnde] = useState("");
  const [voto, setVoto] = useState("");
  const [ano, setAno] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  const indexadas = useMemo(() => linhas.map((l) => normalizarBusca(`${l.proposicao ?? ""} ${l.ementa ?? ""} ${l.descricao ?? ""} ${l.orgao ?? ""}`)), [linhas]);
  const opVoto = useMemo(() => [...new Set(linhas.map((l) => l.voto))].sort(compararVotos).map((v) => ({ valor: v, rotulo: rotuloVoto(v) })), [linhas]);
  const opAno = useMemo(() => [...new Set(linhas.map((l) => l.data?.slice(0, 4)).filter((x): x is string => !!x))].sort().reverse(), [linhas]);
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  const filtradas = linhas.filter(
    (l, i) => (!onde || (onde === "p") === l.plenario) && (!voto || l.voto === voto) && (!ano || l.data?.startsWith(ano)) && termos.every((t) => indexadas[i].includes(t)),
  );
  const resto = filtradas.length - Math.min(limite, filtradas.length);

  function com(set: (v: string) => void) {
    return (v: string) => {
      setLimite(POR_PAGINA);
      set(v);
    };
  }

  return (
    <div className="space-y-4">
      <FiltrosCompactos
        busca={{ valor: busca, aoMudar: com(setBusca), rotulo: "Buscar no projeto ou no texto", dica: "Ex.: ICMS" }}
        filtros={[
          { id: "onde", rotulo: "Onde foi votado", valor: onde, aoMudar: com(setOnde), opcoes: [{ valor: "p", rotulo: "Plenário" }, { valor: "c", rotulo: "Comissões" }], todos: "Plenário e comissões" },
          { id: "voto", rotulo: "Voto (texto oficial)", valor: voto, aoMudar: com(setVoto), opcoes: opVoto },
          { id: "ano", rotulo: "Ano", valor: ano, aoMudar: com(setAno), opcoes: opAno },
        ]}
        contagem={`${filtradas.length === 1 ? "1 votação" : `${filtradas.length.toLocaleString("pt-BR")} votações`} de ${linhas.length.toLocaleString("pt-BR")}, da mais recente para a mais antiga${
          !comissoes && !erro ? " (carregando as comissões…)" : ""
        }`}
        aoLimpar={() => {
          setBusca("");
          setOnde("");
          setVoto("");
          setAno("");
          setLimite(POR_PAGINA);
        }}
      />
      {erro ? <p className="lacuna">Não foi possível carregar os votos em comissões. Tente recarregar a página.</p> : null}
      <ul className="space-y-3">
        {filtradas.slice(0, limite).map((l) => (
          <li key={l.id} className="cartao">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--cor-secundaria)]">
              <span className="selo">{l.plenario ? "Plenário" : "Comissão"}</span>
              <span>{formatarData(l.data)}</span>
              {!l.plenario && l.orgao ? <span>· {l.orgao}</span> : null}
            </p>
            <p className="mt-2 text-lg font-semibold leading-snug">
              <Link href={l.plenario ? `${base}/votacoes/${l.id}` : `${base}/votacoes#id=${l.id}`} prefetch={false} className="lk">
                <TextoComSiglas explicar={false}>{l.ementa ?? l.proposicao ?? (l.descricao || "Proposição não informada")}</TextoComSiglas>
              </Link>
            </p>
            {l.proposicao && l.ementa ? (
              <p className="mt-1 text-[var(--cor-secundaria)]">
                <TextoComSiglas>{l.proposicao}</TextoComSiglas>
              </p>
            ) : null}
            <p className="mt-2 rounded-md border border-borda bg-superficie px-3 py-2">
              <span className="text-[var(--cor-secundaria)]">Voto registrado: </span>
              <strong className="text-lg">{rotuloVoto(l.voto)}</strong>
              {l.registros > 1 ? <span className="meta"> ({l.registros} registros na fonte)</span> : null}
              {l.marcador ? <span className="meta"> · letra “{l.marcador}” antes do nome (sem legenda no documento)</span> : null}
            </p>
            {l.descricao && (l.proposicao || l.ementa) ? (
              <p className="meta mt-2">
                {l.plenario ? "Descrição oficial" : "Deliberação"}: <TextoComSiglas>{l.descricao}</TextoComSiglas>
                {l.plenario && l.resultado ? ` · resultado: ${l.resultado}` : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {!filtradas.length && (comissoes || erro) ? <p className="lacuna">Nenhuma votação com esses filtros.</p> : null}
      <MostrarMais
        visiveis={filtradas.length - resto}
        total={filtradas.length}
        passo={POR_PAGINA}
        itens={{ singular: "votação", plural: "votações" }}
        genero="f"
        aoMostrar={setLimite}
      />
    </div>
  );
}
