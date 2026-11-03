import { connection } from "next/server";
import { aceitarPost, json, naoEncontrado } from "@/features/conta/api";
import { cadastroAtivo } from "@/features/conta/config";
import { obterSql } from "@/features/conta/db";
import { contagens, lerListaPropostas, reagir, validarReacao } from "@/features/conta/reacoes";
import { VERSAO_POLITICA } from "@/features/conta/regras";
import { usuarioAtual } from "@/features/conta/sessao";

/**
 * Contadores de reações (só para quem tem sessão; diretriz 4.1): ?ids=a,b (até 50 ids do site).
 * Devolve só totais agregados e a reação de quem pergunta, nunca quem reagiu.
 */
export async function GET(request: Request) {
  await connection();
  if (!cadastroAtivo()) return naoEncontrado();
  const usuario = await usuarioAtual();
  if (!usuario) return json({ erro: "sem-sessao" }, 401);
  const ids = lerListaPropostas(new URL(request.url).searchParams.get("ids"));
  if (!ids) return json({ erro: "pedido-invalido" }, 400);
  return json({ itens: await contagens(obterSql(), usuario.id, ids) });
}

/** Reage, troca ou retira: { proposta, valor: 1 | -1 | 0 }. */
export async function POST(request: Request) {
  await connection();
  const r = await aceitarPost(request, "reacao");
  if (r instanceof Response) return r;
  const v = validarReacao(r.corpo.proposta, r.corpo.valor);
  if (!v) return json({ erro: "pedido-invalido" }, 400);
  const sql = obterSql();
  const res = await reagir(sql, r.usuario.id, VERSAO_POLITICA, v.proposta, v.valor);
  if (res !== "ok") return json({ erro: res }, 403);
  return json({ itens: await contagens(sql, r.usuario.id, [v.proposta]) });
}
