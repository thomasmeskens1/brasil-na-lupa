import Link from "next/link";

const PRONTAS = [
  {
    href: "/congresso",
    titulo: "Congresso Nacional",
    texto: "Votações da Câmara dos Deputados e do Senado Federal, o voto de cada parlamentar e, dos deputados, a presença em Plenário e os gastos da cota parlamentar.",
  },
  {
    href: "/executivo",
    titulo: "Executivo federal",
    texto: "Medidas provisórias com a exposição de motivos, vetos com as razões oficiais e o que o Congresso decidiu, e leis e decretos.",
  },
  {
    href: "/justica",
    titulo: "Justiça",
    texto: "Temas repetitivos do Superior Tribunal de Justiça (STJ) e temas de repercussão geral e julgamentos do Supremo Tribunal Federal (STF), com a tese, o resultado e os votos dos ministros quando conferidos ou publicados pelo tribunal.",
  },
  {
    href: "/tribunais-de-contas",
    titulo: "Tribunais de Contas",
    texto: "O parecer prévio do Tribunal de Contas da União (TCU) sobre as contas do Presidente e do Tribunal de Contas do Estado de São Paulo (TCE-SP) sobre as do Governador e do prefeito de Atibaia, com o julgamento político no Legislativo, e a busca nos acórdãos do TCU.",
  },
  {
    href: "/sao-paulo",
    titulo: "Estado de São Paulo",
    texto: "Votações da Assembleia Legislativa (ALESP) com o voto de cada deputado estadual, projetos apresentados e as leis, decretos e vetos do governador, com as razões dos vetos.",
  },
  {
    href: "/atibaia",
    titulo: "Atibaia",
    texto: "Leis e decretos publicados na Imprensa Oficial do município, a composição da Câmara Municipal e as receitas e despesas informadas ao Tribunal de Contas do Estado (TCE-SP).",
  },
];


function ListaSecoes({ itens, pronta }: { itens: { href: string; titulo: string; texto: string; obs?: string }[]; pronta: boolean }) {
  return (
    <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
      {itens.map((s) => (
        <li key={s.href} className="cartao">
          <h3 className="text-base font-semibold">
            <Link href={s.href} className="lk">
              {s.titulo}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-gray-800">{s.texto}</p>
          {s.obs ? <p className="meta mt-2">{s.obs}</p> : null}
          {pronta ? null : <p className="selo mt-2">Em construção</p>}
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <div className="space-y-10">
      <section aria-labelledby="titulo-home" className="max-w-3xl">
        <h1 id="titulo-home" className="text-2xl font-bold text-gray-900 md:text-3xl">
          O que foi decidido, quem decidiu e por quê
        </h1>
        <p className="mt-3 leading-relaxed text-gray-800 lg:text-lg">
          Este site acompanha o que é votado e decidido pelos políticos do Brasil: o que mudou, quem
          decidiu, como cada um votou e a justificativa registrada em documento oficial. Toda
          informação traz o link para a fonte oficial e a data em que foi coletada.
        </p>
        <p className="mt-3 leading-relaxed text-gray-800 lg:text-lg">
          O site não classifica votos, leis ou políticos como bons ou ruins. Quem julga é o leitor.
        </p>
      </section>

      <section aria-labelledby="titulo-destaque" className="rounded-lg border border-[#9aa5b1] bg-acento-fundo p-5 md:p-6">
        <p className="meta font-semibold uppercase tracking-wide">Em destaque</p>
        <h2 id="titulo-destaque" className="mt-1 text-xl font-bold text-gray-900 md:text-2xl">
          ICMS: quem decidiu e por quê
        </h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-gray-800">
          O Imposto sobre Circulação de Mercadorias e Serviços (ICMS) é cobrado pelos estados e pode
          mudar por quatro caminhos: o Conselho Nacional de Política Fazendária (CONFAZ), a
          Assembleia Legislativa, o governador e o Congresso Nacional com a Presidência da República.
          Veja cada mudança que afeta São Paulo, com os valores antes e depois e quem decidiu.
        </p>
        <Link
          href="/impostos/icms"
          className="mt-4 inline-block rounded-md bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f3347]"
        >
          Ver as decisões sobre o ICMS
        </Link>
      </section>

      <section aria-labelledby="titulo-prontas">
        <h2 id="titulo-prontas" className="text-xl font-bold text-gray-900">
          Seções disponíveis
        </h2>
        <ListaSecoes itens={PRONTAS} pronta />
      </section>

      <p className="text-sm text-gray-800">
        Como as informações são reunidas:{" "}
        <Link href="/metodologia" className="lk">
          Metodologia
        </Link>
        .
      </p>

    </div>
  );
}
