import type { Metadata } from "next";
import { Figurinha } from "@/components/marca/Figurinhas";
import { Termo } from "@/components/glossario";
import { metadadosCompartilhamento } from "@/components/compartilhar/metadados";
import { IMPOSTOS } from "@/features/impostos/dados";
import { DECISOES_IR, DECISOES_LC214, DECISOES_LC227, LINK_LEIS } from "@/features/impostos/decisoes";
import { DATA_CONSULTA, FONTES, dataCurta } from "@/features/impostos/fontes";
import { TERMOS_IMPOSTOS } from "@/features/impostos/termos";
import type { ChaveFonte } from "@/features/impostos/tipos";
import { CartaoImposto } from "@/features/impostos/componentes/CartaoImposto";
import { FiltroImpostos } from "@/features/impostos/componentes/FiltroImpostos";
import { Justificativas } from "@/features/impostos/componentes/Justificativas";
import { LinhaDoTempo } from "@/features/impostos/componentes/LinhaDoTempo";
import { ListaDecisoes } from "@/features/impostos/componentes/ListaDecisoes";
import { ListaFontesImposto } from "@/features/impostos/componentes/LinkFonte";
import { TabelaComparacao } from "@/features/impostos/componentes/TabelaComparacao";

export const metadata: Metadata = metadadosCompartilhamento({
  titulo: "Impostos: como funcionam hoje e o que muda a partir de 2027",
  descricao:
    "Os principais impostos do dia a dia, quem cobra, quem decide a alíquota e a transição da Reforma Tributária do consumo de 2026 a 2033, com fonte oficial.",
  caminho: "/impostos",
});

const DESTAQUES = [
  { ano: "2026", texto: "Fase de teste da CBS e do IBS" },
  { ano: "2027", texto: "Começam a CBS e o Imposto Seletivo; acabam o PIS e a Cofins" },
  { ano: "2029 a 2032", texto: "ICMS e ISS diminuem a cada ano" },
  { ano: "2033", texto: "ICMS e ISS deixam de existir" },
];

const SECOES = [
  { id: "impostos", rotulo: "Os impostos" },
  { id: "linha-do-tempo", rotulo: "Linha do tempo" },
  { id: "comparacao", rotulo: "Hoje e a partir de 2027" },
  { id: "decisoes", rotulo: "Decisões no site" },
  { id: "justificativas", rotulo: "Justificativas oficiais" },
  { id: "fontes", rotulo: "Fontes" },
];

export default function ImpostosPage() {
  const fontes: ChaveFonte[] = [...IMPOSTOS.flatMap((i) => [...i.fontes, ...i.mudancas.map((m) => m.fonte)]), "em38", "pec45", "pec45Parecer", "pec45Vs", "pec45Texto", "plp68", "plp108", "pl1087"];
  const fontesOrdenadas = (Object.keys(FONTES) as ChaveFonte[]).filter((c) => fontes.includes(c));

  return (
    <div className="space-y-12">
      <header className="max-w-3xl">
        <Figurinha nome="dinheiro" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Impostos: como funcionam hoje e o que muda a partir de 2027</h1>
        <p className="mt-2 leading-relaxed text-gray-800">
          Quem cobra cada imposto, sobre o quê, quem decide quanto se paga e o que muda com a{" "}
          <Termo termo="Reforma Tributária do consumo" glossario={TERMOS_IMPOSTOS}>
            Reforma Tributária do consumo
          </Termo>
          , feita pela Emenda Constitucional nº 132/2023 e pela Lei Complementar nº 214/2025.
        </p>
        <p className="mt-2 leading-relaxed text-gray-800">
          Até 2033, a reforma troca o Programa de Integração Social (PIS), a Contribuição para o Financiamento da
          Seguridade Social (Cofins), o Imposto sobre Circulação de Mercadorias e Serviços (ICMS) e o Imposto sobre
          Serviços (ISS) pela Contribuição Social sobre Bens e Serviços (CBS), pelo Imposto sobre Bens e Serviços (IBS) e
          pelo Imposto Seletivo. O Imposto sobre Produtos Industrializados (IPI) vai a zero em 2027, menos para produtos
          incentivados da Zona Franca de Manaus.
        </p>
        <p className="meta mt-2">Fontes oficiais consultadas em {dataCurta(DATA_CONSULTA)}.</p>
        <nav aria-label="Nesta página" className="mt-4">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {SECOES.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="lk inline-flex min-h-11 items-center">
                  {s.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section aria-labelledby="resumo-titulo">
        <h2 id="resumo-titulo" className="sr-only">
          A reforma em quatro datas
        </h2>
        <ol className="entrada grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DESTAQUES.map((d) => (
            <li key={d.ano} className="bloco-secao p-4">
              <span className="destaque-neon whitespace-nowrap text-lg">{d.ano}</span>
              <p className="mt-2 font-medium text-gray-900">{d.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="impostos" aria-labelledby="impostos-titulo" className="scroll-mt-20 space-y-4">
        <h2 id="impostos-titulo" className="text-xl font-bold text-gray-900">
          Os impostos, um por um
        </h2>
        <p className="max-w-3xl text-gray-800">
          Filtre por quem cobra (União, estado ou município) e pelo que é tributado. Cada cartão leva à página do imposto.
        </p>
        <FiltroImpostos
          itens={IMPOSTOS.map((i) => ({
            chave: i.slug,
            esferas: i.esferas,
            base: i.base,
            cartao: <CartaoImposto imposto={i} />,
          }))}
        />
      </section>

      <section id="linha-do-tempo" aria-labelledby="linha-titulo" className="scroll-mt-20 space-y-4">
        <h2 id="linha-titulo" className="text-xl font-bold text-gray-900">
          Linha do tempo da transição
        </h2>
        <p className="max-w-3xl text-gray-800">
          Datas e percentuais do Ato das Disposições Constitucionais Transitórias (artigos 125 a 129, incluídos pela Emenda
          Constitucional nº 132/2023) e da Lei Complementar nº 214/2025.
        </p>
        <LinhaDoTempo />
      </section>

      <section id="comparacao" aria-labelledby="comparacao-titulo" className="scroll-mt-20 space-y-4">
        <h2 id="comparacao-titulo" className="text-xl font-bold text-gray-900">
          Hoje (2026) e a partir de 2027
        </h2>
        <TabelaComparacao />
      </section>

      <section id="decisoes" aria-labelledby="decisoes-titulo" className="scroll-mt-20 space-y-6">
        <h2 id="decisoes-titulo" className="text-xl font-bold text-gray-900">
          Decisões já registradas no site
        </h2>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">ICMS em São Paulo</h3>
          <ListaDecisoes
            itens={[
              {
                rotulo: "ICMS: quem decidiu e por quê",
                href: "/impostos/icms",
                detalhe: "Convênios do CONFAZ, leis da Assembleia Legislativa, decretos do governador e normas federais.",
              },
            ]}
          />
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">CBS, IBS e Imposto Seletivo (Lei Complementar nº 214/2025)</h3>
          <ListaDecisoes itens={DECISOES_LC214} />
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Comitê Gestor do IBS e ITCMD (Lei Complementar nº 227/2026)</h3>
          <ListaDecisoes itens={DECISOES_LC227} />
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Imposto de Renda (Lei nº 15.270/2025)</h3>
          <ListaDecisoes itens={[...DECISOES_IR, LINK_LEIS]} />
        </div>
        <p className="text-sm text-gray-800">
          As votações acima são <Termo termo="Votação nominal">votações nominais</Termo>, com o voto de cada
          parlamentar registrado oficialmente.
        </p>
      </section>

      <section id="justificativas" aria-labelledby="justificativas-titulo" className="scroll-mt-20 space-y-4">
        <h2 id="justificativas-titulo" className="text-xl font-bold text-gray-900">
          Justificativas oficiais
        </h2>
        <p className="max-w-3xl text-gray-800">
          O que o autor da proposta escreveu e, quando registrada em documento oficial, a posição contrária. O site não
          avalia a reforma.
        </p>
        <Justificativas />
      </section>

      <section id="fontes" aria-labelledby="fontes-titulo" className="scroll-mt-20 space-y-4">
        <h2 id="fontes-titulo" className="text-xl font-bold text-gray-900">
          Fontes
        </h2>
        <ListaFontesImposto chaves={fontesOrdenadas} />
      </section>
    </div>
  );
}
