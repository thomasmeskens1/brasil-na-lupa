import { connection } from "next/server";
import { json, naoEncontrado } from "@/features/conta/api";
import { cadastroAtivo } from "@/features/conta/config";
import { obterSql } from "@/features/conta/db";
import { ehIdProposta } from "@/features/conta/ids";
import { MINIMO_PESSOAS, ehSiglaUf, maisManifestadas, obterUfEleitoral, totaisPorEstado } from "@/features/conta/manifestacoes";
import { VERSAO_POLITICA } from "@/features/conta/regras";
import { usuarioAtual } from "@/features/conta/sessao";

/**
 * Só para quem tem sessão (Política de Privacidade, versão 5, item 9.2):
 *  - ?proposta=<id>  → totais por estado da proposta;
 *  - ?lista=1[&uf=SP] → propostas com mais manifestações (no Brasil ou num estado).
 * Devolve só totais agregados, com o mínimo de pessoas, e o estado declarado de quem pergunta.
 */
export async function GET(request: Request) {
  await connection();
  if (!cadastroAtivo()) return naoEncontrado();
  const usuario = await usuarioAtual();
  if (!usuario) return json({ erro: "sem-sessao" }, 401);
  const q = new URL(request.url).searchParams;
  const sql = obterSql();
  try {
    const minha = await obterUfEleitoral(sql, usuario.id);
    if (q.get("lista") === "1") {
      const uf = q.get("uf");
      if (uf !== null && !ehSiglaUf(uf)) return json({ erro: "pedido-invalido" }, 400);
      return json({ minimo: MINIMO_PESSOAS, minhaUf: minha?.uf ?? null, itens: await maisManifestadas(sql, VERSAO_POLITICA, uf) });
    }
    const proposta = q.get("proposta");
    if (!ehIdProposta(proposta)) return json({ erro: "pedido-invalido" }, 400);
    return json({ minimo: MINIMO_PESSOAS, minhaUf: minha?.uf ?? null, estados: await totaisPorEstado(sql, VERSAO_POLITICA, proposta) });
  } catch {
    // Banco ainda sem a migração 003: o recurso fica indisponível, sem derrubar a página.
    return json({ erro: "indisponivel" }, 503);
  }
}
