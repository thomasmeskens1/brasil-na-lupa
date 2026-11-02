import { imagemDecisaoOG, TAMANHO_OG, TIPO_OG } from "@/components/compartilhar/og";
import { getIndiceExecutivo, getVeto, idsOuMarcador } from "@/features/executivo/dados";
import { cabecalhoVeto } from "@/features/executivo/detalhes";

export const size = TAMANHO_OG;
export const contentType = TIPO_OG;
export const alt = "Resumo do veto: trechos vetados e o que o Congresso Nacional decidiu, com a fonte oficial";

export function generateStaticParams() {
  return idsOuMarcador(getIndiceExecutivo().vetos.map((v) => v.id)).map((id) => ({ id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = getVeto(id);
  if (!v) {
    return imagemDecisaoOG({ titulo: "Veto não encontrado", caminho: "presidencia", fonte: { orgao: "Presidência da República" } });
  }
  const c = cabecalhoVeto(v);
  return imagemDecisaoOG({
    titulo: c.titulo,
    subtitulo: c.subtitulo,
    caminho: "presidencia",
    forma: "ato-individual",
    data: c.data,
    dado: c.dado,
    fonte: { orgao: c.fontePrincipal?.orgao ?? "Presidência da República", acessado_em: v.atualizado_em },
    endereco: `/executivo/vetos/${id}`,
  });
}
