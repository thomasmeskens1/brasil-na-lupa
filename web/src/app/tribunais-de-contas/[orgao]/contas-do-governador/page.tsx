import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Secao } from "@/components/Secao";
import { textoLegivel } from "@/features/comum/texto";
import { Fontes, Termos, Trilha } from "@/features/tribunais-contas/componentes/Basicos";
import { ExercicioGovernadorItem, tituloGovernador } from "@/features/tribunais-contas/componentes/Exercicios";
import { getContasGovernador, getMetaTce, getOrgao, getOrgaos, ouMarcador, temContasGovernador } from "@/features/tribunais-contas/dados";
import { BASE_TC, TERMOS_TC, formatarDataTc } from "@/features/tribunais-contas/rotulos";

export function generateStaticParams() {
  return ouMarcador(
    getOrgaos()
      .itens.filter((o) => o.situacao_coleta === "ativa" && temContasGovernador(o.id))
      .map((o) => ({ orgao: o.id })),
    { orgao: "sem-dados" },
  );
}

export async function generateMetadata({ params }: PageProps<"/tribunais-de-contas/[orgao]/contas-do-governador">): Promise<Metadata> {
  const { orgao } = await params;
  const o = getOrgao(orgao);
  if (!o || !temContasGovernador(orgao)) return { title: "Página não encontrada" };
  return {
    title: `Contas do Governador${o.uf ? ` de ${o.uf}` : ""}`,
    description: `Parecer prévio do ${o.nome} sobre as contas do Governador, com ressalvas, determinações, relator e o julgamento pela Assembleia Legislativa.`,
  };
}

export default async function ContasGovernadorPage({ params }: PageProps<"/tribunais-de-contas/[orgao]/contas-do-governador">) {
  const { orgao } = await params;
  const o = getOrgao(orgao);
  const lista = o ? getContasGovernador(orgao) : [];
  if (!o || !lista.length) notFound();
  const meta = getMetaTce(orgao);
  const sp = o.uf === "SP";
  const termos = [
    TERMOS_TC.parecerPrevio,
    TERMOS_TC.julgamentoPolitico,
    TERMOS_TC.ressalva,
    TERMOS_TC.determinacao,
    TERMOS_TC.tribunalPleno,
    TERMOS_TC.relator,
    TERMOS_TC.conselheiroSubstituto,
    TERMOS_TC.quorum,
    TERMOS_TC.ministerioPublicoContas,
    TERMOS_TC.pdl,
  ];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Trilha itens={[{ href: `${BASE_TC}/${o.id}`, rotulo: o.id.toUpperCase() }]} />
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Contas do Governador{o.uf ? ` de ${o.uf}` : ""}</h1>
        <p className="mt-3 text-base leading-relaxed text-gray-800">
          O {o.nome} ({o.id.toUpperCase()}) analisa todo ano as contas do Governador e emite um parecer prévio, votado pelo
          Tribunal Pleno. O julgamento político é feito depois pela {sp ? "Assembleia Legislativa do Estado de São Paulo (ALESP)" : "Assembleia Legislativa"}, que vota
          um Projeto de Decreto Legislativo (PDL) sobre as contas
          {sp ? (
            <>
              ; as votações aparecem também na seção{" "}
              <Link href="/sao-paulo/votacoes" className="lk">
                votações da ALESP
              </Link>
            </>
          ) : null}
          .
        </p>
        <p className="mt-3 text-base text-[#3e4c59]">
          Dados coletados em {formatarDataTc(meta?.atualizado_em ?? lista[0].coletado_em)}. Exercícios do mais recente para o mais antigo.
        </p>
      </header>

      <nav aria-label="Exercícios" className="max-w-3xl">
        <h2 className="text-lg font-semibold text-gray-900">Resumo por exercício</h2>
        <ul className="mt-2 space-y-1">
          {lista.map((p) => (
            <li key={p.id}>
              <Link href={`#exercicio-${p.parecer.exercicio}`} className="lk inline-flex min-h-11 items-center text-base">
                {tituloGovernador(p, o)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ol className="space-y-12" aria-label="Linha do tempo das contas do Governador">
        {lista.map((p) => (
          <ExercicioGovernadorItem key={p.id} p={p} o={o} />
        ))}
      </ol>

      {meta?.observacoes?.length ? (
        <Secao id="como" titulo="Como os dados foram lidos">
          <ul className="max-w-3xl list-disc space-y-2 pl-5 text-base leading-relaxed text-gray-800">
            {meta.observacoes.map((t) => (
              <li key={t}>{textoLegivel(t)}</li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <Secao id="termos" titulo="Termos explicados">
        <Termos termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <Fontes fontes={[...(meta?.fontes ?? []), ...o.fontes]} />
      </Secao>
    </div>
  );
}
