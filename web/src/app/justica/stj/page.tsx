import type { Metadata } from "next";
import { Secao } from "@/components/Secao";
import { tituloFonteLegivel } from "@/features/comum/texto";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { BuscaTemasStj } from "@/features/justica/componentes/BuscasTribunais";
import { CartaoDecisao } from "@/components/decisao";
import { ListaCartoes, type ItemCartao } from "@/features/executivo/componentes/ListaCartoes";
import { Migalhas } from "@/features/executivo/componentes/Migalhas";
import { cartaoTemaStj } from "@/features/justica/cartoes";
import { getIndiceStj, getTemaStj, temasPorColecaoStj } from "@/features/justica/dados";
import type { TemaStj } from "@/features/justica/tipos";
import { COLECOES, TERMOS_JUSTICA } from "@/features/justica/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = {
  title: "Superior Tribunal de Justiça (STJ)",
  description:
    "Temas repetitivos do Superior Tribunal de Justiça: a questão julgada, a tese firmada, o relator, o órgão julgador e o resultado de cada julgamento, com fonte oficial.",
};

export default function StjPage() {
  const ind = getIndiceStj();
  const colecoes = temasPorColecaoStj();
  const comJulgamento: ItemCartao[] = ind.itens
    .filter((t) => t.sessoes > 0 && !t.colecoes.length)
    .sort((a, b) => Number(b.numero) - Number(a.numero))
    .map((r) => getTemaStj(r.numero))
    .filter((t): t is TemaStj => !!t)
    .map((t) => ({
      id: t.numero,
      cartao: cartaoTemaStj(t),
      busca: `${t.numero} ${t.questao ?? ""} ${(t.relator ?? []).join(" ")}`,
      filtros: { situacao: t.situacao ?? null },
    }));
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
        <Migalhas itens={[{ href: "/justica", rotulo: "Justiça" }]} />
        <Figurinha nome="balanca" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">Superior Tribunal de Justiça (STJ)</h1>
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
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {temas.map((t) => (
              <CartaoDecisao key={t.numero} as="li" {...cartaoTemaStj(t)} />
            ))}
          </ul>
        </Secao>
      ))}

      <Secao id="buscar" titulo="Buscar temas" descricao="A busca roda no seu navegador sobre o índice oficial de temas: o que você digita não é enviado a nenhum servidor.">
        <BuscaTemasStj colecoes={rotColecoes} coletadoEm={ind.atualizado_em} />
      </Secao>

      {comJulgamento.length ? (
        <Secao
          id="com-julgamento"
          titulo="Outros temas com julgamento coletado"
          descricao="Temas em que a coleta encontrou o texto oficial de ao menos uma sessão de julgamento. Os votos individuais desses temas ainda não foram conferidos."
        >
          <ListaCartoes
            itens={comJulgamento}
            filtros={[{ chave: "situacao", rotulo: "Situação" }]}
            busca={{ rotulo: "Buscar na questão, na tese ou pelo número", dica: "Ex.: honorários, 1265" }}
            rotulo={{ singular: "tema", plural: "temas" }}
            porPagina={10}
            ordem="do número mais alto para o mais baixo"
          />
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
