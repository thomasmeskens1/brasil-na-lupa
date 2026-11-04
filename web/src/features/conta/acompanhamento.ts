/**
 * Montagem, no navegador, da lista "Meus favoritos" e "Minhas reações" da página Minha conta:
 * cruza os ids da pessoa com as partes do catálogo público (catalogo.ts). Sem dependências
 * externas (testável com node --test). Ordem só pela data, da mais recente para a mais antiga.
 */
import { hrefDoId, parteDoId } from "./ids";

/** [título, data AAAA-MM-DD, quem decidiu, grupo (proposição) ou null, situação oficial ou null] */
export type ItemCatalogo = [string, string | null, string, string | null, string | null];
/** [id da proposta, data, resultado oficial] */
export type VotacaoGrupo = [string, string | null, string | null];

export interface ParteCatalogo {
  parte: string;
  itens: Record<string, ItemCatalogo>;
  /** Proposição → votações registradas (só grupos com 2 ou mais), da mais recente para a mais antiga. */
  grupos: Record<string, VotacaoGrupo[]>;
  politicos: Record<string, string>;
}

export interface Atualizacao {
  id: string;
  href: string | null;
  data: string | null;
  resultado: string | null;
  titulo: string | null;
  /** Registrada depois da votação favorita. */
  posterior: boolean;
}

export interface PropostaAcompanhada {
  id: string;
  href: string | null;
  /** null quando o catálogo não tem o item (ex.: saiu do período coletado). */
  titulo: string | null;
  data: string | null;
  orgao: string | null;
  situacao: string | null;
  /** Outras votações da mesma proposição, da mais recente para a mais antiga (até `max`). */
  atualizacoes: Atualizacao[];
  /** Data mais recente entre a proposta e as atualizações (ordena a lista). */
  ultimaData: string | null;
}

/** Partes do catálogo necessárias para estes ids (sem repetir). */
export function partesNecessarias(ids: string[]): string[] {
  return [...new Set(ids.map(parteDoId).filter((p): p is string => !!p))].sort();
}

function achar(partes: Record<string, ParteCatalogo | null>, id: string): { parte: ParteCatalogo; item: ItemCatalogo } | null {
  const nome = parteDoId(id);
  const parte = nome ? partes[nome] : null;
  const item = parte?.itens[id];
  return parte && item ? { parte, item } : null;
}

export function acompanharProposta(partes: Record<string, ParteCatalogo | null>, id: string, max = 3): PropostaAcompanhada {
  const a = achar(partes, id);
  if (!a) return { id, href: hrefDoId(id), titulo: null, data: null, orgao: null, situacao: null, atualizacoes: [], ultimaData: null };
  const [titulo, data, orgao, grupo, situacao] = a.item;
  const atualizacoes = (grupo ? (a.parte.grupos[grupo] ?? []) : [])
    .filter(([k]) => k !== id)
    .slice(0, max)
    .map(([k, d, r]) => ({
      id: k,
      href: hrefDoId(k),
      data: d,
      resultado: r,
      titulo: a.parte.itens[k]?.[0] ?? null,
      posterior: !!d && !!data && d > data,
    }));
  const datas = [data, ...atualizacoes.map((x) => x.data)].filter((d): d is string => !!d).sort();
  return { id, href: hrefDoId(id), titulo, data, orgao, situacao, atualizacoes, ultimaData: datas.at(-1) ?? null };
}

/** Propostas favoritas com as atualizações, da movimentação mais recente para a mais antiga. */
export function acompanharPropostas(partes: Record<string, ParteCatalogo | null>, ids: string[], max = 3): PropostaAcompanhada[] {
  return ids
    .map((id) => acompanharProposta(partes, id, max))
    .sort((a, b) => (b.ultimaData ?? "").localeCompare(a.ultimaData ?? "") || a.id.localeCompare(b.id));
}

/** Nome legível de um político favorito (sem mostrar o identificador técnico). */
export function nomePolitico(partes: Record<string, ParteCatalogo | null>, id: string): string | null {
  const nome = parteDoId(id);
  return (nome && partes[nome]?.politicos[id]) || null;
}

/** Título de uma proposta (para "Minhas reações"). */
export function tituloProposta(partes: Record<string, ParteCatalogo | null>, id: string): string | null {
  return achar(partes, id)?.item[0] ?? null;
}

/** Rótulo genérico quando o catálogo não tem o item. */
export function rotuloGenerico(id: string): string {
  const i = id.indexOf(":");
  const origem = id.slice(0, i);
  const m = /^([a-z]{2})-(votacao|deputado)$/.exec(origem);
  if (m) return m[2] === "votacao" ? `Votação na Assembleia Legislativa (${m[1].toUpperCase()})` : `Deputado(a) estadual (${m[1].toUpperCase()})`;
  const R: Record<string, string> = {
    camara: "Deputado(a) federal",
    senado: "Senador(a)",
    "camara-votacao": "Votação na Câmara dos Deputados",
    "senado-votacao": "Votação no Senado Federal",
    executivo: id.includes(":mpv-") ? "Medida provisória" : "Veto",
    icms: "Decisão sobre o ICMS",
  };
  return R[origem] ?? "Registro";
}
