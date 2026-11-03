import type { EstadoFormulario } from "../acoes";

/**
 * Mensagem de retorno de formulário, anunciada por leitores de tela. Com `id`, o campo pode
 * apontar para ela (aria-describedby) e o erro fica ligado ao campo.
 */
export function Mensagem({ estado, id }: { estado: EstadoFormulario; id?: string }) {
  if (estado.erro) {
    return (
      <p id={id} role="alert" className="aviso text-sm font-medium text-gray-900">
        {estado.erro}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p id={id} role="status" className="text-sm text-gray-800">
        {estado.ok}
      </p>
    );
  }
  return null;
}
