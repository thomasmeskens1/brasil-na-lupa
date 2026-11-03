"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Número que conta de 0 até o valor quando entra na tela (0,8 s). O valor final já vem no HTML
 * (sem JavaScript, ou com movimento reduzido, mostra direto o número oficial).
 */
export function ContadorAnimado({ valor, className }: { valor: number; className?: string }) {
  const [mostrado, setMostrado] = useState(valor);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    let quadro = 0;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const inicio = performance.now();
      const passo = (t: number) => {
        const p = Math.min(1, (t - inicio) / 800);
        setMostrado(Math.round(valor * (1 - Math.pow(1 - p, 3))));
        if (p < 1) quadro = requestAnimationFrame(passo);
      };
      setMostrado(0);
      quadro = requestAnimationFrame(passo);
    });
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(quadro);
    };
  }, [valor]);

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ""}`} aria-label={String(valor)}>
      <span aria-hidden="true">{mostrado}</span>
    </span>
  );
}
