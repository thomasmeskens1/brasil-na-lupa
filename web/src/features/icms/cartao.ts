/**
 * Conversão de uma decisão do ICMS para o Cartão de Decisão e o cabeçalho de detalhe
 * (@/components/decisao). Funções puras, seguras no navegador. Nada é deduzido (diretriz 1):
 * o dado-chave vem dos campos do documento (mudancas, placar) ou do caminho da decisão.
 */
import type { DadoChave, FonteResumo, FormaDecisao, TituloSimples } from "@/components/decisao/tipos";
import { placarOficial } from "@/components/decisao/rotulos";
import { CAMINHO_POR_ID, CASA, formatarData, nomeDoAto } from "./rotulos";
import type { Decisao, Votacao } from "./tipos";

const PARLAMENTO = ["camara", "senado", "alesp", "congresso"];

/** Votações de deputados ou senadores (exclui o registro do CONFAZ). */
function votacoesParlamentares(d: Decisao): Votacao[] {
  return (d.votacoes ?? []).filter((v) => PARLAMENTO.includes(v.casa));
}

/**
 * Votação nominal de referência para o cartão: a mais recente com placar; empate de data fica
 * com a primeira registrada na fonte (ordem do documento).
 */
export function votacaoDeReferencia(d: Decisao): Votacao | null {
  const nominais = votacoesParlamentares(d).filter((v) => v.tipo === "nominal" && v.placar);
  let ref: Votacao | null = null;
  for (const v of nominais) if (!ref || (v.data ?? "") > (ref.data ?? "")) ref = v;
  return ref;
}

/** Forma da decisão (diretriz 5). Sem registro, fica ausente. */
export function formaDe(d: Decisao): FormaDecisao | null {
  if (d.caminho === "confaz") return "colegiado";
  if (d.caminho === "governador-sp" || d.caminho === "presidencia") return "ato-individual";
  const v = votacoesParlamentares(d);
  if (v.some((x) => x.tipo === "nominal")) return "votacao-nominal";
  if (v.some((x) => x.tipo === "simbolica")) return "votacao-simbolica";
  return null;
}

const SEM_VOTACAO: Partial<Record<Decisao["caminho"], string>> = {
  confaz: "CONFAZ (Conselho Nacional de Política Fazendária), pelos representantes dos estados e do Distrito Federal",
  "governador-sp": "decreto do governador de São Paulo (ato individual)",
  presidencia: "ato individual do presidente da República",
};

/** Dado-chave: antes → depois (quando o documento traz valores), placar nominal ou o caminho. */
export function dadoDe(d: Decisao): DadoChave | null {
  const m = (d.mudancas ?? [])[0];
  if (m && (m.antes || m.depois)) {
    return {
      tipo: "mudanca",
      item: m.item,
      antes: m.antes,
      depois: m.depois,
      unidade: m.unidade ?? null,
      vigencia: m.vigencia ?? d.datas?.vigencia ?? null,
    };
  }
  const ref = votacaoDeReferencia(d);
  if (ref?.placar) return { tipo: "placar", itens: placarOficial({ ...ref.placar }) };
  const sem = SEM_VOTACAO[d.caminho];
  if (sem) return { tipo: "sem-votacao", caminho: sem };
  if (votacoesParlamentares(d).some((v) => v.tipo === "simbolica")) return { tipo: "simbolica" };
  return null;
}

/** Linha que acompanha o placar no cartão (de qual votação ele é). */
export function legendaDoPlacar(d: Decisao): string | null {
  const ref = votacaoDeReferencia(d);
  if (!ref) return null;
  const n = votacoesParlamentares(d).length;
  return `Placar da votação de ${formatarData(ref.data)} (${CASA[ref.casa] ?? ref.casa})${n > 1 ? ` · ${n} votações registradas` : ""}`;
}

/** Atos agrupados (ex.: dez decretos de procedimento num só registro). */
export function quantosAtos(d: Decisao): number {
  return d.numero ? d.numero.split(",").filter((x) => x.trim()).length : 1;
}

/** Nome oficial por extenso para o subtítulo; agrupados mostram a contagem. */
export function nomeOficialCurto(d: Decisao): string {
  const n = quantosAtos(d);
  return n > 1 ? `${n} atos (${d.instrumento}) reunidos neste registro` : nomeDoAto(d);
}

/** Data principal (AAAA-MM-DD): decisão, publicação ou o fim do período de publicação. */
export function dataDe(d: Decisao): string | null {
  const periodo = (d.datas as { periodo_publicacao?: string[] } | undefined)?.periodo_publicacao;
  return d.datas?.decisao ?? d.datas?.publicacao ?? (Array.isArray(periodo) ? (periodo[periodo.length - 1] ?? null) : null);
}

export function quemDecidiuDe(d: Decisao): string {
  return CAMINHO_POR_ID[d.caminho]?.quem ?? d.orgao ?? "";
}

export function fontePrincipalDe(d: Decisao): FonteResumo | null {
  const f = d.fontes?.[0];
  if (!f?.url) return null;
  return { url: f.url, titulo: f.titulo, orgao: f.orgao ?? null, acessado_em: f.acessado_em ?? null, tipo: /\.pdf($|\?)/i.test(f.url) ? "pdf" : "oficial" };
}

/** Item serializável da lista do ICMS (componente cliente). */
export interface ItemListaIcms {
  id: string;
  href: string;
  tituloOficial: string;
  simples: TituloSimples | null;
  subtitulo: string;
  caminho: Decisao["caminho"];
  data: string | null;
  ano: string | null;
  forma: FormaDecisao | null;
  dado: DadoChave | null;
  legenda: string | null;
  maisMudancas: number;
  quem: string;
  fonte: FonteResumo | null;
  tema: string | null;
  /** Texto normalizado para a busca (título, resumo, ato, itens que mudaram). */
  busca: string;
}

export function normalizar(t: string): string {
  return t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function itemDaLista(d: Decisao, simples: TituloSimples | null): ItemListaIcms {
  const data = dataDe(d);
  const mud = d.mudancas ?? [];
  const textoBusca = [d.titulo, d.resumo, nomeDoAto(d), simples?.titulo, ...mud.map((m) => m.item)].filter(Boolean).join(" ");
  return {
    id: d.id,
    href: `/impostos/icms/${d.id}`,
    tituloOficial: d.titulo,
    simples,
    subtitulo: nomeOficialCurto(d),
    caminho: d.caminho,
    data,
    ano: data ? data.slice(0, 4) : null,
    forma: formaDe(d),
    dado: dadoDe(d),
    legenda: legendaDoPlacar(d),
    maisMudancas: Math.max(0, mud.length - 1),
    quem: quemDecidiuDe(d),
    fonte: fontePrincipalDe(d),
    tema: simples?.tema ?? null,
    busca: normalizar(textoBusca),
  };
}
