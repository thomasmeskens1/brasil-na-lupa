import type { Metadata } from "next";
import { Figurinha } from "@/components/marca/Figurinhas";
import { Secao } from "@/components/Secao";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { BuscaProjetos } from "@/features/estados/componentes/BuscaProjetos";
import { contextoCasa } from "@/features/estados/contexto";
import { paramsUfsComDados } from "@/features/estados/dados";
import { exigirUf, ufComDados } from "@/features/estados/pagina";
import { formatarData, nomeSigla, termosDoEstado } from "@/features/estados/rotulos";
import { baseUf } from "@/features/estados/ufs";

export function generateStaticParams() {
  return paramsUfsComDados();
}

export async function generateMetadata({ params }: PageProps<"/estados/[uf]/projetos">): Promise<Metadata> {
  const { uf } = await params;
  const x = ufComDados(uf);
  if (!x) return { title: "Estado não encontrado" };
  return {
    title: `Projetos na ${x.u.casa.nome}`,
    description: `Projetos e propostas apresentados na ${x.u.casa.sigla}, com ementa, autoria e última tramitação.`,
    alternates: { canonical: `${baseUf(x.u.uf)}/projetos` },
  };
}

export default async function ProjetosEstadoPage({ params }: PageProps<"/estados/[uf]/projetos">) {
  const { uf } = await params;
  const { u, ind } = exigirUf(uf);
  const ctx = contextoCasa(u, ind);
  const t = termosDoEstado(u);
  const contagem = Object.entries(ind.projetos.por_sigla)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `${n.toLocaleString("pt-BR")} ${nomeSigla(s, ctx.siglas)}`)
    .join("; ");
  return (
    <div className="space-y-10">
      <Migalhas
        itens={[
          { href: "/estados", rotulo: "Estados" },
          { href: baseUf(u.uf), rotulo: u.nome },
        ]}
      />
      <header className="max-w-3xl">
        <Figurinha nome="mapa" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Projetos</h1>
        <p>
          {ind.projetos.total.toLocaleString("pt-BR")} proposições apresentadas na {u.casa.nome}
          {contagem ? ` (${contagem})` : ""}, com a ementa, a autoria e a última tramitação registradas pela Assembleia.
        </p>
        <p className="meta">Dados coletados em {formatarData(ind.atualizado_em)}. A busca roda no seu navegador: o que você digita não é enviado a nenhum servidor.</p>
      </header>

      <Secao id="lista" titulo="Buscar projetos">
        <BuscaProjetos ctx={ctx} />
      </Secao>

      <TermosRecolhidos termos={[t.pl, t.plc, t.pec, t.pdl, t.pr, t.ementa]} />

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes_projetos} />
      </Secao>
    </div>
  );
}
