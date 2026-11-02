import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { tituloFonteLegivel } from "@/features/comum/texto";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { BuscaTemasStj } from "@/features/justica/componentes/BuscasTribunais";
import { CartaoTema } from "@/features/justica/componentes/CartaoTema";
import { getIndiceStj, temasPorColecaoStj } from "@/features/justica/dados";
import { COLECOES, TERMOS_JUSTICA } from "@/features/justica/rotulos";

export const metadata: Metadata = {
  title: "Superior Tribunal de Justiça (STJ)",
  description:
    "Temas repetitivos do Superior Tribunal de Justiça: a questão julgada, a tese firmada, o relator, o órgão julgador e o resultado de cada julgamento, com fonte oficial.",
};

export default function StjPage() {
  const ind = getIndiceStj();
  const colecoes = temasPorColecaoStj();
  const comJulgamento = ind.itens.filter((t) => t.sessoes > 0 && !t.colecoes.length).sort((a, b) => Number(b.numero) - Number(a.numero));
  const rotColecoes = Object.fromEntries(Object.keys(ind.colecoes).map((k) => [k, COLECOES[k]?.titulo ?? k]));
  const termos = [
    TERMOS_JUSTICA.repetitivo,
    TERMOS_JUSTICA.relevancia,
    TERMOS_JUSTICA.tese,
    TERMOS_JUSTICA.afetacao,
    TERMOS_JUSTICA.relator,
    TERMOS_JUSTICA.secao,
  ];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/justica" className="lk">
            Justiça
          </Link>
        </nav>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Superior Tribunal de Justiça (STJ)</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          O STJ uniformiza a interpretação das leis federais. Nos temas repetitivos, julga uma questão que se repete em muitos
          processos e fixa uma tese que os demais tribunais devem seguir. Aqui estão os {ind.total} temas publicados nos dados
          abertos do tribunal, com a questão e a tese em texto oficial. Nos temas acompanhados de perto, há também cada
          julgamento, com o resultado literal e, quando conferidos, os votos dos ministros.
        </p>
        <p className="meta mt-3">Dados coletados em {formatarData(ind.atualizado_em)}.</p>
      </header>

      {!ind.total ? <p className="lacuna text-sm">Os dados do STJ ainda não foram coletados.</p> : null}

      {colecoes.map(({ colecao, temas }) => (
        <Secao
          key={colecao}
          id={`colecao-${colecao}`}
          titulo={`Destaque: ${COLECOES[colecao]?.titulo ?? colecao}`}
          descricao={COLECOES[colecao]?.explicacao}
        >
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {temas.map((t) => (
              <li key={t.numero}>
                <CartaoTema
                  href={`/justica/stj/temas/${t.numero}`}
                  tribunal="STJ"
                  rotulo={`${t.tipo_precedente ?? "Tema"} ${t.numero}`}
                  situacao={t.situacao}
                  orgao={t.orgao}
                  questao={t.questao}
                  tese={t.tese}
                />
              </li>
            ))}
          </ul>
        </Secao>
      ))}

      <Secao id="buscar" titulo="Buscar temas" descricao="A busca roda no seu navegador sobre o índice oficial de temas: o que você digita não é enviado a nenhum servidor.">
        <BuscaTemasStj colecoes={rotColecoes} />
      </Secao>

      {comJulgamento.length ? (
        <Secao
          id="com-julgamento"
          titulo="Outros temas com julgamento coletado"
          descricao="Temas em que a coleta encontrou o texto oficial de ao menos uma sessão de julgamento. Os votos individuais desses temas ainda não foram conferidos."
        >
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {comJulgamento.map((t) => (
              <li key={t.numero}>
                <Link href={`/justica/stj/temas/${t.numero}`} prefetch={false} className="lk">
                  Tema {t.numero}
                </Link>{" "}
                <span className="meta">· {t.situacao ?? "situação não informada"}</span>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes.map(tituloFonteLegivel)} />
      </Secao>
    </div>
  );
}
