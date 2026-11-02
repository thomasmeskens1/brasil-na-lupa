/**
 * Limite simples de envio de links de login, por e-mail e por IP, guardado no banco.
 * As chaves são HMAC-SHA256 (com AUTH_SECRET) do e-mail e do IP: o valor em claro nunca é gravado.
 * Registros com mais de 24 horas são apagados pela limpeza automática (ver dados.ts).
 */
import { createHmac } from "node:crypto";
import type { Sql } from "./sql";

export const LIMITES_ENVIO = {
  email: { maximo: 3, janelaMinutos: 15 },
  ip: { maximo: 10, janelaMinutos: 15 },
} as const;

export function chaveLimite(tipo: "email" | "ip", valor: string, segredo: string): string {
  return `${tipo}:${createHmac("sha256", segredo).update(valor).digest("hex")}`;
}

/** Primeiro endereço de x-forwarded-for (definido pela Vercel), ou x-real-ip. */
export function ipDaRequisicao(cabecalhos: { get(nome: string): string | null }): string {
  const xff = cabecalhos.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0] : cabecalhos.get("x-real-ip")) ?? "";
  return ip.trim().slice(0, 64) || "desconhecido";
}

async function contar(sql: Sql, chave: string, janelaMinutos: number): Promise<number> {
  const [l] = await sql<{ n: number | string }>`
    SELECT count(*)::int AS n FROM limites_envio
    WHERE chave = ${chave} AND criado_em > now() - make_interval(mins => ${janelaMinutos}::int)`;
  return Number(l?.n ?? 0);
}

export interface Alvo {
  email: string;
  ip: string;
}

/** Só consulta (não registra). */
export async function dentroDoLimite(sql: Sql, alvo: Alvo, segredo: string): Promise<boolean> {
  const [nEmail, nIp] = await Promise.all([
    contar(sql, chaveLimite("email", alvo.email, segredo), LIMITES_ENVIO.email.janelaMinutos),
    contar(sql, chaveLimite("ip", alvo.ip, segredo), LIMITES_ENVIO.ip.janelaMinutos),
  ]);
  return nEmail < LIMITES_ENVIO.email.maximo && nIp < LIMITES_ENVIO.ip.maximo;
}

/** Consulta e, se permitido, registra o envio. Devolve false quando o limite foi atingido. */
export async function consumirLimite(sql: Sql, alvo: Alvo, segredo: string): Promise<boolean> {
  if (!(await dentroDoLimite(sql, alvo, segredo))) return false;
  const kEmail = chaveLimite("email", alvo.email, segredo);
  const kIp = chaveLimite("ip", alvo.ip, segredo);
  await sql`INSERT INTO limites_envio (chave) VALUES (${kEmail}), (${kIp})`;
  return true;
}
