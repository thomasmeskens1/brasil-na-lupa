import "server-only";
import { auth } from "./auth";
import { cadastroAtivo } from "./config";

export interface UsuarioAtual {
  id: string;
  email: string;
}

/** Lê a sessão da requisição (camada de acesso a dados). Sem sessão válida, devolve null. */
export async function usuarioAtual(): Promise<UsuarioAtual | null> {
  if (!cadastroAtivo()) return null;
  const sessao = await auth();
  const id = sessao?.user?.id;
  const email = sessao?.user?.email;
  return id && email ? { id, email } : null;
}
