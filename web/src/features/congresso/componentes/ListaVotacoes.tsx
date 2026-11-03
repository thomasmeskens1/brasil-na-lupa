"use client";

/**
 * Lista de votações agrupada por dia (Câmara e Senado juntos, da mais recente para a mais antiga),
 * com busca, filtros compactos e "Carregar mais". O servidor entrega os primeiros dias já
 * prontos (filtro padrão "Só o que muda leis"); o índice completo (public/congresso/busca.json)
 * só é baixado quando o visitante busca, filtra ou pede mais. Nada do que é digitado sai do navegador.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { CartaoDecisao } from "@/components/decisao/CartaoDecisao";
import { FiltrosCompactos } from "@/components/tabela/FiltrosCompactos";
import type { Casa } from "../tipos";
import { CASA_NOME, SIGLA_PROPOSICAO, normalizar, rotaVotacao } from "../rotulos";
import {
  CRITERIO_MUDA_LEI,
  LACUNA_MINIMA,
  agruparPorDia,
  casasDoFiltro,
  dadoDaVotacao,
  decodificar,
  explicacaoQuorum,
  formaDe,
  propPorExtenso,
  textoBusca,
  textoLacuna,
  tituloOficialVotacao,
  type GrupoDia,
  type IndiceBusca,
  type LinhaVotacao,
} from "../lista";

const POR_PAGINA = 30;
const PERIODOS = [
  { valor: "7", rotulo: "Últimos 7 dias" },
  { valor: "30", rotulo: "Últimos 30 dias" },
  { valor: "90", rotulo: "Últimos 90 dias" },
  { valor: "365", rotulo: "Últimos 12 meses" },
];
/** Sigla conhecida + número (+ ano opcional), ex.: "plp 108", "pec 45/2019". */
const RE_PROPOSICAO = new RegExp(
  `\\b(${Object.keys(SIGLA_PROPOSICAO).join("|").toLowerCase()})\\s*(\\d+)(?:\\s*\\/\\s*(\\d{4}))?\\b`,
  "g",
);

/** Data (AAAA-MM-DD) de `dias` dias atrás; "" sem período. Chamada só no clique. */
function dataInicial(dias: string): string {
  return dias ? new Date(new Date().getTime() - Number(dias) * 86400000).toISOString().slice(0, 10) : "";
}

const MEMBROS: Record<Casa, string> = { camara: "Deputados federais", senado: "Senadores" };

export interface ListaVotacoesProps {
  /** Primeiros dias, já no filtro padrão (servidor). */
  iniciais: LinhaVotacao[];
  temas: string[];
  anos: string[];
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

function Cartao({ l }: { l: LinhaVotacao }) {
  const q = explicacaoQuorum(l);
  return (
    <CartaoDecisao
      as="li"
      href={rotaVotacao(l.casa, l.id)}
      tituloOficial={tituloOficialVotacao(l)}
      simples={l.simples}
      subtituloOficial={propPorExtenso(l.proposicao)}
      caminho={l.casa}
      rotuloCaminho={l.casa === "camara" ? "Câmara" : "Senado"}
      forma={formaDe(l.tipo)}
      dado={dadoDaVotacao(l)}
      quemDecidiu={MEMBROS[l.casa]}
      fonte={l.fonteUrl ? { url: l.fonteUrl, orgao: CASA_NOME[l.casa], acessado_em: l.coletadoEm } : null}
      tema={l.tema}
      nivelTitulo={3}
    >
      {q ? (
        <p className="text-sm">
          <span className="font-semibold">Por que não foi aprovada:</span> {q.texto}
        </p>
      ) : null}
    </CartaoDecisao>
  );
}

export function ListaVotacoes({ iniciais, temas, anos }: ListaVotacoesProps) {
  const [todas, setTodas] = useState<LinhaVotacao[] | null>(null);
  const [erro, setErro] = useState(false);
  const pedido = useRef(false);
  const [texto, setTexto] = useState("");
  const [casa, setCasa] = useState("");
  const [tema, setTema] = useState("");
  const [periodo, setPeriodo] = useState("");
  /** Data inicial do período, calculada no momento da escolha (AAAA-MM-DD). */
  const [desde, setDesde] = useState("");
  const [ano, setAno] = useState("");
  const [soLeis, setSoLeis] = useState(true);
  const [limite, setLimite] = useState(POR_PAGINA);

  const carregar = useCallback(() => {
    if (pedido.current) return;
    pedido.current = true;
    fetch("/congresso/busca.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: IndiceBusca) => {
        const ls = decodificar(j);
        setTodas(ls);
      })
      .catch(() => {
        pedido.current = false;
        setErro(true);
      });
  }, []);

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

  const filtroAtivo = termos.length > 0 || props.length > 0 || !!casa || !!tema || !!periodo || !!ano || !soLeis;

  const filtradas = useMemo(() => {
    if (!indexadas) return iniciais;
    return indexadas
      .filter(
        ({ l, t, p }) =>
          (!soLeis || l.mudaLei) &&
          (!casa || l.casa === casa) &&
          (!tema || l.tema === tema) &&
          (!ano || l.data.startsWith(ano)) &&
          (!desde || l.data >= desde) &&
          props.every((x) => p.startsWith(x)) &&
          termos.every((x) => t.includes(x)),
      )
      .map(({ l }) => l);
  }, [indexadas, iniciais, soLeis, casa, tema, ano, desde, props, termos]);

  // Aviso de intervalo só faz sentido sem busca nem tema: senão o "vazio" é do filtro, não do Plenário.
  const avisoLacuna = soLeis && !tema && termos.length === 0 && props.length === 0;
  const grupos = useMemo(() => agruparPorDia(filtradas, avisoLacuna), [filtradas, avisoLacuna]);
  const aguardando = filtroAtivo && !todas;
  const { visiveis, mostradas } = cortarGrupos(aguardando ? [] : grupos, limite);
  const total = todas ? filtradas.length : null;

  function escolherPeriodo(v: string) {
    setPeriodo(v);
    setDesde(dataInicial(v));
  }

  function mudar(set: (v: string) => void) {
    return (v: string) => {
      carregar();
      setLimite(POR_PAGINA);
      set(v);
    };
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="O que mostrar" className="flex flex-wrap gap-2">
        {[
          [true, "Só o que muda leis"],
          [false, "Tudo"],
        ].map(([v, r]) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={soLeis === v}
            className={soLeis === v ? "botao botao-escuro" : "botao"}
            onClick={() => {
              if (soLeis !== v) {
                carregar();
                setLimite(POR_PAGINA);
                setSoLeis(v as boolean);
              }
            }}
          >
            {r as string}
          </button>
        ))}
      </div>
      <details className="rounded-md border border-borda bg-white">
        <summary className="pr-3">Como funciona o filtro “Só o que muda leis”</summary>
        <div className="space-y-2 border-t border-borda px-3 pb-3 pt-2">
          <p>{CRITERIO_MUDA_LEI}</p>
          <p className="text-sm text-[var(--cor-secundaria)]">
            Os avisos “Sem votação que muda lei” aparecem entre dois dias com votação quando o intervalo é de {LACUNA_MINIMA} dias
            ou mais. Eles são calculados só com as votações coletadas (veja “O que a coleta cobre”, mais abaixo).
          </p>
        </div>
      </details>

      <form role="search" aria-label="Buscar votações" onSubmit={(e) => e.preventDefault()} onFocus={carregar}>
        <FiltrosCompactos
          busca={{ valor: texto, aoMudar: mudar(setTexto), rotulo: "Buscar por assunto, proposição ou texto da votação", dica: "Ex.: imposto, MEI, PLP 108" }}
          filtros={[
            { id: "casa", rotulo: "Casa", valor: casa, aoMudar: mudar(setCasa), opcoes: [{ valor: "camara", rotulo: CASA_NOME.camara }, { valor: "senado", rotulo: CASA_NOME.senado }], todos: "As duas" },
            { id: "tema", rotulo: "Tema", valor: tema, aoMudar: mudar(setTema), opcoes: temas },
            { id: "periodo", rotulo: "Período", valor: periodo, aoMudar: mudar(escolherPeriodo), opcoes: PERIODOS, todos: "Todo o período" },
            { id: "ano", rotulo: "Ano", valor: ano, aoMudar: mudar(setAno), opcoes: anos },
          ]}
          contagem={
            erro
              ? "Não foi possível carregar o índice de votações. Tente recarregar a página."
              : aguardando
                ? "Carregando o índice de votações…"
                : total !== null
                  ? `${total.toLocaleString("pt-BR")} ${total === 1 ? "votação" : "votações"}, da mais recente para a mais antiga`
                  : "Votações mais recentes, da mais recente para a mais antiga"
          }
          aoLimpar={() => {
            setTexto("");
            setCasa("");
            setTema("");
            setPeriodo("");
            setDesde("");
            setAno("");
            setLimite(POR_PAGINA);
          }}
        />
      </form>

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
                <Cartao key={`${l.casa}-${l.id}`} l={l} />
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
