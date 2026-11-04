/**
 * "Como uma proposta vira lei": linha do tempo vertical (lista numerada, lida em ordem pelo
 * leitor de tela), uma frase por etapa e um "Saiba mais" recolhível com o artigo da Constituição.
 * Texto conferido na Constituição Federal (Planalto) em 03/11/2026.
 */
import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";

const CF = "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm";
const CONSULTA = "03/11/2026";

interface Etapa {
  titulo: string;
  frase: string;
  mais: string;
  artigo: string;
  ancora: string;
  link?: { href: string; texto: string };
}

const ETAPAS: Etapa[] = [
  {
    titulo: "Alguém apresenta a proposta",
    frase: "Deputados, senadores, comissões, o presidente da República, tribunais, o procurador-geral da República ou os próprios cidadãos podem propor uma lei.",
    mais: "A proposta assinada por cidadãos (iniciativa popular) é apresentada à Câmara dos Deputados e precisa de pelo menos 1% do eleitorado nacional, de cinco estados ou mais. Propostas do presidente da República, do Supremo Tribunal Federal e dos tribunais superiores começam pela Câmara.",
    artigo: "artigos 61 e 64",
    ancora: "#art61",
  },
  {
    titulo: "As comissões analisam",
    frase: "Grupos menores de parlamentares, divididos por assunto, estudam o texto e votam um parecer, que pode propor mudanças.",
    mais: "Em alguns casos previstos no regimento, a comissão decide sozinha, sem passar pelo Plenário (o chamado poder conclusivo), a não ser que um décimo dos membros da casa peça a votação em Plenário.",
    artigo: "artigo 58, § 2º",
    ancora: "#art58",
  },
  {
    titulo: "O Plenário vota",
    frase: "Todos os parlamentares da casa votam: de forma simbólica (sem registro de cada voto) ou nominal (com o voto de cada um registrado).",
    mais: "Projeto de lei é aprovado pela maioria dos votos, com a maioria dos membros presente. Projeto de lei complementar precisa de maioria absoluta (mais da metade de todos os membros). Proposta de emenda à Constituição precisa de três quintos, em dois turnos, em cada casa.",
    artigo: "artigos 47, 60 e 69",
    ancora: "#art47",
    link: { href: "#votacoes", texto: "Ver as votações do Plenário" },
  },
  {
    titulo: "A outra casa revisa",
    frase: "O texto aprovado em uma casa vai para a outra (Câmara ou Senado); se ela mudar algo, ele volta para a casa onde começou.",
    mais: "A casa revisora vota em um só turno. Se aprovar sem mudanças, o projeto segue para o presidente da República; se rejeitar, ele é arquivado.",
    artigo: "artigo 65",
    ancora: "#art65",
  },
  {
    titulo: "O presidente sanciona ou veta",
    frase: "O presidente da República tem 15 dias úteis para concordar com o texto (sanção) ou recusá-lo, no todo ou em parte (veto).",
    mais: "Se o presidente não se manifestar no prazo, o silêncio vale como sanção. A emenda à Constituição não passa por esta etapa: é promulgada pelas Mesas da Câmara e do Senado.",
    artigo: "artigos 60, § 3º, e 66",
    ancora: "#art66",
    link: { href: "/executivo/vetos", texto: "Ver os vetos" },
  },
  {
    titulo: "O Congresso analisa os vetos",
    frase: "Em sessão conjunta, deputados e senadores decidem se mantêm ou derrubam cada trecho vetado.",
    mais: "O veto é analisado em até 30 dias e só é derrubado pelo voto da maioria absoluta dos deputados e dos senadores. Trecho com veto derrubado volta para o texto da lei.",
    artigo: "artigo 66, § 4º",
    ancora: "#art66",
  },
  {
    titulo: "Vira lei",
    frase: "A lei é promulgada e publicada no Diário Oficial da União e passa a valer na data que o próprio texto indicar.",
    mais: "Se o presidente não promulgar em 48 horas nos casos de sanção pelo silêncio ou de veto derrubado, o presidente do Senado promulga.",
    artigo: "artigo 66, § 7º",
    ancora: "#art66",
    link: { href: "/executivo/leis-e-decretos", texto: "Ver as leis" },
  },
];

export function ComoViraLei() {
  return (
    <div className="max-w-3xl">
      <ol className="relative space-y-0">
        {ETAPAS.map((e, i) => (
          <li key={e.titulo} className="relative grid grid-cols-[2.75rem_1fr] gap-3 pb-6 last:pb-0">
            {i < ETAPAS.length - 1 ? (
              <span aria-hidden="true" className="absolute bottom-0 left-[1.375rem] top-11 w-0.5 -translate-x-1/2 bg-[var(--cor-borda-forte)]" />
            ) : null}
            <span
              aria-hidden="true"
              className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--cor-acento)] bg-[var(--background)] font-titulo text-lg font-extrabold text-foreground"
            >
              {i + 1}
            </span>
            <div className="min-w-0 pt-1.5">
              <h3 className="font-titulo text-lg font-extrabold leading-snug text-foreground">
                <span className="sr-only">Etapa {i + 1}: </span>
                {e.titulo}
              </h3>
              <p className="mt-1 leading-relaxed">{e.frase}</p>
              <details className="mt-1">
                <summary className="lk inline-flex min-h-11 cursor-pointer items-center text-sm">
                  Saiba mais<span className="sr-only"> sobre a etapa {i + 1}</span>
                </summary>
                <div className="space-y-1 pb-2 text-sm leading-relaxed text-[var(--cor-secundaria)]">
                  <p>{e.mais}</p>
                  <p>
                    <FonteLink href={`${CF}${e.ancora}`} tipo="oficial">
                      Constituição Federal, {e.artigo}
                    </FonteLink>{" "}
                    · consultado em {CONSULTA}
                  </p>
                </div>
              </details>
              {e.link ? (
                <Link href={e.link.href} className="lk inline-flex min-h-11 items-center text-sm font-semibold">
                  {e.link.texto} <span aria-hidden="true">&nbsp;→</span>
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <p className="aviso mt-6 text-sm leading-relaxed">
        <span className="font-semibold">E a medida provisória?</span> Segue outro caminho: o presidente da República a publica e
        ela já vale como lei. Depois, uma comissão de deputados e senadores e os Plenários da Câmara e do Senado decidem se ela
        vira lei de vez; sem aprovação em 60 dias, prorrogáveis por mais 60, perde a validade.{" "}
        <FonteLink href={`${CF}#art62`} tipo="oficial">
          Constituição Federal, artigo 62
        </FonteLink>
        {" · "}
        <Link href="/executivo/medidas-provisorias" className="lk">
          Ver as medidas provisórias
        </Link>
      </p>
    </div>
  );
}
