import { imagemDecisaoOG, TAMANHO_OG, TIPO_OG } from "@/components/compartilhar/og";
import { getIndiceStf, getTemaStf, idsOuMarcador } from "@/features/justica/dados";
import { cabecalhoTemaStf } from "@/features/justica/detalhes";

export const size = TAMANHO_OG;
export const contentType = TIPO_OG;
export const alt = "Resumo do tema de repercussão geral do STF: tese firmada e fonte oficial";

export function generateStaticParams() {
  return idsOuMarcador(getIndiceStf().com_pagina).map((n) => ({ n }));
}

export default async function Image({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const t = getIndiceStf().com_pagina.includes(n) ? getTemaStf(n) : null;
  if (!t) return imagemDecisaoOG({ titulo: "Tema não encontrado", caminho: "stf", fonte: { orgao: "Supremo Tribunal Federal" } });
  const c = cabecalhoTemaStf(t);
  return imagemDecisaoOG({
    titulo: c.titulo,
    subtitulo: c.subtitulo,
    caminho: "stf",
    forma: "julgamento",
    data: c.data,
    dado: c.dado,
    fonte: { orgao: "Supremo Tribunal Federal", acessado_em: t.atualizado_em },
    endereco: `/justica/stf/temas/${n}`,
  });
}
