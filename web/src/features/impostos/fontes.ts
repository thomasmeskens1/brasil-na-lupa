/**
 * Fontes oficiais da seção Impostos, com a data em que cada uma foi consultada (diretriz 2).
 * Registro completo, com os dispositivos conferidos: docs/pesquisa/impostos-educativo.md.
 */

export type TipoFonteImposto = "oficial" | "pdf" | "noticia";

export interface FonteImposto {
  rotulo: string;
  /** Quem publica (ex.: "Planalto", "Receita Federal"). */
  orgao: string;
  url: string;
  tipo: TipoFonteImposto;
  /** Data da consulta (AAAA-MM-DD). */
  consultado: string;
}

export const DATA_CONSULTA = "2026-11-03";

const f = (rotulo: string, orgao: string, url: string, tipo: TipoFonteImposto = "oficial"): FonteImposto => ({
  rotulo,
  orgao,
  url,
  tipo,
  consultado: DATA_CONSULTA,
});

export const FONTES = {
  cf: f("Constituição Federal, artigos 153 a 156 e 195", "Planalto", "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm"),
  ec132: f(
    "Emenda Constitucional nº 132, de 20 de dezembro de 2023 (Reforma Tributária)",
    "Planalto",
    "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm",
  ),
  lc214: f(
    "Lei Complementar nº 214, de 16 de janeiro de 2025 (texto compilado)",
    "Planalto",
    "https://www.planalto.gov.br/ccivil_03/leis/lcp/Lcp214compilado.htm",
  ),
  lc227: f(
    "Lei Complementar nº 227, de 13 de janeiro de 2026 (Comitê Gestor do IBS e normas gerais do ITCMD)",
    "Planalto",
    "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp227.htm",
  ),
  lc116: f(
    "Lei Complementar nº 116, de 31 de julho de 2003 (ISS)",
    "Planalto",
    "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm",
  ),
  l10637: f("Lei nº 10.637, de 30 de dezembro de 2002 (PIS/Pasep)", "Planalto", "https://www.planalto.gov.br/ccivil_03/leis/2002/l10637.htm"),
  l10833: f("Lei nº 10.833, de 29 de dezembro de 2003 (Cofins)", "Planalto", "https://www.planalto.gov.br/ccivil_03/leis/2003/l10.833.htm"),
  tipi: f(
    "Decreto nº 11.158, de 29 de julho de 2022 (Tabela de Incidência do IPI)",
    "Planalto",
    "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/d11158.htm",
  ),
  l15270: f(
    "Lei nº 15.270, de 26 de novembro de 2025 (redução do Imposto de Renda)",
    "Planalto",
    "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15270.htm",
  ),
  tabelasIr: f(
    "Tabelas do Imposto de Renda da Pessoa Física 2026",
    "Receita Federal",
    "https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026",
  ),
  rsf9: f(
    "Resolução do Senado Federal nº 9, de 5 de maio de 1992 (alíquota máxima do ITCMD)",
    "Senado Federal",
    "https://legis.senado.leg.br/norma/590017",
  ),
  receitaEntenda: f(
    "Entenda a Reforma Tributária do Consumo",
    "Receita Federal",
    "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/entenda",
  ),
  tcuCbs: f(
    "TCU calcula alíquota de referência de 11,3% para novo tributo sobre consumo (28/10/2026)",
    "Tribunal de Contas da União",
    "https://portal.tcu.gov.br/imprensa/noticias/tcu-calcula-aliquota-de-referencia-de-113-para-novo-tributo-sobre-consumo",
  ),
  senadoCbs: f(
    "Senado deve receber cálculo da CBS na próxima terça para definir alíquota (3/11/2026)",
    "Agência Senado",
    "https://www12.senado.leg.br/noticias/materias/2026/11/03/senado-deve-receber-calculo-da-cbs-na-proxima-terca-para-definir-aliquota",
    "noticia",
  ),
  camaraIs: f(
    "Contribuição sobre Bens e Serviços entra em vigor em 2027 e novas regulamentações serão enviadas ao Congresso (22/10/2026)",
    "Agência Câmara",
    "https://www.camara.leg.br/noticias/1313045-contribuicao-sobre-bens-e-servicos-entra-em-vigor-em-2027-e-novas-regulamentacoes-serao-enviadas-ao-congresso",
    "noticia",
  ),
  em38: f(
    "Exposição de Motivos nº 38/2024 do Ministério da Fazenda (Projeto de Lei Complementar nº 68/2024)",
    "Planalto",
    "https://www.planalto.gov.br/CCIVIL_03/Projetos/Ato_2023_2026/2024/PLP/exm/Exm-038-24-MF.doc",
  ),
  plp68: f(
    "Projeto de Lei Complementar nº 68/2024: tramitação",
    "Câmara dos Deputados",
    "https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=2430143",
  ),
  plp108: f(
    "Projeto de Lei Complementar nº 108/2024: tramitação",
    "Câmara dos Deputados",
    "https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=2438459",
  ),
  pl1087: f(
    "Projeto de Lei nº 1.087/2025: tramitação",
    "Câmara dos Deputados",
    "https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=2487436",
  ),
  pec45: f(
    "Proposta de Emenda à Constituição nº 45/2019: tramitação",
    "Câmara dos Deputados",
    "https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=2196833",
  ),
  pec45Texto: f(
    "Proposta de Emenda à Constituição nº 45/2019: texto original com a justificação do autor",
    "Câmara dos Deputados",
    "https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=1728369",
    "pdf",
  ),
  pec45Parecer: f(
    "Parecer do relator na Comissão de Constituição e Justiça e de Cidadania (2019)",
    "Câmara dos Deputados",
    "https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=1747193",
    "pdf",
  ),
  pec45Vs: f(
    "Voto em separado na Comissão de Constituição e Justiça e de Cidadania (15/5/2019)",
    "Câmara dos Deputados",
    "https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=1748156",
    "pdf",
  ),
} satisfies Record<string, FonteImposto>;

/** Nome curto da fonte, para listas com muitas referências (linha do tempo, mudanças). */
export const CURTO: Partial<Record<keyof typeof FONTES, string>> = {
  cf: "Constituição Federal",
  ec132: "Emenda Constitucional nº 132/2023",
  lc214: "Lei Complementar nº 214/2025",
  lc227: "Lei Complementar nº 227/2026",
  lc116: "Lei Complementar nº 116/2003",
  l15270: "Lei nº 15.270/2025",
  tabelasIr: "Receita Federal: tabelas 2026",
  receitaEntenda: "Receita Federal: Entenda a Reforma",
  tcuCbs: "Tribunal de Contas da União, 28/10/2026",
  senadoCbs: "Agência Senado, 3/11/2026",
  camaraIs: "Agência Câmara, 22/10/2026",
};

/** "2026-11-03" → "3/11/2026". */
export function dataCurta(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return `${d}/${m}/${a}`;
}
