import { FonteLink } from "@/components/FonteLink";
import type { PresencaAno, PresencaItem } from "../dados-camara";
import { formatarData } from "../rotulos";
import { ListaFontes } from "./Basicos";

/** Definições conforme o relatório oficial de presença da Câmara (textos entre aspas são da fonte). */
const DEFINICOES: [keyof PresencaItem, string, string][] = [
  [
    "dias_com_sessao",
    "Dias de sessão em exercício",
    "Dias de sessão deliberativa do Plenário em que o deputado consta do registro oficial de frequência, ou seja, em que estava no exercício do mandato. O relatório oficial considera só o “período de exercício no mandato do parlamentar”.",
  ],
  [
    "dias_presenca",
    "Dias com presença",
    "No relatório oficial: “Total de dias com presença nas sessões deliberativas”. A ajuda da página oficial diz: “Presenças marcadas em sessões presenciais ou remotas”.",
  ],
  ["dias_ausencia_justificada", "Ausências justificadas", "No relatório oficial: “Total de dias com ausências justificadas em sessões deliberativas”."],
  [
    "dias_ausencia_nao_justificada",
    "Ausências não justificadas",
    "No relatório oficial: “Total de dias com ausências não justificadas em sessões deliberativas”.",
  ],
];

const SESSOES: [keyof PresencaItem, string][] = [
  ["sessoes_registradas", "Sessões registradas"],
  ["sessoes_presenca", "Sessões com presença"],
  ["sessoes_ausencia", "Sessões com ausência"],
];

function Caixa({ rotulo, valor }: { rotulo: string; valor: number | null | undefined }) {
  return (
    <div className="min-w-[7.5rem] flex-1 rounded border border-borda bg-superficie px-3 py-2 text-center sm:flex-none">
      <dt className="text-xs font-medium text-[var(--cor-secundaria)]">{rotulo}</dt>
      <dd className="text-xl font-bold text-gray-900">{typeof valor === "number" ? valor : "–"}</dd>
    </div>
  );
}

/** URL do serviço de frequência sem a data de exemplo (a fonte grava o endereço com "DD/MM"). */
function fontesPresenca(p: PresencaAno) {
  const f = p.fonte
    ? [{ ...p.fonte, url: p.fonte.url.replace(/\/ListarPresencasDia\?.*$/, "?op=ListarPresencasDia"), titulo: "Frequência em Plenário — serviço oficial da Câmara dos Deputados (consulta por dia)" }]
    : [];
  return [...f, ...p.fontes_complementares];
}

export function PresencaDeputado({ registros, urlOficial }: { registros: { ano: PresencaAno; item: PresencaItem }[]; urlOficial?: string | null }) {
  if (!registros.length) return <p className="lacuna text-sm">Presença em Plenário não disponível nos dados coletados para este deputado.</p>;
  return (
    <div className="space-y-6">
      {registros.map(({ ano: p, item: i }) => {
        const outras = Object.entries(i.dias_outra_frequencia ?? {});
        return (
          <section key={p.ano} aria-labelledby={`presenca-${p.ano}`} className="space-y-3">
            <h3 id={`presenca-${p.ano}`} className="text-lg font-semibold text-gray-900">
              {p.ano}
            </h3>
            <p className="text-sm text-gray-800">
              {p.totais?.sessoes_deliberativas != null
                ? `A Câmara realizou ${p.totais.sessoes_deliberativas} sessões deliberativas em ${p.totais.dias_com_sessoes_deliberativas ?? "–"} dias no ano, segundo o arquivo oficial de eventos. `
                : ""}
              {i.periodo_na_fonte?.inicio
                ? `Registros deste deputado de ${formatarData(i.periodo_na_fonte.inicio)} a ${formatarData(i.periodo_na_fonte.fim)}.`
                : ""}
            </p>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Por dia de sessão</h4>
              <dl className="mt-2 flex flex-wrap gap-2">
                {DEFINICOES.map(([k, r]) => (
                  <Caixa key={k} rotulo={r} valor={i[k] as number | null} />
                ))}
                {outras.map(([k, n]) => (
                  <Caixa key={k} rotulo={k} valor={n} />
                ))}
              </dl>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Por sessão</h4>
              <dl className="mt-2 flex flex-wrap gap-2">
                {SESSOES.map(([k, r]) => (
                  <Caixa key={k} rotulo={r} valor={i[k] as number | null} />
                ))}
              </dl>
              <p className="meta mt-1">
                Num mesmo dia pode haver mais de uma sessão. A justificativa de ausência é registrada por dia, não por sessão.
              </p>
            </div>
            <details className="cartao">
              <summary className="text-sm">Definições oficiais de cada contagem</summary>
              <dl className="mt-2 space-y-2 text-sm">
                {DEFINICOES.map(([k, r, d]) => (
                  <div key={k}>
                    <dt className="font-semibold text-gray-900">{r}</dt>
                    <dd className="text-gray-800">{d}</dd>
                  </div>
                ))}
              </dl>
            </details>
            <ul className="space-y-2">
              {p.sem_registro_no_servico.map((s) => (
                <li key={s.data} className="lacuna text-sm">
                  Em {formatarData(s.data)}, o arquivo oficial de eventos da Câmara registra sessão deliberativa
                  {s.descricao ? ` (“${s.descricao}”)` : ""}, mas o serviço oficial de frequência não traz nenhum registro desse
                  dia; por isso, ele não entra nas contagens acima.
                </li>
              ))}
              <li className="lacuna text-sm">
                O serviço oficial de frequência não lista os dias que só tiveram sessão conjunta do Congresso Nacional, que o
                relatório da página do deputado conta. Por isso, os números acima podem ficar abaixo dos do relatório oficial.
              </li>
              <li className="lacuna text-sm">O motivo de cada ausência justificada não é exibido; só a contagem por categoria oficial.</li>
            </ul>
            {urlOficial ? (
              <p>
                <FonteLink href={urlOficial} tipo="oficial">
                  Relatório oficial de presença na página do deputado
                </FonteLink>
              </p>
            ) : null}
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Fontes</h4>
              <div className="mt-2">
                <ListaFontes fontes={fontesPresenca(p)} />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
