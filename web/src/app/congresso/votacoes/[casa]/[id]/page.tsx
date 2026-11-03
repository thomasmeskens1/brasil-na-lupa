import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { metadadosCompartilhamento } from "@/components/compartilhar/metadados";
import { CabecalhoDecisao } from "@/components/decisao/CabecalhoDecisao";
import { FichaTecnica } from "@/components/decisao/FichaTecnica";
import { resolverTitulo } from "@/components/decisao/rotulos";
import type { FonteResumo } from "@/components/decisao/tipos";
import { Secao } from "@/components/Secao";
import { getIndice, getVotacao, idsComPerfil, linhaVotacao } from "@/features/congresso/dados";
import { ListaFontes, ListaLacunas } from "@/features/congresso/componentes/Basicos";
import {
  BlocoQuorum,
  OQueFoiVotado,
  Orientacoes,
  Proposicoes,
  VotosDaVotacao,
  listaProposicoes,
} from "@/features/congresso/componentes/DetalheVotacao";
import {
  QUEM_DECIDIU,
  dadoDaVotacao,
  explicacaoQuorum,
  formaDe,
  propPorExtenso,
  tituloOficialVotacao,
} from "@/features/congresso/lista";
import { CASAS, CASA_NOME, TIPO, ehCasa, formatarData, rotuloResultado } from "@/features/congresso/rotulos";
import { tituloSimplesVotacao } from "@/features/congresso/titulos";
import type { FonteCongresso, VotacaoDetalhe } from "@/features/congresso/tipos";

/** Todas as votações coletadas são geradas no build (nominais, secretas e simbólicas). */
export function generateStaticParams() {
  return CASAS.flatMap((casa) => getIndice(casa).votacoes.map((v) => ({ casa, id: v.id })));
}

function carregar(casa: string, id: string): VotacaoDetalhe | null {
  return ehCasa(casa) ? getVotacao(casa, decodeURIComponent(id)) : null;
}

function conferencia(c: string | null | undefined): string {
  return !c ? "não informado" : c === "indisponivel" ? "indisponível" : c;
}

function propTitulo(v: VotacaoDetalhe): string | null {
  return v.proposicao?.titulo ?? v.proposicao?.identificacao ?? null;
}

function titulos(v: VotacaoDetalhe) {
  const prop = propTitulo(v);
  return resolverTitulo({
    tituloOficial: tituloOficialVotacao({ proposicao: prop, descricao: v.descricao ?? "" }),
    simples: tituloSimplesVotacao(v.casa, v.id),
    subtituloOficial: propPorExtenso(prop),
  });
}

/** Fonte principal legível: a página oficial da votação (Câmara) ou da matéria (Senado). */
function fontePrincipal(v: VotacaoDetalhe, fontes: FonteCongresso[]): FonteResumo | null {
  const acessado = fontes.find((f) => f.acessado_em)?.acessado_em ?? null;
  const orgao = CASA_NOME[v.casa];
  if (v.url) return { url: v.url, titulo: "Página oficial da votação", orgao, acessado_em: acessado };
  const pagina = fontes.find((f) => /www25\.senado\.leg\.br/.test(f.url));
  if (pagina) return { url: pagina.url, titulo: "Votações da matéria no portal do Senado", orgao, acessado_em: pagina.acessado_em ?? acessado };
  const f = fontes[0];
  return f ? { url: f.url, titulo: "Registro da votação nos dados abertos", orgao, acessado_em: f.acessado_em ?? acessado } : null;
}

export async function generateMetadata({ params }: PageProps<"/congresso/votacoes/[casa]/[id]">): Promise<Metadata> {
  const { casa, id } = await params;
  const v = carregar(casa, id);
  if (!v) return { title: "Votação não encontrada" };
  const t = titulos(v);
  const fontes = v.fontes?.length ? v.fontes : v.fonte ? [v.fonte] : [];
  return metadadosCompartilhamento({
    titulo: t.titulo,
    descricao: [
      t.subtitulo,
      `${TIPO[v.tipo]?.rotulo ?? "Votação"} em ${formatarData(v.data)}`,
      `Fonte: ${CASA_NOME[v.casa]}`,
      `coletado em ${formatarData(fontes.find((f) => f.acessado_em)?.acessado_em)}`,
    ],
    caminho: `/congresso/votacoes/${v.casa}/${encodeURIComponent(v.id)}`,
  });
}

export default async function VotacaoPage({ params }: PageProps<"/congresso/votacoes/[casa]/[id]">) {
  const { casa, id } = await params;
  const v = carregar(casa, id);
  if (!v) notFound();

  const t = titulos(v);
  const tipo = TIPO[v.tipo] ?? { rotulo: "Tipo de votação não informado", explicacao: "" };
  const fontes: FonteCongresso[] = v.fontes?.length ? v.fontes : v.fonte ? [v.fonte] : [];
  const linha = linhaVotacao(v.casa, v.id);
  const q = explicacaoQuorum({
    casa: v.casa,
    sigla: v.proposicao?.sigla ?? null,
    tipo: v.tipo,
    resultado: v.resultado ?? null,
    placar: v.placar,
    mudaLei: linha?.mudaLei ?? false,
    descricao: v.descricao ?? null,
  });
  const props = listaProposicoes(v);
  const ementa = props[0]?.ementa;
  const conf = v.conferencia_placar && typeof v.conferencia_placar === "object" ? v.conferencia_placar : null;
  const membros = v.casa === "camara" ? "deputado" : "senador";
  const atalhos = [
    { href: "#votos", rotulo: v.tipo === "nominal" ? `Como votou cada ${membros}` : v.tipo === "simbolica" ? "Por que não há voto individual" : "Comparecimento" },
    ...(v.orientacoes?.length ? [{ href: "#orientacoes", rotulo: "Orientações de bancada" }] : []),
  ];

  return (
    <div className="space-y-8">
      <nav aria-label="Você está em" className="meta">
        <Link href="/congresso" className="lk inline-flex min-h-11 items-center">
          Congresso
        </Link>
        {" › "}
        <span>Votação {v.casa === "camara" ? "na Câmara" : "no Senado"}</span>
      </nav>

      <CabecalhoDecisao
        tituloOficial={tituloOficialVotacao({ proposicao: propTitulo(v), descricao: v.descricao ?? "" })}
        simples={tituloSimplesVotacao(v.casa, v.id)}
        subtituloOficial={propPorExtenso(propTitulo(v))}
        caminho={v.casa}
        data={v.data}
        rotuloData="votado em"
        forma={formaDe(v.tipo)}
        dado={dadoDaVotacao({ tipo: v.tipo, resultado: v.resultado ?? null, placar: v.placar })}
        quemDecidiu={QUEM_DECIDIU[v.casa]}
        tema={t.tema}
        fontePrincipal={fontePrincipal(v, fontes)}
        url={`/congresso/votacoes/${v.casa}/${encodeURIComponent(v.id)}`}
        atalhos={atalhos}
        textoOficial={ementa ? { rotulo: "ementa da proposição", texto: ementa } : null}
      >
        {q ? <BlocoQuorum q={q} /> : null}
        <OQueFoiVotado v={v} />
      </CabecalhoDecisao>

      <Secao id="votos" titulo={v.tipo === "nominal" ? "Votos" : v.tipo === "simbolica" ? "Voto individual" : "Comparecimento"}>
        <VotosDaVotacao v={v} perfis={idsComPerfil(v.casa)} />
      </Secao>

      <div className="space-y-3">
        {v.orientacoes?.length ? <Orientacoes orientacoes={v.orientacoes} casa={v.casa} /> : null}
        <details className="rounded-md border border-borda bg-white">
          <summary className="pr-3">
            Proposição <span className="font-normal text-[var(--cor-secundaria)]">({props.length})</span>
          </summary>
          <div className="border-t border-borda px-3 pb-3 pt-2">
            <Proposicoes v={v} />
          </div>
        </details>
        <FichaTecnica
          itens={[
            { rotulo: "Data", valor: v.data ? formatarData(v.data) : null },
            { rotulo: "Horário", valor: v.hora },
            { rotulo: "Órgão", valor: v.orgao_nome ?? v.orgao },
            { rotulo: "Tipo de votação", valor: `${tipo.rotulo}. ${tipo.explicacao}` },
            { rotulo: "Resultado", valor: rotuloResultado(v.resultado) },
            { rotulo: "Presidente da sessão", valor: v.sessao?.presidente },
            { rotulo: "Sessão", valor: v.sessao?.tipo ? `${v.sessao.numero ? `${v.sessao.numero}ª sessão ` : ""}${v.sessao.tipo}` : null },
            { rotulo: "Origem do placar", valor: v.placar_origem },
            {
              rotulo: "Conferência do placar",
              valor: conf
                ? `com o texto oficial da sessão: ${conferencia(conf.texto_oficial)}; com o painel de orientação: ${conferencia(conf.painel_orientacao)}`
                : typeof v.conferencia_placar === "string"
                  ? v.conferencia_placar
                  : null,
            },
          ]}
        />
        {v.texto_oficial_sessao ? (
          <details className="rounded-md border border-borda bg-white">
            <summary className="pr-3">Texto oficial registrado sobre a sessão</summary>
            <p className="whitespace-pre-line border-t border-borda px-3 pb-3 pt-2 leading-relaxed">{v.texto_oficial_sessao.trim()}</p>
          </details>
        ) : null}
      </div>

      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        <ListaLacunas lacunas={v.lacunas ?? []} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={fontes} />
      </Secao>
    </div>
  );
}
