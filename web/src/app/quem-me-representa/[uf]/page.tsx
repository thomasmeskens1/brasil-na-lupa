import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Secao } from "@/components/Secao";
import { AvisoEleito, FontesEleitos, Presidencia } from "@/features/representantes/Blocos";
import { BuscaLocal } from "@/features/representantes/BuscaLocal";
import { UFS } from "@/features/representantes/cargos";
import { getMetaEleitos, getUf } from "@/features/representantes/dados";
import { GrupoCargo, agrupar } from "@/features/representantes/Eleitos";
import { NaSuaCidade } from "@/features/representantes/NaSuaCidade";

export function generateStaticParams() {
  return UFS.map((u) => ({ uf: u.sigla.toLowerCase() }));
}

export async function generateMetadata({ params }: PageProps<"/quem-me-representa/[uf]">): Promise<Metadata> {
  const { uf } = await params;
  const u = UFS.find((x) => x.sigla.toLowerCase() === uf);
  if (!u) return { title: "Estado não encontrado" };
  return {
    title: `Quem me representa: ${u.nome}`,
    description: `Eleitos segundo o TSE em ${u.nome}: prefeitos e vereadores de cada município, governador, deputados estaduais, senadores e deputados federais.`,
  };
}

const ESTADO = ["Governador", "Vice-governador", "Deputado estadual", "Deputado distrital"];
const BRASILIA = ["Senador", "Deputado federal"];
const CARGOS_2026 = ["Governador", "Vice-governador", "Senador", "Deputado federal", "Deputado estadual", "Deputado distrital"];

export default async function UfPage({ params }: PageProps<"/quem-me-representa/[uf]">) {
  const { uf } = await params;
  const d = getUf(uf);
  if (!d) notFound();
  const meta = getMetaEleitos();
  const estado = agrupar(d.itens, ESTADO);
  const brasilia = agrupar(d.itens, BRASILIA);
  const novos = d.eleitos_2026 ? agrupar(d.eleitos_2026.itens, CARGOS_2026) : [];
  const deDf = uf === "df";

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="meta">
          <Link href="/quem-me-representa" className="lk inline-flex min-h-11 items-center">
            Quem me representa
          </Link>
        </p>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Quem me representa: {d.nome_uf}</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          Quem foi eleito para representar {deDf ? "o Distrito Federal" : `${d.nome_uf} e seus municípios`}, em camadas: na sua
          cidade, no seu estado e em Brasília. Dentro de cada cargo, os nomes estão em ordem alfabética.
        </p>
        <div className="mt-4">
          <AvisoEleito uf={uf} />
        </div>
      </header>

      {!deDf ? (
        <section aria-labelledby="escolha" className="max-w-xl">
          <h2 id="escolha" className="sr-only">
            Escolha a cidade
          </h2>
          <BuscaLocal rotulo={`Sua cidade em ${d.nome_uf} (ou outro estado)`} />
        </section>
      ) : null}

      <Secao id="na-sua-cidade" titulo="Na sua cidade" descricao="Prefeito, vice-prefeito e vereadores eleitos em 2024.">
        <Suspense fallback={<p>Carregando…</p>}>
          <NaSuaCidade uf={uf} nomeUf={d.nome_uf} />
        </Suspense>
      </Secao>

      <Secao id="no-seu-estado" titulo="No seu estado" descricao="Eleitos em 2022.">
        <div className="grid grid-cols-1 gap-4">
          {estado.map(([c, l]) => (
            <GrupoCargo key={c} cargo={c} pessoas={l} />
          ))}
        </div>
      </Secao>

      <Secao
        id="em-brasilia"
        titulo="Em Brasília"
        descricao="Os três senadores do estado (eleitos em 2018 e em 2022) e os deputados federais eleitos em 2022."
      >
        <div className="grid grid-cols-1 gap-4">
          {brasilia.map(([c, l]) => (
            <GrupoCargo key={c} cargo={c} pessoas={l} />
          ))}
          <Presidencia />
        </div>
      </Secao>

      {d.eleitos_2026 ? (
        <Secao
          id="eleitos-2026"
          titulo="Eleitos em 2026 (aguardando posse)"
          descricao={
            <>
              Resultado registrado pelo TSE para a eleição de 2026. Ainda não estão no cargo: aguardando posse em 2027. A
              diplomação e decisões da Justiça Eleitoral ainda podem alterar a lista.
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4">
            {novos.map(([c, l]) => (
              <GrupoCargo key={c} cargo={c} pessoas={l} aguardandoPosse />
            ))}
          </div>
        </Secao>
      ) : null}

      <Secao id="fontes" titulo="Fontes e limites">
        <FontesEleitos
          fontes={[...d.fontes, ...(d.eleitos_2026?.fontes ?? [])].filter((f, i, a) => a.findIndex((x) => x.url === f.url && x.titulo === f.titulo) === i)}
          lacunas={meta?.lacunas ?? []}
          glossario={meta?.glossario ?? {}}
        />
      </Secao>
    </div>
  );
}
