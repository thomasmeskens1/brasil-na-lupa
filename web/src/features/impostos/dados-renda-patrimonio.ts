/**
 * Imposto de Renda da Pessoa Física e impostos sobre o patrimônio (IPVA, IPTU e ITCMD). Não
 * são substituídos pela Reforma Tributária do consumo; a Emenda Constitucional nº 132/2023
 * mudou regras do IPVA, do IPTU e do ITCMD. Fontes em fontes.ts.
 */
import { DECISOES_IR, DECISOES_LC227, LINK_LEIS } from "./decisoes";
import type { Imposto } from "./tipos";

export const IMPOSTOS_RENDA_PATRIMONIO: Imposto[] = [
  {
    slug: "imposto-de-renda",
    sigla: "Imposto de Renda",
    nome: "Imposto sobre a Renda da Pessoa Física (IRPF)",
    figura: "carteira",
    esferas: ["federal"],
    base: "renda",
    situacao: "Mudou em 2026",
    reforma: false,
    resumo: "Imposto federal sobre a renda das pessoas. Desde janeiro de 2026, quem recebe até R$ 5.000,00 por mês tem o imposto mensal zerado.",
    quemCobra: "A União (Governo federal), por meio da Receita Federal.",
    sobreOQue: "Renda e proventos de qualquer natureza, como salário, aposentadoria e aluguel recebido.",
    quemDecide:
      "Lei federal aprovada pelo Congresso Nacional e sancionada pelo Presidente da República. A tabela mensal vem da Lei nº 15.191/2025; a redução que zera o imposto até R$ 5.000,00 vem da Lei nº 15.270/2025.",
    exemplo:
      "Quem recebe até R$ 5.000,00 por mês em rendimentos tributáveis tem o imposto mensal zerado desde janeiro de 2026. De R$ 5.000,01 a R$ 7.350,00, a redução é parcial e diminui conforme a renda.",
    hoje: "Tabela mensal com isenção até R$ 2.428,80 e alíquotas de 7,5% a 27,5%, mais a redução que zera o imposto até R$ 5.000,00 por mês.",
    depois2027:
      "Não faz parte da CBS, do IBS nem do Imposto Seletivo. Na declaração de 2027 (ano de 2026) passam a valer a redução anual, que zera o imposto até R$ 60.000,00, e a tributação mínima para quem recebe mais de R$ 600.000,00 no ano.",
    mudancas: [
      {
        quando: "Janeiro de 2026",
        oque: "Redução mensal: imposto zero até R$ 5.000,00; de R$ 5.000,01 a R$ 7.350,00, redução de R$ 978,62 menos 0,133145 vezes o rendimento.",
        fonte: "l15270",
      },
      {
        quando: "Janeiro de 2026",
        oque: "Retenção de 10% sobre lucros e dividendos acima de R$ 50.000,00 no mês, pagos pela mesma empresa à mesma pessoa.",
        fonte: "l15270",
      },
      {
        quando: "Declaração de 2027",
        oque: "Redução anual: imposto zero até R$ 60.000,00; redução parcial até R$ 88.200,00.",
        fonte: "l15270",
      },
      {
        quando: "Declaração de 2027",
        oque: "Tributação mínima para quem soma mais de R$ 600.000,00 de rendimentos no ano: de 0% a 10%, chegando a 10% a partir de R$ 1.200.000,00.",
        fonte: "l15270",
      },
    ],
    fontes: ["cf", "l15270", "tabelasIr"],
    termos: ["Rendimento tributável", "Imposto progressivo", "Alíquota"],
    decisoes: [...DECISOES_IR, LINK_LEIS],
    tabela: {
      legenda: "Tabela mensal do Imposto de Renda da Pessoa Física a partir de janeiro de 2026",
      colunas: ["Base de cálculo mensal", "Alíquota", "Parcela a deduzir"],
      linhas: [
        ["Até R$ 2.428,80", "Isento", "Não se aplica"],
        ["De R$ 2.428,81 a R$ 2.826,65", "7,5%", "R$ 182,16"],
        ["De R$ 2.826,66 a R$ 3.751,05", "15%", "R$ 394,16"],
        ["De R$ 3.751,06 a R$ 4.664,68", "22,5%", "R$ 675,49"],
        ["Acima de R$ 4.664,68", "27,5%", "R$ 908,73"],
      ],
      fonte: "tabelasIr",
      nota: "Depois de calcular o imposto pela tabela, aplica-se a redução da Lei nº 15.270/2025: até R$ 5.000,00 de rendimentos tributáveis no mês, o imposto fica zero. Dedução por dependente: R$ 189,59 por mês; desconto simplificado mensal: até R$ 607,20.",
    },
  },
  {
    slug: "ipva",
    sigla: "IPVA",
    nome: "Imposto sobre a Propriedade de Veículos Automotores",
    figura: "carro",
    esferas: ["estadual"],
    base: "patrimonio",
    situacao: "Continua",
    reforma: false,
    resumo: "Imposto dos estados sobre a propriedade de veículos. Continua existindo; a Emenda Constitucional nº 132/2023 mudou algumas regras.",
    quemCobra: "Os estados e o Distrito Federal.",
    sobreOQue:
      "Propriedade de veículos automotores. Desde a Emenda Constitucional nº 132/2023, a Constituição prevê a cobrança sobre veículos terrestres, aquáticos e aéreos, com exceções, como aeronaves agrícolas, embarcações de pesca e tratores.",
    quemDecide:
      "Cada estado fixa as alíquotas por lei estadual; o Senado Federal fixa as alíquotas mínimas. As alíquotas podem variar conforme o tipo, o valor, a utilização e o impacto ambiental do veículo (Constituição, artigo 155, § 6º).",
    exemplo: "Quem é dono de carro ou moto paga o IPVA ao estado, conforme a lei estadual.",
    hoje: "Cobrado por cada estado, conforme a lei estadual, já com as regras da Emenda Constitucional nº 132/2023 na Constituição.",
    depois2027: "Continua. Não é substituído pela CBS nem pelo IBS.",
    mudancas: [
      {
        quando: "20/12/2023",
        oque: "A Constituição passa a prever o IPVA sobre veículos aquáticos e aéreos (com exceções) e alíquotas diferentes conforme o impacto ambiental.",
        fonte: "ec132",
      },
    ],
    fontes: ["cf", "ec132"],
    termos: ["Alíquota", "Resolução do Senado", "Emenda Constitucional"],
  },
  {
    slug: "iptu",
    sigla: "IPTU",
    nome: "Imposto sobre a Propriedade Predial e Territorial Urbana",
    figura: "casa",
    esferas: ["municipal"],
    base: "patrimonio",
    situacao: "Continua",
    reforma: false,
    resumo: "Imposto das prefeituras sobre imóveis na cidade. Continua existindo; a prefeitura pode atualizar a base de cálculo conforme a lei municipal.",
    quemCobra: "Os municípios e o Distrito Federal.",
    sobreOQue: "Propriedade de imóveis urbanos: casas, apartamentos e terrenos na área urbana.",
    quemDecide:
      "Lei municipal, aprovada pela Câmara Municipal. O IPTU pode ser progressivo, nos termos da lei municipal (Constituição, artigo 156, § 1º). Desde a Emenda Constitucional nº 132/2023, a base de cálculo pode ser atualizada pelo Poder Executivo (prefeito), conforme critérios da lei municipal.",
    exemplo: "Quem é dono de casa, apartamento ou terreno na cidade paga o IPTU ao município.",
    hoje: "Cobrado por cada município, conforme a lei municipal.",
    depois2027: "Continua. Não é substituído pela CBS nem pelo IBS.",
    mudancas: [
      {
        quando: "20/12/2023",
        oque: "A base de cálculo do IPTU pode ser atualizada pelo Poder Executivo, conforme critérios estabelecidos em lei municipal.",
        fonte: "ec132",
      },
    ],
    fontes: ["cf", "ec132"],
    termos: ["Imposto progressivo", "Emenda Constitucional"],
  },
  {
    slug: "itcmd",
    sigla: "ITCMD",
    nome: "Imposto sobre Transmissão Causa Mortis e Doação de Quaisquer Bens ou Direitos",
    figura: "presente",
    esferas: ["estadual"],
    base: "patrimonio",
    situacao: "Continua, com novas regras",
    reforma: false,
    resumo: "Imposto dos estados sobre herança e doação. Passou a ser obrigatoriamente progressivo e ganhou normas gerais em 2026.",
    quemCobra:
      "Os estados e o Distrito Federal. Para bens móveis, títulos e créditos, cobra o estado onde morava a pessoa falecida ou o doador; para imóveis, o estado onde fica o bem.",
    sobreOQue: "Herança (transmissão por morte) e doação de quaisquer bens ou direitos.",
    quemDecide:
      "Lei estadual. O Senado Federal fixa a alíquota máxima (Constituição, artigo 155, § 1º, inciso IV; Resolução do Senado nº 9/1992). As alíquotas são progressivas conforme o valor do quinhão, do legado ou da doação (artigo 155, § 1º, inciso VI, e Lei Complementar nº 227/2026, artigo 156).",
    exemplo: "Quem recebe uma herança ou uma doação pode ter de pagar o ITCMD ao estado, conforme a lei estadual.",
    hoje: "Cobrado por cada estado, com alíquotas progressivas e as normas gerais da Lei Complementar nº 227/2026.",
    depois2027: "Continua. Não é substituído pela CBS nem pelo IBS.",
    mudancas: [
      {
        quando: "20/12/2023",
        oque: "A Constituição passa a exigir alíquotas progressivas e define o estado do domicílio da pessoa falecida como competente para bens móveis, títulos e créditos.",
        fonte: "ec132",
      },
      {
        quando: "13/1/2026",
        oque: "A Lei Complementar nº 227/2026 institui normas gerais do ITCMD. Entre elas: o imposto não incide sobre benefício de previdência privada complementar, aberta ou fechada (artigo 150, inciso III).",
        fonte: "lc227",
      },
    ],
    fontes: ["cf", "ec132", "lc227", "rsf9"],
    termos: ["Imposto progressivo", "Resolução do Senado", "Lei Complementar"],
    decisoes: [...DECISOES_LC227, LINK_LEIS],
  },
];
