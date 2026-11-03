"use client";

import { useActionState, useId } from "react";
import { enviarCodigoAcao, type EstadoFormulario } from "../acoes";
import { BOTAO_PRIMARIO } from "./estilos";
import { Mensagem } from "./Mensagem";

/**
 * Pedido do código de acesso por e-mail. Usado em /entrar e no convite (modal) das páginas.
 * `voltar`: página para onde a pessoa volta depois de entrar (só caminhos do próprio site).
 */
export function FormEntrar({ voltar, autoFocus = false }: { voltar?: string; autoFocus?: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoFormulario, FormData>(enviarCodigoAcao, {});
  const id = useId();
  const campo = `${id}-email`;
  const ajuda = `${id}-ajuda`;
  const msg = `${id}-msg`;
  return (
    <form action={acao} className="space-y-3" noValidate>
      {voltar ? <input type="hidden" name="voltar" value={voltar} /> : null}
      <div className="space-y-1">
        <label htmlFor={campo} className="block text-sm font-semibold text-gray-900">
          Seu e-mail
        </label>
        <p id={ajuda} className="meta">
          Enviamos um código de 6 dígitos (e um link) para entrar. Não há senha.
        </p>
        <input
          id={campo}
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          autoFocus={autoFocus}
          aria-invalid={estado.erro ? true : undefined}
          aria-describedby={estado.erro ? `${ajuda} ${msg}` : ajuda}
          className="block min-h-11 w-full max-w-md rounded border border-[var(--cor-borda-forte)] bg-white px-3 py-2 text-base text-gray-900"
        />
      </div>
      <Mensagem estado={estado} id={msg} />
      <button type="submit" className={BOTAO_PRIMARIO} disabled={enviando}>
        {enviando ? "Enviando…" : "Receber código de acesso"}
      </button>
    </form>
  );
}
