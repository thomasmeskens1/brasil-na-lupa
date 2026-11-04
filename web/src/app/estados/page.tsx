import type { Metadata } from "next";
import Link from "next/link";
import { Figurinha } from "@/components/marca/Figurinhas";
import { Secao } from "@/components/Secao";
import { getPresentes } from "@/features/estados/dados";
import { formatarData, juntar } from "@/features/estados/rotulos";
import { UFS, baseUf } from "@/features/estados/ufs";

export const metadata: Metadata = {
  title: "Estados",
  description:
    "Escolha o estado: votações da Assembleia Legislativa, o voto de cada deputado quando a votação é nominal, projetos e as leis, decretos e vetos do governador, com fonte oficial.",
  alternates: { canonical: "/estados" },
};

export default function EstadosPage() {
  const presentes = getPresentes();
  const acompanhados = UFS.filter((u) => presentes[u.uf]);
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Figurinha nome="mapa" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Estados</h1>
        <p>
          {acompanhados.length
            ? `Hoje acompanhamos ${acompanhados.length === 1 ? "o estado" : "os estados"} ${juntar(acompanhados.map((u) => u.de))}.`
            : "Em breve."}{" "}
          Em cada estado, as leis são votadas pela Assembleia Legislativa e depois sancionadas ou vetadas pelo governador, que
          também decide sozinho, por decreto.
        </p>
        <p>
          Escolha o estado para ver as votações, o voto de cada deputado quando a votação é nominal (com registro oficial
          do voto de cada um), os projetos e as leis, decretos e vetos. Nos estados que ainda não acompanhamos, mostramos o
          que a fonte oficial publica.
        </p>
      </header>

      <Secao id="escolha" titulo="Escolha o estado" descricao="As 26 unidades da Federação e o Distrito Federal, em ordem alfabética.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {UFS.map((u) => {
            const r = presentes[u.uf];
            return (
              <li key={u.uf}>
                <Link href={baseUf(u.uf)} className="bloco-secao min-h-11 flex-col gap-1">
                  <span className="font-titulo text-2xl font-extrabold text-white-puro">{u.sigla}</span>
                  <span className="block font-semibold leading-snug text-foreground">{u.nome}</span>
                  <span className="block text-sm text-[var(--cor-texto-apoio)]">
                    {r ? (
                      <>
                        <span className="text-foreground">Acompanhado</span> ·{" "}
                        {r.assembleia_indisponivel
                          ? `${r.normas.toLocaleString("pt-BR")} atos do governador; Assembleia em breve`
                          : `${r.votacoes.toLocaleString("pt-BR")} votações, ${r.normas.toLocaleString("pt-BR")} atos do governador`}
                        {r.atualizado_em ? ` · coletado em ${formatarData(r.atualizado_em)}` : ""}
                      </>
                    ) : (
                      "Em breve"
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Secao>
    </div>
  );
}
