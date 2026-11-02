"use client";

/**
 * Balão de glossário (parte cliente do <Termo>). Usa a Popover API nativa: toque abre, toque
 * fora ou Esc fecha, o foco volta ao termo. No celular o balão aparece como folha inferior.
 * Prefira <Termo>, que procura a definição nos glossários existentes.
 */
import { useId } from "react";

export interface BalaoTermoProps {
  /** Texto visível no meio da frase. */
  texto: string;
  /** Nome completo do termo (título do balão). */
  titulo: string;
  definicao: string;
}

export function BalaoTermo({ texto, titulo, definicao }: BalaoTermoProps) {
  const id = `termo-${useId().replace(/:/g, "")}`;
  return (
    <>
      <button type="button" className="termo-botao" popoverTarget={id} aria-haspopup="dialog">
        {texto}
        <span className="sr-only"> (ver explicação)</span>
      </button>
      <span id={id} popover="auto" role="dialog" aria-label={titulo} className="termo-balao">
        <span className="flex items-start justify-between gap-3">
          <strong className="block text-base">{titulo}</strong>
          <button
            type="button"
            className="botao -mr-1 -mt-1 shrink-0 px-3 text-sm"
            popoverTarget={id}
            popoverTargetAction="hide"
          >
            Fechar
          </button>
        </span>
        <span className="mt-1 block">{definicao}</span>
      </span>
    </>
  );
}
