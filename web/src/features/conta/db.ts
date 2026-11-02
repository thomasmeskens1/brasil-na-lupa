import "server-only";
import { neon } from "@neondatabase/serverless";
import type { Sql } from "./sql";

let cliente: Sql | null = null;

/** Cliente do Neon por HTTP (sem conexão aberta entre requisições), criado sob demanda. */
export function obterSql(): Sql {
  if (!cliente) {
    const url = (process.env.DATABASE_URL ?? "").trim();
    if (!url) throw new Error("Cadastro desativado: DATABASE_URL não definida.");
    cliente = neon(url) as unknown as Sql;
  }
  return cliente;
}
