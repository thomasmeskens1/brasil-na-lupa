"use client";

/**
 * Botões "Mostrar mais N <itens>" e "Mostrar todos (total)" para listas e tabelas paginadas no
 * navegador. Ao revelar, o foco vai para o primeiro item novo (teclado e leitor de tela não voltam
 * ao topo) e o número de itens visíveis é anunciado (aria-live).
 *
 * Os botões ficam logo DEPOIS da lista: o item a focar é procurado no elemento anterior
 * (ul/ol → itens; tabela → linhas do tbody; outro contêiner → filhos diretos), ou em `lista`.
 *
 *   <ul>…{visiveis.map(…)}</ul>
 *   <MostrarMais visiveis={visiveis.length} total={filtradas.length} passo={50}
 *     itens={{ singular: "voto", plural: "votos" }} aoMostrar={setLimite} />
 */
import { useEffect, useRef, useState, type RefObject } from "react";

export interface MostrarMaisProps {
  /** Quantos itens estão visíveis agora. */
  visiveis: number;
  /** Total de itens (já filtrados). */
  total: number;
  /** Quantos itens cada "Mostrar mais" revela. */
  passo: number;
  itens: { singular: string; plural: string };
  /** Recebe o novo limite de itens visíveis. */
  aoMostrar: (limite: number) => void;
  /** Mostra o botão "Mostrar todos" (padrão: sim). */
  todos?: boolean;
  /** "todos" ou "todas" (concordância com o substantivo). */
  genero?: "m" | "f";
  /** Contêiner da lista, se não for o elemento logo antes dos botões. */
  lista?: RefObject<HTMLElement | null>;
  className?: string;
}

function itensDe(el: Element | null): HTMLElement[] {
  if (!el) return [];
  if (el.matches("ul, ol, tbody")) return [...el.children] as HTMLElement[];
  const corpo = el.querySelector("tbody");
  if (corpo) return [...corpo.children] as HTMLElement[];
  const l = el.querySelector(":scope > ul, :scope > ol");
  if (l) return [...l.children] as HTMLElement[];
  return [...el.children] as HTMLElement[];
}

/** Leva o foco ao item `indice` da lista (sem rolar bruscamente). */
export function focarItem(lista: Element | null, indice: number) {
  const alvo = itensDe(lista)[indice];
  if (!alvo) return;
  if (!alvo.hasAttribute("tabindex")) alvo.setAttribute("tabindex", "-1");
  alvo.focus({ preventScroll: true });
  alvo.scrollIntoView({ block: "nearest" });
}

export function MostrarMais({ visiveis, total, passo, itens, aoMostrar, todos = true, genero = "m", lista, className = "" }: MostrarMaisProps) {
  const caixa = useRef<HTMLDivElement>(null);
  const focar = useRef<number | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const resto = total - visiveis;

  useEffect(() => {
    if (focar.current === null) return;
    const i = focar.current;
    focar.current = null;
    focarItem(lista?.current ?? caixa.current?.previousElementSibling ?? null, i);
  }, [visiveis, lista]);

  const n = Math.min(passo, resto);
  const fmt = (x: number) => x.toLocaleString("pt-BR");

  function mostrar(limite: number) {
    const novo = Math.min(total, limite);
    focar.current = visiveis;
    // Anuncia só depois de um clique (a contagem dos filtros tem o seu próprio anúncio).
    setAnuncio(`Mostrando ${fmt(novo)} de ${fmt(total)} ${total === 1 ? itens.singular : itens.plural}.`);
    aoMostrar(novo);
  }
  return (
    <div ref={caixa} className={`flex flex-wrap items-center gap-2 ${className}`}>
      {resto > 0 ? (
        <>
          <button type="button" className="botao" onClick={() => mostrar(visiveis + passo)}>
            Mostrar mais {fmt(n)} {n === 1 ? itens.singular : itens.plural}
          </button>
          {todos && resto > passo ? (
            <button type="button" className="botao" onClick={() => mostrar(total)}>
              Mostrar {genero === "f" ? "todas" : "todos"} ({fmt(total)})<span className="sr-only"> {itens.plural}</span>
            </button>
          ) : null}
          <span className="text-sm text-[var(--cor-secundaria)]">
            faltam {fmt(resto)} {resto === 1 ? itens.singular : itens.plural}
          </span>
        </>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {anuncio}
      </span>
    </div>
  );
}
