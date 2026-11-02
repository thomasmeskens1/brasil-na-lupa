import Link from "next/link";
import { formatarData } from "@/features/congresso/rotulos";

export interface CartaoTemaProps {
  href: string;
  tribunal: string;
  rotulo: string;
  situacao: string | null;
  orgao?: string | null;
  data?: string | null;
  questao: string | null;
  tese?: string | null;
  nivel?: 3 | 4;
}

const LIMITE = 320;

function trecho(t: string): string {
  return t.length > LIMITE ? `${t.slice(0, LIMITE).replace(/\s+\S*$/, "")} […]` : t;
}

/** Cartão-resumo de um tema de tribunal (questão e tese em trecho, com link para o detalhe). */
export function CartaoTema({ href, tribunal, rotulo, situacao, orgao, data, questao, tese, nivel = 3 }: CartaoTemaProps) {
  const H = `h${nivel}` as "h3" | "h4";
  return (
    <article className="cartao h-full">
      <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-gray-900">{tribunal}</span>
        {situacao ? <span className="selo">{situacao}</span> : null}
        {orgao ? <span>{orgao}</span> : null}
        {data ? <span>· {formatarData(data)}</span> : null}
      </p>
      <H className="mt-2 text-base font-semibold text-gray-900">
        <Link href={href} className="lk">
          {rotulo}
        </Link>
      </H>
      <p className="mt-1 text-sm leading-relaxed text-gray-800">
        <span className="font-medium text-gray-900">Questão: </span>
        {questao ? trecho(questao) : "Não disponível em fonte oficial"}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-gray-800">
        <span className="font-medium text-gray-900">Tese: </span>
        {tese ? trecho(tese) : "Ainda não firmada ou não disponível em fonte oficial"}
      </p>
    </article>
  );
}
