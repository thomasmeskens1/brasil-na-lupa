"use client";

import { useActionState } from "react";
import { enviarLinkAcao, type EstadoFormulario } from "../acoes";
import { BOTAO_PRIMARIO } from "./estilos";
import { Mensagem } from "./Mensagem";

export function FormEntrar() {
  const [estado, acao, enviando] = useActionState<EstadoFormulario, FormData>(enviarLinkAcao, {});
  return (
    <form action={acao} className="space-y-3" noValidate>
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-semibold text-gray-900">
          Seu e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          className="block min-h-11 w-full max-w-md rounded border border-[var(--cor-borda-forte)] bg-white px-3 py-2 text-base text-gray-900"
        />
      </div>
      <Mensagem estado={estado} />
      <button type="submit" className={BOTAO_PRIMARIO} disabled={enviando}>
        {enviando ? "Enviando…" : "Receber link de acesso"}
      </button>
    </form>
  );
}
