/**
 * "Resumo em 5 segundos" no topo do perfil do parlamentar: cartões do mesmo formato para todos
 * (diretriz 6), cada um com o número oficial, o período, a fonte com data de coleta e um link para a
 * seção detalhada. Sem nota, sem cor de "bom/ruim", sem comparação com outros parlamentares.
 */
import type { FonteResumo } from "@/components/decisao/tipos";
import { SeloFonte } from "@/components/decisao/Selos";

export interface CartaoResumo {
  /** Âncora da seção detalhada (sem #). */
  ancora: string | null;
  rotulo: string;
  /** Número principal; null = lacuna (mostra `lacuna`). */
  valor: string | null;
  /** Complemento curto ao lado do número (ex.: "por mês"). */
  sufixo?: string | null;
  /** Período e critério em uma linha. */
  detalhe?: string | null;
  lacuna?: string | null;
  fonte?: FonteResumo | null;
}

export function ResumoParlamentar({ cartoes, titulo }: { cartoes: CartaoResumo[]; titulo: string }) {
  return (
    <section aria-labelledby="resumo-titulo" className="scroll-mt-20">
      <h2 id="resumo-titulo" className="text-xl font-bold text-gray-900">
        {titulo}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-700">
        Números copiados das fontes oficiais. Toque em “Ver detalhes” para entender cada um.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cartoes.map((c) => (
          <li key={c.rotulo} className="bloco-atalho flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-[var(--cor-secundaria)]">{c.rotulo}</h3>
            {c.valor ? (
              <p className="text-2xl font-bold leading-tight tabular-nums text-foreground [overflow-wrap:anywhere]">
                {c.valor}
                {c.sufixo ? <span className="text-base font-normal text-[var(--cor-secundaria)]"> {c.sufixo}</span> : null}
              </p>
            ) : (
              <p className="lacuna text-sm">{c.lacuna ?? "Informação não disponível em fonte oficial"}</p>
            )}
            {c.detalhe ? <p className="text-sm text-[var(--cor-secundaria)]">{c.detalhe}</p> : null}
            <div className="mt-auto flex flex-wrap items-center gap-x-3 pt-1">
              {c.fonte ? <SeloFonte fonte={c.fonte} compacto /> : null}
              {c.ancora ? (
                <a href={`#${c.ancora}`} className="lk inline-flex min-h-11 items-center text-sm font-semibold">
                  Ver detalhes<span className="sr-only"> de {c.rotulo.toLowerCase()}</span>
                  <span aria-hidden="true">&nbsp;↓</span>
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
