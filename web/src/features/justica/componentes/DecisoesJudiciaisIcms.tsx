import Link from "next/link";
import { CartaoDecisao } from "@/components/decisao";
import { Secao } from "@/components/Secao";
import { cartaoTemaStf, cartaoTemaStj } from "../cartoes";
import { getIndiceStf, getTemaStf, temasPorColecaoStj } from "../dados";
import { COLECOES } from "../rotulos";
import type { TemaStf } from "../tipos";
import { ListaJulgamentosStf } from "./ListaJulgamentosStf";

/** Seção "O que a Justiça decidiu sobre o ICMS": temas das coleções do ICMS no STJ e, se houver, no STF. */
export function DecisoesJudiciaisIcms() {
  const stj = temasPorColecaoStj().filter((c) => c.temas.length);
  const stf = getIndiceStf()
    .com_pagina.map(getTemaStf)
    .filter((t): t is TemaStf => !!t && (t.colecoes ?? []).some((c) => c.startsWith("icms")));
  const julgStf = getIndiceStf().julgamentos.filter((j) => (j.colecoes ?? []).some((c) => c.startsWith("icms")));
  if (!stj.length && !stf.length && !julgStf.length) return null;
  return (
    <Secao
      id="justica"
      titulo="O que a Justiça decidiu sobre o ICMS"
      descricao="Teses do Superior Tribunal de Justiça (STJ) e do Supremo Tribunal Federal (STF) em julgamentos que valem para casos iguais. Cada tema leva à página com a questão, a tese e o resultado de cada julgamento."
    >
      <div className="space-y-6">
        {stj.map(({ colecao, temas }) => (
          <section key={colecao} aria-labelledby={`justica-${colecao}`}>
            <h3 id={`justica-${colecao}`} className="text-lg font-semibold text-gray-900">
              STJ — {COLECOES[colecao]?.titulo ?? colecao}
            </h3>
            {COLECOES[colecao] ? <p className="mt-1 max-w-3xl text-gray-800">{COLECOES[colecao].explicacao}</p> : null}
            <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {temas.map((t) => (
                <CartaoDecisao key={t.numero} as="li" nivelTitulo={4} {...cartaoTemaStj(t)} />
              ))}
            </ul>
          </section>
        ))}
        {stf.length ? (
          <section aria-labelledby="justica-stf">
            <h3 id="justica-stf" className="text-lg font-semibold text-gray-900">
              STF — temas de repercussão geral
            </h3>
            <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {stf.map((t) => (
                <CartaoDecisao key={String(t.numero)} as="li" nivelTitulo={4} {...cartaoTemaStf(t)} />
              ))}
            </ul>
          </section>
        ) : null}
        {julgStf.length ? (
          <section aria-labelledby="justica-stf-julg">
            <h3 id="justica-stf-julg" className="text-lg font-semibold text-gray-900">
              STF — julgamentos sobre o ICMS
            </h3>
            <p className="mt-1 max-w-3xl text-gray-800">
              Julgamentos do STF reunidos na coleção do ICMS acompanhada pelo site, com o resultado escrito na certidão de julgamento.
            </p>
            <div className="mt-3">
              <ListaJulgamentosStf itens={julgStf} nivel={4} />
            </div>
          </section>
        ) : null}
        {!stf.length && !julgStf.length ? <p className="meta">Os julgamentos do STF sobre o ICMS ainda estão sendo coletados.</p> : null}
        <p>
          <Link href="/justica" className="lk inline-flex min-h-11 items-center">
            Ver a seção Justiça
          </Link>
        </p>
      </div>
    </Secao>
  );
}
