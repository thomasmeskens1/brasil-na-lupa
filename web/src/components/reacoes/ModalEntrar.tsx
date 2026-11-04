"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { aoPedirEntrada, ID_MODAL_ENTRAR } from "@/features/conta/cliente";
import { FormEntrar } from "@/features/conta/componentes/FormEntrar";

/**
 * Convite para entrar ou criar conta, aberto pelos botões de reação e de favorito quando a
 * pessoa não tem sessão. Montado uma vez no layout (só com o cadastro ligado).
 *
 * Acessibilidade: <dialog> modal (aria-modal; o resto da página fica inerte), foco inicial no
 * campo de e-mail, Tab preso dentro da janela, Esc fecha e o foco volta ao botão de origem.
 */
export function ModalEntrar() {
  const dialogo = useRef<HTMLDialogElement>(null);
  const origem = useRef<HTMLElement | null>(null);
  const [aberto, setAberto] = useState<{ motivo: string; voltar: string; chave: number } | null>(null);

  useEffect(
    () =>
      aoPedirEntrada(({ origem: o, motivo }) => {
        origem.current = o;
        setAberto({ motivo, voltar: window.location.pathname, chave: Date.now() });
      }),
    [],
  );

  useEffect(() => {
    const d = dialogo.current;
    if (!aberto || !d) return;
    if (!d.open) d.showModal();
    d.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
  }, [aberto]);

  function aoFechar() {
    setAberto(null);
    const o = origem.current;
    origem.current = null;
    if (o && document.contains(o)) o.focus();
  }

  /** Mantém o Tab dentro da janela (também com Shift+Tab). */
  function prenderFoco(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key !== "Tab" || !dialogo.current) return;
    const focaveis = [
      ...dialogo.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled])'),
    ];
    if (!focaveis.length) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  return (
    <dialog
      id={ID_MODAL_ENTRAR}
      ref={dialogo}
      aria-modal="true"
      aria-labelledby="modal-entrar-titulo"
      aria-describedby="modal-entrar-motivo"
      onClose={aoFechar}
      onKeyDown={prenderFoco}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-[var(--cor-borda-forte)] bg-superficie p-5 text-foreground backdrop:bg-black/75"
    >
      {aberto ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 id="modal-entrar-titulo" className="text-xl font-bold text-foreground">
              Entre ou crie sua conta
            </h2>
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="botao botao-mini"
              aria-label="Fechar o convite para entrar"
            >
              Fechar
            </button>
          </div>
          <p id="modal-entrar-motivo" className="text-sm leading-relaxed text-[var(--cor-secundaria)]">
            {aberto.motivo} A conta é gratuita e opcional: todo o conteúdo continua aberto. O mesmo código cria a conta
            no primeiro acesso.
          </p>
          <FormEntrar key={aberto.chave} voltar={aberto.voltar} />
          <p className="meta">
            Guardamos só o necessário. Veja a{" "}
            <Link href="/privacidade#cadastro" className="lk">
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      ) : null}
    </dialog>
  );
}
