"use client";

/**
 * Botão "Ouvir esta página": lê em voz alta o conteúdo principal (#conteudo) com a síntese de voz
 * do próprio navegador (Web Speech API), em português do Brasil. Nenhum serviço externo; nada é
 * enviado. Se o navegador não tiver síntese de voz, o botão não aparece.
 *
 *   <BotaoOuvir />                    // lê #conteudo
 *   <BotaoOuvir alvo="artigo-x" />    // lê outro elemento
 *
 * O texto é lido em trechos (frases), porque alguns navegadores interrompem falas longas.
 * Ao trocar de página, a leitura para.
 */
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Estado = "parado" | "lendo" | "pausado";

function suporta(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}
const assinar = () => () => {};

/** Texto visível do elemento, sem botões, campos e conteúdo escondido. */
function textoDe(el: HTMLElement): string {
  const copia = el.cloneNode(true) as HTMLElement;
  copia.querySelectorAll("script, style, button, input, select, textarea, [hidden], [aria-hidden='true'], .sr-only, [data-nao-ler]").forEach((n) => n.remove());
  return (copia.innerText || copia.textContent || "").replace(/\s+/g, " ").trim();
}

function trechos(t: string, max = 220): string[] {
  const frases = t.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [t];
  const r: string[] = [];
  let atual = "";
  for (const f of frases) {
    if ((atual + f).length > max && atual) {
      r.push(atual.trim());
      atual = "";
    }
    if (f.length > max) {
      for (let i = 0; i < f.length; i += max) r.push(f.slice(i, i + max));
    } else atual += f;
  }
  if (atual.trim()) r.push(atual.trim());
  return r;
}

function vozPtBr(): SpeechSynthesisVoice | null {
  const vozes = window.speechSynthesis.getVoices();
  return vozes.find((v) => v.lang === "pt-BR") ?? vozes.find((v) => v.lang?.toLowerCase().startsWith("pt")) ?? null;
}

export function BotaoOuvir({ alvo = "conteudo" }: { alvo?: string }) {
  const disponivel = useSyncExternalStore(assinar, suporta, () => false);
  const [estado, setEstado] = useState<Estado>("parado");
  const fila = useRef<string[]>([]);
  const geracao = useRef(0);
  const pathname = usePathname();

  function parar() {
    geracao.current += 1;
    fila.current = [];
    if (suporta()) window.speechSynthesis.cancel();
    setEstado("parado");
  }

  useEffect(() => {
    // Troca de página: interrompe a leitura (sincroniza com o sistema externo de voz).
    return () => {
      geracao.current += 1;
      fila.current = [];
      if (suporta()) window.speechSynthesis.cancel();
      setEstado("parado");
    };
  }, [pathname]);

  function falarProximo(g: number) {
    if (g !== geracao.current) return;
    const t = fila.current.shift();
    if (!t) {
      setEstado("parado");
      return;
    }
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "pt-BR";
    const v = vozPtBr();
    if (v) u.voice = v;
    u.onend = () => falarProximo(g);
    u.onerror = () => {
      if (g === geracao.current) setEstado("parado");
    };
    window.speechSynthesis.speak(u);
  }

  function ouvir() {
    const el = document.getElementById(alvo);
    if (!el) return;
    parar();
    const g = geracao.current;
    fila.current = trechos(textoDe(el));
    setEstado("lendo");
    falarProximo(g);
  }

  function alternarPausa() {
    if (estado === "lendo") {
      window.speechSynthesis.pause();
      setEstado("pausado");
    } else if (estado === "pausado") {
      window.speechSynthesis.resume();
      setEstado("lendo");
    }
  }

  if (!disponivel) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" data-nao-ler>
      {estado === "parado" ? (
        <button type="button" className="botao botao-mini" onClick={ouvir}>
          <span aria-hidden="true">▶</span> Ouvir esta página
        </button>
      ) : (
        <>
          <button type="button" className="botao botao-mini" onClick={alternarPausa} aria-pressed={estado === "pausado"}>
            {estado === "pausado" ? "Continuar leitura" : "Pausar leitura"}
          </button>
          <button type="button" className="botao botao-mini" onClick={parar}>
            Parar
          </button>
        </>
      )}
      <span className="sr-only" aria-live="polite">
        {estado === "lendo" ? "Lendo a página em voz alta." : estado === "pausado" ? "Leitura pausada." : ""}
      </span>
    </div>
  );
}
