import { FonteLink } from "@/components/FonteLink";
import type { AnoFinancas, MesFinancas } from "../dados";

const REAL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const MILHOES = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function reais(v: number | null | undefined): string {
  return typeof v === "number" ? REAL.format(v) : "—";
}

function data(v: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "data não informada";
}

type Medida = { chave: string; titulo: string; valor: (m: MesFinancas) => number | null | undefined };

const MEDIDAS: Medida[] = [
  { chave: "receita", titulo: "Receita arrecadada", valor: (m) => m.receita },
  { chave: "empenhado", titulo: "Despesa empenhada", valor: (m) => m.despesa.empenhado },
  { chave: "liquidado", titulo: "Despesa liquidada", valor: (m) => m.despesa.liquidado },
  { chave: "pago", titulo: "Despesa paga", valor: (m) => m.despesa.pago },
];

/** Barras horizontais de uma medida, mês a mês (uma série, um tom neutro, escala própria indicada). */
function Barras({ medida, meses }: { medida: Medida; meses: MesFinancas[] }) {
  const comDados = meses.filter((m) => m.com_dados);
  const max = Math.max(0, ...comDados.map((m) => medida.valor(m) ?? 0));
  return (
    <figure className="cartao">
      <figcaption className="text-sm font-semibold text-gray-900">{medida.titulo}, por mês</figcaption>
      <ul className="mt-3 space-y-1.5">
        {meses.map((m) => {
          const v = m.com_dados ? medida.valor(m) : null;
          const pct = typeof v === "number" && max > 0 ? Math.max(0.5, (v / max) * 100) : 0;
          return (
            <li key={m.mes} className="grid grid-cols-[2.25rem_1fr] items-center gap-2 text-xs" title={`${m.nome}: ${typeof v === "number" ? reais(v) : "sem dados"}`}>
              <span className="text-[var(--cor-secundaria)]">{m.nome.slice(0, 3)}</span>
              {typeof v === "number" ? (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-3 rounded-r bg-[var(--cor-placar-2)]" style={{ width: `${pct * 0.62}%` }} aria-hidden="true" />
                  <span className="shrink-0 text-gray-900">{MILHOES.format(v / 1e6)} mi</span>
                </span>
              ) : (
                <span className="text-[var(--cor-secundaria)]">sem dados no TCE-SP</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="meta mt-2">Valores em milhões de reais (“mi”). Cada gráfico tem a própria escala.</p>
    </figure>
  );
}

function DetalheMes({ m }: { m: MesFinancas }) {
  return (
    <details className="rounded border border-borda">
      <summary className="px-3 py-2 text-sm">
        {m.nome[0].toUpperCase() + m.nome.slice(1)}: receitas por órgão e por fonte, despesas por órgão
      </summary>
      <div className="space-y-3 border-t border-borda px-3 py-2 text-sm">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`Despesas por órgão em ${m.nome}`}>
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Órgão (despesas)</th>
                <th scope="col">Empenhado</th>
                <th scope="col">Liquidado</th>
                <th scope="col">Pago</th>
              </tr>
            </thead>
            <tbody>
              {m.despesa_por_orgao.map(([o, ev]) => (
                <tr key={o}>
                  <td>{o}</td>
                  <td className="whitespace-nowrap">{reais(ev.empenhado)}</td>
                  <td className="whitespace-nowrap">{reais(ev.liquidado)}</td>
                  <td className="whitespace-nowrap">{reais(ev.pago)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="space-y-1">
          {m.receita_por_orgao.map(([o, v]) => (
            <li key={o}>
              <span className="font-medium">Receita de {o}:</span> {reais(v)}
            </li>
          ))}
        </ul>
        <ul className="space-y-1">
          {m.receita_por_fonte.map(([o, v]) => (
            <li key={o}>
              <span className="font-medium">Fonte de recurso {o}:</span> {reais(v)}
            </li>
          ))}
        </ul>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          {m.url_receitas ? (
            <FonteLink href={m.url_receitas} tipo="oficial">
              Receitas do mês (API do TCE-SP)
            </FonteLink>
          ) : null}
          {m.url_despesas ? (
            <FonteLink href={m.url_despesas} tipo="oficial">
              Despesas do mês (API do TCE-SP)
            </FonteLink>
          ) : null}
        </p>
        <p className="meta">Consultado em {data(m.consultado_em)}.</p>
      </div>
    </details>
  );
}

/** Finanças de um exercício: gráficos por fase, tabela mensal e detalhes por mês. */
export function FinancasAno({ a }: { a: AnoFinancas }) {
  const semDados = a.meses.filter((m) => !m.com_dados).map((m) => m.nome);
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-800">
        Último mês com dados no TCE-SP: <strong>{a.ultimo_mes_com_dados?.nome ?? "nenhum"}</strong>
        {a.ultimo_mes_com_dados?.verificado_em ? ` (verificado em ${data(a.ultimo_mes_com_dados.verificado_em)})` : ""}.
        {semDados.length ? ` Meses ainda sem dados: ${semDados.join(", ")}.` : ""}
        {a.atualizacao_informada?.despesas ? ` O TCE-SP informa atualização dos arquivos em ${data(a.atualizacao_informada.despesas)}.` : ""}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {MEDIDAS.map((m) => (
          <Barras key={m.chave} medida={m} meses={a.meses} />
        ))}
      </div>
      <div className="overflow-x-auto rounded border border-borda" tabIndex={0} role="region" aria-label={`Receitas e despesas por mês em ${a.ano}`}>
        <table className="tabela">
          <caption className="sr-only">Receitas e despesas por mês em {a.ano}, em reais</caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              {MEDIDAS.map((m) => (
                <th key={m.chave} scope="col">
                  {m.titulo}
                </th>
              ))}
              <th scope="col">Anulação de empenho</th>
            </tr>
          </thead>
          <tbody>
            {a.meses.map((m) => (
              <tr key={m.mes}>
                <td>{m.nome}</td>
                {MEDIDAS.map((x) => (
                  <td key={x.chave} className="whitespace-nowrap">
                    {m.com_dados ? reais(x.valor(m)) : "sem dados"}
                  </td>
                ))}
                <td className="whitespace-nowrap">{m.com_dados ? reais(m.despesa.anulacao) : "sem dados"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-800">
        As fases da despesa não se somam: o mesmo gasto aparece primeiro como empenhado, depois como liquidado e, por fim, como
        pago. {(a.metodo ?? "").replace(/"valores_nao_lidos"/g, "“valores não lidos”")}
      </p>
      {a.meses.some((m) => m.nao_lidos > 0) ? <p className="lacuna text-sm">Há valores em formato não numérico na fonte, não somados.</p> : null}
      <div className="space-y-2">
        {a.meses.filter((m) => m.com_dados).map((m) => (
          <DetalheMes key={m.mes} m={m} />
        ))}
      </div>
      {a.aviso_oficial ? (
        <p className="meta">
          Aviso do TCE-SP: “{a.aviso_oficial}”
        </p>
      ) : null}
    </div>
  );
}
