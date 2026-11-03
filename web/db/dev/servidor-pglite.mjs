#!/usr/bin/env node
/**
 * SÓ PARA DESENVOLVIMENTO LOCAL: Postgres em memória (PGlite) atrás do mesmo protocolo HTTP que o
 * driver do Neon usa. Permite ver o cadastro ligado no `next dev` sem conta no Neon e sem dados
 * reais. Nada aqui é usado em produção (db.ts só o considera fora de produção).
 *
 *   node db/dev/servidor-pglite.mjs 4801 --semente
 *
 * e, no ambiente do `next dev`:
 *   DATABASE_URL=postgresql://teste:teste@localhost/teste
 *   DEV_NEON_FETCH_ENDPOINT=http://127.0.0.1:4801/sql
 *   AUTH_SECRET=<qualquer valor local>  AUTH_RESEND_KEY=teste  EMAIL_FROM=teste@exemplo.com
 *
 * Com --semente cria uma conta de teste (teste@exemplo.com) com consentimentos, alguns favoritos,
 * reações de outras contas fictícias e a sessão "sessao-local-de-teste" (cookie authjs.session-token).
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { aplicarMigracoes } from "../../scripts/lib/migracoes.mjs";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const porta = Number(process.argv[2] ?? 4801);
const semente = process.argv.includes("--semente");

const pg = new PGlite();
await aplicarMigracoes({ exec: (t) => pg.exec(t), query: (t, p) => pg.query(t, p) }, path.join(webDir, "db", "migracoes"));

// O driver do Neon pede o resultado em texto e converte ele mesmo: devolve tudo como texto.
const TEXTO = (v) => v;
const OIDS = [16, 20, 21, 23, 25, 26, 114, 700, 701, 1000, 1005, 1007, 1009, 1016, 1043, 1082, 1114, 1115, 1182, 1184, 1185, 1700, 2950, 3802];
const parsers = Object.fromEntries(OIDS.map((o) => [o, TEXTO]));

async function executar({ query, params }) {
  const r = await pg.query(query, params ?? [], { rowMode: "array", parsers });
  return {
    command: query.trim().split(/\s+/)[0].toUpperCase(),
    rowCount: r.affectedRows ?? r.rows.length,
    fields: r.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    rows: r.rows.map((linha) => linha.map((v) => (v === null || v === undefined ? null : String(v)))),
  };
}

if (semente) {
  const P = "camara-votacao:2620905-56";
  await pg.exec(`
    INSERT INTO usuarios (id, email, email_verificado_em) VALUES
      ('00000000-0000-4000-8000-000000000001', 'teste@exemplo.com', now()),
      ('00000000-0000-4000-8000-000000000002', 'outra1@exemplo.com', now()),
      ('00000000-0000-4000-8000-000000000003', 'outra2@exemplo.com', now()),
      ('00000000-0000-4000-8000-000000000004', 'outra3@exemplo.com', now());
    INSERT INTO consentimentos (usuario_id, versao_politica, declarou_maioridade, reacoes_aceito_em)
      SELECT id, '4 (03/11/2026)', true, now() FROM usuarios;
    INSERT INTO preferencias (usuario_id) SELECT id FROM usuarios;
    UPDATE usuarios SET sem_consentimento_desde = NULL;
    INSERT INTO favoritos (usuario_id, tipo, ref) VALUES
      ('00000000-0000-4000-8000-000000000001', 'uf', 'SP'),
      ('00000000-0000-4000-8000-000000000001', 'tema', 'impostos-precos'),
      ('00000000-0000-4000-8000-000000000001', 'proposta', '${P}');
    INSERT INTO reacoes (usuario_id, proposta, valor) VALUES
      ('00000000-0000-4000-8000-000000000002', '${P}', 1),
      ('00000000-0000-4000-8000-000000000003', '${P}', 1),
      ('00000000-0000-4000-8000-000000000004', '${P}', -1);
    INSERT INTO sessoes (token, usuario_id, expira_em) VALUES
      ('sessao-local-de-teste', '00000000-0000-4000-8000-000000000001', now() + interval '1 day');
  `);
}

const servidor = http.createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", async () => {
    try {
      const pedido = JSON.parse(corpo);
      const saida = Array.isArray(pedido.queries)
        ? { results: await Promise.all(pedido.queries.map(executar)) }
        : await executar(pedido);
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(saida));
    } catch (erro) {
      res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ message: String(erro?.message ?? erro), code: erro?.code }));
    }
  });
});
servidor.listen(porta, "127.0.0.1", () => console.log(`PGlite (protocolo HTTP do Neon) em http://127.0.0.1:${porta}/sql`));
