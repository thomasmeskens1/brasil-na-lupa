"use client";

/**
 * Lista de votações agrupada por dia (Câmara e Senado juntos, da mais recente para a mais antiga),
 * com busca, filtros em botões (chips: o que mostrar, casa, resultado, período e tema) e
 * "Carregar mais". O servidor entrega os primeiros dias já prontos (filtro padrão "Só o que muda
 * leis"); o índice completo (public/congresso/busca.json) só é baixado quando o visitante busca,
 * filtra ou pede mais. Nada do que é digitado sai do navegador.
 *
 * Os atalhos da página (/congresso?tema=…, ?casa=…, ?resultado=…) chegam em `inicial`
 * (ListaVotacoesComParametros).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { CASA_NOME, SIGLA_PROPOSICAO, normalizar } from "../rotulos";
import {
  CRITERIO_MUDA_LEI,
  LACUNA_MINIMA,
  agruparPorDia,
  casasDoFiltro,
  decodificar,
  textoBusca,
  textoLacuna,
  type GrupoDia,
  type IndiceBusca,
  type LinhaVotacao,
} from "../lista";
import { CartaoVotacao } from "./CartaoVotacao";

const POR_PAGINA = 30;
/** Sigla conhecida + número (+ ano opcional), ex.: "plp 108", "pec 45/2019". */
const RE_PROPOSICAO = new RegExp(
  `\\b(${Object.keys(SIGLA_PROPOSICAO).join("|").toLowerCase()})\\s*(\\d+)(?:\\s*\\/\\s*(\\d{4}))?\\b`,
  "g",
);

/** Data (AAAA-MM-DD) de `dias` dias atrás. Chamada só no clique. */
function dataInicial(dias: number): string {
  return new Date(new Date().getTime() - dias * 86400000).toISOString().slice(0, 10);
}

export interface FiltroInicial {
  tema?: string;
  casa?: string;
  resultado?: string;
}

export interface ListaVotacoesProps {
  /** Primeiros dias, já no filtro padrão (servidor). */
  iniciais: LinhaVotacao[];
  temas: string[];
  anos: string[];
  inicial?: FiltroInicial;
}

/** Grupos completos (dia inteiro) até atingir o limite de votações. */
function cortarGrupos(grupos: GrupoDia[], limite: number): { visiveis: GrupoDia[]; mostradas: number } {
  const visiveis: GrupoDia[] = [];
  let n = 0;
  for (const g of grupos) {
    if (n >= limite) break;
    visiveis.push(g);
    n += g.linhas.length;
  }
  return { visiveis, mostradas: n };
}

interface Opcao {
  valor: string;
  rotulo: string;
}

/** Grupo de botões de escolha única (aria-pressed). Mesmo visual para qualquer opção. */
function Chips({
  rotulo,
  opcoes,
  valor,
  aoMudar,
  rolar = false,
}: {
  rotulo: string;
  opcoes: Opcao[];
  valor: string;
  aoMudar: (v: string) => void;
  /** No celular, uma linha só com rolagem lateral (muitas opções). */
  rolar?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <span id={id} className="shrink-0 text-sm font-semibold text-foreground sm:w-24 sm:pt-3">
        {rotulo}
      </span>
      <div
        role="group"
        aria-labelledby={id}
        className={rolar ? "-mx-3 flex min-w-0 gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" : "flex flex-wrap gap-2"}
      >
        {opcoes.map((o) => {
          const ativo = valor === o.valor;
          return (
            <button
              key={o.valor || "todos"}
              type="button"
              aria-pressed={ativo}
              className={`${ativo ? "botao botao-escuro" : "botao"} shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm`}
              onClick={() => {
                if (!ativo) aoMudar(o.valor);
              }}
            >
              {o.rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const CAMPO = "mt-1 block w-full rounded border border-[var(--cor-borda-forte)] bg-white px-3 py-2.5 text-base text-foreground";

export function ListaVotacoes({ iniciais, temas, anos, inicial }: ListaVotacoesProps) {
  const idBusca = useId();
  const temaInicial = inicial?.tema && temas.includes(inicial.tema) ? inicial.tema : "";
  const casaInicial = inicial?.casa === "camara" || inicial?.casa === "senado" ? inicial.casa : "";
  const resultadoInicial = inicial?.resultado === "aprovada" || inicial?.resultado === "rejeitada" ? inicial.resultado : "";

  const [todas, setTodas] = useState<LinhaVotacao[] | null>(null);
  const [erro, setErro] = useState(false);
  const pedido = useRef(false);
  const [texto, setTexto] = useState("");
  const [casa, setCasa] = useState(casaInicial);
  const [tema, setTema] = useState(temaInicial);
  const [resultado, setResultado] = useState(resultadoInicial);
  /** "" | "d30" (últimos 30 dias) | "a2026" (ano). */
  const [periodo, setPeriodo] = useState("");
  /** Data inicial do período relativo, calculada no momento da escolha (AAAA-MM-DD). */
  const [desde, setDesde] = useState("");
  const [soLeis, setSoLeis] = useState(true);
  const [limite, setLimite] = useState(POR_PAGINA);

  const carregar = useCallback(() => {
    if (pedido.current) return;
    pedido.current = true;
    fetch("/congresso/busca.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: IndiceBusca) => setTodas(decodificar(j)))
      .catch(() => {
        pedido.current = false;
        setErro(true);
      });
  }, []);

  // Chegou por um atalho (tema, casa ou resultado): baixa o índice completo para filtrar.
  const veioDeAtalho = !!(temaInicial || casaInicial || resultadoInicial);
  useEffect(() => {
    if (veioDeAtalho) carregar();
  }, [veioDeAtalho, carregar]);

  const indexadas = useMemo(() => (todas ? todas.map((l) => ({ l, t: textoBusca(l), p: normalizar(l.proposicao ?? "") })) : null), [todas]);

  /** "PLP 108" ou "PLP 108/2024" buscam pela proposição; o resto, em todo o texto. */
  const { termos, props } = useMemo(() => {
    const props: string[] = [];
    const resto = normalizar(texto).replace(RE_PROPOSICAO, (_m, sg, n, a) => {
      props.push(a ? `${sg} ${n}/${a}` : `${sg} ${n}/`);
      return " ";
    });
    return { termos: resto.split(/\s+/).filter(Boolean), props };
  }, [texto]);

  const ano = periodo.startsWith("a") ? periodo.slice(1) : "";
  const algumFiltro = termos.length > 0 || props.length > 0 || !!casa || !!tema || !!resultado || !!periodo;
  const filtroAtivo = algumFiltro || !soLeis;

  const filtradas = useMemo(() => {
    if (!indexadas) return iniciais;
    return indexadas
      .filter(
        ({ l, t, p }) =>
          (!soLeis || l.mudaLei) &&
          (!casa || l.casa === casa) &&
          (!tema || l.tema === tema) &&
          (!resultado || l.resultado === resultado) &&
          (!ano || l.data.startsWith(ano)) &&
          (!desde || l.data >= desde) &&
          props.every((x) => p.startsWith(x)) &&
          termos.every((x) => t.includes(x)),
      )
      .map(({ l }) => l);
  }, [indexadas, iniciais, soLeis, casa, tema, resultado, ano, desde, props, termos]);

  // Aviso de intervalo só faz sentido sem busca, tema nem resultado: senão o "vazio" é do filtro, não do Plenário.
  const avisoLacuna = soLeis && !tema && !resultado && termos.length === 0 && props.length === 0;
  const grupos = useMemo(() => agruparPorDia(filtradas, avisoLacuna), [filtradas, avisoLacuna]);
  const aguardando = filtroAtivo && !todas;
  const { visiveis, mostradas } = cortarGrupos(aguardando ? [] : grupos, limite);
  const total = todas ? filtradas.length : null;

  function mudar(set: (v: string) => void) {
    return (v: string) => {
      carregar();
      setLimite(POR_PAGINA);
      set(v);
    };
  }

  function escolherPeriodo(v: string) {
    setPeriodo(v);
    setDesde(v.startsWith("d") ? dataInicial(Number(v.slice(1))) : "");
  }

  function limpar() {
    setTexto("");
    setCasa("");
    setTema("");
    setResultado("");
    setPeriodo("");
    setDesde("");
    setLimite(POR_PAGINA);
  }

  const contagem = erro
    ? "Não foi possível carregar o índice de votações. Tente recarregar a página."
    : aguardando
      ? "Carregando o índice de votações…"
      : total !== null
        ? `${total.toLocaleString("pt-BR")} ${total === 1 ? "votação" : "votações"}, da mais recente para a mais antiga`
        : "Votações mais recentes, da mais recente para a mais antiga";

  return (
    <div className="space-y-4">
      <form role="search" aria-label="Buscar e filtrar votações" onSubmit={(e) => e.preventDefault()} onFocus={carregar} className="space-y-3 rounded-2xl border border-borda bg-superficie p-3 sm:p-4">
        <label htmlFor={idBusca} className="block text-sm font-semibold text-foreground">
          Buscar por assunto, proposição ou texto da votação
          <input
            id={idBusca}
            type="search"
            value={texto}
            placeholder="Ex.: imposto, MEI, PLP 108"
            onChange={(e) => mudar(setTexto)(e.target.value)}
            className={CAMPO}
          />
        </label>
        <Chips
          rotulo="Mostrar"
          valor={soLeis ? "leis" : "tudo"}
          aoMudar={(v) => {
            carregar();
            setLimite(POR_PAGINA);
            setSoLeis(v === "leis");
          }}
          opcoes={[
            { valor: "leis", rotulo: "Só o que muda leis" },
            { valor: "tudo", rotulo: "Tudo, inclusive procedimentos" },
          ]}
        />
        <Chips
          rotulo="Casa"
          valor={casa}
          aoMudar={mudar(setCasa)}
          opcoes={[
            { valor: "", rotulo: "As duas" },
            { valor: "camara", rotulo: CASA_NOME.camara },
            { valor: "senado", rotulo: CASA_NOME.senado },
          ]}
        />
        <Chips
          rotulo="Resultado"
          valor={resultado}
          aoMudar={mudar(setResultado)}
          opcoes={[
            { valor: "", rotulo: "Todos" },
            { valor: "aprovada", rotulo: "Aprovada" },
            { valor: "rejeitada", rotulo: "Rejeitada" },
          ]}
        />
        <Chips
          rolar
          rotulo="Período"
          valor={periodo}
          aoMudar={mudar(escolherPeriodo)}
          opcoes={[
            { valor: "", rotulo: "Todo o período" },
            { valor: "d30", rotulo: "Últimos 30 dias" },
            { valor: "d90", rotulo: "Últimos 90 dias" },
            { valor: "d365", rotulo: "Últimos 12 meses" },
            ...anos.map((a) => ({ valor: `a${a}`, rotulo: a })),
          ]}
        />
        {temas.length ? (
          <Chips rolar rotulo="Tema" valor={tema} aoMudar={mudar(setTema)} opcoes={[{ valor: "", rotulo: "Todos" }, ...temas.map((t) => ({ valor: t, rotulo: t }))]} />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-borda pt-3">
          <p aria-live="polite" className="text-sm text-[var(--cor-secundaria)]">
            {contagem}
          </p>
          {algumFiltro ? (
            <button type="button" className="botao text-sm" onClick={limpar}>
              Limpar filtros
            </button>
          ) : null}
        </div>
      </form>

      <details className="rounded-md border border-borda bg-white">
        <summary className="pr-3">Saiba mais: como funciona “Só o que muda leis”</summary>
        <div className="space-y-2 border-t border-borda px-3 pb-3 pt-2">
          <p>{CRITERIO_MUDA_LEI}</p>
          <p className="text-sm text-[var(--cor-secundaria)]">
            Os avisos “Sem votação que muda lei” aparecem entre dois dias com votação quando o intervalo é de {LACUNA_MINIMA} dias
            ou mais. Eles são calculados só com as votações coletadas (veja “O que a coleta cobre”, mais abaixo). O tema vem do
            título em linguagem simples e segue a classificação oficial de cada casa; votações sem título simples aprovado não
            aparecem no filtro por tema.
          </p>
        </div>
      </details>

      {!aguardando && !visiveis.length ? <p className="lacuna">Nenhuma votação com esses filtros. Tente limpar os filtros.</p> : null}

      <div className="space-y-6">
        {visiveis.map((g, i) => (
          <section key={g.data || `g${i}`} aria-labelledby={`dia-${g.data}`}>
            <h3 id={`dia-${g.data}`} className="border-b border-borda pb-1 text-base font-bold text-foreground">
              {g.rotulo}
              <span className="block text-sm font-normal text-[var(--cor-secundaria)] sm:ml-2 sm:inline">{g.resumo}</span>
            </h3>
            <ul className="mt-3 space-y-3">
              {g.linhas.map((l) => (
                <CartaoVotacao key={`${l.casa}-${l.id}`} l={l} />
              ))}
            </ul>
            {g.lacunaDepois && i < visiveis.length - 1 ? (
              <p className="mt-6 rounded-md border border-dashed border-[var(--cor-borda-forte)] bg-superficie px-3 py-2 text-center text-sm text-[var(--cor-secundaria)]">
                {textoLacuna(g.lacunaDepois, casasDoFiltro(casa))}
              </p>
            ) : null}
          </section>
        ))}
      </div>

      {todas ? (
        mostradas < filtradas.length ? (
          <button type="button" className="botao" onClick={() => setLimite(mostradas + POR_PAGINA)}>
            Carregar mais votações ({(filtradas.length - mostradas).toLocaleString("pt-BR")} restantes)
          </button>
        ) : null
      ) : (
        <button
          type="button"
          className="botao"
          onClick={() => {
            carregar();
            setLimite(mostradas + POR_PAGINA);
          }}
        >
          Carregar mais votações
        </button>
      )}
    </div>
  );
}
