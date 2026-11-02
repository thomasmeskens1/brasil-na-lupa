import { ListaCartoes } from "@/features/executivo/componentes/ListaCartoes";
import type { ResumoJulgamentoStf } from "../tipos";
import { cartaoJulgamentoStf } from "../cartoes";

/**
 * Julgamentos do STF (mais recentes primeiro) como Cartões de Decisão, com o resultado literal da
 * certidão; busca, filtro por classe do processo e "Mostrar mais".
 */
export function ListaJulgamentosStf({ itens, nivel = 3, porPagina = 8 }: { itens: ResumoJulgamentoStf[]; nivel?: 3 | 4; porPagina?: number }) {
  const ordenados = [...itens].sort((a, b) => (b.data_julgamento ?? "").localeCompare(a.data_julgamento ?? ""));
  return (
    <ListaCartoes
      itens={ordenados.map((j) => ({
        id: j.id,
        cartao: cartaoJulgamentoStf(j),
        busca: `${j.identificacao ?? ""} ${j.tema ?? ""} ${j.relator ?? ""} ${j.resultado_trecho ?? ""}`,
        filtros: { classe: (j.identificacao ?? "").split(" ")[0] || null },
      }))}
      filtros={[{ chave: "classe", rotulo: "Tipo de processo" }]}
      busca={{ rotulo: "Buscar pelo processo, tema ou relator", dica: "Ex.: ADI 7616, 1367" }}
      rotulo={{ singular: "julgamento", plural: "julgamentos" }}
      porPagina={porPagina}
      nivelTitulo={nivel}
    />
  );
}
