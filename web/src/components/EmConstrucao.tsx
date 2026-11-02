import Link from "next/link";
import type { ReactNode } from "react";

export interface EmConstrucaoProps {
  titulo: string;
  introducao: ReactNode;
  /** O que a seção vai mostrar (sem datas prometidas). */
  itens: ReactNode[];
  /** Fontes oficiais que serão usadas. */
  fontes: string[];
}

/** Página provisória de uma seção que ainda não foi publicada. */
export function EmConstrucao({ titulo, introducao, itens, fontes }: EmConstrucaoProps) {
  return (
    <article className="max-w-3xl space-y-6">
      <header>
        <p className="selo">Em construção</p>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">{titulo}</h1>
        <div className="mt-2 text-gray-800">{introducao}</div>
      </header>
      <section aria-labelledby="o-que-vira">
        <h2 id="o-que-vira" className="text-lg font-bold text-gray-900">
          O que esta seção vai mostrar
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-800">
          {itens.map((i, n) => (
            <li key={n}>{i}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="fontes-previstas">
        <h2 id="fontes-previstas" className="text-lg font-bold text-gray-900">
          Fontes oficiais que serão usadas
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-800">
          {fontes.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
      <p className="text-sm text-gray-800">
        Enquanto isso, veja{" "}
        <Link href="/impostos/icms" className="lk">
          ICMS: quem decidiu e por quê
        </Link>{" "}
        e a{" "}
        <Link href="/metodologia" className="lk">
          metodologia
        </Link>{" "}
        do site.
      </p>
    </article>
  );
}
