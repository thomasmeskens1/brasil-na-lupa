/**
 * Testes do login por código, dos favoritos, das reações e dos limites, sem serviços externos
 * (Postgres em memória, PGlite). Rodar com: npm run test:conta
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { aplicarMigracoes } from "../../scripts/lib/migracoes.mjs";

register("./resolver.mjs", import.meta.url);
const { criarAdaptador, MAX_TENTATIVAS_CODIGO } = await import("../../src/features/conta/adaptador.ts");
const { gerarCodigo, normalizarCodigo, origemValida } = await import("../../src/features/conta/codigo.ts");
const {
  aceitarConsentimentoReacoes,
  apagarFavoritos,
  apagarReacoes,
  contasParaAvisar,
  exportarDados,
  excluirConta,
  limparExpirados,
  obterEstado,
  registrarAcesso,
  registrarConsentimento,
  revogarConsentimento,
  revogarConsentimentoReacoes,
  trocarEmail,
} = await import(
  "../../src/features/conta/dados.ts"
);
const { listarFavoritos, marcarFavorito, validarFavorito, LIMITE_FAVORITOS } = await import(
  "../../src/features/conta/favoritos.ts"
);
const ids = await import("../../src/features/conta/ids.ts");
const { consumirCotas, cotasDaAcao, LIMITES_ACOES } = await import("../../src/features/conta/limite.ts");
const { contagens, lerListaPropostas, reagir, validarReacao } = await import("../../src/features/conta/reacoes.ts");
const { TEMAS, VERSAO_POLITICA } = await import("../../src/features/conta/regras.ts");

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function sqlDe(pg) {
  return async (strings, ...valores) => {
    let texto = strings[0];
    valores.forEach((_, i) => {
      texto += `$${i + 1}${strings[i + 1]}`;
    });
    return (await pg.query(texto, valores)).rows;
  };
}

let pg;
let sql;
let adapter;
let n = 0;

async function novoUsuario(consentir = true, reacoes = consentir) {
  const u = await adapter.createUser({ id: "x", email: `u${++n}@exemplo.com`, emailVerified: new Date() });
  if (consentir) await registrarConsentimento(sql, u.id, VERSAO_POLITICA);
  if (reacoes) await aceitarConsentimentoReacoes(sql, u.id, VERSAO_POLITICA);
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

describe("ids do site", () => {
  test("propostas aceitas e recusadas", () => {
    for (const ok of [
      "camara-votacao:2620905-56",
      "senado-votacao:7108",
      "sp-votacao:12345",
      "rn-votacao:abc-1",
      "executivo:mpv-1398-2026",
      "executivo:vet-55-2026",
      "icms:confaz-convenio-127-2024",
    ]) {
      assert.equal(ids.ehIdProposta(ok), true, ok);
    }
    for (const ruim of [
      "camara:2620905-56",
      "xx-votacao:1",
      "executivo:dec-1-2026",
      "icms:<script>",
      "senado-votacao:7108/../x",
      "camara-votacao:",
      "a".repeat(200),
      42,
      null,
    ]) {
      assert.equal(ids.ehIdProposta(ruim), false, String(ruim));
    }
  });
  test("políticos, montagem e endereços", () => {
    assert.equal(ids.ehIdPolitico("camara:204554"), true);
    assert.equal(ids.ehIdPolitico("sp-deputado:1234"), true);
    assert.equal(ids.ehIdPolitico("camara:abc"), false);
    assert.equal(ids.idVotacaoEstado("SP", "9"), "sp-votacao:9");
    assert.equal(ids.hrefDoId("sp-votacao:9"), "/estados/sp/votacoes/9");
    assert.equal(ids.hrefDoId("executivo:vet-55-2026"), "/executivo/vetos/vet-55-2026");
    assert.equal(ids.hrefDoId("senado:5012"), "/congresso/senado/parlamentares/5012");
  });
  test("caminho de volta só dentro do site", () => {
    assert.equal(ids.caminhoDeVolta("/congresso/votacoes/camara/1-2"), "/congresso/votacoes/camara/1-2");
    for (const ruim of ["//mal.example", "https://mal.example", "/\\mal", "javascript:alert(1)", "/a b", ""]) {
      assert.equal(ids.caminhoDeVolta(ruim), null, ruim);
    }
  });
  test("temas idênticos aos de dados/titulos/temas.json", () => {
    const arquivo = path.join(webDir, "..", "dados", "titulos", "temas.json");
    const oficiais = JSON.parse(fs.readFileSync(arquivo, "utf8")).temas;
    assert.deepEqual(TEMAS.map((t) => t.nome).sort(), [...oficiais].sort());
  });
});

describe("login por código", () => {
  test("código de 6 dígitos", () => {
    for (let i = 0; i < 50; i++) assert.match(gerarCodigo(), /^\d{6}$/);
    assert.equal(normalizarCodigo(" 123 456 "), "123456");
    assert.equal(normalizarCodigo("123-456"), "123456");
    for (const ruim of ["12345", "1234567", "abcdef", null]) assert.equal(normalizarCodigo(ruim), null);
  });

  test("uso único e só o código mais recente vale", async () => {
    const email = "codigo@exemplo.com";
    const expires = new Date(Date.now() + 600_000);
    await adapter.createVerificationToken({ identifier: email, token: "hash-a", expires });
    await adapter.createVerificationToken({ identifier: email, token: "hash-b", expires });
    assert.equal(await adapter.useVerificationToken({ identifier: email, token: "hash-a" }), null, "anterior cancelado");
    assert.equal((await adapter.useVerificationToken({ identifier: email, token: "hash-b" })).token, "hash-b");
    assert.equal(await adapter.useVerificationToken({ identifier: email, token: "hash-b" }), null, "uso único");
  });

  test(`limite de ${MAX_TENTATIVAS_CODIGO} tentativas erradas`, async () => {
    const email = "tentativas@exemplo.com";
    await adapter.createVerificationToken({ identifier: email, token: "certo", expires: new Date(Date.now() + 600_000) });
    for (let i = 0; i < MAX_TENTATIVAS_CODIGO - 1; i++) {
      assert.equal(await adapter.useVerificationToken({ identifier: email, token: `errado${i}` }), null);
    }
    // Ainda dentro do limite: o certo funcionaria. Mais uma errada e o código é apagado.
    assert.equal(await adapter.useVerificationToken({ identifier: email, token: "errado-final" }), null);
    assert.equal(await adapter.useVerificationToken({ identifier: email, token: "certo" }), null, "código cancelado");
    assert.equal((await sql`SELECT * FROM tokens_verificacao WHERE identificador = ${email}`).length, 0);
  });

  test("verificação de origem (CSRF)", () => {
    const h = (o) => ({ get: (k) => o[k] ?? null });
    const url = "https://brasilnalupa.com.br/api/conta/reacoes";
    const json = { "content-type": "application/json" };
    assert.equal(origemValida(h({ ...json, origin: "https://brasilnalupa.com.br", "sec-fetch-site": "same-origin" }), url), true);
    assert.equal(origemValida(h({ ...json, origin: "https://mal.example" }), url), false);
    assert.equal(origemValida(h({ ...json }), url), false, "sem Origin");
    assert.equal(origemValida(h({ ...json, origin: "https://brasilnalupa.com.br", "sec-fetch-site": "cross-site" }), url), false);
    assert.equal(origemValida(h({ origin: "https://brasilnalupa.com.br", "content-type": "text/plain" }), url), false);
    assert.equal(origemValida(h({ ...json, origin: "http://localhost:3000" }), "http://127.0.0.1:3000/x", "http://localhost:3000"), true);
  });
});

describe("favoritos", () => {
  test("validação", () => {
    assert.deepEqual(validarFavorito("uf", "SP"), { tipo: "uf", ref: "SP" });
    assert.equal(validarFavorito("uf", "sp"), null);
    assert.equal(validarFavorito("tema", "saude")?.ref, "saude");
    assert.equal(validarFavorito("tema", "partido"), null);
    assert.deepEqual(validarFavorito("politico", "camara:1"), { tipo: "politico", ref: "camara:1" });
    assert.equal(validarFavorito("proposta", "camara:1"), null);
    assert.equal(validarFavorito("outro", "x"), null);
  });

  test("exige consentimento; marcar, repetir e desmarcar", async () => {
    const sem = await novoUsuario(false);
    assert.equal(await marcarFavorito(sql, sem.id, VERSAO_POLITICA, "uf", "SP", true), "sem-consentimento");
    assert.deepEqual((await listarFavoritos(sql, sem.id)).uf, []);

    const u = await novoUsuario();
    assert.equal(await marcarFavorito(sql, u.id, "versao-antiga", "uf", "SP", true), "sem-consentimento");
    assert.equal(await marcarFavorito(sql, u.id, VERSAO_POLITICA, "uf", "SP", true), "ok");
    assert.equal(await marcarFavorito(sql, u.id, VERSAO_POLITICA, "uf", "SP", true), "ok", "repetir não duplica");
    await marcarFavorito(sql, u.id, VERSAO_POLITICA, "proposta", "senado-votacao:7108", true);
    await marcarFavorito(sql, u.id, VERSAO_POLITICA, "politico", "camara:204554", true);
    let f = await listarFavoritos(sql, u.id);
    assert.deepEqual(f, { uf: ["SP"], tema: [], politico: ["camara:204554"], proposta: ["senado-votacao:7108"] });
    // A Minha conta enxerga os mesmos favoritos.
    assert.deepEqual((await obterEstado(sql, u.id)).preferencias.itens, ["senado-votacao:7108"]);

    await marcarFavorito(sql, u.id, VERSAO_POLITICA, "uf", "SP", false);
    f = await listarFavoritos(sql, u.id);
    assert.deepEqual(f.uf, []);
  });

  test("limite por tipo", async () => {
    const u = await novoUsuario();
    for (const t of TEMAS.slice(0, LIMITE_FAVORITOS.tema)) {
      assert.equal(await marcarFavorito(sql, u.id, VERSAO_POLITICA, "tema", t.id, true), "ok");
    }
    await sql`INSERT INTO favoritos (usuario_id, tipo, ref)
              SELECT ${u.id}::uuid, 'politico', 'camara:' || g FROM generate_series(1, ${LIMITE_FAVORITOS.politico}::int) g`;
    assert.equal(await marcarFavorito(sql, u.id, VERSAO_POLITICA, "politico", "senado:1", true), "limite");
  });
});

describe("reações", () => {
  const P = "camara-votacao:2620905-56";

  test("validação da entrada", () => {
    assert.deepEqual(validarReacao(P, 1), { proposta: P, valor: 1 });
    assert.equal(validarReacao(P, 2), null);
    assert.equal(validarReacao(P, "1"), null);
    assert.equal(validarReacao("qualquer:coisa", 1), null);
    assert.deepEqual(lerListaPropostas(`${P}, ${P},senado-votacao:1`), [P, "senado-votacao:1"]);
    assert.equal(lerListaPropostas("camara-votacao:1,<x>"), null);
    assert.equal(lerListaPropostas(Array.from({ length: 51 }, (_, i) => `senado-votacao:${i}`).join(",")), null);
  });

  test("uma por usuário; trocar, retirar e contagem agregada", async () => {
    const a = await novoUsuario();
    const b = await novoUsuario();
    const sem = await novoUsuario(false);
    assert.equal(await reagir(sql, sem.id, VERSAO_POLITICA, P, 1), "sem-consentimento");
    const semEspecifico = await novoUsuario(true, false);
    assert.equal(await reagir(sql, semEspecifico.id, VERSAO_POLITICA, P, 1), "sem-consentimento-reacoes", "consentimento específico");
    assert.equal(await aceitarConsentimentoReacoes(sql, sem.id, VERSAO_POLITICA), false, "exige o consentimento geral antes");

    assert.equal(await reagir(sql, a.id, VERSAO_POLITICA, P, 1), "ok");
    assert.equal(await reagir(sql, a.id, VERSAO_POLITICA, P, 1), "ok", "repetir não conta de novo");
    assert.equal(await reagir(sql, b.id, VERSAO_POLITICA, P, -1), "ok");
    let c = (await contagens(sql, a.id, [P]))[P];
    assert.deepEqual(c, { curtidas: 1, naoCurtidas: 1, minha: 1 });

    await reagir(sql, a.id, VERSAO_POLITICA, P, -1);
    c = (await contagens(sql, b.id, [P]))[P];
    assert.deepEqual(c, { curtidas: 0, naoCurtidas: 2, minha: -1 });

    await reagir(sql, a.id, VERSAO_POLITICA, P, 0);
    c = (await contagens(sql, a.id, [P, "senado-votacao:1"]));
    assert.deepEqual(c[P], { curtidas: 0, naoCurtidas: 1, minha: 0 });
    assert.deepEqual(c["senado-votacao:1"], { curtidas: 0, naoCurtidas: 0, minha: 0 });

    const reais = await sql`SELECT count(*)::int AS n FROM reacoes WHERE proposta = ${P}`;
    assert.equal(reais[0].n, 1, "uma linha por usuário");
  });

  test("exportação, revogação e exclusão incluem favoritos e reações", async () => {
    const Q = "executivo:mpv-1398-2026";
    const u = await novoUsuario();
    await marcarFavorito(sql, u.id, VERSAO_POLITICA, "proposta", Q, true);
    await reagir(sql, u.id, VERSAO_POLITICA, Q, 1);
    const json = await exportarDados(sql, u.id);
    assert.deepEqual(json.favoritos.propostas, [Q]);
    assert.deepEqual(json.reacoes, [{ proposta: Q, reacao: "curti" }]);

    await revogarConsentimento(sql, u.id);
    assert.deepEqual((await listarFavoritos(sql, u.id)).proposta, [], "revogar apaga favoritos");
    assert.deepEqual((await contagens(sql, u.id, [Q]))[Q], { curtidas: 0, naoCurtidas: 0, minha: 0 }, "e reações");

    await registrarConsentimento(sql, u.id, VERSAO_POLITICA);
    assert.equal(await reagir(sql, u.id, VERSAO_POLITICA, Q, -1), "sem-consentimento-reacoes", "revogar apaga também o específico");
    await aceitarConsentimentoReacoes(sql, u.id, VERSAO_POLITICA);
    await reagir(sql, u.id, VERSAO_POLITICA, Q, -1);
    await marcarFavorito(sql, u.id, VERSAO_POLITICA, "uf", "RJ", true);
    await excluirConta(sql, u.id);
    assert.deepEqual((await contagens(sql, u.id, [Q]))[Q].naoCurtidas, 0, "exclusão desconta a reação");
    assert.equal((await sql`SELECT * FROM favoritos WHERE usuario_id = ${u.id}`).length, 0);
    assert.equal((await sql`SELECT * FROM reacoes WHERE usuario_id = ${u.id}`).length, 0);
  });
});

describe("limite de reações e favoritos", () => {
  test("por usuário e por IP", async () => {
    const segredo = "teste";
    const max = LIMITES_ACOES.reacao.usuario.maximo;
    let ok = 0;
    for (let i = 0; i < max + 3; i++) if (await consumirCotas(sql, cotasDaAcao("reacao", "usuario-1", `198.51.100.${i % 250}`), segredo)) ok++;
    assert.equal(ok, max, "limite por usuário");

    const maxIp = LIMITES_ACOES.favorito.ip.maximo;
    ok = 0;
    for (let i = 0; i < maxIp + 3; i++) if (await consumirCotas(sql, cotasDaAcao("favorito", `u-${i}`, "203.0.113.50"), segredo)) ok++;
    assert.equal(ok, maxIp, "limite por IP");

    const chaves = await sql`SELECT DISTINCT chave FROM limites_envio`;
    assert.ok(chaves.every((c) => !c.chave.includes("203.0.113.50") && !c.chave.includes("usuario-1")));
  });
});

describe("direitos do titular e retenção", () => {
  test("apagar só favoritos, só reações e revogar só o consentimento das reações", async () => {
    const R = "icms:confaz-convenio-127-2024";
    const u = await novoUsuario();
    await marcarFavorito(sql, u.id, VERSAO_POLITICA, "uf", "BA", true);
    await reagir(sql, u.id, VERSAO_POLITICA, R, 1);
    await apagarReacoes(sql, u.id);
    assert.equal((await contagens(sql, u.id, [R]))[R].curtidas, 0);
    assert.deepEqual((await listarFavoritos(sql, u.id)).uf, ["BA"], "favoritos ficam");
    await apagarFavoritos(sql, u.id);
    assert.deepEqual((await listarFavoritos(sql, u.id)).uf, []);

    await reagir(sql, u.id, VERSAO_POLITICA, R, -1);
    await revogarConsentimentoReacoes(sql, u.id);
    assert.equal((await contagens(sql, u.id, [R]))[R].naoCurtidas, 0, "reações apagadas");
    assert.equal(await reagir(sql, u.id, VERSAO_POLITICA, R, 1), "sem-consentimento-reacoes");
    assert.ok((await obterEstado(sql, u.id)).consentimento, "consentimento geral continua");
  });

  test("correção do e-mail", async () => {
    const a = await novoUsuario();
    const b = await novoUsuario();
    assert.equal(await trocarEmail(sql, a.id, b.email), false, "e-mail de outra conta");
    assert.equal(await trocarEmail(sql, a.id, "novo-endereco@exemplo.com"), true);
    assert.equal((await obterEstado(sql, a.id)).usuario.email, "novo-endereco@exemplo.com");
  });

  test("inatividade: aviso 30 dias antes e exclusão só depois do aviso", async () => {
    const u = await novoUsuario();
    await sql`UPDATE usuarios SET ultimo_acesso_em = now() - interval '25 months' WHERE id = ${u.id}`;
    await limparExpirados(sql);
    assert.ok(await adapter.getUser(u.id), "sem aviso, não exclui");
    assert.ok((await contasParaAvisar(sql)).includes(u.email));
    assert.ok(!(await contasParaAvisar(sql)).includes(u.email), "avisa uma vez só");
    await sql`UPDATE usuarios SET aviso_inatividade_em = now() - interval '31 days' WHERE id = ${u.id}`;
    await limparExpirados(sql);
    assert.equal(await adapter.getUser(u.id), null);

    const volta = await novoUsuario();
    await sql`UPDATE usuarios SET ultimo_acesso_em = now() - interval '24 months', aviso_inatividade_em = now() - interval '40 days' WHERE id = ${volta.id}`;
    await registrarAcesso(sql, volta.id);
    await limparExpirados(sql);
    assert.ok(await adapter.getUser(volta.id), "novo acesso cancela o aviso");
  });
});
