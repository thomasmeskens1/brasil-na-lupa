"use client";

/**
 * Filtros "Quem cobra" e "O que é tributado" sobre os cartões dos impostos. Botões de opção
 * nativos (radio) dentro de fieldset: funcionam só com teclado (setas) e o leitor de tela
 * anuncia o grupo. A contagem é anunciada em região viva. Sem JavaScript, todos os cartões
 * aparecem (o estado inicial é "Todos").
 */
import { useId, useState, type ReactNode } from "react";
import type { Base, Esfera } from "../tipos";

export interface ItemFiltro {
  chave: string;
  esferas: Esfera[];
  base: Base;
  cartao: ReactNode;
}

const ESFERAS: { valor: Esfera | ""; rotulo: string }[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "federal", rotulo: "Federal (União)" },
  { valor: "estadual", rotulo: "Estadual" },
  { valor: "municipal", rotulo: "Municipal" },
];

const BASES: { valor: Base | ""; rotulo: string }[] = [
  { valor: "", rotulo: "Tudo" },
  { valor: "consumo", rotulo: "Consumo" },
  { valor: "renda", rotulo: "Renda" },
  { valor: "patrimonio", rotulo: "Patrimônio" },
];

const PILULA =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-[var(--cor-borda-forte)] bg-superficie px-4 text-base font-medium text-foreground transition-colors has-[:checked]:border-[var(--cor-acento)] has-[:checked]:bg-[var(--cor-acento)] has-[:checked]:font-bold has-[:checked]:text-[var(--cor-sobre-acento)] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--cor-foco)]";

function Grupo<T extends string>({
  legenda,
  nome,
  opcoes,
  valor,
  aoMudar,
}: {
  legenda: string;
  nome: string;
  opcoes: { valor: T | ""; rotulo: string }[];
  valor: T | "";
  aoMudar: (v: T | "") => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-[var(--cor-secundaria)]">{legenda}</legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <label key={o.valor || "todos"} className={PILULA}>
            <input
              type="radio"
              name={nome}
              value={o.valor}
              checked={valor === o.valor}
              onChange={() => aoMudar(o.valor)}
              className="sr-only"
            />
            {o.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FiltroImpostos({ itens }: { itens: ItemFiltro[] }) {
  const base = useId();
  const [esfera, setEsfera] = useState<Esfera | "">("");
  const [tributo, setTributo] = useState<Base | "">("");
  const visiveis = itens.filter((i) => (!esfera || i.esferas.includes(esfera)) && (!tributo || i.base === tributo));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-borda bg-superficie p-4 md:flex-row md:gap-8">
        <Grupo legenda="Quem cobra" nome={`${base}-esfera`} opcoes={ESFERAS} valor={esfera} aoMudar={setEsfera} />
        <Grupo legenda="O que é tributado" nome={`${base}-base`} opcoes={BASES} valor={tributo} aoMudar={setTributo} />
      </div>
      <p aria-live="polite" className="text-sm text-[var(--cor-secundaria)]">
        Mostrando {visiveis.length} de {itens.length} itens.
      </p>
      {visiveis.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((i) => (
            <li key={i.chave} className="revelar">
              {i.cartao}
            </li>
          ))}
        </ul>
      ) : (
        <p className="lacuna">Nenhum imposto com esta combinação de filtros.</p>
      )}
    </div>
  );
}
