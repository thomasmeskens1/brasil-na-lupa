/**
 * Manifestações (curtir / não curtir) agregadas por estado e lista "Propostas com mais
 * manifestações" (Política de Privacidade, versão 5, item 9.2). Só para quem tem sessão (a rota
 * de API confere). Regras:
 *  - entram só as reações de quem aceitou a versão 5 e deu de novo o consentimento das reações
 *    depois dela (as dadas sob a versão 4 não entram em listas nem recortes);
 *  - o recorte por estado usa só quem declarou o estado onde vota, com consentimento próprio;
 *  - nada aparece com menos de MINIMO_PESSOAS pessoas (por proposta e por estado);
 *  - só totais: nunca quem reagiu.
 * A lista é ordenada por um critério único e público: o número de manifestações (curtir + não
 * curtir somados, sem peso para um lado); empate, pelo id da proposta.
 */
import { SIGLAS_UF } from "./ids";
import type { Sql } from "./sql";

/** Mínimo de pessoas para mostrar um total (por proposta na lista; por estado no recorte). */
export const MINIMO_PESSOAS = 10;
/** Tamanho da lista "Propostas com mais manifestações". */
export const TAMANHO_LISTA = 30;
/** Início da versão 5: só consentimentos de reações dados a partir daqui entram nas contagens. */
export const INICIO_V5 = "2026-11-06T00:00:00-03:00";

export interface TotalEstado {
  uf: string;
  curtidas: number;
  naoCurtidas: number;
}

export interface ItemLista {
  proposta: string;
  curtidas: number;
  naoCurtidas: number;
  total: number;
}

export function ehSiglaUf(v: unknown): v is string {
  return typeof v === "string" && /^[A-Z]{2}$/.test(v) && (SIGLAS_UF as readonly string[]).includes(v.toLowerCase());
}

/** Totais por estado de uma proposta (só estados com o mínimo de pessoas), em ordem alfabética da sigla. */
export async function totaisPorEstado(sql: Sql, versaoAtual: string, proposta: string): Promise<TotalEstado[]> {
  const l = await sql<{ uf: string; curtidas: number | string; nao_curtidas: number | string }>`
    SELECT c.uf_eleitoral AS uf,
           count(*) FILTER (WHERE r.valor = 1) AS curtidas,
           count(*) FILTER (WHERE r.valor = -1) AS nao_curtidas
    FROM reacoes r
    JOIN consentimentos c ON c.usuario_id = r.usuario_id
    WHERE r.proposta = ${proposta}
      AND c.versao_politica = ${versaoAtual}
      AND c.reacoes_aceito_em >= ${INICIO_V5}::timestamptz
      AND c.uf_eleitoral IS NOT NULL AND c.uf_eleitoral_aceito_em IS NOT NULL
    GROUP BY c.uf_eleitoral
    HAVING count(*) >= ${MINIMO_PESSOAS}
    ORDER BY c.uf_eleitoral`;
  return l.map((x) => ({ uf: x.uf, curtidas: Number(x.curtidas), naoCurtidas: Number(x.nao_curtidas) }));
}

/** Propostas com mais manifestações (critério único: curtir + não curtir), com o mínimo de pessoas. */
export async function maisManifestadas(sql: Sql, versaoAtual: string, uf: string | null = null): Promise<ItemLista[]> {
  const l = await sql<{ proposta: string; curtidas: number | string; nao_curtidas: number | string; total: number | string }>`
    SELECT r.proposta,
           count(*) FILTER (WHERE r.valor = 1) AS curtidas,
           count(*) FILTER (WHERE r.valor = -1) AS nao_curtidas,
           count(*) AS total
    FROM reacoes r
    JOIN consentimentos c ON c.usuario_id = r.usuario_id
    WHERE c.versao_politica = ${versaoAtual}
      AND c.reacoes_aceito_em >= ${INICIO_V5}::timestamptz
      AND (${uf}::text IS NULL OR (c.uf_eleitoral = ${uf}::text AND c.uf_eleitoral_aceito_em IS NOT NULL))
    GROUP BY r.proposta
    HAVING count(*) >= ${MINIMO_PESSOAS}
    ORDER BY count(*) DESC, r.proposta
    LIMIT ${TAMANHO_LISTA}`;
  return l.map((x) => ({ proposta: x.proposta, curtidas: Number(x.curtidas), naoCurtidas: Number(x.nao_curtidas), total: Number(x.total) }));
}

/** Estado onde a pessoa vota (declarado), ou null. */
export async function obterUfEleitoral(sql: Sql, usuarioId: string): Promise<{ uf: string; aceitoEm: Date } | null> {
  const [l] = await sql<{ uf_eleitoral: string | null; uf_eleitoral_aceito_em: Date | string | null }>`
    SELECT uf_eleitoral, uf_eleitoral_aceito_em FROM consentimentos WHERE usuario_id = ${usuarioId}`;
  return l?.uf_eleitoral && l.uf_eleitoral_aceito_em ? { uf: l.uf_eleitoral, aceitoEm: new Date(l.uf_eleitoral_aceito_em) } : null;
}

/** Grava (com o consentimento próprio) ou apaga (null) o estado. Exige o consentimento geral atual. */
export async function salvarUfEleitoral(sql: Sql, usuarioId: string, versaoAtual: string, uf: string | null): Promise<boolean> {
  if (uf !== null && !ehSiglaUf(uf)) return false;
  const l = uf
    ? await sql`
        UPDATE consentimentos SET uf_eleitoral = ${uf}, uf_eleitoral_aceito_em = now()
        WHERE usuario_id = ${usuarioId} AND versao_politica = ${versaoAtual} RETURNING usuario_id`
    : await sql`
        UPDATE consentimentos SET uf_eleitoral = NULL, uf_eleitoral_aceito_em = NULL
        WHERE usuario_id = ${usuarioId} RETURNING usuario_id`;
  return l.length === 1;
}
