/**
 * Figurinhas (manual da marca, item 4): ícones em estilo adesivo, com borda branca grossa,
 * preenchimento sólido e contorno escuro. Puramente decorativos (aria-hidden); o texto ao lado
 * sempre diz o que é. O neon nunca distingue opções de voto nem partidos (diretriz 11).
 */
import type { ReactNode } from "react";

export type NomeFigurinha =
  | "congresso"
  | "dinheiro"
  | "balanca"
  | "lupa"
  | "pino"
  | "calendario"
  | "caneta"
  | "mapa"
  | "cidade"
  | "pessoas";

const NEON = "var(--cor-acento)";
const ESCURO = "#1b1b23";
const CLARO = "#f4f4f6";

/** Cada figura é desenhada duas vezes: a borda branca (adesivo) e, por cima, a figura. */
function Adesivo({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <g stroke="#ffffff" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" fill="#ffffff">
        {children}
      </g>
      <g stroke={ESCURO} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        {children}
      </g>
    </svg>
  );
}

const FIGURAS: Record<NomeFigurinha, ReactNode> = {
  congresso: (
    <>
      <path d="M10 50 H54 V54 H10 Z" fill={CLARO} />
      <path d="M14 30 H50 V50 H14 Z" fill={CLARO} />
      <path d="M20 34 V46 M28 34 V46 M36 34 V46 M44 34 V46" fill="none" />
      <path d="M12 30 L32 14 L52 30 Z" fill={NEON} />
    </>
  ),
  dinheiro: (
    <>
      <path d="M8 20 L50 14 L56 42 L14 48 Z" fill={NEON} />
      <circle cx="32" cy="31" r="8" fill={CLARO} />
      <path d="M32 26 V36 M29.5 28.5 Q32 26.5 34.5 28.5 Q35 31 32 31 Q29 31 29.5 33.5 Q32 35.5 34.5 33.5" fill="none" />
    </>
  ),
  balanca: (
    <>
      <path d="M32 12 V50 M22 52 H42" fill="none" />
      <path d="M14 20 H50" fill="none" />
      <path d="M8 36 L14 22 L20 36 Z M44 36 L50 22 L56 36 Z" fill={NEON} />
      <path d="M6 36 H22 Q14 44 6 36 Z M42 36 H58 Q50 44 42 36 Z" fill={CLARO} />
    </>
  ),
  lupa: (
    <>
      <path d="M40 40 L54 54" fill="none" strokeWidth="7" />
      <circle cx="28" cy="28" r="16" fill={CLARO} />
      <circle cx="28" cy="28" r="10" fill={NEON} />
    </>
  ),
  pino: (
    <>
      <path d="M32 56 C20 40 14 32 14 24 A18 18 0 0 1 50 24 C50 32 44 40 32 56 Z" fill={NEON} />
      <circle cx="32" cy="24" r="7" fill={CLARO} />
    </>
  ),
  calendario: (
    <>
      <path d="M10 16 H54 V54 H10 Z" fill={CLARO} />
      <path d="M10 16 H54 V26 H10 Z" fill={NEON} />
      <path d="M20 10 V20 M44 10 V20" fill="none" />
      <path d="M18 34 H24 V40 H18 Z M29 34 H35 V40 H29 Z M40 34 H46 V40 H40 Z M18 44 H24 V50 H18 Z" fill={ESCURO} />
    </>
  ),
  caneta: (
    <>
      <path d="M12 12 H42 V54 H12 Z" fill={CLARO} />
      <path d="M18 22 H36 M18 30 H36 M18 38 H28" fill="none" />
      <path d="M40 46 L54 18 L58 20 L44 48 L39 51 Z" fill={NEON} />
    </>
  ),
  mapa: (
    <>
      <path d="M8 16 L24 10 L40 16 L56 10 V48 L40 54 L24 48 L8 54 Z" fill={CLARO} />
      <path d="M24 10 V48 M40 16 V54" fill="none" />
      <circle cx="32" cy="30" r="6" fill={NEON} />
    </>
  ),
  cidade: (
    <>
      <path d="M8 54 H56" fill="none" />
      <path d="M12 54 V30 H26 V54 Z" fill={CLARO} />
      <path d="M26 54 V14 H42 V54 Z" fill={NEON} />
      <path d="M42 54 V34 H54 V54 Z" fill={CLARO} />
      <path d="M31 22 H37 M31 30 H37 M31 38 H37" fill="none" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="22" cy="22" r="8" fill={CLARO} />
      <circle cx="42" cy="22" r="8" fill={NEON} />
      <path d="M8 52 Q8 34 22 34 Q36 34 36 52 Z" fill={CLARO} />
      <path d="M28 52 Q28 34 42 34 Q56 34 56 52 Z" fill={NEON} />
    </>
  ),
};

export function Figurinha({ nome, className = "h-12 w-12" }: { nome: NomeFigurinha; className?: string }) {
  return <Adesivo className={className}>{FIGURAS[nome]}</Adesivo>;
}

/** Seta desenhada à mão (rabisco), apontando para baixo e à direita. */
export function SetaRabisco({ className = "h-14 w-20" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 56" className={`rabisco ${className}`} aria-hidden="true" focusable="false">
      <path
        pathLength={1}
        d="M4 8 C20 4 30 14 26 24 C22 32 12 26 18 20 C26 12 44 18 52 30 C56 36 58 42 60 48"
        fill="none"
        stroke="var(--cor-acento)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path pathLength={1} d="M50 42 L60 50 L66 38" fill="none" stroke="var(--cor-acento)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Traço de sublinhado à mão, usado sob títulos de destaque. */
export function Sublinhado({ className = "h-3 w-48" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 12" className={`rabisco ${className}`} aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <path pathLength={1} d="M3 8 C50 3 120 2 197 6 M30 10 C80 8 130 8 170 9" fill="none" stroke="var(--cor-acento)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
