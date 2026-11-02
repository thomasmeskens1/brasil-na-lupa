import { ItemRecolhivel, formatarData } from "@/components/decisao";
import { lacunasLegiveis } from "@/features/comum/texto";
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

type Ctx = { ids?: Record<string, string>; ministros: Map<string, MinistroStj> };

function Nome({ nome, ids, ministros }: { nome: string } & Ctx) {
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

/** Grupo de nomes em lista (ordem alfabética), um por linha. */
function Grupo({ titulo, nomes, ctx, nota }: { titulo: string; nomes: string[]; ctx: Ctx; nota?: (n: string) => string | null }) {
  if (!nomes.length) return null;
  return (
    <div>
      <h6 className="font-semibold text-foreground">
        {titulo} ({nomes.length})
      </h6>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {[...nomes]
          .sort((a, b) => a.localeCompare(b, "pt-BR"))
          .map((n) => (
            <li key={n}>
              <Nome nome={n} {...ctx} />
              {nota?.(n) ? <span className="text-[var(--cor-secundaria)]"> {nota(n)}</span> : null}
            </li>
          ))}
      </ul>
    </div>
  );
}

/** Votos de uma etapa, como conferidos contra o texto oficial (ordem alfabética em cada grupo). */
function EtapaVotos({ e, ctx }: { e: EtapaConferida; ctx: Ctx }) {
  const motivos = new Map(e.ausentes.map((a) => [a.nome, a.motivo_texto]));
  return (
    <div className="rounded-md border border-borda p-3">
      <p className="font-semibold text-foreground">
        {rotuloEtapa(e.etapa)}
        {rotuloResultadoJulgamento(e.resultado) ? ` · ${rotuloResultadoJulgamento(e.resultado)}` : ""}
      </p>
      {e.resultado_trecho ? <p className="mt-1 italic">“{e.resultado_trecho}”</p> : null}
      <div className="mt-2 space-y-3">
        <p>
          <span className="font-semibold text-foreground">Relator: </span>
          {e.relator ? <Nome nome={e.relator} {...ctx} /> : "não informado no texto"}
        </p>
        {e.relator_acordao ? (
          <p>
            <span className="font-semibold text-foreground">Relator para o acórdão (redigiu a decisão): </span>
            <Nome nome={e.relator_acordao} {...ctx} />
          </p>
        ) : null}
        <Grupo titulo="Acompanharam o relator" nomes={e.acompanharam} ctx={ctx} />
        <Grupo titulo="Vencidos nesta etapa" nomes={e.vencidos} ctx={ctx} />
        <Grupo titulo="Apresentaram voto-vista" nomes={e.voto_vista} ctx={ctx} />
        <Grupo titulo="Impedidos" nomes={e.impedidos} ctx={ctx} />
        <Grupo
          titulo="Não votaram"
          nomes={e.ausentes.map((a) => a.nome)}
          ctx={ctx}
          nota={(n) => (motivos.get(n) ? `(no texto oficial: “${motivos.get(n)}”)` : "(motivo não informado)")}
        />
        <p>
          <span className="font-semibold text-foreground">Presidente da sessão (não contado como voto): </span>
          {e.presidente ? <Nome nome={e.presidente} {...ctx} /> : "não informado no texto oficial"}
        </p>
      </div>
    </div>
  );
}

/** Expressão literal do resultado ("por maioria") para o selo do resumo, só se escrita no texto. */
function seloResultado(s: SessaoStj): string | null {
  const e = [...new Set((s.resultado_trechos ?? []).map((t) => t.expressao))];
  return e.length === 1 ? e[0].charAt(0).toUpperCase() + e[0].slice(1) : e.length ? e.join(" e ") : null;
}

/**
 * Uma sessão de julgamento, recolhida: o resumo traz data, etapa, órgão e a expressão literal do
 * resultado; dentro, o resultado como escrito, a tese, o texto oficial e, se conferidos, os votos.
 */
export function SessaoJulgamento({
  s,
  conferencia,
  ministros,
  aberto = false,
}: {
  s: SessaoStj;
  conferencia: VotoConferido | null;
  ministros: Map<string, MinistroStj>;
  aberto?: boolean;
}) {
  const conferido = conferencia?.situacao_conferencia === "conferido";
  const lacunas = [...lacunasLegiveis(s.lacunas), ...(conferencia ? lacunasLegiveis(conferencia.lacunas) : [])];
  const selo = seloResultado(s);
  const ctx: Ctx = { ids: conferencia?.ministros_ids, ministros };
  return (
    <ItemRecolhivel
      aberto={aberto}
      resumo={
        <span className="block">
          <span className="block font-semibold text-foreground">
            {rotuloEtapa(s.etapa)} · {formatarData(s.data)}
          </span>
          <span className="block text-sm font-normal text-[var(--cor-secundaria)]">
            {rotuloOrgao(s.orgao)} · {s.processo ?? "processo não informado"}
            {s.processo_paradigma ? " (paradigma)" : ""}
            {conferido ? " · votos conferidos" : ""}
          </span>
        </span>
      }
      selo={selo ? <span className="selo">{selo}</span> : null}
    >
      <h5 className="font-semibold text-foreground">Resultado, como escrito no texto oficial</h5>
      {(s.resultado_trechos ?? []).length ? (
        <ul className="mt-1 space-y-1">
          {s.resultado_trechos!.map((t, i) => (
            <li key={i} className="italic">
              “{t.trecho}”
            </li>
          ))}
        </ul>
      ) : (
        <p className="lacuna mt-1 text-sm">O texto oficial coletado não traz a expressão de unanimidade ou maioria.</p>
      )}
      {s.tese_juridica ? <Citacao rotulo="Tese registrada nesta decisão" texto={s.tese_juridica} /> : null}
      {s.decisao ? (
        <details className="mt-3 rounded-md border border-borda">
          <summary className="pr-3">Texto oficial completo da decisão</summary>
          <p className="whitespace-pre-line border-t border-borda px-3 pb-3 pt-2 leading-relaxed">{s.decisao.trim()}</p>
        </details>
      ) : null}

      <section aria-label="Votos dos ministros" className="mt-4 border-t border-borda pt-3">
        <h5 className="font-semibold text-foreground">Votos dos ministros</h5>
        {conferido ? (
          <>
            <p className="meta mt-1">
              Conferidos, nome a nome, contra o texto oficial da decisão. Só aparecem nomes escritos no texto; o relator vem do
              registro oficial do acórdão.
            </p>
            <div className="mt-2 space-y-3">
              {conferencia!.etapas.map((e, i) => (
                <EtapaVotos key={i} e={e} ctx={ctx} />
              ))}
            </div>
          </>
        ) : conferencia ? (
          <p className="lacuna mt-1 text-sm">
            A conferência dos votos desta sessão não pôde ser concluída: o texto oficial deixa dúvidas sobre a quem se aplica cada
            registro (veja abaixo). Por isso, só o resultado literal é exibido.
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
          <a href={s.fonte.url} className="lk inline-flex min-h-11 items-center text-sm" target="_blank" rel="noopener noreferrer">
            <span className="tag-fonte mr-1.5">Oficial</span> Espelho do acórdão nos dados abertos do STJ
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
          <span className="meta block">coletado em {formatarData(s.fonte.acessado_em)}</span>
        </p>
      ) : null}
    </ItemRecolhivel>
  );
}
