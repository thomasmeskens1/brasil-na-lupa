import { BOTAO_PRIMARIO } from "./estilos";

/**
 * Digitação do código de 6 dígitos. Formulário comum (GET), sem depender de JavaScript: envia
 * o código e o e-mail para a conferência do Auth.js, a mesma do link do e-mail.
 */
export function FormCodigo({ email, voltar }: { email: string | null; voltar: string }) {
  return (
    <form method="get" action="/api/auth/callback/resend" className="space-y-4">
      <input type="hidden" name="callbackUrl" value={voltar} />
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <div className="space-y-1">
          <label htmlFor="codigo-email" className="block text-sm font-semibold text-gray-900">
            E-mail para o qual o código foi enviado
          </label>
          <input
            id="codigo-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            inputMode="email"
            className="block min-h-11 w-full max-w-md rounded border border-[var(--cor-borda-forte)] bg-white px-3 py-2 text-base text-gray-900"
          />
        </div>
      )}
      <div className="space-y-1">
        <label htmlFor="codigo" className="block text-sm font-semibold text-gray-900">
          Código de 6 dígitos
        </label>
        <p id="codigo-ajuda" className="meta">
          Vale por 10 minutos e só uma vez. Depois de 5 tentativas erradas, o código é cancelado.
        </p>
        <input
          id="codigo"
          name="token"
          type="text"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          minLength={6}
          autoFocus
          aria-describedby="codigo-ajuda"
          className="block min-h-11 w-40 rounded border border-[var(--cor-borda-forte)] bg-white px-3 py-2 font-mono text-xl tracking-[0.3em] text-gray-900"
        />
      </div>
      <button type="submit" className={BOTAO_PRIMARIO}>
        Entrar
      </button>
    </form>
  );
}
