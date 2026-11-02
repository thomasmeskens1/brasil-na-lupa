import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Secao } from "@/components/Secao";
import { getDecisao, getDecisoes, termosDaDecisao } from "@/features/icms/dados";
import {
  AvisoProvisorio,
  Fontes,
  Justificativas,
  Lacunas,
  QuemDecidiu,
  Relacionadas,
  TabelaMudancas,
  TermosExplicados,
} from "@/features/icms/componentes/DetalheDecisao";
import { Votacoes } from "@/features/icms/componentes/Votacoes";
import { CAMINHO_CURTO, formatarData, nomeDoAto } from "@/features/icms/rotulos";
import type { Decisao } from "@/features/icms/tipos";

export function generateStaticParams() {
  return getDecisoes().itens.map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: PageProps<"/impostos/icms/[id]">): Promise<Metadata> {
  const { id } = await params;
  const d = getDecisao(id);
  return d ? { title: d.titulo, description: d.resumo ?? undefined } : { title: "Decisão não encontrada" };
}

export default async function DecisaoPage({ params }: PageProps<"/impostos/icms/[id]">) {
  const { id } = await params;
  const d = getDecisao(id);
  if (!d) notFound();
  const { provisorio } = getDecisoes();
  const termos = termosDaDecisao(d);
  const relacionadas = (d.relacionados ?? []).map(getDecisao).filter((x): x is Decisao => x !== null);
  const datas = [
    ["Data da decisão", d.datas?.decisao],
    ["Publicação", d.datas?.publicacao],
    ["Passa a valer em", d.datas?.vigencia],
  ] as const;

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/impostos" className="lk">
            Impostos
          </Link>
          {" › "}
          <Link href="/impostos/icms" className="lk">
            ICMS
          </Link>
        </nav>
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <span className="selo selo-escuro">{CAMINHO_CURTO[d.caminho]}</span>
          <span className="text-sm font-medium text-gray-900">{nomeDoAto(d)}</span>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">{d.titulo}</h1>
        {d.resumo ? <p className="mt-3 leading-relaxed text-gray-800">{d.resumo}</p> : null}
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          {datas.map(([rotulo, valor]) => (
            <div key={rotulo} className="rounded border border-borda bg-superficie px-3 py-2">
              <dt className="meta">{rotulo}</dt>
              <dd className="font-semibold text-gray-900">{formatarData(valor)}</dd>
            </div>
          ))}
        </dl>
      </header>

      {provisorio ? <AvisoProvisorio /> : null}

      <Secao id="o-que-mudou" titulo="O que mudou" descricao="Valores transcritos do documento oficial.">
        <TabelaMudancas decisao={d} />
      </Secao>
      <Secao id="quem-decidiu" titulo="Quem decidiu">
        <QuemDecidiu decisao={d} />
      </Secao>
      <Secao id="votacoes" titulo="Votações">
        <Votacoes votacoes={d.votacoes ?? []} />
      </Secao>
      <Secao id="justificativa" titulo="Justificativa oficial">
        <Justificativas decisao={d} />
      </Secao>
      {termos.length ? (
        <Secao id="termos" titulo="Termos explicados">
          <TermosExplicados termos={termos} />
        </Secao>
      ) : null}
      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        <Lacunas lacunas={d.lacunas ?? []} />
      </Secao>
      <Secao id="fontes" titulo="Fontes">
        <Fontes fontes={d.fontes ?? []} />
      </Secao>
      {relacionadas.length ? (
        <Secao id="relacionadas" titulo="Decisões relacionadas">
          <Relacionadas itens={relacionadas} />
        </Secao>
      ) : null}
    </div>
  );
}
