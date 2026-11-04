import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { metadadosCompartilhamento } from "@/components/compartilhar/metadados";
import { ListaRecolhivel } from "@/components/lista";
import { Figurinha } from "@/components/marca/Figurinhas";
import { Secao } from "@/components/Secao";
import { contagemPorTema, getIndice, getPainel, linhaVotacao, opcoesFiltro, votacoesIniciais } from "@/features/congresso/dados";
import { AtalhosCasa, AtalhosTema, type ResumoCasa } from "@/features/congresso/componentes/Atalhos";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { BuscaParlamentar, type ItemBuscaParlamentar } from "@/features/congresso/componentes/BuscaParlamentar";
import { CartaoVotacao } from "@/features/congresso/componentes/CartaoVotacao";
import { ComoViraLei } from "@/features/congresso/componentes/ComoViraLei";
import { ListaVotacoes } from "@/features/congresso/componentes/ListaVotacoes";
import { ListaVotacoesComParametros } from "@/features/congresso/componentes/ListaVotacoesComParametros";
import { PainelNumeros } from "@/features/congresso/componentes/PainelNumeros";
import { CASAS, CASA_NOME, TERMOS, TIPO, formatarData } from "@/features/congresso/rotulos";
import type { Casa, FonteCongresso, IndiceCasa } from "@/features/congresso/tipos";

export const metadata: Metadata = metadadosCompartilhamento({
  titulo: "Congresso Nacional: votações da Câmara e do Senado",
  descricao:
    "O que foi votado na Câmara dos Deputados e no Senado Federal, dia a dia: o placar oficial, o resultado e o voto de cada parlamentar nas votações nominais, com fonte oficial.",
  caminho: "/congresso",
});

const INICIAIS = 30;

/** Fonte principal das votações de cada casa (arquivo anual da Câmara; serviço de votações do Senado). */
function fonteVotacoes(i: IndiceCasa, ano: string): (FonteCongresso & { orgao: string }) | null {
  const f =
    i.casa === "camara"
      ? (i.fontes.find((x) => x.url.includes(`/arquivos/votacoes/json/votacoes-${ano}`)) ?? i.fontes.find((x) => x.url.includes("/arquivos/votacoes/")))
      : (i.fontes.find((x) => /\/dadosabertos\/votacao$/.test(x.url)) ?? i.fontes[0]);
  return f ? { ...f, titulo: f.titulo ?? `Votações — ${CASA_NOME[i.casa]}`, orgao: CASA_NOME[i.casa] } : null;
}

function resumoCasa(i: IndiceCasa): ResumoCasa {
  const atuais = i.parlamentares.filter((p) => p.na_lista_atual);
  const m = new Map<string, number>();
  for (const p of atuais) m.set(p.partido ?? "Partido não informado", (m.get(p.partido ?? "Partido não informado") ?? 0) + 1);
  return {
    casa: i.casa,
    votacoesLei: i.votacoes.filter((v) => v.muda_lei).length,
    emExercicio: atuais.length,
    partidos: [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")),
    estados: new Set(atuais.map((p) => p.uf).filter(Boolean)).size,
  };
}

export default function CongressoPage() {
  const indices = CASAS.map((c) => getIndice(c));
  const painel = getPainel();
  const { temas, anos } = opcoesFiltro();
  const iniciais = votacoesIniciais(INICIAIS);
  const porTema = contagemPorTema();
  const semana = painel?.semana ?? null;
  const daSemana = (semana?.itens ?? []).map(([c, id]) => linhaVotacao(c as Casa, id)).filter((l) => l !== null);
  const anoMes = painel?.mes?.inicio.slice(0, 4) ?? "";
  const fontesVotacoes = indices.map((i) => fonteVotacoes(i, anoMes)).filter((f) => f !== null);
  const parlamentares: ItemBuscaParlamentar[] = indices
    .flatMap((i) => i.parlamentares.filter((p) => p.na_lista_atual).map((p) => [i.casa, p.id, p.nome, p.partido ?? "", p.uf ?? ""] as ItemBuscaParlamentar))
    .sort((a, b) => a[2].localeCompare(b[2], "pt-BR"));
  const termos = [
    { termo: TIPO.nominal.rotulo, explicacao: TIPO.nominal.explicacao },
    { termo: TIPO.simbolica.rotulo, explicacao: TIPO.simbolica.explicacao },
    { termo: TIPO.secreta.rotulo, explicacao: TIPO.secreta.explicacao },
    TERMOS.orientacao,
    TERMOS.obstrucao,
    TERMOS.ementa,
  ];

  return (
    <div className="space-y-12">
      <header className="heroi entrada">
        <Figurinha nome="congresso" className="heroi-figurinha figurinha-flutua" />
        <h1 className="manchete text-3xl leading-tight md:text-5xl">Congresso Nacional</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--cor-secundaria)]">
          O que a Câmara dos Deputados e o Senado Federal votaram, quem votou e como. Sempre com o placar oficial e o link do
          documento de cada casa.
        </p>
        <ul className="meta mt-3 space-y-0.5">
          {indices.map((i) => (
            <li key={i.casa}>
              {CASA_NOME[i.casa]}: dados coletados em {formatarData(i.atualizado_em)}
              {i.periodo?.inicio ? `, votações de ${formatarData(i.periodo.inicio)} a ${formatarData(i.periodo.fim)}` : ""}.
            </li>
          ))}
        </ul>
      </header>

      <Secao id="numeros" titulo="Em números" descricao="Contagens dos registros oficiais, cada uma com o período e a fonte. Sem médias nem estimativas.">
        {painel ? (
          <PainelNumeros painel={painel} fontesVotacoes={fontesVotacoes} />
        ) : (
          <p className="lacuna">Informação não disponível: o painel ainda não foi gerado a partir das fontes oficiais.</p>
        )}
      </Secao>

      <section aria-label="Buscar parlamentar" className="rounded-3xl border border-[var(--cor-borda-forte)] bg-superficie p-4 sm:p-6">
        <BuscaParlamentar itens={parlamentares} />
        <p className="mt-3 flex flex-wrap gap-2">
          <Link href="/congresso/deputados" className="botao text-sm">
            Todos os deputados federais
          </Link>
          <Link href="/congresso/senadores" className="botao text-sm">
            Todos os senadores
          </Link>
          <Link href="/congresso/comparar" className="botao text-sm">
            Comparar até 5 lado a lado
          </Link>
        </p>
      </section>

      <Secao
        id="semana"
        titulo="O que foi votado na última semana com votação"
        descricao={
          semana ? (
            <>
              Semana de {formatarData(semana.inicio)} a {formatarData(semana.fim)}: {semana.total.toLocaleString("pt-BR")}{" "}
              {semana.total === 1 ? "votação" : "votações"} coletadas ({CASA_NOME.camara}: {semana.camara}; {CASA_NOME.senado}:{" "}
              {semana.senado}). Abaixo, as {daSemana.length} que podem criar ou mudar leis, da mais recente para a mais antiga.
            </>
          ) : undefined
        }
      >
        {daSemana.length ? (
          <ListaRecolhivel
            rotulo={{ singular: "votação", plural: "votações" }}
            inicial={6}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            itens={daSemana.map((l) => (
              <CartaoVotacao key={`${l.casa}-${l.id}`} l={l} as="div" mostrarData />
            ))}
          />
        ) : (
          <p className="lacuna">Nenhuma votação que muda lei registrada nas fontes coletadas nesta semana.</p>
        )}
      </Secao>

      <Secao id="casas" titulo="Por casa" descricao="Quem está em exercício hoje, segundo a lista oficial de cada casa, e as votações de cada uma.">
        <AtalhosCasa casas={indices.map(resumoCasa)} />
      </Secao>

      {porTema.size ? (
        <Secao id="temas" titulo="Por tema" descricao="Votações que podem criar ou mudar leis, por assunto do dia a dia. Toque em um tema para ver a lista.">
          <AtalhosTema temas={[...porTema.entries()]} />
        </Secao>
      ) : null}

      <Secao id="votacoes" titulo="Todas as votações, dia a dia">
        <Suspense fallback={<ListaVotacoes iniciais={iniciais} temas={temas} anos={anos} />}>
          <ListaVotacoesComParametros iniciais={iniciais} temas={temas} anos={anos} />
        </Suspense>
      </Secao>

      <Secao id="como-vira-lei" titulo="Como uma proposta vira lei" descricao="O caminho de um projeto de lei, em sete etapas, segundo a Constituição Federal.">
        <ComoViraLei />
      </Secao>

      <Secao id="como-ler" titulo="Como ler as votações">
        <details className="rounded-md border border-borda bg-white">
          <summary className="pr-3">Saiba mais: votação nominal, simbólica, secreta e outros termos</summary>
          <div className="border-t border-borda p-3">
            <TermosExplicados termos={termos} />
          </div>
        </details>
      </Secao>

      <Secao id="cobertura" titulo="O que a coleta cobre">
        <details className="rounded-md border border-borda bg-white">
          <summary className="pr-3">Saiba mais: períodos, tipos de votação e fontes de cada casa</summary>
          <div className="space-y-4 border-t border-borda p-3">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {indices.map((i) => (
                <div key={i.casa} className="cartao">
                  <h3 className="font-semibold text-foreground">{CASA_NOME[i.casa]}</h3>
                  <p className="mt-1">
                    {i.votacoes.length} votações coletadas:{" "}
                    {(
                      [
                        ["nominal", "nominais"],
                        ["simbolica", "simbólicas"],
                        ["secreta", "secretas"],
                      ] as const
                    )
                      .map(([t, r]) => `${i.votacoes.filter((v) => v.tipo === t).length} ${r}`)
                      .join(", ")}
                    ; {i.votacoes.filter((v) => v.muda_lei).length} entram no filtro “Só o que muda leis”.
                  </p>
                  {i.observacoes.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {i.observacoes.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  ) : null}
                  <h4 className="mt-3 text-sm font-semibold text-foreground">Fontes</h4>
                  <div className="mt-2">
                    <ListaFontes fontes={i.fontes} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-[var(--cor-secundaria)]">
              Títulos em linguagem simples: manchetes da Agência Câmara e da Agência Senado (órgãos de comunicação das casas),
              apelidos oficiais das proposições ou frases montadas só com campos do documento oficial. Na página de cada votação
              aparecem a origem do título e o texto oficial.
            </p>
          </div>
        </details>
      </Secao>
    </div>
  );
}
