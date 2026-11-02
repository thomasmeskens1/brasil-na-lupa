import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";
import { lacunasLegiveis, tituloFonteLegivel } from "@/features/comum/texto";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { formatarData } from "@/features/congresso/rotulos";
import { Citacao } from "@/features/executivo/componentes/Dispositivo";
import type { JulgamentoStf, VotacaoStf } from "../tipos";
import { rotuloEtapa, rotuloResultadoJulgamento } from "../rotulos";

/** Votos individuais só de fonte estruturada (Plenário Virtual) ou conferidos; "pendente" nunca. */
const EXIBIVEIS = new Set(["automatico-estruturado", "conferido"]);

export function ambienteStf(j: JulgamentoStf): string | null {
  return typeof j.sessao === "string" ? j.sessao : (j.sessao?.ambiente ?? null);
}

export function tituloJulgamentoStf(j: JulgamentoStf): string {
  return j.processo?.identificacao ?? ([j.processo?.classe, j.processo?.numero].filter(Boolean).join(" ") || "Processo não informado");
}

function nomes(l: VotacaoStf["ausentes"]): string[] {
  return (l ?? [])
    .map((x) => (typeof x === "string" ? x : `${x.nome}${x.motivo_texto ? ` (no texto oficial: “${x.motivo_texto}”)` : ""}`))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Parte da certidão: resultado e nomes escritos no texto oficial. */
function ParteCertidao({ v }: { v: VotacaoStf }) {
  const grupos: [string, string[]][] = [
    ["Vencidos", nomes(v.vencidos)],
    ["Impedidos", nomes(v.impedidos)],
    ["Não votaram", nomes(v.ausentes)],
  ];
  return (
    <div className="rounded border border-borda p-3">
      <p className="text-sm font-semibold text-gray-900">
        {rotuloEtapa(v.parte ?? null)}
        {rotuloResultadoJulgamento(v.resultado) ? ` · ${rotuloResultadoJulgamento(v.resultado)}` : ""}
      </p>
      <dl className="mt-2 space-y-1 text-sm">
        {grupos
          .filter(([, l]) => l.length)
          .map(([r, l]) => (
            <div key={r}>
              <dt className="font-semibold text-gray-900">
                {r} ({l.length})
              </dt>
              <dd className="text-gray-800">{l.join("; ")}</dd>
            </div>
          ))}
        {(v.vencidos_trechos ?? []).length ? (
          <div>
            <dt className="font-semibold text-gray-900">Como o texto oficial registra os vencidos</dt>
            {v.vencidos_trechos!.map((t) => (
              <dd key={t} className="italic text-gray-800">
                “{t}”
              </dd>
            ))}
          </div>
        ) : null}
        {v.presidente ? (
          <div>
            <dt className="font-semibold text-gray-900">Presidente da sessão (não contado como voto)</dt>
            <dd className="text-gray-800">{v.presidente}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/** Votos registrados no Plenário Virtual, em ordem alfabética, como publicados pelo STF. */
function VotosPlenarioVirtual({ v }: { v: VotacaoStf }) {
  const votos = [...(v.votos ?? [])].sort((a, b) => a.ministro.localeCompare(b.ministro, "pt-BR"));
  return (
    <div className="rounded border border-borda p-3">
      <p className="text-sm font-semibold text-gray-900">{v.descricao ?? "Votos registrados no Plenário Virtual"}</p>
      {v.relator?.ministro ? <p className="meta mt-1">Relator: {v.relator.ministro}</p> : null}
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {v.relatorio_url ? (
          <FonteLink href={v.relatorio_url} tipo="oficial" className="text-xs">
            Relatório
          </FonteLink>
        ) : null}
        {v.voto_relator_url ? (
          <FonteLink href={v.voto_relator_url} tipo="oficial" className="text-xs">
            Voto do relator
          </FonteLink>
        ) : null}
        {v.url ? (
          <FonteLink href={v.url} tipo="oficial" className="text-xs">
            Votação no Plenário Virtual
          </FonteLink>
        ) : null}
      </p>
      {votos.length ? (
        <div className="mt-3 overflow-x-auto rounded border border-borda" role="region" tabIndex={0} aria-label="Votos registrados no Plenário Virtual">
          <table className="tabela">
            <caption className="sr-only">Votos registrados no Plenário Virtual</caption>
            <thead>
              <tr>
                <th scope="col">Ministro</th>
                <th scope="col">Voto registrado</th>
                <th scope="col">Data</th>
              </tr>
            </thead>
            <tbody>
              {votos.map((x) => (
                <tr key={x.ministro}>
                  <td>{x.nome_na_composicao_atual ?? x.ministro}</td>
                  <td>
                    {x.tipo_voto ?? "Não informado"}
                    {x.acompanha ? <span className="meta block">Acompanha: {x.acompanha}</span> : null}
                    {(x.textos ?? []).map((t) => (
                      <span key={t.url} className="block">
                        <FonteLink href={t.url} tipo="oficial" className="text-xs">
                          {t.titulo ?? "Texto do voto"}
                        </FonteLink>
                      </span>
                    ))}
                  </td>
                  <td className="whitespace-nowrap">{formatarData(x.data)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="lacuna mt-2 text-sm">Nenhum voto registrado na lista do Plenário Virtual.</p>
      )}
    </div>
  );
}

/**
 * Julgamento do STF: certidão literal sempre; vencidos e demais nomes da certidão; votos do
 * Plenário Virtual só em sessão virtual e com dados estruturados. Sessão presencial: só a certidão.
 */
export function JulgamentoStfBloco({ j, link = false }: { j: JulgamentoStf; link?: boolean }) {
  const exibivel = EXIBIVEIS.has(j.situacao_conferencia ?? "");
  const ambiente = ambienteStf(j);
  const certidao = (j.votacoes ?? []).filter((v) => v.origem !== "plenario-virtual");
  const virtuais = ambiente === "virtual" ? (j.votacoes ?? []).filter((v) => v.origem === "plenario-virtual") : [];
  const lacunas = lacunasLegiveis(j.lacunas);
  const fontes = [...(j.certidao_fonte?.url ? [{ titulo: j.certidao_fonte.titulo, url: j.certidao_fonte.url }] : []), ...(j.fontes ?? [])].filter(
    (f) => f && typeof f.url === "string",
  );
  const titulo = tituloJulgamentoStf(j);
  return (
    <article className="cartao">
      <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-gray-900">{formatarData(j.data_julgamento)}</span>
        {j.orgao ? <span className="selo selo-escuro">{j.orgao}</span> : null}
        <span>{ambiente === "virtual" ? "Sessão virtual (Plenário Virtual)" : ambiente === "presencial" ? "Sessão presencial" : "Tipo de sessão não informado"}</span>
        {j.data_publicacao ? <span>· acórdão publicado em {formatarData(j.data_publicacao)}</span> : null}
      </p>
      <h4 className="mt-2 text-base font-semibold text-gray-900">
        {link && j.id ? (
          <Link href={`/justica/stf/julgamentos/${j.id}`} className="lk">
            {titulo}
          </Link>
        ) : (
          titulo
        )}
      </h4>
      <p className="mt-1 text-sm text-gray-800">
        Relator: {j.relator ?? "não informado"}
        {j.redator_acordao ? ` · Redator do acórdão: ${j.redator_acordao}` : ""}
      </p>
      {typeof j.sessao === "object" && j.sessao?.trecho_oficial ? <p className="meta mt-1">Sessão, no texto oficial: “{j.sessao.trecho_oficial}”</p> : null}
      <Citacao rotulo="Resultado, como escrito no texto oficial (certidão)" texto={j.certidao_literal} />
      {exibivel ? (
        <div className="mt-3 space-y-3">
          {certidao.map((v, i) => (
            <ParteCertidao key={i} v={v} />
          ))}
          {virtuais.map((v, i) => (
            <VotosPlenarioVirtual key={i} v={v} />
          ))}
          {ambiente !== "virtual" ? (
            <p className="lacuna text-sm">
              Sessão presencial: o voto de cada ministro não é publicado de forma estruturada; aparecem só os registros da
              certidão.
            </p>
          ) : null}
          {j.conferencia_votos_x_certidao?.resultado && !["coincide", "nao-aplicavel"].includes(j.conferencia_votos_x_certidao.resultado) ? (
            <p className="lacuna text-sm">
              Os votos do Plenário Virtual e a certidão não coincidem
              {j.conferencia_votos_x_certidao.detalhe ? `: ${j.conferencia_votos_x_certidao.detalhe}` : "."}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="lacuna mt-3 text-sm">Votos individuais ainda não conferidos contra o texto oficial; só o resultado literal é exibido.</p>
      )}
      {lacunas.length ? (
        <ul className="mt-3 space-y-1">
          {lacunas.map((l) => (
            <li key={l} className="lacuna text-sm">
              {l}
            </li>
          ))}
        </ul>
      ) : null}
      {fontes.length && !link ? (
        <div className="mt-3">
          <ListaFontes fontes={fontes.map(tituloFonteLegivel)} />
        </div>
      ) : null}
    </article>
  );
}
