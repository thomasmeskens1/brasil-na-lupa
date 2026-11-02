import type { Metadata } from "next";
import { metadadosCompartilhamento } from "@/components/compartilhar";
import { Termo } from "@/components/glossario";
import { Secao } from "@/components/Secao";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { BuscaNormas } from "@/features/executivo/componentes/BuscaNormas";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { getIndiceExecutivo } from "@/features/executivo/dados";
import { TERMOS_EXECUTIVO } from "@/features/executivo/rotulos";

export const metadata: Metadata = metadadosCompartilhamento({
  titulo: "Leis e decretos federais",
  descricao: "Leis, leis complementares e decretos federais, com a ementa, a publicação no Diário Oficial da União e o link para o texto no Planalto.",
  caminho: "/executivo/leis-e-decretos",
});

export default function LeisEDecretosPage() {
  const ind = getIndiceExecutivo();
  const termos = [TERMOS_EXECUTIVO.lei, TERMOS_EXECUTIVO.decreto, TERMOS_EXECUTIVO.dou, TERMOS_EXECUTIVO.veto];
  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <Migalhas itens={[{ href: "/executivo", rotulo: "Executivo" }]} />
        <h1 className="mt-1 text-2xl font-bold text-foreground md:text-3xl">Leis e decretos</h1>
        <p className="mt-3 leading-relaxed">
          As leis são aprovadas pelo Congresso Nacional e sancionadas pelo Presidente da República; os{" "}
          <Termo termo="Decreto">decretos</Termo> são atos individuais do Presidente, sem votação. Cada item traz a ementa (resumo
          oficial), a publicação no <Termo termo="Diário Oficial da União">Diário Oficial da União</Termo> e o link para o texto
          oficial no Planalto.
        </p>
        <p className="meta mt-2">
          {ind.abrangencia_normas ? `Abrangência: ${ind.abrangencia_normas}. ` : ""}O endereço de cada ato no Diário Oficial da
          União não está na fonte estruturada; a publicação aparece com a data, a página e a coluna informadas.
        </p>
        <p className="meta mt-2">
          {ind.normas.total} normas · dados coletados em {formatarData(ind.atualizado_em)}.
        </p>
      </header>

      <Secao
        id="lista"
        titulo="Buscar leis e decretos"
        descricao="A lista é baixada pelo seu navegador e a busca roda nele: o que você digita não é enviado a nenhum servidor."
      >
        <BuscaNormas coletadoEm={ind.atualizado_em} />
      </Secao>

      <TermosRecolhidos termos={termos} />

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes_normas} />
      </Secao>
    </div>
  );
}
