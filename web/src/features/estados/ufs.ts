/**
 * As 27 unidades da Federação (26 estados e o Distrito Federal), em ordem alfabética do nome.
 * Funções puras, seguras no navegador.
 *
 * "sabido" é um resumo curto do levantamento de fontes oficiais (docs/pesquisa/estados/<uf>.md),
 * mostrado só enquanto o estado não é acompanhado. Não traz números nem dados não coletados.
 */

export interface UfInfo {
  /** Código em minúsculas, usado no endereço (ex.: "sp"). */
  uf: string;
  sigla: string;
  nome: string;
  /** Preposição + nome (ex.: "de São Paulo", "do Amazonas", "da Bahia"). */
  de: string;
  casa: { sigla: string; nome: string; portal: string };
  /** "deputados estaduais" ou "deputados distritais". */
  membros: string;
  /** "governador" (o mesmo cargo em todas as UFs). */
  chefe: string;
  /** Resumo do levantamento de fontes oficiais (só para UFs ainda não acompanhadas). */
  sabido: string;
}

/** Data do levantamento de fontes oficiais por UF (docs/pesquisa/estados). */
export const DATA_LEVANTAMENTO = "2026-11-02";

const L: [string, string, string, string, string, string][] = [
  // [uf, nome, de, sigla da casa, portal, o que já se sabe]
  ["ac", "Acre", "do Acre", "ALEAC", "https://www.al.ac.leg.br/", "A Assembleia publica em dados abertos o voto de cada deputado só em parte das votações (as de vetos); as demais têm apenas o resultado."],
  ["al", "Alagoas", "de Alagoas", "ALE-AL", "https://www.al.al.leg.br/", "O sistema legislativo da Assembleia tem votos individuais só de 2018 e 2019, sem registros mais recentes. Projetos e leis estão em dados abertos."],
  ["ap", "Amapá", "do Amapá", "ALAP", "https://www.al.ap.leg.br/", "A ata publicada pela Assembleia traz o resultado das votações e a lista de ausentes, sem o voto de cada deputado."],
  ["am", "Amazonas", "do Amazonas", "ALEAM", "https://www.aleam.gov.br/", "A Assembleia publica em dados abertos o voto de cada deputado na maior parte das votações do Plenário, além de projetos e leis."],
  ["ba", "Bahia", "da Bahia", "ALBA", "https://www.al.ba.gov.br/", "O voto de cada deputado não foi localizado em formato aberto. A Assembleia publica as proposições e a frequência dos deputados."],
  ["ce", "Ceará", "do Ceará", "ALECE", "https://www.al.ce.gov.br/", "A Assembleia publica o voto de cada deputado nas votações nominais, em PDF; a maior parte das votações é simbólica."],
  ["df", "Distrito Federal", "do Distrito Federal", "CLDF", "https://www.cl.df.gov.br/", "A votação nominal, quando pedida, fica registrada na ata da sessão, em PDF; a maior parte das votações é simbólica. Proposições e normas estão em dados abertos."],
  ["es", "Espírito Santo", "do Espírito Santo", "ALES", "https://www.al.es.gov.br/", "A Assembleia publica um boletim de votação nominal, em PDF, gerado pelo painel eletrônico, e as proposições em dados abertos."],
  ["go", "Goiás", "de Goiás", "ALEGO", "https://portal.al.go.leg.br/", "O sistema legislativo da Assembleia declara bloqueio à coleta automática. Leis, decretos e mensagens de veto com as razões são publicados pela Casa Civil."],
  ["ma", "Maranhão", "do Maranhão", "ALEMA", "https://www.al.ma.leg.br/sitealema/", "O Plenário vota de forma simbólica, sem voto individual; os resultados aparecem no Diário da Assembleia. Proposições e normas estão em dados abertos."],
  ["mt", "Mato Grosso", "de Mato Grosso", "ALMT", "https://www.al.mt.gov.br/", "O voto de cada deputado não foi localizado; há só o resultado das votações. O acesso aos dados abertos da Assembleia exige credencial."],
  ["ms", "Mato Grosso do Sul", "de Mato Grosso do Sul", "ALEMS", "https://al.ms.gov.br/", "A Assembleia publica a lista de votação nominal no seu Diário Oficial, como imagem dentro do PDF."],
  ["mg", "Minas Gerais", "de Minas Gerais", "ALMG", "https://www.almg.gov.br/", "A Assembleia publica o voto de cada deputado nas votações nominais do Plenário, em texto no Diário do Legislativo, e as proposições e normas em dados abertos."],
  ["pa", "Pará", "do Pará", "ALEPA", "https://www.alepa.pa.gov.br/", "A Assembleia publica o voto de cada deputado em parte das matérias (projetos de lei complementar e propostas de emenda à Constituição)."],
  ["pb", "Paraíba", "da Paraíba", "ALPB", "https://www.al.pb.leg.br/", "A Assembleia publica em dados abertos o voto de cada deputado nas votações nominais feitas no painel eletrônico, além de projetos e leis."],
  ["pr", "Paraná", "do Paraná", "ALEP", "https://www.assembleia.pr.leg.br/", "O voto de cada deputado fica num sistema que o próprio site fecha à coleta automática; os dados abertos trazem o resultado de cada votação, os projetos e as leis."],
  ["pe", "Pernambuco", "de Pernambuco", "ALEPE", "https://www.alepe.pe.gov.br/", "A Assembleia publica o resultado de cada discussão; o voto nominal, quando há, aparece só na ata do Diário do Legislativo."],
  ["pi", "Piauí", "do Piauí", "ALEPI", "https://www.al.pi.leg.br/", "A Assembleia publica em dados abertos o voto de cada deputado nas votações nominais feitas no painel eletrônico; as demais têm apenas o resultado."],
  ["rj", "Rio de Janeiro", "do Rio de Janeiro", "ALERJ", "https://www.alerj.rj.gov.br/", "Não foi localizada lista nominal de votos publicada; as notas taquigráficas trazem só o placar."],
  ["rn", "Rio Grande do Norte", "do Rio Grande do Norte", "ALRN", "https://www.al.rn.leg.br/", "A Assembleia publica em dados abertos o voto de cada deputado, no Plenário e nas comissões."],
  ["rs", "Rio Grande do Sul", "do Rio Grande do Sul", "ALRS", "https://ww4.al.rs.gov.br/", "A Assembleia publica o voto de cada deputado, com o partido, no Plenário e nas comissões."],
  ["ro", "Rondônia", "de Rondônia", "ALE-RO", "https://www.al.ro.leg.br/", "A Assembleia publica em dados abertos o voto de cada deputado em parte das votações do Plenário, além de projetos e leis."],
  ["rr", "Roraima", "de Roraima", "ALE-RR", "https://al.rr.leg.br/", "O sistema legislativo da Assembleia não registra votos individuais; o resultado aparece nas atas."],
  ["sc", "Santa Catarina", "de Santa Catarina", "ALESC", "https://www.alesc.sc.gov.br/", "A Assembleia publica o extrato das votações nominais (nome e voto, sem partido); a maior parte das votações é simbólica."],
  ["sp", "São Paulo", "de São Paulo", "ALESP", "https://www.al.sp.gov.br/", "A Assembleia publica o voto de cada deputado quando há verificação de votação no Plenário e o voto de cada membro nas comissões."],
  ["se", "Sergipe", "de Sergipe", "Alese", "https://al.se.leg.br/", "A Assembleia não publica o voto de cada deputado; o resultado aparece no texto da tramitação. Proposições e normas estão em dados abertos."],
  ["to", "Tocantins", "do Tocantins", "AL-TO", "https://www.al.to.leg.br/", "O sistema legislativo da Assembleia não registra votos individuais nas sessões recentes. Projetos e leis estão em dados abertos."],
];

export const UFS: UfInfo[] = L.map(([uf, nome, de, sigla, portal, sabido]) => ({
  uf,
  sigla: uf.toUpperCase(),
  nome,
  de,
  casa: {
    sigla,
    nome: uf === "df" ? `Câmara Legislativa do Distrito Federal (${sigla})` : `Assembleia Legislativa do Estado ${de} (${sigla})`,
    portal,
  },
  membros: uf === "df" ? "deputados distritais" : "deputados estaduais",
  chefe: "governador",
  sabido,
}));

const POR_UF = new Map(UFS.map((u) => [u.uf, u]));

/** UF pelo código (aceita maiúsculas); null se não existir. */
export function getUf(uf: string | null | undefined): UfInfo | null {
  return POR_UF.get(String(uf ?? "").toLowerCase()) ?? null;
}

/** Endereço base da seção de uma UF. */
export function baseUf(uf: string): string {
  return `/estados/${uf.toLowerCase()}`;
}

/** "Estado de São Paulo" / "Distrito Federal". */
export function nomeCompleto(u: UfInfo): string {
  return u.uf === "df" ? "Distrito Federal" : `Estado ${u.de}`;
}

/** "Governador do Estado de São Paulo" / "Governador do Distrito Federal". */
export function nomeGoverno(u: UfInfo): string {
  return u.uf === "df" ? "Governador do Distrito Federal" : `Governador do Estado ${u.de}`;
}

/** Caminho para os selos do Cartão de Decisão (SP usa os caminhos já conhecidos). */
export function caminhoCasa(u: UfInfo): { caminho: string; rotulo: string } {
  return u.uf === "sp" ? { caminho: "alesp", rotulo: "ALESP" } : { caminho: u.casa.nome, rotulo: u.casa.sigla };
}

export function caminhoGoverno(u: UfInfo): { caminho: string; rotulo: string } {
  return u.uf === "sp" ? { caminho: "governador-sp", rotulo: "Governo de SP" } : { caminho: nomeGoverno(u), rotulo: `Governo ${u.uf === "df" ? "do DF" : `de ${u.sigla}`}` };
}
