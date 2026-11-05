import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoDecisao, placarOficial, type DadoChave, type FonteResumo, type ItemFicha } from "@/components/decisao";
import { Secao } from "@/components/Secao";
import { TabelaFiltravel } from "@/components/tabela";
import { lacunasLegiveis } from "@/features/comum/texto";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { NAO_DISPONIVEL, ORDEM_VOTOS, compararVotos, formatarData, lacunaLegivel, rotuloVoto } from "@/features/estados/rotulos";
import { baseCidade, getCidade, getIndiceMunicipios, getVotacaoMun, ouMarcador } from "@/features/municipios/dados";
import { TERMOS_MUNICIPIOS } from "@/features/municipios/termos";
import type { VotacaoMun } from "@/features/municipios/tipos";
import { maisRecentes, ouPrimeiro } from "@/features/comum/prerender";

/** No build, só as votações dos últimos 60 dias (features/comum/prerender); as demais, na primeira visita. */
export function generateStaticParams() {
  const lista = getIndiceMunicipios()
    .presentes.filter((m) => m.tem.votacoes)
    .flatMap((m) => (getCidade(m.uf, m.slug)?.camara?.votacoes ?? []).map((v) => ({ uf: m.uf, cidade: m.slug, id: v.id, data: v.data })));
  return ouMarcador(
    // Votações municipais crescem a cada coleta: no build só as 20 mais recentes; as demais na primeira visita.
    ouPrimeiro(maisRecentes(lista, (v) => v.data, 20), lista).map(({ uf, cidade, id }) => ({ uf, cidade, id })),
    { uf: "xx", cidade: "sem-dados", id: "sem-dados" },
  );
}

/** Id fora do build: a primeira visita espera a página completa (e o 404 do id inexistente). */
export const ensureStatic = "navigation";

function titulo(v: VotacaoMun): string {
  return v.proposicao?.ementa ?? v.descricao ?? "Ementa não disponível em fonte oficial";
}

function identificacao(v: VotacaoMun): string | null {
  const p = v.proposicao;
  return p?.sigla && p.numero != null && p.ano ? `${p.sigla} ${p.numero}/${p.ano}` : null;
}

export async function generateMetadata({ params }: PageProps<"/municipios/[uf]/[cidade]/votacoes/[id]">): Promise<Metadata> {
  const { uf, cidade, id } = await params;
  const c = getCidade(uf, cidade);
  const v = c ? getVotacaoMun(uf, cidade, id) : null;
  if (!c || !v) return { title: "Votação não encontrada" };
  return {
    title: `${titulo(v).slice(0, 90)} — ${c.nome}`,
    description: `Votação na Câmara Municipal de ${c.nome} em ${formatarData(v.data)}, com fonte oficial.`,
    alternates: { canonical: `${baseCidade(c.uf, c.slug)}/votacoes/${v.id}` },
  };
}

export default async function VotacaoMunicipioPage({ params }: PageProps<"/municipios/[uf]/[cidade]/votacoes/[id]">) {
  const { uf, cidade, id } = await params;
  const c = getCidade(uf, cidade);
  const v = c ? getVotacaoMun(uf, cidade, id) : null;
  if (!c || !v) notFound();
  const base = baseCidade(c.uf, c.slug);
  const casa = c.camara?.nome ?? `Câmara Municipal de ${c.nome}`;
  const forma = v.tipo === "nominal" ? "votacao-nominal" : v.tipo === "simbolica" ? "votacao-simbolica" : v.tipo === "secreta" ? "votacao-secreta" : null;
  const pl = v.placar && (v.tipo === "nominal" || v.tipo === "secreta") ? placarOficial(v.placar) : [];
  const dado: DadoChave =
    v.tipo === "simbolica"
      ? { tipo: "simbolica", resultado: v.resultado_oficial }
      : v.tipo === "nominal" && pl.length
        ? { tipo: "placar", itens: pl, resultado: v.resultado_oficial }
        : { tipo: "texto", rotulo: "Resultado (texto oficial)", texto: v.resultado_oficial ?? NAO_DISPONIVEL };
  const fontePrincipal: FonteResumo | null = v.url
    ? { url: v.url, titulo: "Resumo da sessão no SAPL", orgao: casa, acessado_em: v.fonte?.acessado_em ?? null }
    : v.fonte?.url
      ? { url: v.fonte.url, titulo: "Registro de votação no SAPL (dados abertos)", orgao: casa, acessado_em: v.fonte.acessado_em ?? null }
      : null;
  const fontes: FonteResumo[] = [
    ...(fontePrincipal ? [fontePrincipal] : []),
    ...(v.fonte?.url && v.url ? [{ url: v.fonte.url, titulo: "Registro de votação no SAPL (dados abertos)", orgao: casa, acessado_em: v.fonte.acessado_em ?? null }] : []),
    ...(v.fonte_votos?.url ? [{ url: v.fonte_votos.url, titulo: "Votos por vereador no SAPL (dados abertos)", orgao: casa, acessado_em: v.fonte_votos.acessado_em ?? null }] : []),
    ...(v.proposicao?.url ? [{ url: v.proposicao.url, titulo: "Página da proposição", orgao: casa, acessado_em: v.fonte?.acessado_em ?? null }] : []),
  ];
  const ficha: ItemFicha[] = [
    { rotulo: "Data", valor: formatarData(v.data) },
    { rotulo: "Horário", valor: v.hora },
    { rotulo: "Sessão", valor: v.sessao },
    { rotulo: "Etapa da sessão", valor: v.etapa },
    { rotulo: "Tipo de votação", valor: forma ? { "votacao-nominal": "Votação nominal", "votacao-simbolica": "Votação simbólica", "votacao-secreta": "Votação secreta" }[forma] : null },
    { rotulo: "Resultado (texto oficial)", valor: v.resultado_oficial },
    { rotulo: "Resultado registrado na pauta", valor: v.resultado_pauta },
    { rotulo: "Observação oficial", valor: v.observacao_oficial },
    { rotulo: "Item da pauta", valor: v.descricao },
  ];
  const contagem = new Map<string, number>();
  for (const x of v.votos) contagem.set(x.voto ?? "", (contagem.get(x.voto ?? "") ?? 0) + 1);
  const linhas = v.votos.map((x, i) => ({ k: `${i}`, nome: x.nome ?? "Nome ainda em coleta", partido: x.partido ?? "Não informado", voto: rotuloVoto(x.voto) }));
  const lacunas = lacunasLegiveis(v.lacunas).map(lacunaLegivel);
  const termos = TERMOS_MUNICIPIOS.filter((t) => /Votação nominal|Proposição/.test(t.termo));

  return (
    <div className="max-w-3xl space-y-8">
      <Migalhas
        itens={[
          { href: "/municipios", rotulo: "Municípios" },
          { href: base, rotulo: c.nome },
        ]}
      />
      <CabecalhoDecisao
        tituloOficial={titulo(v)}
        subtituloOficial={[identificacao(v) ?? "Proposição não informada", `votação na ${casa} em ${formatarData(v.data)}`].join(" · ")}
        caminho={casa}
        rotuloCaminho={`Câmara de ${c.nome}`}
        data={v.data}
        rotuloData="votado em"
        forma={forma}
        dado={dado}
        quemDecidiu={`Vereadores, no Plenário da ${casa}`}
        fontePrincipal={fontePrincipal}
        url={`${base}/votacoes/${v.id}`}
        atalhos={v.votos.length ? [{ href: "#votos", rotulo: "Como votou cada vereador" }] : []}
        textoOficial={v.proposicao?.ementa ? { rotulo: "Ementa", texto: v.proposicao.ementa } : null}
        ficha={ficha}
        fontes={fontes}
      />

      <Secao id="votos" titulo="Como votou cada vereador">
        {v.tipo !== "nominal" ? (
          <p className="lacuna">
            {v.tipo === "simbolica"
              ? "A votação foi simbólica: a fonte oficial não registra o voto de cada vereador."
              : v.tipo === "secreta"
                ? "A votação foi secreta: os votos não são identificados."
                : "O tipo de votação ainda não foi coletado da pauta da sessão; votos individuais não são exibidos até lá."}
          </p>
        ) : v.votos.length ? (
          <div className="space-y-4">
            {v.conferencia_placar ? (
              <div className="aviso">
                <p className="font-semibold">Como os votos foram conferidos</p>
                <p className="mt-1">{v.conferencia_placar}</p>
              </div>
            ) : null}
            <dl className="flex flex-wrap gap-2" aria-label="Contagem dos votos registrados">
              {[...contagem.entries()]
                .sort((a, b) => compararVotos(a[0], b[0]))
                .map(([k, n]) => (
                  <div key={k} className="pilula-numero">
                    <dt>{rotuloVoto(k)}</dt>
                    <dd className="font-bold text-foreground">{n}</dd>
                  </div>
                ))}
            </dl>
            <TabelaFiltravel
              legenda="Votos individuais, em ordem alfabética"
              chave="k"
              linhas={[...linhas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))}
              colunas={[
                { chave: "nome", rotulo: "Vereador (como na fonte)", principal: true },
                { chave: "partido", rotulo: "Partido na data da votação" },
                { chave: "voto", rotulo: "Voto" },
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
            {v.votos_situacao === "inexistentes-na-fonte" ? `Voto de cada vereador: ${NAO_DISPONIVEL}.` : "Os votos individuais ainda estão em coleta."}
          </p>
        )}
      </Secao>

      {lacunas.length ? (
        <Secao id="lacunas" titulo="O que a fonte não traz">
          <ul className="space-y-2">
            {lacunas.map((l) => (
              <li key={l} className="lacuna text-sm">
                {l}
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <TermosRecolhidos termos={termos} />
    </div>
  );
}
