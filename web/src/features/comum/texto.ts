/**
 * Limpeza de textos de lacunas e observações gravados pela coleta, para exibição (diretriz 10:
 * sem nomes de campos, caminhos de arquivos ou códigos técnicos). Só remove ou troca a forma
 * técnica de citar a fonte; o conteúdo informado não muda.
 */
const TROCAS: [RegExp, string][] = [
  [/\bProcessos\.csv\b/g, "lista oficial de processos (dados abertos do STJ)"],
  [/\bTemas\.csv\b/g, "lista oficial de temas (dados abertos do STJ)"],
  [/"ministroRelator"|\bministroRelator\b/g, "relator"],
  [/"dataAfetacao"/g, "data de afetação"],
  [/"dataPublicacaoAfetacao"/g, "data de publicação da afetação"],
  [/\bcampo relator\b/g, "relator"],
  [/\bListarPresencasDia\b/g, "frequência diária"],
];

export function textoLegivel(t: string): string {
  let s = t;
  for (const [re, por] of TROCAS) s = s.replace(re, por);
  // Parênteses que só citam pastas de dados ou campos internos (ex.: "(dados/camara)").
  s = s.replace(/\s*\((?:[^()]*\bdados\/[^()]*|[^()]*\b[a-z]+_[a-z_]+\b[^()]*)\)/g, "");
  // Campos internos entre aspas (ex.: "situacao_oficial") viram "campo da fonte".
  s = s.replace(/"[a-z]+(?:_[a-z]+)+"/g, "campo da fonte");
  return s.replace(/\s{2,}/g, " ").trim();
}

/** Lacunas em texto legível (aceita string ou objeto com "descricao"). */
export function lacunasLegiveis(lacunas: readonly (string | Record<string, unknown>)[] | null | undefined): string[] {
  return (lacunas ?? [])
    .map((l) => (typeof l === "string" ? l : typeof l?.descricao === "string" ? l.descricao : null))
    .filter((t): t is string => !!t)
    .map(textoLegivel);
}

/** Título de fonte sem nomes de arquivos ou códigos internos (ex.: "arquivo 20250831.json", "(Temas.csv)"). */
export function tituloFonteLegivel<T extends { titulo?: string | null }>(f: T): T {
  if (!f.titulo) return f;
  const t = textoLegivel(
    f.titulo
      .replace(/\s*\((?:Temas|Processos)\.csv(?: e (?:Temas|Processos)\.csv)?\)/g, "")
      .replace(/,\s*arquivo [\w.-]+\.json/g, "")
      .replace(/,\s*acórdão id \d+/g, "")
      .replace(/\s*\(verTeseTema\.asp\)/g, "")
      .replace(/espelhos-de-acordaos-([a-z-]+)/g, (_m, o: string) => `espelhos de acórdãos (${o.replace(/-/g, " ")})`),
  );
  return { ...f, titulo: t };
}
