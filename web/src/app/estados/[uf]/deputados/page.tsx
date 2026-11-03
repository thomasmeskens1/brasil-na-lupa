import type { Metadata } from "next";
import { Figurinha } from "@/components/marca/Figurinhas";
import { Secao } from "@/components/Secao";
import { TabelaFiltravel } from "@/components/tabela";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { Migalhas } from "@/features/executivo/componentes/Migalhas";
import { paramsUfsComDados, votacoesPlenario } from "@/features/estados/dados";
import { exigirUf, maiuscula, ufComDados } from "@/features/estados/pagina";
import { formatarData } from "@/features/estados/rotulos";
import { baseUf } from "@/features/estados/ufs";

export function generateStaticParams() {
  return paramsUfsComDados();
}

export async function generateMetadata({ params }: PageProps<"/estados/[uf]/deputados">): Promise<Metadata> {
  const { uf } = await params;
  const x = ufComDados(uf);
  if (!x) return { title: "Estado não encontrado" };
  return {
    title: `${maiuscula(x.u.membros)} ${x.u.de}`,
    description: `Deputados da ${x.u.casa.sigla} na lista oficial, com partido e os votos nas votações nominais.`,
    alternates: { canonical: `${baseUf(x.u.uf)}/deputados` },
  };
}

export default async function DeputadosEstadoPage({ params }: PageProps<"/estados/[uf]/deputados">) {
  const { uf } = await params;
  const { u, ind } = exigirUf(uf);
  const base = baseUf(u.uf);
  const plen = votacoesPlenario(u.uf).length;
  return (
    <div className="space-y-8">
      <Migalhas
        itens={[
          { href: "/estados", rotulo: "Estados" },
          { href: base, rotulo: u.nome },
        ]}
      />
      <header className="max-w-3xl">
        <Figurinha nome="pessoas" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{maiuscula(u.membros)}</h1>
        <p>
          {ind.deputados.length} deputados na lista oficial da {u.casa.nome}, coletada em {formatarData(ind.lista_atualizada_em)}. O
          partido é o da lista oficial. Na página de cada um estão os votos registrados nas {plen} votações de Plenário e nas{" "}
          {ind.votacoes.length - plen} deliberações de comissões coletadas.
        </p>
        <p className="meta">
          Um voto só é ligado a um deputado quando a fonte oficial identifica o deputado. Nomes sem essa identificação aparecem na
          votação como impressos, sem ligação com o perfil, e não entram nas contagens.
        </p>
      </header>

      <TabelaFiltravel
        legenda="Deputados em ordem alfabética"
        chave="id"
        linhas={ind.deputados.map((d) => ({ id: d.id, nome: d.nome, href: `${base}/deputados/${d.id}`, partido: d.partido ?? "Não informado", plen: d.n_plenario, com: d.n_comissao }))}
        colunas={[
          { chave: "nome", rotulo: "Nome", principal: true, link: "href" },
          { chave: "partido", rotulo: "Partido" },
          { chave: "plen", rotulo: "Votos em Plenário", numerica: true },
          { chave: "com", rotulo: "Votos em comissões", numerica: true },
        ]}
        busca={{ chaves: ["nome"], rotulo: "Buscar pelo nome" }}
        filtros={[{ chave: "partido", rotulo: "Partido" }]}
        itens={{ singular: "deputado", plural: "deputados" }}
        porPagina={100}
        vazio="Nenhum deputado com esses filtros."
      />

      <Secao id="fonte" titulo="Fonte">
        <ListaFontes fontes={ind.lista_fonte ? [ind.lista_fonte] : []} />
      </Secao>
    </div>
  );
}
