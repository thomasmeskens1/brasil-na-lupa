import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { BuscaNormasAtibaia } from "@/features/atibaia/componentes/BuscaNormasAtibaia";
import { getIndiceAtibaia } from "@/features/atibaia/dados";
import { TERMOS_ATIBAIA } from "@/features/atibaia/termos";
import { formatarDataSp as data } from "@/features/sao-paulo/rotulos";

export const metadata: Metadata = {
  title: "Leis e decretos de Atibaia",
  description: "Leis, leis complementares e decretos do município de Atibaia publicados na Imprensa Oficial, com a ementa e o link para a edição.",
};

export default function LeisEDecretosAtibaiaPage() {
  const ind = getIndiceAtibaia();
  const cob = ind.normas.coberturas.find((c) => c.primeira_edicao);
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/atibaia" className="lk">
            Atibaia
          </Link>
        </nav>
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
