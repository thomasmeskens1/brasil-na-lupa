import { imagemDecisaoOG, TAMANHO_OG, TIPO_OG } from "@/components/compartilhar/og";
import { resolverTitulo, tituloSimplesDe } from "@/components/decisao/rotulos";
import { dadoDe, dataDe, fontePrincipalDe, formaDe, nomeOficialCurto } from "@/features/icms/cartao";
import { getDecisao, getDecisoes, getTitulos } from "@/features/icms/dados";

export const size = TAMANHO_OG;
export const contentType = TIPO_OG;
export const alt = "Resumo da decisão sobre o ICMS: o que mudou, quem decidiu e a fonte oficial";

export function generateStaticParams() {
  return getDecisoes().itens.map((d) => ({ id: d.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = getDecisao(id);
  if (!d) {
    return imagemDecisaoOG({ titulo: "Decisão não encontrada", caminho: "icms", rotuloCaminho: "ICMS", fonte: { orgao: null } });
  }
  const t = resolverTitulo({ tituloOficial: d.titulo, simples: tituloSimplesDe(getTitulos("icms"), d.id), subtituloOficial: nomeOficialCurto(d) });
  const f = fontePrincipalDe(d);
  return imagemDecisaoOG({
    titulo: t.titulo,
    subtitulo: t.subtitulo,
    caminho: d.caminho,
    forma: formaDe(d),
    data: dataDe(d),
    dado: dadoDe(d),
    fonte: { orgao: f?.orgao ?? null, titulo: f?.titulo ?? null, acessado_em: f?.acessado_em ?? null },
    endereco: `/impostos/icms/${d.id}`,
  });
}
