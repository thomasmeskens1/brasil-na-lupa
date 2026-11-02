import Link from "next/link";

/** Caminho de navegação ("Você está em") com alvos de toque de 44 px. */
export function Migalhas({ itens }: { itens: { href: string; rotulo: string }[] }) {
  return (
    <nav aria-label="Você está em" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-1">
        {itens.map((i, n) => (
          <li key={i.href} className="flex items-center gap-x-1">
            {n ? (
              <span aria-hidden="true" className="text-[var(--cor-secundaria)]">
                ›
              </span>
            ) : null}
            <Link href={i.href} className="lk inline-flex min-h-11 items-center px-1">
              {i.rotulo}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Lista de termos explicados recolhida (os principais já aparecem em balão no texto). */
export function TermosRecolhidos({ termos }: { termos: readonly { termo: string; explicacao: string }[] }) {
  if (!termos.length) return null;
  return (
    <details className="rounded-md border border-borda bg-white">
      <summary className="pr-3">
        Termos explicados <span className="font-normal text-[var(--cor-secundaria)]">({termos.length})</span>
      </summary>
      <dl className="grid grid-cols-1 gap-3 border-t border-borda px-3 pb-3 pt-2 md:grid-cols-2">
        {termos.map((t) => (
          <div key={t.termo}>
            <dt className="font-semibold text-foreground">{t.termo}</dt>
            <dd className="mt-0.5 leading-relaxed">{t.explicacao}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
