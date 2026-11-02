/** Rótulos e termos da seção São Paulo (funções puras, seguras no navegador). */

export const SIGLAS_SP: Record<string, string> = {
  PL: "Projeto de Lei",
  PLC: "Projeto de Lei Complementar",
  PEC: "Proposta de Emenda à Constituição",
  PDL: "Projeto de Decreto Legislativo",
  PR: "Projeto de Resolução",
};

/** "Projeto de Lei (PL)" — ou só a sigla, se não houver nome. */
export function nomeSiglaSp(sigla: string | null | undefined): string | null {
  if (!sigla) return null;
  return SIGLAS_SP[sigla] ? `${SIGLAS_SP[sigla]} (${sigla})` : sigla;
}

/** Letras impressas antes de alguns nomes no relatório de votação, sem legenda no documento. */
export const MARCADORES_SEM_LEGENDA = ["L", "P", "G"];

/** Valores de voto impressos no relatório de Plenário cuja legenda não consta do documento. */
export const VOTO_SEM_LEGENDA = "---";

export function rotuloVotoSp(v: string | null | undefined): string {
  if (!v) return "Registro não informado";
  if (v === VOTO_SEM_LEGENDA) return "--- (sem legenda no documento)";
  return v;
}

/** Ordem fixa dos votos de Plenário; os demais (textos das comissões) em ordem alfabética. */
const ORDEM = ["Sim", "Não", "Abstenção", "Obstrução", "Em Branco", "Licenciado", VOTO_SEM_LEGENDA];

export function compararVotosSp(a: string, b: string): number {
  const ia = ORDEM.indexOf(a);
  const ib = ORDEM.indexOf(b);
  if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  return a.localeCompare(b, "pt-BR");
}

/** Lacunas da coleta em linguagem do site (sem nomes de campos). */
export function lacunaLegivelSp(t: string): string {
  return t
    .replace(/\s*\(campo descrição\)/g, " (descrição oficial)")
    .replace(/identificador deixado em branco/g, "o nome aparece como impresso, sem link para perfil");
}

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

export function formatarDataSp(v: string | null | undefined): string {
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
