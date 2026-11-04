import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { metadadosCompartilhamento } from "@/components/compartilhar";
import { CabecalhoDecisao, placarOficial, type DadoChave, type FonteResumo, type ItemFicha } from "@/components/decisao";
import { TextoComSiglas } from "@/components/glossario";
import { Secao } from "@/components/Secao";
import { TabelaFiltravel } from "@/components/tabela";
import { lacunasLegiveis } from "@/features/comum/texto";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { getDeputado, getIndiceEstado, getVotacaoPlenario, ouMarcador, ufsComDados, votacoesPlenario } from "@/features/estados/dados";
import { exigirUf, maiuscula } from "@/features/estados/pagina";
import { NAO_DISPONIVEL, ORDEM_VOTOS, TERMOS_SP, VOTO_SEM_LEGENDA, compararVotos, formatarData, lacunaLegivel, nomeProposicao, rotuloVoto, termoSigla, termosDoEstado } from "@/features/estados/rotulos";
import type { VotacaoPlenario } from "@/features/estados/tipos";
import { baseUf, caminhoCasa, getUf, type UfInfo } from "@/features/estados/ufs";
import { AcoesProposta } from "@/components/reacoes";
import { idVotacaoEstado } from "@/features/conta/ids";

/** Só as votações de Plenário têm página; as de comissões ficam na lista de votações. */
export function generateStaticParams() {
  return ouMarcador(
    ufsComDados().flatMap((uf) => votacoesPlenario(uf).map((v) => ({ uf, id: v.id }))),
    { uf: "sem-dados", id: "sem-dados" },
  );
}

function tituloOficial(v: VotacaoPlenario): string {
  return v.proposicao?.ementa ?? v.descricao ?? "Ementa não disponível em fonte oficial";
}

function subtitulo(u: UfInfo, v: VotacaoPlenario, siglas: Record<string, string>): string {
  const p = v.proposicao ? nomeProposicao(`${v.proposicao.sigla} ${v.proposicao.numero}/${v.proposicao.ano}`, siglas) : null;
  return [p ?? "Proposição não informada", `votação em Plenário em ${formatarData(v.data)}`].join(" · ");
}

function forma(v: VotacaoPlenario): "votacao-nominal" | "votacao-simbolica" | "votacao-secreta" | null {
  const t = String(v.tipo ?? "").toLowerCase();
  return t === "nominal" ? "votacao-nominal" : t === "simbolica" ? "votacao-simbolica" : t === "secreta" ? "votacao-secreta" : null;
}

/** Placar oficial: em SP, os totais do rodapé do relatório; nas demais UFs, o placar da fonte. */
function placar(v: VotacaoPlenario): { itens: Record<string, number>; total: number | null } | null {
  const r = v.placar_oficial_relatorio;
  if (r && Object.keys(r).length) {
    const p: Record<string, number | null | undefined> = { sim: r.votos_sim, nao: r.votos_nao, abstencao: r.abstencao, "Em branco": r.em_branco, Presidente: r.presidente };
    const itens = Object.fromEntries(Object.entries(p).filter((e): e is [string, number] => typeof e[1] === "number"));
    return Object.keys(itens).length ? { itens, total: typeof r.total === "number" ? r.total : null } : null;
  }
  const g = v.placar as Record<string, number | null | undefined> | null;
  if (!g) return null;
  const itens = Object.fromEntries(Object.entries(g).filter((e): e is [string, number] => e[0] !== "total" && typeof e[1] === "number"));
  return Object.keys(itens).length ? { itens, total: typeof g.total === "number" ? g.total : null } : null;
}

export async function generateMetadata({ params }: PageProps<"/estados/[uf]/votacoes/[id]">): Promise<Metadata> {
  const { uf, id } = await params;
  const u = getUf(uf);
  const v = u ? getVotacaoPlenario(u.uf, id) : null;
  if (!u || !v) return { title: "Votação não encontrada" };
  const siglas = getIndiceEstado(u.uf)?.siglas ?? {};
  return metadadosCompartilhamento({
    titulo: tituloOficial(v).slice(0, 120),
    descricao: [subtitulo(u, v, siglas), `Fonte: ${u.casa.nome}`, v.fonte?.acessado_em ? `coletado em ${formatarData(v.fonte.acessado_em)}` : null],
    caminho: `${baseUf(u.uf)}/votacoes/${id}`,
  });
}

export default async function VotacaoEstadoPage({ params }: PageProps<"/estados/[uf]/votacoes/[id]">) {
  const { uf, id } = await params;
  const { u, ind } = exigirUf(uf);
  const v = getVotacaoPlenario(u.uf, id);
  if (!v) notFound();
  const base = baseUf(u.uf);
  const sp = u.uf === "sp";
  const f = forma(v);
  const pl = placar(v);
  const resultado = v.resultado_texto_oficial ?? v.resultado ?? null;
  const dado: DadoChave =
    f === "votacao-simbolica"
      ? { tipo: "simbolica", resultado }
      : pl
        ? { tipo: "placar", itens: placarOficial(pl.itens), resultado }
        : { tipo: "texto", rotulo: "Resultado (texto oficial)", texto: resultado ?? NAO_DISPONIVEL };
  const casa = caminhoCasa(u);
  const pdf = !!v.url && /\.pdf($|\?)/i.test(v.url);
  const fontePrincipal: FonteResumo | null = v.url
    ? { url: v.url, titulo: sp ? "Relatório de Verificação de Votação (PDF)" : (v.fonte?.titulo ?? "Registro oficial da votação"), orgao: u.casa.nome, acessado_em: v.fonte?.acessado_em ?? null, tipo: pdf ? "pdf" : "oficial" }
    : null;
  const fontes: FonteResumo[] = [
    ...(fontePrincipal ? [fontePrincipal] : []),
    ...(v.proposicao?.url ? [{ url: v.proposicao.url, titulo: "Página da proposição", orgao: u.casa.nome, acessado_em: v.fonte?.acessado_em ?? null }] : []),
  ];

  const linhas = v.votos.map((x, i) => {
    const pid = x.parlamentar_id && getDeputado(u.uf, String(x.parlamentar_id)) ? String(x.parlamentar_id) : null;
    const obs = [
      x.marcador_relatorio ? `letra ${x.marcador_relatorio} antes do nome (sem legenda no documento)` : null,
      !pid ? (x.parlamentar_id ? "fora da lista atual de deputados; sem perfil" : "como impresso no documento, sem correspondência na lista oficial") : null,
    ]
      .filter(Boolean)
      .join("; ");
    return { k: `${i}`, nome: x.nome, href: pid ? `${base}/deputados/${pid}` : null, partido: x.partido ?? "Não informado", voto: rotuloVoto(x.voto), obs: obs || null };
  });
  const contagem = new Map<string, number>();
  for (const x of v.votos) contagem.set(x.voto, (contagem.get(x.voto) ?? 0) + 1);
  const temSimbolo = contagem.has(VOTO_SEM_LEGENDA) || v.votos.some((x) => x.marcador_relatorio);
  const lacunas = lacunasLegiveis(v.lacunas).map(lacunaLegivel);
  const t = termosDoEstado(u);
  const termos = [t.nominal, t.obstrucao, ...(sp ? [TERMOS_SP.licenciado] : []), ...(temSimbolo ? [TERMOS_SP.semLegenda] : []), ...[termoSigla(t, v.proposicao?.sigla)].filter((x) => !!x)] as { termo: string; explicacao: string }[];
  const ficha: ItemFicha[] = [
    { rotulo: "Data", valor: formatarData(v.data) },
    { rotulo: "Horário", valor: v.hora },
    { rotulo: "Sessão", valor: v.sessao?.titulo },
    { rotulo: "Órgão", valor: v.orgao_nome ?? "Plenário" },
    { rotulo: "Tipo de votação", valor: f === "votacao-nominal" ? (sp ? "Votação nominal (verificação de votação)" : "Votação nominal") : f === "votacao-simbolica" ? "Votação simbólica" : f === "votacao-secreta" ? "Votação secreta" : (v.tipo_texto_oficial ?? null) },
    ...(v.tipo_texto_oficial && f ? [{ rotulo: "Tipo de votação, como escrito na fonte", valor: v.tipo_texto_oficial }] : []),
    { rotulo: "Resultado (texto oficial)", valor: resultado },
    { rotulo: "Descrição oficial", valor: v.descricao ? <TextoComSiglas>{v.descricao}</TextoComSiglas> : null },
    { rotulo: "Texto de abertura da votação", valor: v.descricao_abertura ? <TextoComSiglas>{v.descricao_abertura}</TextoComSiglas> : null },
    { rotulo: "Total do placar oficial", valor: pl?.total != null ? String(pl.total) : null },
    { rotulo: "Partidos em obstrução, como impresso", valor: v.partidos_em_obstrucao },
  ];

  return (
    <div className="max-w-3xl space-y-8">
      <Migalhas
        itens={[
          { href: "/estados", rotulo: "Estados" },
          { href: base, rotulo: u.nome },
          { href: `${base}/votacoes`, rotulo: "Votações" },
        ]}
      />
      <CabecalhoDecisao
          acoes={<AcoesProposta proposta={idVotacaoEstado(u.uf, v.id)} />}
          tituloOficial={tituloOficial(v)}
          subtituloOficial={subtitulo(u, v, ind.siglas)}
          caminho={casa.caminho}
          rotuloCaminho={casa.rotulo}
          data={v.data}
          rotuloData="votado em"
          forma={f}
          dado={dado}
          quemDecidiu={`${maiuscula(u.membros)}, no Plenário da ${u.casa.sigla}`}
          fontePrincipal={fontePrincipal}
          url={`${base}/votacoes/${v.id}`}
          atalhos={[
            ...(v.votos.length ? [{ href: "#votos", rotulo: "Como votou cada deputado" }] : []),
            ...(v.proposicao ? [{ href: "#proposicao", rotulo: "Proposição" }] : []),
          ]}
          textoOficial={v.proposicao?.ementa ? { rotulo: "Ementa", texto: <TextoComSiglas>{v.proposicao.ementa}</TextoComSiglas> } : null}
          ficha={ficha}
          fontes={fontes}
        />

      {typeof v.placar?.obstrucao === "number" && sp ? (
        <p className="text-sm text-[var(--cor-secundaria)]">
          Registros “Obstrução” lidos no relatório: <strong className="text-foreground">{v.placar.obstrucao}</strong>. O rodapé oficial não
          traz esse total; o número é a contagem dos nomes com “Obstrução” impressos no documento.
        </p>
      ) : null}

      <Secao id="votos" titulo="Como votou cada deputado">
        {f !== "votacao-nominal" ? (
          <p className="lacuna">A votação não foi nominal: a fonte oficial não registra o voto de cada deputado.</p>
        ) : v.votos.length ? (
          <div className="space-y-4">
            {v.conferencia_placar ? (
              <div className="aviso">
                <p className="font-semibold">Como os votos foram conferidos</p>
                <p className="mt-1">{v.conferencia_placar}</p>
              </div>
            ) : null}
            <dl className="flex flex-wrap gap-2" aria-label="Contagem dos registros lidos">
              {[...contagem.entries()]
                .sort((a, b) => compararVotos(a[0], b[0]))
                .map(([k, n]) => (
                  <div key={k} className="pilula-numero">
                    <dt>{rotuloVoto(k)}</dt>
                    <dd className="font-bold text-foreground">{n}</dd>
                  </div>
                ))}
            </dl>
            {temSimbolo ? <p className="text-sm text-[var(--cor-secundaria)]">{TERMOS_SP.semLegenda.explicacao}</p> : null}
            <TabelaFiltravel
              legenda="Votos individuais, em ordem alfabética"
              chave="k"
              linhas={[...linhas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))}
              colunas={[
                { chave: "nome", rotulo: "Deputado (como na fonte)", principal: true, link: "href" },
                { chave: "partido", rotulo: "Partido" },
                { chave: "voto", rotulo: "Voto" },
                { chave: "obs", rotulo: "Observação" },
              ]}
              busca={{ chaves: ["nome"], rotulo: "Buscar pelo nome" }}
              filtros={[
                { chave: "voto", rotulo: "Voto", ordem: ORDEM_VOTOS },
                { chave: "partido", rotulo: "Partido" },
              ]}
              itens={{ singular: "voto", plural: "votos" }}
              porPagina={30}
            />
          </div>
        ) : (
          <p className="lacuna">
            Votos individuais não publicados: a leitura do registro oficial não permitiu ligar com segurança cada nome ao seu
            voto. Consulte o documento oficial no link acima.
          </p>
        )}
      </Secao>

      <Secao id="proposicao" titulo="Proposição">
        {v.proposicao ? (
          <div className="cartao space-y-2">
            <p className="text-lg font-semibold">{nomeProposicao(`${v.proposicao.sigla} ${v.proposicao.numero}/${v.proposicao.ano}`, ind.siglas)}</p>
            <p className="leading-relaxed">{v.proposicao.ementa ? <TextoComSiglas>{v.proposicao.ementa}</TextoComSiglas> : "Ementa não disponível em fonte oficial"}</p>
            <ul className="flex flex-wrap gap-x-4">
              <li>
                <Link href={`${base}/projetos#id=${v.proposicao.id}`} prefetch={false} className="lk inline-flex min-h-11 items-center">
                  Ver na lista de projetos
                </Link>
              </li>
              <li>
                <Link href={`${base}/votacoes#p=${v.proposicao.id}`} prefetch={false} className="lk inline-flex min-h-11 items-center">
                  Outras votações sobre esta proposição
                </Link>
              </li>
            </ul>
          </div>
        ) : (
          <p className="lacuna">O registro oficial não vincula esta votação a uma proposição.</p>
        )}
      </Secao>

      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        {lacunas.length ? (
          <ul className="space-y-2">
            {lacunas.map((l) => (
              <li key={l} className="lacuna">
                {l}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma lacuna registrada pela coleta.</p>
        )}
      </Secao>

      <TermosRecolhidos termos={termos} />
    </div>
  );
}
