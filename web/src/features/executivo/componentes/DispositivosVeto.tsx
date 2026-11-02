"use client";

/**
 * Trechos (dispositivos) de um veto: lista recolhida, 10 por vez, com a situação de cada um no
 * resumo e filtro por situação. O texto vetado, as razões e os votos só são baixados quando o
 * leitor abre o trecho, para a página não carregar dezenas de textos legais de uma vez.
 */
import { useMemo, useState } from "react";
import { ItemRecolhivel } from "@/components/decisao";
import { ListaRecolhivel } from "@/components/lista";
import { FiltrosCompactos, normalizarBusca } from "@/components/tabela";
import { formatarData } from "@/features/congresso/rotulos";
import type { ResumoDispositivo } from "../tipos";
import { DetalheDispositivo } from "./DetalheDispositivo";

export function DispositivosVeto({ itens, urlOficial }: { itens: ResumoDispositivo[]; urlOficial?: string | null }) {
  const [termo, setTermo] = useState("");
  const [situacao, setSituacao] = useState("");
  const opcoes = useMemo(() => [...new Set(itens.map((i) => i.situacaoRotulo))].sort((a, b) => a.localeCompare(b, "pt-BR")), [itens]);
  const indice = useMemo(
    () => itens.map((i) => normalizarBusca(`${i.identificador ?? ""} ${i.dispositivo ?? ""} ${i.assunto ?? ""}`)),
    [itens],
  );
  const partes = normalizarBusca(termo).split(/\s+/).filter(Boolean);
  const filtrados = itens.filter((it, n) => (!situacao || it.situacaoRotulo === situacao) && partes.every((p) => indice[n].includes(p)));

  return (
    <div className="space-y-3">
      {itens.length > 5 ? (
        <FiltrosCompactos
          busca={{ valor: termo, aoMudar: setTermo, rotulo: "Buscar no assunto ou no artigo", dica: "Ex.: art. 3º, barragens" }}
          filtros={opcoes.length > 1 ? [{ id: "situacao", rotulo: "Situação", valor: situacao, aoMudar: setSituacao, opcoes, todos: "Todas" }] : []}
          aoLimpar={() => {
            setTermo("");
            setSituacao("");
          }}
        />
      ) : null}
      <ListaRecolhivel
        key={`${situacao}|${termo}`}
        ordenada
        inicial={10}
        rotulo={{ singular: "trecho vetado", plural: "trechos vetados" }}
        itens={filtrados.map((r) => (
          <ItemRecolhivel
            key={r.codigo}
            id={`dispositivo-${r.codigo}`}
            resumo={
              <span className="block">
                <span className="block font-semibold text-foreground [overflow-wrap:break-word]">
                  {r.assunto ?? r.dispositivo ?? `Trecho ${r.ordem}`}
                </span>
                <span className="block text-sm font-normal text-[var(--cor-secundaria)]">
                  Trecho {r.identificador ?? r.ordem}
                  {r.assunto && r.dispositivo ? ` · ${r.dispositivo}` : ""}
                  {r.dataSessao ? ` · sessão de ${formatarData(r.dataSessao)}` : ""}
                </span>
              </span>
            }
            selo={<span className={r.situacao === "não apreciado" ? "selo" : "selo selo-escuro"}>{r.situacaoRotulo}</span>}
          >
            <DetalheDispositivo r={r} urlOficial={urlOficial} />
          </ItemRecolhivel>
        ))}
      />
    </div>
  );
}
