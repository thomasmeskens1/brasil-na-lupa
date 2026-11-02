import { notFound } from "next/navigation";
import { imagemDecisaoOG, TAMANHO_OG, TIPO_OG } from "@/components/compartilhar/og";
import { resolverTitulo } from "@/components/decisao/rotulos";
import { dadoDaVotacao, formaDe, propPorExtenso, tituloOficialVotacao } from "@/features/congresso/lista";
import { votacaoOg } from "@/features/congresso/og-dados";
import { CASA_NOME, ehCasa } from "@/features/congresso/rotulos";

/** Gerada sob demanda (sem generateStaticParams): evita milhares de PNG no build. */
export const size = TAMANHO_OG;
export const contentType = TIPO_OG;
export const alt = "Resumo da votação: título, caminho, placar oficial ou forma de votação, fonte e data de coleta";

export default async function Image({ params }: { params: Promise<{ casa: string; id: string }> }) {
  const { casa, id } = await params;
  const l = ehCasa(casa) ? votacaoOg(casa, decodeURIComponent(id)) : null;
  if (!l) notFound();
  const t = resolverTitulo({ tituloOficial: tituloOficialVotacao(l), simples: l.simples, subtituloOficial: propPorExtenso(l.proposicao) });
  return imagemDecisaoOG({
    titulo: t.titulo,
    subtitulo: t.subtitulo,
    caminho: l.casa,
    forma: formaDe(l.tipo),
    data: l.data,
    dado: dadoDaVotacao(l),
    fonte: { orgao: CASA_NOME[l.casa], acessado_em: l.coletadoEm },
    endereco: `/congresso/votacoes/${l.casa}/${l.id}`,
  });
}
