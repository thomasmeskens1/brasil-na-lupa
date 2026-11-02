"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";

export interface ItemNav {
  href: string;
  rotulo: string;
}

export const ITENS_NAV: ItemNav[] = [
  { href: "/", rotulo: "Início" },
  { href: "/impostos", rotulo: "Impostos" },
  { href: "/congresso", rotulo: "Congresso" },
  { href: "/executivo", rotulo: "Executivo" },
  { href: "/justica", rotulo: "Justiça" },
  { href: "/sao-paulo", rotulo: "São Paulo" },
  { href: "/atibaia", rotulo: "Atibaia" },
  { href: "/metodologia", rotulo: "Metodologia" },
];

/**
 * Navegação principal. No celular, a lista fica atrás do botão "Menu"
 * (aria-expanded/aria-controls; Esc fecha e devolve o foco ao botão).
 * A partir de md, a lista fica sempre visível. Marca a seção atual com aria-current.
 */
export function NavPrincipal() {
  const pathname = usePathname() ?? "/";
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape" && aberto) {
      setAberto(false);
      botao.current?.focus();
    }
  }

  return (
    <nav aria-label="Navegação principal" onKeyDown={onKeyDown} className="w-full md:w-auto">
      <button
        ref={botao}
        type="button"
        aria-expanded={aberto}
        aria-controls="menu-principal"
        onClick={() => setAberto((v) => !v)}
        className="absolute right-4 top-3 inline-flex items-center gap-2 rounded border border-[#7b8794] bg-white px-3 py-1.5 text-sm font-medium text-foreground md:hidden"
      >
        <span aria-hidden="true" className="flex flex-col gap-0.5">
          <span className="block h-0.5 w-4 bg-foreground" />
          <span className="block h-0.5 w-4 bg-foreground" />
          <span className="block h-0.5 w-4 bg-foreground" />
        </span>
        Menu
      </button>
      <ul
        id="menu-principal"
        className={`${aberto ? "flex" : "hidden"} flex-col gap-1 pt-2 md:flex md:flex-row md:flex-wrap md:pt-0`}
      >
        {ITENS_NAV.map((i) => {
          const ativo = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={ativo ? "page" : undefined}
                onClick={() => setAberto(false)}
                className={`block rounded px-2.5 py-2 text-sm font-medium md:py-1.5 ${
                  ativo ? "bg-acento text-white" : "text-foreground hover:bg-[#e4e7eb]"
                }`}
              >
                {i.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
