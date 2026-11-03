import { connection } from "next/server";
import { json, naoEncontrado } from "@/features/conta/api";
import { cadastroAtivo } from "@/features/conta/config";
import { obterSql } from "@/features/conta/db";
import { listarFavoritos } from "@/features/conta/favoritos";
import { consentimentoReacoes } from "@/features/conta/reacoes";
import { VERSAO_POLITICA } from "@/features/conta/regras";
import { usuarioAtual } from "@/features/conta/sessao";

/**
 * Estado da conta para os botões das páginas estáticas (Favoritar, reações, "Seus favoritos"):
 * se há sessão, os consentimentos e os favoritos. Sem sessão: só { logado: false }.
 */
export async function GET() {
  await connection();
  if (!cadastroAtivo()) return naoEncontrado();
  const usuario = await usuarioAtual();
  if (!usuario) return json({ logado: false });
  const sql = obterSql();
  const [consentimento, favoritos] = await Promise.all([
    consentimentoReacoes(sql, usuario.id, VERSAO_POLITICA),
    listarFavoritos(sql, usuario.id),
  ]);
  return json({ logado: true, consentimento, favoritos });
}
