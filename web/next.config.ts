import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/**
 * Pacote das funções (Vercel: até 250 MB por função).
 *
 * O build gera as listas e só as páginas de detalhe recentes ou mais procuradas
 * (src/features/comum/prerender.ts); as demais páginas de detalhe são geradas na primeira
 * visita e ficam em cache até o próximo deploy. Para isso, cada uma dessas rotas leva no
 * pacote só os arquivos que lê ao renderizar (DADOS_SOB_DEMANDA). O resto de content/
 * (~250 MB de JSON) e de public/ (servido como arquivo estático) fica fora das funções.
 *
 * As chaves são casadas com as rotas por picomatch com `contains` (uma chave casa também as
 * rotas que a contêm, como a opengraph-image da página) e a exclusão vale depois da inclusão.
 * Por isso a exclusão geral nunca cobre o que alguma rota de DADOS_SOB_DEMANDA inclui, e cada
 * uma dessas rotas exclui o que só as outras usam.
 */

/** Globs relativos a web/ lidos na renderização sob demanda (conferidos com `next start`). */
const COMUNS = [
  "content/inicio/atualizacao.json", // faixa de atualização do layout
  "content/titulos/**/*",
  "content/participacao/**/*",
  "content/_gerado/*.json",
];
const CONGRESSO = [...COMUNS, "content/congresso/*.json", "content/camara/*.json", "content/senado/*.json"];
const ESTADOS = [...COMUNS, "content/_gerado/estados/**/*", "content/estados/*/*.json", "content/icms/**/*"];
const DADOS_SOB_DEMANDA: Record<string, string[]> = {
  "/congresso/votacoes/\\[casa\\]/\\[id\\]": [
    ...CONGRESSO,
    "content/camara/votacoes/**/*",
    "content/senado/votacoes/**/*",
    "public/congresso/busca.json",
  ],
  "/congresso/\\[casa\\]/parlamentares/\\[id\\]": [
    ...CONGRESSO,
    "content/camara/despesas/**/*",
    "content/camara/presenca/**/*",
    "content/senado/despesas/**/*",
    "content/senado/presenca/**/*",
    "content/autoria/**/*",
  ],
  "/estados/\\[uf\\]/votacoes/\\[id\\]": [...ESTADOS, "content/estados/*/votacoes/**/*", "content/alesp/votacoes/**/*"],
  "/estados/\\[uf\\]/deputados/\\[id\\]": ESTADOS,
  "/executivo/medidas-provisorias/\\[id\\]": [...COMUNS, "content/executivo/medidas-provisorias/**/*", "content/congresso/*.json"],
  "/executivo/vetos/\\[id\\]": [...COMUNS, "content/executivo/vetos/**/*", "content/congresso/*.json"],
  "/municipios/\\[uf\\]/\\[cidade\\]": [...COMUNS, "content/_gerado/municipios/**/*", "content/atibaia/**/*", "content/municipios/**/*"],
  "/municipios/\\[uf\\]/\\[cidade\\]/votacoes/\\[id\\]": [...COMUNS, "content/_gerado/municipios/**/*"],
};

/** Seções (primeiro segmento da rota) sem página gerada sob demanda: nada de content/. */
const SECOES_SEM_SOB_DEMANDA = [
  "/acessibilidade",
  "/agenda",
  "/api",
  "/entrar",
  "/impostos",
  "/justica",
  "/metodologia",
  "/minha-conta",
  "/participar",
  "/privacidade",
  "/quem-me-representa",
  "/tribunais-de-contas",
];

const relativo = (g: string) => `./${g}`;
/** O que alguma rota sob demanda inclui (nunca entra na exclusão geral). */
const USADOS = [...new Set(Object.values(DADOS_SOB_DEMANDA).flat())];
/** Algum glob de USADOS alcança o caminho `p` (ou algo dentro dele)? Compara segmento a segmento. */
function usado(p: string): boolean {
  const partes = p.split("/");
  return USADOS.some((g) => {
    const gs = g.split("/");
    for (let i = 0; i < partes.length; i++) {
      if (gs[i] === undefined) return false;
      if (gs[i] === "**") return true;
      if (!new RegExp(`^${gs[i].replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(partes[i])) return false;
    }
    return true;
  });
}

/**
 * Exclusão geral: tudo de content/ e public/ (gerados no prebuild, antes do next build) que
 * nenhuma rota sob demanda usa, olhando até o segundo nível ("content/inicio/busca.json").
 */
function naoUsados(pasta: string, nivel = 0): string[] {
  let lista: fs.Dirent[];
  try {
    lista = fs.readdirSync(path.join(process.cwd(), pasta), { withFileTypes: true });
  } catch {
    return usado(pasta) ? [] : [`${pasta}/**/*`];
  }
  return lista.flatMap((e) => {
    const p = `${pasta}/${e.name}`;
    if (!usado(p)) return [e.isDirectory() ? `${p}/**/*` : p];
    return e.isDirectory() && nivel < 1 ? naoUsados(p, nivel + 1) : [];
  });
}
const EXCLUIR_SEMPRE = [...naoUsados("content"), ...naoUsados("public")].map(relativo);

/** Nas pastas usadas, o que não está na lista da rota vai para fora (exclusão por rota). */
const excluirAlemDe = (proprios: string[]) => USADOS.filter((g) => !proprios.includes(g)).map(relativo);

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
  outputFileTracingIncludes: Object.fromEntries(
    Object.entries(DADOS_SOB_DEMANDA).map(([rota, globs]) => [rota, globs.map(relativo)]),
  ),
  outputFileTracingExcludes: {
    "/**": EXCLUIR_SEMPRE,
    ...Object.fromEntries(SECOES_SEM_SOB_DEMANDA.flatMap((s) => [s, `${s}/**`].map((k) => [k, USADOS.map(relativo)]))),
    ...Object.fromEntries(Object.entries(DADOS_SOB_DEMANDA).map(([rota, globs]) => [rota, excluirAlemDe(globs)])),
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
