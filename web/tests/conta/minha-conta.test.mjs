/**
 * Testes da página Minha conta (favoritos com atualizações, reações, estados e temas) e dos
 * botões de reação nos cartões (id a partir do endereço, lote de contadores, cadastro
 * desligado / visitante / com sessão). Postgres em memória (PGlite). Rodar com: npm run test:conta
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
const { listarReacoes, obterEstado, registrarConsentimento, salvarEstadosTemas, aceitarConsentimentoReacoes } = await import(
  "../../src/features/conta/dados.ts"
);
const { marcarFavorito, listarFavoritos } = await import("../../src/features/conta/favoritos.ts");
const { reagir } = await import("../../src/features/conta/reacoes.ts");
const ids = await import("../../src/features/conta/ids.ts");
const acomp = await import("../../src/features/conta/acompanhamento.ts");
const { VERSAO_POLITICA } = await import("../../src/features/conta/regras.ts");

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

async function novoUsuario() {
  const u = await adapter.createUser({ id: "x", email: `mc${++n}@exemplo.com`, emailVerified: new Date() });
  await registrarConsentimento(sql, u.id, VERSAO_POLITICA);
  await aceitarConsentimentoReacoes(sql, u.id, VERSAO_POLITICA);
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

describe("id da proposta a partir do endereço do cartão", () => {
  test("formatos de proposta", () => {
    assert.equal(ids.idPropostaDoHref("/congresso/votacoes/camara/2620905-56"), "camara-votacao:2620905-56");
    assert.equal(ids.idPropostaDoHref("/congresso/votacoes/senado/7108#votos"), "senado-votacao:7108");
    assert.equal(ids.idPropostaDoHref("/estados/sp/votacoes/65ba6948-50ce"), "sp-votacao:65ba6948-50ce");
    assert.equal(ids.idPropostaDoHref("/executivo/medidas-provisorias/mpv-1398-2026"), "executivo:mpv-1398-2026");
    assert.equal(ids.idPropostaDoHref("/executivo/vetos/vet-55-2026"), "executivo:vet-55-2026");
    assert.equal(ids.idPropostaDoHref("/impostos/icms/confaz-convenio-127-2024"), "icms:confaz-convenio-127-2024");
    assert.equal(ids.idPropostaDoHref(encodeURI("/congresso/votacoes/camara/1-2")), "camara-votacao:1-2");
  });
  test("o que não é proposta não ganha botões", () => {
    for (const h of ["/justica/stj/temas/1", "/congresso/camara/parlamentares/1", "/executivo/decretos/1", "/estados/xx/votacoes/1", "/impostos/icms/%E0", "/"]) {
      assert.equal(ids.idPropostaDoHref(h), null, h);
    }
  });
  test("parte do catálogo", () => {
    assert.equal(ids.parteDoId("camara-votacao:1"), "camara");
    assert.equal(ids.parteDoId("senado:5"), "senado");
    assert.equal(ids.parteDoId("rn-deputado:9"), "rn");
    assert.equal(ids.parteDoId("executivo:vet-1-2026"), "executivo");
    assert.equal(ids.parteDoId("icms:x"), "icms");
    assert.equal(ids.parteDoId("xx-votacao:1"), null);
    assert.deepEqual(acomp.partesNecessarias(["camara-votacao:1", "camara:2", "sp-votacao:3"]), ["camara", "sp"]);
  });
});

describe("atualizações das propostas favoritas", () => {
  const partes = {
    camara: {
      parte: "camara",
      itens: {
        "camara-votacao:1-1": ["PL 1/2026: texto", "2026-05-01", "Câmara dos Deputados", "camara:1", null],
        "camara-votacao:1-2": ["PL 1/2026: redação final", "2026-06-10", "Câmara dos Deputados", "camara:1", null],
        "camara-votacao:1-0": ["PL 1/2026: urgência", "2026-04-01", "Câmara dos Deputados", "camara:1", null],
        "camara-votacao:9-1": ["PDL 9/2026", "2026-03-01", "Câmara dos Deputados", null, null],
      },
      grupos: {
        "camara:1": [
          ["camara-votacao:1-2", "2026-06-10", "aprovada"],
          ["camara-votacao:1-1", "2026-05-01", "aprovada"],
          ["camara-votacao:1-0", "2026-04-01", "rejeitada"],
        ],
      },
      politicos: { "camara:7": "Deputado(a) federal Fulana (X-SP)" },
    },
    executivo: {
      parte: "executivo",
      itens: { "executivo:mpv-1-2026": ["MP 1/2026", "2026-07-01", "Presidência da República", null, "MATÉRIA COM A RELATORIA"] },
      grupos: {},
      politicos: {},
    },
  };

  test("outras votações da mesma proposição, da mais recente para a mais antiga", () => {
    const p = acomp.acompanharProposta(partes, "camara-votacao:1-1");
    assert.equal(p.titulo, "PL 1/2026: texto");
    assert.deepEqual(p.atualizacoes.map((a) => [a.id, a.posterior]), [
      ["camara-votacao:1-2", true],
      ["camara-votacao:1-0", false],
    ]);
    assert.equal(p.ultimaData, "2026-06-10");
    assert.equal(p.atualizacoes[0].href, "/congresso/votacoes/camara/1-2");
  });

  test("lista ordenada só pela data da movimentação mais recente", () => {
    const l = acomp.acompanharPropostas(partes, ["camara-votacao:9-1", "executivo:mpv-1-2026", "camara-votacao:1-0", "senado-votacao:404"]);
    assert.deepEqual(l.map((p) => p.id), ["executivo:mpv-1-2026", "camara-votacao:1-0", "camara-votacao:9-1", "senado-votacao:404"]);
    assert.equal(l[0].situacao, "MATÉRIA COM A RELATORIA");
    assert.equal(l[3].titulo, null, "fora do catálogo: sem título inventado");
    assert.equal(acomp.rotuloGenerico("senado-votacao:404"), "Votação no Senado Federal");
  });

  test("nomes de políticos e títulos das reações vêm do catálogo", () => {
    assert.equal(acomp.nomePolitico(partes, "camara:7"), "Deputado(a) federal Fulana (X-SP)");
    assert.equal(acomp.nomePolitico(partes, "camara:8"), null);
    assert.equal(acomp.tituloProposta(partes, "camara-votacao:9-1"), "PDL 9/2026");
  });
});

describe("Minha conta: banco", () => {
  test("estados e temas não apagam políticos nem propostas", async () => {
    const u = await novoUsuario();
    await marcarFavorito(sql, u.id, VERSAO_POLITICA, "politico", "camara:7", true);
    await marcarFavorito(sql, u.id, VERSAO_POLITICA, "proposta", "camara-votacao:1-1", true);
    await marcarFavorito(sql, u.id, VERSAO_POLITICA, "uf", "RJ", true);
    const ok = await salvarEstadosTemas(sql, u.id, VERSAO_POLITICA, { ufs: ["SP"], temas: ["impostos-precos"], municipios: [], alertasEmail: true });
    assert.equal(ok, true);
    const f = await listarFavoritos(sql, u.id);
    assert.deepEqual(f.uf, ["SP"]);
    assert.deepEqual(f.tema, ["impostos-precos"]);
    assert.deepEqual(f.politico, ["camara:7"]);
    assert.deepEqual(f.proposta, ["camara-votacao:1-1"]);
    assert.equal((await obterEstado(sql, u.id)).preferencias.alertasEmail, true);
    assert.equal(await salvarEstadosTemas(sql, u.id, "versao-antiga", { ufs: [], temas: [], municipios: [], alertasEmail: false }), false);
  });

  test("minhas reações: listar e apagar uma", async () => {
    const u = await novoUsuario();
    await reagir(sql, u.id, VERSAO_POLITICA, "camara-votacao:1-1", 1);
    await reagir(sql, u.id, VERSAO_POLITICA, "senado-votacao:7108", -1);
    assert.deepEqual(await listarReacoes(sql, u.id), [
      { proposta: "camara-votacao:1-1", valor: 1 },
      { proposta: "senado-votacao:7108", valor: -1 },
    ]);
    await reagir(sql, u.id, VERSAO_POLITICA, "camara-votacao:1-1", 0);
    assert.deepEqual(await listarReacoes(sql, u.id), [{ proposta: "senado-votacao:7108", valor: -1 }]);
  });
});

describe("botões de reação no navegador: desligado, visitante e com sessão", () => {
  const original = { document: globalThis.document, fetch: globalThis.fetch, window: globalThis.window };
  let pedidos;
  let comModal;

  async function carregarCliente() {
    // Módulo novo a cada cenário (o cliente guarda a consulta da página).
    return import(`../../src/features/conta/cliente.ts?c=${Math.random()}`);
  }

  before(() => {
    const alvo = new EventTarget();
    globalThis.window = { dispatchEvent: (e) => alvo.dispatchEvent(e), addEventListener: (...a) => alvo.addEventListener(...a), removeEventListener: (...a) => alvo.removeEventListener(...a) };
    globalThis.document = { getElementById: (id) => (comModal && id === "modal-entrar" ? {} : null) };
  });
  after(() => {
    Object.assign(globalThis, original);
  });

  function simularApi(logado) {
    pedidos = [];
    globalThis.fetch = async (url) => {
      pedidos.push(String(url));
      if (String(url).startsWith("/api/conta/estado")) {
        return Response.json(logado ? { logado: true, consentimento: { geral: true, reacoes: true } } : { logado: false });
      }
      const lista = decodeURIComponent(String(url).split("ids=")[1] ?? "").split(",");
      return Response.json({ itens: Object.fromEntries(lista.map((i) => [i, { curtidas: 2, naoCurtidas: 1, minha: 0 }])) });
    };
  }

  test("cadastro desligado: nenhuma consulta e o clique pede o aviso 'em breve'", async () => {
    comModal = false;
    simularApi(false);
    const c = await carregarCliente();
    assert.deepEqual(await c.obterEstadoConta(), { logado: false, desligado: true });
    assert.equal(c.pedirEntrada(null, "x"), false, "sem convite para entrar: quem chamou mostra o aviso");
    assert.equal(pedidos.length, 0);
  });

  test("visitante: o clique abre o convite para entrar; sem contadores", async () => {
    comModal = true;
    simularApi(false);
    const c = await carregarCliente();
    let aberto = null;
    const parar = c.aoPedirEntrada((p) => (aberto = p.motivo));
    assert.equal((await c.obterEstadoConta()).logado, false);
    assert.equal(c.pedirEntrada(null, "Para curtir, entre."), true);
    assert.equal(aberto, "Para curtir, entre.");
    parar();
    assert.deepEqual(pedidos, ["/api/conta/estado"]);
  });

  test("com sessão: contadores de todos os cartões numa só consulta (lotes de 50)", async () => {
    comModal = true;
    simularApi(true);
    const c = await carregarCliente();
    assert.equal((await c.obterEstadoConta()).logado, true);
    const idsCartoes = Array.from({ length: 30 }, (_, i) => `camara-votacao:${i}`);
    const r = await Promise.all([...idsCartoes, idsCartoes[0]].map((i) => c.obterContagem(i)));
    assert.equal(r[0].curtidas, 2);
    const consultas = pedidos.filter((p) => p.startsWith("/api/conta/reacoes"));
    assert.equal(consultas.length, 1, "uma consulta para a página toda");
    const muitos = Array.from({ length: 70 }, (_, i) => `senado-votacao:${i}`);
    await Promise.all(muitos.map((i) => c.obterContagem(i)));
    assert.equal(pedidos.filter((p) => p.startsWith("/api/conta/reacoes")).length, 3, "70 ids novos: 2 lotes");
  });
});
