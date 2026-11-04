/**
 * Decisões já coletadas no site que criaram ou mudaram os impostos desta seção. Placar e data
 * copiados dos registros oficiais em dados/camara e dados/senado (votações nominais).
 */
import type { LinkDecisao } from "./tipos";

/** Lei Complementar nº 214/2025 (Projeto de Lei Complementar nº 68/2024): CBS, IBS e Imposto Seletivo. */
export const DECISOES_LC214: LinkDecisao[] = [
  {
    rotulo: "Câmara aprova o texto do Projeto de Lei Complementar nº 68/2024",
    href: "/congresso/votacoes/camara/2430143-72",
    detalhe: "Votação nominal em 10/7/2024: 336 sim, 142 não, 2 abstenções.",
  },
  {
    rotulo: "Senado aprova o substitutivo ao Projeto de Lei Complementar nº 68/2024",
    href: "/congresso/votacoes/senado/6899",
    detalhe: "Votação nominal em 12/12/2024: 49 sim, 19 não.",
  },
  {
    rotulo: "Câmara aprova as mudanças do Senado ao Projeto de Lei Complementar nº 68/2024",
    href: "/congresso/votacoes/camara/2430143-140",
    detalhe: "Votação nominal em 17/12/2024: 324 sim, 123 não, 3 abstenções.",
  },
  {
    rotulo: "Veto parcial do Presidente à Lei Complementar nº 214/2025",
    href: "/executivo/vetos/vet-7-2025",
    detalhe: "Ato individual (veto), com as razões oficiais.",
  },
];

/** Lei Complementar nº 227/2026 (Projeto de Lei Complementar nº 108/2024): Comitê Gestor do IBS e ITCMD. */
export const DECISOES_LC227: LinkDecisao[] = [
  {
    rotulo: "Câmara aprova o texto do Projeto de Lei Complementar nº 108/2024",
    href: "/congresso/votacoes/camara/2438459-55",
    detalhe: "Votação nominal em 13/8/2024: 303 sim, 142 não.",
  },
  {
    rotulo: "Senado aprova o substitutivo ao Projeto de Lei Complementar nº 108/2024",
    href: "/congresso/votacoes/senado/7013",
    detalhe: "Votação nominal em 30/9/2025: 51 sim, 10 não, 1 abstenção.",
  },
  {
    rotulo: "Câmara aprova o substitutivo do Senado ao Projeto de Lei Complementar nº 108/2024",
    href: "/congresso/votacoes/camara/2438459-113",
    detalhe: "Votação nominal em 15/12/2025: 330 sim, 104 não.",
  },
  {
    rotulo: "Veto parcial do Presidente à Lei Complementar nº 227/2026",
    href: "/executivo/vetos/vet-8-2026",
    detalhe: "Ato individual (veto), com as razões oficiais.",
  },
];

/** Lei nº 15.270/2025 (Projeto de Lei nº 1.087/2025): redução do Imposto de Renda. */
export const DECISOES_IR: LinkDecisao[] = [
  {
    rotulo: "Câmara aprova o Projeto de Lei nº 1.087/2025",
    href: "/congresso/votacoes/camara/2487436-169",
    detalhe: "Votação nominal em 1º/10/2025: 493 sim, 0 não.",
  },
];

export const LINK_LEIS: LinkDecisao = {
  rotulo: "Leis e decretos do Executivo federal",
  href: "/executivo/leis-e-decretos",
  detalhe: "Inclui a Lei Complementar nº 214/2025, a Lei Complementar nº 227/2026 e a Lei nº 15.270/2025.",
};
