/**
 * Testes da normalização de texto para a leitura em voz alta ("Ouvir esta página").
 * Rodar com: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/ouvir/
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  anuncioTitulo,
  dataPorExtenso,
  dividirEmTrechos,
  escolherVoz,
  falarAbreviacoes,
  falarDatas,
  falarDinheiro,
  falarNormas,
  falarNumeros,
  falarSiglas,
  paraFala,
  porExtenso,
  reaisPorExtenso,
} from "../../src/components/ouvir/normalizar.ts";

describe("porExtenso", () => {
  const casos = [
    [0, "zero"],
    [1, "um"],
    [16, "dezesseis"],
    [21, "vinte e um"],
    [100, "cem"],
    [101, "cento e um"],
    [397, "trezentos e noventa e sete"],
    [1000, "mil"],
    [1001, "mil e um"],
    [1100, "mil e cem"],
    [1234, "mil duzentos e trinta e quatro"],
    [2005, "dois mil e cinco"],
    [1000000, "um milhão"],
    [2500000, "dois milhões quinhentos mil"],
    [1000000000, "um bilhão"],
  ];
  for (const [n, t] of casos) test(`${n}`, () => assert.equal(porExtenso(n), t));
});

describe("dinheiro", () => {
  test("R$ 1,64", () => assert.equal(reaisPorExtenso(1.64), "um real e sessenta e quatro centavos"));
  test("R$ 0,05", () => assert.equal(reaisPorExtenso(0.05), "cinco centavos"));
  test("R$ 2,00", () => assert.equal(reaisPorExtenso(2), "dois reais"));
  test("R$ 1 milhão", () => assert.equal(reaisPorExtenso(1000000), "um milhão de reais"));
  test("no texto", () =>
    assert.equal(falarDinheiro("de R$ 1,57 para R$ 1,64 por litro"), "de um real e cinquenta e sete centavos para um real e sessenta e quatro centavos por litro"));
  test("milhar com ponto", () => assert.equal(falarDinheiro("R$ 1.234,50"), "mil duzentos e trinta e quatro reais e cinquenta centavos"));
  test("escala", () => assert.equal(falarDinheiro("R$ 2,5 bilhões"), "dois vírgula cinco bilhões de reais"));
  test("escala abreviada", () => assert.equal(falarDinheiro("R$ 1 bi"), "um bilhão de reais"));
  test("sem espaço", () => assert.equal(falarDinheiro("R$10"), "dez reais"));
});

describe("datas", () => {
  test("dd/mm/aaaa", () => assert.equal(falarDatas("em 15/12/2025"), "em 15 de dezembro de 2025"));
  test("dia 1", () => assert.equal(falarDatas("a partir de 01/02/2027"), "a partir de primeiro de fevereiro de 2027"));
  test("1º/02/2027", () => assert.equal(falarDatas("1º/02/2027"), "primeiro de fevereiro de 2027"));
  test("ISO", () => assert.equal(falarDatas("2026-11-03"), "3 de novembro de 2026"));
  test("data inválida fica", () => assert.equal(falarDatas("45/13/2025"), "45/13/2025"));
  test("hora", () => assert.equal(falarDatas("às 14h30"), "às 14 horas e 30 minutos"));
  test("hora com dois-pontos", () => assert.equal(falarDatas("02/11/2026, 19:01"), "2 de novembro de 2026, 19 horas e 1 minuto"));
  test("extenso direto", () => assert.equal(dataPorExtenso(1, 1, 2026), "primeiro de janeiro de 2026"));
});

describe("normas", () => {
  test("PL 1234/2025", () => assert.equal(falarNormas("PL 1234/2025"), "Projeto de Lei 1234 de 2025"));
  test("PLP 108/2024", () => assert.equal(falarNormas("PLP 108/2024"), "Projeto de Lei Complementar 108 de 2024"));
  test("PEC", () => assert.equal(falarNormas("PEC 45/2019"), "Proposta de Emenda à Constituição 45 de 2019"));
  test("MPV", () => assert.equal(falarNormas("MPV 1300/2025"), "Medida Provisória 1300 de 2025"));
  test("LC com ponto", () => assert.equal(falarNormas("LC 227/2026"), "Lei Complementar 227 de 2026"));
  test("número/ano genérico", () => assert.equal(falarNormas("Convênio ICMS 127/2026"), "Convênio ICMS 127 de 2026"));
  test("partido PL sem número não expande", () => assert.equal(falarNormas("deputado do PL de SP"), "deputado do PL de SP"));
});

describe("abreviações", () => {
  test("artigo e parágrafo", () => assert.equal(falarAbreviacoes("art. 5º, § 2º"), "artigo quinto, parágrafo segundo"));
  test("artigo alto vira cardinal", () => assert.equal(falarAbreviacoes("art. 155"), "artigo 155"));
  test("nº", () => assert.equal(falarAbreviacoes("Lei nº 18499"), "Lei número 18499"));
  test("ordinal feminino", () => assert.equal(falarAbreviacoes("1ª votação"), "primeira votação"));
  test("inciso", () => assert.equal(falarAbreviacoes("inc. III"), "inciso III"));
});

describe("números e símbolos", () => {
  test("placar ×", () => assert.equal(falarNumeros("397 × 3"), "397 a 3"));
  test("placar x", () => assert.equal(falarNumeros("Aprovado 312 x 140"), "Aprovado 312 a 140"));
  test("porcentagem", () => assert.equal(falarNumeros("alíquota de 12,5%"), "alíquota de doze vírgula cinco por cento"));
  test("porcentagem inteira", () => assert.equal(falarNumeros("18%"), "dezoito por cento"));
  test("milhar", () => assert.equal(falarNumeros("1.234 votos"), "1234 votos"));
  test("seta", () => assert.equal(falarNumeros("R$ 1 → R$ 2"), "R$ 1 para R$ 2"));
  test("ponto médio", () => assert.equal(falarNumeros("CONFAZ · 03/10"), "CONFAZ, 03/10"));
  test("intervalo", () => assert.equal(falarNumeros("2023-2026"), "2023 a 2026"));
});

describe("siglas", () => {
  test("primeira ocorrência por extenso, depois sigla", () => {
    const ditas = new Set();
    assert.equal(falarSiglas("O STF decidiu.", ditas), "O Supremo Tribunal Federal decidiu.");
    assert.equal(falarSiglas("O STF manteve.", ditas), "O STF manteve.");
  });
  test("nome (SIGLA) não repete", () => {
    const ditas = new Set();
    assert.equal(falarSiglas("Superior Tribunal de Justiça (STJ) julgou", ditas), "Superior Tribunal de Justiça julgou");
    assert.equal(falarSiglas("o STJ", ditas), "o STJ");
  });
  test("não troca dentro de palavra", () => assert.equal(falarSiglas("STFX e TCU-X"), "STFX e TCU-X"));
  test("TCE-SP", () => assert.equal(falarSiglas("o TCE-SP"), "o Tribunal de Contas do Estado de São Paulo"));
});

describe("paraFala (tudo junto)", () => {
  test("frase de votação", () =>
    assert.equal(
      paraFala("PL 1234/2025 aprovado por 397 × 3 em 15/12/2025"),
      "Projeto de Lei 1234 de 2025 aprovado por 397 a 3 em 15 de dezembro de 2025",
    ));
  test("ICMS da gasolina", () =>
    assert.equal(
      paraFala("Novo valor do ICMS da gasolina a partir de 01/02/2027: R$ 1,64 por litro"),
      "Novo valor do ICMS da gasolina a partir de primeiro de fevereiro de 2027: um real e sessenta e quatro centavos por litro",
    ));
  test("link vira endereço", () => assert.equal(paraFala("veja https://www.camara.leg.br/x"), "veja endereço do site"));
  test("espaços e pontuação", () => assert.equal(paraFala("  Sim : 397 ,  Não: 3 "), "Sim: 397, Não: 3"));
});

describe("trechos e títulos", () => {
  test("divide em frases sem cortar palavras", () => {
    const t = "Primeira frase. ".repeat(30);
    const r = dividirEmTrechos(t, 100);
    assert.ok(r.length > 1);
    for (const x of r) assert.ok(x.length <= 100, x);
    assert.equal(r.join(" ").replace(/\s+/g, " "), t.trim());
  });
  test("frase longa corta em espaço", () => {
    const t = "palavra ".repeat(60).trim();
    for (const x of dividirEmTrechos(t, 80)) {
      assert.ok(x.length <= 80);
      assert.ok(!/palavr$|^alavra/.test(x));
    }
  });
  test("decimal não quebra frase", () => assert.deepEqual(dividirEmTrechos("Valor de 1.5 mil. Fim.", 18), ["Valor de 1.5 mil.", "Fim."]));
  test("anúncio de título", () => {
    assert.equal(anuncioTitulo(1, "Congresso Nacional"), "Título da página: Congresso Nacional.");
    assert.equal(anuncioTitulo(2, "Votos:"), "Seção: Votos.");
    assert.equal(anuncioTitulo(3, "2026"), "Subtítulo: 2026.");
  });
});

describe("escolha da voz", () => {
  test("prefere pt-BR natural", () => {
    const v = escolherVoz([
      { name: "Microsoft David - English", lang: "en-US" },
      { name: "Microsoft Maria - Portuguese (Brazil)", lang: "pt-BR", localService: true },
      { name: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)", lang: "pt-BR" },
      { name: "Joana", lang: "pt-PT" },
    ]);
    assert.equal(v.name, "Microsoft Francisca Online (Natural) - Portuguese (Brazil)");
  });
  test("Google pt-BR acima de voz local simples", () => {
    const v = escolherVoz([
      { name: "Luciana", lang: "pt-BR" },
      { name: "Google português do Brasil", lang: "pt-BR" },
    ]);
    assert.equal(v.name, "Google português do Brasil");
  });
  test("aceita pt_BR (Android)", () => assert.equal(escolherVoz([{ name: "x", lang: "pt_BR" }]).name, "x"));
  test("sem português: null", () => assert.equal(escolherVoz([{ name: "Alex", lang: "en-US" }]), null));
});

describe("casos encontrados nas páginas", () => {
  test("data colada em texto", () => assert.equal(paraFala("Congresso13/01/2026"), "Congresso13 de janeiro de 2026"));
  test("sigla/ano", () => assert.equal(paraFala("do CPC/2015", new Set(["CPC"])), "do CPC de 2015"));
  test("ponto médio no início", () => assert.equal(paraFala("· Impostos e preços"), "Impostos e preços"));
  test("título com interrogação", () => assert.equal(anuncioTitulo(3, "Quem me representa?"), "Subtítulo: Quem me representa?"));
});
