import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impostos",
  description: "Mudanças em impostos: quem decidiu, por qual caminho e com qual justificativa oficial.",
};

export default function ImpostosPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Impostos</h1>
        <p className="mt-2 text-gray-800">
          Mudanças em impostos que afetam o Estado de São Paulo, com o que mudou, quem decidiu, por
          qual caminho e a justificativa registrada em documento oficial.
        </p>
      </header>
      <ul className="space-y-4">
        <li className="cartao">
          <h2 className="text-lg font-semibold text-gray-900">
            <Link href="/impostos/icms" className="lk">
              ICMS: quem decidiu e por quê
            </Link>
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-800">
            O Imposto sobre Circulação de Mercadorias e Serviços (ICMS) é cobrado pelos estados. Veja
            as decisões que mudaram o ICMS em São Paulo pelos quatro caminhos possíveis: o Conselho
            Nacional de Política Fazendária (CONFAZ), a Assembleia Legislativa, o governador e o
            Congresso Nacional com a Presidência da República.
          </p>
        </li>
      </ul>
    </div>
  );
}
