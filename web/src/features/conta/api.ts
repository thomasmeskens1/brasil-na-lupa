import "server-only";
import { origemValida } from "./codigo";
import { cadastroAtivo } from "./config";
import { obterSql } from "./db";
import { consumirCotas, cotasDaAcao, ipDaRequisicao } from "./limite";
import { usuarioAtual, type UsuarioAtual } from "./sessao";

/**
 * Peças comuns das rotas /api/conta/*: respostas JSON sem cache, conferência de cadastro
 * ligado, sessão, origem (CSRF), tamanho do corpo e limite de taxa.
 */

const SEM_CACHE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export function json(corpo: unknown, status = 200): Response {
  return Response.json(corpo, { status, headers: SEM_CACHE });
}

export const naoEncontrado = () => json({ erro: "nao-encontrado" }, 404);

/** Corpo JSON de até 2 KB; qualquer outra coisa vira null. */
async function lerCorpo(request: Request): Promise<Record<string, unknown> | null> {
  const texto = await request.text();
  if (texto.length > 2048) return null;
  try {
    const v = JSON.parse(texto) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export type PedidoAceito = { usuario: UsuarioAtual; corpo: Record<string, unknown> };

/**
 * Para POST que altera dados: cadastro ligado, origem do próprio site, sessão válida, corpo
 * JSON e cota da ação (por usuário e por IP). Devolve a resposta de erro ou o pedido aceito.
 */
export async function aceitarPost(request: Request, acao: "reacao" | "favorito"): Promise<Response | PedidoAceito> {
  if (!cadastroAtivo()) return naoEncontrado();
  if (!origemValida(request.headers, request.url, process.env.AUTH_URL)) return json({ erro: "origem" }, 403);
  const usuario = await usuarioAtual();
  if (!usuario) return json({ erro: "sem-sessao" }, 401);
  const corpo = await lerCorpo(request);
  if (!corpo) return json({ erro: "pedido-invalido" }, 400);
  const ip = ipDaRequisicao(request.headers);
  if (!(await consumirCotas(obterSql(), cotasDaAcao(acao, usuario.id, ip), process.env.AUTH_SECRET ?? ""))) {
    return json({ erro: "limite" }, 429);
  }
  return { usuario, corpo };
}
