/**
 * Quais páginas de detalhe são geradas no build (generateStaticParams).
 *
 * O build gera só o essencial: as listas e as páginas de detalhe mais recentes ou mais
 * procuradas. As demais são geradas na primeira visita e ficam em cache até o próximo
 * deploy (ISR do cacheComponents; ver "ISR with Cache Components" na documentação do Next).
 * Para isso, cada rota de detalhe leva no pacote da função só os arquivos de content/ que lê
 * (outputFileTracingIncludes em next.config.ts). Um id inexistente continua em notFound().
 */

/** Janela, em dias, das votações e atos gerados no build. */
export const JANELA_DIAS = 60;

/**
 * Itens dos últimos `dias` dias, contados da data mais recente da própria lista (e não do
 * relógio: o resultado depende só dos dados, e uma coleta parada não esvazia o build).
 * Itens sem data ficam de fora (são gerados na primeira visita).
 */
export function recentes<T>(itens: T[], data: (item: T) => string | null | undefined, dias = JANELA_DIAS): T[] {
  let max = "";
  for (const i of itens) {
    const d = data(i);
    if (d && d > max) max = d;
  }
  if (!max) return [];
  const t = Date.parse(max.slice(0, 10));
  if (Number.isNaN(t)) return [];
  const limite = new Date(t - dias * 86_400_000).toISOString().slice(0, 10);
  return itens.filter((i) => {
    const d = data(i);
    return !!d && d.slice(0, 10) >= limite;
  });
}

/** Com cacheComponents a lista não pode ser vazia: se o recorte esvaziar, gera o primeiro item. */
export function ouPrimeiro<T>(recorte: T[], todos: T[]): T[] {
  return recorte.length ? recorte : todos.slice(0, 1);
}
