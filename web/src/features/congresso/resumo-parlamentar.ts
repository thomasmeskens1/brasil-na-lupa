/**
 * Resumo de presença e de gastos da cota de um parlamentar num ano (somente servidor / build).
 * Só copia números oficiais; sem cálculo de percentual nem nota. No Senado, a cota (CEAPS) vem dos
 * dados abertos administrativos; presença por sessão não é publicada pelo Senado (o resumo diz isso).
 */
import fs from "node:fs";
import path from "node:path";
import type { FonteResumo } from "@/components/decisao/tipos";
import { cotaDoDeputado, presencaDoDeputado } from "./dados-camara";
import { getIndice } from "./dados";
import { formatarData } from "./rotulos";
import type { Casa } from "./tipos";

export const ANO_RESUMO = 2026;

export interface ResumoNumero {
  rotulo: string;
  valor: string | null;
  detalhe?: string | null;
  fonte?: FonteResumo | null;
}

const real = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function resumoPresenca(casa: Casa, id: string, ano = ANO_RESUMO): ResumoNumero {
  const rotulo = `Presença em Plenário em ${ano}`;
  if (casa !== "camara") {
    return {
      rotulo,
      valor: "Informação não disponível em fonte oficial",
      detalhe: "o Senado não publica a presença de cada senador por sessão; o registro de cada um aparece em cada votação nominal",
    };
  }
  const r = presencaDoDeputado(id).find((x) => x.ano.ano === ano);
  const i = r?.item;
  if (!r || !i || typeof i.dias_presenca !== "number" || typeof i.dias_com_sessao !== "number") return { rotulo, valor: null };
  return {
    rotulo,
    valor: `${i.dias_presenca} de ${i.dias_com_sessao} dias`,
    detalhe: "dias de sessão deliberativa em exercício, segundo o registro oficial de frequência",
    fonte: r.ano.fonte
      ? {
          url: r.ano.fonte.url.replace(/\/ListarPresencasDia\?.*$/, "?op=ListarPresencasDia"),
          orgao: "Câmara dos Deputados",
          titulo: "Frequência em Plenário",
          acessado_em: r.ano.fonte.acessado_em ?? r.ano.atualizado_em,
        }
      : null,
  };
}

export function resumoGastos(casa: Casa, id: string, ano = ANO_RESUMO): ResumoNumero {
  const rotulo = `Cota parlamentar em ${ano}`;
  if (casa !== "camara") return gastosSenado(id, ano, rotulo);
  const r = cotaDoDeputado(id).find((x) => x.cota.ano === ano);
  if (!r) return { rotulo, valor: null };
  const oficial = r.cota.pagina_oficial?.total ?? r.cota.total_pagina_oficial;
  const total = oficial ?? r.cota.total_liquido;
  if (typeof total !== "number") return { rotulo, valor: null };
  const url = r.pagina?.fonte?.url?.replace("{id}", encodeURIComponent(id)) ?? r.cota.fonte?.url ?? null;
  return {
    rotulo,
    valor: real(total),
    detalhe:
      oficial != null
        ? `total na página oficial da Câmara (consultada em ${formatarData(r.pagina?.consultado_em)})`
        : "soma dos documentos no arquivo de dados abertos",
    fonte: url
      ? { url, orgao: "Câmara dos Deputados", titulo: "Cota parlamentar", acessado_em: r.pagina?.consultado_em ?? r.cota.fonte?.acessado_em ?? null }
      : null,
  };
}

interface CeapsSenador {
  total_liquido?: number | null;
  total_pagina_oficial?: number | null;
  pagina_oficial?: { total?: number | null } | null;
  url_documentos?: string | null;
  fonte?: { url?: string; acessado_em?: string | null } | null;
}

function gastosSenado(id: string, ano: number, rotulo: string): ResumoNumero {
  if (!/^\d+$/.test(id)) return { rotulo, valor: null };
  const base = path.join(process.cwd(), "content", "senado", "despesas", String(ano));
  let c: CeapsSenador | null = null;
  let consultado: string | null = null;
  try {
    c = JSON.parse(fs.readFileSync(path.join(base, `${id}.json`), "utf8")) as CeapsSenador;
  } catch {
    return { rotulo, valor: null };
  }
  try {
    consultado = (JSON.parse(fs.readFileSync(path.join(base, "pagina-oficial.json"), "utf8")) as { consultado_em?: string }).consultado_em ?? null;
  } catch {
    /* sem conferência com a página oficial */
  }
  const oficial = c.pagina_oficial?.total ?? c.total_pagina_oficial ?? null;
  const total = oficial ?? c.total_liquido;
  if (typeof total !== "number") return { rotulo, valor: null };
  const url = c.url_documentos ?? c.fonte?.url ?? null;
  return {
    rotulo,
    valor: real(total),
    detalhe:
      oficial != null && consultado
        ? `total em "recursos utilizados" do Senado (consultado em ${formatarData(consultado)})`
        : "soma dos documentos no arquivo de dados abertos da CEAPS",
    fonte: url ? { url, orgao: "Senado Federal", titulo: "Cota parlamentar (CEAPS)", acessado_em: consultado ?? c.fonte?.acessado_em ?? null } : null,
  };
}

/** Votações nominais com registro e total de nominais coletadas da casa. */
export function contagemNominais(casa: Casa, id: string): { comRegistro: number; total: number } {
  const ind = getIndice(casa);
  return {
    comRegistro: ind.votos_por_parlamentar[id]?.length ?? 0,
    total: ind.votacoes.filter((v) => v.tipo === "nominal").length,
  };
}
