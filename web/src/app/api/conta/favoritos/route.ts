import { connection } from "next/server";
import { aceitarPost, json } from "@/features/conta/api";
import { obterSql } from "@/features/conta/db";
import { marcarFavorito, validarFavorito } from "@/features/conta/favoritos";
import { VERSAO_POLITICA } from "@/features/conta/regras";

/** Marca ou desmarca um favorito: { tipo, ref, favorito: true | false }. */
export async function POST(request: Request) {
  await connection();
  const r = await aceitarPost(request, "favorito");
  if (r instanceof Response) return r;
  const f = validarFavorito(r.corpo.tipo, r.corpo.ref);
  if (!f || typeof r.corpo.favorito !== "boolean") return json({ erro: "pedido-invalido" }, 400);
  const res = await marcarFavorito(obterSql(), r.usuario.id, VERSAO_POLITICA, f.tipo, f.ref, r.corpo.favorito);
  if (res === "sem-consentimento") return json({ erro: res }, 403);
  if (res === "limite") return json({ erro: "limite-favoritos" }, 409);
  return json({ favorito: r.corpo.favorito });
}
