import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { metadadosCompartilhamento } from "@/components/compartilhar";
import { CabecalhoDecisao, ItemRecolhivel, formatarData, type ItemFicha } from "@/components/decisao";
import { Termo } from "@/components/glossario";
import { Secao } from "@/components/Secao";
import { lacunasLegiveis, tituloFonteLegivel } from "@/features/comum/texto";
import { ListaLacunas } from "@/features/congresso/componentes/Basicos";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { QUEM_STF, encurtar, resultadoCertidao } from "@/features/justica/apresentacao";
import { JulgamentoStfBloco, tituloJulgamentoStf } from "@/features/justica/componentes/JulgamentoStf";
import { getIndiceStf, getTemaStf, idsOuMarcador, julgamentosDoTemaStf } from "@/features/justica/dados";
import { cabecalhoTemaStf } from "@/features/justica/detalhes";
import { COLECOES, TERMOS_JUSTICA } from "@/features/justica/rotulos";

/** Página só para temas de coleção ou com julgamento coletado; sem dados, um marcador que vira 404. */
export function generateStaticParams() {
  return idsOuMarcador(getIndiceStf().com_pagina).map((n) => ({ n }));
}

function carregar(n: string) {
  return getIndiceStf().com_pagina.includes(n) ? getTemaStf(n) : null;
}

export async function generateMetadata({ params }: PageProps<"/justica/stf/temas/[n]">): Promise<Metadata> {
  const { n } = await params;
  const t = carregar(n);
  if (!t) return { title: "Tema não encontrado" };
  const c = cabecalhoTemaStf(t);
  return metadadosCompartilhamento({
    titulo: c.titulo,
    descricao: [c.subtitulo, "Fonte: Supremo Tribunal Federal", t.atualizado_em ? `coletado em ${formatarData(t.atualizado_em)}` : null],
    caminho: `/justica/stf/temas/${n}`,
  });
}

export default async function TemaStfPage({ params }: PageProps<"/justica/stf/temas/[n]">) {
  const { n } = await params;
  const t = carregar(n);
  if (!t) notFound();
  const c = cabecalhoTemaStf(t);
  const julgamentos = julgamentosDoTemaStf(t).sort((a, b) => (a.data_julgamento ?? "").localeCompare(b.data_julgamento ?? ""));
  const comPagina = new Set(getIndiceStf().julgamentos.map((j) => j.id));
  const ficha: ItemFicha[] = [
    { rotulo: "Título oficial do tema", valor: t.titulo },
    { rotulo: "Repercussão geral", valor: t.situacao?.repercussao_geral },
    { rotulo: "Data da decisão sobre a repercussão geral", valor: t.situacao?.data_repercussao_geral ? formatarData(t.situacao.data_repercussao_geral) : null },
    { rotulo: "Andamento", valor: t.situacao?.andamento },
    { rotulo: "Relator", valor: t.relator },
    { rotulo: "Processo paradigma", valor: t.leading_case?.identificacao },
    { rotulo: "Data da tese", valor: t.data_tese ? formatarData(t.data_tese) : null },
    { rotulo: "Coleções acompanhadas", valor: (t.colecoes ?? []).map((x) => COLECOES[x]?.titulo ?? x).join(", ") },
  ];
  const fontes = [
    ...(t.leading_case?.url ? [{ url: t.leading_case.url, titulo: "Processo paradigma no STF", orgao: "Supremo Tribunal Federal", acessado_em: t.atualizado_em }] : []),
    ...(t.fontes ?? []).filter((f) => f && typeof f.url === "string").map(tituloFonteLegivel),
  ];
  const termos = [
    TERMOS_JUSTICA.repercussao,
    TERMOS_JUSTICA.tese,
    TERMOS_JUSTICA.paradigma,
    TERMOS_JUSTICA.plenarioVirtual,
    TERMOS_JUSTICA.certidao,
    TERMOS_JUSTICA.vencido,
    TERMOS_JUSTICA.impedido,
    TERMOS_JUSTICA.presidente,
  ];

  return (
    <div className="max-w-3xl space-y-8">
      <Migalhas
        itens={[
          { href: "/justica", rotulo: "Justiça" },
          { href: "/justica/stf", rotulo: "Supremo Tribunal Federal" },
        ]}
      />
      <CabecalhoDecisao
        tituloOficial={c.tituloOficial}
        simples={c.simples}
        subtituloOficial={c.subtituloOficial}
        caminho="stf"
        data={c.data}
        rotuloData={t.data_tese ? "tese de" : undefined}
        forma="julgamento"
        dado={c.dado}
        quemDecidiu={QUEM_STF(julgamentos[julgamentos.length - 1]?.orgao ?? null, t.relator)}
        fontePrincipal={c.fontePrincipal}
        url={`/justica/stf/temas/${t.numero}`}
        atalhos={julgamentos.length ? [{ href: "#julgamentos", rotulo: `Julgamentos e votos (${julgamentos.length})` }] : undefined}
        textoOficial={t.descricao ? { rotulo: "descrição oficial do tema", texto: t.descricao } : null}
        ficha={ficha}
        fontes={fontes}
      >
        <p className="text-[var(--cor-secundaria)]">
          Nos temas de <Termo termo="Repercussão geral">repercussão geral</Termo>, a <Termo termo="Tese">tese</Termo> fixada pelo
          Supremo Tribunal Federal vale para os casos iguais.
        </p>
      </CabecalhoDecisao>

      <Secao
        id="julgamentos"
        titulo="Julgamentos"
        descricao="Resultado como escrito no texto oficial. Votos individuais só aparecem quando publicados de forma estruturada pelo Plenário Virtual ou depois de conferidos."
      >
        {julgamentos.length ? (
          <ol className="space-y-2">
            {julgamentos.map((j, i) => {
              const r = resultadoCertidao(j);
              return (
                <li key={j.id ?? i}>
                  <ItemRecolhivel
                    aberto={julgamentos.length === 1}
                    resumo={
                      <span className="block">
                        <span className="block font-semibold text-foreground">
                          {tituloJulgamentoStf(j)} · {formatarData(j.data_julgamento)}
                        </span>
                        {r ? <span className="block text-sm font-normal italic text-[var(--cor-secundaria)]">“{encurtar(r, 120)}”</span> : null}
                      </span>
                    }
                  >
                    <JulgamentoStfBloco j={j} link={!!j.id && comPagina.has(j.id)} />
                  </ItemRecolhivel>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="lacuna text-sm">Nenhum julgamento deste tema consta dos dados coletados.</p>
        )}
      </Secao>

      <TermosRecolhidos termos={termos} />

      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        <ListaLacunas lacunas={lacunasLegiveis(t.lacunas)} />
      </Secao>
    </div>
  );
}
