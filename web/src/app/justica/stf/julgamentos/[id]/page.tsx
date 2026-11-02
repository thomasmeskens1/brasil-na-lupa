import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { metadadosCompartilhamento } from "@/components/compartilhar";
import { CabecalhoDecisao, formatarData, type ItemFicha } from "@/components/decisao";
import { Termo } from "@/components/glossario";
import { Secao } from "@/components/Secao";
import { tituloFonteLegivel } from "@/features/comum/texto";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { QUEM_STF } from "@/features/justica/apresentacao";
import { JulgamentoStfBloco, ambienteStf } from "@/features/justica/componentes/JulgamentoStf";
import { getIndiceStf, getJulgamentoStf, idsOuMarcador } from "@/features/justica/dados";
import { cabecalhoJulgamentoStf } from "@/features/justica/detalhes";
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
  const c = cabecalhoJulgamentoStf(j, id);
  return metadadosCompartilhamento({
    titulo: c.titulo,
    descricao: [c.subtitulo, "Fonte: Supremo Tribunal Federal", j.atualizado_em ? `coletado em ${formatarData(j.atualizado_em)}` : null],
    caminho: `/justica/stf/julgamentos/${id}`,
  });
}

export default async function JulgamentoStfPage({ params }: PageProps<"/justica/stf/julgamentos/[id]">) {
  const { id } = await params;
  const j = carregar(id);
  if (!j) notFound();
  const c = cabecalhoJulgamentoStf(j, id);
  const tema = j.precedente?.tipo === "repercussao-geral" && j.precedente.numero != null ? String(j.precedente.numero) : null;
  const ambiente = ambienteStf(j);
  const ficha: ItemFicha[] = [
    { rotulo: "Processo", valor: j.processo?.identificacao },
    { rotulo: "Órgão julgador", valor: j.orgao },
    { rotulo: "Sessão", valor: ambiente === "virtual" ? "Sessão virtual (Plenário Virtual)" : ambiente === "presencial" ? "Sessão presencial" : null },
    { rotulo: "Relator", valor: j.relator },
    { rotulo: "Redator do acórdão", valor: j.redator_acordao },
    { rotulo: "Data do julgamento", valor: j.data_julgamento ? formatarData(j.data_julgamento) : null },
    { rotulo: "Publicação do acórdão", valor: j.data_publicacao ? formatarData(j.data_publicacao) : null },
    { rotulo: "Coleções acompanhadas", valor: (j.colecoes ?? []).map((x) => COLECOES[x]?.titulo ?? x).join(", ") },
  ];
  const fontes = [
    ...(j.processo?.url ? [{ url: j.processo.url, titulo: "Processo no portal do STF", orgao: "Supremo Tribunal Federal", acessado_em: j.atualizado_em }] : []),
    ...(j.fontes ?? []).filter((f) => f && typeof f.url === "string").map(tituloFonteLegivel),
  ];
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
        rotuloData="julgado em"
        forma="julgamento"
        dado={c.dado}
        quemDecidiu={QUEM_STF(j.orgao, j.relator)}
        fontePrincipal={c.fontePrincipal ? tituloFonteLegivel(c.fontePrincipal) : null}
        url={`/justica/stf/julgamentos/${id}`}
        atalhos={[{ href: "#julgamento", rotulo: "Votos e certidão" }]}
        textoOficial={j.certidao_literal ? { rotulo: "certidão de julgamento", texto: j.certidao_literal } : null}
        ficha={ficha}
        fontes={fontes}
      >
        <p className="text-[var(--cor-secundaria)]">
          {ambiente === "virtual" ? (
            <>
              Julgado no <Termo termo="Plenário Virtual" />: o tribunal publica o voto registrado por cada ministro.
            </>
          ) : (
            <>
              O resultado vem da <Termo termo="Certidão de julgamento">certidão de julgamento</Termo>.
            </>
          )}
          {tema ? (
            <>
              {" "}
              <Link href={`/justica/stf/temas/${tema}`} className="lk inline-flex min-h-11 items-center">
                Ver o Tema {tema} de repercussão geral
              </Link>
            </>
          ) : null}
        </p>
        {j.ementa ? (
          <details className="rounded-md border border-borda bg-white">
            <summary className="pr-3">Ementa (texto oficial)</summary>
            <p className="whitespace-pre-line border-t border-borda px-3 pb-3 pt-2 leading-relaxed">{j.ementa.trim()}</p>
          </details>
        ) : null}
      </CabecalhoDecisao>

      <Secao id="julgamento" titulo="Votos e registros da certidão">
        <JulgamentoStfBloco j={j} semCertidao />
      </Secao>

      <TermosRecolhidos termos={termos} />
    </div>
  );
}
