import { imagemDecisaoOG, TAMANHO_OG, TIPO_OG } from "@/components/compartilhar/og";
import { getIndiceExecutivo, getMpv, idsOuMarcador } from "@/features/executivo/dados";
import { cabecalhoMpv } from "@/features/executivo/detalhes";

export const size = TAMANHO_OG;
export const contentType = TIPO_OG;
export const alt = "Resumo da medida provisória: o que foi editado, a situação no Congresso e a fonte oficial";

export function generateStaticParams() {
  return idsOuMarcador(getIndiceExecutivo().mpvs.map((m) => m.id)).map((id) => ({ id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMpv(id);
  if (!m) {
    return imagemDecisaoOG({ titulo: "Medida provisória não encontrada", caminho: "presidencia", fonte: { orgao: "Presidência da República" } });
  }
  const c = cabecalhoMpv(m);
  return imagemDecisaoOG({
    titulo: c.titulo,
    subtitulo: c.subtitulo,
    caminho: "presidencia",
    forma: "ato-individual",
    data: c.data,
    dado: c.dado,
    fonte: { orgao: c.fontePrincipal?.orgao ?? "Presidência da República", acessado_em: m.atualizado_em },
    endereco: `/executivo/medidas-provisorias/${id}`,
  });
}
