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

export function chaveLimite(tipo: string, valor: string, segredo: string): string {
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

/**
 * Limites das ações da conta (por usuário e por IP), na mesma tabela e com as mesmas chaves
 * anônimas (HMAC). "codigo" conta as tentativas de digitar o código de login por IP.
 */
export const LIMITES_ACOES = {
  reacao: { usuario: { maximo: 60, janelaMinutos: 10 }, ip: { maximo: 120, janelaMinutos: 10 } },
  favorito: { usuario: { maximo: 60, janelaMinutos: 10 }, ip: { maximo: 120, janelaMinutos: 10 } },
  codigo: { ip: { maximo: 20, janelaMinutos: 15 } },
} as const;

export interface Cota {
  tipo: string;
  valor: string;
  maximo: number;
  janelaMinutos: number;
}

/**
 * Consome uma unidade de cada cota, se todas ainda tiverem espaço. Devolve false (sem registrar
 * nada) quando alguma já chegou ao máximo na janela.
 */
export async function consumirCotas(sql: Sql, cotas: Cota[], segredo: string): Promise<boolean> {
  const chaves = cotas.map((c) => chaveLimite(c.tipo, c.valor, segredo));
  const contagens = await Promise.all(cotas.map((c, i) => contar(sql, chaves[i], c.janelaMinutos)));
  if (contagens.some((n, i) => n >= cotas[i].maximo)) return false;
  for (const k of chaves) await sql`INSERT INTO limites_envio (chave) VALUES (${k})`;
  return true;
}

/** Cotas de uma ação feita por um usuário com sessão. */
export function cotasDaAcao(acao: "reacao" | "favorito", usuarioId: string, ip: string): Cota[] {
  const l = LIMITES_ACOES[acao];
  return [
    { tipo: `${acao}-usuario`, valor: usuarioId, ...l.usuario },
    { tipo: `${acao}-ip`, valor: ip, ...l.ip },
  ];
}

/** Consulta e, se permitido, registra o envio. Devolve false quando o limite foi atingido. */
export async function consumirLimite(sql: Sql, alvo: Alvo, segredo: string): Promise<boolean> {
  if (!(await dentroDoLimite(sql, alvo, segredo))) return false;
  const kEmail = chaveLimite("email", alvo.email, segredo);
  const kIp = chaveLimite("ip", alvo.ip, segredo);
  await sql`INSERT INTO limites_envio (chave) VALUES (${kEmail}), (${kIp})`;
  return true;
}
