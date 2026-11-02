/** Cartões de Decisão dos temas e julgamentos do STJ e do STF (somente servidor / build). */
import { tituloSimplesDe, type CartaoDecisaoProps } from "@/components/decisao";
import { getTitulos } from "@/features/executivo/titulos";
import type { ResumoJulgamentoStf, TemaStf, TemaStj } from "./tipos";
import {
  QUEM_STF,
  QUEM_STJ,
  dadoResultadoStf,
  dadoTemaStj,
  nomeTemaStf,
  nomeTemaStj,
  processoPorExtenso,
  resultadoCertidao,
  resultadoMeritoStj,
  simplesLista,
  tituloReservaJulgamentoStf,
  tituloReservaStf,
  tituloReservaStj,
} from "./apresentacao";
import { julgamentosDoTemaStf } from "./dados";

type Cartao = Omit<CartaoDecisaoProps, "as" | "children" | "className" | "quemDecidiu"> & { quemDecidiu: string };

export function cartaoTemaStj(t: TemaStj): Cartao {
  const r = resultadoMeritoStj(t.julgamento?.sessoes);
  return {
    href: `/justica/stj/temas/${t.numero}`,
    tituloOficial: tituloReservaStj(t),
    simples: simplesLista(tituloSimplesDe(getTitulos("stj"), `stj-tema-${t.numero}`)),
    subtituloOficial: `${nomeTemaStj(t)}${t.situacao ? ` · ${t.situacao}` : ""}`,
    caminho: "stj",
    data: r?.data ?? t.datas?.julgamento ?? t.datas?.afetacao ?? null,
    rotuloData: r?.data || t.datas?.julgamento ? "julgado em" : "afetado em",
    forma: "julgamento",
    dado: dadoTemaStj(t),
    quemDecidiu: QUEM_STJ(t.orgao, t.relator?.length ? t.relator.join("; ") : null),
    fonte: t.url_oficial
      ? { url: t.url_oficial, titulo: "Página oficial do tema", orgao: "Superior Tribunal de Justiça", acessado_em: t.pagina_oficial?.verificado_em ?? t.atualizado_em }
      : null,
  };
}

export function cartaoTemaStf(t: TemaStf): Cartao {
  const julg = julgamentosDoTemaStf(t).sort((a, b) => (b.data_julgamento ?? "").localeCompare(a.data_julgamento ?? ""))[0];
  const situacao = t.situacao?.andamento ?? t.situacao?.repercussao_geral ?? null;
  return {
    href: `/justica/stf/temas/${t.numero}`,
    tituloOficial: tituloReservaStf(t),
    simples: simplesLista(tituloSimplesDe(getTitulos("stf"), `stf-tema-${t.numero}`)),
    subtituloOficial: `${nomeTemaStf(t)}${situacao ? ` · ${situacao}` : ""}`,
    caminho: "stf",
    data: julg?.data_julgamento ?? t.data_tese ?? t.situacao?.data_repercussao_geral ?? null,
    rotuloData: julg?.data_julgamento ? "julgado em" : undefined,
    forma: "julgamento",
    dado: (julg ? dadoResultadoStf(resultadoCertidao(julg), 160) : null) ?? (situacao ? { tipo: "texto", rotulo: "Situação", texto: situacao } : null),
    quemDecidiu: QUEM_STF(julg?.orgao ?? null, t.relator),
    fonte: t.url ? { url: t.url, titulo: "Página oficial do tema", orgao: "Supremo Tribunal Federal", acessado_em: t.atualizado_em } : null,
  };
}

/** Resumo do índice (com os campos acrescentados por scripts/gerar-executivo-justica.mjs). */
export function cartaoJulgamentoStf(j: ResumoJulgamentoStf): Cartao {
  const ident = j.identificacao ?? j.id;
  return {
    href: `/justica/stf/julgamentos/${j.id}`,
    tituloOficial: tituloReservaJulgamentoStf({ certidao: j.certidao_inicio, ementa: j.ementa_inicio, identificacao: ident }),
    simples: simplesLista(tituloSimplesDe(getTitulos("stf"), j.id)),
    subtituloOficial: [
      processoPorExtenso(ident),
      j.tema ? `Tema ${j.tema} de repercussão geral` : null,
      j.ambiente === "virtual" ? "Plenário Virtual" : j.ambiente === "presencial" ? "sessão presencial" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    caminho: "stf",
    data: j.data_julgamento ?? null,
    rotuloData: "julgado em",
    forma: "julgamento",
    dado: dadoResultadoStf(j.resultado_trecho, 160),
    quemDecidiu: QUEM_STF(j.orgao ?? null, j.relator ?? null),
    fonte: j.url ? { url: j.url, titulo: "Certidão de julgamento", orgao: "Supremo Tribunal Federal", acessado_em: j.acessado_em ?? null } : null,
  };
}
