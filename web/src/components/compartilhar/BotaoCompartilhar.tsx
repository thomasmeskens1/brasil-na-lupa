"use client";

/**
 * Botão "Compartilhar": usa a folha nativa do celular (Web Share API, onde o WhatsApp costuma
 * ser o primeiro destino). Sem ela, abre um painel com "WhatsApp" e "Copiar link".
 * Nada do visitante é enviado ou guardado; não há identificador por compartilhamento.
 *
 *   import { BotaoCompartilhar, montarTextoCompartilhar } from "@/components/compartilhar";
 *   <BotaoCompartilhar
 *     titulo={titulo}
 *     texto={montarTextoCompartilhar({ titulo, linhaOficial, forma: "votacao-nominal", data, dado, fonte })}
 *     url={`/congresso/votacoes/camara/${id}`}   // relativo ou absoluto
 *   />
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export interface BotaoCompartilharProps {
  /** Título exibido na página (vai como "title" da folha nativa). */
  titulo: string;
  /** Texto pronto e neutro (use montarTextoCompartilhar). Sem o link. */
  texto: string;
  /** Endereço da página; relativo ("/impostos/icms/x") é resolvido no navegador. */
  url: string;
  /** Rótulo visível. Padrão: "Compartilhar". */
  rotulo?: string;
  className?: string;
}

function absoluta(url: string): string {
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

export function BotaoCompartilhar({ titulo, texto, url, rotulo = "Compartilhar", className = "" }: BotaoCompartilharProps) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [link, setLink] = useState("");
  const [aviso, setAviso] = useState("");
  const botao = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: PointerEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  async function compartilhar() {
    const abs = absoluta(url);
    setLink(abs);
    setAviso("");
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: titulo, text: texto, url: abs });
        return;
      } catch (e) {
        // Cancelado pelo visitante: não faz nada. Outro erro: mostra as alternativas.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    setAberto((v) => !v);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setAviso("Link copiado.");
    } catch {
      setAviso("Não foi possível copiar automaticamente. Selecione o endereço abaixo e copie.");
    }
  }

  function teclado(e: KeyboardEvent) {
    if (e.key === "Escape" && aberto) {
      setAberto(false);
      botao.current?.focus();
    }
  }

  return (
    <div ref={caixa} className={`relative inline-block ${className}`} onKeyDown={teclado}>
      <button
        ref={botao}
        type="button"
        className="botao"
        aria-expanded={aberto}
        aria-controls={`${id}-painel`}
        onClick={compartilhar}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {rotulo}
      </button>
      <div
        id={`${id}-painel`}
        hidden={!aberto}
        className="absolute right-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-[#7b8794] bg-white p-3 shadow-lg"
      >
        <p className="text-sm font-semibold">Compartilhar esta página</p>
        <div className="mt-2 flex flex-col gap-2">
          <a
            className="botao"
            href={`https://wa.me/?text=${encodeURIComponent(`${texto} ${link}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp<span className="sr-only"> (abre em nova aba)</span>
          </a>
          <button type="button" className="botao" onClick={copiar}>
            Copiar link
          </button>
          <label className="text-sm text-[var(--cor-secundaria)]">
            Endereço
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1 block w-full rounded border border-[#7b8794] px-2 text-sm text-foreground"
            />
          </label>
        </div>
        <p aria-live="polite" className="mt-2 text-sm">
          {aviso}
        </p>
      </div>
    </div>
  );
}
