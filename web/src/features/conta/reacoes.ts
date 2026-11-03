/**
 * Reações "curti" / "não curti" em propostas (diretriz 4.1). Uma por usuário por proposta: pode
 * trocar ou retirar. Os contadores vêm da tabela agregada reacoes_contagem (mantida por gatilho)
 * e só são entregues a quem tem sessão válida (a rota de API confere). Nunca entram em listas,
 * notas, ordenações ou comparações de políticos.
 */
import { ehIdProposta } from "./ids";
import type { Sql } from "./sql";

export type ValorReacao = 1 | -1 | 0;

/** Máximo de propostas por consulta de contadores. */
export const MAX_PROPOSTAS_CONSULTA = 50;

export interface Contagem {
  curtidas: number;
  naoCurtidas: number;
  /** Reação de quem pergunta: 1 curti, -1 não curti, 0 nenhuma. */
  minha: ValorReacao;
}

export function validarReacao(proposta: unknown, valor: unknown): { proposta: string; valor: ValorReacao } | null {
  if (!ehIdProposta(proposta)) return null;
  if (valor !== 1 && valor !== -1 && valor !== 0) return null;
  return { proposta, valor };
}

/** Lista de ids separados por vírgula (?ids=a,b); ignora repetidos; null se algum for inválido. */
export function lerListaPropostas(texto: string | null): string[] | null {
  if (!texto) return null;
  const ids = [...new Set(texto.split(",").map((s) => s.trim()).filter(Boolean))];
  if (!ids.length || ids.length > MAX_PROPOSTAS_CONSULTA || !ids.every(ehIdProposta)) return null;
  return ids;
}

export async function contagens(sql: Sql, usuarioId: string, propostas: string[]): Promise<Record<string, Contagem>> {
  const linhas = await sql<{ proposta: string; curtidas: number | string; nao_curtidas: number | string; valor: number | null }>`
    SELECT p.proposta,
           COALESCE(c.curtidas, 0) AS curtidas,
           COALESCE(c.nao_curtidas, 0) AS nao_curtidas,
           r.valor
    FROM unnest(${propostas}::text[]) AS p (proposta)
    LEFT JOIN reacoes_contagem c ON c.proposta = p.proposta
    LEFT JOIN reacoes r ON r.proposta = p.proposta AND r.usuario_id = ${usuarioId}`;
  const saida: Record<string, Contagem> = {};
  for (const l of linhas) {
    const v = Number(l.valor ?? 0);
    saida[l.proposta] = {
      curtidas: Number(l.curtidas),
      naoCurtidas: Number(l.nao_curtidas),
      minha: v === 1 ? 1 : v === -1 ? -1 : 0,
    };
  }
  return saida;
}

export type ResultadoReacao = "ok" | "sem-consentimento" | "sem-consentimento-reacoes";

/**
 * Situação do consentimento: o geral (versão atual da política) e o específico das reações.
 */
export async function consentimentoReacoes(
  sql: Sql,
  usuarioId: string,
  versaoAtual: string,
): Promise<{ geral: boolean; reacoes: boolean }> {
  const [l] = await sql<{ versao_politica: string; reacoes_aceito_em: Date | string | null }>`
    SELECT versao_politica, reacoes_aceito_em FROM consentimentos WHERE usuario_id = ${usuarioId}`;
  const geral = l?.versao_politica === versaoAtual;
  return { geral, reacoes: geral && !!l?.reacoes_aceito_em };
}

/**
 * Grava, troca (1 ↔ -1) ou retira (0) a reação. Reagir exige o consentimento geral na versão
 * atual e o consentimento específico das reações; retirar, nunca.
 */
export async function reagir(
  sql: Sql,
  usuarioId: string,
  versaoAtual: string,
  proposta: string,
  valor: ValorReacao,
): Promise<ResultadoReacao> {
  if (valor === 0) {
    await sql`DELETE FROM reacoes WHERE usuario_id = ${usuarioId} AND proposta = ${proposta}`;
    return "ok";
  }
  const c = await consentimentoReacoes(sql, usuarioId, versaoAtual);
  if (!c.geral) return "sem-consentimento";
  if (!c.reacoes) return "sem-consentimento-reacoes";
  await sql`
    INSERT INTO reacoes (usuario_id, proposta, valor)
    SELECT ${usuarioId}::uuid, ${proposta}::text, ${valor}::smallint
    WHERE EXISTS (SELECT 1 FROM consentimentos c
                  WHERE c.usuario_id = ${usuarioId} AND c.versao_politica = ${versaoAtual}
                    AND c.reacoes_aceito_em IS NOT NULL)
    ON CONFLICT (usuario_id, proposta) DO UPDATE SET valor = EXCLUDED.valor
      WHERE reacoes.valor <> EXCLUDED.valor`;
  return "ok";
}
