/** Rótulos e termos da seção Justiça (funções puras, seguras no navegador). */

export const COLECOES: Record<string, { titulo: string; explicacao: string }> = {
  icms: {
    titulo: "ICMS",
    explicacao:
      "Temas em que a questão ou a tese menciona o Imposto sobre Circulação de Mercadorias e Serviços (ICMS), conforme o texto oficial.",
  },
  "icms-processual": {
    titulo: "ICMS: temas processuais relacionados",
    explicacao:
      "Temas que o STJ classifica com o assunto ICMS, mas cuja questão trata de regras de processo (como honorários, prazos e execução fiscal) sem mencionar o ICMS. Veja a questão de cada um para saber do que trata.",
  },
};

export const ORGAO_STJ: Record<string, string> = {
  S1: "Primeira Seção",
  S2: "Segunda Seção",
  S3: "Terceira Seção",
  CE: "Corte Especial",
};

const ETAPA: Record<string, string> = {
  afetacao: "Afetação ao rito dos repetitivos",
  merito: "Julgamento do mérito",
  preliminar: "Questão preliminar",
  embargos: "Embargos de declaração",
  tese: "Tese",
  modulacao: "Modulação dos efeitos",
};

export function rotuloEtapa(e: string | null | undefined): string {
  if (!e) return "Etapa não informada";
  return ETAPA[e] ?? e.charAt(0).toUpperCase() + e.slice(1);
}

export function rotuloResultadoJulgamento(r: string | null | undefined): string | null {
  if (r === "unanimidade") return "Por unanimidade";
  if (r === "maioria") return "Por maioria";
  return null;
}

/** Nome de órgão julgador em maiúsculas na fonte ("PRIMEIRA SEÇÃO") com grafia legível. */
export function rotuloOrgao(o: string | null | undefined): string {
  if (!o) return "Órgão julgador não informado";
  if (o !== o.toUpperCase()) return o;
  return o
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_m, s: string, l: string) => s + l.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (x) => x.toLowerCase());
}

export const TERMOS_JUSTICA = {
  stj: {
    termo: "Superior Tribunal de Justiça (STJ)",
    explicacao: "Tribunal que uniformiza a interpretação das leis federais em todo o país.",
  },
  stf: {
    termo: "Supremo Tribunal Federal (STF)",
    explicacao: "Tribunal que tem a função de guardar a Constituição Federal (artigo 102 da Constituição).",
  },
  repetitivo: {
    termo: "Recurso repetitivo (tema repetitivo)",
    explicacao:
      "Quando muitos processos discutem a mesma questão de lei federal, o Superior Tribunal de Justiça (STJ) escolhe alguns para julgar e fixa uma tese que os demais tribunais devem seguir. Cada questão recebe um número de tema.",
  },
  relevancia: {
    termo: "Tema de relevância",
    explicacao:
      "Questão de lei federal que o STJ reconheceu como relevante, requisito para o recurso especial criado pela Emenda Constitucional 125, de 2022.",
  },
  tese: {
    termo: "Tese",
    explicacao: "Enunciado que resume o entendimento fixado pelo tribunal no julgamento do tema e que orienta casos iguais.",
  },
  afetacao: {
    termo: "Afetação",
    explicacao:
      "Decisão do órgão julgador de submeter um processo ao rito dos repetitivos, definindo a questão a ser julgada. Em geral, determina também a suspensão dos processos sobre o mesmo assunto.",
  },
  paradigma: {
    termo: "Processo paradigma",
    explicacao: "Processo escolhido para representar a controvérsia no julgamento do tema.",
  },
  relator: {
    termo: "Relator e relator para o acórdão",
    explicacao:
      "Relator é o ministro que conduz o processo e apresenta o primeiro voto. Quando o voto do relator não prevalece, outro ministro redige a decisão final (o acórdão) e aparece como relator para o acórdão.",
  },
  acordao: {
    termo: "Acórdão",
    explicacao: "Decisão escrita de um órgão colegiado do tribunal, com o resultado e a fundamentação.",
  },
  vencido: {
    termo: "Vencido",
    explicacao: "Ministro cujo voto não prevaleceu na etapa do julgamento indicada.",
  },
  votoVista: {
    termo: "Voto-vista",
    explicacao: "Voto de um ministro que pediu mais tempo para examinar o processo (pedido de vista) e o apresentou depois.",
  },
  impedido: {
    termo: "Impedido",
    explicacao: "Ministro que, por regra legal, não pode participar daquele julgamento e por isso não vota.",
  },
  ausente: {
    termo: "Ausente ou não participou",
    explicacao: "Ministro que não votou na sessão; o motivo aparece como escrito no texto oficial, quando informado.",
  },
  presidente: {
    termo: "Presidente da sessão",
    explicacao: "Ministro que conduziu a sessão. Aparece em separado e não é contado entre os votos.",
  },
  embargos: {
    termo: "Embargos de declaração",
    explicacao: "Recurso para esclarecer ponto obscuro, contraditório ou omisso de uma decisão do próprio tribunal.",
  },
  secao: {
    termo: "Seção e Corte Especial",
    explicacao:
      "Órgãos julgadores do STJ. As Seções reúnem as Turmas de uma mesma área do direito; a Corte Especial reúne os ministros mais antigos e julga as questões que envolvem mais de uma Seção.",
  },
  transito: {
    termo: "Trânsito em julgado",
    explicacao: "Momento em que não cabe mais recurso contra a decisão.",
  },
  repercussao: {
    termo: "Repercussão geral",
    explicacao:
      "Requisito para que o Supremo Tribunal Federal (STF) julgue um recurso extraordinário: a questão constitucional precisa ter relevância que ultrapasse o caso concreto. Cada questão reconhecida vira um tema, e a tese fixada vale para casos iguais.",
  },
  controleConcentrado: {
    termo: "Ação Direta de Inconstitucionalidade (ADI) e controle concentrado",
    explicacao:
      "Ações em que o STF examina diretamente se uma lei ou ato normativo está de acordo com a Constituição, sem depender de um caso concreto. A decisão vale para todos.",
  },
  plenarioVirtual: {
    termo: "Plenário Virtual",
    explicacao:
      "Sessão de julgamento do STF feita por meio eletrônico, em que cada ministro registra o voto no sistema dentro de um prazo. O registro de cada voto é publicado pelo tribunal.",
  },
  sumulaVinculante: {
    termo: "Súmula vinculante",
    explicacao: "Enunciado aprovado pelo STF que deve ser seguido por todo o Judiciário e pela administração pública.",
  },
  certidao: {
    termo: "Certidão de julgamento",
    explicacao: "Documento oficial que registra o resultado de uma sessão de julgamento, com quem votou e quem ficou vencido.",
  },
} as const;
