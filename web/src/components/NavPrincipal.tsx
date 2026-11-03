"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";

export interface ItemNav {
  href: string;
  rotulo: string;
  /** Nome por extenso quando o rótulo é sigla (diretriz 9): lido pelo leitor de tela e no title. */
  extenso?: string;
}

export const ITENS_NAV: ItemNav[] = [
  { href: "/", rotulo: "Início" },
  { href: "/quem-me-representa", rotulo: "Quem me representa" },
  { href: "/impostos", rotulo: "Impostos" },
  { href: "/congresso", rotulo: "Congresso" },
  { href: "/executivo", rotulo: "Executivo" },
  { href: "/justica", rotulo: "Justiça" },
  { href: "/tribunais-de-contas", rotulo: "TCU", extenso: "Tribunais de Contas" },
  { href: "/estados", rotulo: "Estados" },
  { href: "/atibaia", rotulo: "Atibaia" },
  { href: "/agenda", rotulo: "Agenda" },
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
    <nav id="navegacao" tabIndex={-1} aria-label="Navegação principal" onKeyDown={onKeyDown} className="w-full focus:outline-none md:w-auto">
      <button
        ref={botao}
        type="button"
        aria-expanded={aberto}
        aria-controls="menu-principal"
        onClick={() => setAberto((v) => !v)}
        className="absolute right-[5%] top-3 inline-flex min-h-11 items-center gap-2 rounded border border-[var(--cor-borda-forte)] bg-white px-3 py-1.5 text-sm font-medium text-foreground md:hidden"
      >
        <span aria-hidden="true" className="flex flex-col gap-0.5">
          <span className="block h-0.5 w-4 bg-foreground" />
          <span className="block h-0.5 w-4 bg-foreground" />
          <span className="block h-0.5 w-4 bg-foreground" />
        </span>
        {aberto ? "Fechar" : "Menu"}
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
                className={`flex min-h-11 items-center rounded px-2.5 py-2 text-base font-medium md:min-h-0 md:py-1.5 md:text-sm ${
                  ativo ? "bg-acento text-white" : "text-foreground hover:bg-[var(--cor-superficie-2)]"
                }`}
              >
                {i.extenso ? (
                  <>
                    <abbr title={i.extenso} className="no-underline">
                      {i.rotulo}
                    </abbr>
                    <span className="sr-only"> ({i.extenso})</span>
                  </>
                ) : (
                  i.rotulo
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
