import type { TermoGlossario } from "./tipos";

/**
 * Definições breves e neutras usadas quando dados/glossario.json não traz o termo
 * (diretriz 9). O glossário oficial do projeto, quando existir, tem prioridade.
 */
export const GLOSSARIO_BASE: TermoGlossario[] = [
  {
    termo: "ICMS (Imposto sobre Circulação de Mercadorias e Serviços)",
    explicacao:
      "Imposto cobrado pelos estados e pelo Distrito Federal sobre a venda de mercadorias e sobre alguns serviços, como transporte entre cidades e estados, energia e comunicação.",
  },
  {
    termo: "CONFAZ (Conselho Nacional de Política Fazendária)",
    explicacao:
      "Conselho formado por representantes das secretarias de Fazenda dos 26 estados e do Distrito Federal, presidido por representante do Governo federal. Aprova os convênios que tratam do ICMS em conjunto.",
  },
  {
    termo: "Convênio ICMS",
    explicacao:
      "Acordo aprovado pelos estados e pelo Distrito Federal no CONFAZ. Pode fixar valores do ICMS em todo o país ou autorizar benefícios fiscais, como isenções e reduções.",
  },
  {
    termo: "Alíquota",
    explicacao: "Percentual ou valor usado para calcular quanto imposto é cobrado.",
  },
  {
    termo: "Ad rem",
    explicacao:
      "Imposto cobrado como um valor fixo em reais por unidade (por litro ou por quilo, por exemplo), e não como percentual do preço. É o modelo usado no ICMS sobre gasolina, diesel e gás de cozinha.",
  },
  {
    termo: "Ratificação",
    explicacao:
      "Confirmação de um convênio pelos estados e pelo Distrito Federal. Sem ela, o convênio não produz efeitos.",
  },
  {
    termo: "Ato Declaratório",
    explicacao:
      "Documento publicado pelo CONFAZ que declara se um convênio foi ratificado ou não pelos estados e pelo Distrito Federal.",
  },
  {
    termo: "Lei Complementar",
    explicacao:
      "Tipo de lei que trata de temas que a Constituição reserva a ela, como normas gerais de impostos. Precisa da maioria absoluta dos votos da Câmara dos Deputados e do Senado Federal para ser aprovada.",
  },
  {
    termo: "Decreto",
    explicacao:
      "Ato assinado pelo chefe do Poder Executivo (presidente, governador ou prefeito) para regulamentar leis ou aplicar o que um convênio autorizou. Não passa por votação de parlamentares.",
  },
  {
    termo: "Substituição tributária",
    explicacao:
      "Regra em que uma empresa da cadeia, em geral o fabricante ou o importador, recolhe antecipadamente o imposto devido nas etapas seguintes da venda.",
  },
  {
    termo: "Votação nominal",
    explicacao: "Votação em que o voto de cada parlamentar fica registrado oficialmente, com o nome de quem votou.",
  },
  {
    termo: "Votação simbólica",
    explicacao:
      "Votação em que o presidente da sessão anuncia o resultado sem registrar o voto de cada parlamentar.",
  },
];
