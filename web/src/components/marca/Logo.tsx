/**
 * Logotipo Brasil na Lupa (manual da marca): "BRASIL" em branco e "NA LUPA" em neon, empilhados,
 * com a lupa sobre o mapa do Brasil. SVG puro, sem imagem externa.
 */
export function SimboloLupa({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <g fill="none" stroke="var(--cor-acento)" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="20" cy="20" r="12.5" strokeWidth="3.5" />
        <path d="M29.5 29.5 L41 41" strokeWidth="6" />
        <path d="M34 6.5 l2.2 -3 M38 10 l3.3 -1.6 M30 4.5 l0.4 -3.3" strokeWidth="2.2" />
      </g>
      <path
        fill="var(--cor-acento)"
        d="M12.6 17.2 L16.4 12.9 L20.6 12.6 L22.4 14.2 L27.4 15.4 L27.9 17.4 L26.2 20.1 L25.4 23.4 L23.2 25.1 L21.5 28.3 L20.2 26.6 L20.8 24.2 L18.8 22.9 L18.1 20.4 L15.2 20.1 L13.1 19.2 Z"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="titulo-marca flex flex-col text-[1.05rem] leading-[0.95] font-black uppercase tracking-tight">
        <span className="text-white-puro">Brasil</span>
        <span className="text-[var(--cor-acento)]">na Lupa</span>
      </span>
      <SimboloLupa />
    </span>
  );
}
