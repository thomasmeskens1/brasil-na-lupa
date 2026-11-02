/**
 * Dados do cabeçalho "resposta primeiro" de veto e medida provisória, usados pela página, pelos
 * metadados de compartilhamento e pela imagem Open Graph (somente servidor / build).
 */
import { resolverTitulo, tituloSimplesDe, type DadoChave, type FonteResumo, type TituloSimples } from "@/components/decisao";
import { tituloFonteLegivel } from "@/features/comum/texto";
import type { MedidaProvisoria, ResumoDispositivo, Veto } from "./tipos";
import { contagemVeto, dadoMpv, nomeMpv, nomeVeto, simplesUtil, tituloReservaMpv, tituloReservaVeto } from "./apresentacao";
import { rotuloSituacaoDispositivo } from "./rotulos";
import { getTitulos } from "./titulos";

export interface DadosCabecalho {
  tituloOficial: string;
  simples: TituloSimples | null;
  subtituloOficial: string;
  data: string | null;
  dado: DadoChave | null;
  fontePrincipal: FonteResumo | null;
  fontes: FonteResumo[];
  /** Título resolvido (simples aprovado ou oficial) e subtítulo, para metadados e imagem. */
  titulo: string;
  subtitulo: string | null;
}

function resolver(base: Omit<DadosCabecalho, "titulo" | "subtitulo">): DadosCabecalho {
  const t = resolverTitulo(base);
  return { ...base, titulo: t.titulo, subtitulo: t.subtitulo };
}

export function cabecalhoVeto(v: Veto): DadosCabecalho {
  const simples = simplesUtil(tituloSimplesDe(getTitulos("executivo"), v.id));
  const nome = nomeVeto({ numero: v.numero, ano: v.ano, tipo: v.tipo, materia_vetada: v.materia_vetada?.identificacao });
  const fontePrincipal: FonteResumo | null = v.mensagem?.url_planalto
    ? { url: v.mensagem.url_planalto, titulo: "Mensagem de veto com as razões", orgao: "Presidência da República (Planalto)", acessado_em: v.atualizado_em }
    : v.links?.congresso_dispositivos
      ? { url: v.links.congresso_dispositivos, titulo: "Dispositivos e resultado", orgao: "Congresso Nacional", acessado_em: v.atualizado_em }
      : null;
  return resolver({
    tituloOficial: tituloReservaVeto(v),
    simples,
    subtituloOficial: [nome, v.norma?.descricao ? `parte sancionada: ${v.norma.descricao}` : null].filter(Boolean).join(" · "),
    data: v.datas?.publicacao ?? null,
    dado: contagemVeto(v.situacao_dispositivos, v.quantidade_dispositivos_fonte ?? v.dispositivos.length),
    fontePrincipal,
    fontes: (v.fontes ?? []).map(tituloFonteLegivel),
  });
}

export function resumosDispositivos(v: Veto): ResumoDispositivo[] {
  return v.dispositivos.map((d, i) => ({
    codigo: d.codigo,
    ordem: i + 1,
    identificador: d.identificador,
    dispositivo: d.dispositivo,
    assunto: d.assunto_congresso?.trim() || null,
    situacao: d.situacao,
    situacaoRotulo: rotuloSituacaoDispositivo(d.situacao, d.situacao_oficial),
    dataSessao: d.data_sessao,
    temVotos: !!d.votacao?.votos_ref,
  }));
}

export function cabecalhoMpv(m: MedidaProvisoria): DadosCabecalho {
  const simples = simplesUtil(tituloSimplesDe(getTitulos("executivo"), m.id));
  const planalto = m.links?.planalto;
  return resolver({
    tituloOficial: tituloReservaMpv(m),
    simples,
    subtituloOficial: nomeMpv(m),
    data: m.datas?.publicacao ?? m.datas?.edicao ?? null,
    dado: dadoMpv({ situacao: m.situacao, norma_gerada: m.norma_gerada?.descricao ?? null }),
    fontePrincipal: planalto
      ? { url: planalto, titulo: "Texto da medida provisória", orgao: "Presidência da República (Planalto)", acessado_em: m.atualizado_em }
      : null,
    fontes: (m.fontes ?? []).map(tituloFonteLegivel),
  });
}
