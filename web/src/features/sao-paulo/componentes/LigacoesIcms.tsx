import Link from "next/link";
import { getIndiceSp } from "../dados";

/**
 * Atos, projetos e votações da seção São Paulo que correspondem a uma decisão do ICMS pelo
 * número do projeto ou da lei/decreto (correspondência exata, calculada no build).
 */
export function LigacoesIcmsSp({ decisaoId }: { decisaoId: string }) {
  const links = getIndiceSp().ligacoes_icms[decisaoId] ?? [];
  if (!links.length) return null;
  return (
    <section aria-labelledby="no-acompanhamento-sp" className="scroll-mt-20">
      <h2 id="no-acompanhamento-sp" className="text-xl font-bold text-gray-900">
        No acompanhamento do Estado de São Paulo
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-700">
        Itens da seção São Paulo com o mesmo número de projeto, lei ou decreto citado nesta decisão.
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} prefetch={false} className="lk">
              {l.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
