import fs from "node:fs";
import path from "node:path";
import type { DeputadoEstado, IndiceEstado, ResumoUf, ResumoVotacao, VotacaoPlenario } from "./tipos";
import { UFS, getUf } from "./ufs";

/**
 * Leitura dos dados da seção Estados em web/content (somente servidor / build).
 * content/_gerado/estados/*.json vem de scripts/gerar-estados.mjs. O detalhe de uma votação de
 * Plenário vem do arquivo da coleta: content/estados/<uf>/votacoes/<id>.json; em SP, por
 * adaptador, content/alesp/votacoes/<id>.json (os dados não mudaram de pasta).
 * As páginas são geradas no build; content/ não entra no pacote das funções.
 */
function lerOpcional<T>(arquivo: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")) as T;
  } catch {
    return null;
  }
}

const GERADO = () => path.join(process.cwd(), "content", "_gerado", "estados");

let presentes: Record<string, ResumoUf> | null = null;

/** UFs com dados coletados e suas contagens. */
export function getPresentes(): Record<string, ResumoUf> {
  if (!presentes) presentes = lerOpcional<{ ufs: Record<string, ResumoUf> }>(path.join(GERADO(), "indice.json"))?.ufs ?? {};
  return presentes;
}

/** UFs com dados, na ordem alfabética do nome do estado. */
export function ufsComDados(): string[] {
  const p = getPresentes();
  return UFS.filter((u) => p[u.uf]).map((u) => u.uf);
}

const cache = new Map<string, IndiceEstado | null>();

export function getIndiceEstado(uf: string): IndiceEstado | null {
  const u = getUf(uf);
  if (!u) return null;
  if (!cache.has(u.uf)) cache.set(u.uf, getPresentes()[u.uf] ? lerOpcional<IndiceEstado>(path.join(GERADO(), `${u.uf}.json`)) : null);
  return cache.get(u.uf) ?? null;
}

export function getDeputado(uf: string, id: string): DeputadoEstado | null {
  return getIndiceEstado(uf)?.deputados.find((d) => d.id === id) ?? null;
}

export function votacoesPlenario(uf: string): ResumoVotacao[] {
  return getIndiceEstado(uf)?.votacoes.filter((v) => v.plenario) ?? [];
}

const ID = /^[A-Za-z0-9-]{1,60}$/;

function arquivoVotacao(uf: string, id: string): string {
  return uf === "sp"
    ? path.join(process.cwd(), "content", "alesp", "votacoes", `${id}.json`)
    : path.join(process.cwd(), "content", "estados", uf, "votacoes", `${id}.json`);
}

/**
 * Votação de Plenário. Os votos individuais só são mantidos quando a fonte registra a votação
 * como nominal (diretriz 5); nas demais, a lista volta vazia.
 */
export function getVotacaoPlenario(uf: string, id: string): VotacaoPlenario | null {
  const u = getUf(uf);
  if (!u || !ID.test(id) || !getPresentes()[u.uf]) return null;
  const d = lerOpcional<VotacaoPlenario>(arquivoVotacao(u.uf, id));
  if (!d || String(d.id) !== id || !(d.orgao === "Plenário" || d.orgao_sigla === "PLEN")) return null;
  const nominal = String(d.tipo ?? "").toLowerCase() === "nominal";
  return { ...d, votos: nominal && Array.isArray(d.votos) ? d.votos : [], lacunas: Array.isArray(d.lacunas) ? d.lacunas : [] };
}

export interface VotoDeputado {
  votacao: ResumoVotacao;
  voto: string;
  registros: number;
  marcador: string | null;
}

export function votosDoDeputado(uf: string, id: string): VotoDeputado[] {
  const ind = getIndiceEstado(uf);
  if (!ind) return [];
  return (ind.votos_por_deputado[id] ?? []).map(([i, voto, registros, marcador]) => ({ votacao: ind.votacoes[i], voto, registros, marcador }));
}

/** Com cacheComponents a lista de parâmetros não pode ser vazia: o marcador vira 404. */
export function ouMarcador<T>(lista: T[], marcador: T): T[] {
  return lista.length ? lista : [marcador];
}

/** Parâmetros {uf} das UFs com dados. */
export function paramsUfsComDados(): { uf: string }[] {
  return ouMarcador(ufsComDados().map((uf) => ({ uf })), { uf: "sem-dados" });
}
