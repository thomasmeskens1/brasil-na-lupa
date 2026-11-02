import type { EstadoFormulario } from "../acoes";

/** Mensagem de retorno de formulário, anunciada por leitores de tela. */
export function Mensagem({ estado }: { estado: EstadoFormulario }) {
  if (estado.erro) {
    return (
      <p role="alert" className="aviso text-sm font-medium text-gray-900">
        {estado.erro}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p role="status" className="text-sm text-gray-800">
        {estado.ok}
      </p>
    );
  }
  return null;
}
