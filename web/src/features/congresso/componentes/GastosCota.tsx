import { FonteLink } from "@/components/FonteLink";
import { lacunasLegiveis } from "@/features/comum/texto";
import type { CotaAno, FontePaginaCota } from "../dados-camara";
import { formatarData } from "../rotulos";
import { ListaFontes } from "./Basicos";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const real = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Não informado";

function TotalCaixa({ rotulo, valor, destaque = false }: { rotulo: string; valor: number | null | undefined; destaque?: boolean }) {
  return (
    <div className={`rounded border px-3 py-2 ${destaque ? "border-acento bg-acento-fundo" : "border-borda bg-superficie"}`}>
      <dt className="meta">{rotulo}</dt>
      <dd className={`font-bold text-gray-900 ${destaque ? "text-2xl" : "text-lg"}`}>{real(valor)}</dd>
    </div>
  );
}

function Ano({ c, pagina, id }: { c: CotaAno; pagina: FontePaginaCota | null; id: string }) {
  const oficial = c.pagina_oficial?.total ?? c.total_pagina_oficial;
  const diferenca = c.pagina_oficial?.diferenca_para_arquivo ?? null;
  const porTipoArquivo = new Map((c.por_tipo ?? []).map((t) => [t.tipo, t]));
  const tipos = [...(c.pagina_oficial?.por_tipo ?? [])].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  const meses = [...(c.por_mes ?? [])].sort((a, b) => a.mes - b.mes);
  // A fonte grava o endereço da página oficial com o marcador {id}; aqui vai o id deste deputado.
  const fontes = [
    ...(c.fonte ? [c.fonte] : []),
    ...(pagina?.fonte?.url ? [{ ...pagina.fonte, url: pagina.fonte.url.replace("{id}", encodeURIComponent(id)) }] : []),
  ];

  return (
    <section aria-labelledby={`cota-${c.ano}`} className="space-y-4">
      <h3 id={`cota-${c.ano}`} className="text-lg font-semibold text-gray-900">
        <span className="sr-only">Gastos da cota em </span>
        {c.ano}
      </h3>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TotalCaixa rotulo={`Total no ano segundo a página oficial da Câmara (consultada em ${formatarData(pagina?.consultado_em)})`} valor={oficial ?? c.total_liquido} destaque />
        <TotalCaixa rotulo={`Soma dos documentos no arquivo de dados abertos (${c.documentos_qtd ?? "–"} lançamentos)`} valor={c.total_liquido} />
      </dl>
      {oficial == null ? (
        <p className="lacuna text-sm">Total da página oficial não disponível; o valor em destaque é a soma do arquivo de dados abertos.</p>
      ) : diferenca ? (
        <p className="aviso text-sm text-gray-900">
          Os dois totais são diferentes (diferença de {real(diferenca)}). Desde agosto de 2025, o arquivo de dados abertos da
          cota não traz os lançamentos do tipo &quot;PASSAGEM AÉREA - SIGEPA&quot;, como a Câmara os nomeia, que aparecem na
          página oficial; os tipos com diferença estão na tabela e na observação abaixo. Por isso, o total em destaque é o da
          página oficial, e os valores por mês, que vêm do arquivo, não incluem os lançamentos que faltam nele.
        </p>
      ) : (
        <p className="text-sm text-gray-800">O total da página oficial e a soma do arquivo de dados abertos coincidem.</p>
      )}

      <div>
        <h4 className="text-sm font-semibold text-gray-900">Por tipo de despesa</h4>
        {tipos.length ? (
          <div className="mt-2 overflow-x-auto rounded border border-borda" role="region" tabIndex={0} aria-label={`Gastos por tipo em ${c.ano}`}>
            <table className="tabela">
              <caption className="sr-only">Gastos da cota por tipo de despesa em {c.ano}</caption>
              <thead>
                <tr>
                  <th scope="col">Tipo (como na fonte)</th>
                  <th scope="col" className="text-right">
                    Página oficial
                  </th>
                  <th scope="col" className="text-right">
                    Arquivo de dados abertos
                  </th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((t) => {
                  const a = porTipoArquivo.get(t.tipo);
                  return (
                    <tr key={t.tipo}>
                      <td className="[overflow-wrap:anywhere]">{t.tipo}</td>
                      <td className="whitespace-nowrap text-right">{real(t.total)}</td>
                      <td className="whitespace-nowrap text-right">{a ? real(a.total_liquido) : "Não consta"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="lacuna mt-2 text-sm">Gastos por tipo não disponíveis em fonte oficial.</p>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-900">Por mês (arquivo de dados abertos)</h4>
        <p className="meta mt-1">Mês de competência informado pela fonte, que pode ser diferente do mês de emissão do documento.</p>
        {meses.length ? (
          <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {meses.map((m) => (
              <div key={m.mes} className="rounded border border-borda bg-superficie px-3 py-2">
                <dt className="meta capitalize">{MESES[m.mes - 1] ?? `Mês ${m.mes}`}</dt>
                <dd className="text-sm font-semibold text-gray-900">{real(m.total_liquido)}</dd>
                {m.documentos != null ? <dd className="meta">{m.documentos} lançamentos</dd> : null}
              </div>
            ))}
          </dl>
        ) : (
          <p className="lacuna mt-2 text-sm">Nenhum lançamento mensal no arquivo de dados abertos.</p>
        )}
      </div>

      {lacunasLegiveis(c.lacunas).map((l) => (
        <p key={l} className="lacuna text-sm">
          {l}
        </p>
      ))}

      <p className="flex flex-wrap gap-x-4 gap-y-1">
        {c.url_documentos ? (
          <FonteLink href={c.url_documentos} tipo="oficial">
            Notas e documentos de {c.ano} na página oficial da Câmara
          </FonteLink>
        ) : (
          <span className="lacuna text-sm">Link para os documentos não disponível.</span>
        )}
      </p>
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Fontes</h4>
        <div className="mt-2">
          <ListaFontes fontes={fontes} />
        </div>
      </div>
    </section>
  );
}

/** Gastos da Cota para o Exercício da Atividade Parlamentar (CEAP), por ano. */
export function GastosCota({ id, anos }: { id: string; anos: { cota: CotaAno; pagina: FontePaginaCota | null }[] }) {
  if (!anos.length) return <p className="lacuna text-sm">Gastos da cota não disponíveis nos dados coletados para este deputado.</p>;
  return (
    <div className="space-y-8">
      {anos.map(({ cota, pagina }) => (
        <Ano key={cota.ano} c={cota} pagina={pagina} id={id} />
      ))}
    </div>
  );
}
