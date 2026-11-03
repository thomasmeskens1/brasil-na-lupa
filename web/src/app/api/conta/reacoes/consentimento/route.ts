import { connection } from "next/server";
import { aceitarPost, json } from "@/features/conta/api";
import { aceitarConsentimentoReacoes } from "@/features/conta/dados";
import { obterSql } from "@/features/conta/db";
import { VERSAO_POLITICA } from "@/features/conta/regras";

/**
 * Consentimento específico e destacado das reações (art. 11, I), dado na primeira reação:
 * { aceito: true }. Revogável em Minha conta.
 */
export async function POST(request: Request) {
  await connection();
  const r = await aceitarPost(request, "reacao");
  if (r instanceof Response) return r;
  if (r.corpo.aceito !== true) return json({ erro: "pedido-invalido" }, 400);
  const ok = await aceitarConsentimentoReacoes(obterSql(), r.usuario.id, VERSAO_POLITICA);
  return ok ? json({ ok: true }) : json({ erro: "sem-consentimento" }, 403);
}
