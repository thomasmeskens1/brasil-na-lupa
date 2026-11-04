/**
 * Dicionário único de siglas do site (diretrizes 9 e 15). Cada sigla tem o nome por extenso e a
 * fonte oficial que a define ou que a usa como nome oficial. É a mesma fonte de verdade para a
 * tela (<TextoComSiglas>, <abbr>) e para a leitura em voz alta (components/ouvir/normalizar.ts,
 * que monta SIGLAS e SIGLAS_NORMA a partir daqui). Funções puras, sem DOM.
 *
 *   SIGLA_POR_CHAVE.get("ADI")?.nome   // "Ação Direta de Inconstitucionalidade"
 *
 * Campos:
 * - `soComNumero`: siglas ambíguas fora de contexto ("PL" também é partido, "MP" também é
 *   Ministério Público, "RE" pode ser "ré" sem acento em texto em maiúsculas). Só são marcadas na
 *   tela quando vêm seguidas de número ("PL 1234/2025", "RE nº 574.706").
 * - `voz`: "sempre" = a voz diz o nome por extenso na primeira ocorrência; "com-numero" = só
 *   quando vem com número (tipos de norma e de processo); ausente = a voz lê a sigla como está.
 *
 * Siglas com mais de um sentido no próprio site (ex.: "PLC", que é Projeto de Lei Complementar
 * nas Assembleias e Projeto de Lei da Câmara no Senado; "PR", que é Projeto de Resolução e
 * Paraná) ficam de fora: nenhum nome é adivinhado.
 */
import { UFS } from "../../features/estados/ufs";

export type TipoSigla = "orgao" | "tribunal" | "proposicao" | "norma" | "classe" | "tributo" | "regimento" | "outro";

export interface FonteSigla {
  nome: string;
  url: string;
}

export interface Sigla {
  sigla: string;
  nome: string;
  tipo: TipoSigla;
  fonte: FonteSigla;
  soComNumero?: boolean;
  voz?: "sempre" | "com-numero";
}

// Fontes usadas por várias siglas.
const CAMARA_TIPOS: FonteSigla = {
  nome: "Câmara dos Deputados — Dados Abertos, tabela de tipos de proposição (siglaTipo)",
  url: "https://dadosabertos.camara.leg.br/api/v2/referencias/proposicoes/siglaTipo",
};
const SENADO_SIGLAS: FonteSigla = {
  nome: "Senado Federal — Dados Abertos, lista de siglas de matérias",
  url: "https://legis.senado.leg.br/dadosabertos/dados/ListaSiglas.json",
};
const CF: FonteSigla = {
  nome: "Constituição da República Federativa do Brasil de 1988",
  url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
};
const CNJ_CLASSES: FonteSigla = {
  nome: "Conselho Nacional de Justiça — Tabelas Processuais Unificadas (classes)",
  url: "https://www.cnj.jus.br/sgt/consulta_publica_classes.php",
};
const CPC_FONTE: FonteSigla = {
  nome: "Código de Processo Civil (Lei nº 13.105/2015), arts. 1.029 a 1.042",
  url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
};
const LC214: FonteSigla = {
  nome: "Lei Complementar nº 214/2025 (institui o IBS e a CBS)",
  url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm",
};
const CONFAZ_FONTE: FonteSigla = { nome: "Conselho Nacional de Política Fazendária (CONFAZ)", url: "https://www.confaz.fazenda.gov.br/" };

const BASE: Sigla[] = [
  // Tipos de proposição (Câmara, Senado, Congresso)
  { sigla: "PL", nome: "Projeto de Lei", tipo: "proposicao", fonte: CAMARA_TIPOS, soComNumero: true, voz: "com-numero" },
  { sigla: "PLP", nome: "Projeto de Lei Complementar", tipo: "proposicao", fonte: CAMARA_TIPOS, voz: "com-numero" },
  { sigla: "PLN", nome: "Projeto de Lei do Congresso Nacional", tipo: "proposicao", fonte: CAMARA_TIPOS, voz: "com-numero" },
  { sigla: "PLV", nome: "Projeto de Lei de Conversão", tipo: "proposicao", fonte: CAMARA_TIPOS, voz: "com-numero" },
  { sigla: "PEC", nome: "Proposta de Emenda à Constituição", tipo: "proposicao", fonte: CAMARA_TIPOS, voz: "com-numero" },
  { sigla: "PDL", nome: "Projeto de Decreto Legislativo", tipo: "proposicao", fonte: CAMARA_TIPOS, voz: "com-numero" },
  { sigla: "PDC", nome: "Projeto de Decreto Legislativo", tipo: "proposicao", fonte: CAMARA_TIPOS, soComNumero: true, voz: "com-numero" },
  { sigla: "PRC", nome: "Projeto de Resolução", tipo: "proposicao", fonte: CAMARA_TIPOS, voz: "com-numero" },
  { sigla: "MPV", nome: "Medida Provisória", tipo: "proposicao", fonte: CAMARA_TIPOS, voz: "com-numero" },
  { sigla: "MP", nome: "Medida Provisória", tipo: "proposicao", fonte: CAMARA_TIPOS, soComNumero: true, voz: "com-numero" },
  { sigla: "REQ", nome: "Requerimento", tipo: "proposicao", fonte: CAMARA_TIPOS, voz: "com-numero" },
  { sigla: "RIC", nome: "Requerimento de Informação", tipo: "proposicao", fonte: CAMARA_TIPOS },
  { sigla: "MSC", nome: "Mensagem", tipo: "proposicao", fonte: CAMARA_TIPOS },
  { sigla: "VET", nome: "Veto", tipo: "proposicao", fonte: SENADO_SIGLAS, voz: "com-numero" },
  { sigla: "RQS", nome: "Requerimento (Senado Federal)", tipo: "proposicao", fonte: SENADO_SIGLAS },
  { sigla: "PLS", nome: "Projeto de Lei do Senado", tipo: "proposicao", fonte: SENADO_SIGLAS },
  { sigla: "PRS", nome: "Projeto de Resolução do Senado", tipo: "proposicao", fonte: SENADO_SIGLAS },
  { sigla: "PDS", nome: "Projeto de Decreto Legislativo do Senado", tipo: "proposicao", fonte: SENADO_SIGLAS },
  { sigla: "MSF", nome: "Mensagem (Senado Federal)", tipo: "proposicao", fonte: SENADO_SIGLAS },

  // Normas
  { sigla: "CF", nome: "Constituição Federal", tipo: "norma", fonte: CF },
  { sigla: "ADCT", nome: "Ato das Disposições Constitucionais Transitórias", tipo: "norma", fonte: CF },
  { sigla: "LC", nome: "Lei Complementar", tipo: "norma", fonte: { nome: "Presidência da República — Leis Complementares", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/quadro_lcp.htm" }, voz: "com-numero" },
  { sigla: "EC", nome: "Emenda Constitucional", tipo: "norma", fonte: { nome: "Presidência da República — Emendas Constitucionais", url: "https://www.planalto.gov.br/ccivil_03/constituicao/quadro_emc.htm" }, soComNumero: true, voz: "com-numero" },
  { sigla: "LAI", nome: "Lei de Acesso à Informação", tipo: "norma", fonte: { nome: "Lei nº 12.527/2011", url: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm" }, voz: "sempre" },
  { sigla: "LRF", nome: "Lei de Responsabilidade Fiscal", tipo: "norma", fonte: { nome: "Lei Complementar nº 101/2000", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm" }, voz: "sempre" },
  { sigla: "CPC", nome: "Código de Processo Civil", tipo: "norma", fonte: { nome: "Lei nº 13.105/2015", url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm" }, voz: "sempre" },
  { sigla: "CTN", nome: "Código Tributário Nacional", tipo: "norma", fonte: { nome: "Lei nº 5.172/1966", url: "https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm" }, voz: "sempre" },
  { sigla: "CLT", nome: "Consolidação das Leis do Trabalho", tipo: "norma", fonte: { nome: "Decreto-Lei nº 5.452/1943", url: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm" }, voz: "sempre" },
  { sigla: "PPA", nome: "Plano Plurianual", tipo: "norma", fonte: { nome: "Constituição Federal, art. 165", url: CF.url }, voz: "sempre" },
  { sigla: "LDO", nome: "Lei de Diretrizes Orçamentárias", tipo: "norma", fonte: { nome: "Constituição Federal, art. 165", url: CF.url }, voz: "sempre" },
  { sigla: "LOA", nome: "Lei Orçamentária Anual", tipo: "norma", fonte: { nome: "Constituição Federal, art. 165", url: CF.url }, voz: "sempre" },
  { sigla: "RICMS", nome: "Regulamento do ICMS", tipo: "norma", fonte: { nome: "Secretaria da Fazenda e Planejamento de São Paulo — RICMS/SP (Decreto nº 45.490/2000)", url: "https://legislacao.fazenda.sp.gov.br/Paginas/dec45490.aspx" }, voz: "sempre" },

  // Regimentos
  { sigla: "RICD", nome: "Regimento Interno da Câmara dos Deputados", tipo: "regimento", fonte: { nome: "Câmara dos Deputados — Regimento Interno (Resolução nº 17/1989)", url: "https://www2.camara.leg.br/atividade-legislativa/legislacao/regimento-interno-da-camara-dos-deputados" }, voz: "sempre" },
  { sigla: "RISF", nome: "Regimento Interno do Senado Federal", tipo: "regimento", fonte: { nome: "Senado Federal — Regimento Interno", url: "https://www25.senado.leg.br/web/atividade/regimento-interno" }, voz: "sempre" },

  // Classes processuais
  { sigla: "ADI", nome: "Ação Direta de Inconstitucionalidade", tipo: "classe", fonte: { nome: "Lei nº 9.868/1999", url: "https://www.planalto.gov.br/ccivil_03/leis/l9868.htm" }, voz: "com-numero" },
  { sigla: "ADC", nome: "Ação Declaratória de Constitucionalidade", tipo: "classe", fonte: { nome: "Lei nº 9.868/1999", url: "https://www.planalto.gov.br/ccivil_03/leis/l9868.htm" }, voz: "com-numero" },
  { sigla: "ADO", nome: "Ação Direta de Inconstitucionalidade por Omissão", tipo: "classe", fonte: { nome: "Lei nº 9.868/1999 (Capítulo II-A)", url: "https://www.planalto.gov.br/ccivil_03/leis/l9868.htm" }, voz: "com-numero" },
  { sigla: "ADPF", nome: "Arguição de Descumprimento de Preceito Fundamental", tipo: "classe", fonte: { nome: "Lei nº 9.882/1999", url: "https://www.planalto.gov.br/ccivil_03/leis/l9882.htm" }, voz: "com-numero" },
  { sigla: "RE", nome: "Recurso Extraordinário", tipo: "classe", fonte: CPC_FONTE, soComNumero: true, voz: "com-numero" },
  { sigla: "REsp", nome: "Recurso Especial", tipo: "classe", fonte: CPC_FONTE, voz: "com-numero" },
  { sigla: "ARE", nome: "Recurso Extraordinário com Agravo", tipo: "classe", fonte: CNJ_CLASSES, voz: "com-numero" },
  { sigla: "AREsp", nome: "Agravo em Recurso Especial", tipo: "classe", fonte: CNJ_CLASSES, voz: "com-numero" },
  { sigla: "HC", nome: "Habeas Corpus", tipo: "classe", fonte: CNJ_CLASSES, soComNumero: true },
  { sigla: "MS", nome: "Mandado de Segurança", tipo: "classe", fonte: CNJ_CLASSES, soComNumero: true },
  { sigla: "Rcl", nome: "Reclamação", tipo: "classe", fonte: CNJ_CLASSES, voz: "com-numero" },

  // Tribunais e órgãos federais
  { sigla: "STF", nome: "Supremo Tribunal Federal", tipo: "tribunal", fonte: { nome: "Supremo Tribunal Federal", url: "https://portal.stf.jus.br/" }, voz: "sempre" },
  { sigla: "STJ", nome: "Superior Tribunal de Justiça", tipo: "tribunal", fonte: { nome: "Superior Tribunal de Justiça", url: "https://www.stj.jus.br/" }, voz: "sempre" },
  { sigla: "TST", nome: "Tribunal Superior do Trabalho", tipo: "tribunal", fonte: { nome: "Tribunal Superior do Trabalho", url: "https://www.tst.jus.br/" }, voz: "sempre" },
  { sigla: "TSE", nome: "Tribunal Superior Eleitoral", tipo: "tribunal", fonte: { nome: "Tribunal Superior Eleitoral", url: "https://www.tse.jus.br/" }, voz: "sempre" },
  { sigla: "CNJ", nome: "Conselho Nacional de Justiça", tipo: "orgao", fonte: { nome: "Conselho Nacional de Justiça", url: "https://www.cnj.jus.br/" }, voz: "sempre" },
  { sigla: "TCU", nome: "Tribunal de Contas da União", tipo: "tribunal", fonte: { nome: "Tribunal de Contas da União", url: "https://portal.tcu.gov.br/" }, voz: "sempre" },
  { sigla: "TCE", nome: "Tribunal de Contas do Estado", tipo: "tribunal", fonte: { nome: "Constituição Federal, art. 75", url: CF.url }, voz: "sempre" },
  { sigla: "CGU", nome: "Controladoria-Geral da União", tipo: "orgao", fonte: { nome: "Controladoria-Geral da União", url: "https://www.gov.br/cgu/" }, voz: "sempre" },
  { sigla: "AGU", nome: "Advocacia-Geral da União", tipo: "orgao", fonte: { nome: "Advocacia-Geral da União", url: "https://www.gov.br/agu/" }, voz: "sempre" },
  { sigla: "PGR", nome: "Procuradoria-Geral da República", tipo: "orgao", fonte: { nome: "Ministério Público Federal", url: "https://www.mpf.mp.br/" }, voz: "sempre" },
  { sigla: "MPF", nome: "Ministério Público Federal", tipo: "orgao", fonte: { nome: "Ministério Público Federal", url: "https://www.mpf.mp.br/" }, voz: "sempre" },
  { sigla: "CMO", nome: "Comissão Mista de Planos, Orçamentos Públicos e Fiscalização", tipo: "orgao", fonte: { nome: "Congresso Nacional — CMO", url: "https://www.congressonacional.leg.br/web/cmo" }, voz: "sempre" },
  { sigla: "CONFAZ", nome: "Conselho Nacional de Política Fazendária", tipo: "orgao", fonte: CONFAZ_FONTE, voz: "sempre" },
  { sigla: "SINIEF", nome: "Sistema Nacional Integrado de Informações Econômico-Fiscais", tipo: "outro", fonte: CONFAZ_FONTE },
  { sigla: "CFOP", nome: "Código Fiscal de Operações e Prestações", tipo: "outro", fonte: CONFAZ_FONTE },
  { sigla: "IBGE", nome: "Instituto Brasileiro de Geografia e Estatística", tipo: "orgao", fonte: { nome: "Instituto Brasileiro de Geografia e Estatística", url: "https://www.ibge.gov.br/" }, voz: "sempre" },
  { sigla: "CNAE", nome: "Classificação Nacional de Atividades Econômicas", tipo: "outro", fonte: { nome: "IBGE — Comissão Nacional de Classificação (CONCLA)", url: "https://concla.ibge.gov.br/" }, voz: "sempre" },
  { sigla: "DOU", nome: "Diário Oficial da União", tipo: "outro", fonte: { nome: "Imprensa Nacional", url: "https://www.in.gov.br/" }, voz: "sempre" },
  { sigla: "SUS", nome: "Sistema Único de Saúde", tipo: "outro", fonte: { nome: "Lei nº 8.080/1990", url: "https://www.planalto.gov.br/ccivil_03/leis/l8080.htm" }, voz: "sempre" },
  { sigla: "FGTS", nome: "Fundo de Garantia do Tempo de Serviço", tipo: "outro", fonte: { nome: "Lei nº 8.036/1990", url: "https://www.planalto.gov.br/ccivil_03/leis/l8036consol.htm" }, voz: "sempre" },
  { sigla: "CEAP", nome: "Cota para o Exercício da Atividade Parlamentar", tipo: "outro", fonte: { nome: "Câmara dos Deputados — Dados Abertos (despesas da CEAP)", url: "https://dadosabertos.camara.leg.br/" }, voz: "sempre" },
  { sigla: "UF", nome: "unidade da federação", tipo: "outro", fonte: { nome: "Instituto Brasileiro de Geografia e Estatística", url: "https://www.ibge.gov.br/" }, voz: "sempre" },

  // Tributos
  { sigla: "ICMS", nome: "Imposto sobre Operações relativas à Circulação de Mercadorias e sobre Prestações de Serviços de Transporte Interestadual e Intermunicipal e de Comunicação", tipo: "tributo", fonte: { nome: "Lei Complementar nº 87/1996", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp87.htm" } },
  { sigla: "IPI", nome: "Imposto sobre Produtos Industrializados", tipo: "tributo", fonte: { nome: "Regulamento do IPI (Decreto nº 7.212/2010)", url: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/decreto/d7212.htm" } },
  { sigla: "ISS", nome: "Imposto sobre Serviços de Qualquer Natureza", tipo: "tributo", fonte: { nome: "Lei Complementar nº 116/2003", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm" } },
  { sigla: "IBS", nome: "Imposto sobre Bens e Serviços", tipo: "tributo", fonte: LC214, voz: "sempre" },
  { sigla: "CBS", nome: "Contribuição sobre Bens e Serviços", tipo: "tributo", fonte: LC214, voz: "sempre" },
  { sigla: "IPVA", nome: "Imposto sobre a Propriedade de Veículos Automotores", tipo: "tributo", fonte: { nome: "Constituição Federal, art. 155, III", url: CF.url } },
  { sigla: "IPTU", nome: "Imposto sobre a Propriedade Predial e Territorial Urbana", tipo: "tributo", fonte: { nome: "Constituição Federal, art. 156, I", url: CF.url } },
  { sigla: "ITBI", nome: "Imposto sobre a Transmissão de Bens Imóveis", tipo: "tributo", fonte: { nome: "Constituição Federal, art. 156, II", url: CF.url } },
  { sigla: "ITCMD", nome: "Imposto sobre Transmissão Causa Mortis e Doação", tipo: "tributo", fonte: { nome: "Constituição Federal, art. 155, I", url: CF.url } },
  { sigla: "IRPJ", nome: "Imposto sobre a Renda das Pessoas Jurídicas", tipo: "tributo", fonte: { nome: "Receita Federal", url: "https://www.gov.br/receitafederal/" } },
  { sigla: "CSLL", nome: "Contribuição Social sobre o Lucro Líquido", tipo: "tributo", fonte: { nome: "Lei nº 7.689/1988", url: "https://www.planalto.gov.br/ccivil_03/leis/l7689.htm" } },
  { sigla: "COFINS", nome: "Contribuição para o Financiamento da Seguridade Social", tipo: "tributo", fonte: { nome: "Lei Complementar nº 70/1991", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp70.htm" } },
  { sigla: "PIS", nome: "Programa de Integração Social", tipo: "tributo", fonte: { nome: "Lei Complementar nº 7/1970", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp07.htm" } },

  // São Paulo e Atibaia
  { sigla: "SEFAZ", nome: "Secretaria da Fazenda", tipo: "orgao", fonte: CONFAZ_FONTE, voz: "sempre" },
  { sigla: "SEFAZ-SP", nome: "Secretaria da Fazenda e Planejamento de São Paulo", tipo: "orgao", fonte: { nome: "Secretaria da Fazenda e Planejamento do Estado de São Paulo", url: "https://portal.fazenda.sp.gov.br/" }, voz: "sempre" },
  { sigla: "SAAE", nome: "Saneamento Ambiental de Atibaia", tipo: "orgao", fonte: { nome: "Imprensa Oficial de Atibaia (atos que citam \"SAAE - Saneamento Ambiental de Atibaia\"; regulamento: Decreto nº 4.398)", url: "https://prefeitura.atibaia.sp.gov.br/imprensa" }, voz: "sempre" },
];

/** Tribunais de contas estaduais e municipais (registro de dados/tribunais-contas/orgaos.json). */
const TRIBUNAIS_CONTAS: [string, string, string][] = [
  ["TCE-SP", "Tribunal de Contas do Estado de São Paulo", "https://www.tce.sp.gov.br/"],
  ["TCE-AC", "Tribunal de Contas do Estado do Acre", "https://tceac.tc.br/site/"],
  ["TCE-AL", "Tribunal de Contas do Estado de Alagoas", "https://www.tceal.tc.br/"],
  ["TCE-AP", "Tribunal de Contas do Estado do Amapá", "https://www.tce.ap.gov.br/"],
  ["TCE-AM", "Tribunal de Contas do Estado do Amazonas", "https://www.tceam.tc.br/"],
  ["TCE-BA", "Tribunal de Contas do Estado da Bahia", "https://www.tce.ba.gov.br/"],
  ["TCE-CE", "Tribunal de Contas do Estado do Ceará", "https://www.tce.ce.gov.br/"],
  ["TCDF", "Tribunal de Contas do Distrito Federal", "https://www2.tc.df.gov.br/"],
  ["TCE-ES", "Tribunal de Contas do Estado do Espírito Santo", "https://www.tcees.tc.br/"],
  ["TCE-GO", "Tribunal de Contas do Estado de Goiás", "https://portal.tce.go.gov.br/"],
  ["TCE-MA", "Tribunal de Contas do Estado do Maranhão", "https://www.tcema.tc.br/"],
  ["TCE-MT", "Tribunal de Contas do Estado de Mato Grosso", "https://www.tce.mt.gov.br/"],
  ["TCE-MS", "Tribunal de Contas do Estado de Mato Grosso do Sul", "https://www.tce.ms.gov.br/"],
  ["TCE-MG", "Tribunal de Contas do Estado de Minas Gerais", "https://www.tce.mg.gov.br/"],
  ["TCE-PA", "Tribunal de Contas do Estado do Pará", "https://www.tcepa.tc.br/"],
  ["TCE-PB", "Tribunal de Contas do Estado da Paraíba", "https://tce.pb.gov.br/"],
  ["TCE-PR", "Tribunal de Contas do Estado do Paraná", "https://www1.tce.pr.gov.br/"],
  ["TCE-PE", "Tribunal de Contas do Estado de Pernambuco", "https://www.tce.pe.gov.br/internet/"],
  ["TCE-PI", "Tribunal de Contas do Estado do Piauí", "https://www.tcepi.tc.br/"],
  ["TCE-RJ", "Tribunal de Contas do Estado do Rio de Janeiro", "https://www.tcerj.tc.br/portalnovo/"],
  ["TCE-RN", "Tribunal de Contas do Estado do Rio Grande do Norte", "https://www.tce.rn.gov.br/"],
  ["TCE-RS", "Tribunal de Contas do Estado do Rio Grande do Sul", "https://tcers.tc.br/"],
  ["TCE-RO", "Tribunal de Contas do Estado de Rondônia", "https://tcero.tc.br/"],
  ["TCE-RR", "Tribunal de Contas do Estado de Roraima", "https://www.tcerr.tc.br/"],
  ["TCE-SC", "Tribunal de Contas de Santa Catarina", "https://www.tcesc.tc.br/"],
  ["TCE-SE", "Tribunal de Contas do Estado de Sergipe", "https://www.tce.se.gov.br/"],
  ["TCE-TO", "Tribunal de Contas do Estado do Tocantins", "https://www.tceto.tc.br/"],
  ["TCM-SP", "Tribunal de Contas do Município de São Paulo", "https://portal.tcm.sp.gov.br/"],
  ["TCM-RJ", "Tribunal de Contas do Município do Rio de Janeiro", "https://www.tcmrio.tc.br/"],
  ["TCM-BA", "Tribunal de Contas dos Municípios do Estado da Bahia", "https://www.tcm.ba.gov.br/"],
  ["TCM-GO", "Tribunal de Contas dos Municípios do Estado de Goiás", "https://www.tcmgo.tc.br/"],
  ["TCM-PA", "Tribunal de Contas dos Municípios do Estado do Pará", "https://www.tcmpa.tc.br/"],
];

/** Assembleias Legislativas e a Câmara Legislativa do DF (features/estados/ufs.ts, com o portal oficial). */
const CASAS_ESTADUAIS: Sigla[] = UFS.map((u) => ({
  sigla: u.casa.sigla,
  nome: u.casa.nome.replace(/\s*\([^()]*\)\s*$/, ""),
  tipo: "orgao" as const,
  fonte: { nome: u.casa.nome.replace(/\s*\([^()]*\)\s*$/, ""), url: u.casa.portal },
  voz: "sempre" as const,
}));

export const SIGLAS_OFICIAIS: readonly Sigla[] = [
  ...BASE,
  ...TRIBUNAIS_CONTAS.map(([sigla, nome, url]): Sigla => ({ sigla, nome, tipo: "tribunal", fonte: { nome, url }, voz: "sempre" })),
  ...CASAS_ESTADUAIS.filter((c) => !BASE.some((b) => b.sigla === c.sigla)),
];

/** Sigla exata (com maiúsculas e minúsculas como na fonte: "REsp", "Rcl", "Alese") → entrada. */
export const SIGLA_POR_CHAVE: ReadonlyMap<string, Sigla> = new Map(SIGLAS_OFICIAIS.map((s) => [s.sigla, s]));

/** Nome por extenso de uma sigla conhecida, ou null. */
export function nomeDaSigla(sigla: string): string | null {
  return SIGLA_POR_CHAVE.get(sigla)?.nome ?? null;
}
