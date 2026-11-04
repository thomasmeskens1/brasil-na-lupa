"use client";

/**
 * Painel de números oficiais + lista única filtrável por chips (Executivo e Justiça).
 *
 *   ┌ números grandes (cada um, quando tem filtro, aplica o filtro na lista) ┐
 *   │ children (ex.: explicação de cada tipo, com "Saiba mais")              │
 *   │ busca · listas (relator, ano) · chips (tipo, situação, tema…)         │
 *   │ cartões compactos (Cartão de Decisão), "Mostrar mais"                 │
 *   └────────────────────────────────────────────────────────────────────────┘
 *
 * Só dados serializáveis (pode ser chamado direto de uma página de servidor). Os valores dos
 * filtros são os textos da fonte; a contagem de cada chip é a quantidade de itens da lista com
 * aquele valor, dados os demais filtros. A ordem das opções é neutra (alfabética, cronológica ou
 * fixa) e a lista mantém a ordem recebida. O estado dos filtros vai para o endereço da página
 * (?tipo=…), para o leitor poder compartilhar a lista filtrada. Nada do que é digitado sai do navegador.
 */
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { CartaoDecisao, formatarData } from "@/components/decisao";
import { normalizarBusca } from "@/components/tabela";
import { MostrarMais } from "@/components/lista/MostrarMais";
import { ContadorAnimado } from "@/components/marca/ContadorAnimado";
import { montarCartao } from "../apresentacao";
import type { DadosCartao } from "./ListaCartoes";

export interface ItemFiltro {
  id: string;
  cartao: Partial<DadosCartao> & Pick<DadosCartao, "href" | "tituloOficial" | "caminho">;
  /** Texto onde a busca procura (além do título e do subtítulo). */
  busca?: string;
  /** Valor (ou valores) de cada faceta; ausente = o item não entra em nenhuma opção dela. */
  facetas: Record<string, string | string[] | null | undefined>;
  /** Linhas curtas abaixo do dado-chave (texto da fonte ou aviso de lacuna). */
  notas?: string[];
}

export interface Faceta {
  chave: string;
  rotulo: string;
  /** "chips" (botões) ou "lista" (caixa de seleção, para listas longas como relator e ano). */
  modo: "chips" | "lista";
  /** Frase curta sob o rótulo. */
  ajuda?: string;
  /** Ordem das opções: alfabética (padrão), decrescente (anos) ou fixa. */
  ordem?: "alfabetica" | "decrescente" | string[];
  /** Mostra a quantidade de itens em cada opção (padrão: sim). */
  contagem?: boolean;
  /** Fica em "Mais filtros". */
  secundaria?: boolean;
  /** Texto da opção sem filtro (padrão "Todos"). */
  todos?: string;
}

export interface NumeroOficial {
  valor: number;
  rotulo: string;
  /** Texto oficial de onde o número sai (ex.: situação "Afetado" na fonte). */
  explicacao?: string;
  /** Filtros aplicados à lista ao tocar no número. */
  filtro?: Record<string, string>;
}

export interface GrupoNumeros {
  id: string;
  titulo: string;
  descricao?: string;
  fontes: { titulo: string; url: string; orgao?: string | null; acessado_em?: string | null }[];
  itens: NumeroOficial[];
}

export interface ListaFiltrosProps {
  /** null enquanto carrega. */
  itens: ItemFiltro[] | null;
  erro?: boolean;
  facetas: Faceta[];
  /** Filtros fixos da página (não aparecem como chip). */
  fixos?: Record<string, string>;
  numeros?: GrupoNumeros[];
  busca: { rotulo: string; dica?: string };
  rotulo: { singular: string; plural: string };
  genero?: "m" | "f";
  /** Ordem da lista, em texto (anunciada com a contagem). */
  ordem: string;
  /** Título (h2) da lista. */
  tituloLista: string;
  idLista?: string;
  porPagina?: number;
  /** Conteúdo entre os números e a lista (ex.: explicação de cada tipo). */
  children?: ReactNode;
}

type Selecao = Record<string, string>;

const SEM_FIXOS: Selecao = {};

function valoresDe(it: ItemFiltro, chave: string): string[] {
  const v = it.facetas[chave];
  return v == null ? [] : Array.isArray(v) ? v.filter(Boolean) : v ? [v] : [];
}

function ordenar(valores: string[], ordem: Faceta["ordem"]): string[] {
  if (Array.isArray(ordem)) return [...ordem.filter((o) => valores.includes(o)), ...valores.filter((v) => !ordem.includes(v)).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  const v = [...valores].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  return ordem === "decrescente" ? v.reverse() : v;
}

const CAMPO = "mt-1 block w-full rounded border border-[var(--cor-borda-forte)] bg-white px-3 text-base text-foreground";
const CHIP =
  "inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors";
const CHIP_OFF = "border-[var(--cor-borda-forte)] bg-[var(--cor-superficie)] text-foreground hover:border-[var(--cor-acento)]";
const CHIP_ON = "border-[var(--cor-acento)] bg-[var(--cor-acento)] text-[var(--cor-sobre-acento)]";

export function ListaFiltros({
  itens,
  erro = false,
  facetas,
  fixos = SEM_FIXOS,
  numeros = [],
  busca,
  rotulo,
  genero = "m",
  ordem,
  tituloLista,
  idLista = "lista",
  porPagina = 20,
  children,
}: ListaFiltrosProps) {
  const base = useId();
  const [termo, setTermo] = useState("");
  const [sel, setSel] = useState<Selecao>({});
  const [limite, setLimite] = useState(porPagina);
  const titulo = useRef<HTMLHeadingElement>(null);
  const lido = useRef(false);
  const termoAdiado = useDeferredValue(termo);

  // Filtros vindos do endereço (?tipo=…&busca=…): lidos uma vez, ao abrir a página (o endereço é
  // um sistema externo ao React; a leitura fica num retorno de chamada, depois da hidratação).
  useEffect(() => {
    const t = window.setTimeout(() => {
      const p = new URLSearchParams(window.location.search);
      const s: Selecao = {};
      for (const f of facetas) {
        const v = p.get(f.chave);
        if (v) s[f.chave] = v;
      }
      const b = p.get("busca");
      if (Object.keys(s).length) setSel(s);
      if (b) setTermo(b);
      lido.current = true;
    }, 0);
    return () => window.clearTimeout(t);
  }, [facetas]);

  useEffect(() => {
    if (!lido.current) return;
    const p = new URLSearchParams(window.location.search);
    for (const f of facetas) {
      if (sel[f.chave]) p.set(f.chave, sel[f.chave]);
      else p.delete(f.chave);
    }
    if (termoAdiado.trim()) p.set("busca", termoAdiado.trim());
    else p.delete("busca");
    const q = p.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`);
  }, [sel, termoAdiado, facetas]);

  const indice = useMemo(
    () =>
      (itens ?? []).map((i) =>
        normalizarBusca(`${i.cartao.tituloOficial} ${i.cartao.simples?.titulo ?? ""} ${i.cartao.subtituloOficial ?? ""} ${i.busca ?? ""}`),
      ),
    [itens],
  );

  const partes = useMemo(() => normalizarBusca(termoAdiado).split(/\s+/).filter(Boolean), [termoAdiado]);
  const ativa: Selecao = useMemo(() => ({ ...sel, ...fixos }), [sel, fixos]);

  const passa = useMemo(() => {
    const lista = itens ?? [];
    // Por item: passa na busca? Por faceta: passa naquela faceta?
    const naBusca = lista.map((_, n) => partes.every((p) => indice[n].includes(p)));
    const chaves = Object.keys(ativa).filter((k) => ativa[k]);
    const porFaceta = lista.map((it) => Object.fromEntries(chaves.map((k) => [k, valoresDe(it, k).includes(ativa[k])])));
    return { naBusca, chaves, porFaceta };
  }, [itens, partes, indice, ativa]);

  const filtrados = useMemo(
    () => (itens ?? []).filter((_, n) => passa.naBusca[n] && passa.chaves.every((k) => passa.porFaceta[n][k])),
    [itens, passa],
  );

  // Opções e contagens de cada faceta, dados a busca e os demais filtros.
  const opcoes = useMemo(() => {
    const lista = itens ?? [];
    return Object.fromEntries(
      facetas.map((f) => {
        const cont = new Map<string, number>();
        lista.forEach((it, n) => {
          if (!passa.naBusca[n]) return;
          if (!passa.chaves.every((k) => k === f.chave || passa.porFaceta[n][k])) return;
          for (const v of valoresDe(it, f.chave)) cont.set(v, (cont.get(v) ?? 0) + 1);
        });
        const atual = sel[f.chave];
        if (atual && !cont.has(atual)) cont.set(atual, 0);
        return [f.chave, ordenar([...cont.keys()], f.ordem).map((v) => ({ valor: v, n: cont.get(v) ?? 0 }))];
      }),
    );
  }, [itens, facetas, passa, sel]);

  const visiveis = filtrados.slice(0, limite);
  const nome = (n: number) => (n === 1 ? rotulo.singular : rotulo.plural);
  const visiveisFacetas = facetas.filter((f) => !(f.chave in fixos));
  const principais = visiveisFacetas.filter((f) => !f.secundaria && f.modo === "chips");
  const listas = visiveisFacetas.filter((f) => !f.secundaria && f.modo === "lista");
  const secundarias = visiveisFacetas.filter((f) => f.secundaria);
  const ativosSecundarios = secundarias.filter((f) => sel[f.chave]).length;
  const ativos = visiveisFacetas.filter((f) => sel[f.chave]);

  function mudar(chave: string, valor: string) {
    setSel((s) => {
      const n = { ...s };
      if (valor) n[chave] = valor;
      else delete n[chave];
      return n;
    });
    setLimite(porPagina);
  }

  function limpar() {
    setSel({});
    setTermo("");
    setLimite(porPagina);
  }

  function aplicarNumero(filtro: Record<string, string>) {
    const n: Selecao = {};
    for (const [k, v] of Object.entries(filtro)) if (!(k in fixos)) n[k] = v;
    setSel(n);
    setTermo("");
    setLimite(porPagina);
    requestAnimationFrame(() => {
      titulo.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      titulo.current?.focus({ preventScroll: true });
    });
  }

  function grupoChips(f: Faceta) {
    const ops = opcoes[f.chave] ?? [];
    if (ops.length < 1) return null;
    const idRot = `${base}-${f.chave}`;
    const atual = sel[f.chave] ?? "";
    const comContagem = f.contagem !== false;
    return (
      <div key={f.chave} role="group" aria-labelledby={idRot} className="min-w-0">
        <p id={idRot} className="text-sm font-semibold text-foreground">
          {f.rotulo}
        </p>
        {f.ajuda ? <p className="meta mt-0.5">{f.ajuda}</p> : null}
        {/* No celular, uma linha por filtro que rola para o lado; no computador, as opções quebram linha. */}
        <ul className="relative -mx-1 mt-1.5 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
          <li className="shrink-0">
            <button type="button" aria-pressed={!atual} className={`${CHIP} ${!atual ? CHIP_ON : CHIP_OFF}`} onClick={() => mudar(f.chave, "")}>
              {f.todos ?? "Todos"}
            </button>
          </li>
          {ops.map((o) => {
            const on = atual === o.valor;
            return (
              <li key={o.valor} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={on}
                  className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
                  onClick={() => mudar(f.chave, on ? "" : o.valor)}
                >
                  {o.valor}
                  {comContagem ? (
                    <span className={`tabular-nums font-normal ${on ? "" : "text-[var(--cor-secundaria)]"}`}>
                      <span className="sr-only">:</span> {o.n.toLocaleString("pt-BR")}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  function caixaLista(f: Faceta) {
    const ops = opcoes[f.chave] ?? [];
    const id = `${base}-${f.chave}`;
    return (
      <label key={f.chave} htmlFor={id} className="block min-w-0 text-sm font-semibold text-foreground">
        {f.rotulo}
        <select id={id} value={sel[f.chave] ?? ""} onChange={(e) => mudar(f.chave, e.target.value)} className={CAMPO}>
          <option value="">{f.todos ?? "Todos"}</option>
          {ops.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.valor}
              {f.contagem !== false ? ` (${o.n.toLocaleString("pt-BR")})` : ""}
            </option>
          ))}
        </select>
        {f.ajuda ? <span className="meta mt-0.5 block font-normal">{f.ajuda}</span> : null}
      </label>
    );
  }

  const contagem = erro
    ? null
    : !itens
      ? `Carregando a lista de ${rotulo.plural}…`
      : `Mostrando ${visiveis.length.toLocaleString("pt-BR")} de ${filtrados.length.toLocaleString("pt-BR")} ${nome(filtrados.length)}, ${ordem}.`;

  return (
    <div className="space-y-10">
      {numeros.length ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {numeros.map((g) => (
            <section key={g.id} aria-labelledby={`${base}-${g.id}`} className="cartao">
              <h2 id={`${base}-${g.id}`} className="font-titulo text-lg font-bold text-foreground">
                {g.titulo}
              </h2>
              {g.descricao ? <p className="meta mt-1">{g.descricao}</p> : null}
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                {g.itens.map((i) => {
                  const corpo = (
                    <>
                      <ContadorAnimado valor={i.valor} className="block font-titulo text-3xl font-extrabold leading-tight text-foreground md:text-4xl" />
                      <span className="mt-1 block text-sm font-semibold leading-snug text-foreground">{i.rotulo}</span>
                      {i.explicacao ? <span className="meta mt-0.5 block font-normal">{i.explicacao}</span> : null}
                    </>
                  );
                  return (
                    <li key={i.rotulo} className="min-w-0">
                      {i.filtro ? (
                        <button
                          type="button"
                          onClick={() => aplicarNumero(i.filtro!)}
                          className="block h-full w-full rounded-xl border border-[var(--cor-borda)] bg-[var(--cor-superficie-2)] p-3 text-left transition-colors hover:border-[var(--cor-acento)]"
                        >
                          {corpo}
                          <span className="mt-1 block text-sm font-normal text-[var(--cor-secundaria)]">
                            <span aria-hidden="true">Ver na lista →</span>
                            <span className="sr-only">: mostrar na lista abaixo</span>
                          </span>
                        </button>
                      ) : (
                        <div className="h-full rounded-xl border border-[var(--cor-borda)] p-3">{corpo}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {g.fontes.length ? (
                <p className="meta mt-3">
                  Fonte:{" "}
                  {g.fontes.map((f, n) => (
                    <span key={`${f.url}-${n}`}>
                      {n ? "; " : ""}
                      <a href={f.url} className="lk" target="_blank" rel="noopener noreferrer">
                        {f.titulo}
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                      {f.acessado_em ? `, coletado em ${formatarData(f.acessado_em)}` : ""}
                    </span>
                  ))}
                  .
                </p>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}

      {children}

      <section id={idLista} aria-labelledby={`${base}-lista`} className="scroll-mt-20">
        <h2 id={`${base}-lista`} ref={titulo} tabIndex={-1} className="text-xl font-bold text-foreground focus:outline-none focus-visible:outline">
          {tituloLista}
        </h2>
        <div className="mt-4 space-y-4 rounded-2xl border border-[var(--cor-borda)] bg-[var(--cor-superficie)] p-3 md:p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label htmlFor={`${base}-busca`} className={`block min-w-0 text-sm font-semibold text-foreground ${listas.length ? "md:col-span-1" : "md:col-span-3"}`}>
              {busca.rotulo}
              <input
                id={`${base}-busca`}
                type="search"
                value={termo}
                placeholder={busca.dica}
                onChange={(e) => {
                  setTermo(e.target.value);
                  setLimite(porPagina);
                }}
                className={CAMPO}
              />
            </label>
            {listas.map(caixaLista)}
          </div>
          {principais.map(grupoChips)}
          {secundarias.length ? (
            <details className="rounded-md border border-borda">
              <summary className="pr-3">
                Mais filtros{ativosSecundarios ? ` (${ativosSecundarios} ${ativosSecundarios === 1 ? "ativo" : "ativos"})` : ""}
                <span className="font-normal text-[var(--cor-secundaria)]"> · {secundarias.map((f) => f.rotulo.toLowerCase()).join(", ")}</span>
              </summary>
              <div className="space-y-4 border-t border-borda p-3">
                {secundarias.map((f) => (f.modo === "chips" ? grupoChips(f) : caixaLista(f)))}
              </div>
            </details>
          ) : null}
          {ativos.length || termo ? (
            <ul className="flex flex-wrap gap-2" aria-label="Filtros ativos">
              {ativos.map((f) => (
                <li key={f.chave}>
                  <button type="button" className="botao py-1 text-sm font-medium" onClick={() => mudar(f.chave, "")}>
                    {f.rotulo}: {sel[f.chave]} <span aria-hidden="true">×</span>
                    <span className="sr-only"> (remover filtro)</span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="botao py-1 text-sm font-medium" onClick={limpar}>
                  Limpar tudo
                </button>
              </li>
            </ul>
          ) : null}
          {contagem ? (
            <p aria-live="polite" className="text-sm text-[var(--cor-secundaria)]">
              {contagem}
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          {erro ? <p className="lacuna text-sm">Não foi possível carregar a lista. Tente recarregar a página.</p> : null}
          {itens && !itens.length ? <p className="lacuna text-sm">Nenhum item coletado.</p> : null}
          {itens && itens.length && !filtrados.length ? (
            <p className="lacuna text-sm">Nenhum resultado com esses filtros. Tente limpar a busca ou os filtros.</p>
          ) : null}
          {visiveis.length ? (
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {visiveis.map((it) => (
                <CartaoDecisao key={it.id} as="li" nivelTitulo={3} limiteTitulo={140} {...montarCartao(undefined, it.cartao)}>
                  {it.notas?.length ? (
                    <div className="space-y-1">
                      {it.notas.map((n) => (
                        <p key={n} className="text-sm text-[var(--cor-secundaria)]">
                          {n}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </CartaoDecisao>
              ))}
            </ul>
          ) : null}
          <MostrarMais
            className="mt-3"
            visiveis={visiveis.length}
            total={filtrados.length}
            passo={porPagina}
            itens={rotulo}
            genero={genero}
            todos={false}
            aoMostrar={setLimite}
          />
        </div>
      </section>
    </div>
  );
}
