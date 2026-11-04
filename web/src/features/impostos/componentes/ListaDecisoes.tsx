/** Links para decisões já coletadas no site (votações, vetos, leis), com o placar oficial. */
import Link from "next/link";
import type { LinkDecisao } from "../tipos";

export function ListaDecisoes({ itens }: { itens: LinkDecisao[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {itens.map((d) => (
        <li key={d.href} className="cartao-decisao">
          <Link href={d.href} className="cartao-decisao__link font-semibold">
            {d.rotulo}
          </Link>
          {d.detalhe ? <p className="meta mt-1">{d.detalhe}</p> : null}
        </li>
      ))}
    </ul>
  );
}
