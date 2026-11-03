"use client";

/**
 * Lista longa recolhível com contagem (ex.: os 59 dispositivos de um veto): mostra os primeiros
 * `inicial` itens e os botões "Mostrar mais N" e "Mostrar todos (total)". Os itens escondidos
 * continuam no HTML (atributo hidden), então o conteúdo existe sem JavaScript para buscadores;
 * ao revelar, o foco vai para o primeiro item novo.
 *
 * Os itens podem ser componentes de servidor (são passados prontos):
 *   <ListaRecolhivel
 *     rotulo={{ singular: "dispositivo", plural: "dispositivos" }}
 *     inicial={10}
 *     itens={v.dispositivos.map((d) => (
 *       <ItemRecolhivel key={d.id} resumo={d.trecho} selo={<span className="selo">{d.situacao}</span>}>
 *         <Dispositivo d={d} />
 *       </ItemRecolhivel>
 *     ))}
 *   />
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ListaRecolhivelProps {
  itens: ReactNode[];
  /** Itens visíveis de início. Padrão 10. */
  inicial?: number;
  /** Quantos itens cada "Mostrar mais" revela. Padrão: igual a `inicial`. */
  passo?: number;
  rotulo: { singular: string; plural: string };
  /** Lista numerada (ol) ou não (ul). Padrão ul. */
  ordenada?: boolean;
  /** Classe da lista (padrão "space-y-2"). */
  className?: string;
}

export function ListaRecolhivel({ itens, inicial = 10, passo, rotulo, ordenada = false, className = "space-y-2" }: ListaRecolhivelProps) {
  const total = itens.length;
  const [limite, setLimite] = useState(Math.min(inicial, total));
  const focar = useRef<number | null>(null);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const p = passo ?? inicial;

  // Depois de revelar, o foco vai para o primeiro item novo (teclado e leitor de tela).
  useEffect(() => {
    if (focar.current !== null) {
      refs.current[focar.current]?.focus();
      focar.current = null;
    }
  }, [limite]);

  function revelar(n: number) {
    const novo = Math.min(total, n);
    if (novo > limite) focar.current = limite;
    setLimite(novo);
  }

  const L = ordenada ? "ol" : "ul";
  const resto = total - limite;
  return (
    <div>
      <p className="mb-2 text-sm text-[var(--cor-secundaria)]" aria-live="polite">
        {total === 0
          ? `Nenhum ${rotulo.singular}.`
          : `Mostrando ${limite.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} ${total === 1 ? rotulo.singular : rotulo.plural}`}
      </p>
      <L className={className}>
        {itens.map((it, i) => (
          <li
            key={i}
            hidden={i >= limite}
            tabIndex={-1}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="focus:outline-none focus-visible:outline-2"
          >
            {it}
          </li>
        ))}
      </L>
      {resto > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="botao" onClick={() => revelar(limite + p)}>
            Mostrar mais {Math.min(p, resto).toLocaleString("pt-BR")} {Math.min(p, resto) === 1 ? rotulo.singular : rotulo.plural}
          </button>
          {resto > p ? (
            <button type="button" className="botao" onClick={() => revelar(total)}>
              Mostrar todos ({total.toLocaleString("pt-BR")})<span className="sr-only"> {rotulo.plural}</span>
            </button>
          ) : null}
        </div>
      ) : total > inicial ? (
        <div className="mt-3">
          <button type="button" className="botao" onClick={() => setLimite(Math.min(inicial, total))}>
            Mostrar menos<span className="sr-only"> {rotulo.plural}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
