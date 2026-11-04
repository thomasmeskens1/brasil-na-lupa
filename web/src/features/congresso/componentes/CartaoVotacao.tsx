/**
 * Cartão de uma votação do Plenário (o Cartão de Decisão comum do site), usado na lista e no
 * bloco "O que foi votado". Funciona no servidor e no navegador. O placar visual (barra) vem
 * sempre com o texto equivalente ("Sim: 397, Não: 3"), e só aparece em votação nominal ou nos
 * totais oficiais da votação secreta (diretriz 5).
 */
import { CartaoDecisao } from "@/components/decisao/CartaoDecisao";
import type { Casa } from "../tipos";
import { CASA_NOME, rotaVotacao } from "../rotulos";
import { dadoDaVotacao, explicacaoQuorum, formaDe, propPorExtenso, tituloOficialVotacao, type LinhaVotacao } from "../lista";

const MEMBROS: Record<Casa, string> = { camara: "Deputados federais", senado: "Senadores" };

export interface CartaoVotacaoProps {
  l: LinhaVotacao;
  as?: "li" | "div" | "article";
  nivelTitulo?: 2 | 3 | 4;
  /** Mostra a data no selo (fora da lista agrupada por dia). */
  mostrarData?: boolean;
}

export function CartaoVotacao({ l, as = "li", nivelTitulo = 3, mostrarData = false }: CartaoVotacaoProps) {
  const q = explicacaoQuorum(l);
  return (
    <CartaoDecisao
      as={as}
      href={rotaVotacao(l.casa, l.id)}
      tituloOficial={tituloOficialVotacao(l)}
      simples={l.simples}
      subtituloOficial={propPorExtenso(l.proposicao)}
      caminho={l.casa}
      rotuloCaminho={l.casa === "camara" ? "Câmara" : "Senado"}
      data={mostrarData ? l.data : undefined}
      forma={formaDe(l.tipo)}
      dado={dadoDaVotacao(l)}
      quemDecidiu={MEMBROS[l.casa]}
      fonte={l.fonteUrl ? { url: l.fonteUrl, orgao: CASA_NOME[l.casa], acessado_em: l.coletadoEm } : null}
      tema={l.tema}
      nivelTitulo={nivelTitulo}
    >
      {q ? (
        <p className="text-sm">
          <span className="font-semibold">Por que não foi aprovada:</span> {q.texto}
        </p>
      ) : null}
    </CartaoDecisao>
  );
}
