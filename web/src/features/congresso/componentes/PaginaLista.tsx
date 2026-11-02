import Link from "next/link";
import { getIndice } from "../dados";
import type { Casa } from "../tipos";
import { CASA_MEMBROS, CASA_NOME, formatarData, rotaParlamentar } from "../rotulos";
import { ListaFontes } from "./Basicos";
import { ListaParlamentares, type LinhaParlamentar } from "./ListaParlamentares";

/** Página de lista de deputados ou senadores (mesma apresentação para as duas casas). */
export function PaginaLista({ casa }: { casa: Casa }) {
  const ind = getIndice(casa);
  const m = CASA_MEMBROS[casa];
  const linhas: LinhaParlamentar[] = ind.parlamentares.map((p) => ({
    id: p.id,
    nome: p.nome,
    partido: p.partido ?? null,
    uf: p.uf ?? null,
    href: rotaParlamentar(casa, p.id),
    naListaAtual: p.na_lista_atual,
    nominais: ind.votos_por_parlamentar[p.id]?.length ?? 0,
  }));
  const nAtual = linhas.filter((l) => l.naListaAtual).length;
  const nominais = ind.votacoes.filter((v) => v.tipo === "nominal").length;

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/congresso" className="lk">
            Congresso
          </Link>
          {" › "}
          <span>{CASA_NOME[casa]}</span>
        </nav>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">{m.plural}</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          {nAtual} {casa === "camara" ? "deputados federais" : "senadores"} em exercício segundo a lista oficial{" "}
          {casa === "camara" ? "da Câmara dos Deputados" : "do Senado Federal"}, coletada em{" "}
          {formatarData(ind.lista_atualizada_em)}. Partido e estado são os da lista oficial. Na página de cada um estão os
          votos registrados nas {nominais} votações nominais coletadas.
        </p>
        <p className="mt-2 text-sm text-gray-800">
          Quem tem voto registrado no período e não consta da lista atual pode ser incluído na lista abaixo; para essas
          pessoas, partido e estado são os do registro de votação mais recente em que aparecem.
        </p>
      </header>

      <ListaParlamentares
        linhas={linhas}
        legenda={`${m.plural}, em ordem alfabética`}
        rotuloForaDaLista="Incluir quem tem voto registrado no período e não está na lista atual de em exercício"
      />

      <section aria-labelledby="fonte-lista">
        <h2 id="fonte-lista" className="text-lg font-bold text-gray-900">
          Fonte
        </h2>
        <div className="mt-2">
          <ListaFontes fontes={ind.lista_fonte ? [ind.lista_fonte] : []} />
        </div>
      </section>
    </div>
  );
}
