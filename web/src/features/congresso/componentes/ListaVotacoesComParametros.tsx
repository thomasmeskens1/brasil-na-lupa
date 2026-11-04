"use client";

/**
 * Lê os atalhos do endereço (/congresso?tema=Saúde, ?casa=senado, ?resultado=rejeitada) e abre
 * a lista já filtrada. A página é gerada no build; por isso o uso fica dentro de <Suspense>,
 * com a lista sem filtro como reserva (é ela que vai no HTML). Mudar o atalho recria a lista.
 */
import { useSearchParams } from "next/navigation";
import { ListaVotacoes, type ListaVotacoesProps } from "./ListaVotacoes";

export function ListaVotacoesComParametros(props: Omit<ListaVotacoesProps, "inicial">) {
  const sp = useSearchParams();
  const inicial = { tema: sp.get("tema") ?? "", casa: sp.get("casa") ?? "", resultado: sp.get("resultado") ?? "" };
  return <ListaVotacoes key={`${inicial.tema}|${inicial.casa}|${inicial.resultado}`} {...props} inicial={inicial} />;
}
