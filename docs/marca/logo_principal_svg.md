<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 200" width="100%" height="100%">
  <!-- Fundo Grafite Profundo opcional (remova o rect se desejar fundo transparente) -->
  <rect width="750" height="200" fill="#121214" rx="16"/>

  <!-- Estilos e Fontes -->
  <defs>
    <style>
      .text-brasil { font-family: 'Poppins', 'Arial Black', sans-serif; font-weight: 900; font-size: 68px; fill: #FFFFFF; letter-spacing: -1px; }
      .text-nalupa { font-family: 'Poppins', 'Arial Black', sans-serif; font-weight: 900; font-size: 68px; fill: #CCFF00; letter-spacing: -1px; }
      .spark { stroke: #CCFF00; stroke-width: 4; stroke-linecap: round; }
    </style>
    <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Grupo Tipográfico -->
  <g transform="translate(45, 75)">
    <text x="0" y="0" class="text-brasil">BRASIL</text>
    <text x="0" y="65" class="text-nalupa">NA LUPA</text>
  </g>

  <!-- Lupa com Mapa do Brasil Incorporado -->
  <g transform="translate(530, 20)">
    <!-- Linhas de Brilho / Movimento ao redor da Lupa -->
    <line x1="100" y1="5" x2="100" y2="20" class="spark" />
    <line x1="160" y1="25" x2="175" y2="35" class="spark" />
    <line x1="185" y1="85" x2="200" y2="85" class="spark" />
    <line x1="25" y1="30" x2="40" y2="42" class="spark" />

    <!-- Lente da Lupa (Círculo Externo Neon) -->
    <circle cx="100" cy="80" r="55" fill="#1A1A1D" stroke="#CCFF00" stroke-width="12" filter="url(#neon-glow)" />

    <!-- Vidro da Lupa (Reflexo sutil) -->
    <circle cx="100" cy="80" r="48" fill="#121214" opacity="0.8" />
    <path d="M 65 60 A 40 40 0 0 1 125 50" fill="none" stroke="#FFFFFF" stroke-width="3" opacity="0.4" stroke-linecap="round" />

    <!-- Silhueta do Mapa do Brasil dentro da Lupa -->
    <path d="M98,52 C104,50 114,52 120,57 C125,60 128,67 126,73 C124,78 119,81 116,86 C113,91 111,96 107,101 C104,104 99,108 95,103 C92,98 88,95 83,92 C79,88 78,83 80,78 C82,71 84,66 88,61 C91,57 94,54 98,52 Z" 
          fill="#CCFF00" />

    <!-- Cabo da Lupa -->
    <rect x="52" y="132" width="22" height="42" rx="11" fill="#CCFF00" transform="rotate(-45 52 132)" />
  </g>
</svg>