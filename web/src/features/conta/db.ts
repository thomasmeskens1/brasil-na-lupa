import "server-only";
import { neon, neonConfig } from "@neondatabase/serverless";
import type { Sql } from "./sql";

let cliente: Sql | null = null;

/** Cliente do Neon por HTTP (sem conexão aberta entre requisições), criado sob demanda. */
export function obterSql(): Sql {
  if (!cliente) {
    const url = (process.env.DATABASE_URL ?? "").trim();
    if (!url) throw new Error("Cadastro desativado: DATABASE_URL não definida.");
    // Só em desenvolvimento (`next dev`): aponta o driver para o Postgres em memória de
    // web/db/dev/servidor-pglite.mjs. Em produção esta variável é ignorada.
    const local = process.env.NODE_ENV === "development" ? process.env.DEV_NEON_FETCH_ENDPOINT : undefined;
    if (local) neonConfig.fetchEndpoint = local;
    cliente = neon(url) as unknown as Sql;
  }
  return cliente;
}
