"use client";

/**
 * Busca central de "Quem me representa": um campo para nome do político ou cidade (com sugestões
 * de cidades, combobox acessível), filtros por cargo, estado e partido (ordem alfabética, sem cor
 * de partido) e cartão em janela modal. Os arquivos vêm de public/quem-me-representa/ (gerados no
 * build); nada do que é digitado sai do navegador — os filtros ficam só no endereço da página.
 */
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { UFS, CARGOS } from "./cargos";
import { situacaoLegivel } from "./Eleitos";
import { CartaoPolitico, fotoDaPessoa } from "./busca/CartaoPolitico";
import { FotoPolitico } from "@/components/politico/FotoPolitico";
import { Dialogo } from "./busca/Dialogo";
import {
  FILTROS_VAZIOS, GRUPOS_CARGO, filtrar, filtrosDaUrl, grupoDe, normalizar, pessoasDaBase, pessoasDoMunicipio, temFiltro, urlDosFiltros,
  type Filtros, type IdGrupo,
} from "./busca/filtro";
import type { ArquivoBase, ArquivoMun, Pessoa } from "./busca/tipos";

const PASSO = 40;
type Cidade = [string, string, string]; // nome, UF, slug

let promessaCidades: Promise<Cidade[]> | null = null;
function carregarCidades(): Promise<Cidade[]> {
  promessaCidades ??= fetch("/quem-me-representa/municipios.json")
    .then((r) => (r.ok ? r.json() : { m: [] }))
    .then((d: { m?: Cidade[] }) => d.m ?? [])
    .catch(() => {
      promessaCidades = null;
      return [];
    });
  return promessaCidades;
}

const nomeUf = (uf: string) => UFS.find((u) => u.sigla === uf)?.nome ?? uf;

export function BuscaRepresentantes() {
  const id = useId();
  const [base, setBase] = useState<ArquivoBase | null>(null);
  const [erroBase, setErroBase] = useState(false);
  const [mun, setMun] = useState<Record<string, ArquivoMun | "erro">>({});
  const [cidades, setCidades] = useState<Cidade[] | null>(null);
  const [f, setF] = useState<Filtros>(FILTROS_VAZIOS);
  const [pronto, setPronto] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [limite, setLimite] = useState(PASSO);
  const [escolhido, setEscolhido] = useState<Pessoa | null>(null);
  const q = useDeferredValue(f.q);

  // Arquivo principal e filtros vindos do endereço.
  useEffect(() => {
    let vivo = true;
    fetch("/quem-me-representa/r/base.json")
      .then((r) => (r.ok ? (r.json() as Promise<ArquivoBase>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!vivo) return;
        setBase(d);
        setF(filtrosDaUrl(new URLSearchParams(window.location.search), d.partidos));
        setPronto(true);
      })
      .catch(() => vivo && (setErroBase(true), setPronto(true)));
    return () => {
      vivo = false;
    };
  }, []);

  // Filtros → endereço (sem recarregar e sem histórico novo a cada tecla).
  useEffect(() => {
    if (!pronto) return;
    const alvo = `${window.location.pathname}${urlDosFiltros(f)}`;
    if (alvo !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", alvo);
  }, [f, pronto]);

  // Eleitos municipais da UF escolhida (arquivo da UF, baixado só quando preciso).
  const ufMun = (f.cidade ? f.cidade.slice(0, 2) : f.uf).toLowerCase();
  useEffect(() => {
    if (!ufMun || ufMun === "df" || mun[ufMun]) return;
    let vivo = true;
    fetch(`/quem-me-representa/r/mun/${ufMun}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<ArquivoMun>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => vivo && setMun((m) => ({ ...m, [ufMun]: d })))
      .catch(() => vivo && setMun((m) => ({ ...m, [ufMun]: "erro" })));
    return () => {
      vivo = false;
    };
  }, [ufMun, mun]);

  const pessoasBase = useMemo(() => (base ? pessoasDaBase(base) : []), [base]);
  const munAtual = ufMun ? mun[ufMun] : undefined;
  const pessoasMun = useMemo(() => (munAtual && munAtual !== "erro" ? pessoasDoMunicipio(munAtual) : []), [munAtual]);
  const filtros = useMemo(() => ({ ...f, q }), [f, q]);
  const ativoFiltro = temFiltro(filtros);
  const resultados = useMemo(
    () => (ativoFiltro ? filtrar([...pessoasBase, ...pessoasMun], filtros) : []),
    [ativoFiltro, pessoasBase, pessoasMun, filtros],
  );

  // Sugestões de cidade para o texto digitado.
  const sugestoes = useMemo(() => {
    const n = normalizar(f.q);
    if (n.length < 2 || !cidades) return [];
    const inicio: Cidade[] = [];
    const meio: Cidade[] = [];
    for (const c of cidades) {
      if (f.uf && c[1] !== f.uf) continue;
      const k = normalizar(c[0]);
      if (k.startsWith(n)) inicio.push(c);
      else if (k.includes(` ${n}`)) meio.push(c);
      if (inicio.length >= 6) break;
    }
    return [...inicio, ...meio].slice(0, 6);
  }, [f.q, f.uf, cidades]);
  const mostra = aberto && sugestoes.length > 0;

  const mudar = useCallback((parcial: Partial<Filtros>) => {
    setF((x) => ({ ...x, ...parcial }));
    setLimite(PASSO);
  }, []);

  function escolherCidade(c: Cidade | undefined) {
    if (!c) return;
    mudar({ cidade: `${c[1].toLowerCase()}/${c[2]}`, uf: c[1], q: "" });
    setAberto(false);
    setAtivo(-1);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setAtivo((a) => Math.min(sugestoes.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      if (mostra && ativo >= 0) {
        e.preventDefault();
        escolherCidade(sugestoes[ativo]);
      }
    } else if (e.key === "Escape" && mostra) {
      e.preventDefault();
      setAberto(false);
      setAtivo(-1);
    }
  }

  const cidadeAtual = useMemo(() => {
    if (!f.cidade) return null;
    const [uf, slug] = f.cidade.split("/");
    const m = munAtual && munAtual !== "erro" ? munAtual.municipios.find((x) => x[1] === slug) : null;
    const c = cidades?.find((x) => x[1].toLowerCase() === uf && x[2] === slug);
    return { uf: uf.toUpperCase(), nome: m?.[0] ?? c?.[0] ?? slug, encontrada: Boolean(m) };
  }, [f.cidade, munAtual, cidades]);

  const grupo = grupoDe(f.cargo);
  const semMunicipais = !f.uf && !f.cidade && (!grupo || grupo.municipal) && ativoFiltro;
  const carregandoMun = Boolean(ufMun && ufMun !== "df" && !munAtual);
  const visiveis = resultados.slice(0, limite);
  const grupos = useMemo(() => {
    const g: [string, Pessoa[]][] = [];
    for (const p of visiveis) {
      const ult = g.at(-1);
      if (ult && ult[0] === p.cargo) ult[1].push(p);
      else g.push([p.cargo, [p]]);
    }
    return g;
  }, [visiveis]);

  const fecharCartao = useCallback(() => setEscolhido(null), []);

  return (
    <div className="space-y-6">
      <form
        role="search"
        aria-label="Buscar políticos por nome ou cidade"
        onSubmit={(e) => {
          e.preventDefault();
          if (mostra && ativo >= 0) escolherCidade(sugestoes[ativo]);
          else setAberto(false);
        }}
        className="heroi text-center"
      >
        <label htmlFor={`${id}-q`} className="block text-lg font-semibold">
          Nome do político ou cidade
        </label>
        <div className="relative mx-auto mt-2 max-w-xl text-left">
          <input
            id={`${id}-q`}
            type="search"
            role="combobox"
            autoComplete="off"
            enterKeyHint="search"
            aria-autocomplete="list"
            aria-expanded={mostra}
            aria-controls={`${id}-lista`}
            aria-activedescendant={mostra && ativo >= 0 ? `${id}-op-${ativo}` : undefined}
            aria-describedby={`${id}-ajuda`}
            placeholder="Ex.: Atibaia, Tarcísio ou Silva"
            value={f.q}
            maxLength={80}
            onFocus={() => {
              if (!cidades) void carregarCidades().then(setCidades);
              setAberto(true);
            }}
            onBlur={() => setTimeout(() => setAberto(false), 150)}
            onChange={(e) => {
              mudar({ q: e.target.value });
              setAberto(true);
              setAtivo(-1);
            }}
            onKeyDown={onKey}
            className="min-h-14 w-full rounded-xl border-2 bg-[var(--background)] px-4 py-3 text-lg"
          />
          <ul
            id={`${id}-lista`}
            role="listbox"
            aria-label="Cidades encontradas"
            hidden={!mostra}
            className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-[var(--cor-borda-forte)] bg-[var(--cor-superficie)] shadow-lg"
          >
            {sugestoes.map((c, i) => (
              <li
                key={`${c[1]}-${c[2]}`}
                id={`${id}-op-${i}`}
                role="option"
                aria-selected={i === ativo}
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolherCidade(c);
                }}
                className={`flex min-h-11 cursor-pointer items-center px-3 py-2 ${i === ativo ? "bg-[var(--cor-acento-fundo)] outline outline-2 -outline-offset-2 outline-[var(--cor-foco)]" : ""}`}
              >
                <span>
                  Cidade: <strong>{c[0]}</strong> – {c[1]}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p id={`${id}-ajuda`} className="meta mx-auto mt-2 max-w-xl">
          A lista mostra os nomes que combinam com o que você digita. Para ver quem representa uma cidade, escolha-a nas sugestões (setas e Enter).
        </p>

        <fieldset className="mx-auto mt-5 grid max-w-3xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
          <legend className="sr-only">Filtros</legend>
          <div>
            <label htmlFor={`${id}-cargo`} className="block text-sm font-semibold">
              Cargo
            </label>
            <select
              id={`${id}-cargo`}
              value={f.cargo}
              onChange={(e) => mudar({ cargo: e.target.value as IdGrupo | "" })}
              className="mt-1 w-full rounded-md border border-[var(--cor-borda-forte)] bg-[var(--cor-superficie)] px-3 py-2"
            >
              <option value="">Todos os cargos</option>
              {GRUPOS_CARGO.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-uf`} className="block text-sm font-semibold">
              Estado
            </label>
            <select
              id={`${id}-uf`}
              value={f.uf}
              onChange={(e) => mudar({ uf: e.target.value, cidade: "" })}
              className="mt-1 w-full rounded-md border border-[var(--cor-borda-forte)] bg-[var(--cor-superficie)] px-3 py-2"
            >
              <option value="">Todos os estados</option>
              {UFS.map((u) => (
                <option key={u.sigla} value={u.sigla}>
                  {u.nome} ({u.sigla})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-partido`} className="block text-sm font-semibold">
              Partido <span className="font-normal">(na eleição)</span>
            </label>
            <select
              id={`${id}-partido`}
              value={f.partido}
              onChange={(e) => mudar({ partido: e.target.value })}
              className="mt-1 w-full rounded-md border border-[var(--cor-borda-forte)] bg-[var(--cor-superficie)] px-3 py-2"
            >
              <option value="">Todos os partidos</option>
              {(base?.partidos ?? []).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        {cidadeAtual || ativoFiltro ? (
          <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-2">
            {cidadeAtual ? (
              <button type="button" className="botao botao-mini" onClick={() => mudar({ cidade: "" })}>
                Cidade: {cidadeAtual.nome} ({cidadeAtual.uf})<span aria-hidden="true"> ×</span>
                <span className="sr-only"> — remover este filtro</span>
              </button>
            ) : null}
            <button type="button" className="botao botao-mini" onClick={() => mudar(FILTROS_VAZIOS)}>
              Limpar busca e filtros
            </button>
          </div>
        ) : null}
      </form>

      <section aria-labelledby={`${id}-res`}>
        <h2 id={`${id}-res`} className="text-xl font-semibold">
          {cidadeAtual ? `Quem representa ${cidadeAtual.nome} (${cidadeAtual.uf})` : "Resultados"}
        </h2>
        <p className="meta mt-1" aria-live="polite">
          {!pronto
            ? "Carregando a lista de eleitos…"
            : erroBase
              ? ""
              : !ativoFiltro
                ? "Digite um nome ou uma cidade, ou escolha um filtro."
                : carregandoMun
                  ? "Carregando os eleitos dos municípios…"
                  : `${resultados.length} ${resultados.length === 1 ? "pessoa encontrada" : "pessoas encontradas"}. Ordem: cargo e, dentro dele, nome em ordem alfabética.`}
        </p>
        {cidadeAtual ? (
          <p className="mt-1 text-sm">Na cidade (prefeito, vice e vereadores eleitos em 2024), no estado e em Brasília (eleitos em 2022 e, no Senado, também em 2018), e a Presidência.</p>
        ) : null}
        {erroBase ? <p className="lacuna mt-2">Não foi possível carregar a lista de eleitos agora. Tente de novo mais tarde.</p> : null}
        {munAtual === "erro" ? <p className="lacuna mt-2">Não foi possível carregar os eleitos dos municípios deste estado agora.</p> : null}
        {cidadeAtual && munAtual && munAtual !== "erro" && !cidadeAtual.encontrada ? (
          <p className="lacuna mt-2">
            Informação não disponível em fonte oficial: o arquivo do Tribunal Superior Eleitoral (TSE) não registra eleitos válidos neste município na eleição de 2024.
          </p>
        ) : null}
        {semMunicipais ? (
          <p className="aviso mt-3 text-sm">Para buscar também entre vereadores, prefeitos e vices, escolha o estado ou a cidade.</p>
        ) : null}

        {grupos.length ? (
          <div className="mt-4 space-y-5">
            {grupos.map(([cargo, lista], gi) => (
              <section key={`${cargo}-${gi}`} aria-label={CARGOS[cargo]?.plural ?? cargo}>
                <h3 className="text-base font-semibold text-[var(--cor-secundaria)]">{CARGOS[cargo]?.plural ?? cargo}</h3>
                <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {lista.map((p) => (
                    <li key={p.key}>
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => setEscolhido(p)}
                        className="cartao flex min-h-11 w-full items-center gap-3 text-left hover:border-[var(--cor-borda-forte)]"
                      >
                        <FotoPolitico nome={p.nome} foto={fotoDaPessoa(p, base)} tamanho="p" />
                        <span className="flex min-w-0 flex-col items-start">
                          <span className="font-semibold">{p.nome}</span>
                          <span className="text-sm text-[var(--cor-secundaria)]">
                            {CARGOS[p.cargo]?.singular ?? p.cargo}
                            {p.partido ? ` · ${p.partido} (eleição de ${p.ano})` : ""}
                            {" · "}
                            {p.uf === null ? "todo o país" : p.cidade ? `${p.cidade.nome} – ${p.uf}` : nomeUf(p.uf)}
                          </span>
                        </span>
                        {p.situacao && p.situacao !== "eleito" ? <span className="sr-only">, {situacaoLegivel(p.situacao)}</span> : null}
                        <span className="sr-only">. Abrir cartão.</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}
        {resultados.length > limite ? (
          <p className="mt-4 text-center">
            <button type="button" className="botao" onClick={() => setLimite((l) => l + PASSO * 5)}>
              Mostrar mais {Math.min(PASSO * 5, resultados.length - limite)} de {resultados.length - limite} restantes
            </button>
          </p>
        ) : null}
      </section>

      <Dialogo aberto={escolhido !== null} aoFechar={fecharCartao} idTitulo={`${id}-cartao`}>
        {escolhido ? <CartaoPolitico pessoa={escolhido} base={base} idTitulo={`${id}-cartao`} aoFechar={() => setEscolhido(null)} /> : null}
      </Dialogo>
    </div>
  );
}
