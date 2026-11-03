import Link from "next/link";
import { getIndiceEstado } from "../dados";

/**
 * Atos, projetos e votações do Estado de São Paulo que correspondem a uma decisão do ICMS pelo
 * número do projeto ou da lei/decreto (correspondência exata, calculada no build).
 */
export function LigacoesIcmsEstado({ decisaoId }: { decisaoId: string }) {
  const links = getIndiceEstado("sp")?.ligacoes_icms[decisaoId] ?? [];
  if (!links.length) return null;
  return (
    <section aria-labelledby="no-acompanhamento-sp" className="scroll-mt-20">
      <h2 id="no-acompanhamento-sp" className="text-xl font-bold text-foreground">
        No acompanhamento do Estado de São Paulo
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-[var(--cor-secundaria)]">
        Itens da seção Estados (São Paulo) com o mesmo número de projeto, lei ou decreto citado nesta decisão.
      </p>
      <ul className="mt-3 space-y-1">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} prefetch={false} className="lk inline-flex min-h-11 items-center">
              {l.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
