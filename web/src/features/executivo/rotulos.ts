/** Rótulos e termos do Executivo federal (funções puras, seguras no navegador). */
import { SIGLA_PROPOSICAO } from "@/features/congresso/rotulos";

const SIGLAS_EXTRA: Record<string, string> = {
  PLN: "Projeto de Lei do Congresso Nacional",
  PLC: "Projeto de Lei da Câmara",
  PLS: "Projeto de Lei do Senado",
  PLV: "Projeto de Lei de Conversão",
  MSG: "Mensagem",
};

/** "PLN 26/2024" → "Projeto de Lei do Congresso Nacional (PLN) 26/2024"; sem nome conhecido, como na fonte. */
export function explicarSigla(ident: string | null | undefined): string | null {
  if (!ident) return null;
  const m = /^([A-Z]{2,4})\s+(.+)$/.exec(ident.trim());
  if (!m) return ident;
  const nome = SIGLAS_EXTRA[m[1]] ?? SIGLA_PROPOSICAO[m[1]];
  return nome ? `${nome} (${m[1]}) ${m[2]}` : ident;
}

export const URL_CONSTITUICAO = "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm";

/** Situação padronizada de uma medida provisória, com a primeira letra maiúscula. */
export function rotuloSituacaoMpv(s: string | null | undefined): string {
  if (!s) return "Situação não informada";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const SITUACAO_DISPOSITIVO: Record<string, { rotulo: string; explicacao: string }> = {
  mantido: { rotulo: "Veto mantido", explicacao: "O Congresso Nacional manteve o veto: o trecho continua fora da lei." },
  derrubado: {
    rotulo: "Veto derrubado",
    explicacao: "O Congresso Nacional rejeitou o veto (a fonte registra \"Rejeitado\"): o trecho volta a fazer parte da lei.",
  },
  "não apreciado": { rotulo: "Não apreciado", explicacao: "O Congresso Nacional ainda não votou este dispositivo." },
  prejudicado: {
    rotulo: "Prejudicado",
    explicacao: "A fonte registra o dispositivo como prejudicado: ele não chegou a ser votado porque a deliberação ficou sem objeto.",
  },
};

export function rotuloSituacaoDispositivo(s: string | null | undefined, oficial?: string | null): string {
  if (s && SITUACAO_DISPOSITIVO[s]) return SITUACAO_DISPOSITIVO[s].rotulo;
  return oficial ?? "Situação não informada";
}

/** Rótulo da contagem por situação (as chaves vêm com a grafia da fonte). */
export function rotuloSituacaoFonte(chave: string): string {
  const m: Record<string, string> = {
    Mantido: "Mantidos",
    Rejeitado: "Derrubados",
    "Não Apreciado": "Não apreciados",
    Prejudicado: "Prejudicados",
  };
  return m[chave] ?? chave;
}

export function rotuloTipoVeto(t: string | null | undefined): string {
  if (t === "total") return "Veto total";
  if (t === "parcial") return "Veto parcial";
  return "Tipo de veto não informado";
}

export function rotuloTipoVotacaoVeto(t: string | null | undefined): string | null {
  if (t === "Cédula") return "Votação por cédula eletrônica";
  if (t === "Painel") return "Votação no painel eletrônico";
  return t ?? null;
}

export const TERMOS_EXECUTIVO = {
  mpv: {
    termo: "Medida provisória (MPV)",
    explicacao:
      "Ato do Presidente da República com força de lei, previsto no artigo 62 da Constituição para casos de relevância e urgência. Vale a partir da publicação, mas precisa ser aprovado pela Câmara dos Deputados e pelo Senado Federal no prazo constitucional; se não for, perde a eficácia.",
  },
  exposicao: {
    termo: "Exposição de motivos",
    explicacao:
      "Documento em que um ou mais ministros apresentam ao Presidente da República as razões para editar o ato. É a justificativa oficial do autor.",
  },
  plv: {
    termo: "Projeto de Lei de Conversão (PLV)",
    explicacao: "Texto da medida provisória com as mudanças feitas pelo Congresso. Depois de aprovado, vai à sanção ou veto do Presidente da República.",
  },
  comissaoMista: {
    termo: "Comissão mista",
    explicacao: "Comissão formada por deputados e senadores que examina a medida provisória antes da votação nos Plenários da Câmara e do Senado.",
  },
  perdaEficacia: {
    termo: "Perda de eficácia",
    explicacao: "A medida provisória deixa de valer porque não foi aprovada pelo Congresso no prazo constitucional.",
  },
  veto: {
    termo: "Veto",
    explicacao:
      "Recusa do Presidente da República em sancionar, no todo ou em parte, um projeto aprovado pelo Congresso (artigo 66 da Constituição). O veto vem acompanhado das razões, publicadas em mensagem oficial.",
  },
  vetoTotalParcial: {
    termo: "Veto total e veto parcial",
    explicacao: "Veto total recusa o projeto inteiro. Veto parcial recusa só alguns trechos (dispositivos); o restante vira lei.",
  },
  dispositivo: {
    termo: "Dispositivo",
    explicacao:
      "Trecho de um projeto de lei, como artigo, parágrafo, inciso ou alínea, ou, no caso do orçamento, uma programação de despesa. Cada dispositivo vetado é votado separadamente.",
  },
  sessaoConjunta: {
    termo: "Sessão conjunta",
    explicacao:
      "Sessão do Congresso Nacional em que deputados e senadores se reúnem para deliberar, como na apreciação de vetos. Os votos de cada casa são contados separadamente.",
  },
  sobrestamento: {
    termo: "Sobrestando a pauta",
    explicacao:
      "Pela Constituição, o veto não apreciado no prazo passa a ter prioridade na ordem do dia da sessão conjunta, adiando as demais deliberações até a sua votação.",
  },
  cedula: {
    termo: "Cédula eletrônica e painel",
    explicacao:
      "Formas de votação registradas pelo Congresso Nacional. Na cédula, cada parlamentar marca o voto em vários dispositivos de uma vez; no painel, a votação é feita no painel eletrônico do Plenário.",
  },
  lei: {
    termo: "Lei e lei complementar",
    explicacao:
      "Leis são aprovadas pelo Congresso Nacional e sancionadas pelo Presidente da República. A lei complementar trata de temas que a Constituição reserva a ela e exige aprovação pela maioria absoluta de cada casa.",
  },
  decreto: {
    termo: "Decreto",
    explicacao: "Ato individual do Presidente da República, em geral para regulamentar uma lei ou organizar a administração federal. Não passa por votação.",
  },
  dou: {
    termo: "Diário Oficial da União (DOU)",
    explicacao: "Publicação oficial em que leis, decretos e outros atos do governo federal são publicados.",
  },
} as const;
