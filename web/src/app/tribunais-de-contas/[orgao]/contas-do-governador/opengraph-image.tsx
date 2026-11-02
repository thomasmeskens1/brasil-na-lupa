import { imagemDecisaoOG, TAMANHO_OG, TIPO_OG } from "@/components/compartilhar/og";
import { resolverTitulo } from "@/components/decisao/rotulos";
import { cartaoParecerTce, tituloGovernador } from "@/features/tribunais-contas/cartoes";
import { getContasGovernador, getOrgao, getOrgaos, ouMarcador, temContasGovernador, tituloSimplesTc } from "@/features/tribunais-contas/dados";
import { BASE_TC, deUf } from "@/features/tribunais-contas/rotulos";

export function generateStaticParams() {
  return ouMarcador(
    getOrgaos()
      .itens.filter((o) => o.situacao_coleta === "ativa" && temContasGovernador(o.id))
      .map((o) => ({ orgao: o.id })),
    { orgao: "sem-dados" },
  );
}

export const size = TAMANHO_OG;
export const contentType = TIPO_OG;
export const alt = "Contas do Governador: parecer prévio do tribunal de contas, com a conclusão literal e a fonte oficial";

/** Prévia do link: o parecer mais recente já emitido, com a conclusão literal. */
export default async function Image({ params }: { params: Promise<{ orgao: string }> }) {
  const { orgao } = await params;
  const o = getOrgao(orgao);
  const p = o ? getContasGovernador(orgao).find((x) => x.parecer.conclusao) : null;
  if (!o || !p) return imagemDecisaoOG({ titulo: "Contas do Governador", caminho: orgao, fonte: { orgao: null } });
  const d = cartaoParecerTce(p, o, tituloGovernador(p, o), `do Governador${o.uf ? ` ${deUf(o.uf)}` : ""}`);
  const t = resolverTitulo({ tituloOficial: d.tituloOficial, simples: tituloSimplesTc(p.id), subtituloOficial: d.subtitulo });
  return imagemDecisaoOG({
    titulo: t.titulo,
    subtitulo: t.subtitulo,
    caminho: o.id,
    forma: d.forma,
    data: d.data,
    dado: d.dado,
    fonte: { orgao: d.fonte?.orgao ?? o.nome, titulo: d.fonte?.titulo ?? null, acessado_em: d.fonte?.acessado_em ?? p.coletado_em ?? null },
    endereco: `${BASE_TC}/${orgao}/contas-do-governador`,
  });
}
