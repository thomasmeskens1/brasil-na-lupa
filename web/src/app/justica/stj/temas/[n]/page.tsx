import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { metadadosCompartilhamento } from "@/components/compartilhar";
import { CabecalhoDecisao, ItemRecolhivel, formatarData, type ItemFicha } from "@/components/decisao";
import { Termo } from "@/components/glossario";
import { Secao } from "@/components/Secao";
import { AcoesProposta } from "@/components/reacoes";
import { lacunasLegiveis, textoLegivel, tituloFonteLegivel } from "@/features/comum/texto";
import { ListaLacunas } from "@/features/congresso/componentes/Basicos";
import { Citacao } from "@/features/executivo/componentes/Dispositivo";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { QUEM_STJ, resultadoMeritoStj } from "@/features/justica/apresentacao";
import { SessaoJulgamento, conferenciaDaSessao } from "@/features/justica/componentes/JulgamentoStj";
import { getIndiceStj, getMinistrosStj, getTemaStj, getVotosConferidos, idsOuMarcador } from "@/features/justica/dados";
import { cabecalhoTemaStj } from "@/features/justica/detalhes";
import { COLECOES, ORGAO_STJ, TERMOS_JUSTICA } from "@/features/justica/rotulos";
import { idTemaJustica } from "@/features/conta/ids";

export function generateStaticParams() {
  return idsOuMarcador(getIndiceStj().com_pagina).map((n) => ({ n }));
}

function carregar(n: string) {
  return getIndiceStj().com_pagina.includes(n) ? getTemaStj(n) : null;
}

export async function generateMetadata({ params }: PageProps<"/justica/stj/temas/[n]">): Promise<Metadata> {
  const { n } = await params;
  const t = carregar(n);
  if (!t) return { title: "Tema não encontrado" };
  const c = cabecalhoTemaStj(t);
  return metadadosCompartilhamento({
    titulo: c.titulo,
    descricao: [c.subtitulo, "Fonte: Superior Tribunal de Justiça", t.atualizado_em ? `coletado em ${formatarData(t.atualizado_em)}` : null],
    caminho: `/justica/stj/temas/${n}`,
  });
}

export default async function TemaStjPage({ params }: PageProps<"/justica/stj/temas/[n]">) {
  const { n } = await params;
  const t = carregar(n);
  if (!t) notFound();
  const ind = getIndiceStj();
  const c = cabecalhoTemaStj(t);
  const conferidos = getVotosConferidos(t.numero);
  const ministros = getMinistrosStj();
  const sessoes = [...(t.julgamento?.sessoes ?? [])].sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
  const merito = resultadoMeritoStj(sessoes);
  const divergencias = (ind.divergencias[t.numero] ?? []).map(textoLegivel);
  const lacunas = [...divergencias, ...lacunasLegiveis(t.lacunas), ...lacunasLegiveis(t.julgamento?.lacunas)];
  const relator = t.relator?.length ? t.relator.join("; ") : null;

  const ficha: ItemFicha[] = [
    { rotulo: "Tipo", valor: t.tipo_precedente },
    { rotulo: "Situação", valor: t.situacao },
    { rotulo: "Órgão julgador", valor: t.orgao },
    { rotulo: "Relator", valor: relator },
    { rotulo: "Afetação", valor: t.datas?.afetacao ? formatarData(t.datas.afetacao) : null },
    { rotulo: "Julgamento", valor: t.datas?.julgamento ? formatarData(t.datas.julgamento) : null },
    { rotulo: "Publicação do acórdão", valor: t.datas?.publicacao ? formatarData(t.datas.publicacao) : null },
    { rotulo: "Trânsito em julgado", valor: t.datas?.transito_em_julgado ? formatarData(t.datas.transito_em_julgado) : null },
    { rotulo: "Ramo do direito", valor: t.pagina_oficial?.ramo_do_direito },
    { rotulo: "Coleções acompanhadas", valor: t.colecoes.map((x) => COLECOES[x]?.titulo ?? x).join(", ") },
  ];

  const termos = [
    t.tipo_precedente === "Tema de Relevância" ? TERMOS_JUSTICA.relevancia : TERMOS_JUSTICA.repetitivo,
    TERMOS_JUSTICA.tese,
    TERMOS_JUSTICA.afetacao,
    TERMOS_JUSTICA.paradigma,
    TERMOS_JUSTICA.relator,
    TERMOS_JUSTICA.acordao,
    TERMOS_JUSTICA.vencido,
    TERMOS_JUSTICA.votoVista,
    TERMOS_JUSTICA.impedido,
    TERMOS_JUSTICA.ausente,
    TERMOS_JUSTICA.presidente,
    TERMOS_JUSTICA.embargos,
    TERMOS_JUSTICA.secao,
    TERMOS_JUSTICA.transito,
  ];
  const ultimaSessao = sessoes.length - 1;

  return (
    <div className="max-w-3xl space-y-8">
      <Migalhas
        itens={[
          { href: "/justica", rotulo: "Justiça" },
          { href: "/justica/stj", rotulo: "Superior Tribunal de Justiça" },
        ]}
      />
      <CabecalhoDecisao
        tituloOficial={c.tituloOficial}
        simples={c.simples}
        subtituloOficial={c.subtituloOficial}
        caminho="stj"
        data={c.data}
        rotuloData={t.datas?.julgamento ? "julgado em" : "afetado em"}
        forma="julgamento"
        dado={c.dado}
        quemDecidiu={QUEM_STJ(t.orgao, relator)}
        fontePrincipal={c.fontePrincipal}
        url={`/justica/stj/temas/${t.numero}`}
        acoes={<AcoesProposta proposta={idTemaJustica("stj", t.numero)} />}
        atalhos={sessoes.length ? [{ href: "#julgamentos", rotulo: `Julgamentos e votos (${sessoes.length})` }] : undefined}
        textoOficial={t.questao ? { rotulo: "questão submetida a julgamento", texto: t.questao } : null}
        ficha={ficha}
        fontes={(t.fontes ?? []).map(tituloFonteLegivel)}
      >
        {merito ? (
          <p>
            <span className="font-semibold">Resultado do julgamento do mérito, no texto oficial:</span>{" "}
            <span className="italic">“{merito.trecho}”</span>
          </p>
        ) : null}
        <p className="text-[var(--cor-secundaria)]">
          A <Termo termo="Tese">tese</Termo> de um <Termo termo="Recurso repetitivo">tema repetitivo</Termo> deve ser seguida pelos
          demais tribunais em casos iguais.
          {t.situacao === "Trânsito em Julgado" ? (
            <>
              {" "}
              Situação: <Termo termo="Trânsito em julgado">trânsito em julgado</Termo>.
            </>
          ) : null}
        </p>
        {t.delimitacao_julgado || t.informacoes_complementares || (t.repercussao_geral_stf ?? []).length ? (
          <ItemRecolhivel resumo="Informações oficiais complementares">
            {t.delimitacao_julgado ? <Citacao rotulo="Delimitação do julgado" texto={t.delimitacao_julgado} /> : null}
            {t.informacoes_complementares ? <Citacao rotulo="Informações complementares" texto={t.informacoes_complementares} /> : null}
            {(t.repercussao_geral_stf ?? []).length ? (
              <div className="mt-3">
                <p className="font-semibold text-foreground">Tema de repercussão geral do Supremo Tribunal Federal relacionado, segundo o STJ</p>
                <ul className="mt-1 list-disc pl-5">
                  {t.repercussao_geral_stf!.map((r) => (
                    <li key={r.numero}>
                      Tema {r.numero}
                      {r.descricao ? `: ${r.descricao}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </ItemRecolhivel>
        ) : null}
        {t.processos.length ? (
          <ItemRecolhivel resumo={<>Processos do tema ({t.processos.length})</>}>
            <ul className="space-y-3">
              {t.processos.map((p) => (
                <li key={p.processo}>
                  <p className="font-semibold text-foreground">
                    {p.processo}
                    {p.paradigma ? (
                      <span className="font-normal text-[var(--cor-secundaria)]">
                        {" "}
                        (<Termo termo="Processo paradigma">paradigma</Termo>)
                      </span>
                    ) : null}
                  </p>
                  <p>Relator: {p.relator ?? "não informado"}</p>
                  <p>
                    Origem: {p.tribunal_origem ?? "não informada"}
                    {p.uf_origem ? ` (${p.uf_origem})` : ""}
                  </p>
                  <p className="meta">
                    Afetação {formatarData(p.data_afetacao)} · julgamento {formatarData(p.data_julgamento)} · acórdão publicado{" "}
                    {formatarData(p.data_publicacao_acordao)}
                  </p>
                </li>
              ))}
            </ul>
          </ItemRecolhivel>
        ) : null}
      </CabecalhoDecisao>

      <Secao
        id="julgamentos"
        titulo="Julgamentos"
        descricao="Sessões encontradas nos espelhos de acórdãos dos dados abertos do STJ, da mais antiga para a mais recente. O voto de cada ministro só aparece depois de conferido contra o texto oficial."
      >
        {sessoes.length ? (
          <ol className="space-y-2">
            {sessoes.map((s, i) => (
              <li key={`${s.processo}-${s.data}-${i}`}>
                <SessaoJulgamento s={s} conferencia={conferenciaDaSessao(s, conferidos)} ministros={ministros} aberto={i === ultimaSessao && sessoes.length === 1} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="lacuna text-sm">
            {t.julgamento?.aguardando_fonte
              ? "O julgamento ainda não aparece nos arquivos oficiais coletados."
              : "Nenhuma sessão de julgamento deste tema foi encontrada nos arquivos oficiais coletados."}
          </p>
        )}
      </Secao>

      {(t.pautas ?? []).length ? (
        <Secao id="pauta" titulo="Em pauta" descricao="Sessões futuras publicadas na pauta oficial do STJ.">
          <ul className="space-y-2">
            {t.pautas!.map((p, i) => (
              <li key={i} className="cartao">
                {p.processo ?? "Processo não informado"} · sessão de {formatarData(p.data_sessao)} ·{" "}
                {(p.orgao_julgador_sigla && ORGAO_STJ[p.orgao_julgador_sigla]) ?? p.orgao_julgador_sigla ?? "órgão não informado"}
                {p.relator ? ` · relator: ${p.relator}` : ""}
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <TermosRecolhidos termos={termos} />

      <Secao
        id="lacunas"
        titulo="O que a fonte oficial não informa ou registra de forma diferente"
        descricao="Divergências entre os arquivos oficiais do STJ aparecem como foram encontradas; o site não escolhe uma versão."
      >
        <ListaLacunas lacunas={lacunas} />
      </Secao>
    </div>
  );
}
