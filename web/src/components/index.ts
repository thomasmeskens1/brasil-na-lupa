/**
 * Componentes de interface reutilizáveis (sem acesso a dados; seguros para
 * componentes cliente).
 */
export { Card, type CardProps } from "./Card";
export { EmConstrucao, type EmConstrucaoProps } from "./EmConstrucao";
export { FonteLink, type FonteLinkProps, type TipoFonte } from "./FonteLink";
export { Secao, type SecaoProps } from "./Secao";

/*
 * Redesenho mobile (Onda 1) — importe pelos subcaminhos:
 *   @/components/decisao      CartaoDecisao, CabecalhoDecisao, BlocoDadoChave, BarraPlacar, FichaTecnica,
 *                             ItemRecolhivel, SeloCaminho, SeloFonte, placarOficial, resolverTitulo…
 *   @/components/tabela       TabelaResponsiva, TabelaFiltravel, FiltrosCompactos
 *   @/components/lista        ListaRecolhivel
 *   @/components/glossario    Termo (balão de glossário)
 *   @/components/compartilhar BotaoCompartilhar, montarTextoCompartilhar, metadadosCompartilhamento
 *   @/components/compartilhar/og  imagemDecisaoOG (só em opengraph-image.tsx)
 */
