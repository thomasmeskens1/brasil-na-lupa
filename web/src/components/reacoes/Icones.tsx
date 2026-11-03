/** Ícones (contorno; preenchido quando marcado). Decorativos: o nome fica no botão. */
export function Polegar({ para, cheio, className }: { para: "cima" | "baixo"; cheio: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill={cheio ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      style={para === "baixo" ? { transform: "rotate(180deg)" } : undefined}
    >
      <path d="M7 10v11H3V10h4Zm0 0 4-8c1.7 0 3 1.3 3 3v4h5.2c1.3 0 2.2 1.2 1.9 2.4l-2 8A2 2 0 0 1 17.2 21H7" />
    </svg>
  );
}

export function Estrela({ cheia, className }: { cheia: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill={cheia ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    </svg>
  );
}
