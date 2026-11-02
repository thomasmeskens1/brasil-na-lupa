import Link from "next/link";
import type { ReactNode } from "react";
import { FonteLink } from "@/components/FonteLink";
import { lacunasLegiveis, textoLegivel } from "@/features/comum/texto";
import type { FonteTc, Lacuna } from "../tipos";
import { BASE_TC, formatarDataTc, type TermoTc } from "../rotulos";

/** Componentes básicos da seção Tribunais de Contas: texto ≥ 16px e alvos de toque ≥ 44px. */

export function Trilha({ itens }: { itens: { href: string; rotulo: string }[] }) {
  const todos = [{ href: BASE_TC, rotulo: "Tribunais de Contas" }, ...itens];
  return (
    <nav aria-label="Você está em" className="text-base text-[#3e4c59]">
      <ol className="flex flex-wrap items-center gap-x-2">
        {todos.map((i, k) => (
          <li key={i.href} className="flex items-center gap-x-2">
            {k ? <span aria-hidden="true">›</span> : null}
            <Link href={i.href} className="lk inline-flex min-h-11 items-center">
              {i.rotulo}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Ficha de dados: rótulo e valor (o valor ausente já chega como "Informação não disponível…"). */
export function Ficha({ itens, rotulo }: { itens: [string, ReactNode][]; rotulo?: string }) {
  return (
    <dl aria-label={rotulo} className="grid grid-cols-1 gap-x-6 gap-y-3 text-base sm:grid-cols-2">
      {itens.map(([r, v]) => (
        <div key={r} className="min-w-0">
          <dt className="font-semibold text-gray-900">{r}</dt>
          <dd className="mt-0.5 text-gray-800">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Texto copiado literalmente de documento oficial. */
export function Literal({ children, fonte }: { children: ReactNode; fonte?: ReactNode }) {
  return (
    <figure className="min-w-0">
      <blockquote className="border-l-4 border-[#9aa5b1] bg-superficie px-4 py-3 text-base leading-relaxed text-gray-900">{children}</blockquote>
      {fonte ? <figcaption className="mt-1 text-base text-[#3e4c59]">{fonte}</figcaption> : null}
    </figure>
  );
}

export function Termos({ termos }: { termos: readonly TermoTc[] }) {
  return (
    <dl className="grid grid-cols-1 gap-3 text-base md:grid-cols-2">
      {termos.map((t) => (
        <div key={t.termo} className="rounded border border-borda bg-superficie px-3 py-2">
          <dt className="font-semibold text-gray-900">{t.termo}</dt>
          <dd className="mt-1 leading-relaxed text-gray-800">{t.explicacao}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Fontes oficiais com a data de coleta (diretriz 2). Repetidas pelo endereço aparecem uma vez. */
export function Fontes({ fontes }: { fontes: (FonteTc | null | undefined)[] }) {
  const vistas = new Set<string>();
  const lista = fontes.filter((f): f is FonteTc => {
    if (!f?.url || vistas.has(f.url)) return false;
    vistas.add(f.url);
    return true;
  });
  if (!lista.length) return <p className="lacuna text-base">Fonte não informada.</p>;
  return (
    <ul className="space-y-3">
      {lista.map((f) => (
        <li key={f.url} className="text-base">
          <FonteLink href={f.url} tipo={/\.pdf($|\?)/i.test(f.url) ? "pdf" : "oficial"} className="text-base!">
            {textoLegivel(f.titulo || f.orgao || "Fonte oficial")}
          </FonteLink>
          <span className="block text-base text-[#3e4c59]">
            {f.orgao ? `${f.orgao} · ` : ""}
            {f.acessado_em ? `coletado em ${formatarDataTc(f.acessado_em)}` : "data de coleta não informada"}
          </span>
          {f.observacao ? <span className="block text-base text-[#3e4c59]">{textoLegivel(f.observacao)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Lacunas registradas pela coleta (o que a fonte oficial não traz), sem repetições. */
export function Lacunas({ lacunas, vazio = true }: { lacunas: (Lacuna[] | null | undefined)[]; vazio?: boolean }) {
  const textos = [...new Set(lacunas.flatMap((l) => lacunasLegiveis(l ?? [])))];
  if (!textos.length) return vazio ? <p className="text-base text-gray-800">Nenhuma lacuna registrada pela coleta.</p> : null;
  return (
    <ul className="space-y-2">
      {textos.map((t) => (
        <li key={t} className="lacuna text-base">
          {t}
        </li>
      ))}
    </ul>
  );
}

/** Bloco recolhível com alvo de toque de 44px. */
export function Recolhivel({ resumo, children, aberto = false }: { resumo: ReactNode; children: ReactNode; aberto?: boolean }) {
  return (
    <details className="rounded border border-borda" open={aberto}>
      <summary className="flex min-h-11 items-center py-2 pr-3 text-base">{resumo}</summary>
      <div className="border-t border-borda px-3 py-3">{children}</div>
    </details>
  );
}

export function Selo({ children, escuro = false }: { children: ReactNode; escuro?: boolean }) {
  return <span className={`selo text-sm! ${escuro ? "selo-escuro" : ""}`}>{children}</span>;
}
