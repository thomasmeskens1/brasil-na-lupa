import type { OrgaoTc, ParecerTce } from "./tipos";

export const NAO_DISPONIVEL = "Informação não disponível em fonte oficial";

export const BASE_TC = "/tribunais-de-contas";

export function formatarDataTc(v: string | null | undefined): string {
  if (!v) return NAO_DISPONIVEL;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** Nome em caixa alta da API (ex.: "BENJAMIN ZYMLER") com iniciais maiúsculas; só a grafia muda. */
export function nomeProprio(v: string | null | undefined): string {
  if (!v) return NAO_DISPONIVEL;
  if (v !== v.toUpperCase()) return v;
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e"]);
  return v
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export const ESFERAS: [string, string][] = [
  ["federal", "Federal"],
  ["estadual", "Estaduais"],
  ["distrital", "Distrito Federal"],
  ["municipal", "Municipais"],
];

export function rotuloSituacao(o: Pick<OrgaoTc, "situacao_coleta">): string {
  return o.situacao_coleta === "ativa" ? "Disponível" : "Em breve";
}

/** "de SP", "do DF": usado nos títulos das contas do Governador. */
export function deUf(uf: string | null): string {
  return uf ? `de ${uf}` : "";
}

/**
 * Resumo em linguagem simples da conclusão literal do parecer do TCU. Só reconhece as fórmulas
 * escritas no texto oficial; qualquer outra redação vira "parecer prévio emitido" (sem dedução).
 */
export function resumoParecerTcu(conclusao: string | null | undefined): string | null {
  if (!conclusao) return null;
  const t = conclusao.replace(/\s+/g, " ").trim();
  const sufixo = /com ressalvas\.?$/i.test(t) ? ", com ressalvas" : /com ressalva\.?$/i.test(t) ? ", com ressalva" : "";
  if (/n[ãa]o (?:est[ãa]o|est[áa]) em condi[çc][õo]es de ser(?:em)? aprovadas/i.test(t)) return `parecer pela não aprovação${sufixo}`;
  if (/em condi[çc][õo]es de ser(?:em)? aprovadas/i.test(t)) return `parecer pela aprovação${sufixo}`;
  return "parecer prévio emitido";
}

/** Resumo do parecer de um tribunal de contas estadual, a partir dos campos literais. */
export function resumoParecerTce(p: ParecerTce): string | null {
  if (!p.conclusao) return null;
  const c = p.conclusao.toLowerCase();
  // "favorável", "pela aprovação" seguem "parecer"; um substantivo ("aprovação", "rejeição") pede "de".
  const de = /^(aprova|desaprova|rejei|reprova)/.test(c) ? "de " : "";
  const ressalvas = p.com_ressalvas && !c.includes("ressalva") ? " com ressalvas" : "";
  return `parecer ${de}${c}${ressalvas}`;
}

export interface TermoTc {
  termo: string;
  explicacao: string;
}

/** Termos técnicos explicados (diretriz 9). Explicações breves e neutras. */
export const TERMOS_TC = {
  tribunalContas: {
    termo: "Tribunal de contas",
    explicacao:
      "Órgão que auxilia o Poder Legislativo na fiscalização do uso do dinheiro público. Não faz parte do Poder Judiciário: analisa contas, faz auditorias e pode aplicar multas a gestores.",
  },
  parecerPrevio: {
    termo: "Parecer prévio",
    explicacao:
      "Opinião técnica do tribunal de contas sobre as contas anuais do Presidente, do Governador ou do Prefeito. Não é o julgamento final: as contas são julgadas depois pelo Poder Legislativo.",
  },
  julgamentoPolitico: {
    termo: "Julgamento político das contas",
    explicacao:
      "Decisão final sobre as contas do chefe do Executivo, tomada pelo Poder Legislativo: o Congresso Nacional (Presidente), a Assembleia Legislativa (Governador) ou a Câmara Municipal (Prefeito).",
  },
  ressalva: {
    termo: "Ressalva",
    explicacao: "Problema apontado pelo tribunal que não impediu a conclusão do parecer, mas fica registrado junto com ela.",
  },
  alerta: {
    termo: "Alerta",
    explicacao: "Aviso formal do tribunal ao governo sobre um risco ou uma situação que precisa de atenção, com base na lei.",
  },
  determinacao: {
    termo: "Determinação e recomendação",
    explicacao:
      "Determinação é uma ordem do tribunal para corrigir algo em prazo ou nas contas seguintes; recomendação é uma sugestão de melhoria, sem obrigação de cumprir.",
  },
  cmo: {
    termo: "Comissão Mista de Planos, Orçamentos Públicos e Fiscalização (CMO)",
    explicacao:
      "Comissão formada por deputados e senadores que analisa as contas do Presidente da República antes da votação no Congresso Nacional. Um relator é designado para dar o parecer da comissão.",
  },
  mcn: {
    termo: "Mensagem do Congresso Nacional (MCN)",
    explicacao: "Documento pelo qual as contas do Presidente da República chegam ao Congresso Nacional para julgamento.",
  },
  acordao: {
    termo: "Acórdão",
    explicacao: "Decisão tomada por um grupo de julgadores (um colegiado). No Tribunal de Contas da União (TCU), cada decisão colegiada recebe um número por ano.",
  },
  acordaoRelacao: {
    termo: "Acórdão de relação",
    explicacao:
      "Acórdão que reúne, em lista, processos que o relator leva ao colegiado de uma só vez, sem relatório e voto separados para cada um. Na fonte oficial, esse tipo não traz sumário.",
  },
  sumario: { termo: "Sumário", explicacao: "Resumo oficial do assunto e do resultado do acórdão, escrito pelo próprio tribunal." },
  colegiado: {
    termo: "Colegiado",
    explicacao: "Grupo de julgadores que decide em conjunto. No TCU são o Plenário e as duas Câmaras; no Tribunal de Contas do Estado de São Paulo (TCE-SP), o Tribunal Pleno e as Câmaras.",
  },
  plenarioCamaras: {
    termo: "Plenário e Câmaras do TCU",
    explicacao:
      "O Plenário reúne todos os ministros do TCU e decide os casos de maior relevância, como o parecer sobre as contas do Presidente. A Primeira e a Segunda Câmara reúnem parte dos ministros e julgam a maioria dos processos.",
  },
  tribunalPleno: {
    termo: "Tribunal Pleno",
    explicacao: "Reunião de todos os conselheiros de um tribunal de contas estadual. No TCE-SP, é quem emite o parecer sobre as contas do Governador.",
  },
  relator: {
    termo: "Relator",
    explicacao: "Ministro ou conselheiro responsável por estudar o processo e apresentar o voto que os demais analisam.",
  },
  conselheiroSubstituto: {
    termo: "Conselheiro substituto (auditor)",
    explicacao: "Integrante do tribunal de contas que pode substituir um conselheiro e relatar processos no lugar dele.",
  },
  quorum: {
    termo: "Quórum",
    explicacao: "Quem participou da votação. O site mostra a lista exatamente como escrita na decisão.",
  },
  transito: {
    termo: "Trânsito em julgado",
    explicacao: "Momento em que não cabe mais recurso contra a decisão do tribunal.",
  },
  pdl: {
    termo: "Projeto de Decreto Legislativo (PDL)",
    explicacao: "Proposta votada só pelo Poder Legislativo, sem sanção do Executivo. É o instrumento usado para aprovar ou rejeitar as contas.",
  },
  ministerioPublicoContas: {
    termo: "Ministério Público de Contas",
    explicacao: "Órgão que atua junto ao tribunal de contas na defesa da lei e se manifesta nos processos antes do julgamento.",
  },
  lai: {
    termo: "Lei de Acesso à Informação (LAI)",
    explicacao: "Lei 12.527/2011, que permite a qualquer pessoa pedir informações públicas aos órgãos. O pedido é usado quando o dado não está publicado em formato aberto.",
  },
  siglasOrcamento: {
    termo: "LDO, LOA e LRF",
    explicacao:
      "Lei de Diretrizes Orçamentárias (LDO), Lei Orçamentária Anual (LOA) e Lei de Responsabilidade Fiscal (LRF, Lei Complementar 101/2000): leis que orientam e limitam o orçamento e os gastos públicos.",
  },
} as const satisfies Record<string, TermoTc>;

