import { imagemDecisaoOG, TAMANHO_OG, TIPO_OG } from "@/components/compartilhar/og";
import { resolverTitulo } from "@/components/decisao/rotulos";
import { cartaoParecerPresidente, tituloPresidente } from "@/features/tribunais-contas/cartoes";
import { getContasPresidente, getOrgao, getOrgaos, ouMarcador, temContasPresidente, tituloSimplesTc } from "@/features/tribunais-contas/dados";
import { BASE_TC } from "@/features/tribunais-contas/rotulos";

export function generateStaticParams() {
  return ouMarcador(
    getOrgaos()
      .itens.filter((o) => o.situacao_coleta === "ativa" && temContasPresidente(o.id))
      .map((o) => ({ orgao: o.id })),
    { orgao: "sem-dados" },
  );
}

export const size = TAMANHO_OG;
export const contentType = TIPO_OG;
export const alt = "Contas do Presidente da República: parecer prévio do TCU, com a conclusão literal e a fonte oficial";

/** Prévia do link: o parecer mais recente já emitido, com a conclusão literal. */
export default async function Image({ params }: { params: Promise<{ orgao: string }> }) {
  const { orgao } = await params;
  const c = getOrgao(orgao) ? getContasPresidente(orgao) : null;
  const e = c?.exercicios.find((x) => x.acordao) ?? c?.exercicios[0];
  if (!e) return imagemDecisaoOG({ titulo: "Contas do Presidente da República", caminho: "tcu", fonte: { orgao: "Tribunal de Contas da União" } });
  const d = cartaoParecerPresidente(e, orgao, tituloPresidente(e));
  const t = resolverTitulo({
    tituloOficial: d.tituloOficial,
    simples: tituloSimplesTc(e.acordao?.id, `${orgao}-contas-presidente-${e.exercicio}`),
    subtituloOficial: d.subtitulo,
  });
  return imagemDecisaoOG({
    titulo: t.titulo,
    subtitulo: t.subtitulo,
    caminho: "tcu",
    forma: d.forma,
    data: d.data,
    dado: d.dado,
    fonte: { orgao: d.fonte?.orgao ?? "Tribunal de Contas da União", titulo: d.fonte?.titulo ?? null, acessado_em: d.fonte?.acessado_em ?? c?.atualizado_em ?? null },
    endereco: `${BASE_TC}/${orgao}/contas-do-presidente`,
  });
}
