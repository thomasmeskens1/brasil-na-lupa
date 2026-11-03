import fs from "node:fs";
import path from "node:path";
import type { ArquivoTitulos } from "@/components/decisao/tipos";
import { tituloSimplesDe } from "@/components/decisao/rotulos";
import { getIndice } from "@/features/congresso/dados";
import { tituloOficialVotacao } from "@/features/congresso/lista";
import { getIndiceEstado, ufsComDados } from "@/features/estados/dados";
import { getIndiceExecutivo } from "@/features/executivo/dados";
import { getDecisoes } from "@/features/icms/dados";
import { dataDe } from "@/features/icms/cartao";
import { caminhoCasa, getUf } from "@/features/estados/ufs";
import { idDeputadoEstadual, idExecutivo, idIcms, idParlamentar, idVotacaoCongresso, idVotacaoEstado } from "./ids";

/**
 * Índice público e estático das decisões recentes, para o bloco "Seus favoritos" da página
 * inicial. Gerado no build a partir de web/content (os mesmos dados das páginas); o navegador
 * cruza com os favoritos da pessoa, que vêm da rota autenticada /api/conta/estado. Assim a
 * página inicial continua estática e nenhum favorito sai do navegador para montar a lista.
 *
 * Só fatos das fontes: título (o simples aprovado ou o oficial), data, quem decidiu, UF, tema da
 * classificação oficial e, nas votações nominais, quem votou (sem o voto). Ordem: data.
 */

export interface DecisaoIndice {
  /** Id do site (ids.ts), o mesmo do botão Favoritar e das reações. */
  k: string;
  h: string;
  t: string;
  d: string | null;
  /** Quem decidiu (órgão). */
  c: string;
  uf?: string;
  tm?: string;
}

export interface IndiceFavoritos {
  geradoEm: string;
  janelaDias: number;
  decisoes: DecisaoIndice[];
  /** Político → posições em `decisoes` das votações nominais em que votou (mais recentes). */
  politicos: Record<string, number[]>;
}

const JANELA_DIAS = 120;
const MAX_POR_POLITICO = 20;
const LIMITES = { camara: 300, senado: 150, estado: 80, mpv: 60, veto: 60 } as const;

function titulos(secao: string): ArquivoTitulos | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "titulos", `${secao}.json`), "utf8")) as ArquivoTitulos;
  } catch {
    return null;
  }
}

function temaDe(arq: ArquivoTitulos | null, id: string): string | undefined {
  const t = (arq?.itens as Record<string, { tema?: unknown }> | undefined)?.[id]?.tema;
  return typeof t === "string" && t ? t : undefined;
}

function recente(d: string | null | undefined, corte: string): boolean {
  return !!d && d >= corte;
}

export function montarIndiceFavoritos(hoje = new Date()): IndiceFavoritos {
  const corte = new Date(hoje.getTime() - JANELA_DIAS * 86400_000).toISOString().slice(0, 10);
  const decisoes: DecisaoIndice[] = [];
  const politicos: Record<string, number[]> = {};
  const votou = (pol: string, pos: number) => (politicos[pol] ??= []).push(pos);

  // Congresso: votações (o índice já vem da mais recente para a mais antiga).
  for (const casa of ["camara", "senado"] as const) {
    const ind = getIndice(casa);
    const arq = titulos(casa);
    const posDe = new Map<number, number>();
    ind.votacoes.slice(0, LIMITES[casa]).forEach((v, i) => {
      if (!recente(v.data, corte)) return;
      const simples = tituloSimplesDe(arq, v.id);
      posDe.set(i, decisoes.length);
      decisoes.push({
        k: idVotacaoCongresso(casa, v.id),
        h: `/congresso/votacoes/${casa}/${encodeURIComponent(v.id)}`,
        t: simples?.titulo ?? tituloOficialVotacao({ proposicao: v.proposicao?.titulo ?? null, descricao: v.descricao ?? "" }),
        d: v.data,
        c: casa === "camara" ? "Câmara dos Deputados" : "Senado Federal",
        tm: temaDe(arq, v.id),
      });
    });
    for (const [id, votos] of Object.entries(ind.votos_por_parlamentar ?? {})) {
      for (const [i] of votos) {
        const pos = posDe.get(i);
        if (pos !== undefined && ind.votacoes[i]?.tipo === "nominal") votou(idParlamentar(casa, id), pos);
      }
    }
  }

  // Estados: votações de Plenário (com a UF) e quem votou nas nominais.
  for (const uf of ufsComDados()) {
    const ind = getIndiceEstado(uf);
    const u = getUf(uf);
    if (!ind || !u) continue;
    const posDe = new Map<number, number>();
    let n = 0;
    ind.votacoes.forEach((v, i) => {
      if (!v.plenario || !recente(v.data, corte) || n >= LIMITES.estado) return;
      n++;
      posDe.set(i, decisoes.length);
      const prop = v.proposicao;
      decisoes.push({
        k: idVotacaoEstado(uf, v.id),
        h: `/estados/${uf}/votacoes/${encodeURIComponent(v.id)}`,
        t: [prop?.rotulo, prop?.ementa ?? v.descricao].filter(Boolean).join(": ") || "Ementa não disponível em fonte oficial",
        d: v.data,
        c: caminhoCasa(u).rotulo,
        uf: uf.toUpperCase(),
      });
    });
    for (const [id, votos] of Object.entries(ind.votos_por_deputado ?? {})) {
      for (const [i] of votos) {
        const pos = posDe.get(i);
        if (pos !== undefined && ind.votacoes[i]?.forma === "nominal") votou(idDeputadoEstadual(uf, id), pos);
      }
    }
  }

  // Executivo federal: medidas provisórias e vetos.
  const ex = getIndiceExecutivo();
  const arqEx = titulos("executivo");
  for (const m of ex.mpvs.slice(0, LIMITES.mpv)) {
    if (!recente(m.data, corte)) continue;
    decisoes.push({
      k: idExecutivo(m.id),
      h: `/executivo/medidas-provisorias/${m.id}`,
      t: tituloSimplesDe(arqEx, m.id)?.titulo ?? `Medida Provisória nº ${m.numero}/${m.ano}: ${m.ementa ?? ""}`.trim(),
      d: m.data,
      c: "Presidência da República",
      tm: temaDe(arqEx, m.id),
    });
  }
  for (const v of ex.vetos.slice(0, LIMITES.veto)) {
    if (!recente(v.data_publicacao, corte)) continue;
    decisoes.push({
      k: idExecutivo(v.id),
      h: `/executivo/vetos/${v.id}`,
      t: tituloSimplesDe(arqEx, v.id)?.titulo ?? `Veto nº ${v.numero}/${v.ano}${v.materia_vetada ? ` ao ${v.materia_vetada}` : ""}`,
      d: v.data_publicacao ?? null,
      c: "Presidência da República",
      tm: temaDe(arqEx, v.id),
    });
  }

  // ICMS: decisões do piloto (CONFAZ, ALESP, governo de SP e normas federais).
  const arqIcms = titulos("icms");
  for (const d of getDecisoes().itens ?? []) {
    const data = dataDe(d);
    if (!recente(data, corte)) continue;
    decisoes.push({
      k: idIcms(d.id),
      h: `/impostos/icms/${d.id}`,
      t: tituloSimplesDe(arqIcms, d.id)?.titulo ?? d.titulo,
      d: data,
      c: "ICMS",
      tm: temaDe(arqIcms, d.id) ?? "Impostos e preços",
    });
  }

  for (const k of Object.keys(politicos)) {
    politicos[k] = politicos[k]
      .sort((a, b) => (decisoes[b].d ?? "").localeCompare(decisoes[a].d ?? ""))
      .slice(0, MAX_POR_POLITICO);
  }
  return { geradoEm: hoje.toISOString(), janelaDias: JANELA_DIAS, decisoes, politicos };
}
