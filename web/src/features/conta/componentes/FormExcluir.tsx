"use client";

import { useActionState } from "react";
import { excluirContaAcao, type EstadoFormulario } from "../acoes";
import { BOTAO_EXCLUIR } from "./estilos";
import { Mensagem } from "./Mensagem";

export function FormExcluir() {
  const [estado, acao, enviando] = useActionState<EstadoFormulario, FormData>(excluirContaAcao, {});
  return (
    <form action={acao} className="space-y-3">
      <div className="flex items-start gap-3">
        <input id="confirmo" name="confirmo" type="checkbox" value="sim" required className="mt-1 h-5 w-5 shrink-0" />
        <label htmlFor="confirmo" className="text-sm font-medium text-gray-900">
          Entendo que a exclusão é definitiva: a conta, o consentimento, as preferências, os favoritos e as reações são apagados agora
          e não podem ser recuperados.
        </label>
      </div>
      <Mensagem estado={estado} />
      <button type="submit" className={BOTAO_EXCLUIR} disabled={enviando}>
        {enviando ? "Excluindo…" : "Excluir minha conta definitivamente"}
      </button>
    </form>
  );
}
