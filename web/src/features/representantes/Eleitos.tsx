/**
 * Lista de eleitos por cargo (seguro em servidor e cliente: sem acesso a dados).
 * Ordem alfabética dentro de cada cargo (diretriz 6); partido "na eleição de AAAA"; link para o
 * mandato atual só quando o vínculo com a lista em exercício é exato.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { CARGOS } from "./cargos";
import type { Eleito } from "./tipos";

const SITUACAO: Record<string, string> = {
  eleito: "eleito",
  "eleito por QP": "eleito por quociente partidário",
  "eleito por média": "eleito pela distribuição das sobras (média)",
};

export function situacaoLegivel(s: string | null | undefined): string {
  if (!s) return "situação não informada";
  return SITUACAO[s] ?? s;
}

function formatarData(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

export function GrupoCargo({
  cargo,
  pessoas,
  aguardandoPosse = false,
  nivel = 3,
}: {
  cargo: string;
  pessoas: Eleito[];
  aguardandoPosse?: boolean;
  nivel?: 3 | 4;
}) {
  const info = CARGOS[cargo];
  const H = `h${nivel}` as "h3" | "h4";
  const n = pessoas.length;
  return (
    <section className="cartao" aria-label={info?.plural ?? cargo}>
      <H className="text-lg font-semibold">
        {n > 1 ? (info?.plural ?? cargo) : (info?.singular ?? cargo)}
        {n > 1 ? <span className="font-normal text-[var(--cor-secundaria)]"> · {n}</span> : null}
      </H>
      {info && !aguardandoPosse ? (
        <p className="mt-1 text-sm text-[var(--cor-secundaria)]">
          {info.texto} <span>({info.artigos}.)</span>
        </p>
      ) : null}
      {n === 0 ? (
        <p className="lacuna mt-2">Informação não disponível em fonte oficial: o TSE não registra eleito para este cargo neste local.</p>
      ) : (
        <Recolher n={n} rotulo={info?.plural ?? cargo}>
        <ul className={`mt-3 ${n > 6 ? "grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
          {pessoas.map((p, k) => (
            <li key={`${p.nome}-${k}`} className="border-t border-[var(--cor-borda)] py-2 first:border-t-0">
              <p className="font-semibold">
                {p.nome}
                {p.nome_completo ? <span className="font-normal"> ({p.nome_completo})</span> : null}
              </p>
              <p className="text-sm">
                Partido na eleição{p.ano ? ` de ${p.ano}` : ""}: {p.partido ?? "não informado"}
                {" · "}
                {aguardandoPosse ? "aguardando posse em 2027" : situacaoLegivel(p.situacao)}
              </p>
              {p.eleicao_suplementar ? (
                <p className="text-sm">
                  {p.eleicao_suplementar}
                  {p.data_eleicao ? ` (${formatarData(p.data_eleicao)})` : ""}
                </p>
              ) : null}
              {p.href ? (
                <Link href={p.href} className="lk inline-flex min-h-11 items-center">
                  {aguardandoPosse ? "Mandato em exercício hoje: votações e dados" : "Mandato atual: votações e dados"}
                  <span className="sr-only"> de {p.nome}</span>
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        </Recolher>
      )}
    </section>
  );
}

/** Listas longas (mais de 12 nomes) ficam recolhidas, abertas com um toque. */
function Recolher({ n, rotulo, children }: { n: number; rotulo: string; children: ReactNode }) {
  if (n <= 12) return <>{children}</>;
  return (
    <details className="mt-2">
      <summary>
        Ver os {n} {rotulo.toLowerCase()} (ordem alfabética)
      </summary>
      {children}
    </details>
  );
}

/** Agrupa na ordem de cargos dada (cargos ausentes não aparecem, salvo os obrigatórios). */
export function agrupar(itens: Eleito[], ordem: string[], obrigatorios: string[] = []): [string, Eleito[]][] {
  return ordem
    .map((c) => [c, itens.filter((p) => p.cargo === c)] as [string, Eleito[]])
    .filter(([c, l]) => l.length > 0 || obrigatorios.includes(c));
}
