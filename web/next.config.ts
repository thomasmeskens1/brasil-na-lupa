import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // A antiga seção "São Paulo" virou "Estados" (SP em /estados/sp).
  async redirects() {
    return [
      { source: "/sao-paulo", destination: "/estados/sp", permanent: true },
      { source: "/sao-paulo/:path*", destination: "/estados/sp/:path*", permanent: true },
      { source: "/atibaia", destination: "/municipios/sp/atibaia", permanent: true },
      { source: "/atibaia/leis-e-decretos", destination: "/municipios/sp/atibaia/leis-e-decretos", permanent: true },
    ];
  },
  partialPrefetching: true,
  // As páginas do Congresso são geradas no build a partir de content/ (~45 MB de JSON).
  // Nada de content/ entra no pacote das funções: um id não gerado no build vira 404.
  outputFileTracingExcludes: {
    // Início, Agenda e Quem me representa: páginas geradas no build; índices em public/.
    "/": ["./content/**/*", "./public/**/*"],
    "/agenda": ["./content/**/*", "./public/**/*"],
    "/quem-me-representa": ["./content/**/*", "./public/**/*"],
    "/quem-me-representa/**": ["./content/**/*", "./public/**/*"],
    "/congresso": ["./content/**/*", "./public/**/*"],
    "/congresso/**": ["./content/**/*", "./public/**/*"],
    "/impostos/**": [
      "./content/camara/**/*",
      "./content/senado/**/*",
      "./content/congresso/**/*",
      "./content/executivo/**/*",
      "./content/stj/**/*",
      "./content/stf/**/*",
      "./content/alesp/**/*",
      "./content/governo-sp/**/*",
      "./content/atibaia/**/*",
      "./content/tribunais-contas/**/*",
      "./content/_gerado/**/*",
    ],
    // Executivo e Justiça: páginas geradas no build; índices de busca em public/ (arquivos estáticos).
    "/executivo": ["./content/**/*", "./public/**/*"],
    "/executivo/**": ["./content/**/*", "./public/**/*"],
    "/justica": ["./content/**/*", "./public/**/*"],
    "/justica/**": ["./content/**/*", "./public/**/*"],
    // São Paulo e Atibaia: páginas geradas no build; índices de busca em public/ (arquivos estáticos).
    "/estados": ["./content/**/*", "./public/**/*"],
    "/estados/**": ["./content/**/*", "./public/**/*"],
    "/atibaia": ["./content/**/*", "./public/**/*"],
    "/atibaia/**": ["./content/**/*", "./public/**/*"],
    // Tribunais de Contas: páginas geradas no build; índice de acórdãos em public/ (arquivos estáticos).
    "/tribunais-de-contas": ["./content/**/*", "./public/**/*"],
    "/tribunais-de-contas/**": ["./content/**/*", "./public/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
