/**
 * Identificadores de favoritos e reações. Sem dependências (lido por páginas estáticas, pelas
 * rotas de API, pelo navegador e pelos testes).
 *
 * Formato: "<origem>:<id do site>". Cada origem tem o formato exato dos ids usados nas páginas
 * (o mesmo que as funções de leitura de dados aceitam), e nada fora disso é gravado.
 *
 *   Propostas / decisões (favoritos do tipo "proposta" e reações):
 *     camara-votacao:2620905-56   /congresso/votacoes/camara/2620905-56
 *     senado-votacao:7108         /congresso/votacoes/senado/7108
 *     sp-votacao:12345            /estados/sp/votacoes/12345   (qualquer UF)
 *     executivo:mpv-1398-2026     /executivo/medidas-provisorias/mpv-1398-2026
 *     executivo:vet-55-2026       /executivo/vetos/vet-55-2026
 *     icms:confaz-convenio-127-2024  /impostos/icms/confaz-convenio-127-2024
 *     stf-julgamento:stf-adi-7616    /justica/stf/julgamentos/stf-adi-7616
 *     stf-tema:1265                  /justica/stf/temas/1265
 *     stj-tema:1076                  /justica/stj/temas/1076
 *   Políticos:
 *     camara:204554 · senado:5012 · sp-deputado:12345 (deputado estadual, qualquer UF)
 *   Estados: sigla da UF em maiúsculas ("SP"). Temas: id do catálogo de regras.ts.
 */

export const SIGLAS_UF = [
  "ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg", "pa",
  "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "sp", "se", "to",
] as const;

const UF = `(?:${SIGLAS_UF.join("|")})`;

/** Ids de votação do Congresso: os mesmos aceitos por getVotacao (features/congresso/dados). */
const ID_CONGRESSO = "[A-Za-z0-9.-]{1,40}";
/** Ids de votação estadual: os mesmos aceitos por getVotacaoPlenario (features/estados/dados). */
const ID_ESTADO = "[A-Za-z0-9-]{1,60}";

/**
 * Justiça: julgamentos do STF (nome do arquivo em content/stf/julgamentos, ex.: stf-adi-7616) e
 * temas do STF e do STJ (o número, como em getTemaStf / getTemaStj).
 */
const ID_JUSTICA = "stf-julgamento:stf-[a-z0-9]{1,20}(?:-[a-z0-9]{1,20}){0,8}|(?:stf|stj)-tema:[1-9]\\d{0,4}";

const RE_PROPOSTA = new RegExp(
  `^(?:(?:camara|senado)-votacao:${ID_CONGRESSO}|${UF}-votacao:${ID_ESTADO}|executivo:(?:mpv-\\d{1,5}-\\d{4}|vet-\\d{1,4}-\\d{4})|icms:[a-z0-9][a-z0-9-]{0,99}|${ID_JUSTICA})$`,
);
const RE_POLITICO = new RegExp(`^(?:(?:camara|senado):\\d{1,10}|${UF}-deputado:[A-Za-z0-9-]{1,40})$`);

export type TipoFavorito = "uf" | "tema" | "politico" | "proposta";
export const TIPOS_FAVORITO: readonly TipoFavorito[] = ["uf", "tema", "politico", "proposta"];

export function ehIdProposta(v: unknown): v is string {
  return typeof v === "string" && v.length <= 120 && RE_PROPOSTA.test(v);
}

export function ehIdPolitico(v: unknown): v is string {
  return typeof v === "string" && v.length <= 60 && RE_POLITICO.test(v);
}

export function ehTipoFavorito(v: unknown): v is TipoFavorito {
  return typeof v === "string" && (TIPOS_FAVORITO as readonly string[]).includes(v);
}

// ── Montagem dos ids a partir das rotas (usada pelas páginas) ──────────────────────────────

export const idVotacaoCongresso = (casa: "camara" | "senado", id: string) => `${casa}-votacao:${id}`;
export const idVotacaoEstado = (uf: string, id: string) => `${uf.toLowerCase()}-votacao:${id}`;
export const idExecutivo = (id: string) => `executivo:${id}`;
export const idIcms = (id: string) => `icms:${id}`;
export const idJulgamentoStf = (id: string) => `stf-julgamento:${id}`;
export const idTemaJustica = (tribunal: "stf" | "stj", n: string | number) => `${tribunal}-tema:${n}`;
export const idParlamentar = (casa: "camara" | "senado", id: string) => `${casa}:${id}`;
export const idDeputadoEstadual = (uf: string, id: string) => `${uf.toLowerCase()}-deputado:${id}`;

/** Endereço da página de um favorito do tipo "proposta" ou "politico" (para a Minha conta). */
export function hrefDoId(id: string): string | null {
  const i = id.indexOf(":");
  if (i < 0) return null;
  const origem = id.slice(0, i);
  const resto = encodeURIComponent(id.slice(i + 1));
  if (origem === "camara-votacao") return `/congresso/votacoes/camara/${resto}`;
  if (origem === "senado-votacao") return `/congresso/votacoes/senado/${resto}`;
  if (origem === "executivo") return resto.startsWith("mpv-") ? `/executivo/medidas-provisorias/${resto}` : `/executivo/vetos/${resto}`;
  if (origem === "icms") return `/impostos/icms/${resto}`;
  if (origem === "stf-julgamento") return `/justica/stf/julgamentos/${resto}`;
  if (origem === "stf-tema" || origem === "stj-tema") return `/justica/${origem.slice(0, 3)}/temas/${resto}`;
  if (origem === "camara" || origem === "senado") return `/congresso/${origem}/parlamentares/${resto}`;
  const m = /^([a-z]{2})-(votacao|deputado)$/.exec(origem);
  if (m) return m[2] === "votacao" ? `/estados/${m[1]}/votacoes/${resto}` : `/estados/${m[1]}/deputados/${resto}`;
  return null;
}

/**
 * Caminho de volta depois do login: só caminhos relativos do próprio site (nunca "//", "\\",
 * esquema ou host), até 300 caracteres. Qualquer outro valor vira null.
 */
export function caminhoDeVolta(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 300) return null;
  if (!/^\/(?![/\\])[A-Za-z0-9/_\-.~%]*$/.test(v)) return null;
  return v;
}

/**
 * Inverso de hrefDoId para as páginas de proposta: o id do site a partir do endereço da página
 * (usado pelo Cartão de Decisão, que só recebe o href). Fora desses formatos, null.
 */
export function idPropostaDoHref(href: string): string | null {
  let caminho = href.split(/[?#]/)[0];
  try {
    caminho = decodeURIComponent(caminho);
  } catch {
    return null;
  }
  let m = /^\/congresso\/votacoes\/(camara|senado)\/([^/]+)$/.exec(caminho);
  let id: string | null = null;
  if (m) id = `${m[1]}-votacao:${m[2]}`;
  else if ((m = /^\/estados\/([a-z]{2})\/votacoes\/([^/]+)$/.exec(caminho))) id = `${m[1]}-votacao:${m[2]}`;
  else if ((m = /^\/executivo\/(?:medidas-provisorias|vetos)\/([^/]+)$/.exec(caminho))) id = `executivo:${m[1]}`;
  else if ((m = /^\/impostos\/icms\/([^/]+)$/.exec(caminho))) id = `icms:${m[1]}`;
  else if ((m = /^\/justica\/stf\/julgamentos\/([^/]+)$/.exec(caminho))) id = `stf-julgamento:${m[1]}`;
  else if ((m = /^\/justica\/(stf|stj)\/temas\/([^/]+)$/.exec(caminho))) id = `${m[1]}-tema:${m[2]}`;
  return id && ehIdProposta(id) ? id : null;
}

/**
 * Parte do catálogo (rota /api/conta/catalogo/<parte>) onde está o id de uma proposta ou de um
 * político: "camara", "senado", "executivo", "icms", "justica" (STF e STJ) ou a sigla da UF em
 * minúsculas.
 */
export function parteDoId(id: string): string | null {
  const origem = id.slice(0, Math.max(0, id.indexOf(":")));
  if (origem === "camara" || origem === "camara-votacao") return "camara";
  if (origem === "senado" || origem === "senado-votacao") return "senado";
  if (origem === "executivo" || origem === "icms") return origem;
  if (origem === "stf-julgamento" || origem === "stf-tema" || origem === "stj-tema") return "justica";
  const m = /^([a-z]{2})-(?:votacao|deputado)$/.exec(origem);
  return m && (SIGLAS_UF as readonly string[]).includes(m[1]) ? m[1] : null;
}
