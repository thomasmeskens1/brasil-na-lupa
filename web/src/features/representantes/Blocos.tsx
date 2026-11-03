/**
 * Blocos fixos de "Quem me representa" (seguros em servidor): aviso "eleito ≠ em exercício",
 * Presidência da República (texto com fonte) e fontes/lacunas dos dados do TSE.
 */
import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";
import type { FonteResumo } from "@/components/decisao";
import { CARGOS, CONSTITUICAO, EM_EXERCICIO, PRESIDENCIA } from "./cargos";

function dataBr(v: string | null | undefined) {
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})/.exec(v) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "data não informada";
}

export function AvisoEleito({ uf }: { uf?: string }) {
  const links = [EM_EXERCICIO.camara, EM_EXERCICIO.senado, ...(uf === "sp" ? [EM_EXERCICIO.alesp] : [])];
  return (
    <div className="aviso">
      <p className="font-semibold">Eleito não é o mesmo que quem está no cargo hoje.</p>
      <p className="mt-1 text-sm">
        Estas listas mostram quem o Tribunal Superior Eleitoral (TSE) registrou como eleito. Cassações, renúncias, mortes,
        licenças e posses de suplentes não aparecem aqui, e o partido é o da candidatura na eleição, que pode ter mudado. Quando
        o nome coincide exatamente com a lista oficial de quem está em exercício, há o link “Mandato atual”.
      </p>
      <ul className="mt-2 flex flex-col gap-0">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="lk inline-flex min-h-11 items-center">
              {l.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Presidencia() {
  return (
    <section className="cartao" aria-labelledby="presidencia">
      <h3 id="presidencia" className="text-lg font-semibold">
        Presidente e vice-presidente da República
      </h3>
      <p className="mt-1 text-sm text-[var(--cor-secundaria)]">
        Os arquivos do TSE usados nesta página não incluem presidente e vice; os nomes abaixo vêm das páginas oficiais da
        Presidência da República. Eleitos para todo o país, não por estado.
      </p>
      <ul className="mt-3">
        {PRESIDENCIA.map((p) => (
          <li key={p.cargo} className="border-t border-[var(--cor-borda)] py-2 first:border-t-0">
            <p className="font-semibold">
              {CARGOS[p.cargo].singular}: {p.nome}
            </p>
            <p className="text-sm text-[var(--cor-secundaria)]">
              {CARGOS[p.cargo].texto} ({CARGOS[p.cargo].artigos}.)
            </p>
            <p className="text-sm">
              Partido: informação não disponível nos dados coletados para esta seção.
            </p>
            <FonteLink href={p.fonte.url} tipo="oficial" className="inline-flex min-h-11 items-center">
              {p.fonte.titulo} ({p.fonte.orgao})
            </FonteLink>
            <span className="meta"> · consultado em {dataBr(p.fonte.acessado_em)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TECNICO = /[_/#]|DivulgaCand|Presidente e vice-presidente/;

export function FontesEleitos({ fontes, lacunas, glossario }: { fontes: FonteResumo[]; lacunas: string[]; glossario: Record<string, string> }) {
  const legiveis = [...new Set(lacunas)].filter((l) => !TECNICO.test(l));
  const termos = Object.entries(glossario).filter(([k]) => !TECNICO.test(k));
  return (
    <div className="space-y-4">
      <ul className="space-y-1">
        {[...fontes, CONSTITUICAO].map((f) => (
          <li key={f.url}>
            <FonteLink href={f.url} tipo="oficial">
              {f.titulo ?? f.orgao ?? "Fonte oficial"}
            </FonteLink>
            <span className="meta"> · coletado em {dataBr(f.acessado_em)}</span>
          </li>
        ))}
      </ul>
      {termos.length ? (
        <dl className="space-y-2 text-sm">
          {termos.map(([k, v]) => (
            <div key={k}>
              <dt className="font-semibold">{k === "eleito por QP" ? "Eleito por quociente partidário" : k[0].toUpperCase() + k.slice(1)}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {legiveis.length ? (
        <details>
          <summary>Limites destes dados</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {legiveis.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
