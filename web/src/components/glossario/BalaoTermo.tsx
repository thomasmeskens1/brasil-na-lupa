"use client";

/**
 * Balão de glossário (parte cliente do <Termo>). Usa a Popover API nativa como disclosure: o
 * termo é um botão que abre e fecha o balão (o navegador expõe aria-expanded); toque fora ou Esc
 * fecha e o foco volta ao termo. No celular o balão aparece como folha inferior.
 *
 * Leitor de tela: a definição também é a descrição do botão (aria-describedby), então quem
 * navega com leitor ouve "ad rem, botão, recolhido — Ad rem: tributo cobrado por unidade…" sem
 * precisar abrir. Ao abrir pelo teclado, o foco vai para o balão (o próximo Tab já é "Fechar").
 * Prefira <Termo>, que procura a definição nos glossários existentes.
 */
import { useId, useRef, type SyntheticEvent } from "react";

export interface BalaoTermoProps {
  /** Texto visível no meio da frase. */
  texto: string;
  /** Nome completo do termo (título do balão). */
  titulo: string;
  definicao: string;
}

export function BalaoTermo({ texto, titulo, definicao }: BalaoTermoProps) {
  const base = useId().replace(/:/g, "");
  const id = `termo-${base}`;
  const balao = useRef<HTMLSpanElement>(null);

  function aoAlternar(e: SyntheticEvent<HTMLSpanElement>) {
    // Abriu: leva o foco ao balão (leitor de tela lê o título e a definição).
    if ((e.nativeEvent as ToggleEvent).newState === "open") balao.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <button type="button" className="termo-botao" popoverTarget={id} aria-controls={id} aria-describedby={`${id}-desc`}>
        {texto}
        <span className="sr-only"> (ver explicação)</span>
      </button>
      <span id={`${id}-desc`} hidden>
        {titulo}: {definicao}
      </span>
      <span
        ref={balao}
        id={id}
        popover="auto"
        role="region"
        aria-label={`Explicação: ${titulo}`}
        tabIndex={-1}
        onToggle={aoAlternar}
        className="termo-balao"
      >
        <span className="flex items-start justify-between gap-3">
          <strong className="block text-base">{titulo}</strong>
          <button
            type="button"
            className="botao -mr-1 -mt-1 shrink-0 px-3 text-sm"
            popoverTarget={id}
            popoverTargetAction="hide"
          >
            Fechar<span className="sr-only"> a explicação de {titulo}</span>
          </button>
        </span>
        <span className="mt-1 block">{definicao}</span>
      </span>
    </>
  );
}
