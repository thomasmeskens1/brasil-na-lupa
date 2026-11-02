import { connection, type NextRequest } from "next/server";
import { handlers } from "@/features/conta/auth";
import { cadastroAtivo } from "@/features/conta/config";

/** Rotas do Auth.js (login, callback, sessão, saída). Com o cadastro desligado, respondem 404. */

const naoEncontrado = () => new Response("Não encontrado", { status: 404 });

export async function GET(request: NextRequest) {
  await connection();
  if (!cadastroAtivo()) return naoEncontrado();
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  await connection();
  if (!cadastroAtivo()) return naoEncontrado();
  return handlers.POST(request);
}
