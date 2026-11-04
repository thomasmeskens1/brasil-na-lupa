/**
 * Fotos oficiais (sem dependência de servidor: serve também aos componentes de navegador).
 * Os arquivos ficam em public/fotos/<fonte>/<id>.webp (copiados de dados/fotos por
 * scripts/sync-data.mjs) e o crédito vem do manifesto do coletor (scripts/coleta/fotos).
 */
export type FonteFoto = "camara" | "senado" | "alesp";

export interface FotoInfo {
  src: string;
  /** Crédito exigido pela fonte, ex.: "Arquivo/Câmara dos Deputados". */
  credito: string;
  /** Página oficial que declara a permissão de uso. */
  urlPermissao: string;
  /** A fonte usa licença pública Creative Commons (ex.: CC BY 4.0 da ALESP). */
  cc: boolean;
}

/** Crédito e permissão de cada fonte, como gravados no manifesto (dados/fotos/manifest.json). */
export interface FonteFotoMeta {
  orgao: string;
  credito: string;
  licenca: string;
  url_permissao: string;
  url_licenca?: string;
}

export const caminhoFoto = (fonte: FonteFoto, id: string) => `/fotos/${fonte}/${encodeURIComponent(id)}.webp`;

export function montarFoto(fonte: FonteFoto, id: string, meta: FonteFotoMeta | null | undefined): FotoInfo | null {
  if (!meta) return null;
  return { src: caminhoFoto(fonte, id), credito: meta.credito, urlPermissao: meta.url_permissao, cc: Boolean(meta.url_licenca) };
}
