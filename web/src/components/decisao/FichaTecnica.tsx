/**
 * Ficha técnica recolhível (details/summary com alvo ≥ 44 px; funciona sem JavaScript).
 * Campos sem dado não ocupam a tela: vão para uma linha "A fonte oficial não informa: …".
 *
 *   <FichaTecnica
 *     itens={[
 *       { rotulo: "Órgão", valor: "Plenário" },
 *       { rotulo: "Horário", valor: null },            // → "A fonte oficial não informa: Horário"
 *       { rotulo: "Proposição", valor: <a href=…>PLP 108/2024</a> },
 *     ]}
 *   />
 *   <ItemRecolhivel resumo="Texto oficial (ementa)">"Altera a Lei…"</ItemRecolhivel>
 */
import type { ReactNode } from "react";

export interface ItemFicha {
  rotulo: string;
  /** null/undefined/"" = a fonte não informa. */
  valor: ReactNode | null | undefined;
}

export interface FichaTecnicaProps {
  itens: ItemFicha[];
  /** Texto do summary. Padrão: "Ficha técnica". */
  titulo?: string;
  aberto?: boolean;
  className?: string;
}

export function FichaTecnica({ itens, titulo = "Ficha técnica", aberto = false, className = "" }: FichaTecnicaProps) {
  const vazio = (v: ReactNode) => v === null || v === undefined || v === "" || v === false;
  const com = itens.filter((i) => !vazio(i.valor));
  const sem = itens.filter((i) => vazio(i.valor)).map((i) => i.rotulo);
  return (
    <details className={`rounded-md border border-borda bg-white ${className}`} open={aberto || undefined}>
      <summary className="pr-3">
        {titulo} <span className="font-normal text-[var(--cor-secundaria)]">({com.length} {com.length === 1 ? "campo" : "campos"})</span>
      </summary>
      <div className="border-t border-borda px-3 pb-3 pt-2">
        {com.length ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {com.map((i) => (
              <div key={i.rotulo} className="min-w-0">
                <dt className="text-sm text-[var(--cor-secundaria)]">{i.rotulo}</dt>
                <dd className="font-medium text-foreground">{i.valor}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {sem.length ? (
          <p className="lacuna mt-3 text-sm">A fonte oficial não informa: {sem.join(", ")}.</p>
        ) : null}
      </div>
    </details>
  );
}

export interface ItemRecolhivelProps {
  /** Uma linha (o que o leitor vê fechado). */
  resumo: ReactNode;
  /** Selo à direita do resumo (ex.: situação "Derrubado"). */
  selo?: ReactNode;
  aberto?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

/** Item de acordeão (details/summary). Use dentro de ListaRecolhivel para listas longas. */
export function ItemRecolhivel({ resumo, selo, aberto = false, id, className = "", children }: ItemRecolhivelProps) {
  return (
    <details id={id} className={`rounded-md border border-borda bg-white ${className}`} open={aberto || undefined}>
      <summary className="pr-3">
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="min-w-0">{resumo}</span>
          {selo ? <span className="shrink-0">{selo}</span> : null}
        </span>
      </summary>
      <div className="border-t border-borda px-3 pb-3 pt-2">{children}</div>
    </details>
  );
}
