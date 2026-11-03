import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Secao } from "@/components/Secao";
import { metadadosCompartilhamento } from "@/components/compartilhar/metadados";
import { situacaoCongresso } from "@/features/tribunais-contas/cartoes";
import { Fontes, Literal, Termos, Trilha } from "@/features/tribunais-contas/componentes/Basicos";
import { ExercicioPresidenteItem, tituloPresidente } from "@/features/tribunais-contas/componentes/Exercicios";
import { getContasPresidente, getMetaTcu, getOrgao, getOrgaos, ouMarcador, temContasPresidente } from "@/features/tribunais-contas/dados";
import { BASE_TC, TERMOS_TC, formatarDataTc } from "@/features/tribunais-contas/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";

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
  const e = c.exercicios.find((x) => x.acordao) ?? c.exercicios[0];
  return metadadosCompartilhamento({
    titulo: e ? tituloPresidente(e) : "Contas do Presidente da República",
    descricao: [
      "Parecer prévio do Tribunal de Contas da União (TCU) e julgamento no Congresso Nacional",
      e ? situacaoCongresso(e.julgamento_politico) : null,
      c.atualizado_em ? `coletado em ${formatarDataTc(c.atualizado_em)}` : null,
    ],
    caminho: `${BASE_TC}/${orgao}/contas-do-presidente`,
  });
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
        <Figurinha nome="lupa" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">Contas do Presidente da República</h1>
        <p className="mt-2 text-base leading-relaxed text-gray-800">
          O parecer prévio do {o.nome} ({o.id.toUpperCase()}) e o julgamento no Congresso Nacional, exercício por exercício.
        </p>
        <p className="mt-2 text-base text-[var(--cor-secundaria)]">Dados coletados em {formatarDataTc(c.atualizado_em)}. Do mais recente para o mais antigo.</p>
        <details className="mt-3 rounded-md border border-borda bg-white">
          <summary className="pr-3">Como as contas do Presidente são julgadas</summary>
          <div className="space-y-3 border-t border-borda px-3 pb-3 pt-2 text-base leading-relaxed text-gray-800">
            <p>
              Todo ano, o Presidente da República presta contas ao Congresso Nacional. Antes, o {o.nome} ({o.id.toUpperCase()})
              analisa essas contas e emite um parecer prévio, aprovado pelo Plenário do tribunal em forma de acórdão. Depois, o
              Congresso Nacional faz o julgamento político: a Comissão Mista de Planos, Orçamentos Públicos e Fiscalização (CMO)
              designa um relator, vota o parecer da comissão e as contas seguem para votação no Congresso.
            </p>
            {c.descricao ? <Literal fonte="Descrição registrada na coleta">{c.descricao}</Literal> : null}
          </div>
        </details>
      </header>

      <nav aria-label="Exercícios" className="max-w-3xl">
        <ul className="flex flex-wrap gap-2">
          {c.exercicios.map((e) => (
            <li key={e.exercicio}>
              <Link href={`#exercicio-${e.exercicio}`} className="botao">
                {e.exercicio}
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
