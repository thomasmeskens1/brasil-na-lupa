import Link from "next/link";
import { Secao } from "@/components/Secao";
import { getIndiceStf, getTemaStf, temasPorColecaoStj } from "../dados";
import { COLECOES } from "../rotulos";
import type { TemaStf } from "../tipos";
import { CartaoTema } from "./CartaoTema";
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
            {COLECOES[colecao] ? <p className="mt-1 max-w-3xl text-sm text-gray-800">{COLECOES[colecao].explicacao}</p> : null}
            <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              {temas.map((t) => (
                <li key={t.numero}>
                  <CartaoTema
                    href={`/justica/stj/temas/${t.numero}`}
                    tribunal="STJ"
                    rotulo={`${t.tipo_precedente ?? "Tema"} ${t.numero}`}
                    situacao={t.situacao}
                    orgao={t.orgao}
                    questao={t.questao}
                    tese={t.tese}
                    nivel={4}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {stf.length ? (
          <section aria-labelledby="justica-stf">
            <h3 id="justica-stf" className="text-lg font-semibold text-gray-900">
              STF — temas de repercussão geral
            </h3>
            <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              {stf.map((t) => (
                <li key={String(t.numero)}>
                  <CartaoTema
                    href={`/justica/stf/temas/${t.numero}`}
                    tribunal="STF"
                    rotulo={`Tema ${t.numero} de repercussão geral`}
                    situacao={t.situacao?.andamento ?? t.situacao?.repercussao_geral ?? null}
                    questao={t.descricao ?? t.titulo ?? null}
                    tese={t.tese ?? null}
                    nivel={4}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {julgStf.length ? (
          <section aria-labelledby="justica-stf-julg">
            <h3 id="justica-stf-julg" className="text-lg font-semibold text-gray-900">
              STF — julgamentos sobre o ICMS
            </h3>
            <p className="mt-1 max-w-3xl text-sm text-gray-800">
              Julgamentos do STF reunidos na coleção do ICMS acompanhada pelo site, com o resultado escrito na certidão de julgamento.
            </p>
            <div className="mt-3">
              <ListaJulgamentosStf itens={julgStf} nivel={4} />
            </div>
          </section>
        ) : null}
        {!stf.length && !julgStf.length ? <p className="meta">Os julgamentos do STF sobre o ICMS ainda estão sendo coletados.</p> : null}
        <p className="text-sm">
          <Link href="/justica" className="lk">
            Ver a seção Justiça
          </Link>
        </p>
      </div>
    </Secao>
  );
}
