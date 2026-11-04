import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CartaoDecisao, SeloFonte, placarOficial } from "@/components/decisao";
import { Figurinha } from "@/components/marca/Figurinhas";
import { Secao } from "@/components/Secao";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { dadoNorma } from "@/features/estados/apresentacao";
import { contextoGoverno, nomeDiario } from "@/features/estados/contexto";
import { getIndiceEstado, votacoesPlenario } from "@/features/estados/dados";
import { formatarData, nomeProposicao, termosDoEstado } from "@/features/estados/rotulos";
import { DATA_LEVANTAMENTO, UFS, baseUf, caminhoCasa, getUf, nomeCompleto } from "@/features/estados/ufs";
import { Favoritar } from "@/components/reacoes";

export function generateStaticParams() {
  return UFS.map((u) => ({ uf: u.uf }));
}

export async function generateMetadata({ params }: PageProps<"/estados/[uf]">): Promise<Metadata> {
  const { uf } = await params;
  const u = getUf(uf);
  if (!u || u.uf !== uf) return { title: "Estado não encontrado" };
  return {
    title: nomeCompleto(u),
    description: `Votações da ${u.casa.nome}, o voto de cada deputado quando a votação é nominal, projetos e as leis, decretos e vetos do governador, com fonte oficial.`,
    alternates: { canonical: baseUf(u.uf) },
  };
}

export default async function EstadoPage({ params }: PageProps<"/estados/[uf]">) {
  const { uf } = await params;
  const u = getUf(uf);
  if (!u || u.uf !== uf) notFound();
  const ind = getIndiceEstado(u.uf);
  const base = baseUf(u.uf);
  const migalhas = <Migalhas itens={[{ href: "/estados", rotulo: "Estados" }]} />;

  if (!ind) {
    return (
      <div className="space-y-8">
        {migalhas}
        <header className="max-w-3xl">
          <Figurinha nome="mapa" className="heroi-figurinha figurinha-flutua" />
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{nomeCompleto(u)}</h1>
          <Favoritar tipo="uf" valor={u.uf.toUpperCase()} nome="este estado" className="mt-2" />
          <p className="text-lg font-semibold text-foreground">Em breve.</p>
          <p>
            Quando a coleta começar, esta página vai mostrar as votações da {u.casa.nome}, o voto de cada deputado quando a
            votação for nominal, os projetos e as leis, decretos e vetos do governador, sempre com a fonte oficial e a data
            da coleta.
          </p>
        </header>
        <Secao id="o-que-se-sabe" titulo="O que já se sabe da fonte oficial" descricao={`Levantamento das fontes oficiais feito em ${formatarData(DATA_LEVANTAMENTO)}.`}>
          <div className="cartao space-y-3">
            <p>{u.sabido}</p>
            <SeloFonte fonte={{ url: u.casa.portal, titulo: `Site oficial da ${u.casa.nome}`, orgao: u.casa.nome, acessado_em: DATA_LEVANTAMENTO }} />
          </div>
        </Secao>
        <p>
          <Link href="/estados" className="botao">
            Ver todos os estados
          </Link>
        </p>
      </div>
    );
  }

  const plen = votacoesPlenario(u.uf);
  const nComissoes = ind.votacoes.length - plen.length;
  const nTipo = (t: string) => Object.entries(ind.normas.por_ano_tipo).filter(([k]) => k.endsWith(`|${t}`)).reduce((s, [, n]) => s + n, 0);
  const t = termosDoEstado(u);
  const casa = caminhoCasa(u);
  const gov = contextoGoverno(u);
  const atalhos = [
    { href: `${base}/votacoes`, titulo: "Votações", n: ind.votacoes.length, texto: `${plen.length} em Plenário e ${nComissoes} em comissões, com o voto de cada um quando a votação é nominal.` },
    { href: `${base}/deputados`, titulo: u.membros[0].toUpperCase() + u.membros.slice(1), n: ind.deputados.length, texto: "Partido, link oficial e o voto de cada um nas votações nominais." },
    { href: `${base}/projetos`, titulo: "Projetos", n: ind.projetos.total, texto: "Proposições apresentadas na Assembleia, com autoria e última tramitação." },
    {
      href: `${base}/leis-e-decretos`,
      titulo: "Leis, decretos e vetos",
      n: ind.normas.total,
      texto: `${nTipo("Lei") + nTipo("Lei Complementar")} leis, ${nTipo("Decreto")} decretos e ${ind.normas.vetos} vetos publicados no ${nomeDiario(u)}.`,
    },
  ];

  return (
    <div className="space-y-10">
      {migalhas}
      <header className="max-w-3xl">
        <Figurinha nome="mapa" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{nomeCompleto(u)}</h1>
        <Favoritar tipo="uf" valor={u.uf.toUpperCase()} nome="este estado" className="mt-2" />
        <p>
          As leis são votadas pela {u.casa.nome} e depois sancionadas ou vetadas pelo governador, que também decide sozinho,
          por decreto, sem votação. Aqui estão as votações com o voto de cada deputado quando registrado oficialmente, os
          projetos e os atos do governador.
        </p>
        <p className="meta">
          Dados coletados em {formatarData(ind.atualizado_em)}
          {ind.normas.atualizado_em ? `; atos do governador coletados em ${formatarData(ind.normas.atualizado_em)}` : ""}.
        </p>
      </header>

      <nav aria-label={`Dados ${u.de}`}>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {atalhos.map((a) => (
            <li key={a.href}>
              <Link href={a.href} className="bloco-secao flex-col gap-1">
                <span className="font-titulo text-lg font-extrabold text-white-puro">{a.titulo}</span>
                <span className="pilula-numero">
                  <strong className="text-foreground">{a.n.toLocaleString("pt-BR")}</strong> {a.n === 1 ? "item" : "itens"}
                </span>
                <span className="block text-sm text-[var(--cor-texto-apoio)]">{a.texto}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Secao id="plenario-recentes" titulo="Votações mais recentes em Plenário">
          {plen.length ? (
            <ul className="space-y-3">
              {plen.slice(0, 5).map((v) => (
                <CartaoDecisao
                  key={v.id}
                  as="li"
                  href={`${base}/votacoes/${v.id}`}
                  tituloOficial={v.proposicao?.ementa ?? v.descricao ?? "Ementa não disponível em fonte oficial"}
                  subtituloOficial={`${nomeProposicao(v.proposicao?.rotulo, ind.siglas) ?? "Proposição não informada"} · votação em Plenário`}
                  caminho={casa.caminho}
                  rotuloCaminho={casa.rotulo}
                  data={v.data}
                  rotuloData="votado em"
                  forma={v.forma === "nominal" ? "votacao-nominal" : v.forma === "simbolica" ? "votacao-simbolica" : null}
                  dado={
                    v.forma === "simbolica"
                      ? { tipo: "simbolica", resultado: v.resultado }
                      : v.placar
                        ? { tipo: "placar", itens: placarOficial(v.placar.itens), resultado: v.resultado }
                        : { tipo: "texto", rotulo: "Resultado (texto oficial)", texto: v.resultado ?? "Informação não disponível em fonte oficial" }
                  }
                  quemDecidiu={`${u.membros[0].toUpperCase()}${u.membros.slice(1)} (${u.casa.sigla})`}
                  fonte={v.url ? { url: v.url, titulo: "Registro oficial da votação", orgao: u.casa.sigla, acessado_em: v.acessado_em, tipo: /\.pdf($|\?)/i.test(v.url) ? "pdf" : "oficial" } : null}
                />
              ))}
            </ul>
          ) : (
            <p className="lacuna">Nenhuma votação de Plenário coletada.</p>
          )}
          <p className="mt-3">
            <Link href={`${base}/votacoes`} className="botao">
              Ver todas as votações
            </Link>
          </p>
        </Secao>
        <Secao id="atos-recentes" titulo="Atos mais recentes do governador">
          {ind.normas.recentes.length ? (
            <ul className="space-y-3">
              {ind.normas.recentes.map((n) => (
                <CartaoDecisao
                  key={n.id}
                  as="li"
                  href={`${base}/leis-e-decretos#id=${n.id}`}
                  tituloOficial={n.ementa ?? n.titulo ?? `${n.tipo} (título não informado)`}
                  subtituloOficial={n.ementa ? n.titulo : null}
                  caminho={gov.caminho}
                  rotuloCaminho={gov.rotuloCaminho}
                  data={n.data_publicacao}
                  rotuloData="publicado em"
                  forma={n.tipo === "Decreto" || /^Veto/i.test(n.tipo) ? "ato-individual" : null}
                  dado={dadoNorma(n.tipo, gov.governo)}
                  quemDecidiu={n.tipo === "Decreto" || /^Veto/i.test(n.tipo) ? gov.governo : /^Lei/i.test(n.tipo) ? `${u.casa.sigla} (aprovação) e governador (sanção)` : "Conforme o texto oficial publicado no Diário Oficial"}
                  fonte={n.url ? { url: n.url, titulo: `Publicação no ${gov.diario}`, orgao: gov.diario, acessado_em: n.acessado_em ?? ind.normas.atualizado_em } : null}
                />
              ))}
            </ul>
          ) : (
            <p className="lacuna">Nenhum ato do governador coletado.</p>
          )}
          <p className="mt-3">
            <Link href={`${base}/leis-e-decretos`} className="botao">
              Ver todas as leis, decretos e vetos
            </Link>
          </p>
        </Secao>
      </div>

      <TermosRecolhidos termos={[t.casa, t.nominal, t.simbolica, t.comissao, t.veto, t.decreto, t.doe]} />

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={[...(ind.lista_fonte ? [ind.lista_fonte] : []), ...ind.fontes_votacoes, ...ind.fontes_projetos.slice(0, 1), ...ind.normas.fontes]} />
      </Secao>
    </div>
  );
}
