import type { ArquivoDecisoes, Decisao, Fonte } from "./tipos";

/**
 * EXEMPLO PROVISÓRIO, usado só enquanto dados/icms/decisoes.json não existir.
 * Conteúdo transcrito de docs/pesquisa/icms-sp.json (fontes do CONFAZ e do Planalto,
 * acessadas em 02/11/2026). A página avisa o leitor quando estes dados estão em uso.
 */
const ACESSO = "2026-11-02";

const fonte = (titulo: string, url: string, orgao: string): Fonte => ({ titulo, url, orgao, acessado_em: ACESSO });

const ATO_27 = "https://www.confaz.fazenda.gov.br/legislacao/atos-declaratorios/2026/ato-declaratorio-27-26";
const DESPACHO_50 = "https://www.confaz.fazenda.gov.br/legislacao/despacho/2026/despacho-50-26";
const LC24 = "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp24.htm";
const LC192 = "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp192.htm";

const comuns = {
  caminho: "confaz",
  instrumento: "Convênio ICMS",
  orgao: "Conselho Nacional de Política Fazendária (CONFAZ)",
  datas: { decisao: "2026-10-27", publicacao: "2026-10-28", vigencia: "2027-02-01" },
  responsaveis: [
    { nome: "Robinson Sakiyama Barreirinhas", cargo: "Presidente do CONFAZ, em exercício", ente: "União", papel: "presidiu" },
    { nome: "Samuel Yoshiaki Oliveira Kinoshita", cargo: null, ente: "São Paulo", papel: "assinou" },
  ],
  votacoes: [
    {
      casa: "confaz",
      tipo: "unanimidade-registrada",
      data: "2026-10-29",
      descricao:
        "Ratificação antecipada do convênio pelo Ato Declaratório 27/2026, que registra que as unidades federadas a aprovaram \"por unanimidade\". Não foi localizado registro oficial do voto de cada estado.",
      placar: null,
      votacao_ref: null,
      url: ATO_27,
    },
  ],
  justificativa: { texto: null, documento: null, url: null },
  justificativas_contrarias: [],
  termos: ["ICMS", "CONFAZ", "Convênio ICMS", "Ad rem", "Ratificação antecipada", "Ato declaratório", "Lei complementar"],
  lacunas: [
    "O texto do convênio publicado pelo CONFAZ não contém considerandos nem exposição de motivos; o preâmbulo cita apenas a base legal.",
    "Ata da reunião do CONFAZ com registro de votos por unidade federada não localizada no portal do CONFAZ.",
  ],
} satisfies Omit<Decisao, "id" | "titulo" | "resumo" | "numero" | "mudancas" | "fontes" | "relacionados">;

const DECISOES: Decisao[] = [
  {
    ...comuns,
    id: "confaz-convenio-127-2026",
    titulo: "Novo valor do ICMS da gasolina e do etanol anidro a partir de 01/02/2027",
    resumo:
      "O Convênio ICMS 127/2026, aprovado na 433ª Reunião Extraordinária do CONFAZ, em 27/10/2026, muda o valor do ICMS cobrado por litro de gasolina e de etanol anidro de R$ 1,57 para R$ 1,64, com efeitos a partir de 01/02/2027.",
    numero: "127/2026",
    mudancas: [
      { item: "Gasolina e etanol anidro combustível", antes: "1,57", depois: "1,64", unidade: "R$ por litro", vigencia: "2027-02-01" },
    ],
    relacionados: ["confaz-convenio-128-2026"],
    fontes: [
      fonte("Convênio ICMS 127/26, com a lista de signatários", "https://www.confaz.fazenda.gov.br/legislacao/convenios/2026/convenio-icms-127-26", "CONFAZ"),
      fonte("Despacho 50/2026 (publicação do convênio)", DESPACHO_50, "CONFAZ"),
      fonte("Ato Declaratório 27/2026 (ratificação antecipada)", ATO_27, "CONFAZ"),
      fonte("Convênio ICMS 15/23 consolidado (valor vigente de R$ 1,57)", "https://www.confaz.fazenda.gov.br/legislacao/convenios/2023/CV015_23", "CONFAZ"),
      fonte("Lei Complementar 24/1975, art. 2º (como os convênios são celebrados)", LC24, "Presidência da República"),
      fonte("Lei Complementar 192/2022, art. 3º, V (valores definidos pelos Estados e pelo Distrito Federal)", LC192, "Presidência da República"),
    ],
  },
  {
    ...comuns,
    id: "confaz-convenio-128-2026",
    titulo: "Novos valores do ICMS do diesel, do biodiesel e do gás de cozinha a partir de 01/02/2027",
    resumo:
      "O Convênio ICMS 128/2026, aprovado na 433ª Reunião Extraordinária do CONFAZ, em 27/10/2026, muda o ICMS do diesel e do biodiesel de R$ 1,17 para R$ 1,30 por litro e o do gás liquefeito de petróleo de R$ 1,47 para R$ 1,54 por quilo, a partir de 01/02/2027.",
    numero: "128/2026",
    mudancas: [
      { item: "Diesel e biodiesel", antes: "1,17", depois: "1,30", unidade: "R$ por litro", vigencia: "2027-02-01" },
      {
        item: "Gás liquefeito de petróleo e gás liquefeito derivado de gás natural (gás de cozinha)",
        antes: "1,47",
        depois: "1,54",
        unidade: "R$ por quilograma",
        vigencia: "2027-02-01",
      },
    ],
    relacionados: ["confaz-convenio-127-2026"],
    fontes: [
      fonte("Convênio ICMS 128/26, com a lista de signatários", "https://www.confaz.fazenda.gov.br/legislacao/convenios/2026/convenio-icms-128-26", "CONFAZ"),
      fonte("Despacho 50/2026 (publicação do convênio)", DESPACHO_50, "CONFAZ"),
      fonte("Ato Declaratório 27/2026 (ratificação antecipada)", ATO_27, "CONFAZ"),
      fonte("Convênio ICMS 199/22 consolidado (valores vigentes de R$ 1,17 e R$ 1,47)", "https://www.confaz.fazenda.gov.br/legislacao/convenios/2022/CV199_22", "CONFAZ"),
      fonte("Lei Complementar 24/1975, art. 2º (como os convênios são celebrados)", LC24, "Presidência da República"),
      fonte("Lei Complementar 192/2022, art. 3º, V (valores definidos pelos Estados e pelo Distrito Federal)", LC192, "Presidência da República"),
    ],
  },
];

export const DECISOES_EXEMPLO: ArquivoDecisoes = { atualizado_em: ACESSO, itens: DECISOES, provisorio: true };
