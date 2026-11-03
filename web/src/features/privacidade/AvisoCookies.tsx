"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { CHAVE_AVISO, deveMostrarAviso, exigeConsentimento, lerEscolha, VERSAO_AVISO, type EscolhaNaoEssenciais } from "./cookies";

/**
 * Aviso de cookies na primeira visita (rodapé da tela). Região rotulada que não rouba o foco.
 * Hoje é informativo ("Entendi"); se houver cookie não essencial (cookies.ts), vira pedido de
 * consentimento com "Aceitar" e "Recusar" iguais. A resposta fica no armazenamento local.
 */

const EVENTO = "bnl:aviso-cookies";

function ler(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_AVISO);
  } catch {
    return null;
  }
}

function assinar(fn: () => void) {
  window.addEventListener(EVENTO, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENTO, fn);
    window.removeEventListener("storage", fn);
  };
}

function responder(naoEssenciais: EscolhaNaoEssenciais) {
  try {
    window.localStorage.setItem(CHAVE_AVISO, JSON.stringify({ versao: VERSAO_AVISO, naoEssenciais }));
  } catch {
    /* armazenamento bloqueado: o aviso some só nesta página */
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function AvisoCookies() {
  // No servidor e na primeira pintura: não mostra (evita piscar para quem já respondeu).
  const guardado = useSyncExternalStore(assinar, ler, () => "servidor");
  const fechadoAgora = useSyncExternalStore(
    assinar,
    () => document.documentElement.dataset.avisoCookies === "fechado",
    () => true,
  );
  if (guardado === "servidor" || fechadoAgora || !deveMostrarAviso(lerEscolha(guardado))) return null;

  const consentir = exigeConsentimento();
  const fechar = (n: EscolhaNaoEssenciais) => {
    document.documentElement.dataset.avisoCookies = "fechado";
    responder(n);
  };

  return (
    <section
      aria-label="Aviso sobre cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--cor-borda-forte)] bg-superficie/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[var(--cor-secundaria)]">
          {consentir
            ? "Usamos cookies essenciais para manter seu login e, só se você aceitar, outros cookies descritos na política."
            : "Usamos apenas cookies essenciais para manter seu login. A medição de audiência não usa cookies nem identifica você."}{" "}
          <Link href="/privacidade#cookies" className="lk">
            Política de cookies
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          {consentir ? (
            <>
              <button type="button" className="botao botao-mini" onClick={() => fechar("aceitos")}>
                Aceitar
              </button>
              <button type="button" className="botao botao-mini" onClick={() => fechar("recusados")}>
                Recusar
              </button>
            </>
          ) : (
            <button type="button" className="botao botao-mini" onClick={() => fechar(null)} aria-label="Entendi, fechar o aviso sobre cookies">
              Entendi
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
