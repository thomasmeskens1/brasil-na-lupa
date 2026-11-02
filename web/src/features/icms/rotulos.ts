import type { Caminho, CasaVotacao, Decisao, TipoVotacao } from "./tipos";

/** Rótulos legíveis (funções puras, seguras no navegador). Nenhum código técnico é exibido. */

export interface InfoCaminho {
  id: Caminho;
  rotulo: string;
  quem: string;
  /** Há votação de parlamentares (deputados ou senadores) nesse caminho? */
  votamParlamentares: boolean;
}

/** Ordem fixa e neutra: do âmbito nacional dos estados ao federal. */
export const CAMINHOS: InfoCaminho[] = [
  {
    id: "confaz",
    rotulo: "CONFAZ (Conselho Nacional de Política Fazendária)",
    quem: "Representantes das secretarias de Fazenda dos 26 estados e do Distrito Federal",
    votamParlamentares: false,
  },
  {
    id: "alesp",
    rotulo: "Assembleia Legislativa do Estado de São Paulo (ALESP)",
    quem: "Deputados estaduais, com sanção ou veto do governador",
    votamParlamentares: true,
  },
  {
    id: "governador-sp",
    rotulo: "Governador de São Paulo",
    quem: "Governador, por decreto",
    votamParlamentares: false,
  },
  {
    id: "congresso",
    rotulo: "Congresso Nacional",
    quem: "Deputados federais e senadores, com sanção ou veto do presidente da República",
    votamParlamentares: true,
  },
  {
    id: "presidencia",
    rotulo: "Presidência da República",
    quem: "Presidente da República, por decreto, medida provisória, sanção ou veto",
    votamParlamentares: false,
  },
];

export const CAMINHO_POR_ID = Object.fromEntries(CAMINHOS.map((c) => [c.id, c])) as Record<Caminho, InfoCaminho>;

/** Rótulo curto do caminho, para filtros e etiquetas. */
export const CAMINHO_CURTO: Record<Caminho, string> = {
  confaz: "CONFAZ",
  alesp: "Assembleia Legislativa de SP",
  "governador-sp": "Governador de SP",
  congresso: "Congresso Nacional",
  presidencia: "Presidência da República",
};

export const CASA: Record<CasaVotacao, string> = {
  camara: "Câmara dos Deputados",
  senado: "Senado Federal",
  alesp: "Assembleia Legislativa do Estado de São Paulo",
  confaz: "CONFAZ (Conselho Nacional de Política Fazendária)",
  congresso: "Congresso Nacional (sessão conjunta)",
};

export const TIPO_VOTACAO: Record<TipoVotacao, { rotulo: string; explicacao: string }> = {
  nominal: {
    rotulo: "Votação nominal",
    explicacao: "O voto de cada participante foi registrado oficialmente, com o nome de quem votou.",
  },
  simbolica: {
    rotulo: "Votação simbólica",
    explicacao: "O resultado foi anunciado sem registro do voto de cada participante; por isso, nenhum voto individual é atribuído.",
  },
  "unanimidade-registrada": {
    rotulo: "Aprovação por unanimidade registrada",
    explicacao: "O documento oficial registra que a decisão foi unânime, sem lista de votos individuais.",
  },
  "sem-votacao": {
    rotulo: "Sem votação",
    explicacao: "A decisão foi tomada por ato individual de quem tem a competência, sem votação.",
  },
};

export const PAPEL: Record<string, string> = {
  assinou: "Assinou",
  autor: "Autor",
  relator: "Relator",
  sancionou: "Sancionou",
  vetou: "Vetou",
  presidiu: "Presidiu",
};

export function rotuloPapel(p: string | null | undefined): string {
  if (!p) return "Papel não informado em fonte oficial";
  return PAPEL[p] ?? p.replace(/[-_]+/g, " ");
}

export const NAO_DISPONIVEL = "Informação não disponível em fonte oficial";

export function formatarData(v: string | null | undefined): string {
  if (!v) return NAO_DISPONIVEL;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** Nome do ato: "Convênio ICMS 127/2026". */
export function nomeDoAto(d: Pick<Decisao, "instrumento" | "numero">): string {
  return d.numero ? `${d.instrumento} ${d.numero}` : d.instrumento;
}

/** Verdadeiro se houve votação nominal ou simbólica de deputados ou senadores. */
export function houveVotoDeParlamentares(d: Decisao): boolean {
  return (d.votacoes ?? []).some(
    (v) => ["camara", "senado", "alesp", "congresso"].includes(v.casa) && v.tipo !== "sem-votacao",
  );
}
