/**
 * Gancho de resolução para os testes: os módulos do site importam uns aos outros sem extensão
 * ("./ids"), como o Next.js aceita; aqui, quando a importação relativa sem extensão falha,
 * tenta o mesmo caminho com ".ts". Registrado no início de cada arquivo de teste.
 */
export async function resolve(especificador, contexto, proximo) {
  try {
    return await proximo(especificador, contexto);
  } catch (erro) {
    const relativo = especificador.startsWith("./") || especificador.startsWith("../");
    if (relativo && !/\.[cm]?[jt]sx?$/.test(especificador)) return proximo(`${especificador}.ts`, contexto);
    throw erro;
  }
}
