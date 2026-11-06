/**
 * Testes dos totais por estado e da lista "Propostas com mais manifestações" (Política de
 * Privacidade, versão 5), com Postgres em memória (PGlite). Rodar com: npm run test:conta
 */
import assert from "node:assert/strict";
import { register } from "node:module";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { aplicarMigracoes } from "../../scripts/lib/migracoes.mjs";

register("./resolver.mjs", import.meta.url);
const { criarAdaptador } = await import("../../src/features/conta/adaptador.ts");
const { aceitarConsentimentoReacoes, exportarDados, registrarConsentimento, revogarConsentimento } = await import(
  "../../src/features/conta/dados.ts"
);
const m = await import("../../src/features/conta/manifestacoes.ts");
const { reagir } = await import("../../src/features/conta/reacoes.ts");
const { VERSAO_POLITICA } = await import("../../src/features/conta/regras.ts");

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sqlDe = (pg) => async (strings, ...valores) => {
  let texto = strings[0];
  valores.forEach((_, i) => {
    texto += `$${i + 1}${strings[i + 1]}`;
  });
  return (await pg.query(texto, valores)).rows;
};

let pg;
let sql;
let adapter;
let n = 0;

async function pessoa(uf, valor, proposta = "camara-votacao:1-1") {
  const u = await adapter.createUser({ id: "x", email: `m${++n}@exemplo.com`, emailVerified: new Date() });
  await registrarConsentimento(sql, u.id, VERSAO_POLITICA);
  await aceitarConsentimentoReacoes(sql, u.id, VERSAO_POLITICA);
  if (uf) assert.equal(await m.salvarUfEleitoral(sql, u.id, VERSAO_POLITICA, uf), true);
  assert.equal(await reagir(sql, u.id, VERSAO_POLITICA, proposta, valor), "ok");
  return u;
}

before(async () => {
  pg = new PGlite();
  await aplicarMigracoes({ exec: (t) => pg.exec(t), query: (t, p) => pg.query(t, p) }, path.join(webDir, "db", "migracoes"));
  sql = sqlDe(pg);
  adapter = criarAdaptador(sql);
});

after(async () => {
  await pg?.close();
});

describe("manifestações (versão 5)", () => {
  test("estado só com sigla válida e com o consentimento geral atual", async () => {
    const u = await adapter.createUser({ id: "x", email: `m${++n}@exemplo.com`, emailVerified: new Date() });
    assert.equal(await m.salvarUfEleitoral(sql, u.id, VERSAO_POLITICA, "SP"), false, "sem consentimento geral");
    await registrarConsentimento(sql, u.id, VERSAO_POLITICA);
    assert.equal(await m.salvarUfEleitoral(sql, u.id, VERSAO_POLITICA, "XX"), false);
    assert.equal(await m.salvarUfEleitoral(sql, u.id, VERSAO_POLITICA, "SP"), true);
    assert.equal((await m.obterUfEleitoral(sql, u.id))?.uf, "SP");
    assert.equal((await exportarDados(sql, u.id)).consentimento.estadoOndeVota.uf, "SP", "entra na exportação");
    await revogarConsentimento(sql, u.id);
    assert.equal(await m.obterUfEleitoral(sql, u.id), null, "revogar o geral apaga o estado");
  });

  test("estado só aparece com o mínimo de pessoas; lista ordena pelo total, sem peso por lado", async () => {
    for (let i = 0; i < m.MINIMO_PESSOAS - 1; i++) await pessoa("RJ", 1);
    assert.deepEqual(await m.totaisPorEstado(sql, VERSAO_POLITICA, "camara-votacao:1-1"), [], "9 pessoas: não aparece");
    assert.deepEqual(await m.maisManifestadas(sql, VERSAO_POLITICA), [], "9 pessoas: fora da lista");
    await pessoa("RJ", -1);
    const t = await m.totaisPorEstado(sql, VERSAO_POLITICA, "camara-votacao:1-1");
    assert.deepEqual(t, [{ uf: "RJ", curtidas: 9, naoCurtidas: 1 }]);

    for (let i = 0; i < 12; i++) await pessoa(null, -1, "executivo:mpv-1-2026");
    const l = await m.maisManifestadas(sql, VERSAO_POLITICA);
    assert.deepEqual(l.map((x) => [x.proposta, x.total]), [["executivo:mpv-1-2026", 12], ["camara-votacao:1-1", 10]]);
    assert.deepEqual(await m.totaisPorEstado(sql, VERSAO_POLITICA, "executivo:mpv-1-2026"), [], "sem estado informado");
    const rj = await m.maisManifestadas(sql, VERSAO_POLITICA, "RJ");
    assert.deepEqual(rj.map((x) => x.proposta), ["camara-votacao:1-1"], "lista do estado só com quem informou o estado");
  });

  test("reações de quem não aceitou a versão atual não entram", async () => {
    const antes = (await m.maisManifestadas(sql, VERSAO_POLITICA)).find((x) => x.proposta === "camara-votacao:1-1").total;
    const u = await pessoa("RJ", 1);
    await sql`UPDATE consentimentos SET versao_politica = '4 (03/11/2026)' WHERE usuario_id = ${u.id}`;
    const depois = (await m.maisManifestadas(sql, VERSAO_POLITICA)).find((x) => x.proposta === "camara-votacao:1-1").total;
    assert.equal(depois, antes);
  });

  test("aceitar nova versão pede de novo o consentimento das reações", async () => {
    const u = await adapter.createUser({ id: "x", email: `m${++n}@exemplo.com`, emailVerified: new Date() });
    await registrarConsentimento(sql, u.id, "4 (03/11/2026)");
    await aceitarConsentimentoReacoes(sql, u.id, "4 (03/11/2026)");
    await registrarConsentimento(sql, u.id, VERSAO_POLITICA);
    const [c] = await sql`SELECT reacoes_aceito_em FROM consentimentos WHERE usuario_id = ${u.id}`;
    assert.equal(c.reacoes_aceito_em, null);
    await registrarConsentimento(sql, u.id, VERSAO_POLITICA);
    await aceitarConsentimentoReacoes(sql, u.id, VERSAO_POLITICA);
    await registrarConsentimento(sql, u.id, VERSAO_POLITICA);
    const [d] = await sql`SELECT reacoes_aceito_em FROM consentimentos WHERE usuario_id = ${u.id}`;
    assert.notEqual(d.reacoes_aceito_em, null, "mesma versão mantém o consentimento");
  });
});
