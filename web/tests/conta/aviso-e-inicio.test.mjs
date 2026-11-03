/**
 * Testes do aviso de cookies (regra de consentimento preparada) e do cruzamento do bloco
 * "Seus favoritos" da página inicial. Rodar com: npm run test:conta
 */
import assert from "node:assert/strict";
import { register } from "node:module";
import { describe, test } from "node:test";

register("./resolver.mjs", import.meta.url);
const c = await import("../../src/features/privacidade/cookies.ts");
const { decisoesDosFavoritos, temFavoritos } = await import("../../src/features/conta/filtro-favoritos.ts");

describe("aviso de cookies", () => {
  test("hoje só há cookies essenciais: aviso informativo", () => {
    assert.equal(c.COOKIES_NAO_ESSENCIAIS.length, 0);
    assert.equal(c.exigeConsentimento(), false);
    assert.ok(c.COOKIES_ESSENCIAIS.every((k) => k.categoria === "essencial"));
  });
  test("aparece até a pessoa responder à versão atual", () => {
    assert.equal(c.deveMostrarAviso(null), true);
    assert.equal(c.deveMostrarAviso(c.lerEscolha("lixo")), true);
    const v = c.lerEscolha(JSON.stringify({ versao: c.VERSAO_AVISO, naoEssenciais: null }));
    assert.equal(c.deveMostrarAviso(v), false);
    assert.equal(c.deveMostrarAviso(v, "2"), true, "nova versão do aviso volta a aparecer");
  });
  test("cookie não essencial só com Aceitar (preparado para o futuro)", () => {
    const futuro = [{ nome: "x", categoria: "medicao", finalidade: "", duracao: "", soComCadastro: false }];
    assert.equal(c.exigeConsentimento(futuro), true);
    assert.equal(c.podeUsar("essencial", null), true);
    assert.equal(c.podeUsar("medicao", null), false);
    assert.equal(c.podeUsar("medicao", { versao: c.VERSAO_AVISO, naoEssenciais: "recusados" }), false);
    assert.equal(c.podeUsar("medicao", { versao: c.VERSAO_AVISO, naoEssenciais: "aceitos" }), true);
    assert.equal(c.podeUsar("medicao", { versao: "0", naoEssenciais: "aceitos" }), false, "aceite de versão antiga não vale");
  });
});

describe("Seus favoritos", () => {
  const indice = {
    decisoes: [
      { k: "camara-votacao:1-1", h: "/a", t: "A", d: "2026-10-01", c: "Câmara dos Deputados", tm: "Saúde" },
      { k: "sp-votacao:9", h: "/b", t: "B", d: "2026-10-20", c: "ALESP", uf: "SP" },
      { k: "senado-votacao:7", h: "/c", t: "C", d: "2026-10-10", c: "Senado Federal" },
      { k: "executivo:mpv-1-2026", h: "/d", t: "D", d: "2026-10-30", c: "Presidência da República" },
    ],
    politicos: { "senado:5": [2] },
  };
  const vazio = { uf: [], tema: [], politico: [], proposta: [] };

  test("cruza estado, tema, político e proposta; ordem só pela data", () => {
    const r = decisoesDosFavoritos(indice, { uf: ["SP"], tema: ["saude"], politico: ["senado:5"], proposta: ["executivo:mpv-1-2026"] });
    assert.deepEqual(r.map((d) => d.k), ["executivo:mpv-1-2026", "sp-votacao:9", "senado-votacao:7", "camara-votacao:1-1"]);
    assert.deepEqual(r[1].motivos, ["estado favorito (SP)"]);
    assert.deepEqual(r[3].motivos, ["tema favorito (Saúde)"]);
  });
  test("sem favoritos, nada aparece", () => {
    assert.equal(temFavoritos(vazio), false);
    assert.deepEqual(decisoesDosFavoritos(indice, vazio), []);
    assert.equal(decisoesDosFavoritos(indice, { ...vazio, uf: ["SP", "RJ"] }, 1).length, 1, "limite");
  });
});
