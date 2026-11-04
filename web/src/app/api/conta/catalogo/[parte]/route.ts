import { naoEncontrado } from "@/features/conta/api";
import { montarParteCatalogo, partesCatalogo } from "@/features/conta/catalogo";
import { cadastroAtivo } from "@/features/conta/config";

/**
 * Catálogo público (gerado no build) com títulos, datas, situação oficial e votações da mesma
 * proposição, para a página Minha conta. Não depende de sessão: o cruzamento com os favoritos
 * e as reações da pessoa é feito no navegador.
 */
export function generateStaticParams() {
  return partesCatalogo().map((parte) => ({ parte }));
}

export async function GET(_: Request, { params }: RouteContext<"/api/conta/catalogo/[parte]">) {
  const { parte } = await params;
  if (!cadastroAtivo() || !partesCatalogo().includes(parte)) return naoEncontrado();
  const p = montarParteCatalogo(parte);
  if (!p) return naoEncontrado();
  return Response.json(p, {
    headers: { "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
