/**
 * Dados do cabeçalho "resposta primeiro" dos temas e julgamentos do STJ e do STF, usados pela
 * página, pelos metadados de compartilhamento e pela imagem Open Graph (somente servidor / build).
 */
import { resolverTitulo, tituloSimplesDe, type DadoChave, type FonteResumo, type TituloSimples } from "@/components/decisao";
import { getTitulos } from "@/features/executivo/titulos";
import type { JulgamentoStf, TemaStf, TemaStj } from "./tipos";
import {
  dadoResultadoStf,
  nomeTemaStf,
  nomeTemaStj,
  processoPorExtenso,
  resultadoCertidao,
  simplesUtil,
  tituloReservaJulgamentoStf,
  tituloReservaStf,
  tituloReservaStj,
} from "./apresentacao";

export interface CabecalhoJustica {
  tituloOficial: string;
  simples: TituloSimples | null;
  subtituloOficial: string;
  data: string | null;
  dado: DadoChave | null;
  fontePrincipal: FonteResumo | null;
  titulo: string;
  subtitulo: string | null;
}

function fim(c: Omit<CabecalhoJustica, "titulo" | "subtitulo">): CabecalhoJustica {
  const t = resolverTitulo(c);
  return { ...c, titulo: t.titulo, subtitulo: t.subtitulo };
}

const SEM_TESE = "Tese ainda não firmada ou não disponível em fonte oficial";

export function cabecalhoTemaStj(t: TemaStj): CabecalhoJustica {
  return fim({
    tituloOficial: tituloReservaStj(t),
    simples: simplesUtil(tituloSimplesDe(getTitulos("stj"), `stj-tema-${t.numero}`)),
    subtituloOficial: `${nomeTemaStj(t)}${t.situacao ? ` · ${t.situacao}` : ""}`,
    data: t.datas?.julgamento ?? t.datas?.afetacao ?? null,
    dado: { tipo: "texto", rotulo: "Tese firmada (texto oficial)", texto: t.tese?.trim() || SEM_TESE },
    fontePrincipal: t.url_oficial
      ? { url: t.url_oficial, titulo: "Página oficial do tema no STJ", orgao: "Superior Tribunal de Justiça", acessado_em: t.pagina_oficial?.verificado_em ?? t.atualizado_em }
      : null,
  });
}

export function cabecalhoTemaStf(t: TemaStf): CabecalhoJustica {
  const situacao = t.situacao?.andamento ?? t.situacao?.repercussao_geral ?? null;
  return fim({
    tituloOficial: tituloReservaStf(t),
    simples: simplesUtil(tituloSimplesDe(getTitulos("stf"), `stf-tema-${t.numero}`)),
    subtituloOficial: `${nomeTemaStf(t)}${situacao ? ` · ${situacao}` : ""}`,
    data: t.data_tese ?? t.situacao?.data_repercussao_geral ?? null,
    dado: { tipo: "texto", rotulo: "Tese firmada (texto oficial)", texto: t.tese?.trim() || SEM_TESE },
    fontePrincipal: t.url ? { url: t.url, titulo: "Página oficial do tema no STF", orgao: "Supremo Tribunal Federal", acessado_em: t.atualizado_em } : null,
  });
}

export function cabecalhoJulgamentoStf(j: JulgamentoStf, id: string): CabecalhoJustica {
  const ident = j.processo?.identificacao ?? ([j.processo?.classe, j.processo?.numero].filter(Boolean).join(" ") || id);
  const tema = j.precedente?.tipo === "repercussao-geral" && j.precedente.numero != null ? String(j.precedente.numero) : null;
  const fonte = j.certidao_fonte?.url ?? j.processo?.url ?? null;
  return fim({
    tituloOficial: tituloReservaJulgamentoStf({ certidao: j.certidao_literal, ementa: j.ementa, identificacao: ident }),
    simples: simplesUtil(tituloSimplesDe(getTitulos("stf"), id)),
    subtituloOficial: [processoPorExtenso(ident), tema ? `Tema ${tema} de repercussão geral` : null, "Supremo Tribunal Federal (STF)"]
      .filter(Boolean)
      .join(" · "),
    data: j.data_julgamento ?? null,
    dado: dadoResultadoStf(resultadoCertidao(j) ?? j.certidao_literal, 400),
    fontePrincipal: fonte
      ? { url: fonte, titulo: j.certidao_fonte?.url ? (j.certidao_fonte.titulo ?? "Certidão de julgamento") : "Processo no portal do STF", orgao: "Supremo Tribunal Federal", acessado_em: j.atualizado_em }
      : null,
  });
}
