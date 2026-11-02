import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { getIndice, getVotacao, idsComPerfil } from "@/features/congresso/dados";
import { ListaFontes, ListaLacunas } from "@/features/congresso/componentes/Basicos";
import {
  OQueFoiVotado,
  Orientacoes,
  PlacarVotacao,
  Proposicoes,
  VotosDaVotacao,
} from "@/features/congresso/componentes/DetalheVotacao";
import { CASAS, CASA_NOME, NAO_DISPONIVEL, TERMOS, TIPO, ehCasa, formatarData, rotuloResultado } from "@/features/congresso/rotulos";
import type { FonteCongresso, VotacaoDetalhe } from "@/features/congresso/tipos";

/** Todas as votações coletadas são geradas no build (nominais, secretas e simbólicas). */
export function generateStaticParams() {
  return CASAS.flatMap((casa) => getIndice(casa).votacoes.map((v) => ({ casa, id: v.id })));
}

function carregar(casa: string, id: string): VotacaoDetalhe | null {
  return ehCasa(casa) ? getVotacao(casa, decodeURIComponent(id)) : null;
}

function titulo(v: VotacaoDetalhe): string {
  const p = v.proposicao?.titulo ?? v.proposicao?.identificacao;
  return `${p ? `Votação: ${p}` : "Votação"} em ${formatarData(v.data)}`;
}

export async function generateMetadata({ params }: PageProps<"/congresso/votacoes/[casa]/[id]">): Promise<Metadata> {
  const { casa, id } = await params;
  const v = carregar(casa, id);
  if (!v) return { title: "Votação não encontrada" };
  return { title: `${titulo(v)} (${CASA_NOME[v.casa]})`, description: v.descricao?.slice(0, 200) ?? undefined };
}

export default async function VotacaoPage({ params }: PageProps<"/congresso/votacoes/[casa]/[id]">) {
  const { casa, id } = await params;
  const v = carregar(casa, id);
  if (!v) notFound();

  const tipo = TIPO[v.tipo] ?? { rotulo: "Tipo de votação não informado", explicacao: "" };
  const fontes: FonteCongresso[] = v.fontes?.length ? v.fontes : v.fonte ? [v.fonte] : [];
  const coletadoEm = fontes.find((f) => f.acessado_em)?.acessado_em ?? null;
  const ficha: [string, string][] = [
    ["Data", formatarData(v.data)],
    ["Horário", v.hora ?? NAO_DISPONIVEL],
    ["Órgão", v.orgao_nome ?? v.orgao ?? NAO_DISPONIVEL],
    ["Tipo de votação", tipo.rotulo],
    ["Resultado", rotuloResultado(v.resultado)],
  ];
  if (v.sessao?.presidente) ficha.push(["Presidente da sessão", v.sessao.presidente]);
  if (v.sessao?.tipo) ficha.push(["Sessão", `${v.sessao.numero ? `${v.sessao.numero}ª sessão ` : ""}${v.sessao.tipo}`]);

  const temPlacar = v.placar && Object.values(v.placar).some((n) => typeof n === "number");

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/congresso" className="lk">
            Congresso
          </Link>
          {" › "}
          <span>{CASA_NOME[v.casa]}</span>
        </nav>
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <span className="selo selo-escuro">{tipo.rotulo}</span>
          <span className="text-sm font-medium text-gray-900">{CASA_NOME[v.casa]}</span>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">{titulo(v)}</h1>
        {tipo.explicacao ? <p className="mt-2 text-sm text-gray-800">{tipo.explicacao}</p> : null}
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {ficha.map(([r, valor]) => (
            <div key={r} className="rounded border border-borda bg-superficie px-3 py-2">
              <dt className="meta">{r}</dt>
              <dd className="font-semibold text-gray-900">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="meta mt-3">
          Fonte: {CASA_NOME[v.casa]}, dados abertos; coletado em {formatarData(coletadoEm)}.
          {v.url ? (
            <>
              {" "}
              <FonteLink href={v.url} tipo="oficial" className="text-xs">
                Página oficial da votação
              </FonteLink>
            </>
          ) : null}
        </p>
      </header>

      <Secao id="o-que-foi-votado" titulo="O que foi votado" descricao="Textos oficiais, transcritos da fonte.">
        <OQueFoiVotado v={v} />
      </Secao>

      <Secao id="proposicao" titulo="Proposição">
        <Proposicoes v={v} />
      </Secao>

      <Secao
        id="placar"
        titulo="Placar"
        descricao={
          v.tipo === "simbolica"
            ? undefined
            : "Totais oficiais. “Outros” é o total que a fonte informa fora de Sim, Não, Abstenção e Obstrução, como a marcação de quem presidia a sessão."
        }
      >
        {v.tipo === "simbolica" ? (
          <p className="lacuna text-sm">Votação simbólica: não há placar oficial com o número de votos.</p>
        ) : temPlacar ? (
          <PlacarVotacao v={v} />
        ) : (
          <p className="lacuna text-sm">Placar não disponível em fonte oficial.</p>
        )}
      </Secao>

      <Secao id="orientacoes" titulo="Orientações de bancada" descricao={TERMOS.orientacao.explicacao}>
        <Orientacoes orientacoes={v.orientacoes ?? []} casa={v.casa} />
      </Secao>

      <Secao id="votos" titulo="Votos">
        <VotosDaVotacao v={v} perfis={idsComPerfil(v.casa)} />
      </Secao>

      {v.texto_oficial_sessao ? (
        <Secao id="texto-sessao" titulo="Texto oficial da sessão">
          <details className="cartao">
            <summary>Mostrar o texto oficial registrado sobre a sessão</summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-800">{v.texto_oficial_sessao.trim()}</p>
          </details>
        </Secao>
      ) : null}

      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        <ListaLacunas lacunas={v.lacunas ?? []} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={fontes} />
      </Secao>
    </div>
  );
}
