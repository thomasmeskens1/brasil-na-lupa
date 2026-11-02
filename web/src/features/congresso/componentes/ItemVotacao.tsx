import Link from "next/link";
import type { Casa } from "../tipos";
import { CASA_NOME, formatarData, rotaVotacao, rotuloResultadoCurto, rotuloTipo } from "../rotulos";

export interface ItemVotacaoProps {
  casa: Casa;
  id: string;
  data: string | null;
  tipo: string | null;
  resultado: string | null;
  titulo: string | null;
  descricao: string | null;
  sim?: number | null;
  nao?: number | null;
  /** Mostra o nome da casa (útil em listas que misturam as duas). */
  mostrarCasa?: boolean;
  nivel?: 3 | 4;
}

/** Cartão-resumo de uma votação (lista de recentes e resultados da busca). */
export function ItemVotacao({
  casa,
  id,
  data,
  tipo,
  resultado,
  titulo,
  descricao,
  sim,
  nao,
  mostrarCasa = true,
  nivel = 3,
}: ItemVotacaoProps) {
  const H = `h${nivel}` as "h3" | "h4";
  const temPlacar = typeof sim === "number" || typeof nao === "number";
  return (
    <article className="cartao">
      <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-gray-900">{formatarData(data)}</span>
        {mostrarCasa ? <span>{CASA_NOME[casa]}</span> : null}
        <span className="selo">{rotuloTipo(tipo)}</span>
        <span>· {resultado ? rotuloResultadoCurto(resultado) : "Resultado não informado"}</span>
        {temPlacar ? (
          <span>
            · Sim {sim ?? "–"}, Não {nao ?? "–"}
          </span>
        ) : null}
      </p>
      <H className="mt-2 text-base font-semibold text-gray-900">
        <Link href={rotaVotacao(casa, id)} className="lk">
          {titulo ?? "Proposição não informada"}
        </Link>
      </H>
      <p className="mt-1 text-sm leading-relaxed text-gray-800">
        {descricao || "Descrição não disponível em fonte oficial"}
      </p>
    </article>
  );
}
