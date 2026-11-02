import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { JulgamentoStfBloco, tituloJulgamentoStf } from "@/features/justica/componentes/JulgamentoStf";
import { getIndiceStf, getJulgamentoStf, idsOuMarcador } from "@/features/justica/dados";
import { COLECOES, TERMOS_JUSTICA } from "@/features/justica/rotulos";

export function generateStaticParams() {
  return idsOuMarcador(getIndiceStf().julgamentos.map((j) => j.id)).map((id) => ({ id }));
}

function carregar(id: string) {
  return getIndiceStf().julgamentos.some((j) => j.id === id) ? getJulgamentoStf(id) : null;
}

export async function generateMetadata({ params }: PageProps<"/justica/stf/julgamentos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const j = carregar(id);
  if (!j) return { title: "Julgamento não encontrado" };
  return { title: `STF — ${tituloJulgamentoStf(j)}`, description: j.certidao_literal?.slice(0, 200) ?? undefined };
}

const CLASSE: Record<string, string> = {
  ADI: "Ação Direta de Inconstitucionalidade (ADI)",
  ADC: "Ação Declaratória de Constitucionalidade (ADC)",
  ADPF: "Arguição de Descumprimento de Preceito Fundamental (ADPF)",
  RE: "Recurso Extraordinário (RE)",
  ARE: "Recurso Extraordinário com Agravo (ARE)",
};

export default async function JulgamentoStfPage({ params }: PageProps<"/justica/stf/julgamentos/[id]">) {
  const { id } = await params;
  const j = carregar(id);
  if (!j) notFound();
  const classe = j.processo?.classe ? CLASSE[j.processo.classe] : null;
  const tema = j.precedente?.tipo === "repercussao-geral" && j.precedente.numero != null ? String(j.precedente.numero) : null;
  const termos = [
    j.precedente?.tipo === "repercussao-geral" ? TERMOS_JUSTICA.repercussao : TERMOS_JUSTICA.controleConcentrado,
    TERMOS_JUSTICA.certidao,
    TERMOS_JUSTICA.plenarioVirtual,
    TERMOS_JUSTICA.relator,
    TERMOS_JUSTICA.vencido,
    TERMOS_JUSTICA.impedido,
    TERMOS_JUSTICA.embargos,
  ];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/justica" className="lk">
            Justiça
          </Link>
          {" › "}
          <Link href="/justica/stf" className="lk">
            Supremo Tribunal Federal
          </Link>
        </nav>
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <span className="selo selo-escuro">Decisão de órgão colegiado</span>
          {(j.colecoes ?? []).map((c) => (
            <span key={c} className="selo">
              Coleção {COLECOES[c]?.titulo ?? c}
            </span>
          ))}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">STF — {tituloJulgamentoStf(j)}</h1>
        {classe ? <p className="mt-1 text-sm text-gray-800">{classe}</p> : null}
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {j.processo?.url ? (
            <FonteLink href={j.processo.url} tipo="oficial">
              Processo no portal do STF
            </FonteLink>
          ) : null}
          {tema ? (
            <Link href={`/justica/stf/temas/${tema}`} className="lk text-sm">
              Tema {tema} de repercussão geral
            </Link>
          ) : null}
        </p>
      </header>

      {j.ementa ? (
        <Secao id="ementa" titulo="Ementa (texto oficial)" descricao="Resumo oficial da decisão, escrito pelo tribunal no início do acórdão.">
          <details className="cartao max-w-3xl">
            <summary className="text-sm">Mostrar a ementa completa</summary>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-800">{j.ementa.trim()}</p>
          </details>
        </Secao>
      ) : null}

      <Secao id="julgamento" titulo="Julgamento">
        <JulgamentoStfBloco j={j} />
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>
    </div>
  );
}
