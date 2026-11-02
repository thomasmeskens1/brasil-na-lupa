import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { lacunasLegiveis } from "@/features/comum/texto";
import { ListaFontes, ListaLacunas, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { NAO_DISPONIVEL, formatarData } from "@/features/congresso/rotulos";
import { Dispositivo } from "@/features/executivo/componentes/Dispositivo";
import { getIndiceExecutivo, getVeto, idsOuMarcador } from "@/features/executivo/dados";
import {
  SITUACAO_DISPOSITIVO,
  TERMOS_EXECUTIVO,
  URL_CONSTITUICAO,
  explicarSigla,
  rotuloSituacaoFonte,
  rotuloTipoVeto,
} from "@/features/executivo/rotulos";

export function generateStaticParams() {
  return idsOuMarcador(getIndiceExecutivo().vetos.map((v) => v.id)).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/executivo/vetos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const v = getVeto(id);
  if (!v) return { title: "Veto não encontrado" };
  return { title: `Veto ${v.numero}/${v.ano}`, description: v.ementa?.slice(0, 200) ?? undefined };
}

const SEM_SIGNIFICADO =
  "A fonte oficial coletada não informa o que significa votar \"Sim\" ou \"Não\" na votação de cada dispositivo. Os votos aparecem exatamente como registrados pelo Congresso Nacional, sem interpretação.";

export default async function VetoPage({ params }: PageProps<"/executivo/vetos/[id]">) {
  const { id } = await params;
  const v = getVeto(id);
  if (!v) notFound();

  const temVotos = v.dispositivos.some((d) => d.votacao?.votos_ref);
  const ficha: [string, string][] = [
    ["Tipo", rotuloTipoVeto(v.tipo)],
    ["Projeto vetado", explicarSigla(v.materia_vetada?.identificacao) ?? NAO_DISPONIVEL],
    ["Lei (parte sancionada)", v.norma?.descricao ?? NAO_DISPONIVEL],
    ["Mensagem de veto", explicarSigla(v.mensagem?.identificacao) ?? NAO_DISPONIVEL],
    ["Publicação", formatarData(v.datas?.publicacao)],
    ["Recebimento pelo Congresso", formatarData(v.datas?.recebimento_congresso)],
  ];
  if (v.datas?.sobrestamento_pauta) ficha.push(["Início do sobrestamento da pauta", formatarData(v.datas.sobrestamento_pauta)]);
  if (v.situacao_oficial) ficha.push(["Situação no registro oficial", v.situacao_oficial]);
  ficha.push(["Dispositivos vetados", String(v.quantidade_dispositivos_fonte ?? v.dispositivos.length)]);

  const termos = [
    TERMOS_EXECUTIVO.veto,
    TERMOS_EXECUTIVO.vetoTotalParcial,
    TERMOS_EXECUTIVO.dispositivo,
    TERMOS_EXECUTIVO.sessaoConjunta,
    TERMOS_EXECUTIVO.sobrestamento,
    ...(temVotos ? [TERMOS_EXECUTIVO.cedula] : []),
    ...Object.values(SITUACAO_DISPOSITIVO).map((s) => ({ termo: s.rotulo, explicacao: s.explicacao })),
  ];
  const lacunas = [...lacunasLegiveis(v.lacunas), ...(temVotos ? [SEM_SIGNIFICADO] : [])];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <nav aria-label="Você está em" className="meta">
          <Link href="/executivo" className="lk">
            Executivo
          </Link>
          {" › "}
          <Link href="/executivo/vetos" className="lk">
            Vetos
          </Link>
        </nav>
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <span className="selo selo-escuro">Ato individual</span>
          <span className="text-sm font-medium text-gray-900">Veto do Presidente da República; apreciação em sessão conjunta</span>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
          Veto {v.numero}/{v.ano}
          {v.assunto_congresso ? ` — ${v.assunto_congresso}` : ""}
        </h1>
        <p className="mt-3 leading-relaxed text-gray-800">{v.ementa ?? "Ementa não disponível em fonte oficial"}</p>
        {v.materia_vetada?.ementa ? (
          <p className="mt-2 text-sm text-gray-800">
            <span className="font-medium text-gray-900">Ementa do projeto: </span>
            {v.materia_vetada.ementa}
          </p>
        ) : null}
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {ficha.map(([r, valor]) => (
            <div key={r} className="rounded border border-borda bg-superficie px-3 py-2">
              <dt className="meta">{r}</dt>
              <dd className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{valor}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {v.mensagem?.url_planalto ? (
            <li>
              <FonteLink href={v.mensagem.url_planalto} tipo="oficial">
                Mensagem de veto com as razões (Planalto)
              </FonteLink>
            </li>
          ) : null}
          {v.links?.congresso_dispositivos ? (
            <li>
              <FonteLink href={v.links.congresso_dispositivos} tipo="oficial">
                Dispositivos e resultado no Congresso Nacional
              </FonteLink>
            </li>
          ) : null}
          {v.links?.senado ? (
            <li>
              <FonteLink href={v.links.senado} tipo="oficial">
                Tramitação no Senado Federal
              </FonteLink>
            </li>
          ) : null}
        </ul>
        <p className="meta mt-2">Dados coletados em {formatarData(v.atualizado_em)}.</p>
      </header>

      <Secao id="resumo" titulo="Situação dos dispositivos" descricao="Contagem da fonte oficial por situação de cada trecho vetado.">
        <dl className="flex flex-wrap gap-2">
          {Object.entries(v.situacao_dispositivos ?? {}).map(([k, n]) => (
            <div key={k} className="min-w-[7rem] rounded border border-borda bg-superficie px-3 py-2 text-center">
              <dt className="text-xs font-medium text-[#3e4c59]">{rotuloSituacaoFonte(k)}</dt>
              <dd className="text-xl font-bold text-gray-900">{n}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 max-w-3xl text-sm text-gray-800">
          Pela Constituição (artigo 66, §4º), o veto só é derrubado pelo voto da maioria absoluta dos deputados e dos
          senadores, em sessão conjunta.{" "}
          <FonteLink href={URL_CONSTITUICAO} tipo="oficial">
            Constituição Federal
          </FonteLink>
        </p>
        {(v.resultado_pdfs ?? []).length ? (
          <ul className="mt-3 space-y-1">
            {v.resultado_pdfs!.map((p) => (
              <li key={p.url}>
                <FonteLink href={p.url} tipo="pdf">
                  {p.descricao ?? "Resultado oficial da votação"}
                </FonteLink>
              </li>
            ))}
          </ul>
        ) : null}
      </Secao>

      <Secao
        id="dispositivos"
        titulo="Cada dispositivo vetado"
        descricao="Texto vetado e razões do veto copiados literalmente da fonte oficial, na ordem do Congresso Nacional."
      >
        {temVotos ? <p className="aviso mb-4 max-w-3xl text-sm text-gray-900">{SEM_SIGNIFICADO}</p> : null}
        <ol className="space-y-4">
          {v.dispositivos.map((d, i) => (
            <li key={d.codigo}>
              <Dispositivo d={d} ordem={i + 1} />
            </li>
          ))}
        </ol>
      </Secao>

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        <ListaLacunas lacunas={lacunas} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={v.fontes ?? []} />
      </Secao>
    </div>
  );
}
