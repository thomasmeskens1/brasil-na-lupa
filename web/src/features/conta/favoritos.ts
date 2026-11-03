/**
 * Favoritos (estados, temas, políticos e propostas) marcados pelo botão "Favoritar".
 * Só grava com consentimento na versão atual da política. Recebe o cliente SQL por parâmetro.
 */
import { ehIdPolitico, ehIdProposta, ehTipoFavorito, type TipoFavorito } from "./ids";
import { TEMAS, UFS } from "./regras";
import type { Sql } from "./sql";

/** Máximo de favoritos por tipo (evita abuso do banco). */
export const LIMITE_FAVORITOS: Record<TipoFavorito, number> = { uf: 27, tema: 12, politico: 200, proposta: 500 };

export type Favoritos = Record<TipoFavorito, string[]>;

export const FAVORITOS_VAZIOS: Favoritos = { uf: [], tema: [], politico: [], proposta: [] };

/** Confere tipo e formato; devolve o par normalizado ou null. */
export function validarFavorito(tipo: unknown, ref: unknown): { tipo: TipoFavorito; ref: string } | null {
  if (!ehTipoFavorito(tipo) || typeof ref !== "string") return null;
  if (tipo === "uf") return UFS.some((u) => u.sigla === ref) ? { tipo, ref } : null;
  if (tipo === "tema") return TEMAS.some((t) => t.id === ref) ? { tipo, ref } : null;
  if (tipo === "politico") return ehIdPolitico(ref) ? { tipo, ref } : null;
  return ehIdProposta(ref) ? { tipo, ref } : null;
}

export async function listarFavoritos(sql: Sql, usuarioId: string): Promise<Favoritos> {
  const linhas = await sql<{ tipo: TipoFavorito; ref: string }>`
    SELECT tipo, ref FROM favoritos WHERE usuario_id = ${usuarioId} ORDER BY tipo, ref`;
  const saida: Favoritos = { uf: [], tema: [], politico: [], proposta: [] };
  for (const l of linhas) if (ehTipoFavorito(l.tipo)) saida[l.tipo].push(l.ref);
  return saida;
}

export type ResultadoFavorito = "ok" | "sem-consentimento" | "limite";

/** Marca (favorito=true) ou desmarca. Desmarcar não exige consentimento (só apaga). */
export async function marcarFavorito(
  sql: Sql,
  usuarioId: string,
  versaoAtual: string,
  tipo: TipoFavorito,
  ref: string,
  favorito: boolean,
): Promise<ResultadoFavorito> {
  if (!favorito) {
    await sql`DELETE FROM favoritos WHERE usuario_id = ${usuarioId} AND tipo = ${tipo} AND ref = ${ref}`;
    return "ok";
  }
  const [l] = await sql<{ consentiu: boolean; existe: boolean; n: number | string }>`
    SELECT EXISTS (SELECT 1 FROM consentimentos c
                   WHERE c.usuario_id = ${usuarioId} AND c.versao_politica = ${versaoAtual}) AS consentiu,
           EXISTS (SELECT 1 FROM favoritos f
                   WHERE f.usuario_id = ${usuarioId} AND f.tipo = ${tipo} AND f.ref = ${ref}) AS existe,
           (SELECT count(*)::int FROM favoritos f WHERE f.usuario_id = ${usuarioId} AND f.tipo = ${tipo}) AS n`;
  if (!l?.consentiu) return "sem-consentimento";
  if (l.existe) return "ok";
  if (Number(l.n) >= LIMITE_FAVORITOS[tipo]) return "limite";
  await sql`
    INSERT INTO favoritos (usuario_id, tipo, ref) VALUES (${usuarioId}, ${tipo}, ${ref})
    ON CONFLICT DO NOTHING`;
  return "ok";
}
