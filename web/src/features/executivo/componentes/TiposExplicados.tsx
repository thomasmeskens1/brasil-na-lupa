import Link from "next/link";

export interface TipoExplicado {
  termo: string;
  /** Uma frase. */
  frase: string;
  /** Explicação completa, recolhida em "Saiba mais" (parágrafos). */
  mais?: readonly string[];
  link?: { href: string; rotulo: string };
}

/**
 * O que é cada tipo de ato ou de julgamento: uma frase à vista e o restante recolhido em
 * "Saiba mais" (texto neutro, sem juízo de valor — diretrizes 4 e 9).
 */
export function TiposExplicados({ id, titulo, itens }: { id: string; titulo: string; itens: readonly TipoExplicado[] }) {
  if (!itens.length) return null;
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-20">
      <h2 id={`${id}-titulo`} className="text-xl font-bold text-foreground">
        {titulo}
      </h2>
      <dl className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {itens.map((t) => (
          <div key={t.termo} className="cartao">
            <dt className="font-titulo font-bold text-foreground">{t.termo}</dt>
            <dd className="mt-1 leading-relaxed">
              {t.frase}
              {t.mais?.length || t.link ? (
                <details className="mt-1 text-sm">
                  <summary className="lk inline-flex min-h-11 items-center">
                    Saiba mais<span className="sr-only"> sobre {t.termo}</span>
                  </summary>
                  <div className="space-y-2 pb-1 leading-relaxed">
                    {t.mais?.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                    {t.link ? (
                      <p>
                        <Link href={t.link.href} className="lk inline-flex min-h-11 items-center">
                          {t.link.rotulo}
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
