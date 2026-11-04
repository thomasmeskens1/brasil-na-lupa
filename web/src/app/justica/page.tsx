import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { tituloFonteLegivel } from "@/features/comum/texto";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { TiposExplicados } from "@/features/executivo/componentes/TiposExplicados";
import type { GrupoNumeros } from "@/features/executivo/componentes/ListaFiltros";
import { ListaJustica } from "@/features/justica/componentes/ListaJustica";
import { getIndiceStf, getIndiceStj } from "@/features/justica/dados";
import { TIPOS_COMUNS, TIPOS_STF, TIPOS_STJ, itensJulgamentosStf, numerosStf, numerosStj } from "@/features/justica/painel";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = {
  title: "Justiça: STJ e STF",
  description:
    "Temas e julgamentos do Superior Tribunal de Justiça e do Supremo Tribunal Federal em números oficiais e numa lista com filtros por relator, resultado e tema, com fonte oficial.",
};

export default function JusticaPage() {
  const stj = getIndiceStj();
  const stf = getIndiceStf();
  const numeros = [numerosStj(stj), numerosStf(stf)].filter((g): g is GrupoNumeros => !!g);
  const fontes = [...(stj.fonte ? [stj.fonte] : []), ...(stf.fonte ? [stf.fonte] : [])].map(tituloFonteLegivel);

  return (
    <div className="space-y-10">
      <header className="entrada max-w-3xl">
        <Figurinha nome="balanca" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Justiça: STJ e STF</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          O Superior Tribunal de Justiça (STJ) uniformiza a interpretação das leis federais, e o Supremo Tribunal Federal (STF)
          guarda a Constituição. Quando julgam uma questão repetida em muitos processos, fixam uma tese que os demais
          tribunais seguem. Os números abaixo são contagens dos dados oficiais; toque em um deles para ver os temas na lista.
        </p>
        <p className="mt-2 text-gray-800">
          Votos de ministros só aparecem na página de cada julgamento, quando conferidos nome a nome contra o texto oficial ou
          publicados pelo próprio tribunal. O site não avalia nem compara ministros.
        </p>
        <p className="meta mt-3">
          STJ: dados coletados em {formatarData(stj.atualizado_em)} · STF: dados coletados em {formatarData(stf.atualizado_em)}.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4">
          <Link href="/justica/stj" className="lk inline-flex min-h-11 items-center">
            Só o STJ
          </Link>
          <Link href="/justica/stf" className="lk inline-flex min-h-11 items-center">
            Só o STF (com as súmulas vinculantes)
          </Link>
        </p>
      </header>

      {!stj.total && !stf.total ? (
        <p className="lacuna text-sm">Os dados do STJ e do STF ainda não foram coletados.</p>
      ) : (
        <ListaJustica
          stj={{ ativo: !!stj.total, coletadoEm: stj.atualizado_em }}
          stf={{ ativo: !!stf.total, coletadoEm: stf.atualizado_em }}
          julgamentos={itensJulgamentosStf(stf)}
          numeros={numeros}
          tituloLista="Temas e julgamentos"
        >
          <TiposExplicados id="tipos" titulo="O que é cada tipo de julgamento" itens={[...TIPOS_STJ, ...TIPOS_STF, ...TIPOS_COMUNS]} />
        </ListaJustica>
      )}

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={fontes} />
      </Secao>
    </div>
  );
}
