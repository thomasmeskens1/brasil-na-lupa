/**
 * Dado-chave da decisão: antes → depois, placar (só votação nominal), votação simbólica,
 * decisão sem votação, contagem oficial ou frase literal curta.
 *
 *   <BlocoDadoChave dado={{ tipo: "mudanca", antes: "R$ 1,57", depois: "R$ 1,64", unidade: "por litro" }} />
 *   <BlocoDadoChave dado={{ tipo: "placar", itens: placarOficial(v.placar), resultado: "aprovada" }} />
 *   <BlocoDadoChave dado={{ tipo: "simbolica", resultado: "aprovado" }} />
 *   <BlocoDadoChave dado={{ tipo: "sem-votacao", caminho: "ato individual do presidente da República" }} />
 *   <BlocoDadoChave dado={{ tipo: "contagem", legenda: "Trechos do veto", itens: [{rotulo:"Derrubados",valor:52}, …] }} />
 *   <BlocoDadoChave dado={d} tamanho="destaque" />   // cabeçalho de detalhe (números maiores)
 *
 * <BarraPlacar itens={…} /> pode ser usada sozinha. Cores: mesma família de cinza para todas
 * as opções, em ordem fixa; a cor nunca é a única pista (rótulo + número em texto).
 */
import type { DadoChave, ItemPlacar } from "./tipos";
import { NAO_DISPONIVEL, formatarData, formatarNumero } from "./rotulos";

const COR = ["var(--cor-placar-1)", "var(--cor-placar-2)", "var(--cor-placar-3)", "var(--cor-placar-4)", "var(--cor-placar-5)"];

export interface BarraPlacarProps {
  itens: ItemPlacar[];
  /** Mostra a legenda (rótulo + número) abaixo da barra. Padrão: sim. */
  legenda?: boolean;
  tamanho?: "cartao" | "destaque";
  className?: string;
}

/** Barra horizontal neutra + legenda completa. Decorativa para leitor de tela: a legenda é o dado. */
export function BarraPlacar({ itens, legenda = true, tamanho = "cartao", className = "" }: BarraPlacarProps) {
  const total = itens.reduce((s, i) => s + (i.valor > 0 ? i.valor : 0), 0);
  const grande = tamanho === "destaque";
  return (
    <div className={className}>
      {total > 0 ? (
        <div className="placar-barra" aria-hidden="true" style={grande ? { height: "1rem" } : undefined}>
          {itens.map((i, n) =>
            i.valor > 0 ? (
              <span
                key={i.rotulo}
                style={{
                  flexGrow: i.valor,
                  flexBasis: 0,
                  background: COR[Math.min(n, COR.length - 1)],
                }}
              />
            ) : null,
          )}
        </div>
      ) : null}
      {legenda ? (
        <dl className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 ${grande ? "" : "text-sm"}`}>
          {itens.map((i, n) => (
            <div key={i.rotulo} className="flex items-baseline gap-1.5">
              <span
                aria-hidden="true"
                className="placar-amostra self-center"
                style={{ background: COR[Math.min(n, COR.length - 1)] }}
              />
              <dt className="text-[var(--cor-secundaria)]">{i.rotulo}</dt>
              <dd className={`font-bold tabular-nums text-foreground ${grande ? "text-2xl" : "text-lg"}`}>
                {formatarNumero(i.valor)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export interface BlocoDadoChaveProps {
  dado: DadoChave;
  tamanho?: "cartao" | "destaque";
  className?: string;
}

export function BlocoDadoChave({ dado, tamanho = "cartao", className = "" }: BlocoDadoChaveProps) {
  const grande = tamanho === "destaque";
  const caixa = `rounded-md border border-borda bg-superficie px-3 py-2.5 ${className}`;
  const valor = grande ? "text-2xl sm:text-3xl" : "text-xl";
  switch (dado.tipo) {
    case "mudanca":
      return (
        <div className={caixa}>
          {dado.item ? <p className="text-sm font-semibold text-[var(--cor-secundaria)]">{dado.item}</p> : null}
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="flex items-baseline gap-1.5">
              <span className="text-sm text-[var(--cor-secundaria)]">Antes</span>
              <span className={`font-semibold tabular-nums ${dado.antes ? valor : "text-sm"}`}>
                {dado.antes ?? NAO_DISPONIVEL}
              </span>
            </span>
            <span aria-hidden="true" className="text-[var(--cor-secundaria)]">
              →
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-sm text-[var(--cor-secundaria)]">Depois</span>
              <span className={`font-bold tabular-nums ${dado.depois ? valor : "text-sm"}`}>
                {dado.depois ?? NAO_DISPONIVEL}
              </span>
            </span>
            {dado.unidade ? <span className="text-sm text-[var(--cor-secundaria)]">{dado.unidade}</span> : null}
          </p>
          {dado.vigencia ? (
            <p className="mt-1 text-sm text-[var(--cor-secundaria)]">
              a partir de <time dateTime={dado.vigencia}>{formatarData(dado.vigencia)}</time>
            </p>
          ) : null}
        </div>
      );
    case "placar":
      return (
        <div className={caixa}>
          <p className="text-sm font-semibold text-[var(--cor-secundaria)]">
            Placar oficial{dado.resultado ? <> · resultado: <span className="text-foreground">{dado.resultado}</span></> : null}
          </p>
          {dado.itens.length ? (
            <BarraPlacar itens={dado.itens} tamanho={tamanho} className="mt-2" />
          ) : (
            <p className="lacuna mt-2 text-sm">Placar: {NAO_DISPONIVEL}</p>
          )}
        </div>
      );
    case "contagem":
      return (
        <div className={caixa}>
          {dado.legenda ? <p className="text-sm font-semibold text-[var(--cor-secundaria)]">{dado.legenda}</p> : null}
          <BarraPlacar itens={dado.itens} tamanho={tamanho} className={dado.legenda ? "mt-2" : ""} />
        </div>
      );
    case "simbolica":
      return (
        <div className={caixa}>
          <p className={grande ? "text-lg" : ""}>
            <span className="font-semibold">Votação simbólica</span> — sem voto individual registrado
            {dado.resultado ? (
              <>
                {" "}
                · resultado: <span className="font-semibold">{dado.resultado}</span>
              </>
            ) : null}
          </p>
        </div>
      );
    case "sem-votacao":
      return (
        <div className={caixa}>
          <p className={grande ? "text-lg" : ""}>
            <span className="font-semibold">Decisão sem votação:</span> {dado.caminho}
          </p>
          {dado.detalhe ? <p className="mt-1 text-sm text-[var(--cor-secundaria)]">{dado.detalhe}</p> : null}
        </div>
      );
    case "texto":
      return (
        <div className={caixa}>
          {dado.rotulo ? <p className="text-sm font-semibold text-[var(--cor-secundaria)]">{dado.rotulo}</p> : null}
          <p className={grande ? "text-lg" : ""}>{dado.texto}</p>
        </div>
      );
  }
}
