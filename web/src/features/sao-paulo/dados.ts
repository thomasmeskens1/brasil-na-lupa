import fs from "node:fs";
import path from "node:path";
import type { DeputadoSp, IndiceSp, ResumoVotacaoSp, VotacaoPlenarioSp } from "./tipos";

/**
 * Leitura dos dados de São Paulo em web/content (somente servidor / build).
 * content/_gerado/sp.json é gerado por scripts/gerar-sao-paulo.mjs; o detalhe de uma votação
 * de Plenário vem de content/alesp/votacoes/<id>.json. As páginas são geradas no build e o
 * rastreamento de arquivos exclui content/ (next.config.ts).
 */
function lerOpcional<T>(arquivo: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")) as T;
  } catch {
    return null;
  }
}

const VAZIO: IndiceSp = {
  atualizado_em: null,
  periodo: null,
  lista_fonte: null,
  lista_atualizada_em: null,
  observacoes_lista: [],
  fontes_votacoes: [],
  contagens_votacoes: null,
  fontes_projetos: [],
  observacoes_projetos: [],
  projetos: { total: 0, por_sigla: {} },
  normas: { total: 0, por_ano_tipo: {}, atualizado_em: null, fontes: [], observacoes: [], recentes: [], vetos: 0 },
  deputados: [],
  votacoes: [],
  votos_por_deputado: {},
  ligacoes_icms: {},
};

let cache: IndiceSp | null = null;

export function getIndiceSp(): IndiceSp {
  if (!cache) cache = lerOpcional<IndiceSp>(path.join(process.cwd(), "content", "_gerado", "sp.json")) ?? VAZIO;
  return cache;
}

export function getDeputadoSp(id: string): DeputadoSp | null {
  return getIndiceSp().deputados.find((d) => d.id === id) ?? null;
}

export function votacoesPlenario(): ResumoVotacaoSp[] {
  return getIndiceSp().votacoes.filter((v) => v.plenario);
}

const ID_VOTACAO = /^[A-Za-z0-9-]{1,60}$/;

export function getVotacaoPlenario(id: string): VotacaoPlenarioSp | null {
  if (!ID_VOTACAO.test(id)) return null;
  const d = lerOpcional<VotacaoPlenarioSp>(path.join(process.cwd(), "content", "alesp", "votacoes", `${id}.json`));
  return d && String(d.id) === id && d.orgao === "Plenário" ? d : null;
}

export interface VotoDeputadoSp {
  votacao: ResumoVotacaoSp;
  voto: string;
  registros: number;
  marcador: string | null;
}

export function votosDoDeputadoSp(id: string): VotoDeputadoSp[] {
  const ind = getIndiceSp();
  return (ind.votos_por_deputado[id] ?? []).map(([i, voto, registros, marcador]) => ({
    votacao: ind.votacoes[i],
    voto,
    registros,
    marcador,
  }));
}

/** Ids gerados no build; com cacheComponents a lista não pode ser vazia (o marcador vira 404). */
export function idsOuMarcador(ids: string[]): string[] {
  return ids.length ? ids : ["sem-dados"];
}
