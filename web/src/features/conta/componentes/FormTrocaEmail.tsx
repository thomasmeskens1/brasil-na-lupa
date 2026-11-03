"use client";

import { useActionState } from "react";
import { confirmarTrocaEmailAcao, pedirTrocaEmailAcao, type EstadoFormulario } from "../acoes";
import { BOTAO_SECUNDARIO } from "./estilos";
import { Mensagem } from "./Mensagem";

const campo =
  "block min-h-11 w-full max-w-md rounded border border-[var(--cor-borda-forte)] bg-white px-3 py-2 text-base text-gray-900";

/** Correção do e-mail (LGPD, art. 18, III): código enviado ao endereço novo antes da troca. */
export function FormTrocaEmail() {
  const [pedido, pedir, pedindo] = useActionState<EstadoFormulario, FormData>(pedirTrocaEmailAcao, {});
  const [conf, confirmar, confirmando] = useActionState<EstadoFormulario, FormData>(confirmarTrocaEmailAcao, {});
  const pendente = conf.ok ? undefined : (conf.pendente ?? pedido.pendente);
  return (
    <div className="space-y-4">
      <form action={pedir} className="space-y-2" noValidate>
        <label htmlFor="novo-email" className="block text-sm font-semibold text-gray-900">
          Novo e-mail
        </label>
        <input
          id="novo-email"
          name="novoEmail"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          aria-invalid={pedido.erro ? true : undefined}
          aria-describedby={pedido.erro || pedido.ok ? "novo-email-msg" : undefined}
          className={campo}
        />
        <Mensagem estado={{ erro: pedido.erro, ok: pedido.ok }} id="novo-email-msg" />
        <button type="submit" className={BOTAO_SECUNDARIO} disabled={pedindo}>
          {pedindo ? "Enviando…" : "Enviar código para o novo e-mail"}
        </button>
      </form>

      {pendente ? (
        <form action={confirmar} className="space-y-2">
          <input type="hidden" name="novoEmail" value={pendente} />
          <label htmlFor="codigo-troca" className="block text-sm font-semibold text-gray-900">
            Código de 6 dígitos enviado para {pendente}
          </label>
          <input
            id="codigo-troca"
            name="codigo"
            type="text"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={7}
            aria-invalid={conf.erro ? true : undefined}
            aria-describedby={conf.erro ? "codigo-troca-msg" : undefined}
            className="block min-h-11 w-40 rounded border border-[var(--cor-borda-forte)] bg-white px-3 py-2 font-mono text-xl tracking-[0.3em] text-gray-900"
          />
          <Mensagem estado={{ erro: conf.erro }} id="codigo-troca-msg" />
          <button type="submit" className={BOTAO_SECUNDARIO} disabled={confirmando}>
            Confirmar a troca
          </button>
        </form>
      ) : null}
      {conf.ok ? <Mensagem estado={{ ok: conf.ok }} /> : null}
    </div>
  );
}
