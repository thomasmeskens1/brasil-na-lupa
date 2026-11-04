import { FonteLink } from "@/components/FonteLink";
import { TabelaResponsiva } from "@/components/tabela";
import type { LinhaFinanca, RelatorioFinancas } from "../tipos";
import { formatarData } from "@/features/estados/rotulos";

const REAL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const NAO = "Não informado na fonte";
const reais = (v: number | null | undefined) => (typeof v === "number" ? REAL.format(v) : NAO);

const MESES_BIM = ["janeiro e fevereiro", "março e abril", "maio e junho", "julho e agosto", "setembro e outubro", "novembro e dezembro"];

export function tituloRelatorio(r: RelatorioFinancas): string {
  return r.periodo === 6 ? `Exercício de ${r.exercicio} (ano completo)` : `${r.exercicio}, de janeiro até ${MESES_BIM[r.periodo - 1]?.split(" e ")[1] ?? `o ${r.periodo}º bimestre`}`;
}

function Relatorio({ r }: { r: RelatorioFinancas }) {
  const nota = (l: LinhaFinanca) => (l[1] && l[1].toLowerCase() !== l[0].toLowerCase() ? <span className="meta block">Na fonte: {l[1]}</span> : null);
  return (
    <div className="space-y-6">
      <p className="text-sm">
        Valores acumulados de janeiro até o fim do {r.periodo}º bimestre de {r.exercicio}, declarados por{" "}
        {r.instituicao ?? "município (nome da instituição não informado)"} no Relatório Resumido da Execução Orçamentária.
      </p>
      <TabelaResponsiva
        legenda="Receitas"
        linhas={r.receitas}
        chaveLinha={(l) => l[0]}
        colunas={[
          { chave: "linha", rotulo: "Receita", principal: true, celula: (l) => <>{l[0]}{nota(l)}</> },
          { chave: "prev", rotulo: "Prevista (atualizada)", numerica: true, celula: (l) => reais(l[2]) },
          { chave: "real", rotulo: "Arrecadada até o bimestre", numerica: true, celula: (l) => reais(l[3]) },
        ]}
        vazio="Receitas não informadas na fonte."
      />
      <TabelaResponsiva
        legenda="Despesas, por categoria econômica"
        linhas={r.despesas}
        chaveLinha={(l) => l[0]}
        colunas={[
          { chave: "linha", rotulo: "Despesa", principal: true, celula: (l) => <>{l[0]}{nota(l)}</> },
          { chave: "dot", rotulo: "Autorizada (dotação atualizada)", numerica: true, celula: (l) => reais(l[2]) },
          { chave: "emp", rotulo: "Empenhada", numerica: true, celula: (l) => reais(l[3]) },
          { chave: "liq", rotulo: "Liquidada", numerica: true, celula: (l) => reais(l[4]) },
          { chave: "pag", rotulo: "Paga", numerica: true, celula: (l) => reais(l[5]) },
        ]}
        vazio="Despesas não informadas na fonte."
      />
      {r.funcoes?.length ? (
        <TabelaResponsiva
          legenda="Despesas por função de governo (área), na ordem do relatório"
          linhas={r.funcoes}
          chaveLinha={(l) => l[0]}
          colunas={[
            { chave: "f", rotulo: "Função", principal: true, celula: (l) => l[0] },
            { chave: "dot", rotulo: "Autorizada (dotação atualizada)", numerica: true, celula: (l) => reais(l[1]) },
            { chave: "emp", rotulo: "Empenhada", numerica: true, celula: (l) => reais(l[2]) },
            { chave: "liq", rotulo: "Liquidada", numerica: true, celula: (l) => reais(l[3]) },
          ]}
        />
      ) : (
        <p className="lacuna text-sm">Despesa por função: Informação não disponível em fonte oficial.</p>
      )}
      <ul className="space-y-2 text-sm">
        <li>
          <FonteLink href={r.url} tipo="oficial">
            Balanço orçamentário (RREO, Anexo 1) — Siconfi
          </FonteLink>
          <span className="meta block">Tesouro Nacional · coletado em {formatarData(r.consultado_em)}</span>
        </li>
        {r.funcoes ? (
          <li>
            <FonteLink href={r.url_funcoes} tipo="oficial">
              Despesa por função (RREO, Anexo 2) — Siconfi
            </FonteLink>
            <span className="meta block">Tesouro Nacional · coletado em {formatarData(r.consultado_em)}</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** Finanças do município pelo Siconfi: o relatório mais recente aberto, os demais recolhidos. */
export function FinancasSiconfi({ relatorios }: { relatorios: RelatorioFinancas[] }) {
  if (!relatorios.length) return <p className="lacuna text-sm">Finanças: ainda não coletadas do Siconfi para este município.</p>;
  const [atual, ...outros] = [...relatorios].sort((a, b) => b.exercicio - a.exercicio || b.periodo - a.periodo);
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">{tituloRelatorio(atual)}</h3>
      <Relatorio r={atual} />
      {outros.map((r) => (
        <details key={r.chave} className="cartao">
          <summary>{tituloRelatorio(r)}</summary>
          <div className="mt-3">
            <Relatorio r={r} />
          </div>
        </details>
      ))}
    </div>
  );
}
