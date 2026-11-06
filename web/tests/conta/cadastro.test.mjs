/**
 * Testes do cadastro, sem serviços externos: as migrações e todo o SQL rodam num Postgres em
 * memória (PGlite). Rodar com: npm run test:conta
 */
import assert from "node:assert/strict";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { aplicarMigracoes } from "../../scripts/lib/migracoes.mjs";

// Importações dinâmicas: o gancho precisa estar registrado antes (ver resolver.mjs).
register("./resolver.mjs", import.meta.url);
const { criarAdaptador } = await import("../../src/features/conta/adaptador.ts");
const { cadastroAtivo, googleAtivo } = await import("../../src/features/conta/config.ts");
const { excluirConta, exportarDados, limparExpirados, obterEstado, registrarConsentimento, revogarConsentimento, salvarPreferencias } =
  await import("../../src/features/conta/dados.ts");
const { chaveLimite, consumirLimite, ipDaRequisicao, LIMITES_ENVIO } = await import("../../src/features/conta/limite.ts");
const { normalizarEmail, validarPreferencias, VERSAO_POLITICA } = await import("../../src/features/conta/regras.ts");

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pastaMigracoes = path.join(webDir, "db", "migracoes");

/** Tag de template sobre o PGlite, com parâmetros $1, $2… (mesma forma do neon()). */
function sqlDe(pg) {
  return async (strings, ...valores) => {
    let texto = strings[0];
    valores.forEach((_, i) => {
      texto += `$${i + 1}${strings[i + 1]}`;
    });
    const r = await pg.query(texto, valores);
    return r.rows;
  };
}

function form(campos) {
  return {
    getAll: (n) => {
      const v = campos[n];
      return v === undefined ? [] : Array.isArray(v) ? v : [v];
    },
    get: (n) => {
      const v = campos[n];
      return v === undefined ? null : Array.isArray(v) ? v[0] : v;
    },
  };
}

let pg;
let sql;
let adapter;

before(async () => {
  pg = new PGlite();
  const db = { exec: (t) => pg.exec(t), query: (t, p) => pg.query(t, p) };
  const aplicadas = await aplicarMigracoes(db, pastaMigracoes);
  assert.deepEqual(aplicadas, ["001_cadastro.sql", "002_favoritos_reacoes.sql", "003_estado_eleitoral.sql"]);
  // Idempotente: rodar de novo não aplica nada.
  assert.deepEqual(await aplicarMigracoes(db, pastaMigracoes), []);
  sql = sqlDe(pg);
  adapter = criarAdaptador(sql);
});

after(async () => {
  await pg?.close();
});

describe("liga/desliga", () => {
  const completo = { DATABASE_URL: "x", AUTH_SECRET: "x", AUTH_RESEND_KEY: "x", EMAIL_FROM: "x" };
  test("desligado sem variáveis", () => {
    assert.equal(cadastroAtivo({}), false);
    assert.equal(cadastroAtivo({ ...completo, EMAIL_FROM: "  " }), false);
    assert.equal(googleAtivo({ AUTH_GOOGLE_ID: "a", AUTH_GOOGLE_SECRET: "b" }), false);
  });
  test("ligado com todas; Google opcional", () => {
    assert.equal(cadastroAtivo(completo), true);
    assert.equal(googleAtivo(completo), false);
    assert.equal(googleAtivo({ ...completo, AUTH_GOOGLE_ID: "a", AUTH_GOOGLE_SECRET: "b" }), true);
  });
});

describe("validação", () => {
  test("e-mail", () => {
    assert.equal(normalizarEmail("  Pessoa@Exemplo.com.br "), "pessoa@exemplo.com.br");
    for (const ruim of ["", "sem-arroba", "a@b", '"x"@y.com', "a b@c.com", "a@b@c.com", null, 42]) {
      assert.equal(normalizarEmail(ruim), null, String(ruim));
    }
  });
  test("preferências válidas", () => {
    const r = validarPreferencias(
      form({ ufs: ["SP", "AC", "SP"], temas: "impostos-precos", politicos: "camara:204554", alertasEmail: "sim" }),
    );
    assert.equal(r.ok, true);
    assert.deepEqual(r.valor, {
      ufs: ["AC", "SP"],
      municipios: [],
      temas: ["impostos-precos"],
      politicos: ["camara:204554"],
      itens: [],
      alertasEmail: true,
    });
  });
  test("alertas desligados por padrão", () => {
    const r = validarPreferencias(form({}));
    assert.equal(r.ok, true);
    assert.equal(r.valor.alertasEmail, false);
  });
  test("rejeita valores fora do catálogo ou malformados", () => {
    assert.equal(validarPreferencias(form({ ufs: "XX" })).ok, false);
    assert.equal(validarPreferencias(form({ temas: "partido-x" })).ok, false);
    assert.equal(validarPreferencias(form({ municipios: "35043" })).ok, false);
    assert.equal(validarPreferencias(form({ politicos: "<script>" })).ok, false);
    assert.equal(validarPreferencias(form({ alertasEmail: "talvez" })).ok, false);
    assert.equal(validarPreferencias(form({ itens: Array.from({ length: 501 }, (_, i) => `camara:${i}`) })).ok, false);
  });
});

describe("adapter do Auth.js", () => {
  test("usuário por e-mail, sessão e link mágico", async () => {
    const u = await adapter.createUser({ id: "ignorado", email: "Ana@Exemplo.com", emailVerified: new Date() });
    assert.match(u.id, /^[0-9a-f-]{36}$/);
    assert.equal(u.email, "ana@exemplo.com");
    assert.equal((await adapter.getUserByEmail("ANA@exemplo.com")).id, u.id);
    assert.equal(await adapter.getUser("nao-e-uuid"), null);

    const expires = new Date(Date.now() + 3600_000);
    await adapter.createSession({ sessionToken: "tok1", userId: u.id, expires });
    const s = await adapter.getSessionAndUser("tok1");
    assert.equal(s.user.id, u.id);
    assert.equal(s.session.expires.getTime(), expires.getTime());

    await adapter.createVerificationToken({ identifier: u.email, token: "hash1", expires });
    assert.equal((await adapter.useVerificationToken({ identifier: u.email, token: "hash1" })).token, "hash1");
    assert.equal(await adapter.useVerificationToken({ identifier: u.email, token: "hash1" }), null, "uso único");

    await adapter.deleteSession("tok1");
    assert.equal(await adapter.getSessionAndUser("tok1"), null);
  });

  test("Google: guarda só o vínculo, sem tokens", async () => {
    const u = await adapter.createUser({ id: "x", email: "bia@exemplo.com", emailVerified: null, name: "Bia" });
    await adapter.linkAccount({
      userId: u.id,
      type: "oidc",
      provider: "google",
      providerAccountId: "123",
      access_token: "segredo",
      refresh_token: "segredo",
      id_token: "segredo",
    });
    assert.equal((await adapter.getUserByAccount({ provider: "google", providerAccountId: "123" })).id, u.id);
    const linhas = await sql`SELECT * FROM contas_externas WHERE usuario_id = ${u.id}`;
    assert.deepEqual(Object.keys(linhas[0]).sort(), ["id_no_provedor", "provedor", "tipo", "usuario_id"]);
    const atualizado = await adapter.updateUser({ id: u.id, emailVerified: new Date() });
    assert.equal(atualizado.name, null, "o nome do Google não é guardado");
    assert.ok(!("nome" in (await sql`SELECT * FROM usuarios WHERE id = ${u.id}`)[0]));
    assert.ok(atualizado.emailVerified instanceof Date);
  });
});

describe("consentimento, preferências, exportação e exclusão", () => {
  test("fluxo completo", async () => {
    const u = await adapter.createUser({ id: "x", email: "caio@exemplo.com", emailVerified: new Date() });
    let e = await obterEstado(sql, u.id);
    assert.equal(e.consentimento, null);
    assert.equal(e.preferencias, null);

    const prefs = { ufs: ["SP"], municipios: [], temas: ["saude"], politicos: ["senado:5012"], itens: [], alertasEmail: false };
    assert.equal(await salvarPreferencias(sql, u.id, VERSAO_POLITICA, prefs), false, "sem consentimento não grava");

    await registrarConsentimento(sql, u.id, VERSAO_POLITICA);
    e = await obterEstado(sql, u.id);
    assert.equal(e.consentimento.versao, VERSAO_POLITICA);
    assert.equal(e.preferencias.alertasEmail, false, "alertas desligados por padrão");

    assert.equal(await salvarPreferencias(sql, u.id, "versao-antiga", prefs), false, "exige versão atual");
    assert.equal(await salvarPreferencias(sql, u.id, VERSAO_POLITICA, prefs), true);
    assert.deepEqual((await obterEstado(sql, u.id)).preferencias, prefs);

    const json = await exportarDados(sql, u.id);
    assert.equal(json.conta.email, "caio@exemplo.com");
    assert.deepEqual(json.preferencias, { municipios: [], alertasEmail: false });
    assert.deepEqual(json.favoritos, { estados: ["SP"], temas: ["saude"], politicos: ["senado:5012"], propostas: [] });
    assert.equal(json.consentimento.versaoDaPolitica, VERSAO_POLITICA);
    JSON.stringify(json);

    await revogarConsentimento(sql, u.id);
    e = await obterEstado(sql, u.id);
    assert.equal(e.consentimento, null);
    assert.equal(e.preferencias, null, "revogar apaga as preferências");

    await adapter.createSession({ sessionToken: "tok-caio", userId: u.id, expires: new Date(Date.now() + 1e6) });
    await adapter.createVerificationToken({ identifier: u.email, token: "h", expires: new Date(Date.now() + 1e6) });
    await excluirConta(sql, u.id);
    assert.equal(await obterEstado(sql, u.id), null);
    assert.equal(await adapter.getSessionAndUser("tok-caio"), null, "sessão apagada em cascata");
    assert.equal((await sql`SELECT * FROM tokens_verificacao WHERE identificador = ${u.email}`).length, 0);
  });

  test("limpeza: sem consentimento há mais de 7 dias e inatividade de 24 meses", async () => {
    const velho = await adapter.createUser({ id: "x", email: "velho@exemplo.com", emailVerified: null });
    const novo = await adapter.createUser({ id: "x", email: "novo@exemplo.com", emailVerified: null });
    const inativo = await adapter.createUser({ id: "x", email: "inativo@exemplo.com", emailVerified: null });
    await registrarConsentimento(sql, inativo.id, VERSAO_POLITICA);
    await sql`UPDATE usuarios SET sem_consentimento_desde = now() - interval '8 days' WHERE id = ${velho.id}`;
    await sql`UPDATE usuarios SET ultimo_acesso_em = now() - interval '25 months', aviso_inatividade_em = now() - interval '31 days' WHERE id = ${inativo.id}`;
    await limparExpirados(sql);
    assert.equal(await adapter.getUser(velho.id), null);
    assert.equal(await adapter.getUser(inativo.id), null);
    assert.ok(await adapter.getUser(novo.id));
  });
});

describe("limite de envio de link", () => {
  test("por e-mail e por IP, com chaves anônimas", async () => {
    const segredo = "teste";
    const alvo = { email: "dani@exemplo.com", ip: "203.0.113.9" };
    for (let i = 0; i < LIMITES_ENVIO.email.maximo; i++) {
      assert.equal(await consumirLimite(sql, alvo, segredo), true);
    }
    assert.equal(await consumirLimite(sql, alvo, segredo), false, "limite por e-mail");

    const ip = "198.51.100.7";
    let permitidos = 0;
    for (let i = 0; i < LIMITES_ENVIO.ip.maximo + 2; i++) {
      if (await consumirLimite(sql, { email: `p${i}@exemplo.com`, ip }, segredo)) permitidos++;
    }
    assert.equal(permitidos, LIMITES_ENVIO.ip.maximo, "limite por IP");

    const chaves = await sql`SELECT DISTINCT chave FROM limites_envio`;
    assert.ok(chaves.every((c) => !c.chave.includes("@") && !c.chave.includes("203.0.113.9")));
    assert.equal(chaveLimite("email", "a", segredo), chaveLimite("email", "a", segredo));
  });

  test("IP da requisição", () => {
    const h = (o) => ({ get: (n) => o[n] ?? null });
    assert.equal(ipDaRequisicao(h({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" })), "203.0.113.1");
    assert.equal(ipDaRequisicao(h({ "x-real-ip": "203.0.113.2" })), "203.0.113.2");
    assert.equal(ipDaRequisicao(h({})), "desconhecido");
  });
});
