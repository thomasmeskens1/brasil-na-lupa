/**
 * Itens das listas do Executivo no formato do Cartão de Decisão (somente servidor / build).
 * Os campos comuns vão em PADRAO_* (enviados uma vez por lista), para a página não repetir o
 * mesmo texto em cada item.
 */
import { tituloSimplesDe } from "@/components/decisao";
import type { DadosCartao, ItemCartao } from "./componentes/ListaCartoes";
import type { IndiceExecutivo, ResumoMpv, ResumoVeto } from "./tipos";
import { QUEM_MPV, QUEM_VETO, contagemVeto, dadoMpv, nomeMpv, nomeVeto, simplesLista, tituloReservaMpv, tituloReservaVeto } from "./apresentacao";
import { rotuloSituacaoMpv, rotuloTipoVeto } from "./rotulos";
import { getTitulos } from "./titulos";

export function padraoVeto(ind: IndiceExecutivo): Partial<DadosCartao> {
  return {
    caminho: "presidencia",
    rotuloData: "veto publicado em",
    forma: "ato-individual",
    quemDecidiu: QUEM_VETO,
    fonte: { url: "", titulo: "Mensagem de veto", orgao: "Presidência da República (Planalto)", acessado_em: ind.atualizado_em },
  };
}

export function padraoMpv(ind: IndiceExecutivo): Partial<DadosCartao> {
  return {
    caminho: "presidencia",
    rotuloData: "publicada em",
    forma: "ato-individual",
    quemDecidiu: QUEM_MPV,
    fonte: { url: "", titulo: "Texto da medida provisória", orgao: "Presidência da República (Planalto)", acessado_em: ind.atualizado_em },
  };
}

export function cartaoVeto(v: ResumoVeto): ItemCartao {
  return {
    id: v.id,
    cartao: {
      href: `/executivo/vetos/${v.id}`,
      tituloOficial: tituloReservaVeto(v),
      simples: simplesLista(tituloSimplesDe(getTitulos("executivo"), v.id)),
      subtituloOficial: [nomeVeto(v), v.norma ? `parte sancionada: ${v.norma}` : null].filter(Boolean).join(" · "),
      data: v.data_publicacao,
      dado: contagemVeto(v.situacao_dispositivos, v.dispositivos),
      fonte: v.url ? { url: v.url } : null,
    },
    busca: `${v.numero}/${v.ano} ${v.materia_vetada ?? ""} ${v.ementa ?? ""}`,
    filtros: { ano: String(v.ano), tipo: rotuloTipoVeto(v.tipo) },
  };
}

export function cartaoMpv(m: ResumoMpv): ItemCartao {
  return {
    id: m.id,
    cartao: {
      href: `/executivo/medidas-provisorias/${m.id}`,
      tituloOficial: tituloReservaMpv(m),
      simples: simplesLista(tituloSimplesDe(getTitulos("executivo"), m.id)),
      subtituloOficial: nomeMpv(m),
      data: m.data,
      dado: dadoMpv(m),
      fonte: m.url ? { url: m.url } : null,
    },
    busca: `${m.numero} ${m.ementa ?? ""}`,
    filtros: { ano: String(m.ano), situacao: rotuloSituacaoMpv(m.situacao) },
    notas: m.votacoes ? [`${m.votacoes} ${m.votacoes === 1 ? "votação coletada" : "votações coletadas"} no Congresso`] : undefined,
  };
}
