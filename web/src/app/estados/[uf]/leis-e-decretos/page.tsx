import type { Metadata } from "next";
import { Figurinha } from "@/components/marca/Figurinhas";
import { Secao } from "@/components/Secao";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { BuscaNormas } from "@/features/estados/componentes/BuscaNormas";
import { contextoGoverno } from "@/features/estados/contexto";
import { paramsUfsComDados } from "@/features/estados/dados";
import { exigirUf, ufComDados } from "@/features/estados/pagina";
import { formatarData, termosDoEstado } from "@/features/estados/rotulos";
import { baseUf, nomeCompleto } from "@/features/estados/ufs";

export function generateStaticParams() {
  return paramsUfsComDados();
}

export async function generateMetadata({ params }: PageProps<"/estados/[uf]/leis-e-decretos">): Promise<Metadata> {
  const { uf } = await params;
  const x = ufComDados(uf);
  if (!x) return { title: "Estado não encontrado" };
  return {
    title: `Leis, decretos e vetos — ${nomeCompleto(x.u)}`,
    description: `Leis, decretos e vetos do governador publicados no Diário Oficial, com as razões dos vetos.`,
    alternates: { canonical: `${baseUf(x.u.uf)}/leis-e-decretos` },
  };
}

export default async function LeisEstadoPage({ params }: PageProps<"/estados/[uf]/leis-e-decretos">) {
  const { uf } = await params;
  const { u, ind } = exigirUf(uf);
  const ctx = contextoGoverno(u, ind);
  const t = termosDoEstado(u);
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
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Leis, decretos e vetos</h1>
        <p>
          {ind.normas.total.toLocaleString("pt-BR")} atos publicados no {ctx.diario}. As leis vêm de projetos aprovados pela
          {" "}
          {u.casa.sigla}; os decretos e os vetos são atos individuais do governador, sem votação. Nos vetos aparecem as razões
          publicadas, em texto integral, quando a fonte as traz.
        </p>
        {u.uf === "sp" ? (
          <p className="meta">
            A ementa é o trecho do texto publicado entre o título e a fórmula “O GOVERNADOR DO ESTADO…”; quando não foi possível
            identificá-la, aparece “Ementa não disponível em fonte oficial”.
          </p>
        ) : null}
        <p className="meta">Dados coletados em {formatarData(ind.normas.atualizado_em)}. A busca roda no seu navegador.</p>
      </header>

      <Secao id="lista" titulo="Buscar leis, decretos e vetos">
        <BuscaNormas ctx={ctx} />
      </Secao>

      <TermosRecolhidos termos={[t.veto, t.sancao, t.decreto, t.doe, t.retificacao, t.ementa]} />

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.normas.fontes} />
      </Secao>
    </div>
  );
}
