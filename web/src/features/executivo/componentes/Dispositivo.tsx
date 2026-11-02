import type { ReactNode } from "react";

/**
 * Citação literal de documento oficial, com quebras de linha preservadas (corpo em 16 px).
 * Componente sem estado: serve a páginas de servidor e a componentes cliente.
 */
export function Citacao({ rotulo, texto, children }: { rotulo: ReactNode; texto: string | null | undefined; children?: ReactNode }) {
  return (
    <figure className="mt-3">
      <figcaption className="text-sm font-semibold text-foreground">{rotulo}</figcaption>
      {texto ? (
        <blockquote className="mt-1 whitespace-pre-line border-l-4 border-[#9aa5b1] bg-superficie px-3 py-2 leading-relaxed text-foreground [overflow-wrap:break-word]">
          {texto.trim()}
        </blockquote>
      ) : (
        <p className="lacuna mt-1 text-sm">Informação não disponível em fonte oficial.</p>
      )}
      {children}
    </figure>
  );
}
