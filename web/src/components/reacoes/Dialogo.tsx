"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Janela modal simples (<dialog> nativo com showModal: o resto da página fica inerte, Esc
 * fecha). Ao fechar, o foco volta ao botão de origem. Usada no aviso "disponível em breve" e no
 * consentimento das reações aberto a partir de um cartão.
 */
export function Dialogo({
  titulo,
  origem,
  aoFechar,
  children,
}: {
  titulo: string;
  origem: HTMLElement | null;
  aoFechar: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    d?.querySelector<HTMLElement>("[data-foco-inicial]")?.focus();
    // Ao desmontar (fechou, ou a ação terminou), o foco volta ao botão de origem.
    return () => {
      if (origem && document.contains(origem)) origem.focus();
    };
  }, [origem]);

  function fechar() {
    aoFechar();
  }

  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-labelledby={`${id}-t`}
      onClose={fechar}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-[var(--cor-borda-forte)] bg-superficie p-5 text-left text-foreground backdrop:bg-black/75"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`${id}-t`} className="text-xl font-bold text-foreground">
            {titulo}
          </h2>
          <button type="button" onClick={() => ref.current?.close()} className="botao botao-mini" aria-label={`Fechar: ${titulo}`}>
            Fechar
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** Aviso mostrado quando o cadastro ainda não está ligado neste site. */
export function DialogoEmBreve({ origem, aoFechar, texto }: { origem: HTMLElement | null; aoFechar: () => void; texto?: string }) {
  return (
    <Dialogo titulo="O cadastro estará disponível em breve" origem={origem} aoFechar={aoFechar}>
      <p className="text-sm leading-relaxed text-[var(--cor-secundaria)]">
        {texto ??
          "Curtir e não curtir uma proposta é só para quem tem conta, e as contas ainda não foram abertas. Todo o conteúdo do site continua aberto, sem cadastro."}
      </p>
      <form method="dialog">
        <button type="submit" className="botao" data-foco-inicial>
          Entendi
        </button>
      </form>
    </Dialogo>
  );
}
