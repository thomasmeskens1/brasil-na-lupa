"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FonteLink } from "@/components/FonteLink";
import { MostrarMais } from "@/components/lista/MostrarMais";
import { FiltrosCompactos, normalizarBusca } from "@/components/tabela";

/** public/municipios/<uf>/<cidade>/camara.json (ver scripts/gerar-municipios.mjs). */
type LinhaP = [id: string, identificacao: string | null, ementa: string | null, data: string | null, autores: string, situacao: string | null, url: string | null];
type LinhaN = [id: string, tipo: string | null, numero: string | number | null, ano: number | null, data: string | null, ementa: string | null, url: string | null];
type LinhaV = [id: string, data: string | null, descricao: string | null, resultado: string | null, tipo: string | null, nVotos: number, ementa: string | null];
interface Arquivo {
  p: LinhaP[];
  n: LinhaN[];
  v: LinhaV[];
}

const NAO = "Informação não disponível em fonte oficial";
const data = (v: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "data não informada";
};
const FORMA: Record<string, string> = { nominal: "Votação nominal", simbolica: "Votação simbólica", secreta: "Votação secreta" };

export function BuscaCamara({ uf, cidade, casa, inicial = "p" }: { uf: string; cidade: string; casa: string; inicial?: "p" | "v" | "n" }) {
  const [d, setD] = useState<Arquivo | null>(null);
  const [erro, setErro] = useState(false);
  const [tipo, setTipo] = useState<"p" | "v" | "n">(inicial);
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(30);

  useEffect(() => {
    let vivo = true;
    fetch(`/municipios/${uf}/${cidade}/camara.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((x: Arquivo) => vivo && setD(x))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [uf, cidade]);

  const lista = useMemo(() => {
    if (!d) return [];
    const q = normalizarBusca(busca.trim());
    const tem = (...t: (string | number | null)[]) => !q || normalizarBusca(t.filter((x) => x != null).join(" ")).includes(q);
    if (tipo === "p") return d.p.filter((x) => tem(x[1], x[2], x[4]));
    if (tipo === "n") return d.n.filter((x) => tem(x[1], x[2], x[3], x[5]));
    return d.v.filter((x) => tem(x[2], x[3], x[6]));
  }, [d, tipo, busca]);
  const vis = lista.slice(0, limite);
  const nomes = { p: { singular: "proposição", plural: "proposições" }, v: { singular: "votação", plural: "votações" }, n: { singular: "norma", plural: "normas" } }[tipo];

  if (erro) return <p className="lacuna">Não foi possível carregar a lista. Tente recarregar a página.</p>;

  return (
    <div className="space-y-4">
      <FiltrosCompactos
        busca={{ valor: busca, aoMudar: (v) => (setBusca(v), setLimite(30)), rotulo: "Buscar por palavra, número ou autor", dica: "Ex.: saúde" }}
        filtros={[
          {
            id: "tipo",
            rotulo: "Mostrar",
            valor: tipo,
            aoMudar: (v) => (setTipo((v || "p") as "p" | "v" | "n"), setLimite(30)),
            opcoes: [
              { valor: "p", rotulo: "Proposições" },
              { valor: "v", rotulo: "Votações" },
              { valor: "n", rotulo: "Leis e outras normas" },
            ],
            todos: "Proposições",
          },
        ]}
        contagem={d ? `Mostrando ${vis.length.toLocaleString("pt-BR")} de ${lista.length.toLocaleString("pt-BR")} ${nomes.plural}` : "Carregando…"}
        aoLimpar={() => {
          setBusca("");
          setTipo("p");
          setLimite(30);
        }}
      />
      {d && !lista.length ? <p className="lacuna">Nenhum registro encontrado.</p> : null}
      <ul className="space-y-3">
        {tipo === "p"
          ? (vis as LinhaP[]).map((x) => (
              <li key={x[0]} className="cartao space-y-1">
                <p className="meta">{data(x[3])}</p>
                <p className="font-semibold text-foreground">{x[1] ?? "Proposição sem identificação na fonte"}</p>
                <p className="text-sm">{x[2] ?? `Ementa: ${NAO}`}</p>
                <p className="meta">Autoria: {x[4] || NAO}</p>
                {x[5] ? <p className="meta">Última tramitação: {x[5]}</p> : null}
                {x[6] ? <FonteLink href={x[6]} tipo="oficial">Página oficial no SAPL da {casa}</FonteLink> : null}
              </li>
            ))
          : tipo === "n"
            ? (vis as LinhaN[]).map((x) => (
                <li key={x[0]} className="cartao space-y-1">
                  <p className="meta">{data(x[4])}</p>
                  <p className="font-semibold text-foreground">
                    {x[1] ?? "Norma"} nº {x[2] ?? "não informado"}
                    {x[3] ? `/${x[3]}` : ""}
                  </p>
                  <p className="text-sm">{x[5] ?? `Ementa: ${NAO}`}</p>
                  {x[6] ? <FonteLink href={x[6]} tipo="oficial">Página oficial no SAPL da {casa}</FonteLink> : null}
                </li>
              ))
            : (vis as LinhaV[]).map((x) => (
                <li key={x[0]} className="cartao space-y-1">
                  <p className="meta">
                    {data(x[1])} · {x[4] ? FORMA[x[4]] : "Tipo de votação não informado"}
                  </p>
                  <p className="font-semibold text-foreground">{x[6] ?? x[2] ?? "Item sem descrição na fonte"}</p>
                  {x[2] ? <p className="meta">{x[2]}</p> : null}
                  <p className="text-sm">Resultado (texto oficial): {x[3] ?? NAO}</p>
                  <Link href={`/municipios/${uf}/${cidade}/votacoes/${x[0]}`} prefetch={false} className="lk inline-flex min-h-11 items-center">
                    {x[4] === "nominal" && x[5] ? "Ver como votou cada vereador" : "Ver detalhes da votação"}
                  </Link>
                </li>
              ))}
      </ul>
      {d ? <MostrarMais visiveis={vis.length} total={lista.length} passo={30} itens={nomes} aoMostrar={setLimite} genero="f" /> : null}
    </div>
  );
}
