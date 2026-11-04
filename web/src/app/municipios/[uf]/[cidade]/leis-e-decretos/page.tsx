import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { BuscaNormasAtibaia } from "@/features/atibaia/componentes/BuscaNormasAtibaia";
import { getIndiceAtibaia } from "@/features/atibaia/dados";
import { TERMOS_ATIBAIA } from "@/features/atibaia/termos";
import { formatarDataSp as data } from "@/features/sao-paulo/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";
import { Migalhas } from "@/features/executivo/componentes/Migalhas";

export const metadata: Metadata = {
  title: "Leis e decretos de Atibaia",
  description: "Leis, leis complementares e decretos do município de Atibaia publicados na Imprensa Oficial, com a ementa e o link para a edição.",
  alternates: { canonical: "/municipios/sp/atibaia/leis-e-decretos" },
};

/** Por enquanto só Atibaia tem a busca de leis e decretos do prefeito (Imprensa Oficial do Município). */
export function generateStaticParams() {
  return [{ uf: "sp", cidade: "atibaia" }];
}

export default async function LeisEDecretosMunicipioPage({ params }: PageProps<"/municipios/[uf]/[cidade]/leis-e-decretos">) {
  const { uf, cidade } = await params;
  if (uf !== "sp" || cidade !== "atibaia") notFound();
  const ind = getIndiceAtibaia();
  const cob = ind.normas.coberturas.find((c) => c.primeira_edicao);
  return (
    <div className="space-y-10">
      <Migalhas
        itens={[
          { href: "/municipios", rotulo: "Municípios" },
          { href: "/municipios/sp/atibaia", rotulo: "Atibaia" },
        ]}
      />
      <header className="max-w-3xl">
        <Figurinha nome="cidade" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Leis e decretos de Atibaia</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          Leis e leis complementares aprovadas pela Câmara Municipal e decretos do prefeito, lidos nas edições da Imprensa
          Oficial Eletrônica do município{cob?.primeira_edicao ? ` de ${data(cob.primeira_edicao)} a ${data(cob.ultima_edicao)}` : ""}.
          Cada ato traz o número, a data, a ementa (resumo oficial) e o link para a página da edição em que foi publicado.
        </p>
        <p className="mt-2 text-sm text-gray-800">
          Só entram atos com número, data e ementa identificados sem dúvida no texto publicado ou conferidos pela curadoria.
          Nomes de cidadãos citados nos atos, como permissionários e beneficiários, aparecem como “[nome de particular
          omitido]”, e documentos pessoais como “[documento omitido]”; o texto completo está no documento oficial.
        </p>
        <p className="meta mt-3">
          {ind.normas.total} atos · dados coletados em {data(ind.normas.atualizado_em)}.
        </p>
      </header>

      <Secao id="lista" titulo="Buscar leis e decretos" descricao="A lista é baixada pelo seu navegador e a busca roda nele: o que você digita não é enviado a nenhum servidor.">
        <BuscaNormasAtibaia />
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={TERMOS_ATIBAIA.slice(0, 3)} />
      </Secao>

      <Secao id="fontes" titulo="Fonte">
        <ListaFontes fontes={ind.normas.fonte ? [ind.normas.fonte] : []} />
      </Secao>
    </div>
  );
}
