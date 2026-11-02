import Link from "next/link";

/** Seções disponíveis do site (ordem das fases do projeto, sem destaque). */
export const SECOES = [
  {
    href: "/impostos/icms",
    titulo: "ICMS",
    texto: "Mudanças do Imposto sobre Circulação de Mercadorias e Serviços (ICMS) que afetam São Paulo, com os valores antes e depois e quem decidiu.",
  },
  {
    href: "/congresso",
    titulo: "Congresso Nacional",
    texto: "Votações da Câmara dos Deputados e do Senado Federal, o voto de cada parlamentar e, dos deputados, a presença em Plenário e os gastos da cota parlamentar.",
  },
  {
    href: "/agenda",
    titulo: "Agenda do Plenário",
    texto: "Sessões marcadas e realizadas na Câmara, no Senado e no Congresso, com o desfecho oficial de cada item da pauta.",
  },
  {
    href: "/executivo",
    titulo: "Executivo federal",
    texto: "Medidas provisórias com a exposição de motivos, vetos com as razões oficiais e o que o Congresso decidiu, e leis e decretos.",
  },
  {
    href: "/sao-paulo",
    titulo: "Estado de São Paulo",
    texto: "Votações da Assembleia Legislativa (ALESP) com o voto de cada deputado estadual, projetos apresentados e as leis, decretos e vetos do governador.",
  },
  {
    href: "/atibaia",
    titulo: "Atibaia",
    texto: "Leis e decretos publicados na Imprensa Oficial do município, a composição da Câmara Municipal e as receitas e despesas informadas ao Tribunal de Contas do Estado.",
  },
  {
    href: "/justica",
    titulo: "Justiça",
    texto: "Temas repetitivos do Superior Tribunal de Justiça (STJ) e temas de repercussão geral e julgamentos do Supremo Tribunal Federal (STF), com a tese e o resultado.",
  },
  {
    href: "/tribunais-de-contas",
    titulo: "Tribunais de Contas",
    texto: "Pareceres do Tribunal de Contas da União (TCU) e do Tribunal de Contas do Estado de São Paulo (TCE-SP) sobre as contas de governo, e a busca nos acórdãos do TCU.",
  },
  {
    href: "/quem-me-representa",
    titulo: "Quem me representa",
    texto: "Eleitos de cada cidade e estado segundo o Tribunal Superior Eleitoral (TSE), com o que cada cargo faz.",
  },
];

export function ListaSecoes() {
  return (
    <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
      {SECOES.map((s) => (
        <li key={s.href} className="cartao">
          <h3 className="text-base font-semibold">
            <Link href={s.href} className="lk inline-flex min-h-11 items-center">
              {s.titulo}
            </Link>
          </h3>
          <p className="text-sm text-gray-800">{s.texto}</p>
        </li>
      ))}
    </ul>
  );
}
