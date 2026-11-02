import type { Metadata } from "next";
import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { FinancasAno } from "@/features/atibaia/componentes/Financas";
import { getIndiceAtibaia } from "@/features/atibaia/dados";
import { TERMOS_ATIBAIA } from "@/features/atibaia/termos";
import { formatarDataSp as data } from "@/features/sao-paulo/rotulos";

export const metadata: Metadata = {
  title: "Atibaia (SP)",
  description: "Leis e decretos do prefeito de Atibaia, composição da Câmara Municipal e finanças do município, com fonte oficial.",
};

export default function AtibaiaPage() {
  const ind = getIndiceAtibaia();
  const v = ind.vereadores;
  const nTipo = (t: string) => Object.entries(ind.normas.por_ano_tipo).filter(([k]) => k.endsWith(`|${t}`)).reduce((s, [, n]) => s + n, 0);
  const [atual, ...anteriores] = ind.financas;

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Atibaia (SP)</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          No município da Estância de Atibaia, as leis são votadas pela Câmara Municipal, formada por {v?.itens.length ?? "—"}{" "}
          vereadores, e sancionadas ou vetadas pelo prefeito, que também decide sozinho por decreto, sem votação. Aqui estão as
          leis e os decretos publicados na Imprensa Oficial do Município, a composição atual da Câmara e as receitas e despesas
          do município informadas ao Tribunal de Contas do Estado de São Paulo (TCE-SP).
        </p>
        <p className="meta mt-3">Dados coletados em {data(ind.atualizado_em)}.</p>
      </header>

      <Secao
        id="leis-e-decretos"
        titulo="Leis e decretos"
        descricao={`${nTipo("Lei")} leis, ${nTipo("Lei Complementar")} leis complementares e ${nTipo("Decreto")} decretos lidos na Imprensa Oficial Eletrônica do município. Nomes de cidadãos citados nos atos aparecem como “[nome de particular omitido]”, com link para o documento oficial completo.`}
      >
        <ul className="space-y-3">
          {ind.normas.recentes.map((n) => (
            <li key={n.id} className="cartao">
              <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-gray-900">{data(n.data)}</span>
                <span className="selo">{n.tipo}</span>
              </p>
              <h3 className="mt-2 text-base font-semibold text-gray-900">
                {n.tipo} nº {n.numero ?? "não informado"}
              </h3>
              <p className="mt-1 text-sm text-gray-800">{n.ementa_publica}</p>
              {n.url ? (
                <p className="mt-2">
                  <FonteLink href={n.url} tipo="pdf">
                    Imprensa Oficial nº {n.edicao ?? "?"}, de {data(n.edicao_data)}
                    {n.pagina ? `, p. ${n.pagina}` : ""}
                  </FonteLink>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-4">
          <Link href="/atibaia/leis-e-decretos" className="inline-block rounded-md bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f3347]">
            Buscar todas as leis e decretos
          </Link>
        </p>
      </Secao>

      <Secao id="camara" titulo="Câmara Municipal" descricao={v?.criterio ?? undefined}>
        <div className="aviso text-sm text-gray-900">
          <p className="font-semibold">Os votos dos vereadores ainda não são publicados em formato aberto.</p>
          <p className="mt-1">
            A Câmara Municipal registra as votações em atas e vídeos das sessões, sem uma lista estruturada do voto de cada
            vereador. Por isso, este site ainda não mostra votos individuais. Em 02/11/2026 foi feito um pedido à Câmara pela
            Lei de Acesso à Informação, solicitando esses registros em formato aberto.
          </p>
        </div>
        {v ? (
          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Vereadores, em ordem alfabética</h3>
              <ul className="mt-2 divide-y divide-borda rounded border border-borda">
                {v.itens.map((x) => (
                  <li key={x.id} className="flex flex-wrap justify-between gap-x-3 px-3 py-2 text-sm">
                    <span className="font-medium text-gray-900">{x.nome}</span>
                    <span className="text-gray-800">{x.partido ?? "Partido não informado"}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Mesa Diretora</h3>
              <p className="meta mt-1">Vereadores que dirigem os trabalhos da Câmara, como registrado na ata.</p>
              <dl className="mt-2 divide-y divide-borda rounded border border-borda">
                {v.mesa.map((m) => (
                  <div key={m.cargo} className="flex flex-wrap justify-between gap-x-3 px-3 py-2 text-sm">
                    <dt className="text-gray-800">{m.cargo[0] + m.cargo.slice(1).toLowerCase()}</dt>
                    <dd className="font-medium text-gray-900">{m.nome}</dd>
                  </div>
                ))}
              </dl>
              {v.sessao ? (
                <p className="mt-3 text-sm text-gray-800">
                  Lista lida da ata da {v.sessao.descricao} de {data(v.sessao.data)}
                  {v.sessao.ausentes_registrados ? `; vereadores ausentes registrados na ata: ${v.sessao.ausentes_registrados}` : ""}.
                  {v.conferencia?.mesma_lista ? ` A lista é a mesma da ata da ${v.conferencia.ata_anterior}.` : ""}
                </p>
              ) : null}
              {v.fonte ? (
                <p className="mt-2">
                  <FonteLink href={v.fonte.url} tipo="pdf">
                    {v.fonte.titulo}
                  </FonteLink>
                  <span className="meta block">Coletado em {data(v.fonte.acessado_em)}</span>
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="lacuna mt-4 text-sm">Composição da Câmara não disponível nos dados coletados.</p>
        )}
        {v?.lacunas.length ? (
          <ul className="mt-4 space-y-2">
            {v.lacunas.map((l) => (
              <li key={l} className="lacuna text-sm">
                {l}
              </li>
            ))}
          </ul>
        ) : null}
      </Secao>

      <Secao
        id="financas"
        titulo="Finanças do município"
        descricao="Receitas arrecadadas e despesas por fase (empenho, liquidação e pagamento), mês a mês, somadas dos registros que o município informa ao TCE-SP. A fonte não traz a classificação da despesa por área de governo (saúde, educação etc.) nem por categoria econômica."
      >
        <div className="aviso mb-4 text-sm text-gray-900">
          <p className="font-semibold">Por que os meses mais recentes ainda não aparecem</p>
          <p className="mt-1">
            O município envia os dados de cada mês ao TCE-SP depois que o mês termina, e o tribunal os publica no Portal da
            Transparência Municipal com um atraso que, nestes dados, é de cerca de dois meses. Os meses sem dados aparecem como
            “sem dados no TCE-SP” e serão preenchidos pela coleta diária quando forem publicados.
          </p>
        </div>
        {atual ? (
          <>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Exercício de {atual.ano}</h3>
            <FinancasAno a={atual} />
            {anteriores.map((a) => (
              <details key={a.ano} className="cartao mt-6">
                <summary>Exercício de {a.ano}</summary>
                <div className="mt-3">
                  <FinancasAno a={a} />
                </div>
              </details>
            ))}
            {atual.fonte ? (
              <p className="mt-4">
                <FonteLink href={atual.fonte.url} tipo="oficial">
                  {atual.fonte.titulo}
                </FonteLink>
                <span className="meta block">
                  {atual.fonte.orgao} · coletado em {data(atual.fonte.acessado_em)}
                </span>
              </p>
            ) : null}
          </>
        ) : (
          <p className="lacuna text-sm">Dados de finanças não disponíveis nos dados coletados.</p>
        )}
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={TERMOS_ATIBAIA} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={ind.fontes} />
      </Secao>
    </div>
  );
}
