import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeloFonte } from "@/components/decisao";
import { FotoPolitico } from "@/components/politico/FotoPolitico";
import { Secao } from "@/components/Secao";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { Migalhas, TermosRecolhidos } from "@/features/executivo/componentes/Migalhas";
import { VotosDoDeputado, type LinhaVotoDeputado } from "@/features/estados/componentes/VotosDoDeputado";
import { getDeputado, ouMarcador, ufsComDados, getIndiceEstado, votacoesPlenario, votosDoDeputado } from "@/features/estados/dados";
import { exigirUf, maiuscula } from "@/features/estados/pagina";
import { TERMOS_SP, compararVotos, formatarData, rotuloVoto, termosDoEstado } from "@/features/estados/rotulos";
import { baseUf, getUf } from "@/features/estados/ufs";
import { Favoritar } from "@/components/reacoes";
import { idDeputadoEstadual } from "@/features/conta/ids";
import { ouPrimeiro } from "@/features/comum/prerender";
import { fotoOficial } from "@/features/comum/fotos";

/** No build, só os deputados em exercício; os demais são gerados na primeira visita. */
export function generateStaticParams() {
  const todos = ufsComDados().flatMap((uf) => (getIndiceEstado(uf)?.deputados ?? []).map((d) => ({ uf, id: d.id, em: d.em_exercicio })));
  return ouMarcador(
    // Perfis com a lista de votos são pesados: no build só o primeiro; os demais na primeira visita.
    ouPrimeiro(todos.filter((d) => d.em), todos).slice(0, 1).map(({ uf, id }) => ({ uf, id })),
    { uf: "sem-dados", id: "sem-dados" },
  );
}

/** Id fora do build: a primeira visita espera a página completa (e o 404 do id inexistente). */
export const ensureStatic = "navigation";

export async function generateMetadata({ params }: PageProps<"/estados/[uf]/deputados/[id]">): Promise<Metadata> {
  const { uf, id } = await params;
  const u = getUf(uf);
  const d = u ? getDeputado(u.uf, id) : null;
  if (!u || !d) return { title: "Deputado não encontrado" };
  return {
    title: `${d.nome} (${d.partido ?? "partido não informado"}) — deputado ${u.uf === "df" ? "distrital" : "estadual"} ${u.de}`,
    description: `Votos de ${d.nome} nas votações nominais da ${u.casa.nome}, com fonte oficial.`,
    alternates: { canonical: `${baseUf(u.uf)}/deputados/${id}` },
  };
}

function Contagem({ titulo, itens }: { titulo: string; itens: [string, number][] }) {
  if (!itens.length) return null;
  return (
    <div>
      <h3 className="font-semibold">{titulo}</h3>
      <dl className="mt-2 flex flex-wrap gap-2">
        {itens.map(([k, n]) => (
          <div key={k} className="pilula-numero max-w-full">
            <dt>{rotuloVoto(k)}</dt>
            <dd className="font-bold text-foreground">{n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function DeputadoEstadoPage({ params }: PageProps<"/estados/[uf]/deputados/[id]">) {
  const { uf, id } = await params;
  const { u, ind } = exigirUf(uf);
  const d = getDeputado(u.uf, id);
  if (!d) notFound();
  const base = baseUf(u.uf);
  const votos = votosDoDeputado(u.uf, d.id);
  const nPlen = votacoesPlenario(u.uf).length;
  const contar = (plenario: boolean) => {
    const m = new Map<string, number>();
    for (const v of votos) if (v.votacao.plenario === plenario) m.set(v.voto, (m.get(v.voto) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => compararVotos(a[0], b[0]));
  };
  // Só o Plenário vai no HTML; os votos em comissões vêm do índice estático no navegador.
  const linhas: LinhaVotoDeputado[] = votos
    .filter((x) => x.votacao.plenario)
    .map(({ votacao: v, voto, registros, marcador }) => ({
      id: v.id,
      plenario: true,
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
  const t = termosDoEstado(u);
  const sp = u.uf === "sp";
  const semLegenda = votos.some((v) => v.voto === "---" || v.marcador);
  const termos = [t.nominal, t.obstrucao, t.comissao, t.votoRelator, ...(sp ? [TERMOS_SP.licenciado] : []), ...(semLegenda ? [TERMOS_SP.semLegenda] : [])];
  const cargo = `Deputado ${u.uf === "df" ? "distrital" : "estadual"}`;

  return (
    <div className="space-y-10">
      <Migalhas
        itens={[
          { href: "/estados", rotulo: "Estados" },
          { href: base, rotulo: u.nome },
          { href: `${base}/deputados`, rotulo: maiuscula(u.membros) },
        ]}
      />
      <header>
        {/* Foto só de fonte com permissão de uso declarada (hoje, entre as Assembleias, só a ALESP);
            nas demais, as iniciais no mesmo formato (docs/pesquisa/fotos-licencas.md). */}
        <FotoPolitico nome={d.nome} foto={u.uf === "sp" ? fotoOficial("alesp", d.id) : null} tamanho="g" legenda prioridade className="mb-3" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{d.nome}</h1>
        <Favoritar tipo="politico" valor={idDeputadoEstadual(u.uf, d.id)} nome="este deputado estadual" className="mt-2" />
        <p>
          {cargo} · {u.casa.nome} · partido: <strong className="text-foreground">{d.partido ?? "não informado"}</strong>
          {d.em_exercicio === true ? ` · em exercício na lista oficial de ${formatarData(ind.lista_atualizada_em)}` : ""}
        </p>
        <p>
          Há registro em <strong className="text-foreground">{d.n_plenario}</strong> das {nPlen} votações de Plenário e em{" "}
          <strong className="text-foreground">{d.n_comissao}</strong> deliberações de comissões coletadas.
        </p>
        {d.url_oficial ? <SeloFonte fonte={{ url: d.url_oficial, titulo: `Página oficial na ${u.casa.sigla}`, orgao: u.casa.sigla, acessado_em: ind.lista_atualizada_em }} /> : null}
      </header>

      <Secao id="resumo" titulo="Resumo dos registros" descricao="Votações simbólicas não têm voto individual e não entram nesta conta.">
        {votos.length ? (
          <div className="space-y-4">
            <Contagem titulo="Plenário" itens={contar(true)} />
            <Contagem titulo="Comissões (voto como texto oficial)" itens={contar(false)} />
            {sp ? (
              <p className="text-sm text-[var(--cor-secundaria)]">
                No Plenário, o relatório oficial lista todos os deputados, inclusive licenciados. Nas comissões, só aparecem os
                membros que registraram voto; quando a deliberação reúne mais de uma comissão, a fonte pode registrar o mesmo
                deputado mais de uma vez, e a linha informa quantos registros há.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="lacuna">Nenhum registro em votação nominal coletada.</p>
        )}
      </Secao>

      <Secao id="votos" titulo="Votos nas votações nominais" descricao="As votações de Plenário levam à página com o placar e o registro oficial; as de comissões levam à lista de votações, com os votos de todos os membros.">
        {votos.length ? (
          <VotosDoDeputado uf={u.uf} base={base} pid={d.id} plenario={linhas} nComissao={d.n_comissao} />
        ) : (
          <p className="lacuna">Nenhum voto registrado nas votações nominais coletadas.</p>
        )}
      </Secao>

      <TermosRecolhidos termos={termos} />

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={[...(ind.lista_fonte ? [ind.lista_fonte] : []), ...ind.fontes_votacoes]} />
      </Secao>
    </div>
  );
}
