import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { getIndice, getParlamentar, votosDoParlamentar } from "@/features/congresso/dados";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { GastosCota } from "@/features/congresso/componentes/GastosCota";
import { PresencaDeputado } from "@/features/congresso/componentes/PresencaDeputado";
import { VotosDoParlamentar, type LinhaVotoParlamentar } from "@/features/congresso/componentes/VotosDoParlamentar";
import { cotaDoDeputado, presencaDoDeputado } from "@/features/congresso/dados-camara";
import {
  CASAS,
  CASA_MEMBROS,
  CASA_NOME,
  OPCOES_DE_VOTO,
  TERMOS,
  compararVotos,
  ehCasa,
  formatarData,
  rotuloVoto,
} from "@/features/congresso/rotulos";

/** Perfis de todos os parlamentares da lista oficial e de quem aparece em votação nominal. */
export function generateStaticParams() {
  return CASAS.flatMap((casa) => getIndice(casa).parlamentares.map((p) => ({ casa, id: p.id })));
}

function carregar(casa: string, id: string) {
  if (!ehCasa(casa)) return null;
  const p = getParlamentar(casa, decodeURIComponent(id));
  return p ? { casa, p } : null;
}

export async function generateMetadata({ params }: PageProps<"/congresso/[casa]/parlamentares/[id]">): Promise<Metadata> {
  const { casa, id } = await params;
  const r = carregar(casa, id);
  if (!r) return { title: "Parlamentar não encontrado" };
  return {
    title: `${r.p.nome} (${r.p.partido ?? "sem partido informado"}-${r.p.uf ?? "UF não informada"})`,
    description: `Votos de ${r.p.nome} nas votações nominais do ${CASA_NOME[r.casa]}, com fonte oficial.`,
  };
}

export default async function ParlamentarPage({ params }: PageProps<"/congresso/[casa]/parlamentares/[id]">) {
  const { casa: c, id } = await params;
  const r = carregar(c, id);
  if (!r) notFound();
  const { casa, p } = r;
  const ind = getIndice(casa);
  const m = CASA_MEMBROS[casa];
  const votos = votosDoParlamentar(casa, p.id);
  const nominais = ind.votacoes.filter((v) => v.tipo === "nominal").length;

  const contagem = new Map<string, number>();
  for (const v of votos) {
    const k = v.voto ?? "Registro não informado";
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  const chaves = [...contagem.keys()].sort(compararVotos);
  const deVoto = chaves.filter((k) => OPCOES_DE_VOTO.has(k));
  const outros = chaves.filter((k) => !OPCOES_DE_VOTO.has(k));

  const linhas: LinhaVotoParlamentar[] = votos.map(({ votacao: v, voto }) => ({
    id: v.id,
    data: v.data,
    titulo: v.proposicao?.titulo ?? null,
    descricao: v.descricao,
    voto,
    resultado: v.resultado,
  }));

  const ficha: [string, string][] = [
    ["Partido", p.partido ?? "Não informado"],
    ["Estado (UF)", p.uf ?? "Não informado"],
  ];
  if (p.nome_civil) ficha.push(["Nome civil", p.nome_civil]);
  if (p.bloco) ficha.push(["Bloco parlamentar", p.bloco]);
  if (p.participacao) ficha.push(["Mandato", p.participacao]);
  if (p.email) ficha.push(["E-mail institucional", p.email]);

  const termos = [
    TERMOS.abstencao,
    TERMOS.obstrucao,
    casa === "camara" ? TERMOS.artigo17 : TERMOS.artigo51,
    ...(casa === "camara" ? [TERMOS.sessaoDeliberativa, TERMOS.ceap] : []),
  ];
  const presenca = casa === "camara" ? presencaDoDeputado(p.id) : [];
  const cota = casa === "camara" ? cotaDoDeputado(p.id) : [];

  return (
    <div className="space-y-10">
      <header>
        <nav aria-label="Você está em" className="meta">
          <Link href="/congresso" className="lk">
            Congresso
          </Link>
          {" › "}
          <Link href={m.rota} className="lk">
            {m.plural}
          </Link>
        </nav>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
          {p.foto ? (
            // Foto oficial publicada pela casa (URL da fonte, sem cópia local).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.foto}
              alt={`Foto oficial de ${p.nome}`}
              width={120}
              height={160}
              className="h-40 w-30 shrink-0 rounded border border-borda bg-superficie object-cover"
            />
          ) : null}
          <div className="min-w-0 max-w-3xl">
            <p className="meta">
              {m.singular} · {CASA_NOME[casa]}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">{p.nome}</h1>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {ficha.map(([rot, valor]) => (
                <div key={rot} className="rounded border border-borda bg-superficie px-3 py-2">
                  <dt className="meta">{rot}</dt>
                  <dd className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{valor}</dd>
                </div>
              ))}
            </dl>
            {p.url_oficial ? (
              <p className="mt-3">
                <FonteLink href={p.url_oficial} tipo="oficial">
                  Página oficial {casa === "camara" ? "na Câmara dos Deputados" : "no Senado Federal"}
                </FonteLink>
              </p>
            ) : null}
          </div>
        </div>
        {!p.na_lista_atual ? (
          <div className="aviso mt-4 max-w-3xl text-sm text-gray-900">
            Não consta da lista oficial de {casa === "camara" ? "deputados" : "senadores"} em exercício coletada em{" "}
            {formatarData(ind.lista_atualizada_em)}. Partido e estado acima são os do registro de votação de{" "}
            {formatarData(p.registro_de)}, o mais recente em que aparece. Página oficial e foto não disponíveis nos dados
            coletados.
          </div>
        ) : null}
      </header>

      <Secao
        id="resumo"
        titulo="Resumo dos registros"
        descricao={`Há registro em ${votos.length} das ${nominais} votações nominais coletadas ${
          casa === "camara" ? "da Câmara" : "do Senado"
        }. Votações simbólicas e secretas não têm voto individual e não entram nesta conta.`}
      >
        {votos.length ? (
          <div className="space-y-4">
            {[
              ["Votos", deVoto],
              ["Outros registros oficiais", outros],
            ].map(([rot, ks]) =>
              (ks as string[]).length ? (
                <div key={rot as string}>
                  <h3 className="text-sm font-semibold text-gray-900">{rot as string}</h3>
                  <dl className="mt-2 flex flex-wrap gap-2">
                    {(ks as string[]).map((k) => (
                      <div key={k} className="min-w-[6rem] rounded border border-borda bg-superficie px-3 py-2 text-center">
                        <dt className="text-xs font-medium text-[#3e4c59]">{rotuloVoto(k)}</dt>
                        <dd className="text-xl font-bold text-gray-900">{contagem.get(k)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null,
            )}
            <p className="text-sm text-gray-800">
              {casa === "camara"
                ? "A lista oficial de votos da Câmara traz só quem registrou voto: ausências não aparecem nela e, por isso, não são contadas aqui."
                : "A lista oficial do Senado traz também registros de ausência, licença, missão e presença sem voto, contados acima como publicados."}
            </p>
          </div>
        ) : (
          <p className="lacuna text-sm">Nenhum registro em votação nominal coletada.</p>
        )}
      </Secao>

      <Secao id="votos" titulo="Votos nas votações nominais" descricao="Cada linha leva à página da votação, com o placar e a fonte oficial.">
        {linhas.length ? (
          <VotosDoParlamentar casa={casa} linhas={linhas} legenda={`Votos de ${p.nome} nas votações nominais`} />
        ) : (
          <p className="lacuna text-sm">Nenhum voto registrado nas votações nominais coletadas.</p>
        )}
      </Secao>

      {casa === "camara" ? (
        <>
          <Secao
            id="presenca"
            titulo="Presença em Plenário"
            descricao="Frequência nas sessões deliberativas do Plenário da Câmara dos Deputados, como registrada pela própria Câmara."
          >
            <PresencaDeputado registros={presenca} urlOficial={p.url_oficial} />
          </Secao>

          <Secao
            id="cota"
            titulo="Gastos da cota parlamentar"
            descricao={TERMOS.ceap.explicacao}
          >
            <GastosCota id={p.id} anos={cota} />
          </Secao>
        </>
      ) : null}

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={[...(ind.lista_fonte ? [ind.lista_fonte] : []), ...ind.fontes.filter((f) => /vota/i.test(f.titulo ?? "") || /vota/i.test(f.url))]} />
      </Secao>
    </div>
  );
}
