import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { metadadosCompartilhamento } from "@/components/compartilhar";
import { CabecalhoDecisao, NAO_DISPONIVEL, formatarData, type ItemFicha } from "@/components/decisao";
import { Termo } from "@/components/glossario";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { lacunasLegiveis } from "@/features/comum/texto";
import { ListaLacunas } from "@/features/congresso/componentes/Basicos";
import { QUEM_VETO } from "@/features/executivo/apresentacao";
import { DispositivosVeto } from "@/features/executivo/componentes/DispositivosVeto";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { getIndiceExecutivo, getVeto, idsOuMarcador } from "@/features/executivo/dados";
import { cabecalhoVeto, resumosDispositivos } from "@/features/executivo/detalhes";
import { SITUACAO_DISPOSITIVO, TERMOS_EXECUTIVO, URL_CONSTITUICAO, explicarSigla, rotuloTipoVeto } from "@/features/executivo/rotulos";
import { AcoesProposta } from "@/components/reacoes";
import { idExecutivo } from "@/features/conta/ids";

export function generateStaticParams() {
  return idsOuMarcador(getIndiceExecutivo().vetos.map((v) => v.id)).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/executivo/vetos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const v = getVeto(id);
  if (!v) return { title: "Veto não encontrado" };
  const c = cabecalhoVeto(v);
  return metadadosCompartilhamento({
    titulo: c.titulo,
    descricao: [c.subtitulo, "Fonte: Presidência da República e Congresso Nacional", v.atualizado_em ? `coletado em ${formatarData(v.atualizado_em)}` : null],
    caminho: `/executivo/vetos/${id}`,
  });
}

const SEM_SIGNIFICADO =
  "A fonte oficial coletada não informa o que significa votar \"Sim\" ou \"Não\" na votação de cada trecho. Os votos aparecem exatamente como registrados pelo Congresso Nacional, sem interpretação.";

export default async function VetoPage({ params }: PageProps<"/executivo/vetos/[id]">) {
  const { id } = await params;
  const v = getVeto(id);
  if (!v) notFound();

  const c = cabecalhoVeto(v);
  const resumos = resumosDispositivos(v);
  const temVotos = resumos.some((d) => d.temVotos);
  const ficha: ItemFicha[] = [
    { rotulo: "Tipo", valor: rotuloTipoVeto(v.tipo) },
    { rotulo: "Projeto vetado", valor: explicarSigla(v.materia_vetada?.identificacao) },
    { rotulo: "Lei (parte sancionada)", valor: v.norma?.descricao },
    { rotulo: "Mensagem de veto", valor: explicarSigla(v.mensagem?.identificacao) },
    { rotulo: "Publicação do veto", valor: v.datas?.publicacao ? formatarData(v.datas.publicacao) : null },
    { rotulo: "Recebimento pelo Congresso", valor: v.datas?.recebimento_congresso ? formatarData(v.datas.recebimento_congresso) : null },
    ...(v.datas?.sobrestamento_pauta ? [{ rotulo: "Início do sobrestamento da pauta", valor: formatarData(v.datas.sobrestamento_pauta) }] : []),
    { rotulo: "Situação no registro oficial", valor: v.situacao_oficial },
    { rotulo: "Trechos vetados", valor: String(v.quantidade_dispositivos_fonte ?? v.dispositivos.length) },
  ];
  const fontes = [
    ...(v.links?.congresso_dispositivos
      ? [{ url: v.links.congresso_dispositivos, titulo: "Dispositivos e resultado no Congresso Nacional", orgao: "Congresso Nacional", acessado_em: v.atualizado_em }]
      : []),
    ...(v.links?.senado ? [{ url: v.links.senado, titulo: "Tramitação no Senado Federal", orgao: "Senado Federal", acessado_em: v.atualizado_em }] : []),
    ...(v.resultado_pdfs ?? []).map((p) => ({ url: p.url, titulo: p.descricao ?? "Resultado oficial da votação", tipo: "pdf" as const, acessado_em: v.atualizado_em })),
    ...c.fontes,
  ];
  const termos = [
    TERMOS_EXECUTIVO.veto,
    TERMOS_EXECUTIVO.vetoTotalParcial,
    TERMOS_EXECUTIVO.dispositivo,
    TERMOS_EXECUTIVO.sessaoConjunta,
    TERMOS_EXECUTIVO.sobrestamento,
    ...(temVotos ? [TERMOS_EXECUTIVO.cedula] : []),
    ...Object.values(SITUACAO_DISPOSITIVO).map((s) => ({ termo: s.rotulo, explicacao: s.explicacao })),
  ];
  const lacunas = [...lacunasLegiveis(v.lacunas), ...(temVotos ? [SEM_SIGNIFICADO] : [])];

  return (
    <div className="max-w-3xl space-y-8">
      <Migalhas
        itens={[
          { href: "/executivo", rotulo: "Executivo" },
          { href: "/executivo/vetos", rotulo: "Vetos" },
        ]}
      />
      <CabecalhoDecisao
        acoes={<AcoesProposta proposta={idExecutivo(v.id)} />}
        tituloOficial={c.tituloOficial}
        simples={c.simples}
        subtituloOficial={c.subtituloOficial}
        caminho="presidencia"
        data={c.data}
        rotuloData="veto publicado em"
        forma="ato-individual"
        dado={c.dado}
        quemDecidiu={QUEM_VETO}
        fontePrincipal={c.fontePrincipal}
        url={`/executivo/vetos/${v.id}`}
        atalhos={resumos.length ? [{ href: "#dispositivos", rotulo: `Cada trecho vetado (${resumos.length})` }] : undefined}
        textoOficial={v.ementa ? { rotulo: "ementa do veto", texto: v.ementa } : null}
        ficha={ficha}
        fontes={fontes}
      >
        <p>
          Pela Constituição (artigo 66, §4º), o <Termo termo="Veto">veto</Termo> só é derrubado pelo voto da maioria absoluta dos
          deputados e dos senadores, em <Termo termo="Sessão conjunta">sessão conjunta</Termo>.{" "}
          <FonteLink href={URL_CONSTITUICAO} tipo="oficial">
            Constituição Federal
          </FonteLink>
        </p>
        {v.materia_vetada?.ementa ? (
          <details className="rounded-md border border-borda bg-white">
            <summary className="pr-3">Ementa do projeto vetado (texto oficial)</summary>
            <blockquote className="border-t border-borda px-3 pb-3 pt-2 leading-relaxed">{v.materia_vetada.ementa}</blockquote>
          </details>
        ) : null}
      </CabecalhoDecisao>

      <Secao
        id="dispositivos"
        titulo="Cada trecho vetado"
        descricao="Na ordem do Congresso Nacional. Toque num trecho para ver o texto vetado e as razões do veto, copiados literalmente da fonte oficial, e a votação."
      >
        {temVotos ? <p className="aviso mb-4">{SEM_SIGNIFICADO}</p> : null}
        {resumos.length ? (
          <DispositivosVeto itens={resumos} urlOficial={v.links?.congresso_dispositivos ?? null} />
        ) : (
          <p className="lacuna text-sm">Trechos vetados: {NAO_DISPONIVEL}.</p>
        )}
      </Secao>

      <TermosRecolhidos termos={termos} />

      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        <ListaLacunas lacunas={lacunas} />
      </Secao>
    </div>
  );
}
