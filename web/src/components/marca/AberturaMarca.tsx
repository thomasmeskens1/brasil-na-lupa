"use client";

import { useEffect, useRef, useState } from "react";
import { LARGURA_VB, LogoSvg, RAIO_LUPA, X_VB, Y_VB } from "./LogoSvg";

/**
 * Abertura da marca (motion do logotipo) na primeira visita à página inicial em cada sessão.
 * 1. 0–1,9 s: a lupa varre o texto e o revela (texto aparece atrás da lente).
 * 2. 1,5–2,3 s: encaixe ao lado de "BRASIL": faíscas, reflexo na lente e sublinhado desenhado.
 * 3. 2,5–3,5 s: "portal": a lente cresce e abre a página inicial através dela, enquanto o
 *    conteúdo da página entra (html[data-abertura] libera as animações de entrada).
 * Sem JavaScript, com movimento reduzido ou já vista na sessão, nada aparece.
 */
const CHAVE = "bnl-abertura";
const FIM_VARREDURA = 1900;
const INICIO_PORTAL = 2500;
const FIM = 3500;

const suave = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2); // power2.inOut
const portalCurva = (p: number) => (p < 0.5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2); // quart.inOut
const saida = (p: number) => 1 - Math.pow(1 - p, 3);
const trecho = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

/** Roda antes da pintura (script no HTML): decide se a abertura aparece, sem piscar. */
export const SCRIPT_ABERTURA = `try{var d=document.documentElement;d.dataset.abertura=(!/[?&]abertura/.test(location.search)&&(sessionStorage.getItem("${CHAVE}")||matchMedia("(prefers-reduced-motion: reduce)").matches))?"vista":"ativa"}catch(e){document.documentElement.dataset.abertura="vista"}`;

export function AberturaMarca() {
  const raiz = useRef<HTMLDivElement>(null);
  const [ativa, setAtiva] = useState(true);

  useEffect(() => {
    const html = document.documentElement;
    let vista = true;
    try {
      // ?abertura no endereço força a abertura (para testar), mesmo já vista ou com movimento reduzido.
      vista = !/[?&]abertura/.test(location.search) && (!!sessionStorage.getItem(CHAVE) || matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      /* sem sessionStorage: não mostra */
    }
    if (!vista) html.dataset.abertura = "ativa";
    const el = raiz.current;
    if (vista || !el) {
      html.dataset.abertura = "vista";
      setAtiva(false);
      return;
    }

    const q = <T extends Element>(s: string) => el.querySelector<T>(s);
    const svg = q<SVGSVGElement>("svg")!;
    const lupa = q<SVGGElement>("#bnl-lupa")!;
    const mascara = q<SVGRectElement>("#bnl-mascara")!;
    const sublinhado = q<SVGPathElement>("#bnl-sublinhado")!;
    const reflexo = q<SVGRectElement>("#bnl-reflexo-faixa")!;
    const faiscas = [...el.querySelectorAll<SVGLineElement>("#bnl-faiscas line")];
    const palco = q<HTMLDivElement>(".abertura-palco")!;
    const anel = q<HTMLDivElement>(".abertura-anel")!;

    let quadro = 0;
    let inicio = 0;
    let pularPara = -1;
    let destinoX = 480;
    const destinoY = 72;
    const escalaLupa = 1.05;
    const inicioX = -110;

    const pular = () => {
      pularPara = INICIO_PORTAL;
    };
    q<HTMLButtonElement>(".abertura-pular")?.addEventListener("click", pular);

    const quadroDe = (t: number) => {
      // 1. Varredura
      const pv = suave(trecho(t, 0, FIM_VARREDURA));
      const x = inicioX + (destinoX - inicioX) * pv;
      const giro = -10 * (1 - pv);
      const flutua = t > FIM_VARREDURA + 400 && t < INICIO_PORTAL ? Math.sin((t - FIM_VARREDURA) / 380) * 2 : 0;
      lupa.setAttribute("transform", `translate(${x} ${destinoY + flutua}) rotate(${giro}) scale(${escalaLupa})`);
      mascara.setAttribute("width", String(Math.max(0, x - 6)));

      // 2. Encaixe
      sublinhado.style.strokeDasharray = "1";
      sublinhado.style.strokeDashoffset = String(1 - saida(trecho(t, 1500, 2050)));
      const pf = trecho(t, 1750, 2300);
      faiscas.forEach((f, i) => {
        const p = Math.max(0, pf - i * 0.04);
        const esc = p < 0.45 ? (p / 0.45) * 1.3 : 1.3 + ((p - 0.45) / 0.55) * 0.3;
        f.style.opacity = String(p === 0 ? 0 : p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55);
        f.style.transformBox = "fill-box";
        f.style.transformOrigin = "center";
        f.style.transform = `scale(${esc})`;
      });
      reflexo.setAttribute("transform", `rotate(25) translate(${-20 + 300 * suave(trecho(t, 1600, 2150))} 0)`);

      // 3. Portal
      const pp = trecho(t, INICIO_PORTAL, FIM);
      if (pp > 0) {
        if (html.dataset.abertura === "ativa") html.dataset.abertura = "saindo";
        const caixa = svg.getBoundingClientRect();
        const k = caixa.width / LARGURA_VB;
        const cx = caixa.left + (destinoX - X_VB) * k;
        const cy = caixa.top + (destinoY - Y_VB) * k;
        const r0 = (RAIO_LUPA - 10) * escalaLupa * k;
        const rMax = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy)) + 40;
        const r = r0 + (rMax - r0) * portalCurva(pp);
        el.style.setProperty("--cx", `${cx}px`);
        el.style.setProperty("--cy", `${cy}px`);
        el.style.setProperty("--r", `${r}px`);
        el.classList.add("abrindo");
        palco.style.opacity = String(1 - saida(trecho(t, INICIO_PORTAL, INICIO_PORTAL + 260)));
        anel.style.opacity = String(1 - trecho(t, FIM - 300, FIM));
      }
    };

    const passo = (agora: number) => {
      if (!inicio) {
        inicio = agora;
        try {
          sessionStorage.setItem(CHAVE, "1");
        } catch {
          /* ignora */
        }
      }
      if (pularPara >= 0) {
        inicio = agora - pularPara;
        pularPara = -1;
      }
      const t = agora - inicio;
      quadroDe(t);
      if (t < FIM) quadro = requestAnimationFrame(passo);
      else {
        html.dataset.abertura = "vista";
        setAtiva(false);
      }
    };

    // Encaixe calculado pela largura real de "BRASIL" (lupa colada ao texto).
    const comecar = () => {
      try {
        const b = q<SVGTextElement>("#bnl-brasil")!.getBBox();
        destinoX = b.x + b.width + (RAIO_LUPA + 7) * escalaLupa - 12;
      } catch {
        /* usa o valor padrão */
      }
      quadroDe(0);
      quadro = requestAnimationFrame(passo);
    };
    const fontes = document.fonts?.ready ?? Promise.resolve();
    Promise.race([fontes, new Promise((r) => setTimeout(r, 1200))]).then(comecar);

    return () => {
      cancelAnimationFrame(quadro);
    };
  }, []);

  if (!ativa) return null;
  return (
    <div ref={raiz} className="abertura" aria-hidden="true">
      <div className="abertura-fundo" />
      <div className="abertura-anel" />
      <div className="abertura-palco">
        <div className="w-[min(88vw,760px)]">
          <LogoSvg />
        </div>
      </div>
      <button type="button" className="abertura-pular" tabIndex={-1}>
        Pular
      </button>
    </div>
  );
}
