import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { AvisoEleito, FontesEleitos, Presidencia } from "@/features/representantes/Blocos";
import { BuscaLocal } from "@/features/representantes/BuscaLocal";
import { UFS } from "@/features/representantes/cargos";
import { getMetaEleitos } from "@/features/representantes/dados";

export const metadata: Metadata = {
  title: "Quem me representa",
  description:
    "Busque sua cidade ou seu estado e veja quem foi eleito, segundo o Tribunal Superior Eleitoral: prefeito, vereadores, governador, deputados, senadores.",
};

export default function QuemMeRepresentaPage() {
  const meta = getMetaEleitos();
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Quem me representa</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          Busque sua cidade ou seu estado para ver quem foi eleito na sua cidade (prefeito, vice e vereadores), no seu estado
          (governador, vice e deputados estaduais) e em Brasília (senadores e deputados federais), com o que cada cargo faz
          segundo a Constituição.
        </p>
      </header>

      <section aria-labelledby="busca-local" className="max-w-xl">
        <h2 id="busca-local" className="sr-only">
          Buscar cidade ou estado
        </h2>
        <BuscaLocal />
      </section>

      <AvisoEleito />

      <Secao id="estados" titulo="Escolha o estado" descricao="Em ordem alfabética.">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {UFS.map((u) => (
            <li key={u.sigla}>
              <Link
                href={`/quem-me-representa/${u.sigla.toLowerCase()}`}
                className="flex min-h-11 items-center rounded border border-[var(--cor-borda)] px-3 py-2 hover:bg-[var(--cor-superficie)]"
              >
                <span>
                  {u.nome} <span className="text-[var(--cor-secundaria)]">({u.sigla})</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao id="presidencia-bloco" titulo="Para todo o país">
        <Presidencia />
      </Secao>

      <Secao id="fontes" titulo="Fontes e limites">
        <FontesEleitos fontes={meta?.fontes ?? []} lacunas={meta?.lacunas ?? []} glossario={meta?.glossario ?? {}} />
      </Secao>
    </div>
  );
}
