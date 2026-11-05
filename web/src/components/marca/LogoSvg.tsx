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
        {/* Contorno do Brasil (litoral e fronteiras simplificados), centrado na lente. */}
        <path
          id={id("mapa")}
          fill="#ccff00"
          stroke="#ccff00"
          strokeWidth="2.5"
          strokeLinejoin="round"
          d="M-13.0 -42.9 L-12.1 -41.1 L-8.2 -35.6 L-3.7 -35.6 L-1.1 -36.7 L3.1 -36.3 L6.0 -41.1 L7.3 -40.0 L9.5 -35.4 L8.8 -33.2 L11.7 -31.0 L14.1 -30.1 L17.9 -29.2 L21.6 -25.9 L27.1 -25.2 L31.8 -25.0 L34.8 -23.3 L37.7 -20.8 L41.7 -20.2 L43.0 -15.8 L42.6 -12.5 L41.0 -10.0 L38.4 -7.6 L34.8 -2.8 L33.7 1.2 L34.0 6.1 L32.2 11.6 L30.9 13.3 L29.3 16.4 L27.1 19.3 L22.7 19.5 L17.6 21.5 L14.1 24.1 L12.6 26.4 L12.8 29.4 L11.9 31.6 L9.0 35.6 L6.2 39.1 L2.0 42.9 L1.8 40.5 L-2.6 36.7 L-7.3 35.2 L-3.7 30.8 L0.4 28.6 L1.3 25.9 L-0.7 25.0 L0.0 21.5 L-2.9 18.4 L-7.9 17.3 L-8.6 13.1 L-7.1 8.3 L-9.0 4.5 L-13.0 4.3 L-13.2 -1.0 L-18.1 -2.5 L-23.6 -5.4 L-24.5 -9.8 L-29.1 -8.5 L-31.5 -6.9 L-35.9 -7.2 L-35.9 -10.5 L-39.5 -10.7 L-43.0 -15.1 L-41.0 -20.0 L-34.6 -22.2 L-33.3 -28.8 L-34.4 -33.8 L-28.2 -34.1 L-26.5 -33.2 L-24.7 -33.0 L-21.4 -34.7 L-20.1 -36.7 L-21.4 -39.8 L-18.5 -40.2 L-14.6 -41.3 Z"
        />
        <g clipPath={`url(#${id("lente")})`}>
          <rect id={id("reflexo-faixa")} x="-140" y="-140" width="70" height="280" fill={`url(#${id("reflexo")})`} transform="rotate(25)" />
        </g>
        <path d="M-46,-28 A56,56 0 0,1 28,-46" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.45" strokeLinecap="round" />
      </g>
    </svg>
  );
}
