"use client";

/**
 * "Ouvir esta página": lê em voz alta o conteúdo principal (#conteudo) com a síntese de voz do
 * próprio navegador (Web Speech API), em português do Brasil. Nenhum serviço externo; nada é
 * enviado. Se o navegador não tiver síntese de voz, o botão não aparece.
 *
 *   <BotaoOuvir />                    // lê #conteudo
 *   <BotaoOuvir alvo="artigo-x" />    // lê outro elemento
 *
 * - Lê só o conteúdo, na ordem do documento (extrair.ts): pula menus, botões, campos, ícones,
 *   figurinhas e o que estiver escondido; lê o texto alternativo das imagens.
 * - Títulos são anunciados ("Título da página:", "Seção:", "Subtítulo:") com pausa depois.
 * - Siglas, números, valores em reais, datas e normas são falados por extenso (normalizar.ts).
 * - Escolhe a melhor voz pt-BR disponível (naturais/neurais primeiro).
 * - Controles: Ouvir, Pausar/Continuar, Anterior, Próximo, Velocidade (0,75× a 1,5×) e Parar.
 * - O trecho em leitura é destacado (.ouvir-lendo) e rolado para a tela.
 * - Atalhos (em qualquer lugar da página): Alt+Shift+O ouvir/pausar/continuar; Alt+Shift+X parar;
 *   Alt+Shift+→ / ← próximo/anterior trecho; Alt+Shift+↑ / ↓ mais rápido/mais devagar.
 *   Esc nos controles também para. Documentados em /acessibilidade.
 * - Lê em blocos (um bloco por vez, dividido em frases curtas): funciona em páginas longas.
 * - Para ao trocar de página ou sair dela.
 */
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { extrairBlocos, type BlocoLeitura } from "./extrair";
import { anuncioTitulo, dividirEmTrechos, escolherVoz, paraFala } from "./normalizar";

type Estado = "parado" | "lendo" | "pausado";

const VELOCIDADES = [0.75, 1, 1.25, 1.5];
const CHAVE_VELOCIDADE = "bnl-ouvir-velocidade";
const PAUSA_TITULO = 450;
const PAUSA_BLOCO = 120;

function suporta(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}
const assinar = () => () => {};

function rotuloVelocidade(v: number): string {
  return `${v.toLocaleString("pt-BR")}×`;
}

function lerVelocidade(): number {
  try {
    const v = Number(localStorage.getItem(CHAVE_VELOCIDADE));
    return VELOCIDADES.includes(v) ? v : 1;
  } catch {
    return 1;
  }
}

const reduzMovimento = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Rola o trecho para a tela só se ele estiver fora dela. */
function mostrar(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (r.top >= 80 && r.bottom <= window.innerHeight - 40) return;
  el.scrollIntoView({ block: "center", behavior: reduzMovimento() ? "auto" : "smooth" });
}

export function BotaoOuvir({ alvo = "conteudo" }: { alvo?: string }) {
  const disponivel = useSyncExternalStore(assinar, suporta, () => false);
  const [estado, setEstado] = useState<Estado>("parado");
  const [velocidade, setVelocidade] = useState(1);
  const [aviso, setAviso] = useState("");

  const blocos = useRef<BlocoLeitura[]>([]);
  const iBloco = useRef(0);
  const trechos = useRef<string[]>([]);
  const iTrecho = useRef(0);
  const geracao = useRef(0);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ditas = useRef(new Set<string>());
  const marcado = useRef<HTMLElement | null>(null);
  const voz = useRef<SpeechSynthesisVoice | null>(null);
  const vel = useRef(1);
  const estadoRef = useRef<Estado>("parado");
  const principal = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const mudarEstado = useCallback((e: Estado) => {
    estadoRef.current = e;
    setEstado(e);
  }, []);

  // Velocidade salva (conveniência deste aparelho) e melhor voz pt-BR (as vozes chegam depois).
  useEffect(() => {
    if (!suporta()) return;
    const v = lerVelocidade();
    vel.current = v;
    const t = setTimeout(() => setVelocidade(v), 0);
    const escolher = () => {
      voz.current = escolherVoz(window.speechSynthesis.getVoices());
    };
    escolher();
    window.speechSynthesis.addEventListener("voiceschanged", escolher);
    return () => {
      clearTimeout(t);
      window.speechSynthesis.removeEventListener("voiceschanged", escolher);
    };
  }, []);

  const marcar = useCallback((el: HTMLElement | null) => {
    marcado.current?.classList.remove("ouvir-lendo");
    marcado.current = el;
    if (el) {
      el.classList.add("ouvir-lendo");
      mostrar(el);
    }
  }, []);

  const limparEspera = () => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
  };

  const interromper = useCallback(() => {
    geracao.current += 1;
    limparEspera();
    if (suporta()) window.speechSynthesis.cancel();
  }, []);

  const parar = useCallback(
    (anunciar = true) => {
      interromper();
      marcar(null);
      blocos.current = [];
      trechos.current = [];
      iBloco.current = 0;
      iTrecho.current = 0;
      mudarEstado("parado");
      if (anunciar) setAviso("Leitura encerrada.");
    },
    [interromper, marcar, mudarEstado],
  );

  /** Prepara os trechos do bloco atual (normalizados para a fala). */
  const prepararBloco = useCallback(() => {
    const b = blocos.current[iBloco.current];
    if (!b) return false;
    const fala = paraFala(b.texto, ditas.current);
    trechos.current = dividirEmTrechos(b.titulo ? anuncioTitulo(b.titulo, fala) : fala);
    iTrecho.current = 0;
    marcar(b.el.isConnected ? b.el : null);
    return true;
  }, [marcar]);

  const falar = useCallback(
    function falarAtual() {
      const g = geracao.current;
      const t = trechos.current[iTrecho.current];
      if (!t) return;
      const u = new SpeechSynthesisUtterance(t);
      u.lang = "pt-BR";
      if (voz.current) {
        u.voice = voz.current;
        u.lang = voz.current.lang;
      }
      u.rate = vel.current;
      u.onend = () => {
        if (g !== geracao.current) return;
        if (iTrecho.current + 1 < trechos.current.length) {
          iTrecho.current += 1;
          falarAtual();
          return;
        }
        const eraTitulo = !!blocos.current[iBloco.current]?.titulo;
        iBloco.current += 1;
        if (iBloco.current >= blocos.current.length) {
          marcar(null);
          mudarEstado("parado");
          setAviso("Fim da página.");
          return;
        }
        espera.current = setTimeout(
          () => {
            if (g !== geracao.current) return;
            if (prepararBloco()) falarAtual();
          },
          (eraTitulo ? PAUSA_TITULO : PAUSA_BLOCO) / vel.current,
        );
      };
      u.onerror = (e) => {
        if (g !== geracao.current) return;
        if (e.error === "interrupted" || e.error === "canceled") return;
        mudarEstado("parado");
        marcar(null);
        setAviso("A leitura foi interrompida pelo navegador.");
      };
      window.speechSynthesis.speak(u);
    },
    [marcar, mudarEstado, prepararBloco],
  );

  /** Reinicia a fala no ponto atual (depois de cancelar), com pequena folga para o navegador. */
  const retomar = useCallback(() => {
    interromper();
    const g = geracao.current;
    espera.current = setTimeout(() => {
      if (g === geracao.current) falar();
    }, 60);
  }, [falar, interromper]);

  const ouvir = useCallback(() => {
    const el = document.getElementById(alvo);
    if (!el || !suporta()) return;
    interromper();
    ditas.current = new Set();
    blocos.current = extrairBlocos(el);
    iBloco.current = 0;
    if (!blocos.current.length || !prepararBloco()) {
      setAviso("Não há texto para ler nesta página.");
      return;
    }
    mudarEstado("lendo");
    setAviso(`Lendo a página em voz alta, ${blocos.current.length} trechos. Alt+Shift+O pausa; Alt+Shift+X para.`);
    retomar();
  }, [alvo, interromper, mudarEstado, prepararBloco, retomar]);

  // Pausa = cancela e guarda a posição (pause/resume nativos falham com vozes on-line no Chrome).
  const pausar = useCallback(() => {
    interromper();
    mudarEstado("pausado");
    setAviso("Leitura pausada.");
  }, [interromper, mudarEstado]);

  const continuar = useCallback(() => {
    mudarEstado("lendo");
    setAviso("Continuando a leitura.");
    retomar();
  }, [mudarEstado, retomar]);

  const pular = useCallback(
    (delta: 1 | -1) => {
      if (estadoRef.current === "parado") return;
      let alvoBloco = iBloco.current + delta;
      // "Anterior" no meio de um bloco volta ao início dele.
      if (delta === -1 && iTrecho.current > 0) alvoBloco = iBloco.current;
      alvoBloco = Math.max(0, Math.min(blocos.current.length - 1, alvoBloco));
      iBloco.current = alvoBloco;
      prepararBloco();
      setAviso(`Trecho ${alvoBloco + 1} de ${blocos.current.length}.`);
      if (estadoRef.current === "lendo") retomar();
    },
    [prepararBloco, retomar],
  );

  const mudarVelocidade = useCallback(
    (v: number) => {
      vel.current = v;
      setVelocidade(v);
      setAviso(`Velocidade ${rotuloVelocidade(v).replace("×", " vezes")}.`);
      try {
        localStorage.setItem(CHAVE_VELOCIDADE, String(v));
      } catch {
        /* sem armazenamento: vale só nesta visita */
      }
      if (estadoRef.current === "lendo") retomar();
    },
    [retomar],
  );

  const alternar = useCallback(() => {
    if (estadoRef.current === "parado") ouvir();
    else if (estadoRef.current === "lendo") pausar();
    else continuar();
  }, [continuar, ouvir, pausar]);

  // Troca de página ou saída: interrompe a leitura (sincroniza com o sistema externo de voz).
  useEffect(() => {
    const sair = () => parar(false);
    window.addEventListener("pagehide", sair);
    return () => {
      window.removeEventListener("pagehide", sair);
      parar(false);
    };
  }, [pathname, parar]);

  // Atalhos de teclado globais (Alt+Shift+…), por código físico da tecla.
  useEffect(() => {
    if (!disponivel) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
      const i = VELOCIDADES.indexOf(vel.current);
      const acoes: Record<string, () => void> = {
        KeyO: alternar,
        KeyX: () => estadoRef.current !== "parado" && parar(),
        ArrowRight: () => pular(1),
        ArrowLeft: () => pular(-1),
        ArrowUp: () => mudarVelocidade(VELOCIDADES[Math.min(VELOCIDADES.length - 1, i + 1)]),
        ArrowDown: () => mudarVelocidade(VELOCIDADES[Math.max(0, i - 1)]),
      };
      const acao = acoes[e.code];
      if (!acao) return;
      e.preventDefault();
      acao();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alternar, disponivel, mudarVelocidade, parar, pular]);

  function teclaNosControles(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && estado !== "parado") {
      e.preventDefault();
      parar();
      principal.current?.focus();
    }
  }

  if (!disponivel) return null;
  return (
    <div
      className="ouvir-controles flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Leitura em voz alta"
      data-nao-ler
      onKeyDown={teclaNosControles}
    >
      {/* O botão principal é o mesmo elemento em todos os estados: o foco não se perde. */}
      <button
        ref={principal}
        type="button"
        className="botao botao-mini"
        onClick={alternar}
        aria-keyshortcuts="Alt+Shift+O"
        title={`${estado === "parado" ? "Ouvir esta página" : estado === "lendo" ? "Pausar" : "Continuar"} (atalho: Alt+Shift+O)`}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor">
          {estado === "lendo" ? <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /> : <path d="M4 2.5v11l9-5.5z" />}
        </svg>
        {estado === "parado" ? "Ouvir esta página" : estado === "lendo" ? "Pausar" : "Continuar"}
        {estado !== "parado" ? <span className="sr-only"> a leitura</span> : null}
      </button>
      {estado !== "parado" ? (
        <>
          <button
            type="button"
            className="botao botao-mini"
            onClick={() => pular(-1)}
            aria-keyshortcuts="Alt+Shift+ArrowLeft"
            title="Trecho anterior (Alt+Shift+←)"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 2.5h2v11H3zM14 2.5v11L6 8z" />
            </svg>
            <span className="sr-only">Trecho anterior</span>
          </button>
          <button
            type="button"
            className="botao botao-mini"
            onClick={() => pular(1)}
            aria-keyshortcuts="Alt+Shift+ArrowRight"
            title="Próximo trecho (Alt+Shift+→)"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11 2.5h2v11h-2zM2 2.5v11L10 8z" />
            </svg>
            <span className="sr-only">Próximo trecho</span>
          </button>
          <label className="sr-only" htmlFor="ouvir-velocidade">
            Velocidade da leitura
          </label>
          <select
            id="ouvir-velocidade"
            value={velocidade}
            onChange={(e) => mudarVelocidade(Number(e.target.value))}
            aria-keyshortcuts="Alt+Shift+ArrowUp Alt+Shift+ArrowDown"
            title="Velocidade (Alt+Shift+↑ / ↓)"
          >
            {VELOCIDADES.map((v) => (
              <option key={v} value={v}>
                {rotuloVelocidade(v)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="botao botao-mini"
            onClick={() => {
              parar();
              principal.current?.focus();
            }}
            aria-keyshortcuts="Alt+Shift+X"
            title="Parar a leitura (Alt+Shift+X ou Esc)"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.5 3.5h9v9h-9z" />
            </svg>
            Parar<span className="sr-only"> a leitura</span>
          </button>
        </>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite">
        {aviso}
      </span>
    </div>
  );
}
