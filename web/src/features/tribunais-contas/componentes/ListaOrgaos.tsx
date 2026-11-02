import Link from "next/link";
import type { OrgaoTc } from "../tipos";
import { BASE_TC, ESFERAS, rotuloSituacao } from "../rotulos";

/**
 * Os tribunais de contas do registro, agrupados pela esfera informada no registro e, dentro de
 * cada grupo, em ordem alfabética de UF e nome (ordem neutra). Sem mapa (diretriz 11).
 */
export function ListaOrgaos({ orgaos }: { orgaos: OrgaoTc[] }) {
  const grupos = ESFERAS.map(([esfera, titulo]) => ({
    esfera,
    titulo,
    itens: orgaos
      .filter((o) => o.esfera === esfera)
      .sort((a, b) => (a.uf ?? "").localeCompare(b.uf ?? "") || a.nome.localeCompare(b.nome, "pt-BR")),
  })).filter((g) => g.itens.length);
  const outros = orgaos.filter((o) => !ESFERAS.some(([e]) => e === o.esfera));
  if (outros.length) grupos.push({ esfera: "outros", titulo: "Outros", itens: outros });

  return (
    <div className="space-y-6">
      {grupos.map((g) => (
        <section key={g.esfera} aria-labelledby={`esfera-${g.esfera}`}>
          <h3 id={`esfera-${g.esfera}`} className="text-lg font-semibold text-gray-900">
            {g.titulo} <span className="font-normal text-[#3e4c59]">({g.itens.length})</span>
          </h3>
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.itens.map((o) => {
              const ativo = o.situacao_coleta === "ativa";
              return (
                <li key={o.id} className="min-w-0">
                  <Link
                    href={`${BASE_TC}/${o.id}`}
                    className={`flex min-h-11 items-start justify-between gap-3 rounded border px-3 py-2 text-base hover:bg-superficie ${
                      ativo ? "border-acento bg-acento-fundo" : "border-borda bg-white"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-[#234a73] underline underline-offset-2">{o.nome}</span>
                      <span className="block text-[#3e4c59]">
                        {o.id.toUpperCase()}
                        {o.uf ? ` · ${o.uf}` : ""}
                      </span>
                    </span>
                    <span className={`selo shrink-0 text-sm! ${ativo ? "selo-escuro" : ""}`}>{rotuloSituacao(o)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
