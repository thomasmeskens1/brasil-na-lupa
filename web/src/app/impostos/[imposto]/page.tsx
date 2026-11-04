import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { definicaoDe } from "@/components/glossario";
import { metadadosCompartilhamento } from "@/components/compartilhar/metadados";
import { TabelaResponsiva } from "@/components/tabela";
import { FigurinhaImposto } from "@/features/impostos/FigurinhaImposto";
import { IMPOSTOS, ROTULO_BASE, esferasPorExtenso, impostoPorSlug } from "@/features/impostos/dados";
import { DATA_CONSULTA, dataCurta } from "@/features/impostos/fontes";
import { TERMOS_IMPOSTOS } from "@/features/impostos/termos";
import { Justificativas } from "@/features/impostos/componentes/Justificativas";
import { LinkFonte, ListaFontesImposto } from "@/features/impostos/componentes/LinkFonte";
import { ListaDecisoes } from "@/features/impostos/componentes/ListaDecisoes";

/** Uma página por imposto, gerada no build. Outros endereços dão "não encontrado". */
export function generateStaticParams() {
  return IMPOSTOS.map((i) => ({ imposto: i.slug }));
}

export async function generateMetadata({ params }: PageProps<"/impostos/[imposto]">): Promise<Metadata> {
  const i = impostoPorSlug((await params).imposto);
  if (!i) return {};
  return metadadosCompartilhamento({
    titulo: `${i.sigla}: como funciona hoje e o que muda`,
    descricao: [i.resumo, `Fontes oficiais consultadas em ${dataCurta(DATA_CONSULTA)}`],
    caminho: `/impostos/${i.slug}`,
  });
}

export default async function ImpostoPage({ params }: PageProps<"/impostos/[imposto]">) {
  const i = impostoPorSlug((await params).imposto);
  if (!i) notFound();

  const ficha = [
    { rotulo: "Quem cobra", texto: i.quemCobra },
    { rotulo: "Sobre o quê", texto: i.sobreOQue },
    { rotulo: "Quem decide a alíquota e como", texto: i.quemDecide },
    { rotulo: "No dia a dia", texto: i.exemplo },
  ];
  const termos = i.termos
    .map((t) => definicaoDe(t, TERMOS_IMPOSTOS))
    .filter((e): e is NonNullable<typeof e> => e !== null);
  const fontes = [...i.fontes, ...i.mudancas.map((m) => m.fonte), ...(i.tabela ? [i.tabela.fonte] : [])];
  const indice = IMPOSTOS.findIndex((x) => x.slug === i.slug);
  const anterior = IMPOSTOS[indice - 1];
  const proximo = IMPOSTOS[indice + 1];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="text-base">
          <Link href="/impostos" className="lk inline-flex min-h-11 items-center">
            Impostos
          </Link>
        </nav>
        <FigurinhaImposto nome={i.figura} className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{i.sigla}</h1>
        {i.sigla !== i.nome ? <p className="mt-1 text-lg text-[var(--cor-secundaria)]">{i.nome}</p> : null}
        <p className="mt-3 leading-relaxed text-gray-800">{i.resumo}</p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Classificação">
          <li className="selo">Quem cobra: {esferasPorExtenso(i.esferas)}</li>
          <li className="selo">Tributa: {ROTULO_BASE[i.base]}</li>
          <li className="selo">Na reforma: {i.situacao}</li>
        </ul>
        <p className="meta mt-3">Fontes oficiais consultadas em {dataCurta(DATA_CONSULTA)}.</p>
      </header>

      <section aria-labelledby="ficha-titulo" className="space-y-4">
        <h2 id="ficha-titulo" className="text-xl font-bold text-gray-900">
          Como funciona
        </h2>
        <dl className="entrada grid gap-3 md:grid-cols-2">
          {ficha.map((f) => (
            <div key={f.rotulo} className="cartao">
              <dt className="text-sm font-semibold uppercase tracking-wide text-[var(--cor-acento)]">{f.rotulo}</dt>
              <dd className="mt-1 leading-relaxed text-gray-800">{f.texto}</dd>
            </div>
          ))}
        </dl>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          {i.fontes.map((c) => (
            <LinkFonte key={c} chave={c} curto />
          ))}
        </p>
      </section>

      {i.tabela ? (
        <section aria-labelledby="tabela-titulo" className="space-y-3">
          <h2 id="tabela-titulo" className="text-xl font-bold text-gray-900">
            {i.tabela.legenda}
          </h2>
          <TabelaResponsiva
            legenda={i.tabela.legenda}
            legendaOculta
            linhas={i.tabela.linhas}
            chaveLinha={(l) => l[0]}
            colunas={i.tabela.colunas.map((c, k) => ({
              chave: c,
              rotulo: c,
              principal: k === 0,
              numerica: k > 0,
              celula: (l: string[]) => l[k],
            }))}
          />
          {i.tabela.nota ? <p className="max-w-3xl text-sm text-gray-800">{i.tabela.nota}</p> : null}
          <LinkFonte chave={i.tabela.fonte} />
        </section>
      ) : null}

      <section aria-labelledby="comparacao-titulo" className="space-y-4">
        <h2 id="comparacao-titulo" className="text-xl font-bold text-gray-900">
          Hoje e a partir de 2027
        </h2>
        <dl className="grid gap-3 md:grid-cols-2">
          <div className="cartao">
            <dt className="font-semibold text-gray-900">Hoje (2026)</dt>
            <dd className="mt-1 leading-relaxed text-gray-800">{i.hoje}</dd>
          </div>
          <div className="cartao border-[var(--cor-acento)]">
            <dt className="font-semibold text-gray-900">A partir de 2027</dt>
            <dd className="mt-1 leading-relaxed text-gray-800">{i.depois2027}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="mudancas-titulo" className="space-y-4">
        <h2 id="mudancas-titulo" className="text-xl font-bold text-gray-900">
          O que muda e quando
        </h2>
        <ol className="relative ml-3 space-y-5 border-l-2 border-[var(--cor-borda-forte)] pl-6">
          {i.mudancas.map((m) => (
            <li key={`${m.quando}-${m.oque}`} className="revelar relative">
              <span
                aria-hidden="true"
                className="absolute -left-[2.0625rem] top-1 block h-4 w-4 rounded-full border-2 border-[var(--cor-acento)] bg-superficie"
              />
              <p className="font-bold text-gray-900">{m.quando}</p>
              <p className="leading-relaxed text-gray-800">{m.oque}</p>
              <LinkFonte chave={m.fonte} curto />
            </li>
          ))}
        </ol>
      </section>

      {i.paginaDecisoes || i.decisoes?.length ? (
        <section aria-labelledby="decisoes-titulo" className="space-y-4">
          <h2 id="decisoes-titulo" className="text-xl font-bold text-gray-900">
            Decisões já registradas no site
          </h2>
          <ListaDecisoes itens={[...(i.paginaDecisoes ? [i.paginaDecisoes] : []), ...(i.decisoes ?? [])]} />
        </section>
      ) : null}

      {i.reforma ? (
        <section aria-labelledby="justificativas-titulo" className="space-y-4">
          <h2 id="justificativas-titulo" className="text-xl font-bold text-gray-900">
            Justificativas oficiais da reforma
          </h2>
          <Justificativas />
        </section>
      ) : null}

      {termos.length ? (
        <section aria-labelledby="termos-titulo" className="space-y-4">
          <h2 id="termos-titulo" className="text-xl font-bold text-gray-900">
            Termos desta página
          </h2>
          <dl className="grid gap-3 md:grid-cols-2">
            {termos.map((t) => (
              <div key={t.termo} className="cartao">
                <dt className="font-semibold text-gray-900">{t.termo}</dt>
                <dd className="mt-1 text-gray-800">{t.explicacao}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="fontes-titulo" className="space-y-4">
        <h2 id="fontes-titulo" className="text-xl font-bold text-gray-900">
          Fontes
        </h2>
        <ListaFontesImposto chaves={fontes} />
      </section>

      <nav aria-label="Outros impostos" className="flex flex-wrap justify-between gap-3 border-t border-borda pt-6">
        {anterior ? (
          <Link href={`/impostos/${anterior.slug}`} className="botao">
            <span aria-hidden="true">←</span> {anterior.sigla}
          </Link>
        ) : (
          <span />
        )}
        <Link href="/impostos" className="botao">
          Todos os impostos
        </Link>
        {proximo ? (
          <Link href={`/impostos/${proximo.slug}`} className="botao">
            {proximo.sigla} <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
