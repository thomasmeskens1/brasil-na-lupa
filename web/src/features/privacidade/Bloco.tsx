import type { ReactNode } from "react";

export function Bloco({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-20">
      <h2 id={`${id}-t`} className="text-lg font-bold text-gray-900">
        {titulo}
      </h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-gray-800">{children}</div>
    </section>
  );
}
