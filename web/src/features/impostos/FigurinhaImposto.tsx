/**
 * Figurinhas dos impostos, no mesmo estilo adesivo do manual da marca (borda branca grossa,
 * preenchimento sólido, contorno escuro; ver components/marca/Figurinhas.tsx). Decorativas
 * (aria-hidden): o nome do imposto sempre aparece em texto ao lado.
 */
import type { ReactNode } from "react";

export type NomeFigImposto =
  | "carrinho"
  | "maleta"
  | "fabrica"
  | "recibo"
  | "moedas"
  | "cofre"
  | "garrafa"
  | "carteira"
  | "carro"
  | "casa"
  | "presente"
  | "cesta";

const NEON = "var(--cor-acento)";
const ESCURO = "#1b1b23";
const CLARO = "#f4f4f6";

const FIGURAS: Record<NomeFigImposto, ReactNode> = {
  carrinho: (
    <>
      <path d="M6 12 H14 L20 40 H50 L56 20 H17" fill="none" />
      <path d="M17 20 H56 L50 40 H20 Z" fill={NEON} />
      <circle cx="24" cy="50" r="5" fill={CLARO} />
      <circle cx="46" cy="50" r="5" fill={CLARO} />
    </>
  ),
  maleta: (
    <>
      <path d="M24 18 V12 H40 V18" fill="none" />
      <path d="M8 18 H56 V52 H8 Z" fill={CLARO} />
      <path d="M8 18 H56 V32 H8 Z" fill={NEON} />
      <path d="M28 28 H36 V36 H28 Z" fill={CLARO} />
    </>
  ),
  fabrica: (
    <>
      <path d="M8 54 V28 L22 36 V28 L36 36 V28 L50 36 V54 Z" fill={CLARO} />
      <path d="M44 34 V10 H52 V54 H44 Z" fill={NEON} />
      <path d="M14 44 H20 V50 H14 Z M26 44 H32 V50 H26 Z" fill={ESCURO} />
    </>
  ),
  recibo: (
    <>
      <path d="M14 8 H50 V56 L44 52 L38 56 L32 52 L26 56 L20 52 L14 56 Z" fill={CLARO} />
      <path d="M20 18 H44 M20 26 H44 M20 34 H36" fill="none" />
      <circle cx="42" cy="42" r="6" fill={NEON} />
    </>
  ),
  moedas: (
    <>
      <ellipse cx="32" cy="46" rx="20" ry="7" fill={CLARO} />
      <path d="M12 46 V38 M52 46 V38" fill="none" />
      <ellipse cx="32" cy="36" rx="20" ry="7" fill={NEON} />
      <path d="M12 36 V28 M52 36 V28" fill="none" />
      <ellipse cx="32" cy="26" rx="20" ry="7" fill={CLARO} />
      <ellipse cx="32" cy="26" rx="8" ry="2.5" fill="none" />
    </>
  ),
  cofre: (
    <>
      <path d="M10 34 C10 22 20 16 32 16 C46 16 54 24 54 34 C54 42 48 46 46 48 V54 H38 V50 H26 V54 H18 V48 C13 45 10 40 10 34 Z" fill={NEON} />
      <path d="M26 22 H38" fill="none" strokeWidth="4" />
      <circle cx="44" cy="30" r="2.5" fill={ESCURO} />
      <path d="M26 8 H38 V18 H26 Z" fill={CLARO} />
    </>
  ),
  garrafa: (
    <>
      <path d="M28 6 H36 V18 C42 22 44 26 44 32 V56 H20 V32 C20 26 22 22 28 18 Z" fill={CLARO} />
      <path d="M20 34 H44 V48 H20 Z" fill={NEON} />
      <path d="M26 6 H38 V11 H26 Z" fill={ESCURO} />
    </>
  ),
  carteira: (
    <>
      <path d="M14 20 L44 10 L48 20 Z" fill={CLARO} />
      <path d="M8 20 H54 V54 H8 Z" fill={NEON} />
      <path d="M40 30 H58 V44 H40 Z" fill={CLARO} />
      <circle cx="46" cy="37" r="2.5" fill={ESCURO} />
    </>
  ),
  carro: (
    <>
      <path d="M6 44 V34 L14 32 L22 20 H42 L50 32 L58 34 V44 Z" fill={NEON} />
      <path d="M24 24 H40 L45 32 H19 Z" fill={CLARO} />
      <circle cx="18" cy="46" r="6" fill={CLARO} />
      <circle cx="46" cy="46" r="6" fill={CLARO} />
    </>
  ),
  casa: (
    <>
      <path d="M14 30 H50 V54 H14 Z" fill={CLARO} />
      <path d="M8 32 L32 12 L56 32 Z" fill={NEON} />
      <path d="M27 40 H37 V54 H27 Z" fill={NEON} />
    </>
  ),
  presente: (
    <>
      <path d="M10 26 H54 V36 H10 Z" fill={NEON} />
      <path d="M14 36 H50 V56 H14 Z" fill={CLARO} />
      <path d="M32 26 V56" fill="none" strokeWidth="5" />
      <path d="M32 26 C24 12 14 18 22 26 Z M32 26 C40 12 50 18 42 26 Z" fill={NEON} />
    </>
  ),
  cesta: (
    <>
      <path d="M18 26 C18 12 46 12 46 26" fill="none" strokeWidth="4" />
      <circle cx="26" cy="24" r="6" fill={NEON} />
      <circle cx="38" cy="22" r="6" fill={CLARO} />
      <path d="M6 26 H58 L52 54 H12 Z" fill={NEON} />
      <path d="M20 34 L22 48 M32 34 V48 M44 34 L42 48" fill="none" />
    </>
  ),
};

export function FigurinhaImposto({ nome, className = "h-12 w-12" }: { nome: NomeFigImposto; className?: string }) {
  const figura = FIGURAS[nome];
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <g stroke="#ffffff" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" fill="#ffffff">
        {figura}
      </g>
      <g stroke={ESCURO} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        {figura}
      </g>
    </svg>
  );
}
