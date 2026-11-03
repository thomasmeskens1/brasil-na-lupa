/** Rótulos e termos da seção Estados (funções puras, seguras no navegador). */
import type { UfInfo } from "./ufs";

export const NAO_DISPONIVEL = "Informação não disponível em fonte oficial";

/** Tipos de proposição mais comuns nas Assembleias; a fonte de cada UF pode acrescentar outros. */
export const SIGLAS_PADRAO: Record<string, string> = {
  PL: "Projeto de Lei",
  PLC: "Projeto de Lei Complementar",
  PEC: "Proposta de Emenda à Constituição",
  PDL: "Projeto de Decreto Legislativo",
  PR: "Projeto de Resolução",
};

/** "Projeto de Lei (PL)" — ou só a sigla, se nem a fonte nem a lista padrão trouxerem o nome. */
export function nomeSigla(sigla: string | null | undefined, siglas?: Record<string, string> | null): string | null {
  if (!sigla) return null;
  const n = siglas?.[sigla] ?? SIGLAS_PADRAO[sigla];
  return n && n !== sigla ? `${n} (${sigla})` : sigla;
}

/** "PL 869/2026" → "Projeto de Lei 869/2026" (sigla por extenso, diretriz 9). */
export function nomeProposicao(rotulo: string | null | undefined, siglas?: Record<string, string> | null): string | null {
  if (!rotulo) return null;
  const [sigla, ...resto] = rotulo.split(" ");
  const n = siglas?.[sigla] ?? SIGLAS_PADRAO[sigla];
  return n ? `${n} ${resto.join(" ")}`.trim() : rotulo;
}

/** Letras impressas antes de alguns nomes no relatório de votação da ALESP, sem legenda no documento. */
export const MARCADORES_SEM_LEGENDA = ["L", "P", "G"];

/** Valor de voto impresso no relatório de Plenário da ALESP cuja legenda não consta do documento. */
export const VOTO_SEM_LEGENDA = "---";

export function rotuloVoto(v: string | null | undefined): string {
  if (!v) return "Registro não informado";
  if (v === VOTO_SEM_LEGENDA) return "--- (sem legenda no documento)";
  return v;
}

/** Ordem fixa dos votos; os demais (ex.: textos das comissões) em ordem alfabética. */
export const ORDEM_VOTOS = ["Sim", "Não", "Abstenção", "Obstrução", "Em Branco", "Licenciado", VOTO_SEM_LEGENDA];

export function compararVotos(a: string, b: string): number {
  const ia = ORDEM_VOTOS.indexOf(a);
  const ib = ORDEM_VOTOS.indexOf(b);
  if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  return a.localeCompare(b, "pt-BR");
}

/** Lacunas da coleta em linguagem do site (sem nomes de campos). */
export function lacunaLegivel(t: string): string {
  return t
    .replace(/\s*\(campo descrição\)/g, " (descrição oficial)")
    .replace(/identificador deixado em branco/g, "o nome aparece como impresso, sem link para perfil");
}

export function formatarData(v: string | null | undefined): string {
  if (!v) return "Data não informada";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** Lê "#id=…", "#p=…" ou "#q=…" do endereço (links de outras páginas para um item da busca). */
export function lerHash(): { id?: string; p?: string; q?: string } {
  if (typeof window === "undefined") return {};
  const m = /^#(id|p|q)=(.+)$/.exec(window.location.hash);
  if (!m) return {};
  try {
    return { [m[1]]: decodeURIComponent(m[2]) };
  } catch {
    return {};
  }
}

/** Termos específicos de São Paulo (também usados pelo glossário geral do site). */
export const TERMOS_SP = {
  alesp: {
    termo: "Assembleia Legislativa do Estado de São Paulo (ALESP)",
    explicacao: "Casa formada pelos 94 deputados estaduais. Vota as leis estaduais, o orçamento do Estado e as contas do governador.",
  },
  pl: { termo: "Projeto de Lei (PL)", explicacao: "Proposta de lei estadual comum. Se aprovada pela Assembleia, vai ao governador, que pode sancionar ou vetar." },
  plc: {
    termo: "Projeto de Lei Complementar (PLC)",
    explicacao: "Proposta de lei sobre temas que a Constituição do Estado reserva à lei complementar; exige maioria absoluta dos deputados para ser aprovada.",
  },
  pec: {
    termo: "Proposta de Emenda à Constituição (PEC)",
    explicacao: "Proposta de mudança no texto da Constituição do Estado de São Paulo. É votada em dois turnos e não passa por sanção ou veto do governador.",
  },
  pdl: {
    termo: "Projeto de Decreto Legislativo (PDL)",
    explicacao: "Proposta sobre assuntos de competência exclusiva da Assembleia, como aprovar as contas do governador ou sustar atos do Executivo. Não passa pelo governador.",
  },
  pr: { termo: "Projeto de Resolução (PR)", explicacao: "Proposta sobre o funcionamento interno da Assembleia. Não passa pelo governador." },
  ccjr: {
    termo: "Comissão de Constituição, Justiça e Redação (CCJR)",
    explicacao: "Comissão da Assembleia que analisa se as propostas estão de acordo com a Constituição e as leis, e a redação dos textos.",
  },
  comissao: {
    termo: "Comissão",
    explicacao:
      "Grupo de deputados que examina as propostas de um tema antes do Plenário. Um relator apresenta um voto (parecer), e os membros registram se acompanham esse voto.",
  },
  votoRelator: {
    termo: "Voto do relator e voto em separado",
    explicacao:
      "O relator é o deputado encarregado de dar o parecer da comissão sobre a proposta. Quem discorda pode apresentar um voto em separado, com outra conclusão. Nas comissões, a ALESP registra o voto de cada membro como texto (ex.: “Favorável ao voto do relator”), reproduzido aqui sem conversão para sim ou não.",
  },
  substitutivo: { termo: "Substitutivo", explicacao: "Texto alternativo que substitui por inteiro a proposta original, apresentado durante a tramitação." },
  verificacao: {
    termo: "Verificação de votação",
    explicacao:
      "Pedido para que a votação do Plenário seja feita pelo painel, com o registro do voto de cada deputado. Sem verificação, a votação é simbólica e não há voto individual. O resultado fica no Relatório de Verificação de Votação, publicado em PDF.",
  },
  obstrucao: {
    termo: "Obstrução",
    explicacao: "Forma de não participar da votação prevista no regimento: quem está em obstrução não é contado para o número mínimo de participantes exigido.",
  },
  licenciado: { termo: "Licenciado", explicacao: "Deputado afastado do mandato na data da votação, como registrado no relatório." },
  semLegenda: {
    termo: "Símbolos sem legenda no documento",
    explicacao:
      "O relatório oficial imprime “---” no lugar do voto de alguns deputados e as letras L, P ou G antes de alguns nomes, mas não traz a legenda desses símbolos. O site os reproduz como impressos e não atribui significado a eles.",
  },
  veto: {
    termo: "Veto total e veto parcial",
    explicacao:
      "Recusa do governador a um projeto aprovado pela Assembleia: no veto total, o projeto inteiro; no parcial, só alguns trechos. O governador publica as razões, e a Assembleia pode manter ou derrubar o veto.",
  },
  sancao: { termo: "Sanção", explicacao: "Concordância do governador com o projeto aprovado pela Assembleia, que assim se torna lei." },
  decreto: { termo: "Decreto", explicacao: "Ato individual do governador, sem votação, para regulamentar leis ou organizar a administração estadual." },
  doe: {
    termo: "Diário Oficial do Estado de São Paulo (DOE-SP)",
    explicacao: "Publicação oficial do Governo do Estado, mantida pela Imprensa Oficial, em que leis, decretos e vetos passam a valer.",
  },
  retificacao: { termo: "Retificação", explicacao: "Correção publicada no Diário Oficial de um ato já publicado, com o texto corrigido." },
  ementa: { termo: "Ementa", explicacao: "Resumo oficial do assunto de uma proposta ou ato, escrito no início do texto." },
} as const;

export interface TermoEstado {
  termo: string;
  explicacao: string;
}

export interface TermosDoEstado {
  casa: TermoEstado;
  nominal: TermoEstado;
  simbolica: TermoEstado;
  comissao: TermoEstado;
  votoRelator: TermoEstado;
  pl: TermoEstado;
  plc: TermoEstado;
  pec: TermoEstado;
  pdl: TermoEstado;
  pr: TermoEstado;
  veto: TermoEstado;
  sancao: TermoEstado;
  decreto: TermoEstado;
  doe: TermoEstado;
  retificacao: TermoEstado;
  ementa: TermoEstado;
  obstrucao: TermoEstado;
}

/** Termos explicados de uma UF: SP usa os textos próprios; as demais, textos gerais e neutros. */
export function termosDoEstado(u: UfInfo): TermosDoEstado {
  const df = u.uf === "df";
  const leis = df ? "distritais" : "estaduais";
  const simbolica = {
    termo: "Votação simbólica",
    explicacao: "Votação em que o presidente da sessão anuncia o resultado sem registrar o voto de cada um. Não há voto individual para mostrar.",
  };
  if (u.uf === "sp") {
    return {
      casa: TERMOS_SP.alesp,
      nominal: TERMOS_SP.verificacao,
      simbolica,
      comissao: TERMOS_SP.comissao,
      votoRelator: TERMOS_SP.votoRelator,
      pl: TERMOS_SP.pl,
      plc: TERMOS_SP.plc,
      pec: TERMOS_SP.pec,
      pdl: TERMOS_SP.pdl,
      pr: TERMOS_SP.pr,
      veto: TERMOS_SP.veto,
      sancao: TERMOS_SP.sancao,
      decreto: TERMOS_SP.decreto,
      doe: TERMOS_SP.doe,
      retificacao: TERMOS_SP.retificacao,
      ementa: TERMOS_SP.ementa,
      obstrucao: TERMOS_SP.obstrucao,
    };
  }
  return {
    casa: { termo: u.casa.nome, explicacao: `Casa formada pelos ${u.membros}. Vota as leis ${leis}, o orçamento e as contas do governador.` },
    nominal: {
      termo: "Votação nominal",
      explicacao: "Votação em que o registro oficial traz o voto de cada deputado. Só nesse caso o site mostra como cada um votou.",
    },
    simbolica,
    comissao: TERMOS_SP.comissao,
    votoRelator: {
      termo: "Voto do relator e voto em separado",
      explicacao: "O relator é o deputado encarregado de dar o parecer da comissão sobre a proposta. Quem discorda pode apresentar um voto em separado, com outra conclusão.",
    },
    pl: { termo: "Projeto de Lei (PL)", explicacao: `Proposta de lei ${df ? "distrital" : "estadual"} comum. Se aprovada, vai ao governador, que pode sancionar ou vetar.` },
    plc: { termo: "Projeto de Lei Complementar (PLC)", explicacao: "Proposta de lei sobre temas que a Constituição reserva à lei complementar; exige maioria absoluta para ser aprovada." },
    pec: {
      termo: df ? "Proposta de Emenda à Lei Orgânica" : "Proposta de Emenda à Constituição (PEC)",
      explicacao: df ? "Proposta de mudança no texto da Lei Orgânica do Distrito Federal." : `Proposta de mudança no texto da Constituição do Estado ${u.de}. Não passa por sanção ou veto do governador.`,
    },
    pdl: { termo: "Projeto de Decreto Legislativo (PDL)", explicacao: "Proposta sobre assuntos de competência exclusiva do Legislativo. Não passa pelo governador." },
    pr: { termo: "Projeto de Resolução (PR)", explicacao: "Proposta sobre o funcionamento interno do Legislativo. Não passa pelo governador." },
    veto: TERMOS_SP.veto,
    sancao: { termo: "Sanção", explicacao: "Concordância do governador com o projeto aprovado pelo Legislativo, que assim se torna lei." },
    decreto: { termo: "Decreto", explicacao: `Ato individual do governador, sem votação, para regulamentar leis ou organizar a administração ${df ? "distrital" : "estadual"}.` },
    doe: {
      termo: df ? "Diário Oficial do Distrito Federal (DODF)" : `Diário Oficial do Estado ${u.de}`,
      explicacao: "Publicação oficial do governo em que leis, decretos e vetos passam a valer.",
    },
    retificacao: TERMOS_SP.retificacao,
    ementa: TERMOS_SP.ementa,
    obstrucao: { termo: "Obstrução", explicacao: "Forma de não participar da votação prevista no regimento, registrada como tal na fonte." },
  };
}

/** Termo da sigla de uma proposição, quando houver. */
export function termoSigla(t: TermosDoEstado, sigla: string | null | undefined): TermoEstado | null {
  const m: Record<string, TermoEstado> = { PL: t.pl, PLC: t.plc, PEC: t.pec, PDL: t.pdl, PR: t.pr };
  return sigla ? (m[sigla] ?? null) : null;
}

/** "e" entre os dois últimos itens: "2025 e 2026", "2024, 2025 e 2026". */
export function juntar(itens: string[]): string {
  return itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}` : (itens[0] ?? "");
}
