import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { lacunasLegiveis, tituloFonteLegivel } from "@/features/comum/texto";
import { ListaFontes, ListaLacunas, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { NAO_DISPONIVEL, formatarData } from "@/features/congresso/rotulos";
import { Citacao } from "@/features/executivo/componentes/Dispositivo";
import { JulgamentoStfBloco } from "@/features/justica/componentes/JulgamentoStf";
import { getIndiceStf, getTemaStf, idsOuMarcador, julgamentosDoTemaStf } from "@/features/justica/dados";
import { COLECOES, TERMOS_JUSTICA } from "@/features/justica/rotulos";

/** Página só para temas de coleção ou com julgamento coletado; sem dados, um marcador que vira 404. */
export function generateStaticParams() {
  return idsOuMarcador(getIndiceStf().com_pagina).map((n) => ({ n }));
}

export async function generateMetadata({ params }: PageProps<"/justica/stf/temas/[n]">): Promise<Metadata> {
  const { n } = await params;
  const t = getIndiceStf().com_pagina.includes(n) ? getTemaStf(n) : null;
  if (!t) return { title: "Tema não encontrado" };
  return { title: `STF — Tema ${t.numero} de repercussão geral`, description: t.descricao?.slice(0, 200) ?? t.titulo ?? undefined };
}

export default async function TemaStfPage({ params }: PageProps<"/justica/stf/temas/[n]">) {
  const { n } = await params;
  const t = getIndiceStf().com_pagina.includes(n) ? getTemaStf(n) : null;
  if (!t) notFound();
  const julgamentos = julgamentosDoTemaStf(t).sort((a, b) => (a.data_julgamento ?? "").localeCompare(b.data_julgamento ?? ""));
  const ficha: [string, string][] = [
    ["Repercussão geral", t.situacao?.repercussao_geral ?? NAO_DISPONIVEL],
    ["Data da decisão sobre a repercussão geral", formatarData(t.situacao?.data_repercussao_geral)],
    ["Andamento", t.situacao?.andamento ?? NAO_DISPONIVEL],
    ["Relator", t.relator ?? NAO_DISPONIVEL],
    ["Processo paradigma", t.leading_case?.identificacao ?? NAO_DISPONIVEL],
    ["Data da tese", formatarData(t.data_tese)],
  ];
  const fontes = (t.fontes ?? []).filter((f) => f && typeof f.url === "string");
  const termos = [TERMOS_JUSTICA.repercussao, TERMOS_JUSTICA.tese, TERMOS_JUSTICA.paradigma, TERMOS_JUSTICA.plenarioVirtual, TERMOS_JUSTICA.certidao, TERMOS_JUSTICA.vencido, TERMOS_JUSTICA.impedido, TERMOS_JUSTICA.presidente];

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
          {(t.colecoes ?? []).map((c) => (
            <span key={c} className="selo">
              Coleção {COLECOES[c]?.titulo ?? c}
            </span>
          ))}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
          Tema {t.numero} de repercussão geral do STF
        </h1>
        {t.titulo ? <p className="mt-2 font-medium text-gray-900">{t.titulo}</p> : null}
        <Citacao rotulo="Descrição oficial do tema" texto={t.descricao} />
        {t.tese ? <Citacao rotulo="Tese firmada (texto oficial)" texto={t.tese} /> : <p className="lacuna mt-3 text-sm">Tese ainda não firmada ou não disponível em fonte oficial.</p>}
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {ficha.map(([r, v]) => (
            <div key={r} className="rounded border border-borda bg-superficie px-3 py-2">
              <dt className="meta">{r}</dt>
              <dd className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {t.url ? (
            <FonteLink href={t.url} tipo="oficial">
              Página oficial do tema no STF
            </FonteLink>
          ) : null}
          {t.leading_case?.url ? (
            <FonteLink href={t.leading_case.url} tipo="oficial">
              Processo paradigma no STF
            </FonteLink>
          ) : null}
        </p>
        <p className="meta mt-2">Dados coletados em {formatarData(t.atualizado_em)}.</p>
      </header>

      <Secao id="julgamentos" titulo="Julgamentos" descricao="Resultado como escrito no texto oficial. Votos individuais só aparecem quando publicados de forma estruturada pelo Plenário Virtual ou depois de conferidos.">
        {julgamentos.length ? (
          <ol className="space-y-4">
            {julgamentos.map((j, i) => (
              <li key={i}>
                <JulgamentoStfBloco j={j} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="lacuna text-sm">Nenhum julgamento deste tema consta dos dados coletados.</p>
        )}
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        <ListaLacunas lacunas={lacunasLegiveis(t.lacunas)} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={fontes.map(tituloFonteLegivel)} />
      </Secao>
    </div>
  );
}
