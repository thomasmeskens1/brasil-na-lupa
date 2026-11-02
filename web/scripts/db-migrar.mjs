#!/usr/bin/env node
/**
 * npm run db:migrar — aplica as migrações de web/db/migracoes/ no banco indicado em DATABASE_URL.
 *
 * Lê DATABASE_URL do ambiente (ou de web/.env.local, via --env-file-if-exists no package.json).
 * Usa o driver do Neon por WebSocket (necessário para transações com vários comandos).
 * Nunca imprime a URL do banco.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";
import { aplicarMigracoes } from "./lib/migracoes.mjs";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pasta = path.join(webDir, "db", "migracoes");

const url = (process.env.DATABASE_URL ?? "").trim();
if (!url) {
  console.error("DATABASE_URL não definida. Veja docs/cadastro/configurar.md.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const cliente = await pool.connect();
try {
  const db = {
    exec: async (texto) => {
      await cliente.query(texto);
    },
    query: (texto, params) => cliente.query(texto, params),
  };
  const aplicadas = await aplicarMigracoes(db, pasta, (m) => console.log(m));
  console.log(aplicadas.length ? `${aplicadas.length} migração(ões) aplicada(s).` : "Banco já está atualizado.");
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  cliente.release();
  await pool.end();
}
