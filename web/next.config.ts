import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // As páginas do Congresso são geradas no build a partir de content/ (~45 MB de JSON).
  // Nada de content/ entra no pacote das funções: um id não gerado no build vira 404.
  outputFileTracingExcludes: {
    "/congresso": ["./content/**/*", "./public/**/*"],
    "/congresso/**": ["./content/**/*", "./public/**/*"],
    "/impostos/**": [
      "./content/camara/**/*",
      "./content/senado/**/*",
      "./content/congresso/**/*",
      "./content/executivo/**/*",
      "./content/stj/**/*",
      "./content/stf/**/*",
      "./content/_gerado/**/*",
    ],
    // Executivo e Justiça: páginas geradas no build; índices de busca em public/ (arquivos estáticos).
    "/executivo": ["./content/**/*", "./public/**/*"],
    "/executivo/**": ["./content/**/*", "./public/**/*"],
    "/justica": ["./content/**/*", "./public/**/*"],
    "/justica/**": ["./content/**/*", "./public/**/*"],
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
