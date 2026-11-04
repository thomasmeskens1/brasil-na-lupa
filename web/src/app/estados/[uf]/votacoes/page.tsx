import type { Metadata } from "next";
import { Figurinha } from "@/components/marca/Figurinhas";
import { Secao } from "@/components/Secao";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { PaginaAssembleiaIndisponivel } from "@/features/estados/componentes/AssembleiaIndisponivel";
import { BuscaVotacoes } from "@/features/estados/componentes/BuscaVotacoes";
import { contextoCasa } from "@/features/estados/contexto";
import { paramsUfsComDados, votacoesPlenario } from "@/features/estados/dados";
import { exigirUf, ufComDados } from "@/features/estados/pagina";
import { TERMOS_SP, formatarData, juntar, termosDoEstado } from "@/features/estados/rotulos";
import { baseUf } from "@/features/estados/ufs";

export function generateStaticParams() {
  return paramsUfsComDados();
}

export async function generateMetadata({ params }: PageProps<"/estados/[uf]/votacoes">): Promise<Metadata> {
  const { uf } = await params;
  const x = ufComDados(uf);
  if (!x) return { title: "Estado não encontrado" };
  return {
    title: `Votações da ${x.u.casa.nome}`,
    description: `Votações do Plenário e das comissões da ${x.u.casa.sigla}, com o placar oficial e o voto de cada deputado quando a votação é nominal.`,
    alternates: { canonical: `${baseUf(x.u.uf)}/votacoes` },
  };
}

export default async function VotacoesEstadoPage({ params }: PageProps<"/estados/[uf]/votacoes">) {
  const { uf } = await params;
  const { u, ind } = exigirUf(uf);
  if (ind.assembleia_indisponivel) return <PaginaAssembleiaIndisponivel u={u} aviso={ind.assembleia_indisponivel} titulo="Votações" />;
  const plen = votacoesPlenario(u.uf);
  const anos = [...new Set(ind.votacoes.map((v) => v.data?.slice(0, 4)).filter((a): a is string => !!a))].sort();
  const t = termosDoEstado(u);
  const sp = u.uf === "sp";
  const termos = [t.nominal, t.simbolica, t.comissao, t.votoRelator, ...(sp ? [TERMOS_SP.ccjr, TERMOS_SP.substitutivo, TERMOS_SP.semLegenda] : [])];
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
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Votações</h1>
        <p>
          {plen.length} votações do Plenário e {ind.votacoes.length - plen.length} deliberações de comissões da {u.casa.nome}
          {anos.length ? `, realizadas em ${juntar(anos)}` : ""}.
        </p>
        <p>
          {sp
            ? "No Plenário, só há voto individual quando houve verificação de votação; as votações simbólicas não têm voto de cada um e não aparecem aqui. Nas comissões, a ALESP registra o voto de cada membro como texto oficial, mostrado sem conversão para sim ou não."
            : "O voto de cada deputado só aparece quando a fonte oficial registra a votação como nominal. Nas votações simbólicas, só o resultado é mostrado."}
        </p>
        <p className="meta">Dados coletados em {formatarData(ind.atualizado_em)}. A busca roda no seu navegador: o que você digita não é enviado a nenhum servidor.</p>
      </header>

      <Secao id="lista" titulo="Buscar votações">
        <BuscaVotacoes ctx={contextoCasa(u, ind)} />
      </Secao>

      <TermosRecolhidos termos={termos} />

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes_votacoes} />
      </Secao>
    </div>
  );
}
