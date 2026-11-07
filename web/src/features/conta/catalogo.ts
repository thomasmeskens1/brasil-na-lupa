import fs from "node:fs";
import path from "node:path";
import type { ArquivoTitulos } from "@/components/decisao/tipos";
import { cortarEmPalavra, tituloSimplesDe } from "@/components/decisao/rotulos";
import { getIndice } from "@/features/congresso/dados";
import { tituloOficialVotacao } from "@/features/congresso/lista";
import { getIndiceEstado, ufsComDados } from "@/features/estados/dados";
import { getIndiceExecutivo } from "@/features/executivo/dados";
import { getDecisoes } from "@/features/icms/dados";
import { dataDe } from "@/features/icms/cartao";
import { caminhoCasa, getUf } from "@/features/estados/ufs";
import { getIndiceStf, getIndiceStj, getJulgamentoStf, getTemaStf, getTemaStj } from "@/features/justica/dados";
import { cabecalhoJulgamentoStf, cabecalhoTemaStf, cabecalhoTemaStj } from "@/features/justica/detalhes";
import type { ParteCatalogo } from "./acompanhamento";
import {
  ehIdProposta,
  idDeputadoEstadual,
  idExecutivo,
  idIcms,
  idJulgamentoStf,
  idParlamentar,
  idTemaJustica,
  idVotacaoCongresso,
  idVotacaoEstado,
} from "./ids";

/**
 * Catálogo público e estático (gerado no build, a partir de web/content) com os nomes que a
 * página Minha conta mostra para cada favorito e reação: título da proposta, data, quem decidiu,
 * a situação oficial e as outras votações da mesma proposição (as "atualizações"). Dividido em
 * partes (Câmara, Senado, Executivo, ICMS, Justiça e cada UF) para o navegador baixar só as partes dos
 * favoritos da pessoa; nenhum favorito sai do navegador para montar a lista.
 *
 * Só fatos das fontes, sem juízo de valor; a ordem das atualizações é só a data.
 */

const LIMITE_TITULO = 140;

function titulos(secao: string): ArquivoTitulos | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "titulos", `${secao}.json`), "utf8")) as ArquivoTitulos;
  } catch {
    return null;
  }
}

const curto = (t: string) => {
  const c = cortarEmPalavra(t, LIMITE_TITULO);
  return c.cortado ? `${c.curto}…` : c.curto;
};

export function partesCatalogo(): string[] {
  return ["camara", "senado", "executivo", "icms", "justica", ...ufsComDados().map((u) => u.toLowerCase())];
}

function vazia(parte: string): ParteCatalogo {
  return { parte, itens: {}, grupos: {}, politicos: {} };
}

/** Agrupa as votações pela proposição (ordem: da mais recente para a mais antiga). */
function agrupar(p: ParteCatalogo, grupo: string | null | undefined, id: string, data: string | null, resultado: string | null) {
  if (!grupo) return null;
  (p.grupos[grupo] ??= []).push([id, data, resultado]);
  return grupo;
}

function ordenarGrupos(p: ParteCatalogo) {
  for (const g of Object.values(p.grupos)) g.sort((a, b) => (b[1] ?? "").localeCompare(a[1] ?? "") || a[0].localeCompare(b[0]));
}

/** Temas do STJ e do STF com página própria e julgamentos do STF (os que têm botões de reação). */
function montarJustica(p: ParteCatalogo) {
  const STJ = "Superior Tribunal de Justiça";
  const STF = "Supremo Tribunal Federal";
  for (const n of getIndiceStj().com_pagina) {
    const t = getTemaStj(n);
    const k = idTemaJustica("stj", n);
    if (!t || !ehIdProposta(k)) continue;
    const c = cabecalhoTemaStj(t);
    p.itens[k] = [curto(`Tema ${n} do STJ: ${c.titulo}`), c.data, STJ, null, t.situacao ?? null];
  }
  const stf = getIndiceStf();
  for (const n of stf.com_pagina) {
    const t = getTemaStf(n);
    const k = idTemaJustica("stf", n);
    if (!t || !ehIdProposta(k)) continue;
    const c = cabecalhoTemaStf(t);
    p.itens[k] = [curto(`Tema ${n} do STF: ${c.titulo}`), c.data, STF, null, t.situacao?.andamento ?? t.situacao?.repercussao_geral ?? null];
  }
  for (const r of stf.julgamentos) {
    const j = getJulgamentoStf(r.id);
    const k = idJulgamentoStf(r.id);
    if (!j || !ehIdProposta(k)) continue;
    const c = cabecalhoJulgamentoStf(j, r.id);
    const ident = j.processo?.identificacao ?? r.identificacao;
    p.itens[k] = [curto(ident ? `${ident} (STF): ${c.titulo}` : c.titulo), c.data, STF, null, null];
  }
}

export function montarParteCatalogo(parte: string): ParteCatalogo | null {
  const p = vazia(parte);
  if (parte === "camara" || parte === "senado") {
    const ind = getIndice(parte);
    const arq = titulos(parte);
    const orgao = parte === "camara" ? "Câmara dos Deputados" : "Senado Federal";
    for (const v of ind.votacoes) {
      const k = idVotacaoCongresso(parte, v.id);
      // Na lista da conta o nome da proposição vem antes do título (várias votações por proposição).
      const simples = tituloSimplesDe(arq, v.id)?.titulo;
      const sigla = v.proposicao?.titulo;
      const t = simples
        ? sigla && !simples.includes(sigla) ? `${sigla}: ${simples}` : simples
        : tituloOficialVotacao({ proposicao: sigla ?? null, descricao: v.descricao ?? "" });
      const g = agrupar(p, v.proposicao?.id ? `${parte}:${v.proposicao.id}` : null, k, v.data, v.resultado);
      p.itens[k] = [curto(t), v.data, orgao, g, null];
    }
    for (const m of ind.parlamentares) {
      const sigla = [m.partido, m.uf].filter(Boolean).join("-");
      p.politicos[idParlamentar(parte, m.id)] = `${parte === "camara" ? "Deputado(a) federal" : "Senador(a)"} ${m.nome}${sigla ? ` (${sigla})` : ""}`;
    }
  } else if (parte === "executivo") {
    const ex = getIndiceExecutivo();
    const arq = titulos("executivo");
    for (const m of ex.mpvs) {
      const t = tituloSimplesDe(arq, m.id)?.titulo ?? `Medida Provisória nº ${m.numero}/${m.ano}: ${m.ementa ?? ""}`.trim();
      p.itens[idExecutivo(m.id)] = [curto(t), m.data, "Presidência da República", null, m.situacao_oficial ?? m.situacao ?? null];
    }
    for (const v of ex.vetos) {
      const t = tituloSimplesDe(arq, v.id)?.titulo ?? `Veto nº ${v.numero}/${v.ano}${v.materia_vetada ? ` ao ${v.materia_vetada}` : ""}`;
      p.itens[idExecutivo(v.id)] = [curto(t), v.data_publicacao ?? null, "Presidência da República", null, v.situacao_oficial ?? null];
    }
  } else if (parte === "icms") {
    const arq = titulos("icms");
    for (const d of getDecisoes().itens ?? []) {
      p.itens[idIcms(d.id)] = [curto(tituloSimplesDe(arq, d.id)?.titulo ?? d.titulo), dataDe(d), d.orgao ?? "ICMS", null, null];
    }
  } else if (parte === "justica") {
    montarJustica(p);
  } else {
    const u = getUf(parte);
    const ind = u ? getIndiceEstado(parte) : null;
    if (!u || !ind) return null;
    const casa = caminhoCasa(u).rotulo;
    for (const v of ind.votacoes) {
      if (!v.plenario) continue;
      const k = idVotacaoEstado(parte, v.id);
      const prop = v.proposicao;
      const t = [prop?.rotulo, prop?.ementa ?? v.descricao].filter(Boolean).join(": ") || "Ementa não disponível em fonte oficial";
      const g = agrupar(p, prop?.id ? `${parte}:${prop.id}` : null, k, v.data, v.resultado ?? null);
      p.itens[k] = [curto(t), v.data, casa, g, null];
    }
    for (const d of ind.deputados ?? []) {
      p.politicos[idDeputadoEstadual(parte, d.id)] = `Deputado(a) estadual ${d.nome}${d.partido ? ` (${d.partido}-${u.uf.toUpperCase()})` : ` (${u.uf.toUpperCase()})`}`;
    }
  }
  // Grupo de uma votação só: não há atualização a mostrar (economiza espaço).
  for (const [g, l] of Object.entries(p.grupos)) {
    if (l.length < 2) {
      delete p.grupos[g];
      const it = p.itens[l[0][0]];
      if (it) it[3] = null;
    }
  }
  ordenarGrupos(p);
  return p;
}
