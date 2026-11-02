import type { Metadata } from "next";
import { Secao } from "@/components/Secao";
import { getDecisoes } from "@/features/icms/dados";
import { AvisoProvisorio } from "@/features/icms/componentes/DetalheDecisao";
import { LinhaDoTempo, type ItemLinha } from "@/features/icms/componentes/LinhaDoTempo";
import { QuemPodeMudar } from "@/features/icms/componentes/QuemPodeMudar";
import { formatarData, houveVotoDeParlamentares, nomeDoAto } from "@/features/icms/rotulos";
import { DecisoesJudiciaisIcms } from "@/features/justica/componentes/DecisoesJudiciaisIcms";

export const metadata: Metadata = {
  title: "ICMS: quem decidiu e por quê",
  description:
    "As decisões que mudaram o Imposto sobre Circulação de Mercadorias e Serviços (ICMS) em São Paulo: o que mudou, quem decidiu, como votou e a justificativa oficial.",
};

export default function IcmsPage() {
  const dados = getDecisoes();
  const itens: ItemLinha[] = dados.itens.map((d) => ({
    id: d.id,
    titulo: d.titulo,
    resumo: d.resumo ?? null,
    caminho: d.caminho,
    ato: nomeDoAto(d),
    data: d.datas?.decisao ?? d.datas?.publicacao ?? null,
    semVotoDeParlamentares: !houveVotoDeParlamentares(d),
  }));

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="meta">Impostos</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">ICMS: quem decidiu e por quê</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          O Imposto sobre Circulação de Mercadorias e Serviços (ICMS) é cobrado pelos estados e pelo
          Distrito Federal sobre a venda de mercadorias, como combustíveis e alimentos, e sobre alguns
          serviços, como energia e comunicação. Esta página reúne as decisões que mudaram o ICMS em
          São Paulo, com o que mudou, quem decidiu e a justificativa registrada em documento oficial.
        </p>
        <p className="meta mt-3">Dados atualizados em {formatarData(dados.atualizado_em)}.</p>
      </header>

      {dados.provisorio ? <AvisoProvisorio /> : null}

      <Secao
        id="quem-pode-mudar"
        titulo="Quem pode mudar o ICMS"
        descricao="Há quatro caminhos. Nos convênios do CONFAZ e nos decretos do governador, não há votação de deputados nem de senadores."
      >
        <QuemPodeMudar />
      </Secao>

      <Secao
        id="decisoes"
        titulo="Linha do tempo das decisões"
        descricao="Escolha um caminho para ver só as decisões tomadas por ele."
      >
        <LinhaDoTempo itens={itens} />
      </Secao>

      <DecisoesJudiciaisIcms />
    </div>
  );
}
