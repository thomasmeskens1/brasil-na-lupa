import type { Metadata } from "next";
import Link from "next/link";
import { metadadosCompartilhamento } from "@/components/compartilhar/metadados";
import { Secao } from "@/components/Secao";
import { getIndice, opcoesFiltro, votacoesIniciais } from "@/features/congresso/dados";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { ListaVotacoes } from "@/features/congresso/componentes/ListaVotacoes";
import { CASAS, CASA_MEMBROS, CASA_NOME, TERMOS, TIPO, formatarData } from "@/features/congresso/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = metadadosCompartilhamento({
  titulo: "Congresso Nacional: votações da Câmara e do Senado",
  descricao:
    "O que foi votado na Câmara dos Deputados e no Senado Federal, dia a dia: o placar oficial, o resultado e o voto de cada parlamentar nas votações nominais, com fonte oficial.",
  caminho: "/congresso",
});

const INICIAIS = 30;

export default function CongressoPage() {
  const indices = CASAS.map((c) => getIndice(c));
  const { temas, anos } = opcoesFiltro();
  const iniciais = votacoesIniciais(INICIAIS);
  const termos = [
    { termo: TIPO.nominal.rotulo, explicacao: TIPO.nominal.explicacao },
    { termo: TIPO.simbolica.rotulo, explicacao: TIPO.simbolica.explicacao },
    { termo: TIPO.secreta.rotulo, explicacao: TIPO.secreta.explicacao },
    TERMOS.orientacao,
    TERMOS.obstrucao,
    TERMOS.ementa,
  ];
  const atalhos = [
    ...indices.map((i) => ({
      href: CASA_MEMBROS[i.casa].rota,
      titulo: CASA_MEMBROS[i.casa].plural,
      texto: `${i.parlamentares.filter((p) => p.na_lista_atual).length} em exercício. Busque pelo nome, partido ou estado.`,
    })),
    { href: "/congresso/composicao", titulo: "Composição das casas", texto: "Quantos parlamentares cada partido e cada estado têm hoje." },
    { href: "/congresso/comparar", titulo: "Comparar parlamentares", texto: "Até 5 lado a lado: presença, gastos e votos nas mesmas votações." },
  ];

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Figurinha nome="congresso" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Congresso Nacional</h1>
        <p className="mt-3 leading-relaxed">
          O que a Câmara dos Deputados (513 deputados federais) e o Senado Federal (81 senadores) votaram, dia a dia: o
          resultado, o placar oficial e, quando a votação foi nominal, o voto de cada parlamentar, como publicado nos dados
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

      <nav aria-label="Parlamentares" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {atalhos.map((a) => (
          <Link key={a.href} href={a.href} className="cartao block min-h-11 hover:bg-superficie">
            <span className="block font-semibold text-[var(--cor-link)] underline underline-offset-2">{a.titulo}</span>
            <span className="mt-1 block text-sm">{a.texto}</span>
          </Link>
        ))}
      </nav>

      <Secao id="votacoes" titulo="Votações no Plenário, dia a dia">
        <ListaVotacoes iniciais={iniciais} temas={temas} anos={anos} />
      </Secao>

      <Secao id="como-ler" titulo="Como ler as votações">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="cobertura" titulo="O que a coleta cobre">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {indices.map((i) => (
            <div key={i.casa} className="cartao">
              <h3 className="font-semibold text-foreground">{CASA_NOME[i.casa]}</h3>
              <p className="mt-1">
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
                ; {i.votacoes.filter((v) => v.muda_lei).length} entram no filtro “Só o que muda leis”.
              </p>
              {i.observacoes.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {i.observacoes.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              ) : null}
              <h4 className="mt-3 text-sm font-semibold text-foreground">Fontes</h4>
              <div className="mt-2">
                <ListaFontes fontes={i.fontes} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-[var(--cor-secundaria)]">
          Títulos em linguagem simples: manchetes da Agência Câmara e da Agência Senado (órgãos de comunicação das casas),
          apelidos oficiais das proposições ou frases montadas só com campos do documento oficial. Na página de cada votação
          aparecem a origem do título e o texto oficial.
        </p>
      </Secao>
    </div>
  );
}
