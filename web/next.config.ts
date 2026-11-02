import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // As páginas do Congresso são geradas no build a partir de content/ (~45 MB de JSON).
  // Nada de content/ entra no pacote das funções: um id não gerado no build vira 404.
  outputFileTracingExcludes: {
    "/congresso": ["./content/**/*", "./public/congresso/**/*"],
    "/congresso/**": ["./content/**/*", "./public/congresso/**/*"],
    "/impostos/**": ["./content/camara/**/*", "./content/senado/**/*", "./content/congresso/**/*"],
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
