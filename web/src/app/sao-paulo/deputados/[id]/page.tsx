import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { VotosDoDeputadoSp, type LinhaVotoDeputadoSp } from "@/features/sao-paulo/componentes/VotosDoDeputadoSp";
import { getDeputadoSp, getIndiceSp, idsOuMarcador, votacoesPlenario, votosDoDeputadoSp } from "@/features/sao-paulo/dados";
import { TERMOS_SP, compararVotosSp, formatarDataSp, rotuloVotoSp } from "@/features/sao-paulo/rotulos";

export function generateStaticParams() {
  return idsOuMarcador(getIndiceSp().deputados.map((d) => d.id)).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/sao-paulo/deputados/[id]">): Promise<Metadata> {
  const { id } = await params;
  const d = getDeputadoSp(id);
  if (!d) return { title: "Deputado não encontrado" };
  return {
    title: `${d.nome} (${d.partido ?? "partido não informado"}) — deputado estadual`,
    description: `Votos de ${d.nome} nas votações nominais da Assembleia Legislativa do Estado de São Paulo, com fonte oficial.`,
  };
}

function Contagem({ titulo, itens }: { titulo: string; itens: [string, number][] }) {
  if (!itens.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
      <dl className="mt-2 flex flex-wrap gap-2">
        {itens.map(([k, n]) => (
          <div key={k} className="min-w-[6rem] max-w-full rounded border border-borda bg-superficie px-3 py-2 text-center">
            <dt className="text-xs font-medium text-[var(--cor-secundaria)]">{rotuloVotoSp(k)}</dt>
            <dd className="text-xl font-bold text-gray-900">{n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function DeputadoSpPage({ params }: PageProps<"/sao-paulo/deputados/[id]">) {
  const { id } = await params;
  const d = getDeputadoSp(id);
  if (!d) notFound();
  const ind = getIndiceSp();
  const votos = votosDoDeputadoSp(d.id);
  const nPlen = votacoesPlenario().length;

  const contar = (plenario: boolean) => {
    const m = new Map<string, number>();
    for (const v of votos) if (v.votacao.plenario === plenario) m.set(v.voto, (m.get(v.voto) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => compararVotosSp(a[0], b[0]));
  };
  // Só o Plenário vai no HTML; os votos em comissões (centenas por deputado) vêm do índice estático no navegador.
  const linhas: LinhaVotoDeputadoSp[] = votos.filter((x) => x.votacao.plenario).map(({ votacao: v, voto, registros, marcador }) => ({
    id: v.id,
    plenario: v.plenario,
    data: v.data,
    orgao: v.orgao,
    proposicao: v.proposicao?.rotulo ?? null,
    ementa: v.proposicao?.ementa ?? null,
    descricao: v.descricao,
    resultado: v.resultado,
    voto,
    registros,
    marcador,
  }));
  const temSemLegenda = votos.some((v) => v.voto === "---" || v.marcador);
  const termos = [TERMOS_SP.verificacao, TERMOS_SP.obstrucao, TERMOS_SP.licenciado, TERMOS_SP.comissao, TERMOS_SP.votoRelator, ...(temSemLegenda ? [TERMOS_SP.semLegenda] : [])];

  return (
    <div className="space-y-10">
      <header>
        <nav aria-label="Você está em" className="meta">
          <Link href="/sao-paulo" className="lk">
            São Paulo
          </Link>
          {" › "}
          <Link href="/sao-paulo/deputados" className="lk">
            Deputados estaduais
          </Link>
        </nav>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
          {d.foto ? (
            // Foto do repositório oficial da ALESP (URL da fonte, sem cópia local).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.foto} alt={`Foto oficial de ${d.nome}`} width={120} height={160} className="h-40 w-30 shrink-0 rounded border border-borda bg-superficie object-cover" />
          ) : null}
          <div className="min-w-0 max-w-3xl">
            <p className="meta">Deputado estadual · Assembleia Legislativa do Estado de São Paulo (ALESP)</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">{d.nome}</h1>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div className="rounded border border-borda bg-superficie px-3 py-2">
                <dt className="meta">Partido</dt>
                <dd className="font-semibold text-gray-900">{d.partido ?? "Não informado"}</dd>
              </div>
              <div className="rounded border border-borda bg-superficie px-3 py-2">
                <dt className="meta">Situação na lista oficial de {formatarDataSp(ind.lista_atualizada_em)}</dt>
                <dd className="font-semibold text-gray-900">Em exercício</dd>
              </div>
            </dl>
            {d.url_oficial ? (
              <p className="mt-3">
                <FonteLink href={d.url_oficial} tipo="oficial">
                  Página oficial na ALESP
                </FonteLink>
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <Secao
        id="resumo"
        titulo="Resumo dos registros"
        descricao={`Há registro em ${d.n_plenario} das ${nPlen} votações nominais de Plenário e em ${d.n_comissao} deliberações de comissões coletadas. Votações simbólicas não têm voto individual e não entram nesta conta.`}
      >
        {votos.length ? (
          <div className="space-y-4">
            <Contagem titulo="Plenário" itens={contar(true)} />
            <Contagem titulo="Comissões (voto como texto oficial)" itens={contar(false)} />
            <p className="text-sm text-gray-800">
              No Plenário, o relatório oficial lista todos os deputados, inclusive licenciados. Nas comissões, só aparecem os
              membros que registraram voto; quando a deliberação reúne mais de uma comissão, a fonte pode registrar o mesmo
              deputado mais de uma vez, e a linha informa quantos registros há.
            </p>
          </div>
        ) : (
          <p className="lacuna text-sm">Nenhum registro em votação nominal coletada.</p>
        )}
      </Secao>

      <Secao id="votos" titulo="Votos nas votações nominais" descricao="As votações de Plenário levam à página com o placar e o relatório oficial; as de comissões levam à lista de votações, com os votos de todos os membros.">
        {votos.length ? (
          <VotosDoDeputadoSp pid={d.id} plenario={linhas} nComissao={d.n_comissao} />
        ) : (
          <p className="lacuna text-sm">Nenhum voto registrado nas votações nominais coletadas.</p>
        )}
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={[...(ind.lista_fonte ? [ind.lista_fonte] : []), ...ind.fontes_votacoes]} />
      </Secao>
    </div>
  );
}
