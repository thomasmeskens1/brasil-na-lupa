"use client";

import { useMemo, useState } from "react";
import { CartaoDecisao } from "@/components/decisao/CartaoDecisao";
import { FiltrosCompactos } from "@/components/tabela/FiltrosCompactos";
import { normalizar, type ItemListaIcms } from "../cartao";
import { CAMINHOS, CAMINHO_CURTO } from "../rotulos";
import { MostrarMais } from "@/components/lista/MostrarMais";

const POR_PAGINA = 10;

/**
 * Lista das decisões do ICMS (mais recentes primeiro) com busca por produto ou assunto, filtros
 * compactos (caminho, ano, tema) e "Mostrar mais". Cada decisão é um Cartão de Decisão.
 */
export function ListaIcms({ itens }: { itens: ItemListaIcms[] }) {
  const [busca, setBusca] = useState("");
  const [caminho, setCaminho] = useState("");
  const [ano, setAno] = useState("");
  const [tema, setTema] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  const anos = useMemo(() => [...new Set(itens.map((i) => i.ano).filter((a): a is string => !!a))].sort().reverse(), [itens]);
  const temas = useMemo(
    () => [...new Set(itens.map((i) => i.tema).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [itens],
  );
  const caminhos = CAMINHOS.filter((c) => itens.some((i) => i.caminho === c.id)).map((c) => ({
    valor: c.id,
    rotulo: `${CAMINHO_CURTO[c.id]} (${itens.filter((i) => i.caminho === c.id).length})`,
  }));

  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  const filtrados = itens.filter(
    (i) =>
      (!caminho || i.caminho === caminho) &&
      (!ano || i.ano === ano) &&
      (!tema || i.tema === tema) &&
      termos.every((t) => i.busca.includes(t)),
  );
  const visiveis = filtrados.slice(0, limite);
  const resto = filtrados.length - visiveis.length;

  function com<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setLimite(POR_PAGINA);
    };
  }

  return (
    <div className="space-y-4">
      <FiltrosCompactos
        busca={{ valor: busca, aoMudar: com(setBusca), rotulo: "Buscar por produto ou assunto", dica: "Ex.: gasolina, energia, diesel" }}
        filtros={[
          { id: "caminho", rotulo: "Quem decidiu", valor: caminho, aoMudar: com(setCaminho), opcoes: caminhos, todos: "Todos os caminhos" },
          { id: "ano", rotulo: "Ano", valor: ano, aoMudar: com(setAno), opcoes: anos },
          ...(temas.length ? [{ id: "tema", rotulo: "Tema", valor: tema, aoMudar: com(setTema), opcoes: temas }] : []),
        ]}
        contagem={`Mostrando ${visiveis.length} de ${filtrados.length} ${filtrados.length === 1 ? "decisão" : "decisões"}, da mais recente para a mais antiga${
          filtrados.length !== itens.length ? ` (total: ${itens.length})` : ""
        }.`}
        aoLimpar={() => {
          setBusca("");
          setCaminho("");
          setAno("");
          setTema("");
          setLimite(POR_PAGINA);
        }}
      />
      {visiveis.length ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visiveis.map((i) => (
            <CartaoDecisao
              key={i.id}
              as="li"
              href={i.href}
              tituloOficial={i.tituloOficial}
              simples={i.simples}
              subtituloOficial={i.subtitulo}
              caminho={i.caminho}
              data={i.data}
              forma={i.forma}
              dado={i.dado}
              quemDecidiu={i.quem}
              fonte={i.fonte}
              tema={i.tema}
            >
              {i.dado?.tipo === "placar" && i.legenda ? <p className="text-sm text-[var(--cor-secundaria)]">{i.legenda}</p> : null}
              {i.dado?.tipo === "mudanca" && i.maisMudancas ? (
                <p className="text-sm text-[var(--cor-secundaria)]">
                  e mais {i.maisMudancas} {i.maisMudancas === 1 ? "item mudou" : "itens mudaram"} (ver a decisão)
                </p>
              ) : null}
            </CartaoDecisao>
          ))}
        </ul>
      ) : (
        <p className="lacuna">Nenhuma decisão com essa busca ou esses filtros. Tente limpar os filtros.</p>
      )}
      <MostrarMais
        visiveis={filtrados.length - resto}
        total={filtrados.length}
        passo={POR_PAGINA}
        itens={{ singular: "decisão", plural: "decisões" }}
        genero="f"
        aoMostrar={setLimite}
      />
    </div>
  );
}
