import type { Metadata } from "next";
import { Secao } from "@/components/Secao";
import { tituloFonteLegivel } from "@/features/comum/texto";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { Migalhas } from "@/features/executivo/componentes/Migalhas";
import { TiposExplicados } from "@/features/executivo/componentes/TiposExplicados";
import { ListaJustica } from "@/features/justica/componentes/ListaJustica";
import { getIndiceStj } from "@/features/justica/dados";
import { TIPOS_COMUNS, TIPOS_STJ, numerosStj } from "@/features/justica/painel";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = {
  title: "Superior Tribunal de Justiça (STJ)",
  description:
    "Temas repetitivos do Superior Tribunal de Justiça em números oficiais e numa lista com filtros: a questão, a tese firmada, o relator, o órgão julgador e o resultado, com fonte oficial.",
};

export default function StjPage() {
  const ind = getIndiceStj();
  const numeros = numerosStj(ind);

  return (
    <div className="space-y-10">
      <header className="entrada max-w-3xl">
        <Migalhas itens={[{ href: "/justica", rotulo: "Justiça" }]} />
        <Figurinha nome="balanca" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-1 text-2xl font-bold text-foreground md:text-3xl">Superior Tribunal de Justiça (STJ)</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          O STJ uniformiza a interpretação das leis federais. Nos temas repetitivos, julga uma questão que se repete em muitos
          processos e fixa uma tese que os demais tribunais devem seguir. Aqui estão os {ind.total.toLocaleString("pt-BR")} temas
          publicados nos dados abertos do tribunal, com a questão e a tese em texto oficial.
        </p>
        <p className="meta mt-3">Dados coletados em {formatarData(ind.atualizado_em)}.</p>
      </header>

      {!ind.total ? (
        <p className="lacuna text-sm">Os dados do STJ ainda não foram coletados.</p>
      ) : (
        <ListaJustica
          stj={{ ativo: true, coletadoEm: ind.atualizado_em }}
          stf={{ ativo: false, coletadoEm: null }}
          julgamentos={[]}
          numeros={numeros ? [numeros] : []}
          tituloLista="Temas do STJ"
        >
          <TiposExplicados id="tipos" titulo="O que é cada tipo de julgamento" itens={[...TIPOS_STJ, ...TIPOS_COMUNS]} />
        </ListaJustica>
      )}

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes.map(tituloFonteLegivel)} />
      </Secao>
    </div>
  );
}
