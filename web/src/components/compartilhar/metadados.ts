/**
 * Metadados de compartilhamento por página (og:title = título simples ou oficial;
 * og:description = linha oficial + fonte + data). O Next.js substitui o objeto openGraph do
 * layout inteiro, por isso os campos do site são repetidos aqui.
 *
 *   export async function generateMetadata({ params }): Promise<Metadata> {
 *     const t = resolverTitulo({ tituloOficial, simples, subtituloOficial });
 *     return metadadosCompartilhamento({
 *       titulo: t.titulo,
 *       descricao: [t.subtitulo, "Fonte: Câmara dos Deputados", `coletado em ${formatarData(f.acessado_em)}`],
 *       caminho: `/congresso/votacoes/camara/${id}`,
 *     });
 *   }
 *   // A imagem vem do opengraph-image.tsx da mesma rota (ver og.tsx).
 */
import type { Metadata } from "next";
import { MARCA } from "./texto";

export interface DadosMetadados {
  titulo: string;
  /** Texto ou partes (juntadas com " · "; vazias são ignoradas). */
  descricao?: string | (string | null | undefined)[] | null;
  /** Caminho canônico da página (ex.: "/impostos/icms/confaz-convenio-127-2026"). */
  caminho?: string;
}

export function metadadosCompartilhamento({ titulo, descricao, caminho }: DadosMetadados): Metadata {
  const desc = Array.isArray(descricao) ? descricao.filter(Boolean).join(" · ") : descricao || undefined;
  return {
    title: titulo,
    description: desc,
    ...(caminho ? { alternates: { canonical: caminho } } : {}),
    openGraph: {
      title: titulo,
      description: desc,
      siteName: MARCA,
      locale: "pt_BR",
      type: "article",
      ...(caminho ? { url: caminho } : {}),
    },
    twitter: { card: "summary_large_image", title: titulo, description: desc },
  };
}
