/**
 * Itens da lista única da Justiça a partir dos índices estáticos (public/justica/stj-temas.json e
 * stf-temas.json). Funções puras, seguras no navegador. Nada é deduzido: o resultado só aparece
 * quando o trecho oficial diz "por unanimidade" ou "por maioria" (scripts/gerar-executivo-justica.mjs);
 * o tema do dia a dia vem do arquivo de títulos (regras publicadas em dados/titulos/temas.json).
 */
import type { Faceta, ItemFiltro } from "@/features/executivo/componentes/ListaFiltros";
import { encurtar } from "@/features/executivo/apresentacao";
import type { LinhaTemaStf, LinhaTemaStj } from "./tipos";
import { QUEM_STF, QUEM_STJ, dadoResultadoStf, nomeTemaStj, processoPorExtenso } from "./apresentacao";
import { COLECOES, rotuloOrgao } from "./rotulos";

export const TRIBUNAL_STJ = "Superior Tribunal de Justiça (STJ)";
export const TRIBUNAL_STF = "Supremo Tribunal Federal (STF)";
export const COM_TESE = "Com tese registrada";
export const SEM_TESE = "Sem tese registrada";

const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

/**
 * Nome do relator para o filtro: tira o tratamento ("MIN.", "MINISTRO") e a observação
 * "(Presidente)" e usa maiúsculas só nas iniciais. O cartão continua com o texto da fonte.
 */
export function nomeRelator(r: string | null | undefined): string | null {
  const t = (r ?? "")
    .replace(/^\s*MIN(?:ISTR[OA])?\.?\s+(?!PRESIDENTE\b)/i, "")
    .replace(/\s*\(\s*presidente\s*\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  if (t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i && PARTICULAS.has(p) ? p : p.replace(/^(\(?)(\p{L})/u, (_m, a: string, l: string) => a + l.toUpperCase())))
    .join(" ");
}

function colecoesDe(c: string[] | null | undefined): string[] {
  return (c ?? []).map((k) => COLECOES[k]?.titulo ?? k);
}

export interface ArquivoStj {
  url_modelo: string;
  t: LinhaTemaStj[];
}

export function itensStj(j: ArquivoStj, coletadoEm: string | null): ItemFiltro[] {
  return j.t.map((l) => {
    const [numero, tipo, situacao, orgao, relator, questao, tese, colecoes, comPagina, data, url, simples, tema, etiqueta, resultado, trecho, tipoData] = l;
    const urlOficial = url === 1 ? j.url_modelo.replaceAll("{n}", numero) : url;
    const orgaoLegivel = orgao ? rotuloOrgao(orgao) : null;
    const relatores = (relator ?? "").split(/\s*;\s*/).map(nomeRelator).filter((x): x is string => !!x);
    const notas = [
      !tese ? "Sem tese registrada na fonte oficial." : null,
      !comPagina ? "Este tema não tem página própria no site: o link leva à página oficial do tribunal." : null,
    ].filter((x): x is string => !!x);
    return {
      id: `stj-${numero}`,
      cartao: {
        href: comPagina ? `/justica/stj/temas/${numero}` : (urlOficial ?? "/justica/stj"),
        tituloOficial: encurtar(tese, 140) ?? encurtar(questao, 140) ?? `${tipo ?? "Tema"} ${numero}`,
        simples: simples ? { titulo: simples, origem: "estruturado", verificacao: { aprovado_pelo_verificador: true } } : null,
        subtituloOficial: `${nomeTemaStj({ tipo_precedente: tipo, numero, orgao })}${situacao ? ` · ${situacao}` : ""}`,
        caminho: "stj",
        data,
        rotuloData: tipoData === "j" ? "julgado em" : tipoData === "a" ? "afetado em" : undefined,
        forma: "julgamento",
        dado: trecho
          ? { tipo: "texto", rotulo: "Resultado do julgamento do mérito (texto oficial)", texto: `“${trecho}”` }
          : situacao
            ? { tipo: "texto", rotulo: "Situação", texto: situacao }
            : null,
        quemDecidiu: QUEM_STJ(orgao, relator),
        fonte: urlOficial ? { url: urlOficial, titulo: "Página oficial do tema", orgao: "Superior Tribunal de Justiça", acessado_em: coletadoEm } : null,
        tema: tema ?? null,
        etiqueta: etiqueta ?? undefined,
        compartilhar: !!comPagina,
      },
      busca: `${numero} ${questao ?? ""} ${tese ?? ""} ${relator ?? ""}`,
      notas,
      facetas: {
        tribunal: TRIBUNAL_STJ,
        tipo,
        situacao,
        orgao: orgaoLegivel,
        relator: relatores,
        ano: data ? data.slice(0, 4) : null,
        tema: tema ?? null,
        resultado: resultado ?? [],
        colecao: colecoesDe(colecoes),
        tese: tese ? COM_TESE : SEM_TESE,
      },
    };
  });
}

const ROTULO_DATA_STF: Record<string, string> = { j: "julgado em", t: "tese de", r: "repercussão geral analisada em" };

export function itensStf(j: { t: LinhaTemaStf[] }, coletadoEm: string | null): ItemFiltro[] {
  return j.t.map((l) => {
    const [numero, titulo, situacao, andamento, relator, leadingCase, tese, colecoes, comPagina, url, descricao, simples, tema, etiqueta, resultado, trecho, data, tipoData, orgao] = l;
    const lc = processoPorExtenso(leadingCase);
    const nomeRel = nomeRelator(relator);
    const notas = [
      situacao ? `Repercussão geral: ${situacao}` : null,
      !tese ? "Sem tese registrada na fonte oficial." : null,
      !comPagina ? "Este tema não tem página própria no site: o link leva à página oficial do tribunal." : null,
    ].filter((x): x is string => !!x);
    return {
      id: `stf-${numero}`,
      cartao: {
        href: comPagina ? `/justica/stf/temas/${numero}` : (url ?? "/justica/stf"),
        tituloOficial: encurtar(tese, 140) ?? encurtar(titulo, 140) ?? encurtar(descricao, 140) ?? `Tema ${numero} do Supremo Tribunal Federal`,
        simples: simples ? { titulo: simples, origem: "estruturado", verificacao: { aprovado_pelo_verificador: true } } : null,
        subtituloOficial: `Tema ${numero} de repercussão geral · Supremo Tribunal Federal (STF)${lc ? ` · processo paradigma: ${lc}` : ""}`,
        caminho: "stf",
        data: data ?? null,
        rotuloData: tipoData ? ROTULO_DATA_STF[tipoData] : undefined,
        forma: "julgamento",
        dado: dadoResultadoStf(trecho, 200) ?? (andamento ? { tipo: "texto", rotulo: "Situação", texto: andamento } : null),
        quemDecidiu: QUEM_STF(orgao ?? null, relator),
        fonte: url ? { url, titulo: "Página oficial do tema", orgao: "Supremo Tribunal Federal", acessado_em: coletadoEm } : null,
        tema: tema ?? null,
        etiqueta: etiqueta ?? undefined,
        compartilhar: !!comPagina,
      },
      busca: `${numero} ${titulo ?? ""} ${descricao ?? ""} ${tese ?? ""} ${relator ?? ""} ${leadingCase ?? ""}`,
      notas,
      facetas: {
        tribunal: TRIBUNAL_STF,
        tipo: "Tema de repercussão geral",
        situacao: andamento,
        repercussao: situacao,
        orgao: orgao ? rotuloOrgao(orgao) : null,
        relator: nomeRel ? [nomeRel] : [],
        ano: data ? data.slice(0, 4) : null,
        tema: tema ?? null,
        resultado: resultado ?? [],
        colecao: colecoesDe(colecoes),
        tese: tese ? COM_TESE : SEM_TESE,
      },
    };
  });
}

/** Ordem cronológica (mais recente primeiro); sem data, no fim, pelo número. */
export function ordenarItens(itens: ItemFiltro[]): ItemFiltro[] {
  const num = (i: ItemFiltro) => Number(i.id.replace(/^\D+/, "").replace(/\D.*$/, "")) || 0;
  return [...itens].sort((a, b) => String(b.cartao.data ?? "").localeCompare(String(a.cartao.data ?? "")) || num(b) - num(a));
}

export const FACETAS_JUSTICA: Faceta[] = [
  { chave: "relator", rotulo: "Ministro relator", modo: "lista", contagem: false, ajuda: "Como registrado pelo tribunal, em ordem alfabética." },
  { chave: "ano", rotulo: "Ano", modo: "lista", ordem: "decrescente", ajuda: "Da data mostrada no cartão." },
  { chave: "tribunal", rotulo: "Tribunal", modo: "chips" },
  { chave: "tipo", rotulo: "Tipo", modo: "chips" },
  { chave: "tema", rotulo: "Tema do dia a dia", modo: "chips", ajuda: "Classificação do site a partir dos assuntos oficiais registrados pelo tribunal." },
  {
    chave: "resultado",
    rotulo: "Resultado, como escrito no texto oficial",
    modo: "chips",
    ajuda: "Só nos julgamentos com o texto oficial coletado e só quando o texto diz “por unanimidade” ou “por maioria”.",
  },
  { chave: "situacao", rotulo: "Situação", modo: "chips", secundaria: true, ajuda: "Como registrada pelo tribunal." },
  { chave: "repercussao", rotulo: "Repercussão geral (STF)", modo: "chips", secundaria: true },
  { chave: "orgao", rotulo: "Órgão julgador", modo: "chips", secundaria: true },
  { chave: "tese", rotulo: "Tese", modo: "chips", secundaria: true, ordem: [COM_TESE, SEM_TESE] },
  { chave: "colecao", rotulo: "Acompanhados de perto", modo: "chips", secundaria: true, todos: "Todos" },
];
