import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Secao } from "@/components/Secao";
import { Fontes, Literal, Termos, Trilha } from "@/features/tribunais-contas/componentes/Basicos";
import { ExercicioPresidenteItem, tituloPresidente } from "@/features/tribunais-contas/componentes/Exercicios";
import { getContasPresidente, getMetaTcu, getOrgao, getOrgaos, ouMarcador, temContasPresidente } from "@/features/tribunais-contas/dados";
import { BASE_TC, TERMOS_TC, formatarDataTc } from "@/features/tribunais-contas/rotulos";

export function generateStaticParams() {
  return ouMarcador(
    getOrgaos()
      .itens.filter((o) => o.situacao_coleta === "ativa" && temContasPresidente(o.id))
      .map((o) => ({ orgao: o.id })),
    { orgao: "sem-dados" },
  );
}

export async function generateMetadata({ params }: PageProps<"/tribunais-de-contas/[orgao]/contas-do-presidente">): Promise<Metadata> {
  const { orgao } = await params;
  const c = getOrgao(orgao) ? getContasPresidente(orgao) : null;
  if (!c) return { title: "Página não encontrada" };
  return {
    title: "Contas do Presidente da República",
    description: "Parecer prévio do Tribunal de Contas da União sobre as contas do Presidente, com ressalvas e alertas literais, e a situação do julgamento no Congresso Nacional.",
  };
}

export default async function ContasPresidentePage({ params }: PageProps<"/tribunais-de-contas/[orgao]/contas-do-presidente">) {
  const { orgao } = await params;
  const o = getOrgao(orgao);
  const c = o ? getContasPresidente(orgao) : null;
  if (!o || !c) notFound();
  const meta = getMetaTcu(orgao);
  const termos = [
    TERMOS_TC.parecerPrevio,
    TERMOS_TC.julgamentoPolitico,
    TERMOS_TC.ressalva,
    TERMOS_TC.alerta,
    TERMOS_TC.determinacao,
    TERMOS_TC.cmo,
    TERMOS_TC.mcn,
    TERMOS_TC.acordao,
    TERMOS_TC.plenarioCamaras,
    TERMOS_TC.relator,
    TERMOS_TC.siglasOrcamento,
  ];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Trilha itens={[{ href: `${BASE_TC}/${o.id}`, rotulo: o.id.toUpperCase() }]} />
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Contas do Presidente da República</h1>
        <p className="mt-3 text-base leading-relaxed text-gray-800">
          Todo ano, o Presidente da República presta contas ao Congresso Nacional. Antes, o {o.nome} ({o.id.toUpperCase()})
          analisa essas contas e emite um parecer prévio, aprovado pelo Plenário do tribunal em forma de acórdão. Depois, o
          Congresso Nacional faz o julgamento político: a Comissão Mista de Planos, Orçamentos Públicos e Fiscalização (CMO)
          designa um relator, vota o parecer da comissão e as contas seguem para votação no Congresso.
        </p>
        {c.descricao ? (
          <div className="mt-3">
            <Literal fonte="Descrição registrada na coleta">{c.descricao}</Literal>
          </div>
        ) : null}
        <p className="mt-3 text-base text-[#3e4c59]">
          Dados coletados em {formatarDataTc(c.atualizado_em)}. Exercícios do mais recente para o mais antigo.
        </p>
      </header>

      <nav aria-label="Exercícios" className="max-w-3xl">
        <h2 className="text-lg font-semibold text-gray-900">Resumo por exercício</h2>
        <ul className="mt-2 space-y-1">
          {c.exercicios.map((e) => (
            <li key={e.exercicio}>
              <Link href={`#exercicio-${e.exercicio}`} className="lk inline-flex min-h-11 items-center text-base">
                {tituloPresidente(e)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ol className="space-y-12" aria-label="Linha do tempo das contas do Presidente">
        {c.exercicios.map((e) => (
          <ExercicioPresidenteItem key={e.exercicio} e={e} orgao={o.id} />
        ))}
      </ol>

      <Secao id="termos" titulo="Termos explicados">
        <Termos termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <Fontes fontes={[...o.fontes, ...(meta?.fontes ?? [])]} />
      </Secao>
    </div>
  );
}
