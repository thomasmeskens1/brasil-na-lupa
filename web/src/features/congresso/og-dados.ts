/**
 * Dados das imagens Open Graph do Congresso (somente rotas opengraph-image.tsx).
 * As imagens são geradas sob demanda (não no build: seriam ~4.500 PNG). Como content/ não
 * acompanha as funções, os dados vêm de um módulo gerado por scripts/gerar-congresso.mjs e
 * empacotado na rota. Não importe este arquivo em páginas.
 */
import og from "../../../content/congresso/og-dados.mjs";
import { decodificar, type IndiceBusca, type LinhaVotacao } from "./lista";
import type { Casa } from "./tipos";

interface DadosOg extends IndiceBusca {
  /** "<casa>/<id>" → [nome, partido, UF, votações nominais com registro, na lista atual (1/0)] */
  parlamentares: Record<string, [string, string, string, number, number]>;
}

const dados = og as DadosOg;
let mapa: Map<string, LinhaVotacao> | null = null;

export function votacaoOg(casa: Casa, id: string): LinhaVotacao | null {
  mapa ??= new Map(decodificar(dados).map((l) => [`${l.casa}/${l.id}`, l]));
  return mapa.get(`${casa}/${id}`) ?? null;
}

export function parlamentarOg(casa: Casa, id: string) {
  const p = dados.parlamentares?.[`${casa}/${id}`];
  if (!p) return null;
  return {
    nome: p[0],
    partido: p[1] || null,
    uf: p[2] || null,
    nominais: p[3],
    naListaAtual: p[4] === 1,
    coletadoEm: dados.casas?.[casa]?.atualizado_em ?? null,
  };
}
