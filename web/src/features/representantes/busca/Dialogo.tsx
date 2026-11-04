"use client";

/**
 * Janela modal acessível (WCAG 2.2): <dialog> nativo aberto com showModal() (o resto da página
 * fica inerte), aria-modal, título ligado por aria-labelledby, foco preso no Tab e Shift+Tab,
 * Esc fecha e o foco volta para quem abriu. A rolagem da página fica parada enquanto está aberta.
 */
import { useEffect, useRef, type ReactNode } from "react";

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function Dialogo({
  aberto,
  aoFechar,
  idTitulo,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  idTitulo: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const origem = useRef<HTMLElement | null>(null);
  const fechar = useRef(aoFechar);
  useEffect(() => {
    fechar.current = aoFechar;
  }, [aoFechar]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) {
      origem.current = document.activeElement as HTMLElement | null;
      d.showModal();
      document.documentElement.style.overflow = "hidden";
      // Foco inicial no título: o leitor de tela anuncia o nome do político primeiro.
      requestAnimationFrame(() => d.querySelector<HTMLElement>(`#${CSS.escape(idTitulo)}`)?.focus());
    } else if (!aberto && d.open) {
      d.close();
    }
  }, [aberto, idTitulo]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const aoFecharNativo = () => {
      document.documentElement.style.overflow = "";
      const o = origem.current;
      origem.current = null;
      if (o && document.contains(o)) o.focus();
      fechar.current();
    };
    const aoCancelar = (e: Event) => {
      e.preventDefault(); // Esc: fecha pelo mesmo caminho (devolve o foco).
      d.close();
    };
    d.addEventListener("close", aoFecharNativo);
    d.addEventListener("cancel", aoCancelar);
    return () => {
      d.removeEventListener("close", aoFecharNativo);
      d.removeEventListener("cancel", aoCancelar);
      document.documentElement.style.overflow = "";
    };
  }, []);

  function prenderFoco(e: React.KeyboardEvent<HTMLDialogElement>) {
    if (e.key !== "Tab") return;
    const d = ref.current;
    if (!d) return;
    const lista = [...d.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!lista.length) return;
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    const atual = document.activeElement;
    if (e.shiftKey && (atual === primeiro || !d.contains(atual) || atual === d.querySelector(`#${CSS.escape(idTitulo)}`))) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && atual === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-labelledby={idTitulo}
      onKeyDown={prenderFoco}
      onClick={(e) => {
        // Toque fora do cartão (no fundo escurecido) também fecha.
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-0 mx-auto mt-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[var(--cor-borda-forte)] bg-[var(--cor-superficie)] p-0 text-[var(--foreground)] backdrop:bg-black/75 sm:my-auto sm:max-h-[88dvh] sm:rounded-2xl"
    >
      {aberto ? children : null}
    </dialog>
  );
}
