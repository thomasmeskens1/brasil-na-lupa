/**
 * Glossário geral: junta os glossários que as seções já mantêm (diretriz 9). Nenhuma definição
 * nova é escrita aqui. A primeira seção listada que tiver o termo vence.
 *
 *   definicaoDe("Obstrução")        // → { termo: "Obstrução", explicacao: "…" }
 *   definicaoDe("CONFAZ")           // casa também com "CONFAZ (Conselho Nacional …)" e com siglas
 *   definicaoDe("ad rem", listaExtra) // procura antes em listaExtra (ex.: glossário do ICMS lido de content/)
 */
import { TERMOS_ATIBAIA } from "@/features/atibaia/termos";
import { TERMOS } from "@/features/congresso/rotulos";
import { TERMOS_EXECUTIVO } from "@/features/executivo/rotulos";
import { GLOSSARIO_BASE } from "@/features/icms/glossario-base";
import { TERMOS_JUSTICA } from "@/features/justica/rotulos";
import { TERMOS_SP } from "@/features/sao-paulo/rotulos";
import { TERMOS_TC } from "@/features/tribunais-contas/rotulos";

export interface EntradaGlossario {
  termo: string;
  explicacao: string;
  sigla?: string | null;
}

export const GLOSSARIO_GERAL: EntradaGlossario[] = [
  ...GLOSSARIO_BASE,
  ...Object.values(TERMOS),
  ...Object.values(TERMOS_EXECUTIVO),
  ...Object.values(TERMOS_JUSTICA),
  ...Object.values(TERMOS_SP),
  ...Object.values(TERMOS_TC),
  ...TERMOS_ATIBAIA,
];

function chave(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Formas pelas quais uma entrada pode ser procurada: termo, termo sem parênteses, sigla. */
function formas(e: EntradaGlossario): string[] {
  const f = [e.termo];
  const m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(e.termo);
  if (m) f.push(m[1], m[2]);
  if (e.sigla) f.push(e.sigla);
  return f.map(chave);
}

/** Procura um termo (ignora maiúsculas, acentos e o que estiver entre parênteses). */
export function definicaoDe(termo: string, extra: readonly EntradaGlossario[] = []): EntradaGlossario | null {
  const k = chave(termo);
  for (const lista of [extra, GLOSSARIO_GERAL]) {
    const e = lista.find((x) => formas(x).includes(k));
    if (e) return e;
  }
  return null;
}
