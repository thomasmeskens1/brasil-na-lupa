/**
 * Aplica as migrações SQL versionadas de web/db/migracoes/ (NNN_nome.sql), em ordem, cada uma
 * dentro de uma transação. As já aplicadas ficam registradas em "migracoes_aplicadas" e não
 * rodam de novo.
 *
 * `db` é um objeto com:
 *   exec(texto)            -> executa um ou mais comandos SQL sem parâmetros
 *   query(texto, params)   -> executa um comando com parâmetros e devolve { rows }
 * O script db-migrar.mjs liga isso ao Neon; os testes ligam a um Postgres em memória.
 */
import fs from "node:fs";
import path from "node:path";

const NOME_VALIDO = /^\d{3}_[a-z0-9_-]+\.sql$/;

export function listarMigracoes(pasta) {
  return fs
    .readdirSync(pasta)
    .filter((f) => NOME_VALIDO.test(f))
    .sort();
}

export async function aplicarMigracoes(db, pasta, log = () => {}) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS migracoes_aplicadas (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())",
  );
  const { rows } = await db.query("SELECT nome FROM migracoes_aplicadas", []);
  const feitas = new Set(rows.map((r) => r.nome));
  const aplicadas = [];

  for (const arquivo of listarMigracoes(pasta)) {
    if (feitas.has(arquivo)) continue;
    const texto = fs.readFileSync(path.join(pasta, arquivo), "utf8");
    await db.exec("BEGIN");
    try {
      await db.exec(texto);
      await db.query("INSERT INTO migracoes_aplicadas (nome) VALUES ($1)", [arquivo]);
      await db.exec("COMMIT");
    } catch (erro) {
      await db.exec("ROLLBACK");
      throw new Error(`Falha na migração ${arquivo}: ${erro instanceof Error ? erro.message : erro}`);
    }
    aplicadas.push(arquivo);
    log(`aplicada: ${arquivo}`);
  }
  return aplicadas;
}
