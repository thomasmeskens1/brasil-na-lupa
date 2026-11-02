import { FonteLink } from "@/components/FonteLink";
import { CASA_NOME, formatarData } from "@/features/congresso/rotulos";
import type { DispositivoVeto, PlacarCasaVeto } from "../tipos";
import { SITUACAO_DISPOSITIVO, rotuloSituacaoDispositivo, rotuloTipoVotacaoVeto } from "../rotulos";
import { VotosDispositivo } from "./VotosDispositivo";

/** Citação literal de documento oficial, com quebras de linha preservadas. */
export function Citacao({ rotulo, texto }: { rotulo: string; texto: string | null | undefined }) {
  return (
    <figure className="mt-3">
      <figcaption className="text-sm font-semibold text-gray-900">{rotulo}</figcaption>
      {texto ? (
        <blockquote className="mt-1 whitespace-pre-line border-l-4 border-[#9aa5b1] bg-superficie px-3 py-2 text-sm leading-relaxed text-gray-800">
          {texto.trim()}
        </blockquote>
      ) : (
        <p className="lacuna mt-1 text-sm">Informação não disponível em fonte oficial.</p>
      )}
    </figure>
  );
}

function PlacarCasa({ casa, p }: { casa: "camara" | "senado"; p: PlacarCasaVeto }) {
  // O detalhe traz os rótulos exatamente como a fonte os conta (ex.: "Branco").
  const itens: [string, number][] = p.detalhe
    ? Object.entries(p.detalhe)
    : (
        [
          ["Sim", p.sim],
          ["Não", p.nao],
          ["Abstenção", p.abstencao],
          ["Obstrução", p.obstrucao],
          ["Outros", p.outros],
        ] as [string, number | null | undefined][]
      ).filter((x): x is [string, number] => typeof x[1] === "number");
  return (
    <div>
      <h5 className="text-sm font-semibold text-gray-900">{CASA_NOME[casa]}</h5>
      <dl className="mt-1 flex flex-wrap gap-2" aria-label={`Placar — ${CASA_NOME[casa]}`}>
        {itens.map(([r, n]) => (
          <div key={r} className="min-w-[5rem] rounded border border-borda bg-superficie px-3 py-1.5 text-center">
            <dt className="text-xs font-medium text-[#3e4c59]">{r}</dt>
            <dd className="text-lg font-bold text-gray-900">{n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Um dispositivo vetado: texto, razão oficial do veto, situação e, se houver, a votação. */
export function Dispositivo({ d, ordem }: { d: DispositivoVeto; ordem: number }) {
  const sit = d.situacao ? SITUACAO_DISPOSITIVO[d.situacao] : undefined;
  const v = d.votacao;
  const placares = (["camara", "senado"] as const).filter((c) => v?.placar?.[c]);
  const rotulo = d.identificador ? `dispositivo ${d.identificador}` : `dispositivo ${ordem}`;
  return (
    <article className="cartao" id={`dispositivo-${d.codigo}`}>
      <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-gray-900">Dispositivo {d.identificador ?? ordem}</span>
        <span className={d.situacao === "não apreciado" ? "selo" : "selo selo-escuro"}>
          {rotuloSituacaoDispositivo(d.situacao, d.situacao_oficial)}
        </span>
        {d.data_sessao ? <span>Sessão de {formatarData(d.data_sessao)}</span> : null}
      </p>
      <h4 className="mt-2 text-sm font-semibold text-gray-900 [overflow-wrap:anywhere]">
        {d.dispositivo ?? "Identificação do dispositivo não disponível em fonte oficial"}
      </h4>
      {sit ? <p className="mt-1 text-sm text-gray-800">{sit.explicacao}</p> : null}
      {d.assunto_congresso ? <p className="meta mt-1">Assunto, segundo o Congresso Nacional: {d.assunto_congresso}</p> : null}
      <Citacao rotulo="Texto vetado" texto={d.texto_vetado} />
      <Citacao rotulo="Razões do veto (texto oficial)" texto={d.razao_veto} />
      {d.origem ? (
        <details className="mt-3">
          <summary className="text-sm">Origem do trecho no Congresso, segundo a fonte</summary>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-800">{d.origem}</p>
        </details>
      ) : null}

      {v ? (
        <section aria-label={`Votação do ${rotulo}`} className="mt-4 border-t border-borda pt-3">
          <h5 className="text-sm font-semibold text-gray-900">Votação em sessão conjunta</h5>
          <p className="meta mt-1">
            {v.sessao ?? "Sessão não informada"}
            {rotuloTipoVotacaoVeto(v.tipo_votacao_fonte ?? d.tipo_votacao) ? ` · ${rotuloTipoVotacaoVeto(v.tipo_votacao_fonte ?? d.tipo_votacao)}` : ""}
          </p>
          {placares.length ? (
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {placares.map((c) => (
                <PlacarCasa key={c} casa={c} p={v.placar![c]!} />
              ))}
            </div>
          ) : (
            <p className="lacuna mt-2 text-sm">Placar não disponível em fonte oficial.</p>
          )}
          {placares.length < 2 ? (
            <p className="meta mt-2">
              {placares.length === 1
                ? `A fonte traz placar só ${placares[0] === "camara" ? "da Câmara dos Deputados" : "do Senado Federal"} neste dispositivo; o da outra casa não consta da fonte.`
                : null}
            </p>
          ) : null}
          {v.votos_ref ? <VotosDispositivo codigo={d.codigo} rotulo={rotulo} /> : null}
          {v.url ? (
            <p className="mt-2">
              <FonteLink href={v.url} tipo="oficial" className="text-xs">
                Resultado oficial da votação deste dispositivo (Congresso Nacional)
              </FonteLink>
            </p>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
