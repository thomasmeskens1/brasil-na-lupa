/**
 * Cartão de Decisão — o mesmo cartão em todas as listas (diretriz 6; auditoria mobile, seção 4.3).
 *
 *   ┌ [CONFAZ] · 03/10/2026 · Impostos e preços ┐  selo do caminho + data + tema
 *   │ [ICMS: de R$ 1,57 para R$ 1,64 por litro] │  etiqueta (só campos estruturados)
 *   │ Novo valor do ICMS da gasolina a partir … │  h3 = título oficial (ou "estruturado"
 *   │ ler tudo                                  │       aprovado), cortado em fim de palavra
 *   │ Convênio ICMS 127/2026                    │  subtítulo = nome oficial por extenso
 *   │ [Antes R$ 1,57 → Depois R$ 1,64 por litro]│  dado-chave
 *   │ Quem decidiu: CONFAZ (…) · decisão de …   │
 *   │ [Oficial] CONFAZ ↗ · coletado em 02/11    │  selo de fonte + [Compartilhar]
 *   └───────────────────────────────────────────┘
 *
 * O cartão inteiro é clicável (o link fica no título e se estende pelo cartão); a fonte e o
 * botão Compartilhar continuam tocáveis à parte. Para leitor de tela é um único link: o título.
 *
 * Uso (componente de servidor ou cliente):
 *   import { CartaoDecisao, placarOficial, tituloSimplesDe } from "@/components/decisao";
 *   <ul className="space-y-3">
 *     <CartaoDecisao
 *       as="li"
 *       href={`/congresso/votacoes/camara/${v.id}`}
 *       tituloOficial={`Votação: ${v.proposicao}`}              // fallback
 *       simples={tituloSimplesDe(titulosCamara, v.id)}          // dados/titulos/camara.json
 *       subtituloOficial="Projeto de Lei Complementar 108/2024"
 *       caminho="camara" data={v.data} forma="votacao-nominal"
 *       dado={{ tipo: "placar", itens: placarOficial(v.placar), resultado: v.resultado }}
 *       quemDecidiu="Deputados federais"
 *       fonte={{ url: v.fonte.url, orgao: "Câmara dos Deputados", acessado_em: v.fonte.acessado_em }}
 *     />
 *   </ul>
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { BotaoCompartilhar } from "../compartilhar/BotaoCompartilhar";
import { montarTextoCompartilhar } from "../compartilhar/texto";
import { BlocoDadoChave } from "./DadoChave";
import { EtiquetaDecisao, SeloCaminho, SeloFonte } from "./Selos";
import { FORMAS, cortarEmPalavra, etiquetaDoDado, resolverTitulo, rotuloCaminho } from "./rotulos";
import type { Caminho, DadoChave, FonteResumo, FormaDecisao, TituloSimples } from "./tipos";

export interface CartaoDecisaoProps {
  /** Página de detalhe. */
  href: string;
  /** Título oficial: usado quando não há título simples aprovado. */
  tituloOficial: string;
  /** Item de dados/titulos/<secao>.json (pode faltar). */
  simples?: TituloSimples | null;
  /** Nome oficial por extenso (ex.: "Projeto de Lei Complementar 108/2024"). */
  subtituloOficial?: string | null;
  caminho: Caminho;
  /** Substitui o nome curto do selo. */
  rotuloCaminho?: string;
  /** Data da decisão, AAAA-MM-DD. */
  data?: string | null;
  rotuloData?: string;
  /** Forma da decisão (diretriz 5); aparece em "Quem decidiu". */
  forma?: FormaDecisao | null;
  dado?: DadoChave | null;
  /** Padrão: nome por extenso do caminho. */
  quemDecidiu?: ReactNode;
  fonte?: FonteResumo | null;
  /** Tema do dia a dia; padrão: o do título simples. */
  tema?: string | null;
  /** Mostra o botão Compartilhar (padrão: sim). */
  compartilhar?: boolean;
  /** Nível do título (padrão 3). */
  nivelTitulo?: 2 | 3 | 4;
  as?: "article" | "li" | "div";
  /** Conteúdo extra abaixo do dado-chave (ex.: "Voto deste deputado: Sim", dentro do contexto). */
  children?: ReactNode;
  className?: string;
  /**
   * Etiqueta à frente do título, montada só de campos estruturados. Sem a prop: a do arquivo de
   * títulos (simples.etiqueta) ou, na falta, a derivada do dado-chave (placar/simbólica/antes → depois).
   * null: sem etiqueta.
   */
  etiqueta?: string | null;
  /** Caracteres do título antes do corte em fim de palavra com "ler tudo" (padrão 160; 0 = sem corte). */
  limiteTitulo?: number;
}

export function CartaoDecisao({
  href,
  tituloOficial,
  simples,
  subtituloOficial,
  caminho,
  rotuloCaminho: rotulo,
  data,
  rotuloData,
  forma,
  dado,
  quemDecidiu,
  fonte,
  tema,
  compartilhar = true,
  nivelTitulo = 3,
  as: Tag = "article",
  children,
  className = "",
  etiqueta,
  limiteTitulo = 160,
}: CartaoDecisaoProps) {
  const t = resolverTitulo({ tituloOficial, simples, subtituloOficial, tema });
  const H = `h${nivelTitulo}` as "h2" | "h3" | "h4";
  const quem = quemDecidiu ?? rotuloCaminho(caminho, true);
  const rotuloEtiqueta = etiqueta === undefined ? (t.etiqueta ?? etiquetaDoDado(dado)) : etiqueta;
  const titulo = cortarEmPalavra(t.titulo, limiteTitulo);
  const sub = t.subtitulo ? cortarEmPalavra(t.subtitulo, limiteTitulo) : null;
  return (
    <Tag className={`cartao-decisao ${className}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <SeloCaminho caminho={caminho} rotulo={rotulo} data={data} rotuloData={rotuloData} />
        {t.tema ? <span className="text-sm text-[var(--cor-secundaria)]">· {t.tema}</span> : null}
      </div>
      {rotuloEtiqueta ? (
        <p className="mt-2">
          <EtiquetaDecisao texto={rotuloEtiqueta} />
        </p>
      ) : null}
      <H className="mt-2 text-lg font-semibold leading-snug text-foreground">
        <Link href={href} className="cartao-decisao__link">
          {titulo.curto}
          {titulo.cortado ? "…" : null}
        </Link>
      </H>
      {titulo.cortado ? (
        <details className="cartao-decisao__acima mt-1 text-sm">
          <summary className="lk inline-flex min-h-11 cursor-pointer items-center">ler tudo</summary>
          <p className="mt-1 leading-relaxed text-foreground">{t.titulo}</p>
        </details>
      ) : null}
      {sub ? (
        <p className="mt-1 text-[var(--cor-secundaria)]" title={sub.cortado ? t.subtitulo ?? undefined : undefined}>
          {sub.curto}
          {sub.cortado ? "…" : null}
        </p>
      ) : null}
      {dado ? <BlocoDadoChave dado={dado} className="mt-3" /> : null}
      {children ? <div className="mt-3">{children}</div> : null}
      <p className="mt-3 text-sm">
        <span className="font-semibold">Quem decidiu:</span> {quem}
        {forma ? <span className="text-[var(--cor-secundaria)]"> · {FORMAS[forma]}</span> : null}
      </p>
      {fonte || compartilhar ? (
        <div className="cartao-decisao__acima mt-2 flex flex-wrap items-center justify-between gap-2">
          {fonte ? <SeloFonte fonte={fonte} compacto /> : <span />}
          {compartilhar ? (
            <BotaoCompartilhar
              titulo={t.titulo}
              url={href}
              texto={montarTextoCompartilhar({
                titulo: t.titulo,
                linhaOficial: t.subtitulo,
                forma,
                data,
                dado,
                fonte,
              })}
            />
          ) : null}
        </div>
      ) : null}
    </Tag>
  );
}
