/**
 * Números oficiais, itens e filtros da lista única do Executivo (somente servidor / build).
 * Os números são contagens dos campos da fonte (situação da medida provisória; tipo do veto;
 * situação de cada trecho vetado no Congresso Nacional). Nada é deduzido.
 */
import { etiquetaDe, tituloSimplesDe } from "@/components/decisao";
import type { Faceta, GrupoNumeros, ItemFiltro } from "./componentes/ListaFiltros";
import type { TipoExplicado } from "./componentes/TiposExplicados";
import { montarCartao } from "./apresentacao";
import { cartaoMpv, cartaoVeto, padraoMpv, padraoVeto } from "./listas";
import { SITUACAO_DISPOSITIVO, TERMOS_EXECUTIVO, rotuloSituacaoMpv, rotuloTipoVeto } from "./rotulos";
import { getTitulos } from "./titulos";
import type { IndiceExecutivo, ResumoMpv, ResumoVeto } from "./tipos";

export const ATO_MPV = "Medida provisória";
export const ATO_VETO = "Veto";

/** Situação do trecho vetado (grafia da fonte) → opção do filtro. */
const TRECHO: Record<string, string> = {
  "Não Apreciado": "Com trecho não apreciado",
  Rejeitado: "Com trecho derrubado",
  Mantido: "Com trecho mantido",
  Prejudicado: "Com trecho prejudicado",
};

/** Situação oficial do veto (em maiúsculas na fonte) com grafia legível; o texto é o mesmo. */
export function situacaoVeto(s: string | null | undefined): string {
  if (!s) return "Situação não informada na fonte";
  const t = s.toLowerCase();
  return (t.charAt(0).toUpperCase() + t.slice(1))
    .replace(/\bplenário\b/g, "Plenário")
    .replace(/\bcongresso nacional\b/g, "Congresso Nacional");
}

function temaEEtiqueta(id: string): { tema: string | null; etiqueta: string | undefined } {
  const s = tituloSimplesDe(getTitulos("executivo"), id);
  return { tema: s?.tema?.trim() || null, etiqueta: etiquetaDe(s) ?? undefined };
}

function itemMpv(ind: IndiceExecutivo, m: ResumoMpv): ItemFiltro {
  const c = cartaoMpv(m);
  const t = temaEEtiqueta(m.id);
  return {
    id: m.id,
    cartao: { ...montarCartao(padraoMpv(ind), c.cartao), tema: t.tema, etiqueta: t.etiqueta },
    busca: c.busca,
    notas: c.notas,
    facetas: { ato: ATO_MPV, situacao: rotuloSituacaoMpv(m.situacao), tema: t.tema, ano: String(m.ano) },
  };
}

function itemVeto(ind: IndiceExecutivo, v: ResumoVeto): ItemFiltro {
  const c = cartaoVeto(v);
  const t = temaEEtiqueta(v.id);
  const trechos = Object.entries(v.situacao_dispositivos ?? {})
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([k]) => TRECHO[k] ?? `Com trecho: ${k}`);
  return {
    id: v.id,
    cartao: { ...montarCartao(padraoVeto(ind), c.cartao), tema: t.tema, etiqueta: t.etiqueta },
    busca: c.busca,
    facetas: {
      ato: ATO_VETO,
      tipoVeto: rotuloTipoVeto(v.tipo),
      situacao: situacaoVeto(v.situacao_oficial),
      trechos,
      tema: t.tema,
      ano: String(v.ano),
    },
  };
}

/** Medidas provisórias e vetos numa lista só, do mais recente para o mais antigo. */
export function itensExecutivo(ind: IndiceExecutivo, so?: "mpv" | "veto"): ItemFiltro[] {
  const mp = so === "veto" ? [] : ind.mpvs.map((m) => ({ data: m.data ?? "", n: m.numero, it: itemMpv(ind, m) }));
  const ve = so === "mpv" ? [] : ind.vetos.map((v) => ({ data: v.data_publicacao ?? "", n: v.numero, it: itemVeto(ind, v) }));
  return [...mp, ...ve].sort((a, b) => b.data.localeCompare(a.data) || b.n - a.n).map((x) => x.it);
}

export const FACETAS_EXECUTIVO: Faceta[] = [
  { chave: "ato", rotulo: "Tipo de ato", modo: "chips" },
  { chave: "situacao", rotulo: "Situação", modo: "chips", ajuda: "Como registrada pelo Congresso Nacional." },
  { chave: "tema", rotulo: "Tema do dia a dia", modo: "chips", ajuda: "Classificação do site a partir do assunto oficial." },
  { chave: "ano", rotulo: "Ano", modo: "chips", ordem: "decrescente" },
  { chave: "tipoVeto", rotulo: "Veto total ou parcial", modo: "chips", secundaria: true },
  {
    chave: "trechos",
    rotulo: "Trechos vetados",
    modo: "chips",
    secundaria: true,
    ajuda: "Vetos com ao menos um trecho nessa situação no Congresso Nacional.",
    ordem: ["Com trecho não apreciado", "Com trecho derrubado", "Com trecho mantido", "Com trecho prejudicado"],
  },
];

/** Situações da medida provisória na ordem do trâmite (rótulo no plural para o número). */
const SITUACOES_MPV: [string, string][] = [
  ["em tramitação", "Em tramitação no Congresso"],
  ["aprovada pelo Congresso, enviada à sanção", "Aprovadas e enviadas à sanção"],
  ["convertida em lei", "Convertidas em lei"],
  ["perdeu eficácia", "Perderam a eficácia"],
  ["revogada", "Revogadas"],
];

function fontesDe(fs: IndiceExecutivo["fontes_mpv"], coleta: string | null): GrupoNumeros["fontes"] {
  return fs.filter((f) => f?.url).map((f) => ({ titulo: f.titulo ?? f.url, url: f.url, orgao: f.orgao ?? null, acessado_em: f.acessado_em ?? coleta }));
}

function contar<T>(xs: T[], f: (x: T) => string | null | undefined): Record<string, number> {
  const m: Record<string, number> = {};
  for (const x of xs) {
    const k = f(x);
    if (k) m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

export function numerosMpv(ind: IndiceExecutivo): GrupoNumeros {
  const por = contar(ind.mpvs, (m) => m.situacao);
  const conhecidas = new Set(SITUACOES_MPV.map(([k]) => k));
  return {
    id: "numeros-mpv",
    titulo: "Medidas provisórias",
    descricao: "Situação de cada medida provisória registrada pelo Congresso Nacional.",
    fontes: fontesDe(ind.fontes_mpv, ind.atualizado_em),
    itens: [
      { valor: ind.mpvs.length, rotulo: "Medidas provisórias no total", filtro: { ato: ATO_MPV } },
      ...SITUACOES_MPV.filter(([k]) => por[k]).map(([k, r]) => ({ valor: por[k], rotulo: r, filtro: { ato: ATO_MPV, situacao: rotuloSituacaoMpv(k) } })),
      ...Object.keys(por)
        .filter((k) => !conhecidas.has(k))
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((k) => ({ valor: por[k], rotulo: rotuloSituacaoMpv(k), filtro: { ato: ATO_MPV, situacao: rotuloSituacaoMpv(k) } })),
    ],
  };
}

const TRECHOS_NUMERO: [string, string, string][] = [
  ["Não Apreciado", "Trechos ainda não votados", "“Não apreciado” na fonte"],
  ["Rejeitado", "Trechos com veto derrubado", "“Rejeitado” na fonte"],
  ["Mantido", "Trechos com veto mantido", "“Mantido” na fonte"],
  ["Prejudicado", "Trechos prejudicados", "“Prejudicado” na fonte"],
];

export function numerosVetos(ind: IndiceExecutivo): GrupoNumeros {
  const tipo = contar(ind.vetos, (v) => v.tipo);
  const trechos: Record<string, number> = {};
  for (const v of ind.vetos) for (const [k, n] of Object.entries(v.situacao_dispositivos ?? {})) trechos[k] = (trechos[k] ?? 0) + (n || 0);
  return {
    id: "numeros-vetos",
    titulo: "Vetos",
    descricao:
      "Cada veto pode ter vários trechos vetados, e o Congresso Nacional vota cada trecho separadamente. Os números de trechos contam trechos; ao tocar, a lista mostra os vetos com ao menos um trecho naquela situação.",
    fontes: fontesDe(ind.fontes_vetos, ind.atualizado_em),
    itens: [
      { valor: ind.vetos.length, rotulo: "Vetos no total", filtro: { ato: ATO_VETO } },
      ...(["parcial", "total"] as const)
        .filter((t) => tipo[t])
        .map((t) => ({ valor: tipo[t], rotulo: t === "parcial" ? "Vetos parciais" : "Vetos totais", filtro: { ato: ATO_VETO, tipoVeto: rotuloTipoVeto(t) } })),
      ...TRECHOS_NUMERO.filter(([k]) => trechos[k]).map(([k, r, e]) => ({ valor: trechos[k], rotulo: r, explicacao: e, filtro: { ato: ATO_VETO, trechos: TRECHO[k] } })),
    ],
  };
}

export const TIPOS_EXECUTIVO: TipoExplicado[] = [
  {
    termo: "Medida provisória",
    frase: "Ato do Presidente da República com força de lei, que vale desde a publicação e depois é votado pelo Congresso Nacional.",
    mais: [TERMOS_EXECUTIVO.mpv.explicacao, TERMOS_EXECUTIVO.perdaEficacia.explicacao, TERMOS_EXECUTIVO.plv.explicacao, TERMOS_EXECUTIVO.exposicao.explicacao],
    link: { href: "/executivo/medidas-provisorias", rotulo: "Página das medidas provisórias" },
  },
  {
    termo: "Veto",
    frase: "Recusa do Presidente da República a um projeto aprovado pelo Congresso Nacional, no todo (veto total) ou em parte (veto parcial).",
    mais: [TERMOS_EXECUTIVO.veto.explicacao, TERMOS_EXECUTIVO.vetoTotalParcial.explicacao, TERMOS_EXECUTIVO.sessaoConjunta.explicacao, TERMOS_EXECUTIVO.sobrestamento.explicacao],
    link: { href: "/executivo/vetos", rotulo: "Página dos vetos" },
  },
  {
    termo: "Trecho vetado: mantido, derrubado ou não apreciado",
    frase: "O Congresso Nacional vota cada trecho vetado separadamente e pode manter o veto ou derrubá-lo.",
    mais: [TERMOS_EXECUTIVO.dispositivo.explicacao, ...Object.values(SITUACAO_DISPOSITIVO).map((s) => `${s.rotulo}: ${s.explicacao}`)],
  },
  {
    termo: "Leis e decretos",
    frase: "Leis são aprovadas pelo Congresso Nacional e sancionadas; decretos são atos do Presidente da República, sem votação.",
    mais: [TERMOS_EXECUTIVO.lei.explicacao, TERMOS_EXECUTIVO.decreto.explicacao, TERMOS_EXECUTIVO.dou.explicacao],
    link: { href: "/executivo/leis-e-decretos", rotulo: "Buscar leis e decretos" },
  },
];
