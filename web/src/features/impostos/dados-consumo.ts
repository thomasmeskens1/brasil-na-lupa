/**
 * Impostos sobre o consumo: os cinco de hoje (ICMS, ISS, IPI, PIS e Cofins) e os da Reforma
 * Tributária (CBS, IBS, Imposto Seletivo, cashback e Cesta Básica Nacional). Cada frase vem
 * de dispositivo citado em fontes.ts; o registro está em docs/pesquisa/impostos-educativo.md.
 */
import { DECISOES_LC214, DECISOES_LC227, LINK_LEIS } from "./decisoes";
import type { Imposto } from "./tipos";

const TRANSICAO_ICMS_ISS = (nome: string): Imposto["mudancas"] => [
  { quando: "2029", oque: `Alíquotas do ${nome} passam a 9/10 (nove décimos) das fixadas na legislação.`, fonte: "ec132" },
  { quando: "2030", oque: `Alíquotas do ${nome} passam a 8/10 (oito décimos).`, fonte: "ec132" },
  { quando: "2031", oque: `Alíquotas do ${nome} passam a 7/10 (sete décimos).`, fonte: "ec132" },
  { quando: "2032", oque: `Alíquotas do ${nome} passam a 6/10 (seis décimos).`, fonte: "ec132" },
  { quando: "2033", oque: `O ${nome} é extinto.`, fonte: "ec132" },
];

export const IMPOSTOS_CONSUMO: Imposto[] = [
  {
    slug: "icms-como-funciona",
    sigla: "ICMS",
    nome: "Imposto sobre Circulação de Mercadorias e Serviços",
    figura: "carrinho",
    esferas: ["estadual"],
    base: "consumo",
    situacao: "Extinto em 2033",
    reforma: true,
    resumo: "Imposto dos estados sobre mercadorias e alguns serviços. Diminui de 2029 a 2032 e deixa de existir em 2033.",
    quemCobra: "Os estados e o Distrito Federal.",
    sobreOQue:
      "Circulação de mercadorias, inclusive energia elétrica e combustíveis, e serviços de transporte entre cidades e entre estados e de comunicação.",
    quemDecide:
      "Cada estado fixa as suas alíquotas internas por lei estadual. O Senado Federal fixa, por resolução, as alíquotas das operações entre estados. Isenções e outros benefícios dependem de deliberação conjunta dos estados, nos convênios do Conselho Nacional de Política Fazendária (CONFAZ).",
    exemplo: "Está no preço da conta de luz, do combustível e das mercadorias compradas no comércio.",
    hoje: "Cobrado por cada estado, com as alíquotas da lei estadual.",
    depois2027:
      "Continua igual em 2027 e 2028. De 2029 a 2032 as alíquotas diminuem a cada ano; em 2033 o ICMS é extinto e dá lugar ao IBS.",
    mudancas: [
      ...TRANSICAO_ICMS_ISS("ICMS"),
      {
        quando: "1º/1/2033",
        oque: "Fica revogada a Lei Complementar nº 87/1996 (Lei Kandir), que traz as regras gerais do ICMS.",
        fonte: "lc214",
      },
    ],
    fontes: ["cf", "ec132", "lc214"],
    termos: ["Alíquota", "Resolução do Senado", "CONFAZ", "Convênio ICMS"],
    paginaDecisoes: {
      rotulo: "Decisões que mudaram o ICMS em São Paulo",
      href: "/impostos/icms",
      detalhe: "Convênios do CONFAZ, leis da Assembleia Legislativa, decretos do governador e normas federais.",
    },
    decisoes: [...DECISOES_LC214, LINK_LEIS],
  },
  {
    slug: "iss",
    sigla: "ISS",
    nome: "Imposto sobre Serviços de Qualquer Natureza",
    figura: "maleta",
    esferas: ["municipal"],
    base: "consumo",
    situacao: "Extinto em 2033",
    reforma: true,
    resumo: "Imposto das prefeituras sobre serviços. Diminui de 2029 a 2032 e deixa de existir em 2033.",
    quemCobra: "Os municípios e o Distrito Federal.",
    sobreOQue:
      "Serviços da lista anexa à Lei Complementar nº 116/2003, como os de cabeleireiro e manicure (item 6.01), o ensino regular (item 8.01) e o conserto e a manutenção de veículos e aparelhos (item 14.01).",
    quemDecide:
      "Cada município fixa a alíquota por lei municipal, entre o mínimo de 2% (Lei Complementar nº 116/2003, artigo 8º-A) e o máximo de 5% (artigo 8º, inciso II).",
    exemplo: "Está no preço do corte de cabelo, da mensalidade da escola particular e do conserto do carro.",
    hoje: "Cobrado por cada município, com alíquota de 2% a 5% definida em lei municipal.",
    depois2027:
      "Continua igual em 2027 e 2028. De 2029 a 2032 as alíquotas diminuem a cada ano; em 2033 o ISS é extinto e dá lugar ao IBS.",
    mudancas: [
      ...TRANSICAO_ICMS_ISS("ISS"),
      { quando: "1º/1/2033", oque: "Fica revogada a Lei Complementar nº 116/2003, que traz as regras gerais do ISS.", fonte: "lc214" },
    ],
    fontes: ["cf", "lc116", "ec132", "lc214"],
    termos: ["Alíquota", "Lei Complementar"],
    decisoes: [...DECISOES_LC214, LINK_LEIS],
  },
  {
    slug: "ipi",
    sigla: "IPI",
    nome: "Imposto sobre Produtos Industrializados",
    figura: "fabrica",
    esferas: ["federal"],
    base: "consumo",
    situacao: "Zerado em 2027, com exceção",
    reforma: true,
    resumo: "Imposto federal sobre produtos industrializados. Em 2027 as alíquotas vão a zero, menos para produtos incentivados da Zona Franca de Manaus.",
    quemCobra: "A União (Governo federal).",
    sobreOQue: "Produtos industrializados.",
    quemDecide:
      "As alíquotas de cada produto estão na Tabela de Incidência do IPI (TIPI), aprovada por decreto do Presidente da República (hoje, o Decreto nº 11.158/2022).",
    exemplo: "Está no preço de produtos industrializados, como automóveis; a alíquota de cada produto está na TIPI.",
    hoje: "Cobrado pela União, com alíquotas por produto definidas em decreto.",
    depois2027:
      "A partir de 2027, alíquotas reduzidas a zero, exceto para os produtos com industrialização incentivada na Zona Franca de Manaus.",
    mudancas: [
      {
        quando: "2027",
        oque: "Alíquotas do IPI reduzidas a zero, exceto para produtos com industrialização incentivada na Zona Franca de Manaus, conforme lei complementar.",
        fonte: "ec132",
      },
    ],
    fontes: ["cf", "tipi", "ec132"],
    termos: ["Alíquota", "Decreto", "Zona Franca de Manaus"],
    decisoes: [...DECISOES_LC214, LINK_LEIS],
  },
  {
    slug: "pis-cofins",
    sigla: "PIS/Cofins",
    nome: "Contribuição para o Programa de Integração Social (PIS/Pasep) e Contribuição para o Financiamento da Seguridade Social (Cofins)",
    figura: "recibo",
    esferas: ["federal"],
    base: "consumo",
    situacao: "Extintos em 2027",
    reforma: true,
    resumo: "Contribuições federais sobre a receita das empresas. Deixam de ser cobradas em 2027, quando começa a CBS.",
    quemCobra: "A União (Governo federal).",
    sobreOQue: "Receitas das empresas: o total das receitas recebidas no mês, na regra da Lei nº 10.833/2003 (artigo 1º).",
    quemDecide:
      "Lei federal aprovada pelo Congresso Nacional. No regime não cumulativo, as alíquotas são de 1,65% para o PIS/Pasep (Lei nº 10.637/2002, artigo 2º) e de 7,6% para a Cofins (Lei nº 10.833/2003, artigo 2º).",
    exemplo: "São calculadas sobre a receita das empresas, que vem das vendas de bens e serviços.",
    hoje: "Cobradas pela União sobre a receita das empresas. Em 2026, a CBS e o IBS de teste são descontados do PIS e da Cofins devidos.",
    depois2027: "Extintas a partir de 2027 e substituídas pela CBS.",
    mudancas: [
      {
        quando: "2026",
        oque: "O valor recolhido de CBS e IBS de teste é compensado com o PIS e a Cofins devidos no mesmo período.",
        fonte: "lc214",
      },
      { quando: "2027", oque: "PIS e Cofins são extintos.", fonte: "ec132" },
      { quando: "1º/1/2027", oque: "Ficam revogados os dispositivos legais que instituem o PIS e a Cofins.", fonte: "lc214" },
    ],
    fontes: ["cf", "l10637", "l10833", "ec132", "lc214"],
    termos: ["Contribuição", "Não cumulatividade", "Alíquota"],
    decisoes: [...DECISOES_LC214, LINK_LEIS],
  },
  {
    slug: "cbs",
    sigla: "CBS",
    nome: "Contribuição Social sobre Bens e Serviços",
    figura: "moedas",
    esferas: ["federal"],
    base: "consumo",
    situacao: "Nova: cobrada a partir de 2027",
    reforma: true,
    resumo: "Nova contribuição federal sobre bens e serviços. Em teste em 2026; cobrada a partir de 2027, no lugar do PIS e da Cofins.",
    quemCobra: "A União (Governo federal).",
    sobreOQue: "Operações com bens materiais ou imateriais, inclusive direitos, e com serviços.",
    quemDecide:
      "A União fixa a alíquota por lei (Constituição, artigo 195, § 15; Lei Complementar nº 214/2025, artigo 14). Sem lei própria, vale a alíquota de referência fixada por resolução do Senado Federal, com base no cálculo do Tribunal de Contas da União (TCU) (artigos 14, § 3º, e 349).",
    exemplo: "Passa a ser cobrada nas compras de bens e serviços em geral, no lugar do PIS e da Cofins.",
    hoje: "Em teste: alíquota de 0,9%, compensada com PIS e Cofins. Quem cumpre as obrigações acessórias fica dispensado de recolher.",
    depois2027:
      "Cobrada a partir de 2027, com alíquota reduzida em 0,1 ponto percentual em 2027 e 2028. O TCU calculou a alíquota de referência de 2027 em 11,3%; a fixação pelo Senado ainda não tinha ocorrido em 3/11/2026.",
    mudancas: [
      { quando: "2026", oque: "Fase de teste: alíquota de 0,9%, compensada com o PIS e a Cofins.", fonte: "lc214" },
      {
        quando: "2026",
        oque: "Fica dispensado o recolhimento para quem cumprir as obrigações acessórias previstas na legislação.",
        fonte: "lc214",
      },
      {
        quando: "28/10/2026",
        oque: "O TCU calcula em 11,3% a alíquota de referência da CBS para 2027 e em 44,2% o redutor para compras da administração pública.",
        fonte: "tcuCbs",
      },
      {
        quando: "Até 15/12/2026",
        oque: "Prazo do Senado para fixar a alíquota por resolução; sem a resolução, prevalece o percentual calculado pelo TCU.",
        fonte: "senadoCbs",
      },
      { quando: "2027", oque: "A CBS passa a ser cobrada.", fonte: "ec132" },
      { quando: "2027 e 2028", oque: "Alíquota da CBS reduzida em 0,1 (um décimo) ponto percentual.", fonte: "lc214" },
    ],
    fontes: ["cf", "ec132", "lc214", "receitaEntenda"],
    termos: ["Contribuição", "Lei ordinária", "Alíquota de referência", "Resolução do Senado", "Fase de teste", "Obrigação acessória", "Não cumulatividade"],
    decisoes: [...DECISOES_LC214, LINK_LEIS],
  },
  {
    slug: "ibs",
    sigla: "IBS",
    nome: "Imposto sobre Bens e Serviços",
    figura: "cofre",
    esferas: ["estadual", "municipal"],
    base: "consumo",
    situacao: "Novo: completo em 2033",
    reforma: true,
    resumo: "Novo imposto dos estados e municípios sobre bens e serviços. Substitui, aos poucos, o ICMS e o ISS até 2033.",
    quemCobra:
      "Estados, Distrito Federal e municípios, juntos (competência compartilhada), por meio do Comitê Gestor do IBS.",
    sobreOQue: "Operações com bens materiais ou imateriais, inclusive direitos, e com serviços.",
    quemDecide:
      "Cada estado, o Distrito Federal e cada município fixam a sua alíquota por lei específica, a mesma para todas as operações, salvo as exceções da Constituição (artigo 156-A, § 1º, incisos V e VI). Sem lei própria, vale a alíquota de referência fixada por resolução do Senado Federal (Lei Complementar nº 214/2025, artigos 14, § 3º, e 349).",
    exemplo: "Vai substituir, aos poucos, o ICMS e o ISS no preço de bens e serviços.",
    hoje: "Em teste: alíquota estadual de 0,1% em 2026, compensada com PIS e Cofins.",
    depois2027:
      "Em 2027 e 2028: 0,05% estadual e 0,05% municipal. De 2029 a 2032, transição gradual do ICMS e do ISS para o IBS. Em 2033, modelo completo.",
    mudancas: [
      { quando: "2026", oque: "Fase de teste: alíquota estadual de 0,1%.", fonte: "lc214" },
      { quando: "13/1/2026", oque: "A Lei Complementar nº 227/2026 institui o Comitê Gestor do IBS.", fonte: "lc227" },
      { quando: "2027 e 2028", oque: "Alíquota estadual de 0,05% e alíquota municipal de 0,05%.", fonte: "lc214" },
      {
        quando: "2029 a 2033",
        oque: "Resolução do Senado fixa as alíquotas de referência do IBS para os estados, os municípios e o Distrito Federal.",
        fonte: "lc214",
      },
      {
        quando: "2029 a 2032",
        oque: "Transição gradual do ICMS e do ISS para o IBS, segundo a Receita Federal.",
        fonte: "receitaEntenda",
      },
      { quando: "2033", oque: "O ICMS e o ISS são extintos; o IBS fica no lugar deles.", fonte: "ec132" },
    ],
    fontes: ["cf", "ec132", "lc214", "lc227", "receitaEntenda"],
    termos: ["Comitê Gestor do IBS", "Alíquota de referência", "Resolução do Senado", "Fase de teste", "Não cumulatividade"],
    decisoes: [...DECISOES_LC214, ...DECISOES_LC227, LINK_LEIS],
  },
  {
    slug: "imposto-seletivo",
    sigla: "Imposto Seletivo",
    nome: "Imposto Seletivo (IS)",
    figura: "garrafa",
    esferas: ["federal"],
    base: "consumo",
    situacao: "Novo: começa em 2027",
    reforma: true,
    resumo: "Novo imposto federal sobre bens e serviços prejudiciais à saúde ou ao meio ambiente. Começa em 2027.",
    quemCobra: "A União (Governo federal).",
    sobreOQue:
      "Produção, extração, comercialização ou importação de: veículos; embarcações e aeronaves; produtos fumígenos (como cigarros); bebidas alcoólicas; bebidas açucaradas; bens minerais; e concursos de prognósticos e fantasy sport (Lei Complementar nº 214/2025, artigo 409). Não incide sobre exportações nem sobre energia elétrica e telecomunicações.",
    quemDecide:
      "As alíquotas são fixadas em lei ordinária (Constituição, artigo 153, § 6º, inciso VI; Lei Complementar nº 214/2025, artigo 422). Para bens minerais extraídos, o máximo é de 0,25%.",
    exemplo: "Será cobrado uma única vez sobre cada bem ou serviço da lista, como cigarros, bebidas alcoólicas e bebidas açucaradas.",
    hoje: "Ainda não é cobrado.",
    depois2027:
      "Cobrado a partir de 2027. Alíquotas: Informação não disponível em fonte oficial até 3/11/2026 (a lei ordinária ainda não tinha sido publicada).",
    mudancas: [
      { quando: "2027", oque: "O Imposto Seletivo passa a ser cobrado.", fonte: "ec132" },
      {
        quando: "22/10/2026",
        oque: "A Agência Câmara informa que o Governo federal enviaria ao Congresso, nos próximos dias, a proposta com as alíquotas.",
        fonte: "camaraIs",
      },
    ],
    fontes: ["cf", "ec132", "lc214"],
    termos: ["Lei ordinária", "Ad valorem", "Alíquota"],
    decisoes: [...DECISOES_LC214, LINK_LEIS],
  },
  {
    slug: "cashback-e-cesta-basica",
    sigla: "Cashback e cesta básica",
    nome: "Devolução personalizada (cashback) e Cesta Básica Nacional de Alimentos",
    figura: "cesta",
    esferas: ["federal", "estadual", "municipal"],
    base: "consumo",
    situacao: "Novo: devolução a partir de 2027",
    reforma: true,
    resumo: "Alíquota zero de CBS e IBS para os alimentos da cesta básica nacional e devolução de parte desses tributos a famílias de baixa renda.",
    quemCobra:
      "A devolução da CBS é feita pela União; a do IBS, pelos estados, pelo Distrito Federal e pelos municípios (Lei Complementar nº 214/2025, artigo 112).",
    sobreOQue:
      "Alíquota zero de CBS e IBS para os alimentos do Anexo I da Lei Complementar nº 214/2025, como arroz, feijão, leite, carnes, peixes, café, farinha de mandioca, açúcar, massas e pão francês. Devolução de parte da CBS e do IBS pagos por famílias de baixa renda.",
    quemDecide:
      "Os percentuais de devolução estão na Lei Complementar nº 214/2025 (artigo 118). A União, os estados, o Distrito Federal e os municípios podem fixar percentuais maiores por lei específica, menos o de 100% da CBS (artigo 118, §§ 1º e 3º).",
    exemplo:
      "Família inscrita no Cadastro Único, com renda mensal de até meio salário-mínimo por pessoa, recebe de volta 100% da CBS e 20% do IBS pagos no botijão de gás de até 13 kg, na luz, na água, no esgoto, no gás canalizado e nas telecomunicações, e 20% da CBS e do IBS nas demais compras.",
    hoje: "A CBS e o IBS estão em teste; ainda não há devolução.",
    depois2027:
      "A devolução da CBS é calculada sobre o consumo a partir de janeiro de 2027; a do IBS, a partir de janeiro de 2029. A cesta básica tem alíquota zero de CBS e IBS.",
    mudancas: [
      { quando: "2027", oque: "Devolução da CBS calculada sobre o consumo familiar a partir de janeiro de 2027.", fonte: "lc214" },
      { quando: "2029", oque: "Devolução do IBS calculada sobre o consumo familiar a partir de janeiro de 2029.", fonte: "lc214" },
    ],
    fontes: ["ec132", "lc214"],
    termos: ["Devolução personalizada (cashback)", "Cadastro Único (CadÚnico)", "Cesta Básica Nacional de Alimentos"],
    decisoes: [...DECISOES_LC214, LINK_LEIS],
  },
];
