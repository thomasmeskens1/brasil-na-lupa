import { imagemDecisaoOG, TAMANHO_OG, TIPO_OG } from "@/components/compartilhar/og";
import { getIndiceStj, getTemaStj, idsOuMarcador } from "@/features/justica/dados";
import { cabecalhoTemaStj } from "@/features/justica/detalhes";

export const size = TAMANHO_OG;
export const contentType = TIPO_OG;
export const alt = "Resumo do tema do STJ: tese firmada, órgão julgador e fonte oficial";

export function generateStaticParams() {
  return idsOuMarcador(getIndiceStj().com_pagina).map((n) => ({ n }));
}

export default async function Image({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const t = getIndiceStj().com_pagina.includes(n) ? getTemaStj(n) : null;
  if (!t) return imagemDecisaoOG({ titulo: "Tema não encontrado", caminho: "stj", fonte: { orgao: "Superior Tribunal de Justiça" } });
  const c = cabecalhoTemaStj(t);
  return imagemDecisaoOG({
    titulo: c.titulo,
    subtitulo: c.subtitulo,
    caminho: "stj",
    forma: "julgamento",
    data: c.data,
    dado: c.dado,
    fonte: { orgao: "Superior Tribunal de Justiça", acessado_em: c.fontePrincipal?.acessado_em ?? t.atualizado_em },
    endereco: `/justica/stj/temas/${n}`,
  });
}
