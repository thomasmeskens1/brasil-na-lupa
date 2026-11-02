import type { Metadata } from "next";
import Link from "next/link";
import { metadadosCompartilhamento } from "@/components/compartilhar/metadados";
import { SeloFonte } from "@/components/decisao/Selos";
import { Secao } from "@/components/Secao";
import { getIndice } from "@/features/congresso/dados";
import { Composicao } from "@/features/congresso/componentes/Composicao";
import { CASAS, CASA_NOME, formatarData } from "@/features/congresso/rotulos";

export const metadata: Metadata = metadadosCompartilhamento({
  titulo: "Composição da Câmara e do Senado por partido e por estado",
  descricao: "Quantos deputados federais e senadores em exercício cada partido e cada estado têm, segundo as listas oficiais das casas.",
  caminho: "/congresso/composicao",
});

const MEMBROS = {
  camara: { singular: "deputado", plural: "deputados" },
  senado: { singular: "senador", plural: "senadores" },
} as const;

export default function ComposicaoPage() {
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/congresso" className="lk inline-flex min-h-11 items-center">
            Congresso
          </Link>
        </nav>
        <h1 className="mt-1 text-2xl font-bold text-foreground md:text-3xl">Composição das casas hoje</h1>
        <p className="mt-3 leading-relaxed">
          Quantos parlamentares em exercício cada partido e cada estado têm, segundo a lista oficial de cada casa na data da
          coleta. As barras usam a mesma cor para todos e seguem o tamanho da bancada (empate: ordem alfabética). Os partidos
          aparecem com a sigla como publicada pela casa.
        </p>
      </header>

      {CASAS.map((casa) => {
        const ind = getIndice(casa);
        const itens = ind.parlamentares
          .filter((p) => p.na_lista_atual)
          .map((p) => [p.partido ?? "Partido não informado", p.uf ?? "UF não informada"] as [string, string]);
        return (
          <Secao
            key={casa}
            id={casa}
            titulo={CASA_NOME[casa]}
            descricao={`Lista oficial de ${casa === "camara" ? "deputados" : "senadores"} em exercício coletada em ${formatarData(ind.lista_atualizada_em)}.`}
          >
            {itens.length ? (
              <Composicao dados={{ titulo: CASA_NOME[casa], membros: MEMBROS[casa], itens }} />
            ) : (
              <p className="lacuna">Lista oficial não disponível nos dados coletados.</p>
            )}
            {ind.lista_fonte ? (
              <SeloFonte
                className="mt-4"
                fonte={{ url: ind.lista_fonte.url, titulo: ind.lista_fonte.titulo, orgao: CASA_NOME[casa], acessado_em: ind.lista_fonte.acessado_em }}
              />
            ) : null}
          </Secao>
        );
      })}
    </div>
  );
}
