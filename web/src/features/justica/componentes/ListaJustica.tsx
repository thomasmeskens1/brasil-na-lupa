"use client";

/**
 * Lista única da Justiça (STJ e/ou STF): baixa os índices estáticos dos temas logo depois de a
 * página abrir, junta os julgamentos acompanhados (vindos do servidor) e mostra tudo na lista com
 * filtros em caixas de seleção (FiltrosCompactos). Os números grandes e a explicação de cada tipo chegam prontos do servidor.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ListaFiltros, type GrupoNumeros, type ItemFiltro } from "@/features/executivo/componentes/ListaFiltros";
import { FACETAS_JUSTICA, TRIBUNAL_STF, TRIBUNAL_STJ, itensStf, itensStj, ordenarItens, type ArquivoStj } from "../lista";
import type { LinhaTemaStf } from "../tipos";

export interface ListaJusticaProps {
  stj: { ativo: boolean; coletadoEm: string | null };
  stf: { ativo: boolean; coletadoEm: string | null };
  julgamentos: ItemFiltro[];
  numeros: GrupoNumeros[];
  tituloLista: string;
  children?: ReactNode;
}

async function baixar<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as T;
}

export function ListaJustica({ stj, stf, julgamentos, numeros, tituloLista, children }: ListaJusticaProps) {
  const [itens, setItens] = useState<ItemFiltro[] | null>(null);
  const [erro, setErro] = useState(false);
  const soUm = stj.ativo !== stf.ativo;

  useEffect(() => {
    let vivo = true;
    Promise.all([
      stj.ativo ? baixar<ArquivoStj>("/justica/stj-temas.json").then((j) => itensStj(j, stj.coletadoEm)) : Promise.resolve([]),
      stf.ativo ? baixar<{ t: LinhaTemaStf[] }>("/justica/stf-temas.json").then((j) => itensStf(j, stf.coletadoEm)) : Promise.resolve([]),
    ])
      .then(([a, b]) => vivo && setItens(ordenarItens([...a, ...b, ...julgamentos])))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [stj.ativo, stj.coletadoEm, stf.ativo, stf.coletadoEm, julgamentos]);

  const fixos = useMemo(() => {
    const f: Record<string, string> = {};
    if (soUm) f.tribunal = stj.ativo ? TRIBUNAL_STJ : TRIBUNAL_STF;
    return f;
  }, [soUm, stj.ativo]);
  const facetas = useMemo(() => (stf.ativo ? FACETAS_JUSTICA : FACETAS_JUSTICA.filter((f) => f.chave !== "repercussao")), [stf.ativo]);

  return (
    <ListaFiltros
      itens={itens}
      erro={erro}
      facetas={facetas}
      fixos={fixos}
      numeros={numeros}
      busca={{ rotulo: "Buscar pelo número ou por palavras da questão, da tese ou do processo", dica: "Ex.: ICMS, honorários, 1265, ADI 7616" }}
      rotulo={{ singular: "tema ou julgamento", plural: "temas e julgamentos" }}
      ordem="do mais recente para o mais antigo (pela data do cartão)"
      tituloLista={tituloLista}
      compacto
    >
      {children}
    </ListaFiltros>
  );
}
