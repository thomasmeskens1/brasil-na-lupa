import fs from "node:fs";
import path from "node:path";
import type { Casa, IndiceCasa, Parlamentar, ResumoVotacao, VotacaoDetalhe } from "./tipos";

/**
 * Leitura dos dados do Congresso em web/content (somente servidor / build).
 * content/congresso/<casa>.json é gerado por scripts/gerar-congresso.mjs; o detalhe
 * de cada votação vem de content/<casa>/votacoes/<id>.json. As páginas são geradas
 * no build; o rastreamento de arquivos dessas rotas exclui content/ (next.config.ts),
 * e um id desconhecido em tempo de execução resulta em 404.
 */
function lerOpcional<T>(arquivo: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")) as T;
  } catch {
    return null;
  }
}

const VAZIO = (casa: Casa): IndiceCasa => ({
  casa,
  atualizado_em: null,
  lista_atualizada_em: null,
  lista_fonte: null,
  fontes: [],
  periodo: null,
  observacoes: [],
  parlamentares: [],
  votacoes: [],
  votos_por_parlamentar: {},
});

const cache = new Map<Casa, IndiceCasa>();
const cachePorId = new Map<Casa, Map<string, Parlamentar>>();

export function getIndice(casa: Casa): IndiceCasa {
  const c = cache.get(casa);
  if (c) return c;
  const arquivo =
    casa === "camara"
      ? path.join(process.cwd(), "content", "congresso", "camara.json")
      : path.join(process.cwd(), "content", "congresso", "senado.json");
  const lido = lerOpcional<IndiceCasa>(arquivo) ?? VAZIO(casa);
  cache.set(casa, lido);
  return lido;
}

export function getParlamentar(casa: Casa, id: string): Parlamentar | null {
  let m = cachePorId.get(casa);
  if (!m) {
    m = new Map(getIndice(casa).parlamentares.map((p) => [p.id, p]));
    cachePorId.set(casa, m);
  }
  return m.get(id) ?? null;
}

/** Ids com página de perfil (lista oficial + quem aparece em votação nominal). */
export function idsComPerfil(casa: Casa): Set<string> {
  return new Set(getIndice(casa).parlamentares.map((p) => p.id));
}

const ID_VALIDO = /^[A-Za-z0-9.-]{1,40}$/;

export function getVotacao(casa: Casa, id: string): VotacaoDetalhe | null {
  if (!ID_VALIDO.test(id)) return null;
  const arquivo =
    casa === "camara"
      ? path.join(process.cwd(), "content", "camara", "votacoes", `${id}.json`)
      : path.join(process.cwd(), "content", "senado", "votacoes", `${id}.json`);
  const d = lerOpcional<VotacaoDetalhe>(arquivo);
  return d && String(d.id) === id ? d : null;
}

/** Votações mais recentes (o índice já vem em ordem cronológica decrescente). */
export function votacoesRecentes(casa: Casa, n: number): ResumoVotacao[] {
  return getIndice(casa).votacoes.slice(0, n);
}

export interface VotoDoParlamentar {
  votacao: ResumoVotacao;
  voto: string | null;
}

export function votosDoParlamentar(casa: Casa, id: string): VotoDoParlamentar[] {
  const ind = getIndice(casa);
  return (ind.votos_por_parlamentar[id] ?? []).map(([i, voto]) => ({ votacao: ind.votacoes[i], voto }));
}
