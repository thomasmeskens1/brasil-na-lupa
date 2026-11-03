/**
 * Cartão de Decisão e cabeçalho de detalhe (redesenho mobile, Onda 1).
 *   import { CartaoDecisao, CabecalhoDecisao, placarOficial, tituloSimplesDe } from "@/components/decisao";
 * Exemplos de uso no topo de cada arquivo.
 */
export { CartaoDecisao, type CartaoDecisaoProps } from "./CartaoDecisao";
export { CabecalhoDecisao, type CabecalhoDecisaoProps } from "./CabecalhoDecisao";
export { BlocoDadoChave, BarraPlacar, type BlocoDadoChaveProps, type BarraPlacarProps } from "./DadoChave";
export { FichaTecnica, ItemRecolhivel, type FichaTecnicaProps, type ItemFicha, type ItemRecolhivelProps } from "./FichaTecnica";
export {
  EtiquetaDecisao,
  SeloCaminho,
  SeloFonte,
  type EtiquetaDecisaoProps,
  type SeloCaminhoProps,
  type SeloFonteProps,
} from "./Selos";
export {
  CAMINHOS,
  LIMITE_ETIQUETA,
  cortarEmPalavra,
  destaquesAprovados,
  etiquetaDe,
  etiquetaDoDado,
  FORMAS,
  NAO_DISPONIVEL,
  dadoEmTexto,
  formatarData,
  formatarNumero,
  placarEmTexto,
  placarOficial,
  resolverTitulo,
  rotuloCaminho,
  tituloAprovado,
  tituloSimplesDe,
  type TituloResolvido,
} from "./rotulos";
export type {
  ArquivoDestaques,
  ArquivoTitulos,
  Destaque,
  Caminho,
  DadoChave,
  FonteResumo,
  FormaDecisao,
  ItemPlacar,
  OrigemTitulo,
  TituloSimples,
} from "./tipos";
