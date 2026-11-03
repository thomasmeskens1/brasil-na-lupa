/**
 * Cruzamento, no navegador, do índice público de decisões recentes com os favoritos da pessoa
 * (bloco "Seus favoritos" da página inicial). Ordem só pela data, da mais recente para a mais
 * antiga, sem ranking nem seleção. Sem dependências externas (testável com node --test).
 */
import type { TipoFavorito } from "./ids";
import type { DecisaoIndice, IndiceFavoritos } from "./indice";
import { TEMAS } from "./regras";

export interface DecisaoFavorita extends DecisaoIndice {
  /** Por que a decisão aparece (texto para a pessoa). */
  motivos: string[];
}

export function decisoesDosFavoritos(
  indice: Pick<IndiceFavoritos, "decisoes" | "politicos">,
  fav: Record<TipoFavorito, string[]>,
  limite = 8,
): DecisaoFavorita[] {
  const propostas = new Set(fav.proposta);
  const ufs = new Set(fav.uf);
  const nomesTema = new Set(TEMAS.filter((t) => fav.tema.includes(t.id)).map((t) => t.nome));
  const doPolitico = new Set<number>();
  for (const p of fav.politico) for (const i of indice.politicos[p] ?? []) doPolitico.add(i);

  const saida: DecisaoFavorita[] = [];
  indice.decisoes.forEach((d, i) => {
    const motivos: string[] = [];
    if (propostas.has(d.k)) motivos.push("proposta favorita");
    if (d.uf && ufs.has(d.uf)) motivos.push(`estado favorito (${d.uf})`);
    if (d.tm && nomesTema.has(d.tm)) motivos.push(`tema favorito (${d.tm})`);
    if (doPolitico.has(i)) motivos.push("votação nominal com voto de político favorito");
    if (motivos.length) saida.push({ ...d, motivos });
  });
  return saida.sort((a, b) => (b.d ?? "").localeCompare(a.d ?? "") || a.k.localeCompare(b.k)).slice(0, limite);
}

export function temFavoritos(fav: Record<TipoFavorito, string[]> | undefined): boolean {
  return !!fav && Object.values(fav).some((l) => l.length > 0);
}
