/**
 * Testes do dicionário único de siglas e da marcação de siglas em textos oficiais.
 * Rodar com: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test "tests/glossario/*.test.mjs"
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { register } from "node:module";

register("../conta/resolver.mjs", import.meta.url);
const { SIGLAS_OFICIAIS, SIGLA_POR_CHAVE, nomeDaSigla } = await import("../../src/components/glossario/siglas.ts");
const { segmentarSiglas, capitalizacaoNormal, emCaixaAlta } = await import("../../src/components/glossario/marcarSiglas.ts");
const { SIGLAS, SIGLAS_NORMA } = await import("../../src/components/ouvir/normalizar.ts");

/** Siglas marcadas, na ordem. */
const marcadas = (t, vistas = new Set()) => segmentarSiglas(t, vistas).filter((s) => typeof s !== "string").map((s) => s.texto);
/** O texto reconstruído a partir dos segmentos. */
const juntar = (segs) => segs.map((s) => (typeof s === "string" ? s : s.texto)).join("");

describe("dicionário", () => {
  test("sem siglas repetidas", () => assert.equal(SIGLA_POR_CHAVE.size, SIGLAS_OFICIAIS.length));
  test("toda sigla tem nome e fonte oficial", () => {
    for (const s of SIGLAS_OFICIAIS) {
      assert.ok(s.nome && s.nome !== s.sigla, s.sigla);
      assert.match(s.fonte.url, /^https:\/\/[^/]+\.(gov|leg|jus|mp|tc)\.br\/|^https:\/\/[a-z0-9.-]+\.tc\.br\//, s.sigla);
      assert.ok(s.fonte.nome, s.sigla);
    }
  });
  test("siglas pedidas estão no dicionário", () => {
    const pedidas = "ADI ADC ADPF RE REsp ARE LC PLP PEC PDL MPV VET REQ RICD RISF IPI ICMS ISS IBS CBS IBGE SAAE TCU TCE CONFAZ CMO".split(" ");
    for (const p of pedidas) assert.ok(nomeDaSigla(p), p);
  });
  test("nomes conferidos", () => {
    assert.equal(nomeDaSigla("ADPF"), "Arguição de Descumprimento de Preceito Fundamental");
    assert.equal(nomeDaSigla("CMO"), "Comissão Mista de Planos, Orçamentos Públicos e Fiscalização");
    assert.equal(nomeDaSigla("SAAE"), "Saneamento Ambiental de Atibaia");
    assert.equal(nomeDaSigla("ALESP"), "Assembleia Legislativa do Estado de São Paulo");
    assert.equal(nomeDaSigla("TCE-MG"), "Tribunal de Contas do Estado de Minas Gerais");
  });
  test("a voz usa o mesmo dicionário", () => {
    assert.equal(SIGLAS.STF, nomeDaSigla("STF"));
    assert.equal(SIGLAS_NORMA.ADI, nomeDaSigla("ADI"));
    assert.equal(SIGLAS.ICMS, undefined); // "ICMS" a voz lê como sigla
  });
  test("siglas ambíguas ficam de fora", () => {
    assert.equal(nomeDaSigla("PLC"), null);
    assert.equal(nomeDaSigla("PR"), null);
  });
});

describe("segmentarSiglas", () => {
  test("texto reconstruído é idêntico", () => {
    const t = "ADI 1.234/2025: o STF e o TCU (ver https://portal.stf.jus.br/ADI?x=STF) — REsp 1.999.999/SP.";
    assert.equal(juntar(segmentarSiglas(t)), t);
  });
  test("números não são cortados", () => {
    const segs = segmentarSiglas("ADI 1.234/2025");
    assert.equal(segs.length, 2);
    assert.equal(segs[0].texto, "ADI");
    assert.equal(segs[1], " 1.234/2025");
  });
  test("primeira ocorrência da página", () => {
    const vistas = new Set();
    const a = segmentarSiglas("O STF julgou.", vistas).find((s) => typeof s !== "string");
    const b = segmentarSiglas("Depois o STF voltou.", vistas).find((s) => typeof s !== "string");
    assert.equal(a.primeira, true);
    assert.equal(b.primeira, false);
  });
  test("mesma sigla duas vezes no texto", () => {
    const s = segmentarSiglas("STF e STF").filter((x) => typeof x !== "string");
    assert.deepEqual(s.map((x) => x.primeira), [true, false]);
  });
  test("URL e e-mail ficam intactos", () => {
    assert.deepEqual(marcadas("Veja https://www.tcu.gov.br/TCU/ADI e www.stf.jus.br/STF"), []);
    assert.deepEqual(marcadas("Escreva para ouvidoria@TCU.gov.br"), []);
    assert.deepEqual(marcadas("portal.stf.jus.br/STF/ADI"), []);
    assert.deepEqual(marcadas("Site: https://x.gov.br/a. Depois o TCU decidiu"), ["TCU"]);
  });
  test("coladas em pontuação", () => {
    assert.deepEqual(marcadas("(STF), [TCU]; CONFAZ. IBGE: ICMS!"), ["STF", "TCU", "CONFAZ", "IBGE", "ICMS"]);
    assert.deepEqual(marcadas("“ICMS”, ‘IPI’ e \"ISS\"?"), ["ICMS", "IPI", "ISS"]);
    assert.deepEqual(marcadas("ICMS/IPI"), ["ICMS", "IPI"]);
  });
  test("não marca dentro de palavra nem depois de hífen", () => {
    assert.deepEqual(marcadas("STFX, XSTF, TCU-X, PT-SP, arquivo.ICMS, ICMS-ST"), []);
  });
  test("compostas vencem as curtas", () => {
    assert.deepEqual(marcadas("o TCE-SP e o TCE"), ["TCE-SP", "TCE"]);
    assert.deepEqual(marcadas("SEFAZ-SP"), ["SEFAZ-SP"]);
  });
  test("maiúsculas e minúsculas exatas", () => {
    assert.deepEqual(marcadas("REsp 1.234 e resp e Stf"), ["REsp"]);
  });
  test("ambíguas só com número", () => {
    assert.deepEqual(marcadas("Deputado Fulano (PL-SP) do PL"), []);
    assert.deepEqual(marcadas("PL 1234/2025 e PL nº 12"), ["PL", "PL"]);
    assert.deepEqual(marcadas("RE 574.706"), ["RE"]);
    assert.deepEqual(marcadas("MP e MP 1.303/2025"), ["MP"]);
  });
  test("nome já por extenso no texto", () => {
    const s = segmentarSiglas("Supremo Tribunal Federal (STF) decidiu; o STF manteve.").filter((x) => typeof x !== "string");
    assert.equal(s[0].explicadaNoTexto, true);
    assert.equal(s[0].primeira, false);
    assert.equal(s[1].primeira, false);
    const t = segmentarSiglas("CONFAZ (Conselho Nacional de Política Fazendária)").find((x) => typeof x !== "string");
    assert.equal(t.explicadaNoTexto, true);
  });
  test("texto em caixa alta", () => {
    assert.deepEqual(marcadas("ACORDAO DO TCU SOBRE O ICMS E A ATA DA SESSAO"), ["TCU", "ICMS"]);
  });
  test("texto vazio", () => assert.deepEqual(segmentarSiglas(""), [""]));
});

describe("caixa alta", () => {
  test("detecta", () => {
    assert.equal(emCaixaAlta("MINISTRO HERMAN BENJAMIN"), true);
    assert.equal(emCaixaAlta("Ministro Herman Benjamin"), false);
    assert.equal(emCaixaAlta("STJ"), false); // curto demais: é sigla
  });
  test("capitalização normal", () => {
    assert.equal(capitalizacaoNormal("MINISTRO HERMAN BENJAMIN"), "Ministro Herman Benjamin");
    assert.equal(capitalizacaoNormal("JOSÉ DA SILVA DOS SANTOS"), "José da Silva dos Santos");
    assert.equal(capitalizacaoNormal("SEGUNDA TURMA DO STJ"), "Segunda Turma do STJ");
    assert.equal(capitalizacaoNormal("PEDRO II E O TCE-SP"), "Pedro II e o TCE-SP");
    assert.equal(capitalizacaoNormal("DE OLIVEIRA. DA COSTA"), "De Oliveira. Da Costa");
    assert.equal(capitalizacaoNormal("JOÃO D'ÁVILA"), "João D'ávila");
  });
});
