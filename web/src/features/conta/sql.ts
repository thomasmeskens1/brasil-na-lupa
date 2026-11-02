/**
 * Tipo mínimo de cliente SQL usado pelo cadastro: uma tag de template que devolve as linhas.
 * Em produção é o `neon()` de @neondatabase/serverless (HTTP, sem conexão persistente);
 * nos testes, um Postgres em memória. Valores interpolados viram parâmetros ($1, $2…),
 * nunca texto concatenado.
 */
export type Linha = Record<string, unknown>;
export type Sql = <T extends Linha = Linha>(strings: TemplateStringsArray, ...valores: unknown[]) => Promise<T[]>;
