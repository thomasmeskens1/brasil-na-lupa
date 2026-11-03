"use client";

/**
 * Busca e filtros compactos para o celular: a busca fica sempre visível; os filtros ficam numa
 * linha recolhível atrás do botão "Filtros (n)". Filtros ativos aparecem como chips com "×".
 * Componente controlado: o estado fica em quem usa (componente cliente da seção).
 *
 *   const [busca, setBusca] = useState(""); const [uf, setUf] = useState("");
 *   <FiltrosCompactos
 *     busca={{ valor: busca, aoMudar: setBusca, rotulo: "Buscar pelo nome", dica: "Ex.: Silva" }}
 *     filtros={[{ id: "uf", rotulo: "Estado (UF)", valor: uf, aoMudar: setUf, opcoes: ["AC", "AL", …] }]}
 *     contagem={`Mostrando ${n} de ${total} deputados`}
 *     aoLimpar={() => { setBusca(""); setUf(""); }}
 *   />
 */
import { useId, useState, type ReactNode } from "react";

export interface OpcaoFiltro {
  valor: string;
  rotulo: string;
}

export interface FiltroCompacto {
  id: string;
  rotulo: string;
  /** "" = todos. */
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: (string | OpcaoFiltro)[];
  /** Texto da opção vazia. Padrão: "Todos". */
  todos?: string;
}

export interface FiltrosCompactosProps {
  busca?: { valor: string; aoMudar: (v: string) => void; rotulo: string; dica?: string };
  filtros?: FiltroCompacto[];
  /** Contagem anunciada (aria-live), ex.: "Mostrando 12 de 435 votos". */
  contagem?: ReactNode;
  /** Limpa busca e filtros. */
  aoLimpar?: () => void;
  className?: string;
}

const CAMPO =
  "block w-full rounded border border-[var(--cor-borda-forte)] bg-white px-3 text-base text-foreground";

function opcao(o: string | OpcaoFiltro): OpcaoFiltro {
  return typeof o === "string" ? { valor: o, rotulo: o } : o;
}

export function FiltrosCompactos({ busca, filtros = [], contagem, aoLimpar, className = "" }: FiltrosCompactosProps) {
  const base = useId();
  const [aberto, setAberto] = useState(false);
  const ativos = filtros.filter((f) => f.valor);
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-end gap-2">
        {busca ? (
          <label htmlFor={`${base}-busca`} className="min-w-0 flex-1 text-sm font-medium text-foreground">
            {busca.rotulo}
            <input
              id={`${base}-busca`}
              type="search"
              value={busca.valor}
              placeholder={busca.dica}
              onChange={(e) => busca.aoMudar(e.target.value)}
              className={`mt-1 ${CAMPO}`}
            />
          </label>
        ) : null}
        {filtros.length ? (
          <button
            type="button"
            className="botao shrink-0"
            aria-expanded={aberto}
            aria-controls={`${base}-filtros`}
            onClick={() => setAberto((v) => !v)}
          >
            Filtros{ativos.length ? ` (${ativos.length})` : ""}
            <span aria-hidden="true">{aberto ? "▴" : "▾"}</span>
          </button>
        ) : null}
      </div>
      {filtros.length ? (
        <div id={`${base}-filtros`} hidden={!aberto} className="flex flex-wrap gap-2 rounded-md border border-borda bg-superficie p-2">
          {filtros.map((f) => (
            <label key={f.id} htmlFor={`${base}-${f.id}`} className="min-w-[9rem] flex-1 text-sm font-medium text-foreground">
              {f.rotulo}
              <select id={`${base}-${f.id}`} value={f.valor} onChange={(e) => f.aoMudar(e.target.value)} className={`mt-1 ${CAMPO}`}>
                <option value="">{f.todos ?? "Todos"}</option>
                {f.opcoes.map(opcao).map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}
      {ativos.length || (busca && busca.valor) ? (
        <ul className="flex flex-wrap gap-2" aria-label="Filtros ativos">
          {ativos.map((f) => {
            const r = f.opcoes.map(opcao).find((o) => o.valor === f.valor)?.rotulo ?? f.valor;
            return (
              <li key={f.id}>
                <button type="button" className="botao py-1 text-sm font-medium" onClick={() => f.aoMudar("")}>
                  {f.rotulo}: {r} <span aria-hidden="true">×</span>
                  <span className="sr-only"> (remover filtro)</span>
                </button>
              </li>
            );
          })}
          {aoLimpar ? (
            <li>
              <button type="button" className="botao py-1 text-sm font-medium" onClick={aoLimpar}>
                Limpar tudo
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
      {contagem ? (
        <p aria-live="polite" className="text-sm text-[var(--cor-secundaria)]">
          {contagem}
        </p>
      ) : null}
    </div>
  );
}
