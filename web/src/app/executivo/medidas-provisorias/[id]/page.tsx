import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { lacunasLegiveis } from "@/features/comum/texto";
import { ListaFontes, ListaLacunas, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { ItemVotacao } from "@/features/congresso/componentes/ItemVotacao";
import { CASA_NOME, NAO_DISPONIVEL, TIPO, formatarData } from "@/features/congresso/rotulos";
import { Citacao } from "@/features/executivo/componentes/Dispositivo";
import { getIndiceExecutivo, getMpv, idsOuMarcador } from "@/features/executivo/dados";
import { TERMOS_EXECUTIVO, explicarSigla, rotuloSituacaoMpv } from "@/features/executivo/rotulos";

export function generateStaticParams() {
  return idsOuMarcador(getIndiceExecutivo().mpvs.map((m) => m.id)).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/executivo/medidas-provisorias/[id]">): Promise<Metadata> {
  const { id } = await params;
  const m = getMpv(id);
  if (!m) return { title: "Medida provisória não encontrada" };
  return { title: `Medida Provisória ${m.numero}/${m.ano}`, description: m.ementa?.slice(0, 200) ?? undefined };
}

const LINKS: [string, string][] = [
  ["planalto", "Texto da medida provisória no Planalto"],
  ["planalto_lei", "Texto da lei gerada no Planalto"],
  ["senado", "Tramitação no Senado Federal"],
  ["camara", "Tramitação na Câmara dos Deputados"],
  ["texto_original_senado", "Texto original publicado (Congresso Nacional)"],
];

export default async function MpvPage({ params }: PageProps<"/executivo/medidas-provisorias/[id]">) {
  const { id } = await params;
  const m = getMpv(id);
  if (!m) notFound();

  const ficha: [string, string][] = [
    ["Edição", formatarData(m.datas?.edicao)],
    ["Publicação", formatarData(m.datas?.publicacao)],
    ["Situação", rotuloSituacaoMpv(m.situacao)],
    ["Situação no registro oficial", m.situacao_oficial ?? NAO_DISPONIVEL],
    ["Autoria", m.autoria ?? NAO_DISPONIVEL],
    ["Mensagem ao Congresso", explicarSigla(m.mensagem) ?? NAO_DISPONIVEL],
  ];
  if (m.deliberacao?.tipo) ficha.push(["Deliberação do Congresso", `${m.deliberacao.tipo}${m.deliberacao.data ? ` (${formatarData(m.deliberacao.data)})` : ""}`]);
  if (m.deliberacao?.destino) ficha.push(["Destino após a deliberação", m.deliberacao.destino]);
  if (m.norma_gerada?.descricao) ficha.push(["Norma gerada", m.norma_gerada.descricao]);
  if (m.comissao_mista) ficha.push(["Comissão mista", m.comissao_mista]);

  const em = m.exposicao_motivos;
  const votacoes = m.votacoes ?? [];
  const termos = [
    TERMOS_EXECUTIVO.mpv, TERMOS_EXECUTIVO.exposicao, TERMOS_EXECUTIVO.comissaoMista, TERMOS_EXECUTIVO.plv, TERMOS_EXECUTIVO.perdaEficacia, { termo: TIPO.simbolica.rotulo, explicacao: TIPO.simbolica.explicacao },
    { termo: TIPO.nominal.rotulo, explicacao: TIPO.nominal.explicacao },
  ];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/executivo" className="lk">
            Executivo
          </Link>
          {" › "}
          <Link href="/executivo/medidas-provisorias" className="lk">
            Medidas provisórias
          </Link>
        </nav>
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <span className="selo selo-escuro">Ato individual</span>
          <span className="text-sm font-medium text-gray-900">Medida provisória do Presidente da República</span>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
          Medida Provisória {m.numero}/{m.ano}
        </h1>
        {m.apelido_senado ? <p className="meta mt-1">Nome dado pelo Senado Federal: {m.apelido_senado}</p> : null}
        <p className="mt-3 leading-relaxed text-gray-800">{m.ementa ?? "Ementa não disponível em fonte oficial"}</p>
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {ficha.map(([r, v]) => (
            <div key={r} className="rounded border border-borda bg-superficie px-3 py-2">
              <dt className="meta">{r}</dt>
              <dd className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {LINKS.filter(([k]) => m.links?.[k]).map(([k, r]) => (
            <li key={k}>
              <FonteLink href={m.links![k]!} tipo="oficial">
                {r}
              </FonteLink>
            </li>
          ))}
        </ul>
        <p className="meta mt-2">Dados coletados em {formatarData(m.atualizado_em)}.</p>
      </header>

      <Secao
        id="exposicao"
        titulo="Justificativa oficial: exposição de motivos"
        descricao="Trechos copiados literalmente do documento oficial: o primeiro parágrafo depois da apresentação e, quando existe, o parágrafo sobre relevância e urgência. Nada é resumido; o texto completo está no PDF."
      >
        {em?.url ? (
          <div className="cartao max-w-3xl">
            <p className="text-sm font-semibold text-gray-900">{em.documento ?? "Exposição de motivos"}</p>
            <p className="meta">
              {em.data_texto ?? "Data não informada no texto"}
              {em.paragrafos_total ? ` · ${em.paragrafos_total} parágrafos no documento` : ""}
            </p>
            {(em.trechos ?? []).length ? (
              em.trechos!.map((t, i) => (
                <Citacao key={i} rotulo={t.paragrafo ? `Parágrafo ${t.paragrafo}` : "Trecho"} texto={`${t.texto}${t.truncado ? " […]" : ""}`} />
              ))
            ) : (
              <p className="lacuna mt-3 text-sm">O texto do PDF não pôde ser lido automaticamente; consulte o documento oficial.</p>
            )}
            <p className="mt-3">
              <FonteLink href={em.url} tipo="pdf">
                Exposição de motivos completa (PDF, Presidência da República)
              </FonteLink>
              <span className="meta block">Coletado em {formatarData(em.acessado_em)}</span>
            </p>
          </div>
        ) : (
          <p className="lacuna text-sm">Exposição de motivos não disponível em fonte oficial.</p>
        )}
      </Secao>

      <Secao id="prazos" titulo="Prazos" descricao="Prazos de tramitação registrados pelo Congresso Nacional, com o fundamento legal informado pela fonte.">
        {(m.prazos ?? []).length ? (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {m.prazos!.map((p, i) => (
              <li key={i} className="cartao text-sm">
                <p className="font-semibold text-gray-900">{p.tipo ?? "Prazo"}</p>
                <p className="mt-1 text-gray-800">
                  De {formatarData(p.inicio)} a {formatarData(p.fim)}
                  {p.fase ? ` · ${p.fase}` : ""}
                  {p.prorrogado ? ` · Prorrogado: ${p.prorrogado}` : ""}
                </p>
                {p.fundamento_legal ? <p className="meta mt-1">Fundamento: {p.fundamento_legal}</p> : null}
                {p.colegiado ? <p className="meta">Responsável: {p.colegiado}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="lacuna text-sm">Prazos não disponíveis em fonte oficial.</p>
        )}
      </Secao>

      <Secao
        id="votacoes"
        titulo="Votações no Congresso Nacional"
        descricao="Votações desta medida provisória registradas pela Câmara dos Deputados e pelo Senado Federal. Cada uma leva à página com o placar e, nas nominais, o voto de cada parlamentar."
      >
        {votacoes.length ? (
          <ul className="space-y-3">
            {votacoes.map((v) => (
              <li key={`${v.casa}-${v.votacao_ref}`}>
                <ItemVotacao
                  casa={v.casa}
                  id={v.votacao_ref}
                  data={v.data}
                  tipo={v.tipo}
                  resultado={v.resultado}
                  titulo={`${CASA_NOME[v.casa]}${v.orgao ? ` — ${v.orgao}` : ""}`}
                  descricao={v.descricao}
                  sim={v.placar?.sim}
                  nao={v.placar?.nao}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="lacuna text-sm">Nenhuma votação desta medida provisória consta dos dados coletados da Câmara e do Senado.</p>
        )}
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        <ListaLacunas lacunas={lacunasLegiveis(m.lacunas)} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={m.fontes ?? []} />
      </Secao>
    </div>
  );
}
