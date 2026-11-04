import Link from "next/link";
import { Figurinha, type NomeFigurinha } from "@/components/marca/Figurinhas";

/** Seções disponíveis do site (ordem das fases do projeto, sem destaque). */
export const SECOES = [
  {
    href: "/impostos/icms",
    icone: "dinheiro" as NomeFigurinha,
    titulo: "ICMS",
    texto: "Mudanças do Imposto sobre Circulação de Mercadorias e Serviços (ICMS) que afetam São Paulo, com os valores antes e depois e quem decidiu.",
  },
  {
    href: "/congresso",
    icone: "congresso" as NomeFigurinha,
    titulo: "Congresso Nacional",
    texto: "Votações da Câmara dos Deputados e do Senado Federal, o voto de cada parlamentar e os gastos da cota parlamentar; dos deputados, também a presença em Plenário.",
  },
  {
    href: "/agenda",
    icone: "calendario" as NomeFigurinha,
    titulo: "Agenda do Plenário",
    texto: "Sessões marcadas e realizadas na Câmara, no Senado e no Congresso, com o desfecho oficial de cada item da pauta.",
  },
  {
    href: "/executivo",
    icone: "caneta" as NomeFigurinha,
    titulo: "Executivo federal",
    texto: "Medidas provisórias com a exposição de motivos, vetos com as razões oficiais e o que o Congresso decidiu, e leis e decretos.",
  },
  {
    href: "/estados",
    icone: "mapa" as NomeFigurinha,
    titulo: "Estados",
    texto: "Votações das Assembleias Legislativas (com o voto de cada deputado estadual quando a votação é nominal), projetos e as leis e decretos dos governadores, estado por estado.",
  },
  {
    href: "/municipios/sp/atibaia",
    icone: "cidade" as NomeFigurinha,
    titulo: "Atibaia",
    texto: "Leis e decretos publicados na Imprensa Oficial do município, a composição da Câmara Municipal e as receitas e despesas informadas ao Tribunal de Contas do Estado.",
  },
  {
    href: "/justica",
    icone: "balanca" as NomeFigurinha,
    titulo: "Justiça",
    texto: "Temas repetitivos do Superior Tribunal de Justiça (STJ) e temas de repercussão geral e julgamentos do Supremo Tribunal Federal (STF), com a tese e o resultado.",
  },
  {
    href: "/tribunais-de-contas",
    icone: "lupa" as NomeFigurinha,
    titulo: "Tribunais de Contas",
    texto: "Pareceres do Tribunal de Contas da União (TCU) e do Tribunal de Contas do Estado de São Paulo (TCE-SP) sobre as contas de governo, e a busca nos acórdãos do TCU.",
  },
  {
    href: "/quem-me-representa",
    icone: "pessoas" as NomeFigurinha,
    titulo: "Quem me representa",
    texto: "Eleitos de cada cidade e estado segundo o Tribunal Superior Eleitoral (TSE), com o que cada cargo faz.",
  },
];

export function ListaSecoes() {
  return (
    <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {SECOES.map((s) => (
        <li key={s.href}>
          <Link href={s.href} className="bloco-secao group">
            <Figurinha nome={s.icone} className="h-12 w-12 flex-none transition-transform group-hover:-rotate-6 group-hover:scale-105" />
            <span className="min-w-0">
              <span className="block font-titulo text-lg font-extrabold text-white-puro">{s.titulo}</span>
              <span className="mt-0.5 block text-sm text-[var(--cor-texto-apoio)]">{s.texto}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
