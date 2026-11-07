"use client";

/**
 * Painel de filtros compacto da ListaFiltros (usado na Justiça): busca, filtros em caixas de
 * seleção numa linha no computador (empilhadas no celular, atrás do botão "Filtros"), "Mais
 * filtros" recolhido, contador de resultados e "Limpar filtros". Só apresentação: a lógica, as
 * opções (na mesma ordem neutra) e as contagens vêm da ListaFiltros.
 */
import { useState } from "react";
import type { Faceta } from "./ListaFiltros";

export interface OpcaoFiltro {
  valor: string;
  n: number;
}

export interface FiltrosCompactosProps {
  base: string;
  facetas: Faceta[];
  opcoes: Record<string, OpcaoFiltro[]>;
  sel: Record<string, string>;
  mudar: (chave: string, valor: string) => void;
  limpar: () => void;
  termo: string;
  aoBuscar: (t: string) => void;
  busca: { rotulo: string; dica?: string };
  contagem: string | null;
}

const CAMPO = "mt-1 block w-full rounded border bg-white px-3 text-base text-foreground";

export function FiltrosCompactos({ base, facetas, opcoes, sel, mudar, limpar, termo, aoBuscar, busca, contagem }: FiltrosCompactosProps) {
  const [aberto, setAberto] = useState(false);
  const comOpcoes = facetas.filter((f) => (opcoes[f.chave] ?? []).length || sel[f.chave]);
  const principais = comOpcoes.filter((f) => !f.secundaria);
  const secundarias = comOpcoes.filter((f) => f.secundaria);
  const ativos = comOpcoes.filter((f) => sel[f.chave]).length;
  const ativosSec = secundarias.filter((f) => sel[f.chave]).length;
  const comAjuda = comOpcoes.filter((f) => f.ajuda);
  const idGrade = `${base}-filtros`;

  function caixa(f: Faceta) {
    const id = `${base}-${f.chave}`;
    const valor = sel[f.chave] ?? "";
    return (
      <label key={f.chave} htmlFor={id} className="flex min-w-0 flex-col justify-end text-sm font-semibold text-foreground">
        {f.rotulo}
        <select
          id={id}
          value={valor}
          onChange={(e) => mudar(f.chave, e.target.value)}
          aria-describedby={f.ajuda ? `${id}-ajuda` : undefined}
          className={`${CAMPO} ${valor ? "border-2 border-[var(--cor-acento)] font-semibold" : "border-[var(--cor-borda-forte)]"}`}
        >
          <option value="">{f.todos ?? "Todos"}</option>
          {(opcoes[f.chave] ?? []).map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.valor}
              {f.contagem !== false ? ` (${o.n.toLocaleString("pt-BR")})` : ""}
            </option>
          ))}
        </select>
        {f.ajuda ? (
          <span id={`${id}-ajuda`} className="sr-only">
            {f.ajuda}
          </span>
        ) : null}
      </label>
    );
  }

  const grade = "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))]";

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-[var(--cor-borda)] bg-[var(--cor-superficie)] p-3 md:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label htmlFor={`${base}-busca`} className="block min-w-0 flex-1 text-sm font-semibold text-foreground">
          {busca.rotulo}
          <input
            id={`${base}-busca`}
            type="search"
            value={termo}
            placeholder={busca.dica}
            onChange={(e) => aoBuscar(e.target.value)}
            className={`${CAMPO} border-[var(--cor-borda-forte)]`}
          />
        </label>
        {principais.length ? (
          <button
            type="button"
            className="botao md:hidden"
            aria-expanded={aberto}
            aria-controls={idGrade}
            onClick={() => setAberto((a) => !a)}
          >
            {aberto ? "Esconder filtros" : "Filtros"}
            {ativos ? ` (${ativos} ${ativos === 1 ? "ativo" : "ativos"})` : ""}
          </button>
        ) : null}
      </div>

      <div id={idGrade} className={`${aberto ? "block" : "hidden"} space-y-3 md:block`}>
        {principais.length ? <div className={grade}>{principais.map(caixa)}</div> : null}
        {secundarias.length ? (
          <details className="rounded-md border border-borda bg-white">
            <summary className="pr-3 text-sm">
              Mais filtros{ativosSec ? ` (${ativosSec} ${ativosSec === 1 ? "ativo" : "ativos"})` : ""}
              <span className="font-normal text-[var(--cor-secundaria)]"> · {secundarias.map((f) => f.rotulo.toLowerCase()).join(", ")}</span>
            </summary>
            <div className={`${grade} border-t border-borda p-3`}>{secundarias.map(caixa)}</div>
          </details>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-borda pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="text-sm text-[var(--cor-secundaria)]">
          {contagem}
        </p>
        <button
          type="button"
          className="botao shrink-0 self-start text-sm disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
          onClick={limpar}
          disabled={!ativos && !termo}
        >
          Limpar filtros
        </button>
      </div>

      {comAjuda.length ? (
        <details className="text-sm">
          <summary className="pr-3 text-[var(--cor-secundaria)]">Como funcionam os filtros</summary>
          <ul className="mt-1 list-disc space-y-1 pb-1 pl-8 text-[var(--cor-secundaria)]">
            {comAjuda.map((f) => (
              <li key={f.chave}>
                <span className="font-semibold text-foreground">{f.rotulo}:</span> {f.ajuda}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
