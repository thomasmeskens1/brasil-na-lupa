/**
 * Atalhos da página /congresso: por tema (com figurinha), por casa e o resumo da composição.
 * Os atalhos abrem a lista de votações já filtrada (/congresso?tema=…#votacoes). Ordem neutra:
 * temas em ordem alfabética ("Outros" por último), casas na ordem fixa Câmara, Senado; na
 * composição, partidos pelo tamanho da bancada (empate: ordem alfabética), todos na mesma cor.
 */
import Link from "next/link";
import { Figurinha, type NomeFigurinha } from "@/components/marca/Figurinhas";
import type { Casa } from "../tipos";
import { CASA_MEMBROS, CASA_NOME } from "../rotulos";

/** Figurinha decorativa de cada tema (o nome do tema sempre aparece em texto). */
const FIGURA_TEMA: Record<string, NomeFigurinha> = {
  "Impostos e preços": "dinheiro",
  "Economia e empresas": "dinheiro",
  "Trabalho e renda": "caneta",
  Saúde: "pessoas",
  Educação: "lupa",
  Segurança: "balanca",
  "Direitos e cidadania": "balanca",
  "Meio ambiente": "mapa",
  "Transporte e cidades": "cidade",
  "Previdência e assistência": "calendario",
  "Governo e instituições": "congresso",
};

function plural(n: number, s: string, p: string) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? s : p}`;
}

export function AtalhosTema({ temas }: { temas: [string, number][] }) {
  const ordenados = [...temas].sort((a, b) => (a[0] === "Outros" ? 1 : b[0] === "Outros" ? -1 : a[0].localeCompare(b[0], "pt-BR")));
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {ordenados.map(([t, n]) => (
        <li key={t}>
          <Link href={`/congresso?tema=${encodeURIComponent(t)}#votacoes`} className="bloco-secao items-center !gap-3 p-3">
            <Figurinha nome={FIGURA_TEMA[t] ?? "pino"} className="h-10 w-10 shrink-0" />
            <span className="min-w-0">
              <span className="block font-semibold leading-snug text-foreground">{t}</span>
              <span className="block text-sm text-[var(--cor-secundaria)]">{plural(n, "votação", "votações")}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export interface ResumoCasa {
  casa: Casa;
  votacoesLei: number;
  emExercicio: number;
  /** [partido, número de parlamentares] já em ordem (bancada, depois alfabética). */
  partidos: [string, number][];
  estados: number;
}

export function AtalhosCasa({ casas }: { casas: ResumoCasa[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {casas.map((c) => (
        <li key={c.casa} className="flex flex-col rounded-2xl border border-borda bg-superficie p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Figurinha nome={c.casa === "camara" ? "congresso" : "balanca"} className="h-12 w-12 shrink-0" />
            <h3 className="font-titulo text-xl font-extrabold text-foreground">{CASA_NOME[c.casa]}</h3>
          </div>
          <p className="mt-3 leading-relaxed">
            <span className="font-titulo text-3xl font-extrabold text-white-puro">{c.emExercicio.toLocaleString("pt-BR")}</span>{" "}
            {c.casa === "camara" ? "deputados federais" : "senadores"} em exercício, de {plural(c.partidos.length, "partido", "partidos")} e{" "}
            {plural(c.estados, "unidade da federação", "unidades da federação")}.
          </p>
          <details className="mt-2">
            <summary className="lk inline-flex min-h-11 cursor-pointer items-center text-sm">Saiba mais: quantos de cada partido</summary>
            <ol className="mt-1 space-y-1 text-sm" aria-label={`Parlamentares em exercício por partido, ${CASA_NOME[c.casa]}`}>
              {c.partidos.map(([p, n]) => (
                <li key={p} className="grid grid-cols-[minmax(4rem,7rem)_1fr] items-center gap-2">
                  <span className="truncate font-medium" title={p}>
                    {p}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="block h-3 rounded-sm"
                      style={{ width: `${(n / Math.max(1, c.partidos[0]?.[1] ?? 1)) * 100}%`, minWidth: 4, background: "var(--cor-placar-2)" }}
                    />
                    <span className="shrink-0 tabular-nums">{n}</span>
                  </span>
                </li>
              ))}
            </ol>
          </details>
          <div className="mt-auto flex flex-wrap gap-2 pt-3">
            <Link href={`/congresso?casa=${c.casa}#votacoes`} className="botao text-sm">
              {plural(c.votacoesLei, "votação que muda lei", "votações que mudam leis")}
            </Link>
            <Link href={CASA_MEMBROS[c.casa].rota} className="botao text-sm">
              {CASA_MEMBROS[c.casa].plural}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
