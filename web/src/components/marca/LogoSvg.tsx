/**
 * Logotipo Brasil na Lupa em SVG, montado para o motion (docs/marca/ e
 * motion_graphics_logotipo_brasil_na_lupa.html). Cada parte tem um id para a animação.
 * Coordenadas: texto em x=30 (linhas em y=110 e 205); viewBox enquadra texto e lupa. A lupa é desenhada com centro em (0,0) dentro de #bnl-lupa.
 */
export const RAIO_LUPA = 72;
/** Enquadramento: texto de x=30 até o cabo da lupa (~610), faíscas acima de y=0. */
export const X_VB = 0;
export const Y_VB = -55;
export const LARGURA_VB = 640;

export function LogoSvg({ prefixo = "bnl" }: { prefixo?: string }) {
  const id = (n: string) => `${prefixo}-${n}`;
  return (
    <svg viewBox={`${X_VB} ${Y_VB} ${LARGURA_VB} 315`} className="h-auto w-full overflow-visible" aria-hidden="true" focusable="false">
      <defs>
        {/* Brilho forte (texto e lupa) e brilho suave (sublinhado), sem a sombra grosseira. */}
        <filter id={id("brilho")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feColorMatrix in="b" type="matrix" values="0 0 0 0 0.8  0 0 0 0 1  0 0 0 0 0  0 0 0 0.55 0" result="c" />
          <feMerge>
            <feMergeNode in="c" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={id("brilho-suave")} x="-10%" y="-200%" width="120%" height="500%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feColorMatrix in="b" type="matrix" values="0 0 0 0 0.8  0 0 0 0 1  0 0 0 0 0  0 0 0 0.35 0" result="c" />
          <feMerge>
            <feMergeNode in="c" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={id("reflexo")} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("neon")} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e5ff55" />
          <stop offset="100%" stopColor="#ccff00" />
        </linearGradient>
        <clipPath id={id("lente")}>
          <circle cx="0" cy="0" r={RAIO_LUPA - 8} />
        </clipPath>
        <clipPath id={id("revelar")}>
          <rect id={id("mascara")} x="0" y="-60" width="880" height="380" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id("revelar")})`}>
        <text id={id("brasil")} x="30" y="110" fontWeight="900" fontSize="105" fill="#ffffff" letterSpacing="-2" style={{ fontFamily: "var(--fonte-titulo), 'Arial Black', sans-serif" }}>
          BRASIL
        </text>
        <text id={id("nalupa")} x="30" y="205" fontWeight="900" fontSize="105" fill={`url(#${id("neon")})`} filter={`url(#${id("brilho")})`} letterSpacing="-2" style={{ fontFamily: "var(--fonte-titulo), 'Arial Black', sans-serif" }}>
          NA LUPA
        </text>
      </g>
      <path
        id={id("sublinhado")}
        pathLength={1}
        fill="none"
        stroke="#ccff00"
        strokeWidth="7"
        strokeLinecap="round"
        filter={`url(#${id("brilho-suave")})`}
        d="M36,236 Q240,246 470,228"
      />

      <g id={id("lupa")}>
        <g id={id("faiscas")} stroke="#ccff00" strokeWidth="5" strokeLinecap="round">
          <line x1="0" y1="-98" x2="0" y2="-114" />
          <line x1="70" y1="-70" x2="82" y2="-82" />
          <line x1="98" y1="0" x2="114" y2="0" />
          <line x1="-70" y1="-70" x2="-82" y2="-82" />
        </g>
        <path fill="#ccff00" filter={`url(#${id("brilho")})`} d="M45,45 L85,85 C92,92 104,92 111,85 C118,78 118,66 111,59 L71,19 Z" />
        <circle cx="0" cy="0" r={RAIO_LUPA} fill="#1a1a1d" stroke="#ccff00" strokeWidth="14" filter={`url(#${id("brilho")})`} />
        <circle cx="0" cy="0" r={RAIO_LUPA - 10} fill="#121214" />
        <path
          fill="#ccff00"
          transform="translate(-30 -34) scale(0.62)"
          d="M37 8 L52 5 L63 12 L74 9 L84 18 L96 22 L98 32 L92 41 L84 46 L80 58 L70 66 L64 78 L56 92 L50 88 L52 76 L45 70 L44 60 L36 55 L32 46 L22 44 L14 38 L12 28 L20 20 L30 18 Z"
        />
        <g clipPath={`url(#${id("lente")})`}>
          <rect id={id("reflexo-faixa")} x="-140" y="-140" width="70" height="280" fill={`url(#${id("reflexo")})`} transform="rotate(25)" />
        </g>
        <path d="M-46,-28 A56,56 0 0,1 28,-46" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.45" strokeLinecap="round" />
      </g>
    </svg>
  );
}
