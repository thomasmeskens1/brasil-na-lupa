import type { Metadata } from "next";
import Link from "next/link";
import { Secao } from "@/components/Secao";
import { getIndice, votacoesRecentes } from "@/features/congresso/dados";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { BuscaVotacoes } from "@/features/congresso/componentes/BuscaVotacoes";
import { ItemVotacao } from "@/features/congresso/componentes/ItemVotacao";
import { CASAS, CASA_MEMBROS, CASA_NOME, TERMOS, TIPO, formatarData } from "@/features/congresso/rotulos";

export const metadata: Metadata = {
  title: "Congresso Nacional",
  description:
    "Votações da Câmara dos Deputados e do Senado Federal: o que foi votado, o placar oficial e o voto de cada parlamentar nas votações nominais.",
};

const RECENTES = 8;

export default function CongressoPage() {
  const indices = CASAS.map((c) => getIndice(c));
  const anos = [...new Set(indices.flatMap((i) => i.votacoes.map((v) => v.data?.slice(0, 4) ?? "")).filter(Boolean))]
    .sort()
    .reverse();
  const termos = [
    { termo: TIPO.nominal.rotulo, explicacao: TIPO.nominal.explicacao },
    { termo: TIPO.simbolica.rotulo, explicacao: TIPO.simbolica.explicacao },
    { termo: TIPO.secreta.rotulo, explicacao: TIPO.secreta.explicacao },
    TERMOS.orientacao,
    TERMOS.obstrucao,
    TERMOS.ementa,
  ];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Congresso Nacional</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          O Congresso Nacional é formado pela Câmara dos Deputados (513 deputados federais) e pelo Senado
          Federal (81 senadores). Aqui estão as votações das duas casas, com o que foi votado, o placar
          oficial e, quando a votação foi nominal, o voto de cada parlamentar, tudo como publicado nos dados
          abertos de cada casa.
        </p>
        <ul className="meta mt-3 space-y-0.5">
          {indices.map((i) => (
            <li key={i.casa}>
              {CASA_NOME[i.casa]}: dados coletados em {formatarData(i.atualizado_em)}
              {i.periodo?.inicio ? `, votações de ${formatarData(i.periodo.inicio)} a ${formatarData(i.periodo.fim)}` : ""}.
            </li>
          ))}
        </ul>
      </header>

      <nav aria-label="Parlamentares" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {indices.map((i) => {
          const m = CASA_MEMBROS[i.casa];
          const n = i.parlamentares.filter((p) => p.na_lista_atual).length;
          return (
            <Link key={i.casa} href={m.rota} className="cartao block hover:bg-superficie">
              <span className="block text-base font-semibold text-[#234a73] underline underline-offset-2">{m.plural}</span>
              <span className="mt-1 block text-sm text-gray-800">
                {n} em exercício segundo a lista oficial {i.casa === "camara" ? "da Câmara" : "do Senado"}. Busque pelo
                nome e filtre por partido e estado.
              </span>
            </Link>
          );
        })}
      </nav>

      <Secao
        id="buscar"
        titulo="Buscar votações"
        descricao="A busca procura no nome da proposição, na ementa (resumo oficial do assunto) e no texto oficial do que foi votado. Ela roda no seu navegador: o que você digita não é enviado a nenhum servidor."
      >
        <BuscaVotacoes anos={anos} />
      </Secao>

      <Secao id="recentes" titulo="Votações mais recentes" descricao="Da mais recente para a mais antiga, em cada casa.">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {indices.map((i) => (
            <section key={i.casa} aria-labelledby={`recentes-${i.casa}`} className="min-w-0">
              <h3 id={`recentes-${i.casa}`} className="text-lg font-semibold text-gray-900">
                {CASA_NOME[i.casa]}
              </h3>
              {i.votacoes.length ? (
                <ul className="mt-3 space-y-3">
                  {votacoesRecentes(i.casa, RECENTES).map((v) => (
                    <li key={v.id}>
                      <ItemVotacao
                        casa={i.casa}
                        id={v.id}
                        data={v.data}
                        tipo={v.tipo}
                        resultado={v.resultado}
                        titulo={v.proposicao?.titulo ?? null}
                        descricao={v.descricao}
                        sim={v.placar?.sim}
                        nao={v.placar?.nao}
                        mostrarCasa={false}
                        nivel={4}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="lacuna mt-3 text-sm">Nenhuma votação coletada desta casa.</p>
              )}
            </section>
          ))}
        </div>
      </Secao>

      <Secao id="como-ler" titulo="Como ler as votações">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="cobertura" titulo="O que a coleta cobre">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {indices.map((i) => (
            <div key={i.casa} className="cartao">
              <h3 className="text-base font-semibold text-gray-900">{CASA_NOME[i.casa]}</h3>
              <p className="mt-1 text-sm text-gray-800">
                {i.votacoes.length} votações coletadas:{" "}
                {(
                  [
                    ["nominal", "nominais"],
                    ["simbolica", "simbólicas"],
                    ["secreta", "secretas"],
                  ] as const
                )
                  .map(([t, r]) => `${i.votacoes.filter((v) => v.tipo === t).length} ${r}`)
                  .join(", ")}
                .
              </p>
              {i.observacoes.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-800">
                  {i.observacoes.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              ) : null}
              <h4 className="mt-3 text-sm font-semibold text-gray-900">Fontes</h4>
              <div className="mt-2">
                <ListaFontes fontes={i.fontes} />
              </div>
            </div>
          ))}
        </div>
      </Secao>
    </div>
  );
}
