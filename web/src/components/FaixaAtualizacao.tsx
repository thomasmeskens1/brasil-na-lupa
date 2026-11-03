/**
 * Faixa global "Dados oficiais atualizados em dd/mm/aaaa, hh:mm · Como atualizamos".
 * A data é a da última coleta registrada nos meta.json das fontes (content/inicio/atualizacao.json,
 * gerado por scripts/gerar-inicio.mjs), em horário de Brasília. Sem o arquivo, a faixa não aparece.
 *
 *   <FaixaAtualizacao />   // componente de servidor, no layout
 */
import Link from "next/link";
import { dataHoraBrasilia, getAtualizacao } from "@/features/inicio/dados";

export function FaixaAtualizacao() {
  const q = dataHoraBrasilia(getAtualizacao()?.coletado_em);
  if (!q) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-sm text-[var(--cor-secundaria)]">
      <span>
        Dados oficiais atualizados em {q.data}, {q.hora}
        <span className="sr-only"> (horário de Brasília)</span>
      </span>
      <span aria-hidden="true">·</span>
      <Link href="/metodologia" className="lk inline-flex min-h-11 items-center px-1">
        Como atualizamos
      </Link>
    </p>
  );
}
