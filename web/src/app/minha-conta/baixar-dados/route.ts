import { connection } from "next/server";
import { cadastroAtivo } from "@/features/conta/config";
import { exportarDados } from "@/features/conta/dados";
import { obterSql } from "@/features/conta/db";
import { usuarioAtual } from "@/features/conta/sessao";

/** "Baixar meus dados" (LGPD, art. 18, II e V): JSON com tudo o que o banco guarda sobre a pessoa. */
export async function GET(request: Request) {
  await connection();
  if (!cadastroAtivo()) return new Response("Não encontrado", { status: 404 });

  const usuario = await usuarioAtual();
  if (!usuario) return Response.redirect(new URL("/entrar", request.url), 303);

  const dados = await exportarDados(obterSql(), usuario.id);
  if (!dados) return new Response("Não encontrado", { status: 404 });

  const dia = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="brasil-na-lupa-meus-dados-${dia}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
