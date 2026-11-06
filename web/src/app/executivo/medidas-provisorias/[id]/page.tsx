import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { metadadosCompartilhamento } from "@/components/compartilhar";
import { CabecalhoDecisao, CartaoDecisao, ItemRecolhivel, formatarData, placarOficial, type ItemFicha } from "@/components/decisao";
import { Termo } from "@/components/glossario";
import { Secao } from "@/components/Secao";
import { lacunasLegiveis } from "@/features/comum/texto";
import { ListaLacunas } from "@/features/congresso/componentes/Basicos";
import { CASA_NOME, TIPO, rotaVotacao } from "@/features/congresso/rotulos";
import { QUEM_MPV, encurtar } from "@/features/executivo/apresentacao";
import { Citacao } from "@/features/executivo/componentes/Dispositivo";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { getMpv, idsMpvNoBuild } from "@/features/executivo/dados";
import { cabecalhoMpv } from "@/features/executivo/detalhes";
import { TERMOS_EXECUTIVO, explicarSigla, rotuloSituacaoMpv } from "@/features/executivo/rotulos";
import { BlocoParticipacao } from "@/features/participacao/BlocoParticipacao";
import { FaleComParlamentares } from "@/features/participacao/FaleComParlamentares";
import { AcoesProposta } from "@/components/reacoes";
import { idExecutivo } from "@/features/conta/ids";

export function generateStaticParams() {
  return idsMpvNoBuild().map((id) => ({ id }));
}

/** Id fora do build: a primeira visita espera a página completa (e o 404 do id inexistente). */
export const ensureStatic = "navigation";

export async function generateMetadata({ params }: PageProps<"/executivo/medidas-provisorias/[id]">): Promise<Metadata> {
  const { id } = await params;
  const m = getMpv(id);
  if (!m) return { title: "Medida provisória não encontrada" };
  const c = cabecalhoMpv(m);
  return metadadosCompartilhamento({
    titulo: c.titulo,
    descricao: [c.subtitulo, rotuloSituacaoMpv(m.situacao), "Fonte: Presidência da República e Congresso Nacional", m.atualizado_em ? `coletado em ${formatarData(m.atualizado_em)}` : null],
    caminho: `/executivo/medidas-provisorias/${id}`,
  });
}

const LINKS: [string, string, string][] = [
  ["planalto", "Texto da medida provisória", "Presidência da República (Planalto)"],
  ["planalto_lei", "Texto da lei gerada", "Presidência da República (Planalto)"],
  ["senado", "Tramitação no Senado Federal", "Senado Federal"],
  ["camara", "Tramitação na Câmara dos Deputados", "Câmara dos Deputados"],
  ["texto_original_senado", "Texto original publicado", "Congresso Nacional"],
];

export default async function MpvPage({ params }: PageProps<"/executivo/medidas-provisorias/[id]">) {
  const { id } = await params;
  const m = getMpv(id);
  if (!m) notFound();

  const c = cabecalhoMpv(m);
  const em = m.exposicao_motivos;
  const votacoes = [...(m.votacoes ?? [])].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  const prazos = m.prazos ?? [];
  const ficha: ItemFicha[] = [
    { rotulo: "Edição", valor: m.datas?.edicao ? formatarData(m.datas.edicao) : null },
    { rotulo: "Publicação", valor: m.datas?.publicacao ? formatarData(m.datas.publicacao) : null },
    { rotulo: "Situação", valor: rotuloSituacaoMpv(m.situacao) },
    { rotulo: "Situação no registro oficial", valor: m.situacao_oficial },
    { rotulo: "Autoria", valor: m.autoria },
    { rotulo: "Mensagem ao Congresso", valor: explicarSigla(m.mensagem) },
    ...(m.deliberacao?.tipo
      ? [{ rotulo: "Deliberação do Congresso", valor: `${m.deliberacao.tipo}${m.deliberacao.data ? ` (${formatarData(m.deliberacao.data)})` : ""}` }]
      : []),
    ...(m.deliberacao?.destino ? [{ rotulo: "Destino após a deliberação", valor: m.deliberacao.destino }] : []),
    ...(m.norma_gerada?.descricao ? [{ rotulo: "Norma gerada", valor: m.norma_gerada.descricao }] : []),
    ...(m.comissao_mista ? [{ rotulo: "Comissão mista", valor: m.comissao_mista }] : []),
  ];
  const fontes = [
    ...LINKS.filter(([k]) => m.links?.[k] && k !== "planalto").map(([k, titulo, orgao]) => ({ url: m.links![k]!, titulo, orgao, acessado_em: m.atualizado_em })),
    ...(em?.url ? [{ url: em.url, titulo: "Exposição de motivos completa", orgao: "Presidência da República", tipo: "pdf" as const, acessado_em: em.acessado_em }] : []),
    ...c.fontes,
  ];
  const termos = [
    TERMOS_EXECUTIVO.mpv,
    TERMOS_EXECUTIVO.exposicao,
    TERMOS_EXECUTIVO.comissaoMista,
    TERMOS_EXECUTIVO.plv,
    TERMOS_EXECUTIVO.perdaEficacia,
    { termo: TIPO.simbolica.rotulo, explicacao: TIPO.simbolica.explicacao },
    { termo: TIPO.nominal.rotulo, explicacao: TIPO.nominal.explicacao },
  ];
  const atalhos = [
    ...(em?.url ? [{ href: "#exposicao", rotulo: "Justificativa oficial" }] : []),
    ...(votacoes.length ? [{ href: "#votacoes", rotulo: `Votações no Congresso (${votacoes.length})` }] : []),
  ];

  return (
    <div className="max-w-3xl space-y-8">
      <Migalhas
        itens={[
          { href: "/executivo", rotulo: "Executivo" },
          { href: "/executivo/medidas-provisorias", rotulo: "Medidas provisórias" },
        ]}
      />
      <CabecalhoDecisao
        acoes={<AcoesProposta proposta={idExecutivo(m.id)} />}
        tituloOficial={c.tituloOficial}
        simples={c.simples}
        subtituloOficial={c.subtituloOficial}
        caminho="presidencia"
        data={c.data}
        rotuloData="publicada em"
        forma="ato-individual"
        dado={c.dado}
        quemDecidiu={QUEM_MPV}
        fontePrincipal={c.fontePrincipal}
        url={`/executivo/medidas-provisorias/${m.id}`}
        atalhos={atalhos}
        textoOficial={m.ementa ? { rotulo: "ementa", texto: m.ementa } : null}
        ficha={ficha}
        fontes={fontes}
      >
        <p>
          A <Termo termo="Medida provisória">medida provisória</Termo> vale desde a publicação, sem votação. Depois, o Congresso
          Nacional decide se a transforma em lei, com ou sem mudanças.
          {m.apelido_senado ? ` Nome dado pelo Senado Federal: ${m.apelido_senado}.` : ""}
        </p>
        <div id="exposicao" className="scroll-mt-20">
          {em?.url ? (
            <ItemRecolhivel
              resumo={
                <>
                  Justificativa oficial: <Termo termo="Exposição de motivos">exposição de motivos</Termo>
                  <span className="block text-sm font-normal text-[var(--cor-secundaria)]">
                    {em.documento ?? "Documento oficial"}
                    {em.data_texto ? ` · ${em.data_texto}` : ""}
                  </span>
                </>
              }
            >
              <p className="text-sm text-[var(--cor-secundaria)]">
                Trechos copiados literalmente do documento: o primeiro parágrafo depois da apresentação e, quando existe, o parágrafo
                sobre relevância e urgência
                {em.paragrafos_total ? ` (o documento tem ${em.paragrafos_total} parágrafos)` : ""}. Nada é resumido.
              </p>
              {(em.trechos ?? []).length ? (
                em.trechos!.map((t, i) => (
                  <Citacao key={i} rotulo={t.paragrafo ? `Parágrafo ${t.paragrafo}` : "Trecho"} texto={`${t.texto}${t.truncado ? " […]" : ""}`} />
                ))
              ) : (
                <p className="lacuna mt-3 text-sm">O texto do PDF não pôde ser lido automaticamente; consulte o documento oficial.</p>
              )}
              <p className="mt-3">
                <a href={em.url} className="lk inline-flex min-h-11 items-center text-sm" target="_blank" rel="noopener noreferrer">
                  <span className="tag-fonte mr-1.5">PDF oficial</span> Exposição de motivos completa (Presidência da República)
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
                <span className="meta block">coletado em {formatarData(em.acessado_em)}</span>
              </p>
            </ItemRecolhivel>
          ) : (
            <p className="lacuna text-sm">Exposição de motivos não disponível em fonte oficial.</p>
          )}
        </div>
        {prazos.length ? (
          <ItemRecolhivel resumo={<>Prazos de tramitação ({prazos.length})</>}>
            <ul className="space-y-3">
              {prazos.map((p, i) => (
                <li key={i}>
                  <p className="font-semibold text-foreground">{p.tipo ?? "Prazo"}</p>
                  <p>
                    De {formatarData(p.inicio)} a {formatarData(p.fim)}
                    {p.fase ? ` · ${p.fase}` : ""}
                    {p.prorrogado ? ` · Prorrogado: ${p.prorrogado}` : ""}
                  </p>
                  {p.fundamento_legal ? <p className="meta">Fundamento: {p.fundamento_legal}</p> : null}
                  {p.colegiado ? <p className="meta">Responsável: {p.colegiado}</p> : null}
                </li>
              ))}
            </ul>
          </ItemRecolhivel>
        ) : null}
      </CabecalhoDecisao>

      <Secao
        id="votacoes"
        titulo="Votações no Congresso Nacional"
        descricao="Votações desta medida provisória registradas pela Câmara dos Deputados e pelo Senado Federal, da mais recente para a mais antiga."
      >
        {votacoes.length ? (
          <ul className="space-y-3">
            {votacoes.map((v) => {
              const nominal = v.tipo === "nominal";
              const placar = nominal && v.placar ? placarOficial({ ...v.placar }) : [];
              return (
                <CartaoDecisao
                  key={`${v.casa}-${v.votacao_ref}`}
                  as="li"
                  href={rotaVotacao(v.casa, v.votacao_ref)}
                  tituloOficial={encurtar(v.descricao, 140) ?? `Votação na ${CASA_NOME[v.casa]}`}
                  subtituloOficial={`${CASA_NOME[v.casa]}${v.orgao ? ` · ${v.orgao}` : ""}`}
                  caminho={v.casa}
                  data={v.data}
                  forma={nominal ? "votacao-nominal" : v.tipo === "simbolica" ? "votacao-simbolica" : null}
                  dado={
                    nominal
                      ? { tipo: "placar", itens: placar, resultado: v.resultado }
                      : v.tipo === "simbolica"
                        ? { tipo: "simbolica", resultado: v.resultado }
                        : v.resultado
                          ? { tipo: "texto", rotulo: "Resultado", texto: v.resultado }
                          : null
                  }
                  quemDecidiu={v.casa === "camara" ? "Deputados federais" : "Senadores"}
                  compartilhar={false}
                />
              );
            })}
          </ul>
        ) : (
          <p className="lacuna text-sm">Nenhuma votação desta medida provisória consta dos dados coletados da Câmara e do Senado.</p>
        )}
      </Secao>

      <BlocoParticipacao senado={m.ids_oficiais?.senado_materia} camara={m.ids_oficiais?.camara_proposicao} />

      <FaleComParlamentares casas={["camara", "senado"]} assunto={m.identificacao ?? `a MPV ${m.numero}/${m.ano}`} />

      <TermosRecolhidos termos={termos} />

      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        <ListaLacunas lacunas={lacunasLegiveis(m.lacunas)} />
      </Secao>
    </div>
  );
}
