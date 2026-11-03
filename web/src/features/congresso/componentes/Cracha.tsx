/**
 * "Crachá" do parlamentar no topo do perfil: nome, partido, UF, casa, link oficial, resumo de
 * presença e de gastos (quando coletados) e Compartilhar. Sem foto grande, sem nota, sem ranking
 * (engajamento, seção 5.2 — variante parlamentar). Mesmo formato para todos (diretriz 6).
 */
import Link from "next/link";
import { BotaoCompartilhar } from "@/components/compartilhar/BotaoCompartilhar";
import { montarTextoCompartilhar } from "@/components/compartilhar/texto";
import { SeloFonte } from "@/components/decisao/Selos";
import type { FonteResumo } from "@/components/decisao/tipos";
import type { Casa, Parlamentar } from "../tipos";
import { CASA_MEMBROS, CASA_NOME, formatarData, rotaParlamentar } from "../rotulos";

export interface ResumoCracha {
  rotulo: string;
  valor: string | null;
  detalhe?: string | null;
  fonte?: FonteResumo | null;
}

export interface CrachaProps {
  casa: Casa;
  p: Parlamentar;
  /** Votações nominais com registro deste parlamentar / total de nominais coletadas. */
  nominais: { comRegistro: number; total: number };
  presenca: ResumoCracha;
  gastos: ResumoCracha;
}

export function Cracha({ casa, p, nominais, presenca, gastos }: CrachaProps) {
  const m = CASA_MEMBROS[casa];
  const partidoUf = `${p.partido ?? "partido não informado"}-${p.uf ?? "UF não informada"}`;
  const titulo = `${p.nome} (${partidoUf}), ${m.singular.toLowerCase()}`;
  const url = rotaParlamentar(casa, p.id);
  return (
    <header className="rounded-lg border border-borda bg-white p-4">
      <p className="text-sm text-[var(--cor-secundaria)]">
        <span className="selo selo-escuro">{casa === "camara" ? "Câmara" : "Senado"}</span> {m.singular} · {CASA_NOME[casa]}
      </p>
      <h1 className="mt-2 text-2xl font-bold leading-tight text-foreground sm:text-3xl">{p.nome}</h1>
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-lg">
        <div className="flex gap-1.5">
          <dt className="text-[var(--cor-secundaria)]">Partido</dt>
          <dd className="font-semibold">{p.partido ?? "não informado"}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-[var(--cor-secundaria)]">Estado (UF)</dt>
          <dd className="font-semibold">{p.uf ?? "não informado"}</dd>
        </div>
      </dl>
      {!p.na_lista_atual ? (
        <p className="aviso mt-3 text-sm">
          Não consta da lista oficial de em exercício coletada. Partido e estado são os do registro de votação de{" "}
          {formatarData(p.registro_de)}, o mais recente em que aparece.
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-borda bg-superficie px-3 py-2">
          <dt className="text-sm text-[var(--cor-secundaria)]">Votações nominais com registro</dt>
          <dd className="text-xl font-bold tabular-nums">
            {nominais.comRegistro.toLocaleString("pt-BR")}
            <span className="text-base font-normal text-[var(--cor-secundaria)]"> de {nominais.total.toLocaleString("pt-BR")} coletadas</span>
          </dd>
        </div>
        {[presenca, gastos].map((r) => (
          <div key={r.rotulo} className="rounded-md border border-borda bg-superficie px-3 py-2">
            <dt className="text-sm text-[var(--cor-secundaria)]">{r.rotulo}</dt>
            <dd>
              {r.valor ? <span className="text-xl font-bold tabular-nums">{r.valor}</span> : <span className="lacuna text-sm">Não disponível nos dados coletados</span>}
              {r.detalhe ? <span className="block text-sm text-[var(--cor-secundaria)]">{r.detalhe}</span> : null}
              {r.fonte ? <SeloFonte fonte={r.fonte} compacto /> : null}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {p.url_oficial ? (
          <SeloFonte fonte={{ url: p.url_oficial, titulo: `Página oficial ${casa === "camara" ? "na Câmara" : "no Senado"}`, orgao: CASA_NOME[casa] }} />
        ) : null}
        <span className="flex-1" />
        <Link href={`/congresso/comparar?casa=${casa}&ids=${encodeURIComponent(p.id)}`} className="botao">
          <span aria-hidden="true">+</span> Comparar
        </Link>
        <BotaoCompartilhar
          titulo={titulo}
          url={url}
          texto={montarTextoCompartilhar({
            titulo: `${titulo}: votos nas votações nominais, presença e gastos`,
            linhaOficial: CASA_NOME[casa],
            fonte: { orgao: CASA_NOME[casa] },
          })}
        />
      </div>
    </header>
  );
}
