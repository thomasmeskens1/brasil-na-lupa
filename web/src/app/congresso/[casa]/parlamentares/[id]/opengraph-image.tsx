import { notFound } from "next/navigation";
import { imagemDecisaoOG, TAMANHO_OG, TIPO_OG } from "@/components/compartilhar/og";
import { parlamentarOg } from "@/features/congresso/og-dados";
import { CASA_MEMBROS, CASA_NOME, ehCasa } from "@/features/congresso/rotulos";

/**
 * Prévia do perfil (variante parlamentar): nome, cargo, partido/UF em texto, número de votações
 * nominais com registro, fonte e data. Sem foto, sem voto isolado, sem índice. Gerada sob demanda.
 */
export const size = TAMANHO_OG;
export const contentType = TIPO_OG;
export const alt = "Resumo do parlamentar: nome, cargo, partido, estado, votações nominais registradas e fonte oficial";

export default async function Image({ params }: { params: Promise<{ casa: string; id: string }> }) {
  const { casa, id } = await params;
  const p = ehCasa(casa) ? parlamentarOg(casa, decodeURIComponent(id)) : null;
  if (!ehCasa(casa) || !p) notFound();
  const cargo = CASA_MEMBROS[casa].singular;
  return imagemDecisaoOG({
    titulo: p.nome,
    subtitulo: `${cargo} · ${p.partido ?? "partido não informado"}-${p.uf ?? "UF não informada"}${p.naListaAtual ? "" : " (registro de votação mais recente)"}`,
    caminho: casa,
    rotuloCaminho: `${CASA_NOME[casa].toUpperCase()} · perfil do parlamentar`,
    dado: {
      tipo: "texto",
      texto: `${p.nominais.toLocaleString("pt-BR")} votações nominais com registro deste parlamentar nos dados coletados`,
    },
    fonte: { orgao: CASA_NOME[casa], acessado_em: p.coletadoEm },
    endereco: `/congresso/${casa}/parlamentares/${id}`,
  });
}
