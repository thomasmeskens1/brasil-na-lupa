import { naoEncontrado } from "@/features/conta/api";
import { cadastroAtivo } from "@/features/conta/config";
import { montarIndiceFavoritos } from "@/features/conta/indice";

/**
 * Índice público das decisões recentes (estático, gerado no build) para o bloco "Seus
 * favoritos". Não depende de sessão: o cruzamento com os favoritos é feito no navegador.
 */
export async function GET() {
  if (!cadastroAtivo()) return naoEncontrado();
  return Response.json(montarIndiceFavoritos(), {
    headers: { "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
