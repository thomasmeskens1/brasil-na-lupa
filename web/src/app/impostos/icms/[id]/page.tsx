import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Secao } from "@/components/Secao";
import { CabecalhoDecisao } from "@/components/decisao/CabecalhoDecisao";
import { formatarData as formatarDataDecisao, resolverTitulo, tituloSimplesDe } from "@/components/decisao/rotulos";
import { metadadosCompartilhamento } from "@/components/compartilhar/metadados";
import { getDecisao, getDecisoes, getTitulos, termosDaDecisao } from "@/features/icms/dados";
import { dadoDe, dataDe, fontePrincipalDe, formaDe, legendaDoPlacar, nomeOficialCurto, quantosAtos, quemDecidiuDe } from "@/features/icms/cartao";
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
import { LigacoesIcmsSp } from "@/features/sao-paulo/componentes/LigacoesIcms";
import { nomeDoAto } from "@/features/icms/rotulos";
import type { Decisao } from "@/features/icms/tipos";

export function generateStaticParams() {
  return getDecisoes().itens.map((d) => ({ id: d.id }));
}

function titulo(d: Decisao) {
  return resolverTitulo({ tituloOficial: d.titulo, simples: tituloSimplesDe(getTitulos("icms"), d.id), subtituloOficial: nomeOficialCurto(d) });
}

export async function generateMetadata({ params }: PageProps<"/impostos/icms/[id]">): Promise<Metadata> {
  const { id } = await params;
  const d = getDecisao(id);
  if (!d) return { title: "Decisão não encontrada" };
  const t = titulo(d);
  const f = fontePrincipalDe(d);
  return metadadosCompartilhamento({
    titulo: t.titulo,
    descricao: [t.subtitulo, f?.orgao ? `Fonte: ${f.orgao}` : null, f?.acessado_em ? `coletado em ${formatarDataDecisao(f.acessado_em)}` : null],
    caminho: `/impostos/icms/${d.id}`,
  });
}

export default async function DecisaoPage({ params }: PageProps<"/impostos/icms/[id]">) {
  const { id } = await params;
  const d = getDecisao(id);
  if (!d) notFound();
  const { provisorio } = getDecisoes();
  const termos = termosDaDecisao(d);
  const relacionadas = (d.relacionados ?? []).map(getDecisao).filter((x): x is Decisao => x !== null);
  const votacoes = d.votacoes ?? [];
  const mudancas = d.mudancas ?? [];
  const legenda = legendaDoPlacar(d);
  const dado = dadoDe(d);
  const periodo = (d.datas as { periodo_publicacao?: string[] } | undefined)?.periodo_publicacao;
  const atalhos = [
    mudancas.length ? { href: "#o-que-mudou", rotulo: "O que mudou" } : null,
    votacoes.length ? { href: "#votacoes", rotulo: "Votações" } : null,
    { href: "#justificativa", rotulo: "Justificativa" },
    { href: "#fontes", rotulo: "Fontes" },
  ].filter((x): x is { href: string; rotulo: string } => !!x);

  return (
    <div className="space-y-10">
      <div className="max-w-3xl">
        <nav aria-label="Você está em" className="text-base">
          <ol className="flex flex-wrap items-center gap-x-2">
            <li>
              <Link href="/impostos" className="lk inline-flex min-h-11 items-center">
                Impostos
              </Link>
            </li>
            <li className="flex items-center gap-x-2">
              <span aria-hidden="true">›</span>
              <Link href="/impostos/icms" className="lk inline-flex min-h-11 items-center">
                ICMS
              </Link>
            </li>
          </ol>
        </nav>
        <CabecalhoDecisao
          tituloOficial={d.titulo}
          simples={tituloSimplesDe(getTitulos("icms"), d.id)}
          subtituloOficial={nomeOficialCurto(d)}
          caminho={d.caminho}
          data={dataDe(d)}
          forma={formaDe(d)}
          dado={dado}
          quemDecidiu={quemDecidiuDe(d)}
          fontePrincipal={fontePrincipalDe(d)}
          url={`/impostos/icms/${d.id}`}
          atalhos={atalhos}
          ficha={[
            { rotulo: quantosAtos(d) > 1 ? "Atos reunidos" : "Ato", valor: nomeDoAto(d) },
            { rotulo: "Órgão que decidiu", valor: d.orgao },
            { rotulo: "Data da decisão", valor: d.datas?.decisao ? formatarDataDecisao(d.datas.decisao) : null },
            { rotulo: "Publicação", valor: d.datas?.publicacao ? formatarDataDecisao(d.datas.publicacao) : null },
            { rotulo: "Passa a valer em", valor: d.datas?.vigencia ? formatarDataDecisao(d.datas.vigencia) : null },
            ...(Array.isArray(periodo) && periodo.length === 2
              ? [{ rotulo: "Período de publicação", valor: `${formatarDataDecisao(periodo[0])} a ${formatarDataDecisao(periodo[1])}` }]
              : []),
          ]}
        >
          {dado?.tipo === "placar" && legenda ? <p className="-mt-2 text-[var(--cor-secundaria)]">{legenda}</p> : null}
          {d.resumo ? <p className="leading-relaxed text-gray-800">{d.resumo}</p> : null}
        </CabecalhoDecisao>
      </div>

      {provisorio ? <AvisoProvisorio /> : null}

      {mudancas.length ? (
        <Secao id="o-que-mudou" titulo="O que mudou" descricao={<span className="text-base">Valores transcritos do documento oficial.</span>}>
          <TabelaMudancas decisao={d} />
        </Secao>
      ) : null}
      <Secao id="quem-decidiu" titulo="Quem decidiu">
        <QuemDecidiu decisao={d} />
      </Secao>
      {votacoes.length ? (
        <Secao id="votacoes" titulo="Votações">
          <Votacoes votacoes={votacoes} />
        </Secao>
      ) : null}
      {d.caminho === "alesp" || d.caminho === "governador-sp" ? <LigacoesIcmsSp decisaoId={d.id} /> : null}
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
          <Relacionadas itens={relacionadas.map((r) => ({ id: r.id, titulo: titulo(r).titulo }))} />
        </Secao>
      ) : null}
    </div>
  );
}
