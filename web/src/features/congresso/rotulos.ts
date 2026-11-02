import type { Casa, PlacarCongresso, TipoVotacaoCongresso } from "./tipos";

/** Rótulos legíveis (funções puras, seguras no navegador). Nenhum código técnico é exibido. */

export const NAO_DISPONIVEL = "Informação não disponível em fonte oficial";

export const CASAS: Casa[] = ["camara", "senado"];

export const CASA_NOME: Record<Casa, string> = {
  camara: "Câmara dos Deputados",
  senado: "Senado Federal",
};

export const CASA_MEMBROS: Record<Casa, { plural: string; singular: string; rota: string }> = {
  camara: { plural: "Deputados federais", singular: "Deputado federal", rota: "/congresso/deputados" },
  senado: { plural: "Senadores", singular: "Senador", rota: "/congresso/senadores" },
};

export function ehCasa(v: string): v is Casa {
  return v === "camara" || v === "senado";
}

/**
 * Nomes dos tipos de proposição conforme as tabelas de referência oficiais
 * (Câmara: /referencias/proposicoes/siglaTipo; Senado: ListaSiglas).
 */
export const SIGLA_PROPOSICAO: Record<string, string> = {
  PL: "Projeto de Lei",
  PLP: "Projeto de Lei Complementar",
  PEC: "Proposta de Emenda à Constituição",
  MPV: "Medida Provisória",
  PDL: "Projeto de Decreto Legislativo",
  PDC: "Projeto de Decreto Legislativo",
  PRC: "Projeto de Resolução",
  MSC: "Mensagem",
  MSF: "Mensagem do Senado Federal",
  REQ: "Requerimento",
  RQS: "Requerimento",
  REC: "Recurso",
  REP: "Representação",
  REL: "Relatório",
  SAP: "Sustação de Andamento de Ação Penal",
  OBJ: "Objeto de Deliberação",
  OFS: "Ofício",
};

/** "Projeto de Lei Complementar (PLP)" — ou só a sigla, se não houver nome de referência. */
export function nomeTipoProposicao(sigla: string | null | undefined): string | null {
  if (!sigla) return null;
  const nome = SIGLA_PROPOSICAO[sigla];
  return nome ? `${nome} (${sigla})` : sigla;
}

export const TIPO: Record<TipoVotacaoCongresso, { rotulo: string; explicacao: string }> = {
  nominal: {
    rotulo: "Votação nominal",
    explicacao: "O voto de cada parlamentar foi registrado oficialmente, com o nome de quem votou.",
  },
  simbolica: {
    rotulo: "Votação simbólica",
    explicacao:
      "O presidente da sessão anuncia o resultado sem registrar o voto de cada parlamentar. Não há registro oficial de voto individual.",
  },
  secreta: {
    rotulo: "Votação secreta",
    explicacao:
      "A Constituição e o regimento preveem voto secreto em alguns casos, como a escolha de autoridades. A casa divulga só o placar; não há voto individual.",
  },
};

export function rotuloTipo(t: string | null | undefined): string {
  return t && t in TIPO ? TIPO[t as TipoVotacaoCongresso].rotulo : "Tipo de votação não informado";
}

export function rotuloResultado(r: string | null | undefined): string {
  if (r === "aprovada") return "Aprovada";
  if (r === "rejeitada") return "Rejeitada";
  return "Resultado não informado em campo próprio da fonte";
}

/** Rótulo curto para filtros e etiquetas. */
export function rotuloResultadoCurto(r: string | null | undefined): string {
  if (r === "aprovada") return "Aprovada";
  if (r === "rejeitada") return "Rejeitada";
  return "Não informado";
}

/** Votos registrados na Câmara e no Senado, com a marcação de quem presidia explicada. */
const VOTO_LEGIVEL: Record<string, string> = {
  "Artigo 17": "Artigo 17 (presidia a sessão)",
  "Presidente (art. 51 RISF)": "Presidente da sessão (artigo 51 do Regimento Interno do Senado)",
};

export function rotuloVoto(v: string | null | undefined): string {
  if (!v) return "Registro não informado";
  return VOTO_LEGIVEL[v] ?? v;
}

/** Ordem fixa: as quatro opções de voto, depois as marcações de presidência e os demais em ordem alfabética. */
const ORDEM_VOTO = ["Sim", "Não", "Abstenção", "Obstrução", "Artigo 17", "Presidente (art. 51 RISF)"];
export const OPCOES_DE_VOTO = new Set(["Sim", "Não", "Abstenção", "Obstrução"]);

export function compararVotos(a: string, b: string): number {
  const ia = ORDEM_VOTO.indexOf(a);
  const ib = ORDEM_VOTO.indexOf(b);
  if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  return a.localeCompare(b, "pt-BR");
}

/** Orientação de bancada como registrada, em grafia legível (a fonte do Senado usa maiúsculas). */
export function rotuloOrientacao(o: string | null | undefined): string {
  if (!o) return "Sem orientação registrada";
  const m: Record<string, string> = { SIM: "Sim", "NÃO": "Não", NAO: "Não", "OBSTRUÇÃO": "Obstrução", LIVRE: "Livre (voto liberado)" };
  if (m[o]) return m[o];
  if (o === "Liberado") return "Liberado (voto livre)";
  return o;
}

/** A Câmara abrevia blocos e federações ("Bl", "Fdr"); o restante do nome fica como na fonte. */
export function rotuloBancada(b: string): string {
  return b.replace(/^Bl\s+/, "Bloco ").replace(/^Fdr\s+/, "Federação ");
}

export const ROTULO_PLACAR: [keyof PlacarCongresso, string][] = [
  ["sim", "Sim"],
  ["nao", "Não"],
  ["abstencao", "Abstenção"],
  ["obstrucao", "Obstrução"],
  ["outros", "Outros"],
];

/** Termos técnicos usados na seção, com explicação breve e neutra (diretriz 9). */
export const TERMOS = {
  orientacao: {
    termo: "Orientação de bancada",
    explicacao:
      "Recomendação de voto que o líder de um partido, bloco, federação, do governo, da maioria, da minoria ou da oposição anuncia aos parlamentares do grupo antes da votação. Não é o voto de cada um.",
  },
  obstrucao: {
    termo: "Obstrução",
    explicacao:
      "Forma de não participar da votação prevista no regimento: quem está em obstrução não é contado para o número mínimo de participantes (quórum) exigido.",
  },
  artigo17: {
    termo: "Artigo 17",
    explicacao:
      "Marcação usada na Câmara para quem presidia a sessão, conforme o artigo 17 do Regimento Interno da Câmara dos Deputados. Não é voto Sim nem Não.",
  },
  artigo51: {
    termo: "Presidente (artigo 51 do Regimento Interno do Senado Federal)",
    explicacao: "Marcação usada no Senado para quem presidia a sessão. Não é voto Sim nem Não.",
  },
  abstencao: {
    termo: "Abstenção",
    explicacao: "O parlamentar participa da votação, mas não vota Sim nem Não.",
  },
  outros: {
    termo: "Outros (no placar)",
    explicacao: "Total que a fonte oficial informa fora de Sim, Não, Abstenção e Obstrução, como a marcação de quem presidia a sessão.",
  },
  ementa: {
    termo: "Ementa",
    explicacao: "Resumo oficial do assunto de uma proposição, escrito no início do texto.",
  },
  sessaoDeliberativa: {
    termo: "Sessão deliberativa",
    explicacao:
      "Sessão do Plenário em que há votação de propostas (Ordem do Dia). É a base do registro oficial de presença dos deputados.",
  },
  ceap: {
    termo: "Cota para o Exercício da Atividade Parlamentar (CEAP)",
    explicacao:
      "Valor que cada deputado pode usar para despesas ligadas ao mandato, como passagens, aluguel de escritório no estado, combustível e divulgação da atividade parlamentar. A Câmara reembolsa ou paga mediante comprovante e publica cada documento.",
  },
  bloco: {
    termo: "Bloco parlamentar e federação",
    explicacao:
      "Bloco: união de partidos para atuar em conjunto na casa. Federação: união de partidos registrada na Justiça Eleitoral, que atua como um só partido. A Câmara abrevia alguns nomes; eles aparecem como na fonte.",
  },
} as const;

export function formatarData(v: string | null | undefined): string {
  if (!v) return NAO_DISPONIVEL;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** Normaliza para busca sem diferença de maiúsculas e acentos. */
export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Rota da página de uma votação e de um parlamentar. */
export function rotaVotacao(casa: Casa, id: string): string {
  return `/congresso/votacoes/${casa}/${encodeURIComponent(id)}`;
}

export function rotaParlamentar(casa: Casa, id: string): string {
  return `/congresso/${casa}/parlamentares/${encodeURIComponent(id)}`;
}
