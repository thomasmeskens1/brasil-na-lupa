import { connection, type NextRequest } from "next/server";
import { handlers } from "@/features/conta/auth";
import { cadastroAtivo } from "@/features/conta/config";
import { obterSql } from "@/features/conta/db";
import { consumirCotas, ipDaRequisicao, LIMITES_ACOES } from "@/features/conta/limite";

/** Rotas do Auth.js (login, callback, sessão, saída). Com o cadastro desligado, respondem 404. */

const naoEncontrado = () => new Response("Não encontrado", { status: 404 });

export async function GET(request: NextRequest) {
  await connection();
  if (!cadastroAtivo()) return naoEncontrado();
  // Conferência do código (ou do link): além das 5 tentativas por código (adaptador), um
  // limite por IP contra quem tenta códigos de vários e-mails.
  if (request.nextUrl.pathname.endsWith("/callback/resend")) {
    const ip = ipDaRequisicao(request.headers);
    const cota = { tipo: "codigo-ip", valor: ip, ...LIMITES_ACOES.codigo.ip };
    if (!(await consumirCotas(obterSql(), [cota], process.env.AUTH_SECRET ?? ""))) {
      return Response.redirect(new URL("/entrar/erro?error=Limite", request.url), 303);
    }
  }
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  await connection();
  if (!cadastroAtivo()) return naoEncontrado();
  return handlers.POST(request);
}
