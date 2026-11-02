import type { Metadata } from "next";
import Link from "next/link";
import { tituloSimplesDe } from "@/components/decisao/rotulos";
import { metadadosCompartilhamento } from "@/components/compartilhar/metadados";
import { getDecisoes, getTitulos } from "@/features/icms/dados";
import { itemDaLista } from "@/features/icms/cartao";
import { AvisoProvisorio } from "@/features/icms/componentes/DetalheDecisao";
import { JusticaIcms } from "@/features/icms/componentes/JusticaIcms";
import { ListaIcms } from "@/features/icms/componentes/ListaIcms";
import { QuemPodeMudar } from "@/features/icms/componentes/QuemPodeMudar";
import { formatarData } from "@/features/icms/rotulos";

export const metadata: Metadata = metadadosCompartilhamento({
  titulo: "ICMS: quem decidiu e por quê",
  descricao:
    "As decisões que mudaram o Imposto sobre Circulação de Mercadorias e Serviços (ICMS) em São Paulo: o que mudou, quem decidiu, como votou e a justificativa oficial.",
  caminho: "/impostos/icms",
});

export default function IcmsPage() {
  const dados = getDecisoes();
  const titulos = getTitulos("icms");
  const itens = dados.itens.map((d) => itemDaLista(d, tituloSimplesDe(titulos, d.id)));

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="text-base">
          <Link href="/impostos" className="lk inline-flex min-h-11 items-center">
            Impostos
          </Link>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">ICMS: quem decidiu e por quê</h1>
        <p className="mt-2 leading-relaxed text-gray-800">
          O Imposto sobre Circulação de Mercadorias e Serviços (ICMS) é cobrado pelos estados sobre mercadorias, como
          combustíveis, e serviços, como energia. Veja o que mudou em São Paulo, quem decidiu e a fonte oficial.
        </p>
        <p className="meta mt-2">Dados atualizados em {formatarData(dados.atualizado_em)}.</p>
      </header>

      {dados.provisorio ? <AvisoProvisorio /> : null}

      <section id="decisoes" aria-labelledby="decisoes-titulo" className="scroll-mt-20 space-y-4">
        <h2 id="decisoes-titulo" className="text-xl font-bold text-gray-900">
          Decisões sobre o ICMS
        </h2>
        <QuemPodeMudar />
        <ListaIcms itens={itens} />
      </section>

      <JusticaIcms />
    </div>
  );
}
