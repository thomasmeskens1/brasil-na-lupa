import { imagemDecisaoOG, TAMANHO_OG, TIPO_OG } from "@/components/compartilhar/og";
import { getIndiceStf, getJulgamentoStf, idsOuMarcador } from "@/features/justica/dados";
import { cabecalhoJulgamentoStf } from "@/features/justica/detalhes";

export const size = TAMANHO_OG;
export const contentType = TIPO_OG;
export const alt = "Resumo do julgamento do STF: resultado como escrito na certidão e fonte oficial";

export function generateStaticParams() {
  return idsOuMarcador(getIndiceStf().julgamentos.map((j) => j.id)).map((id) => ({ id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const j = getIndiceStf().julgamentos.some((x) => x.id === id) ? getJulgamentoStf(id) : null;
  if (!j) return imagemDecisaoOG({ titulo: "Julgamento não encontrado", caminho: "stf", fonte: { orgao: "Supremo Tribunal Federal" } });
  const c = cabecalhoJulgamentoStf(j, id);
  return imagemDecisaoOG({
    titulo: c.titulo,
    subtitulo: c.subtitulo,
    caminho: "stf",
    forma: "julgamento",
    data: c.data,
    dado: c.dado,
    fonte: { orgao: "Supremo Tribunal Federal", acessado_em: j.atualizado_em },
    endereco: `/justica/stf/julgamentos/${id}`,
  });
}
