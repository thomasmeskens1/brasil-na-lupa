"use client";

/**
 * Campo "cidade ou estado" com autocompletar (combobox acessível: setas, Enter, Esc).
 * A lista de municípios (public/quem-me-representa/municipios.json, gerada no build) só é baixada
 * ao focar o campo. Nada do que é digitado sai do navegador; a escolha vai só para a URL.
 */
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { UFS } from "./cargos";

type Opcao = { tipo: "uf"; uf: string; nome: string } | { tipo: "m"; uf: string; nome: string; slug: string };

export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

let promessa: Promise<[string, string, string][]> | null = null;
function carregar(): Promise<[string, string, string][]> {
  promessa ??= fetch("/quem-me-representa/municipios.json")
    .then((r) => (r.ok ? r.json() : { m: [] }))
    .then((d: { m?: [string, string, string][] }) => d.m ?? [])
    .catch(() => {
      promessa = null;
      return [];
    });
  return promessa;
}

export function hrefDe(o: Opcao): string {
  const uf = o.uf.toLowerCase();
  return o.tipo === "uf" ? `/quem-me-representa/${uf}` : `/quem-me-representa/${uf}?cidade=${encodeURIComponent(o.slug)}#na-sua-cidade`;
}

export function BuscaLocal({ rotulo = "Sua cidade ou estado", compacto = false }: { rotulo?: string; compacto?: boolean }) {
  const id = useId();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<[string, string, string][] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const input = useRef<HTMLInputElement>(null);

  const opcoes = useMemo<Opcao[]>(() => {
    const n = normalizar(q);
    if (n.length < 2) return [];
    const ufs: Opcao[] = UFS.filter((u) => normalizar(u.nome).startsWith(n) || u.sigla.toLowerCase() === n).map((u) => ({
      tipo: "uf",
      uf: u.sigla,
      nome: u.nome,
    }));
    const inicio: Opcao[] = [];
    const meio: Opcao[] = [];
    for (const [nome, uf, slug] of lista ?? []) {
      const k = normalizar(nome);
      if (k.startsWith(n)) inicio.push({ tipo: "m", nome, uf, slug });
      else if (k.includes(` ${n}`)) meio.push({ tipo: "m", nome, uf, slug });
      if (inicio.length >= 12) break;
    }
    return [...ufs, ...inicio, ...meio].slice(0, 12);
  }, [q, lista]);

  // A opção ativa (setas) fica sempre visível dentro da lista rolável.
  useEffect(() => {
    if (ativo >= 0) document.getElementById(`${id}-op-${ativo}`)?.scrollIntoView({ block: "nearest" });
  }, [ativo, id]);

  function abrir() {
    if (!lista) void carregar().then(setLista);
  }

  function escolher(o: Opcao | undefined) {
    if (!o) return;
    setAberto(false);
    router.push(hrefDe(o));
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setAtivo((a) => Math.min(opcoes.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(0, a - 1));
    } else if (e.key === "Escape") {
      if (mostra) e.preventDefault();
      setAberto(false);
      setAtivo(-1);
    } else if (e.key === "Home" && mostra) {
      e.preventDefault();
      setAtivo(0);
    } else if (e.key === "End" && mostra) {
      e.preventDefault();
      setAtivo(opcoes.length - 1);
    }
  }

  const mostra = aberto && opcoes.length > 0;
  const semResultado = aberto && normalizar(q).length >= 2 && lista !== null && opcoes.length === 0;

  return (
    <form
      role="search"
      aria-label="Buscar representantes por cidade ou estado"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        escolher(opcoes[ativo >= 0 ? ativo : 0]);
      }}
    >
      <label htmlFor={`${id}-campo`} className={compacto ? "sr-only" : "block font-semibold"}>
        {rotulo}
      </label>
      <div className={`flex gap-2 ${compacto ? "" : "mt-1"}`}>
        <input
          ref={input}
          id={`${id}-campo`}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={mostra}
          aria-controls={`${id}-lista`}
          aria-activedescendant={mostra && ativo >= 0 ? `${id}-op-${ativo}` : undefined}
          aria-describedby={`${id}-ajuda`}
          placeholder="Ex.: Atibaia ou São Paulo"
          value={q}
          onFocus={() => {
            abrir();
            setAberto(true);
          }}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onChange={(e) => {
            setQ(e.target.value);
            setAberto(true);
            setAtivo(-1);
          }}
          onKeyDown={onKey}
          className="min-w-0 flex-1 rounded-md border border-[var(--cor-borda-forte)] bg-white px-3 py-2 text-base"
        />
        <button type="submit" className="botao botao-escuro">
          Ver<span className="sr-only"> os representantes</span>
        </button>
      </div>
      <p id={`${id}-ajuda`} className="meta mt-1">
        Digite ao menos 2 letras e escolha na lista. A escolha fica só no endereço da página.
      </p>
      <ul
        id={`${id}-lista`}
        role="listbox"
        aria-label="Cidades e estados encontrados"
        hidden={!mostra}
        className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-[var(--cor-borda-forte)] bg-white shadow-lg"
      >
        {opcoes.map((o, i) => (
          <li
            key={`${o.tipo}-${o.uf}-${o.nome}`}
            id={`${id}-op-${i}`}
            role="option"
            aria-selected={i === ativo}
            onMouseDown={(e) => {
              e.preventDefault();
              escolher(o);
            }}
            className={`flex min-h-11 cursor-pointer items-center px-3 py-2 ${
              i === ativo ? "bg-[var(--cor-acento-fundo)] outline outline-2 -outline-offset-2 outline-[var(--cor-foco)]" : ""
            }`}
          >
            {o.tipo === "uf" ? (
              <span>
                <strong>{o.nome}</strong> (estado)
              </span>
            ) : (
              <span>
                {o.nome} – {o.uf}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {mostra
          ? `${opcoes.length} ${opcoes.length === 1 ? "resultado" : "resultados"}; use as setas para cima e para baixo e Enter para escolher.`
          : semResultado
            ? "Nenhuma cidade ou estado encontrado."
            : ""}
      </p>
      {semResultado ? <p className="mt-1 text-sm">Nenhuma cidade ou estado encontrado com esse nome.</p> : null}
    </form>
  );
}
