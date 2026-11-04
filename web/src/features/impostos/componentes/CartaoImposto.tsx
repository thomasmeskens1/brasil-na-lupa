/**
 * Cartão de um imposto: figurinha, sigla (link para a página do imposto), nome completo, quem
 * cobra, o que é tributado, situação na reforma e um resumo. O cartão inteiro é clicável (um
 * único link para leitor de tela, padrão .cartao-decisao).
 */
import Link from "next/link";
import { FigurinhaImposto } from "../FigurinhaImposto";
import { ROTULO_BASE, esferasPorExtenso } from "../dados";
import type { Imposto } from "../tipos";

export function CartaoImposto({ imposto: i, nivel = 3 }: { imposto: Imposto; nivel?: 2 | 3 }) {
  const Titulo = nivel === 2 ? "h2" : "h3";
  return (
    <article className="cartao-decisao flex h-full flex-col gap-3">
      <div className="flex items-start gap-3">
        <FigurinhaImposto nome={i.figura} className="h-14 w-14 shrink-0" />
        <div className="min-w-0">
          <Titulo className="text-lg font-bold leading-tight text-gray-900">
            <Link href={`/impostos/${i.slug}`} className="cartao-decisao__link">
              {i.sigla}
            </Link>
          </Titulo>
          {i.sigla !== i.nome ? <p className="mt-0.5 text-sm text-[var(--cor-secundaria)]">{i.nome}</p> : null}
        </div>
      </div>
      <p className="leading-relaxed text-gray-800">{i.resumo}</p>
      <dl className="mt-auto grid grid-cols-1 gap-1 text-sm">
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-semibold text-[var(--cor-secundaria)]">Quem cobra:</dt>
          <dd>{esferasPorExtenso(i.esferas)}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-semibold text-[var(--cor-secundaria)]">Tributa:</dt>
          <dd>{ROTULO_BASE[i.base]}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-semibold text-[var(--cor-secundaria)]">Na reforma:</dt>
          <dd>{i.situacao}</dd>
        </div>
      </dl>
    </article>
  );
}
