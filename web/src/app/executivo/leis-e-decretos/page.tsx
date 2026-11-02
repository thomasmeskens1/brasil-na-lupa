import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { BuscaNormas } from "@/features/executivo/componentes/BuscaNormas";
import { getIndiceExecutivo } from "@/features/executivo/dados";
import { TERMOS_EXECUTIVO } from "@/features/executivo/rotulos";

export const metadata: Metadata = {
  title: "Leis e decretos",
  description: "Leis, leis complementares e decretos federais, com a ementa, a publicação no Diário Oficial da União e o link para o texto no Planalto.",
};

export default function LeisEDecretosPage() {
  const ind = getIndiceExecutivo();
  const termos = [TERMOS_EXECUTIVO.lei, TERMOS_EXECUTIVO.decreto, TERMOS_EXECUTIVO.dou, TERMOS_EXECUTIVO.veto];
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/executivo" className="lk">
            Executivo
          </Link>
        </nav>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Leis e decretos</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          As leis são aprovadas pelo Congresso Nacional e sancionadas pelo Presidente da República; os decretos são atos
          individuais do Presidente, sem votação. Cada item traz a ementa (resumo oficial), a publicação no Diário Oficial da
          União e o link para o texto oficial no Planalto.
        </p>
        <p className="mt-2 text-sm text-gray-800">
          {ind.abrangencia_normas ? `Abrangência: ${ind.abrangencia_normas}.` : null} O endereço da página de cada ato no
          Diário Oficial da União não está na fonte estruturada; a publicação aparece com a data, a página e a coluna
          informadas.
        </p>
        <p className="meta mt-3">
          {ind.normas.total} normas · dados coletados em {formatarData(ind.atualizado_em)}.
        </p>
      </header>

      <Secao id="lista" titulo="Buscar leis e decretos" descricao="A lista é baixada pelo seu navegador e a busca roda nele: o que você digita não é enviado a nenhum servidor.">
        <BuscaNormas />
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes_normas} />
      </Secao>
    </div>
  );
}
