import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados, type Termo } from "@/features/congresso/componentes/Basicos";
import { TabelaVotosPlenario, type LinhaVotoPlenario } from "@/features/sao-paulo/componentes/TabelaVotosPlenario";
import { getDeputadoSp, getVotacaoPlenario, idsOuMarcador, votacoesPlenario } from "@/features/sao-paulo/dados";
import { TERMOS_SP, VOTO_SEM_LEGENDA, compararVotosSp, formatarDataSp, lacunaLegivelSp, nomeSiglaSp, rotuloVotoSp } from "@/features/sao-paulo/rotulos";
import type { VotacaoPlenarioSp } from "@/features/sao-paulo/tipos";

/** Só as votações de Plenário têm página (poucas e com relatório próprio); as de comissões ficam na lista. */
export function generateStaticParams() {
  return idsOuMarcador(votacoesPlenario().map((v) => v.id)).map((id) => ({ id }));
}

function titulo(v: VotacaoPlenarioSp): string {
  const p = v.proposicao ? `${v.proposicao.sigla} ${v.proposicao.numero}/${v.proposicao.ano}` : (v.descricao ?? "Plenário");
  return `Votação: ${p} em ${formatarDataSp(v.data)}`;
}

export async function generateMetadata({ params }: PageProps<"/sao-paulo/votacoes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const v = getVotacaoPlenario(id);
  if (!v) return { title: "Votação não encontrada" };
  return { title: `${titulo(v)} (ALESP)`, description: v.proposicao?.ementa?.slice(0, 200) ?? v.descricao ?? undefined };
}

const PLACAR: [keyof NonNullable<VotacaoPlenarioSp["placar_oficial_relatorio"]>, string][] = [
  ["votos_sim", "Votos Sim"],
  ["votos_nao", "Votos Não"],
  ["abstencao", "Abstenção"],
  ["em_branco", "Em Branco"],
  ["presidente", "Presidente"],
  ["total", "Total"],
];

function Caixa({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="min-w-[5.5rem] rounded border border-borda bg-superficie px-3 py-2 text-center">
      <dt className="text-xs font-medium text-[#3e4c59]">{rotulo}</dt>
      <dd className="text-xl font-bold text-gray-900">{valor}</dd>
    </div>
  );
}

export default async function VotacaoSpPage({ params }: PageProps<"/sao-paulo/votacoes/[id]">) {
  const { id } = await params;
  const v = getVotacaoPlenario(id);
  if (!v) notFound();

  const rel = v.placar_oficial_relatorio;
  const itensPlacar = rel ? PLACAR.filter(([k]) => typeof rel[k] === "number") : [];
  const linhas: LinhaVotoPlenario[] = v.votos.map((x) => ({
    nome: x.nome,
    partido: x.partido ?? null,
    voto: x.voto,
    marcador: x.marcador_relatorio ?? null,
    pid: x.parlamentar_id && getDeputadoSp(String(x.parlamentar_id)) ? String(x.parlamentar_id) : null,
    semCorrespondencia: !x.parlamentar_id,
  }));
  const contagem = new Map<string, number>();
  for (const x of v.votos) contagem.set(x.voto, (contagem.get(x.voto) ?? 0) + 1);
  const marcadores = [...new Set(v.votos.map((x) => x.marcador_relatorio).filter((m): m is string => !!m))].sort();
  const temTraco = contagem.has(VOTO_SEM_LEGENDA);
  const semLink = linhas.filter((l) => l.semCorrespondencia).length;
  const foraDaLista = linhas.filter((l) => !l.pid && !l.semCorrespondencia).length;
  const ficha: [string, string][] = [
    ["Data", formatarDataSp(v.data)],
    ["Horário", v.hora ?? "Informação não disponível em fonte oficial"],
    ["Sessão", v.sessao?.titulo ?? "Informação não disponível em fonte oficial"],
    ["Órgão", v.orgao_nome ?? "Plenário"],
    ["Tipo de votação", "Votação nominal (verificação de votação)"],
    ["Resultado (texto oficial)", v.resultado_texto_oficial ?? "Informação não disponível em fonte oficial"],
  ];
  const termos: Termo[] = [TERMOS_SP.verificacao, TERMOS_SP.obstrucao, TERMOS_SP.licenciado, ...(temTraco || marcadores.length ? [TERMOS_SP.semLegenda] : [])];
  if (v.proposicao?.sigla === "PL") termos.push(TERMOS_SP.pl);
  if (v.proposicao?.sigla === "PLC") termos.push(TERMOS_SP.plc);
  if (v.proposicao?.sigla === "PEC") termos.push(TERMOS_SP.pec);
  if (v.proposicao?.sigla === "PDL") termos.push(TERMOS_SP.pdl);
  if (v.proposicao?.sigla === "PR") termos.push(TERMOS_SP.pr);

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/sao-paulo" className="lk">
            São Paulo
          </Link>
          {" › "}
          <Link href="/sao-paulo/votacoes" className="lk">
            Votações
          </Link>
        </nav>
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <span className="selo selo-escuro">Votação nominal</span>
          <span className="text-sm font-medium text-gray-900">Assembleia Legislativa do Estado de São Paulo (ALESP)</span>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">{titulo(v)}</h1>
        <p className="mt-2 text-sm text-gray-800">{TERMOS_SP.verificacao.explicacao}</p>
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {ficha.map(([r, valor]) => (
            <div key={r} className="rounded border border-borda bg-superficie px-3 py-2">
              <dt className="meta">{r}</dt>
              <dd className="font-semibold text-gray-900">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="meta mt-3">
          Fonte: Relatório de Verificação de Votação da ALESP (PDF); coletado em {formatarDataSp(v.fonte?.acessado_em)}.{" "}
          {v.url ? (
            <FonteLink href={v.url} tipo="pdf" className="text-xs">
              Relatório oficial
            </FonteLink>
          ) : null}
        </p>
      </header>

      <Secao id="o-que-foi-votado" titulo="O que foi votado" descricao="Textos impressos no relatório oficial.">
        <div className="space-y-3">
          {v.descricao_abertura ? (
            <div>
              <p className="meta">Texto de abertura da votação</p>
              <p className="mt-1 text-gray-900">{v.descricao_abertura}</p>
            </div>
          ) : null}
          <div>
            <p className="meta">Descrição</p>
            <p className="mt-1 text-gray-900">{v.descricao ?? "Descrição não disponível em fonte oficial"}</p>
          </div>
        </div>
      </Secao>

      <Secao id="proposicao" titulo="Proposição">
        {v.proposicao ? (
          <div className="cartao">
            <p className="text-base font-semibold text-gray-900">
              {v.proposicao.sigla} {v.proposicao.numero}/{v.proposicao.ano}
            </p>
            <p className="meta mt-1">{nomeSiglaSp(v.proposicao.sigla)}</p>
            <p className="meta mt-3">Ementa (resumo oficial do assunto)</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-800">{v.proposicao.ementa ?? "Ementa não disponível em fonte oficial"}</p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {v.proposicao.url ? (
                <FonteLink href={v.proposicao.url} tipo="oficial">
                  Página da proposição na ALESP
                </FonteLink>
              ) : null}
              <Link href={`/sao-paulo/projetos#id=${v.proposicao.id}`} prefetch={false} className="lk text-sm">
                Ver na lista de projetos
              </Link>
              <Link href={`/sao-paulo/votacoes#p=${v.proposicao.id}`} prefetch={false} className="lk text-sm">
                Outras votações sobre esta proposição
              </Link>
            </p>
          </div>
        ) : (
          <p className="lacuna text-sm">O relatório não vincula esta votação a uma proposição.</p>
        )}
      </Secao>

      <Secao id="placar" titulo="Placar oficial" descricao="Totais impressos no rodapé do relatório oficial, como publicados.">
        {itensPlacar.length ? (
          <div className="space-y-3">
            <dl className="flex flex-wrap gap-2" aria-label="Placar oficial do relatório">
              {itensPlacar.map(([k, r]) => (
                <Caixa key={k} rotulo={r} valor={rel![k] as number} />
              ))}
            </dl>
            {typeof v.placar?.obstrucao === "number" ? (
              <p className="text-sm text-gray-800">
                Registros “Obstrução” lidos no relatório: <strong>{v.placar.obstrucao}</strong>. O rodapé oficial não traz esse
                total; o número é a contagem dos nomes com “Obstrução” impressos no documento.
              </p>
            ) : null}
            {v.partidos_em_obstrucao ? (
              <p className="text-sm text-gray-800">
                <span className="font-medium">Partidos em obstrução, como impresso no relatório: </span>
                {v.partidos_em_obstrucao}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="lacuna text-sm">Placar não lido do relatório oficial; consulte o documento no link acima.</p>
        )}
      </Secao>

      <Secao id="votos" titulo="Votos individuais">
        {v.votos.length ? (
          <div className="space-y-4">
            <div className="aviso text-sm text-gray-900">
              <p className="font-semibold">Como os votos foram conferidos</p>
              <p className="mt-1">
                O relatório oficial é um PDF. Os votos foram lidos do documento e só são publicados quando a contagem confere
                com os totais do rodapé e cada nome tem a mesma cor de impressão do seu voto.
                {v.conferencia_placar ? ` Nesta votação: ${v.conferencia_placar}` : ""}
              </p>
            </div>
            <dl className="flex flex-wrap gap-2" aria-label="Contagem dos registros lidos">
              {[...contagem.entries()]
                .sort((a, b) => compararVotosSp(a[0], b[0]))
                .map(([k, n]) => (
                  <Caixa key={k} rotulo={rotuloVotoSp(k)} valor={n} />
                ))}
            </dl>
            {temTraco || marcadores.length ? (
              <p className="text-sm text-gray-800">
                {temTraco ? "“---” aparece no lugar do voto de alguns deputados. " : ""}
                {marcadores.length ? `As letras ${marcadores.join(", ")} aparecem antes de alguns nomes. ` : ""}
                O relatório não traz legenda para esses símbolos: eles são reproduzidos como impressos, sem legenda no
                documento, e o site não lhes atribui significado.
              </p>
            ) : null}
            {semLink ? (
              <p className="text-sm text-gray-800">
                {semLink === 1 ? "1 nome aparece" : `${semLink} nomes aparecem`} como impressos no relatório, sem
                correspondência exata na lista oficial de deputados; ficam sem link para perfil.
              </p>
            ) : null}
            {foraDaLista ? (
              <p className="text-sm text-gray-800">
                {foraDaLista === 1 ? "1 deputado identificado" : `${foraDaLista} deputados identificados`} pela ALESP não{" "}
                {foraDaLista === 1 ? "consta" : "constam"} da lista atual de em exercício e {foraDaLista === 1 ? "fica" : "ficam"} sem
                página de perfil.
              </p>
            ) : null}
            <TabelaVotosPlenario linhas={linhas} />
          </div>
        ) : (
          <p className="lacuna text-sm">
            Votos individuais não publicados: a leitura do relatório oficial não permitiu ligar com segurança cada nome ao
            seu voto. Consulte o documento oficial no link acima.
          </p>
        )}
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        {v.lacunas?.length ? (
          <ul className="space-y-2">
            {v.lacunas.map((l) => (
              <li key={l} className="lacuna text-sm">
                {lacunaLegivelSp(l)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-800">Nenhuma lacuna registrada pela coleta.</p>
        )}
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={v.fonte ? [v.fonte] : []} />
      </Secao>
    </div>
  );
}
