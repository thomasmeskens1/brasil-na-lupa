import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";
import { lacunasLegiveis, tituloFonteLegivel } from "@/features/comum/texto";
import { ListaFontes } from "@/features/congresso/componentes/Basicos";
import { TabelaResponsiva } from "@/components/tabela";
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

/** Parte da certidão: resultado e nomes escritos no texto oficial (um nome por linha). */
function ParteCertidao({ v }: { v: VotacaoStf }) {
  const grupos: [string, string[]][] = [
    ["Vencidos", nomes(v.vencidos)],
    ["Impedidos", nomes(v.impedidos)],
    ["Não votaram", nomes(v.ausentes)],
  ];
  return (
    <div className="rounded-md border border-borda p-3">
      <p className="font-semibold text-foreground">
        {rotuloEtapa(v.parte ?? null)}
        {rotuloResultadoJulgamento(v.resultado) ? ` · ${rotuloResultadoJulgamento(v.resultado)}` : ""}
      </p>
      {v.trecho ? <p className="mt-1 italic">“{v.trecho}”</p> : null}
      <div className="mt-2 space-y-2">
        {grupos
          .filter(([, l]) => l.length)
          .map(([r, l]) => (
            <div key={r}>
              <h6 className="font-semibold text-foreground">
                {r} ({l.length})
              </h6>
              <ul className="mt-0.5 list-disc pl-5">
                {l.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ))}
        {(v.vencidos_trechos ?? []).length ? (
          <div>
            <h6 className="font-semibold text-foreground">Como o texto oficial registra os vencidos</h6>
            {v.vencidos_trechos!.map((t) => (
              <p key={t} className="italic">
                “{t}”
              </p>
            ))}
          </div>
        ) : null}
        {v.presidente ? (
          <p>
            <span className="font-semibold text-foreground">Presidente da sessão (não contado como voto): </span>
            {v.presidente}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Votos registrados no Plenário Virtual, em ordem alfabética, como publicados pelo STF. */
function VotosPlenarioVirtual({ v }: { v: VotacaoStf }) {
  const votos = [...(v.votos ?? [])].sort((a, b) => a.ministro.localeCompare(b.ministro, "pt-BR"));
  return (
    <div className="rounded-md border border-borda p-3">
      <p className="font-semibold text-foreground">{v.descricao ?? "Votos registrados no Plenário Virtual"}</p>
      {v.relator?.ministro ? <p className="meta mt-1">Relator: {v.relator.ministro}</p> : null}
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {v.relatorio_url ? (
          <FonteLink href={v.relatorio_url} tipo="oficial" className="inline-flex min-h-11 items-center">
            Relatório
          </FonteLink>
        ) : null}
        {v.voto_relator_url ? (
          <FonteLink href={v.voto_relator_url} tipo="oficial" className="inline-flex min-h-11 items-center">
            Voto do relator
          </FonteLink>
        ) : null}
        {v.url ? (
          <FonteLink href={v.url} tipo="oficial" className="inline-flex min-h-11 items-center">
            Votação no Plenário Virtual
          </FonteLink>
        ) : null}
      </p>
      {votos.length ? (
        <TabelaResponsiva
          className="mt-3"
          legenda="Votos registrados no Plenário Virtual (ordem alfabética)"
          legendaOculta
          linhas={votos}
          chaveLinha={(x) => x.ministro}
          colunas={[
            { chave: "ministro", rotulo: "Ministro", principal: true, celula: (x) => x.nome_na_composicao_atual ?? x.ministro },
            {
              chave: "voto",
              rotulo: "Voto registrado",
              celula: (x) => (
                <>
                  {x.tipo_voto ?? "Não informado"}
                  {x.acompanha ? <span className="meta block">Acompanha: {x.acompanha}</span> : null}
                  {(x.textos ?? []).map((t) => (
                    <span key={t.url} className="block">
                      <FonteLink href={t.url} tipo="oficial">
                        {t.titulo ?? "Texto do voto"}
                      </FonteLink>
                    </span>
                  ))}
                </>
              ),
            },
            { chave: "data", rotulo: "Data", celula: (x) => formatarData(x.data) },
          ]}
        />
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
export function JulgamentoStfBloco({ j, link = false, semCertidao = false }: { j: JulgamentoStf; link?: boolean; semCertidao?: boolean }) {
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
      <p className="mt-1">
        Relator: {j.relator ?? "não informado"}
        {j.redator_acordao ? ` · Redator do acórdão: ${j.redator_acordao}` : ""}
      </p>
      {typeof j.sessao === "object" && j.sessao?.trecho_oficial ? <p className="meta mt-1">Sessão, no texto oficial: “{j.sessao.trecho_oficial}”</p> : null}
      {semCertidao ? null : <Citacao rotulo="Resultado, como escrito no texto oficial (certidão)" texto={j.certidao_literal} />}
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
