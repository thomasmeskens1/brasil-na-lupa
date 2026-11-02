import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { CartaoDecisao } from "@/components/decisao";
import { cartaoTemaStj } from "@/features/justica/cartoes";
import { getIndiceStf, getIndiceStj, temasPorColecaoStj } from "@/features/justica/dados";
import { TERMOS_JUSTICA } from "@/features/justica/rotulos";

export const metadata: Metadata = {
  title: "Justiça: STJ e STF",
  description:
    "Julgamentos do Superior Tribunal de Justiça e do Supremo Tribunal Federal: tese firmada, relator, órgão julgador, resultado e votos conferidos, com fonte oficial.",
};

export default function JusticaPage() {
  const stj = getIndiceStj();
  const stf = getIndiceStf();
  const icms = temasPorColecaoStj().find((c) => c.colecao === "icms")?.temas ?? [];
  const termos = [TERMOS_JUSTICA.repetitivo, TERMOS_JUSTICA.repercussao, TERMOS_JUSTICA.tese, TERMOS_JUSTICA.relator, TERMOS_JUSTICA.vencido, TERMOS_JUSTICA.plenarioVirtual];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Justiça: STJ e STF</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          O Superior Tribunal de Justiça (STJ) uniformiza a interpretação das leis federais, e o Supremo Tribunal Federal
          (STF) é o guardião da Constituição. Quando os dois julgam uma questão repetida em muitos processos, fixam
          uma tese que os demais tribunais seguem. Aqui estão essas teses, quem relatou, qual órgão julgou, o resultado como
          escrito na decisão e, quando conferidos contra o texto oficial, os votos de cada ministro.
        </p>
        <p className="mt-2 text-gray-800">
          Votos de ministros só aparecem quando foram conferidos nome a nome contra o texto oficial da decisão ou quando o
          próprio tribunal os publica de forma estruturada. Nos demais casos, o site mostra apenas o resultado literal.
        </p>
      </header>

      <nav aria-label="Tribunais" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link href="/justica/stj" className="cartao block hover:bg-superficie">
          <span className="block text-base font-semibold text-[#234a73] underline underline-offset-2">Superior Tribunal de Justiça (STJ)</span>
          <span className="mt-1 block text-gray-800">
            {stj.total ? `${stj.total} temas repetitivos e de relevância; dados coletados em ${formatarData(stj.atualizado_em)}.` : "Dados ainda não coletados."}
          </span>
        </Link>
        <Link href="/justica/stf" className="cartao block hover:bg-superficie">
          <span className="block text-base font-semibold text-[#234a73] underline underline-offset-2">Supremo Tribunal Federal (STF)</span>
          <span className="mt-1 block text-gray-800">
            {stf.total ? `${stf.total} temas de repercussão geral; dados coletados em ${formatarData(stf.atualizado_em)}.` : "Em construção: dados em coleta."}
          </span>
          {!stf.total ? <span className="selo mt-2">Em construção</span> : null}
        </Link>
      </nav>

      {icms.length ? (
        <Secao id="icms" titulo="Em destaque: o que o STJ decidiu sobre o ICMS" descricao="Temas do STJ em que a questão ou a tese menciona o Imposto sobre Circulação de Mercadorias e Serviços (ICMS).">
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {icms.slice(0, 4).map((t) => (
              <CartaoDecisao key={t.numero} as="li" {...cartaoTemaStj(t)} />
            ))}
          </ul>
          <p className="mt-3">
            <Link href="/justica/stj#colecao-icms" className="lk inline-flex min-h-11 items-center">
              Ver todos os temas do ICMS no STJ
            </Link>
          </p>
        </Secao>
      ) : null}

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>
    </div>
  );
}
