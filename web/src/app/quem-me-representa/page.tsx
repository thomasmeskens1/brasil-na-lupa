import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { AvisoEleito, FontesEleitos } from "@/features/representantes/Blocos";
import { BuscaRepresentantes } from "@/features/representantes/BuscaRepresentantes";
import { UFS } from "@/features/representantes/cargos";
import { getMetaEleitos } from "@/features/representantes/dados";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = {
  title: "Quem me representa",
  description:
    "Busque pelo nome do político ou pela cidade e veja quem foi eleito, segundo o Tribunal Superior Eleitoral: vereadores, prefeitos, deputados, governadores, senadores e a Presidência, com os indicadores oficiais do mandato.",
};

export default function QuemMeRepresentaPage() {
  const meta = getMetaEleitos();
  return (
    <div className="space-y-10">
      <header className="mx-auto max-w-3xl text-center">
        <Figurinha nome="pessoas" className="heroi-figurinha figurinha-flutua mx-auto" />
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Quem me representa</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          Busque pelo nome de um político ou pela sua cidade. Filtre por cargo, estado e partido e toque num nome para ver o cartão:
          cargo, partido e os indicadores do mandato que as fontes oficiais publicam, sempre com o período e a fonte.
        </p>
      </header>

      <BuscaRepresentantes />

      <div>
        <AvisoEleito />
      </div>

      <Secao id="estados" titulo="Por estado" descricao="Todos os eleitos de cada estado, por camadas (cidade, estado e Brasília). Em ordem alfabética.">
        <details>
          <summary>Ver a lista dos 27 estados</summary>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
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
        </details>
      </Secao>

      <Secao id="fontes" titulo="Fontes e limites">
        <div className="space-y-3 text-sm">
          <p>
            <strong>Indicadores do mandato.</strong> Projetos de autoria transformados em norma: deputados federais segundo os arquivos de
            dados abertos da Câmara dos Deputados (situação “Transformado em Norma Jurídica”) e senadores segundo a API de dados abertos do
            Senado Federal (situação “Transformada em norma jurídica”, com a norma gerada), contando as proposições apresentadas desde o
            início da legislatura atual, em 1º de fevereiro de 2023. Presença e faltas: só a Câmara dos Deputados publica a frequência de
            cada deputado por sessão; o Senado não publica a presença por sessão. Para vereadores, prefeitos, deputados estaduais,
            governadores e a Presidência, o site ainda não reúne esses indicadores em fonte oficial, e o cartão diz isso.
          </p>
          <p>
            <strong>Fotos.</strong> Os cartões só mostram a foto oficial quando a própria fonte declara que as imagens podem ser
            usadas, e sempre com o crédito que ela pede: deputados federais (“Arquivo/Câmara dos Deputados”), senadores (“Agência
            Senado”) e deputados estaduais de São Paulo (“Alesp”, licença Creative Commons Atribuição 4.0). As demais Assembleias,
            prefeitos, vereadores, governadores e a Presidência aparecem com as iniciais do nome, no mesmo formato, porque as fontes
            consultadas não declaram permissão de uso das fotos.
          </p>
          <p>
            <strong>Partidos.</strong> A lista de partidos está em ordem alfabética e é a do partido na eleição; quando há vínculo exato com a
            lista oficial de quem está em exercício, o cartão mostra também o partido atual, com a data da consulta.
          </p>
        </div>
        <div className="mt-4">
          <FontesEleitos fontes={meta?.fontes ?? []} lacunas={meta?.lacunas ?? []} glossario={meta?.glossario ?? {}} />
        </div>
      </Secao>
    </div>
  );
}
