/**
 * Termos novos da seção Impostos (diretriz 9), explicados de forma breve e neutra a partir do
 * texto da Constituição, da Emenda Constitucional nº 132/2023 e da Lei Complementar nº
 * 214/2025. Passados ao <Termo glossario={TERMOS_IMPOSTOS}>; os termos já existentes no
 * glossário geral (Alíquota, Lei Complementar, Decreto, Convênio ICMS, CONFAZ, Exposição de
 * motivos, Veto, Votação nominal) continuam vindo de lá.
 */
import type { EntradaGlossario } from "@/components/glossario";

export const TERMOS_IMPOSTOS: EntradaGlossario[] = [
  {
    termo: "Reforma Tributária do consumo",
    explicacao:
      "Mudança na forma de cobrar os impostos sobre bens e serviços, feita pela Emenda Constitucional nº 132/2023 e regulamentada pela Lei Complementar nº 214/2025. Troca PIS, Cofins, IPI, ICMS e ISS pela CBS, pelo IBS e pelo Imposto Seletivo, aos poucos, de 2026 a 2033.",
  },
  {
    termo: "Emenda Constitucional",
    explicacao:
      "Mudança no texto da Constituição Federal. Precisa ser aprovada pela Câmara dos Deputados e pelo Senado Federal, em dois turnos em cada Casa, e é promulgada pelo próprio Congresso, sem sanção do Presidente da República.",
  },
  {
    termo: "Lei ordinária",
    explicacao:
      "Lei comum, aprovada por maioria simples no Congresso Nacional (ou na Assembleia Legislativa, ou na Câmara Municipal). A Constituição diz que as alíquotas da CBS e do Imposto Seletivo podem ser fixadas por lei ordinária.",
  },
  {
    termo: "Resolução do Senado",
    explicacao:
      "Ato aprovado só pelo Senado Federal, sem sanção do Presidente. A Constituição usa a resolução do Senado para fixar algumas alíquotas, como as do ICMS entre estados, a máxima do ITCMD e as alíquotas de referência da CBS e do IBS.",
  },
  {
    termo: "Alíquota de referência",
    explicacao:
      "Alíquota calculada pelo Tribunal de Contas da União e fixada por resolução do Senado para cada esfera (União, estados e municípios). Vale quando o ente não aprova uma lei com a sua própria alíquota (Lei Complementar nº 214/2025, artigos 14 e 349).",
  },
  {
    termo: "Não cumulatividade",
    explicacao:
      "Regra pela qual a empresa desconta do imposto que deve o imposto já pago nas compras feitas para produzir ou vender. Assim, o imposto não se acumula a cada etapa da cadeia.",
  },
  {
    termo: "Contribuição",
    explicacao:
      "Tipo de tributo federal cuja arrecadação tem destino definido na Constituição, como a seguridade social. PIS, Cofins e CBS são contribuições.",
  },
  {
    termo: "Comitê Gestor do IBS",
    explicacao:
      "Entidade formada pelos estados, pelo Distrito Federal e pelos municípios para administrar juntos o IBS: arrecadar, compensar créditos e distribuir o dinheiro entre eles. Foi instituída pela Lei Complementar nº 227/2026.",
  },
  {
    termo: "Fase de teste",
    explicacao:
      "Em 2026, a CBS e o IBS são calculados com alíquotas de teste (0,9% e 0,1%). O valor é compensado com o PIS e a Cofins, e quem cumpre as obrigações acessórias fica dispensado de recolher (Lei Complementar nº 214/2025, artigo 348).",
  },
  {
    termo: "Obrigação acessória",
    explicacao:
      "Dever de informar, e não de pagar: emitir nota fiscal, preencher declarações e guardar documentos, conforme a legislação.",
  },
  {
    termo: "Devolução personalizada (cashback)",
    explicacao:
      "Devolução de parte da CBS e do IBS pagos nas compras a famílias de baixa renda inscritas no Cadastro Único, com renda mensal por pessoa de até meio salário-mínimo (Lei Complementar nº 214/2025, artigos 112 a 124).",
  },
  {
    termo: "Cadastro Único (CadÚnico)",
    explicacao:
      "Cadastro do Governo federal que reúne as famílias de baixa renda e é usado por programas sociais.",
  },
  {
    termo: "Cesta Básica Nacional de Alimentos",
    explicacao:
      "Lista de alimentos criada pela Emenda Constitucional nº 132/2023 e definida no Anexo I da Lei Complementar nº 214/2025, sobre os quais a CBS e o IBS têm alíquota zero.",
  },
  {
    termo: "Imposto progressivo",
    explicacao:
      "Imposto cuja alíquota sobe conforme aumenta o valor tributado (a renda, o valor do imóvel ou o valor da herança, por exemplo).",
  },
  {
    termo: "Ad valorem",
    explicacao: "Imposto cobrado como percentual do preço ou do valor do bem, e não como valor fixo por unidade.",
  },
  {
    termo: "Zona Franca de Manaus",
    explicacao:
      "Área com regras tributárias próprias para a indústria instalada em Manaus, mantidas pela Constituição. Por isso, o IPI continua existindo depois de 2027 para produtos com industrialização incentivada ali.",
  },
  {
    termo: "Voto em separado",
    explicacao:
      "Parecer alternativo apresentado por um ou mais parlamentares de uma comissão, com conclusão diferente da do relator. Fica registrado na tramitação oficial.",
  },
  {
    termo: "Rendimento tributável",
    explicacao: "Parte da renda sobre a qual a lei manda calcular o Imposto de Renda, como salário, aposentadoria e aluguel.",
  },
];
