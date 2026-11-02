/**
 * Resumo de presença e de gastos da cota de um parlamentar num ano (somente servidor / build).
 * Só copia números oficiais; sem cálculo de percentual nem nota. Para o Senado, presença e cota
 * não são coletadas nesta versão: o resumo vem vazio e a interface diz que não há dado coletado.
 */
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
  if (casa !== "camara") return { rotulo, valor: null };
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
  if (casa !== "camara") return { rotulo, valor: null };
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

/** Votações nominais com registro e total de nominais coletadas da casa. */
export function contagemNominais(casa: Casa, id: string): { comRegistro: number; total: number } {
  const ind = getIndice(casa);
  return {
    comRegistro: ind.votos_por_parlamentar[id]?.length ?? 0,
    total: ind.votacoes.filter((v) => v.tipo === "nominal").length,
  };
}
