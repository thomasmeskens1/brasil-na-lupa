import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { tituloFonteLegivel } from "@/features/comum/texto";
import { lacunasLegiveis, textoLegivel } from "@/features/comum/texto";
import { ListaFontes, ListaLacunas, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { NAO_DISPONIVEL, formatarData } from "@/features/congresso/rotulos";
import { Citacao } from "@/features/executivo/componentes/Dispositivo";
import { SessaoJulgamento, conferenciaDaSessao } from "@/features/justica/componentes/JulgamentoStj";
import { getIndiceStj, getMinistrosStj, getTemaStj, getVotosConferidos, idsOuMarcador } from "@/features/justica/dados";
import { COLECOES, ORGAO_STJ, TERMOS_JUSTICA } from "@/features/justica/rotulos";

export function generateStaticParams() {
  return idsOuMarcador(getIndiceStj().com_pagina).map((n) => ({ n }));
}

export async function generateMetadata({ params }: PageProps<"/justica/stj/temas/[n]">): Promise<Metadata> {
  const { n } = await params;
  const t = getIndiceStj().com_pagina.includes(n) ? getTemaStj(n) : null;
  if (!t) return { title: "Tema não encontrado" };
  return { title: `STJ — Tema ${t.numero}`, description: t.questao?.slice(0, 200) ?? undefined };
}

export default async function TemaStjPage({ params }: PageProps<"/justica/stj/temas/[n]">) {
  const { n } = await params;
  const t = getIndiceStj().com_pagina.includes(n) ? getTemaStj(n) : null;
  if (!t) notFound();
  const ind = getIndiceStj();
  const conferidos = getVotosConferidos(t.numero);
  const ministros = getMinistrosStj();
  const sessoes = [...(t.julgamento?.sessoes ?? [])].sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
  const divergencias = (ind.divergencias[t.numero] ?? []).map(textoLegivel);
  const lacunas = [...lacunasLegiveis(t.lacunas), ...lacunasLegiveis(t.julgamento?.lacunas)];

  const ficha: [string, string][] = [
    ["Tipo", t.tipo_precedente ?? NAO_DISPONIVEL],
    ["Situação", t.situacao ?? NAO_DISPONIVEL],
    ["Órgão julgador", t.orgao ?? NAO_DISPONIVEL],
    ["Relator", t.relator?.length ? t.relator.join("; ") : NAO_DISPONIVEL],
    ["Afetação", formatarData(t.datas?.afetacao)],
    ["Julgamento", formatarData(t.datas?.julgamento)],
    ["Publicação do acórdão", formatarData(t.datas?.publicacao)],
    ["Trânsito em julgado", formatarData(t.datas?.transito_em_julgado)],
  ];
  if (t.pagina_oficial?.ramo_do_direito) ficha.push(["Ramo do direito", t.pagina_oficial.ramo_do_direito]);

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

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/justica" className="lk">
            Justiça
          </Link>
          {" › "}
          <Link href="/justica/stj" className="lk">
            Superior Tribunal de Justiça
          </Link>
        </nav>
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <span className="selo selo-escuro">Decisão de órgão colegiado</span>
          {t.colecoes.map((c) => (
            <span key={c} className="selo">
              Coleção {COLECOES[c]?.titulo ?? c}
            </span>
          ))}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
          {t.tipo_precedente ?? "Tema"} {t.numero} do STJ
        </h1>
        <Citacao rotulo="Questão submetida a julgamento (texto oficial)" texto={t.questao} />
        {t.tese ? (
          <Citacao rotulo="Tese firmada (texto oficial)" texto={t.tese} />
        ) : (
          <p className="lacuna mt-3 text-sm">Tese ainda não firmada ou não disponível em fonte oficial.</p>
        )}
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {ficha.map(([r, v]) => (
            <div key={r} className="rounded border border-borda bg-superficie px-3 py-2">
              <dt className="meta">{r}</dt>
              <dd className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
        {t.url_oficial ? (
          <p className="mt-3">
            <FonteLink href={t.url_oficial} tipo="oficial">
              Página oficial do tema no STJ
            </FonteLink>
            {t.pagina_oficial?.verificado_em ? <span className="meta block">conferida em {formatarData(t.pagina_oficial.verificado_em)}</span> : null}
          </p>
        ) : null}
      </header>

      {t.informacoes_complementares || t.delimitacao_julgado || (t.repercussao_geral_stf ?? []).length ? (
        <Secao id="informacoes" titulo="Informações oficiais complementares">
          <div className="max-w-3xl space-y-3 text-sm text-gray-800">
            {t.delimitacao_julgado ? <Citacao rotulo="Delimitação do julgado" texto={t.delimitacao_julgado} /> : null}
            {t.informacoes_complementares ? <Citacao rotulo="Informações complementares" texto={t.informacoes_complementares} /> : null}
            {(t.repercussao_geral_stf ?? []).length ? (
              <div>
                <p className="font-semibold text-gray-900">Tema de repercussão geral do Supremo Tribunal Federal relacionado, segundo o STJ</p>
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
          </div>
        </Secao>
      ) : null}

      <Secao id="processos" titulo="Processos do tema" descricao="Recursos escolhidos pelo tribunal para o julgamento, como registrados nos dados abertos do STJ.">
        {t.processos.length ? (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {t.processos.map((p) => (
              <li key={p.processo} className="cartao text-sm">
                <p className="font-semibold text-gray-900">
                  {p.processo}
                  {p.paradigma ? <span className="meta ml-2 font-normal">(paradigma)</span> : null}
                </p>
                <p className="mt-1 text-gray-800">Relator: {p.relator ?? NAO_DISPONIVEL}</p>
                <p className="text-gray-800">
                  Origem: {p.tribunal_origem ?? NAO_DISPONIVEL}
                  {p.uf_origem ? ` (${p.uf_origem})` : ""}
                </p>
                <p className="meta mt-1">
                  Afetação {formatarData(p.data_afetacao)} · julgamento {formatarData(p.data_julgamento)} · acórdão publicado{" "}
                  {formatarData(p.data_publicacao_acordao)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lacuna text-sm">Processos não disponíveis em fonte oficial.</p>
        )}
      </Secao>

      <Secao
        id="julgamentos"
        titulo="Julgamentos"
        descricao="Sessões encontradas nos espelhos de acórdãos dos dados abertos do STJ, da mais antiga para a mais recente. O voto de cada ministro só aparece depois de conferido contra o texto oficial."
      >
        {sessoes.length ? (
          <ol className="space-y-4">
            {sessoes.map((s, i) => (
              <li key={`${s.processo}-${s.data}-${i}`}>
                <SessaoJulgamento s={s} conferencia={conferenciaDaSessao(s, conferidos)} ministros={ministros} />
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
          <ul className="space-y-2 text-sm text-gray-800">
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

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao
        id="lacunas"
        titulo="O que a fonte oficial não informa ou registra de forma diferente"
        descricao="Divergências entre os arquivos oficiais do STJ aparecem como foram encontradas; o site não escolhe uma versão."
      >
        <ListaLacunas lacunas={[...divergencias, ...lacunas]} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={(t.fontes ?? []).map(tituloFonteLegivel)} />
      </Secao>
    </div>
  );
}
