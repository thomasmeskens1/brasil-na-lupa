/**
 * Seções detalhadas ligadas ao resumo do topo do perfil: salário (subsídio), patrimônio declarado
 * ao TSE e propostas apresentadas. Só números oficiais, com critério e período escritos.
 */
import { SeloFonte } from "@/components/decisao/Selos";
import { ListaRecolhivel } from "@/components/lista/ListaRecolhivel";
import { Secao } from "@/components/Secao";
import { TabelaResponsiva } from "@/components/tabela/TabelaResponsiva";
import type { Patrimonio, Propostas } from "../resumo-topo";
import { SUBSIDIO } from "../resumo-topo";
import { NAO_DISPONIVEL, formatarData } from "../rotulos";
import type { Casa } from "../tipos";

export const real = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SecaoSalario({ casa }: { casa: Casa }) {
  return (
    <Secao
      id="salario"
      titulo="Salário (subsídio mensal)"
      descricao={`O subsídio é o mesmo para todos os deputados federais e senadores: o valor é fixado pelo Congresso Nacional em decreto legislativo, não por ${casa === "camara" ? "deputado" : "senador"}.`}
    >
      <div className="space-y-3">
        <p>
          <strong className="text-xl tabular-nums">{real(SUBSIDIO.valor)}</strong> por mês, desde {formatarData(SUBSIDIO.desde)}, segundo o{" "}
          {SUBSIDIO.ato} (art. 1º), publicado no {SUBSIDIO.publicacao}.
        </p>
        <TabelaResponsiva
          legenda="Valores fixados pelo decreto, por data de início"
          linhas={SUBSIDIO.escalonamento}
          chaveLinha={(l) => l.desde}
          colunas={[
            { chave: "desde", rotulo: "A partir de", principal: true, celula: (l) => formatarData(l.desde) },
            { chave: "valor", rotulo: "Subsídio mensal", numerica: true, celula: (l) => real(l.valor) },
          ]}
        />
        <p className="text-sm text-gray-700">
          O decreto também prevê ajuda de custo no início e no fim do mandato, em valor igual ao subsídio. Gastos do mandato pagos
          pela cota parlamentar são outra coisa e aparecem na seção da cota.
        </p>
        <SeloFonte fonte={SUBSIDIO.fonte} />
      </div>
    </Secao>
  );
}

export function SecaoPatrimonio({ dados, nome }: { dados: Patrimonio; nome: string }) {
  const i = dados.item;
  return (
    <Secao
      id="patrimonio"
      titulo="Patrimônio declarado à Justiça Eleitoral"
      descricao={dados.aviso ?? "Bens que o candidato declarou ao Tribunal Superior Eleitoral (TSE) no registro da candidatura."}
    >
      <div className="space-y-3">
        {i ? (
          <>
            <p>
              Na candidatura a {i.cargo.toLowerCase()} em {i.eleicao} ({i.uf}), {nome} declarou{" "}
              {i.quantidade_bens ? (
                <>
                  <strong className="tabular-nums">{i.quantidade_bens.toLocaleString("pt-BR")}</strong> {i.quantidade_bens === 1 ? "bem" : "bens"}, somando{" "}
                  <strong className="text-xl tabular-nums">{real(i.total)}</strong>.
                </>
              ) : (
                <strong>nenhum bem.</strong>
              )}
            </p>
            {i.bens.length ? (
              <TabelaResponsiva
                legenda={`Bens declarados em ${i.eleicao}, na ordem publicada pelo TSE (tipo e valor; a descrição de cada bem não é reproduzida)`}
                linhas={i.bens}
                chaveLinha={(_, k) => String(k)}
                colunas={[
                  { chave: "tipo", rotulo: "Tipo de bem", principal: true, celula: (b) => b[0] },
                  { chave: "valor", rotulo: "Valor declarado", numerica: true, celula: (b) => real(b[1]) },
                ]}
              />
            ) : null}
            {i.ultima_atualizacao_tse ? <p className="meta">Última atualização dos bens no arquivo do TSE: {formatarData(i.ultima_atualizacao_tse)}.</p> : null}
          </>
        ) : (
          <p className="lacuna">
            {NAO_DISPONIVEL}
            {dados.motivo ? ` (${dados.motivo}).` : "."}
          </p>
        )}
        {dados.criterio ? (
          <details className="text-sm text-gray-700">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">Como o site liga o parlamentar ao registro do TSE</summary>
            <p className="mt-1 max-w-3xl">{dados.criterio}</p>
          </details>
        ) : null}
        {dados.fonte ? <SeloFonte fonte={dados.fonte} /> : null}
      </div>
    </Secao>
  );
}

export function SecaoPropostas({ casa, dados }: { casa: Casa; dados: Propostas }) {
  const c = dados.contagem;
  const periodo = dados.periodo ? `de ${formatarData(dados.periodo.inicio)} a ${formatarData(dados.periodo.fim)}` : null;
  return (
    <Secao id="propostas" titulo="Propostas apresentadas" descricao={dados.criterio ?? undefined}>
      <div className="space-y-3">
        {c ? (
          <>
            <p>
              <strong className="text-xl tabular-nums">{c.total.toLocaleString("pt-BR")}</strong>{" "}
              {c.total === 1 ? "proposta apresentada" : "propostas apresentadas"} como autor ou coautor{periodo ? `, ${periodo}` : ""}
              {casa === "camara" && typeof c.primeiro_signatario === "number"
                ? `; em ${c.primeiro_signatario.toLocaleString("pt-BR")} delas, como primeiro signatário.`
                : "."}
            </p>
            <ul className="flex flex-wrap gap-2" aria-label="Por tipo de proposta">
              {dados.tipos.map((t) => (
                <li key={t.sigla} className="pilula-numero">
                  <strong className="tabular-nums text-foreground">{(c.por_tipo[t.sigla] ?? 0).toLocaleString("pt-BR")}</strong>
                  <span>
                    <abbr title={t.nome}>{t.sigla}</abbr>
                    <span className="sr-only"> ({t.nome})</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="lacuna">{NAO_DISPONIVEL}.</p>
        )}
        <h3 className="pt-2 font-semibold">Propostas de autoria que viraram norma</h3>
        {dados.criterioNorma ? <p className="max-w-3xl text-sm text-gray-700">{dados.criterioNorma}</p> : null}
        {dados.viraramNorma.length ? (
          <ListaRecolhivel
            rotulo={{ singular: "proposta", plural: "propostas" }}
            inicial={5}
            itens={dados.viraramNorma.map((p) => (
              <div key={p.id}>
                <a href={p.url} className="lk inline-flex min-h-11 items-center font-semibold" target="_blank" rel="noopener noreferrer">
                  {p.identificacao ?? "Proposição"}
                  <span aria-hidden="true">&nbsp;↗</span>
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
                {p.ordem === 1 ? <span className="selo ml-2">primeiro signatário</span> : null}
                {p.ementa ? <p className="text-sm text-gray-700">{p.ementa}</p> : null}
              </div>
            ))}
          />
        ) : (
          <p className="text-sm">Nenhuma no critério acima.</p>
        )}
        {dados.fonte ? <SeloFonte fonte={dados.fonte} /> : null}
      </div>
    </Secao>
  );
}
