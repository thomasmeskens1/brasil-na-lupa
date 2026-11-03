import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";
import { getVotacaoPlenario } from "@/features/sao-paulo/dados";
import type { JulgamentoAlesp, JulgamentoCongresso, VotacaoAlespLigada } from "../tipos";
import { NAO_DISPONIVEL, formatarDataTc } from "../rotulos";
import { Ficha, Literal } from "./Basicos";

/** Situação literal em caixa alta da fonte (ex.: "AGUARDANDO DESIGNAÇÃO DO RELATOR") em frase. */
function frase(v: string): string {
  return v === v.toUpperCase() ? v.charAt(0) + v.slice(1).toLowerCase() : v;
}

function siglaColegiado(c: string | null): string | null {
  const m = c ? /\(([A-Z]{2,6})\)\s*$/.exec(c) : null;
  return m ? m[1] : null;
}

/** Julgamento das contas do Presidente pelo Congresso Nacional (tramitação da MCN). */
export function JulgamentoCongressoBloco({ jp }: { jp: JulgamentoCongresso | null }) {
  if (!jp) return <p className="lacuna text-base">Julgamento pelo Congresso Nacional: {NAO_DISPONIVEL.toLowerCase()}.</p>;
  const julgado = !!jp.deliberacao || !!jp.norma_gerada;
  const aguardaRelator = !julgado && /AGUARDANDO DESIGNA[ÇC][ÃA]O DO RELATOR/i.test(jp.situacao_literal ?? "");
  const sigla = siglaColegiado(jp.colegiado_atual);
  return (
    <div className="space-y-4">
      {aguardaRelator ? (
        <p className="aviso text-base">
          <strong className="font-semibold">
            Aguardando designação de relator na {sigla ?? jp.colegiado_atual ?? "comissão"} desde {formatarDataTc(jp.data_situacao)}.
          </strong>{" "}
          {jp.colegiado_atual && sigla ? `${jp.colegiado_atual}. ` : ""}Até a coleta, as contas não tinham sido votadas pelo Congresso Nacional.
        </p>
      ) : !julgado ? (
        <p className="aviso text-base">
          Situação na fonte: {jp.situacao_literal ? frase(jp.situacao_literal) : NAO_DISPONIVEL}
          {jp.data_situacao ? ` (desde ${formatarDataTc(jp.data_situacao)})` : ""}.
        </p>
      ) : null}
      <Ficha
        rotulo="Tramitação no Congresso Nacional"
        itens={[
          [
            "Mensagem",
            jp.url ? (
              <FonteLink href={jp.url} tipo="oficial" className="text-base!">
                {jp.mensagem ?? "Mensagem do Congresso Nacional"}
              </FonteLink>
            ) : (
              (jp.mensagem ?? NAO_DISPONIVEL)
            ),
          ],
          ["Situação (texto oficial)", jp.situacao_literal ?? NAO_DISPONIVEL],
          ["Data da situação", formatarDataTc(jp.data_situacao)],
          ["Onde está", jp.colegiado_atual ?? NAO_DISPONIVEL],
          ["Em tramitação", jp.tramitando ?? NAO_DISPONIVEL],
          ["Votação no Congresso", julgado ? "Registrada na fonte (ver tramitação)" : "Não registrada na fonte até a coleta"],
        ]}
      />
      {jp.ementa ? <Literal fonte="Ementa da mensagem (texto oficial)">{jp.ementa}</Literal> : null}
      {jp.recebimento_parecer_tcu ? (
        <div>
          <h4 className="text-base font-semibold text-gray-900">
            Recebimento do parecer do TCU pelo Congresso em {formatarDataTc(jp.recebimento_parecer_tcu.data)}
          </h4>
          {jp.recebimento_parecer_tcu.texto_literal ? <div className="mt-2"><Literal>{jp.recebimento_parecer_tcu.texto_literal}</Literal></div> : null}
          {jp.recebimento_parecer_tcu.documento?.url ? (
            <p className="mt-2">
              <FonteLink href={jp.recebimento_parecer_tcu.documento.url} tipo="oficial" className="text-base!">
                {jp.recebimento_parecer_tcu.documento.titulo}
              </FonteLink>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const PLACAR: [keyof NonNullable<VotacaoAlespLigada["placar"]>, string][] = [
  ["sim", "Sim"],
  ["nao", "Não"],
  ["abstencao", "Abstenção"],
  ["obstrucao", "Obstrução"],
  ["outros", "Outros"],
];

function VotacaoAlesp({ v }: { v: VotacaoAlespLigada }) {
  const plenario = v.orgao?.startsWith("Plenário") ?? false;
  const pagina = plenario && getVotacaoPlenario(v.votacao_ref) ? `/sao-paulo/votacoes/${v.votacao_ref}` : null;
  const naLista = !plenario ? `/sao-paulo/votacoes#id=${encodeURIComponent(v.votacao_ref)}` : null;
  const placar = v.placar ? PLACAR.filter(([k]) => typeof v.placar?.[k] === "number") : [];
  const porTipo = Object.entries(v.votos_por_tipo ?? {});
  return (
    <li className="cartao">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-[var(--cor-secundaria)]">
        <span className="font-semibold text-gray-900">{formatarDataTc(v.data)}</span>
        <span className="selo text-sm!">{v.orgao ?? "Órgão não informado"}</span>
        <span>{v.tipo === "nominal" ? "Votação nominal" : (v.tipo ?? "Tipo de votação não informado")}</span>
      </p>
      <h4 className="mt-2 text-base font-semibold text-gray-900">{v.descricao ?? "Votação"}</h4>
      {v.resultado ? <p className="mt-1 text-base text-gray-800">Resultado registrado: {v.resultado}</p> : null}
      {placar.length ? (
        <dl className="mt-3 flex flex-wrap gap-2" aria-label="Placar oficial">
          {placar.map(([k, r]) => (
            <div key={k} className="min-w-[5.5rem] rounded border border-borda bg-superficie px-3 py-2 text-center">
              <dt className="text-base font-medium text-[var(--cor-secundaria)]">{r}</dt>
              <dd className="text-xl font-bold text-gray-900">{v.placar?.[k]}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {porTipo.length ? (
        <ul className="mt-3 space-y-1 text-base text-gray-800">
          {porTipo.map(([t, n]) => (
            <li key={t}>
              “{t}”: {n} {n === 1 ? "voto" : "votos"}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-3 flex flex-col gap-1 text-base sm:flex-row sm:flex-wrap sm:gap-x-4">
        {pagina ? (
          <li>
            <Link href={pagina} className="lk inline-flex min-h-11 items-center">
              Ver o voto de cada deputado nesta votação
            </Link>
          </li>
        ) : null}
        {naLista ? (
          <li>
            <Link href={naLista} className="lk inline-flex min-h-11 items-center">
              Ver o voto de cada membro da comissão
            </Link>
          </li>
        ) : null}
        {v.url ? (
          <li className="inline-flex min-h-11 items-center">
            <FonteLink href={v.url} tipo={/\.pdf($|\?)/i.test(v.url) ? "pdf" : "oficial"} className="inline-flex min-h-11 items-center text-base!">
              Registro oficial da votação
            </FonteLink>
          </li>
        ) : null}
      </ul>
    </li>
  );
}

/** Julgamento das contas do Governador pela Assembleia Legislativa (ALESP). */
export function JulgamentoAlespBloco({ jp }: { jp: JulgamentoAlesp | null }) {
  if (!jp) return <p className="lacuna text-base">Julgamento pela Assembleia Legislativa: não localizado nos dados coletados.</p>;
  const p = jp.proposicao;
  const votacoes = [...jp.votacoes].sort((a, b) => (a.data ?? "").localeCompare(b.data ?? "") || (a.orgao?.startsWith("Plenário") ? 1 : -1));
  return (
    <div className="space-y-4">
      <Ficha
        rotulo="Julgamento na Assembleia Legislativa"
        itens={[
          [
            "Proposição",
            p?.url ? (
              <FonteLink href={p.url} tipo="oficial" className="text-base!">
                {`${p.sigla} ${p.numero}/${p.ano}`}
              </FonteLink>
            ) : p ? (
              `${p.sigla} ${p.numero}/${p.ano}`
            ) : (
              NAO_DISPONIVEL
            ),
          ],
          ["Última situação (texto oficial)", jp.situacao_literal ?? NAO_DISPONIVEL],
          ["Data da situação", formatarDataTc(jp.data_situacao)],
        ]}
      />
      {p?.ementa ? <Literal fonte="Ementa do projeto (texto oficial)">{p.ementa}</Literal> : null}
      {votacoes.length ? (
        <div>
          <h4 className="text-base font-semibold text-gray-900">Votações registradas, em ordem cronológica</h4>
          <ul className="mt-2 space-y-3">
            {votacoes.map((v) => (
              <VotacaoAlesp key={v.votacao_ref} v={v} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="lacuna text-base">Nenhuma votação registrada nos dados coletados.</p>
      )}
    </div>
  );
}
