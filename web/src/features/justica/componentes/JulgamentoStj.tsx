import { FonteLink } from "@/components/FonteLink";
import { lacunasLegiveis } from "@/features/comum/texto";
import { formatarData } from "@/features/congresso/rotulos";
import { Citacao } from "@/features/executivo/componentes/Dispositivo";
import type { EtapaConferida, MinistroStj, SessaoStj, VotoConferido } from "../tipos";
import { rotuloEtapa, rotuloOrgao, rotuloResultadoJulgamento } from "../rotulos";

function acordaoId(s: SessaoStj): string | null {
  return /ac[óo]rd[ãa]o id (\d+)/i.exec(s.fonte?.titulo ?? "")?.[1] ?? null;
}

/** Conferência correspondente à sessão: mesmo acórdão (id oficial) ou mesmo processo e data. */
export function conferenciaDaSessao(s: SessaoStj, conferidos: VotoConferido[]): VotoConferido | null {
  const id = acordaoId(s);
  return (
    conferidos.find((c) => id && c.acordao_id === id) ??
    conferidos.find((c) => c.processo === s.processo && c.data_julgamento === s.data) ??
    null
  );
}

function Nome({ nome, ids, ministros }: { nome: string; ids?: Record<string, string>; ministros: Map<string, MinistroStj> }) {
  const m = ids?.[nome] ? ministros.get(ids[nome]) : undefined;
  return m?.url_oficial ? (
    <a href={m.url_oficial} target="_blank" rel="noopener noreferrer" className="lk">
      {nome}
      <span className="sr-only"> (página oficial no STJ, abre em nova aba)</span>
    </a>
  ) : (
    <>{nome}</>
  );
}

function Lista({ titulo, nomes, ids, ministros }: { titulo: string; nomes: string[]; ids?: Record<string, string>; ministros: Map<string, MinistroStj> }) {
  if (!nomes.length) return null;
  return (
    <div>
      <dt className="text-sm font-semibold text-gray-900">
        {titulo} ({nomes.length})
      </dt>
      <dd className="mt-0.5 text-sm text-gray-800">
        {[...nomes]
          .sort((a, b) => a.localeCompare(b, "pt-BR"))
          .map((n, i) => (
            <span key={n}>
              {i ? "; " : ""}
              <Nome nome={n} ids={ids} ministros={ministros} />
            </span>
          ))}
      </dd>
    </div>
  );
}

/** Votos de uma etapa, como conferidos contra o texto oficial (ordem alfabética em cada grupo). */
function EtapaVotos({ e, ids, ministros }: { e: EtapaConferida; ids?: Record<string, string>; ministros: Map<string, MinistroStj> }) {
  return (
    <div className="rounded border border-borda p-3">
      <p className="text-sm font-semibold text-gray-900">
        {rotuloEtapa(e.etapa)}
        {rotuloResultadoJulgamento(e.resultado) ? ` · ${rotuloResultadoJulgamento(e.resultado)}` : ""}
      </p>
      {e.resultado_trecho ? <p className="mt-1 text-sm italic text-gray-800">“{e.resultado_trecho}”</p> : null}
      <dl className="mt-2 space-y-2">
        <div>
          <dt className="text-sm font-semibold text-gray-900">Relator</dt>
          <dd className="text-sm text-gray-800">{e.relator ? <Nome nome={e.relator} ids={ids} ministros={ministros} /> : "Não informado no texto"}</dd>
        </div>
        {e.relator_acordao ? (
          <div>
            <dt className="text-sm font-semibold text-gray-900">Relator para o acórdão (redigiu a decisão)</dt>
            <dd className="text-sm text-gray-800">
              <Nome nome={e.relator_acordao} ids={ids} ministros={ministros} />
            </dd>
          </div>
        ) : null}
        <Lista titulo="Acompanharam o relator" nomes={e.acompanharam} ids={ids} ministros={ministros} />
        <Lista titulo="Vencidos nesta etapa" nomes={e.vencidos} ids={ids} ministros={ministros} />
        <Lista titulo="Apresentaram voto-vista" nomes={e.voto_vista} ids={ids} ministros={ministros} />
        <Lista titulo="Impedidos" nomes={e.impedidos} ids={ids} ministros={ministros} />
        {e.ausentes.length ? (
          <div>
            <dt className="text-sm font-semibold text-gray-900">Não votaram ({e.ausentes.length})</dt>
            <dd className="mt-0.5 text-sm text-gray-800">
              {[...e.ausentes]
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                .map((a, i) => (
                  <span key={a.nome}>
                    {i ? "; " : ""}
                    <Nome nome={a.nome} ids={ids} ministros={ministros} />
                    {a.motivo_texto ? ` (no texto oficial: “${a.motivo_texto}”)` : " (motivo não informado)"}
                  </span>
                ))}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-sm font-semibold text-gray-900">Presidente da sessão (não contado como voto)</dt>
          <dd className="text-sm text-gray-800">
            {e.presidente ? <Nome nome={e.presidente} ids={ids} ministros={ministros} /> : "Não informado no texto oficial"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** Uma sessão de julgamento: resultado literal, tese, texto oficial e, se conferidos, os votos. */
export function SessaoJulgamento({
  s,
  conferencia,
  ministros,
}: {
  s: SessaoStj;
  conferencia: VotoConferido | null;
  ministros: Map<string, MinistroStj>;
}) {
  const conferido = conferencia?.situacao_conferencia === "conferido";
  const lacunas = [...lacunasLegiveis(s.lacunas), ...(conferencia ? lacunasLegiveis(conferencia.lacunas) : [])];
  return (
    <article className="cartao">
      <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-gray-900">{formatarData(s.data)}</span>
        <span className="selo selo-escuro">{rotuloEtapa(s.etapa)}</span>
        <span>{rotuloOrgao(s.orgao)}</span>
        {s.data_publicacao ? <span>· publicado em {formatarData(s.data_publicacao)}</span> : null}
      </p>
      <h4 className="mt-2 text-base font-semibold text-gray-900">
        {s.processo ?? "Processo não informado"}
        {s.processo_paradigma ? <span className="meta ml-2 font-normal">(processo paradigma)</span> : null}
      </h4>

      <h5 className="mt-3 text-sm font-semibold text-gray-900">Resultado, como escrito no texto oficial</h5>
      {(s.resultado_trechos ?? []).length ? (
        <ul className="mt-1 space-y-1">
          {s.resultado_trechos!.map((t, i) => (
            <li key={i} className="text-sm italic text-gray-800">
              “{t.trecho}”
            </li>
          ))}
        </ul>
      ) : (
        <p className="lacuna mt-1 text-sm">O texto oficial coletado não traz a expressão de unanimidade ou maioria.</p>
      )}
      {s.tese_juridica ? <Citacao rotulo="Tese registrada nesta decisão" texto={s.tese_juridica} /> : null}
      {s.decisao ? (
        <details className="mt-3">
          <summary className="text-sm">Texto oficial completo da decisão</summary>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-800">{s.decisao.trim()}</p>
        </details>
      ) : null}

      <section aria-label="Votos dos ministros" className="mt-4 border-t border-borda pt-3">
        <h5 className="text-sm font-semibold text-gray-900">Votos dos ministros</h5>
        {conferido ? (
          <>
            <p className="meta mt-1">
              Conferidos, nome a nome, contra o texto oficial da decisão. Só aparecem nomes escritos no texto; o relator vem
              do registro oficial do acórdão.
            </p>
            <div className="mt-2 space-y-3">
              {conferencia!.etapas.map((e, i) => (
                <EtapaVotos key={i} e={e} ids={conferencia!.ministros_ids} ministros={ministros} />
              ))}
            </div>
          </>
        ) : conferencia ? (
          <p className="lacuna mt-1 text-sm">
            A conferência dos votos desta sessão não pôde ser concluída: o texto oficial deixa dúvidas sobre a quem se aplica
            cada registro (veja abaixo). Por isso, só o resultado literal é exibido.
          </p>
        ) : (
          <p className="lacuna mt-1 text-sm">Votos individuais ainda não conferidos contra o texto oficial. Consulte o texto completo da decisão.</p>
        )}
      </section>

      {lacunas.length ? (
        <ul className="mt-3 space-y-1">
          {lacunas.map((l) => (
            <li key={l} className="lacuna text-sm">
              {l}
            </li>
          ))}
        </ul>
      ) : null}

      {s.fonte?.url ? (
        <p className="mt-3">
          <FonteLink href={s.fonte.url} tipo="oficial" className="text-xs">
            Espelho do acórdão nos dados abertos do STJ
          </FonteLink>
          <span className="meta block">coletado em {formatarData(s.fonte.acessado_em)}</span>
        </p>
      ) : null}
    </article>
  );
}
