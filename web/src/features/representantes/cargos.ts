/**
 * O que cada cargo faz, em linguagem simples, com o artigo da Constituição Federal que o define
 * (texto conferido em https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm em 02/11/2026).
 * Só se repete o que os artigos citados dizem; nada é acrescentado.
 */
export const CONSTITUICAO = {
  url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
  titulo: "Constituição da República Federativa do Brasil de 1988 (texto compilado no portal do Planalto)",
  orgao: "Presidência da República",
  acessado_em: "2026-11-02",
} as const;

export interface InfoCargo {
  /** Nome no plural para o título do grupo. */
  plural: string;
  singular: string;
  texto: string;
  artigos: string;
}

export const CARGOS: Record<string, InfoCargo> = {
  Prefeito: {
    singular: "Prefeito",
    plural: "Prefeito",
    texto:
      "Eleito junto com o vice-prefeito e os vereadores, para mandato de quatro anos. O município cuida dos assuntos de interesse local e organiza e presta os serviços públicos locais, incluído o transporte coletivo.",
    artigos: "Constituição, art. 29, I, e art. 30, I e V",
  },
  "Vice-prefeito": {
    singular: "Vice-prefeito",
    plural: "Vice-prefeito",
    texto: "Eleito junto com o prefeito e os vereadores, para mandato de quatro anos.",
    artigos: "Constituição, art. 29, I",
  },
  Vereador: {
    singular: "Vereador",
    plural: "Vereadores",
    texto:
      "Formam a Câmara Municipal, que vota a lei orgânica do município e fiscaliza o município. Mandato de quatro anos. O número de vereadores depende da população: de 9, nos municípios de até 15 mil habitantes, até 55, nos de mais de 8 milhões.",
    artigos: "Constituição, art. 29, caput, I e IV, e art. 31",
  },
  Governador: {
    singular: "Governador",
    plural: "Governador",
    texto:
      "Eleito com o vice-governador para mandato de quatro anos. Os estados se organizam e se regem pelas Constituições e leis que adotarem, observados os princípios da Constituição Federal.",
    artigos: "Constituição, art. 25 e art. 28",
  },
  "Vice-governador": {
    singular: "Vice-governador",
    plural: "Vice-governador",
    texto: "Eleito com o governador, para mandato de quatro anos.",
    artigos: "Constituição, art. 28",
  },
  "Deputado estadual": {
    singular: "Deputado estadual",
    plural: "Deputados estaduais",
    texto:
      "Formam a Assembleia Legislativa do estado, com mandato de quatro anos. O número é o triplo dos deputados federais do estado; passando de 36, soma-se um para cada deputado federal acima de 12.",
    artigos: "Constituição, art. 27, caput e § 1º",
  },
  "Deputado distrital": {
    singular: "Deputado distrital",
    plural: "Deputados distritais",
    texto:
      "Formam a Câmara Legislativa do Distrito Federal, com as mesmas regras dos deputados estaduais; são eleitos junto com o governador, para mandato de igual duração.",
    artigos: "Constituição, art. 32, §§ 2º e 3º, e art. 27",
  },
  Senador: {
    singular: "Senador",
    plural: "Senadores",
    texto:
      "Representam o estado no Senado Federal: três por estado, com mandato de oito anos. A renovação é feita de quatro em quatro anos, alternadamente, de um terço e de dois terços das vagas; por isso há senadores eleitos em 2018 e em 2022.",
    artigos: "Constituição, art. 46, caput, §§ 1º e 2º",
  },
  "Deputado federal": {
    singular: "Deputado federal",
    plural: "Deputados federais",
    texto:
      "Representantes do povo na Câmara dos Deputados, eleitos pelo sistema proporcional em cada estado. Nenhum estado tem menos de 8 nem mais de 70. Câmara e Senado formam o Congresso Nacional, que trata das matérias de competência da União, com a sanção do Presidente da República.",
    artigos: "Constituição, art. 44, art. 45, caput e § 1º, e art. 48",
  },
  Presidente: {
    singular: "Presidente da República",
    plural: "Presidente da República",
    texto:
      "Exerce o Poder Executivo federal, auxiliado pelos Ministros de Estado. Entre outras competências, sanciona e veta projetos de lei e inicia o processo legislativo nos casos previstos. Mandato de quatro anos.",
    artigos: "Constituição, art. 76, art. 82 e art. 84, III, IV e V",
  },
  "Vice-presidente": {
    singular: "Vice-presidente da República",
    plural: "Vice-presidente da República",
    texto: "Substitui o Presidente em caso de impedimento e o sucede em caso de vaga.",
    artigos: "Constituição, art. 79",
  },
};

/** Presidente e vice: os arquivos do TSE usados nesta seção não os incluem; nomes da página oficial. */
export const PRESIDENCIA = [
  {
    cargo: "Presidente",
    nome: "Luiz Inácio Lula da Silva",
    fonte: {
      url: "https://www.gov.br/planalto/pt-br/conheca-a-presidencia/biografia-do-presidente",
      titulo: "Biografia do Presidente da República",
      orgao: "Presidência da República",
      acessado_em: "2026-11-02",
    },
  },
  {
    cargo: "Vice-presidente",
    nome: "Geraldo José Rodrigues Alckmin Filho",
    fonte: {
      url: "https://www.gov.br/planalto/pt-br/vice-presidencia/acesso-a-informacao/institucional/biografia-do-vice-presidente-da-republica-1",
      titulo: "Biografia do Vice-Presidente da República",
      orgao: "Presidência da República",
      acessado_em: "2026-11-02",
    },
  },
] as const;

export const UFS: { sigla: string; nome: string }[] = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"], ["BA", "Bahia"], ["CE", "Ceará"],
  ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"], ["SP", "São Paulo"],
  ["SE", "Sergipe"], ["TO", "Tocantins"],
].map(([sigla, nome]) => ({ sigla, nome }));

/** Lista de quem está em exercício hoje, quando o site a tem. */
export const EM_EXERCICIO = {
  camara: { href: "/congresso/deputados", rotulo: "Deputados federais em exercício (lista oficial da Câmara)" },
  senado: { href: "/congresso/senadores", rotulo: "Senadores em exercício (lista oficial do Senado)" },
  alesp: { href: "/estados/sp/deputados", rotulo: "Deputados estaduais de SP em exercício (lista oficial da ALESP)" },
  atibaia: { href: "/atibaia", rotulo: "Composição atual da Câmara Municipal de Atibaia" },
} as const;
