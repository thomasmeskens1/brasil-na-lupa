/**
 * Cabeçalho de página de detalhe, "resposta primeiro" (auditoria mobile, item 2; engajamento,
 * seção 7 — três níveis de leitura):
 *
 *   Nível 1 (primeira dobra): selo do caminho + data · h1 com título simples (ou oficial) ·
 *     nome oficial por extenso · dado-chave grande (o que mudou / placar / caminho) ·
 *     "Quem decidiu" · fonte principal com data de coleta · Compartilhar.
 *   Nível 2 (um toque): `textoOficial` em details ("Texto oficial") e o que a página colocar em
 *     `children` (ex.: lista de mudanças, "Como votou seu deputado").
 *   Nível 3: `ficha` (ficha técnica recolhível) e `fontes` (todas, com data de coleta).
 *
 * Uso:
 *   import { CabecalhoDecisao, placarOficial } from "@/components/decisao";
 *   <CabecalhoDecisao
 *     tituloOficial={`Votação: ${v.proposicao} em ${formatarData(v.data)}`}
 *     simples={tituloSimplesDe(titulos, v.id)}
 *     subtituloOficial="Projeto de Lei Complementar 108/2024 · votação em Plenário"
 *     caminho="camara" data={v.data} forma="votacao-nominal"
 *     dado={{ tipo: "placar", itens: placarOficial(v.placar), resultado: v.resultado }}
 *     quemDecidiu="Deputados federais, em votação nominal"
 *     fontePrincipal={{ url: v.url, titulo: "Página da votação", orgao: "Câmara dos Deputados", acessado_em }}
 *     url={`/congresso/votacoes/camara/${v.id}`}
 *     atalhos={[{ href: "#votos", rotulo: "Como votou cada deputado" }]}
 *     textoOficial={{ rotulo: "Ementa", texto: v.ementa }}
 *     ficha={[{ rotulo: "Órgão", valor: "Plenário" }, { rotulo: "Horário", valor: null }]}
 *     fontes={v.fontes}
 *   />
 */
import type { ReactNode } from "react";
import { BotaoCompartilhar } from "../compartilhar/BotaoCompartilhar";
import { montarTextoCompartilhar } from "../compartilhar/texto";
import { BlocoDadoChave } from "./DadoChave";
import { FichaTecnica, type ItemFicha } from "./FichaTecnica";
import { EtiquetaDecisao, SeloCaminho, SeloFonte } from "./Selos";
import { FORMAS, cortarEmPalavra, etiquetaDoDado, resolverTitulo, rotuloCaminho } from "./rotulos";
import type { Caminho, DadoChave, FonteResumo, FormaDecisao, TituloSimples } from "./tipos";

export interface CabecalhoDecisaoProps {
  tituloOficial: string;
  simples?: TituloSimples | null;
  subtituloOficial?: string | null;
  caminho: Caminho;
  rotuloCaminho?: string;
  data?: string | null;
  rotuloData?: string;
  forma?: FormaDecisao | null;
  dado?: DadoChave | null;
  /** Padrão: nome por extenso do caminho. */
  quemDecidiu?: ReactNode;
  tema?: string | null;
  /** Fonte do documento principal (sempre visível no nível 1). */
  fontePrincipal?: FonteResumo | null;
  /** Endereço desta página (para o Compartilhar). Sem ele, o botão não aparece. */
  url?: string;
  /** Links de âncora para o resto da página (alvos ≥ 44 px). */
  atalhos?: { href: string; rotulo: string }[];
  /** Texto literal do órgão (ementa, tese) — nível 2, recolhido. */
  textoOficial?: { rotulo: string; texto: ReactNode } | null;
  /** Ficha técnica — nível 3, recolhida. */
  ficha?: ItemFicha[];
  /** Todas as fontes — nível 3. */
  fontes?: FonteResumo[];
  /** Nível 2 específico da seção (ex.: "O que mudou", lista de mudanças). */
  children?: ReactNode;
  className?: string;
  /**
   * Etiqueta à frente do título, montada só de campos estruturados. Sem a prop: a do arquivo de
   * títulos (simples.etiqueta) ou a derivada do dado-chave. null: sem etiqueta.
   */
  etiqueta?: string | null;
  /** Caracteres do h1 antes do corte em fim de palavra com "ler tudo" (padrão 240; 0 = sem corte). */
  limiteTitulo?: number;
}

export function CabecalhoDecisao({
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
  tema,
  fontePrincipal,
  url,
  atalhos,
  textoOficial,
  ficha,
  fontes,
  children,
  className = "",
  etiqueta,
  limiteTitulo = 240,
}: CabecalhoDecisaoProps) {
  const t = resolverTitulo({ tituloOficial, simples, subtituloOficial, tema });
  const quem = quemDecidiu ?? rotuloCaminho(caminho, true);
  const rotuloEtiqueta = etiqueta === undefined ? (t.etiqueta ?? etiquetaDoDado(dado)) : etiqueta;
  const titulo = cortarEmPalavra(t.titulo, limiteTitulo);
  return (
    <header className={`space-y-4 ${className}`}>
      {/* Nível 1 — manchete e resposta */}
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <SeloCaminho caminho={caminho} rotulo={rotulo} data={data} rotuloData={rotuloData} />
          {t.tema ? <span className="text-sm text-[var(--cor-secundaria)]">· {t.tema}</span> : null}
        </div>
        {rotuloEtiqueta ? (
          <p className="mt-3">
            <EtiquetaDecisao texto={rotuloEtiqueta} className="text-base" />
          </p>
        ) : null}
        <h1 className="mt-2 text-2xl font-bold leading-tight text-foreground sm:text-3xl">
          {titulo.cortado ? (
            <>
              {/* Leitor de tela e leitura em voz alta recebem o título inteiro. */}
              <span aria-hidden="true">{titulo.curto}…</span>
              <span className="sr-only" data-ler>
                {t.titulo}
              </span>
            </>
          ) : (
            titulo.curto
          )}
        </h1>
        {titulo.cortado ? (
          <details className="mt-1" data-nao-ler>
            <summary className="lk inline-flex min-h-11 cursor-pointer items-center">
              ler tudo<span className="sr-only"> (título completo)</span>
            </summary>
            <p className="mt-1 text-lg leading-relaxed text-foreground">{t.titulo}</p>
          </details>
        ) : null}
        {t.subtitulo ? <p className="mt-2 text-lg text-[var(--cor-secundaria)]">{t.subtitulo}</p> : null}
        {t.simples && t.origem ? (
          <p className="meta mt-1">
            Título em linguagem simples: {t.origem}
            {t.fonteTitulo ? (
              <>
                {" · "}
                <a href={t.fonteTitulo.url} className="lk" target="_blank" rel="noopener noreferrer">
                  ver origem<span className="sr-only"> (abre em nova aba)</span>
                </a>
              </>
            ) : null}
            . O texto oficial está abaixo.
          </p>
        ) : null}
      </div>
      {dado ? <BlocoDadoChave dado={dado} tamanho="destaque" /> : null}
      <p>
        <span className="font-semibold">Quem decidiu:</span> {quem}
        {forma ? <span className="text-[var(--cor-secundaria)]"> · {FORMAS[forma]}</span> : null}
      </p>
      {fontePrincipal || url ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {fontePrincipal ? <SeloFonte fonte={fontePrincipal} /> : <span />}
          {url ? (
            <BotaoCompartilhar
              titulo={t.titulo}
              url={url}
              texto={montarTextoCompartilhar({
                titulo: t.titulo,
                linhaOficial: t.subtitulo,
                forma,
                data,
                dado,
                fonte: fontePrincipal,
              })}
            />
          ) : null}
        </div>
      ) : null}
      {atalhos?.length ? (
        <nav aria-label="Nesta página">
          <ul className="flex flex-wrap gap-2">
            {atalhos.map((a) => (
              <li key={a.href}>
                <a href={a.href} className="botao text-sm">
                  {a.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {/* Nível 2 — detalhe a um toque */}
      {textoOficial ? (
        <details className="rounded-md border border-borda bg-superficie">
          <summary className="pr-3">Texto oficial ({textoOficial.rotulo})</summary>
          <blockquote className="border-t border-borda px-3 pb-3 pt-2 leading-relaxed text-foreground">
            {textoOficial.texto}
          </blockquote>
        </details>
      ) : null}
      {children}

      {/* Nível 3 — ficha técnica e fontes */}
      {ficha?.length ? <FichaTecnica itens={ficha} /> : null}
      {fontes?.length ? (
        <details className="rounded-md border border-borda bg-superficie">
          <summary className="pr-3">
            Fontes oficiais <span className="font-normal text-[var(--cor-secundaria)]">({fontes.length})</span>
          </summary>
          <ul className="space-y-1 border-t border-borda px-3 pb-3 pt-2">
            {fontes.map((f, i) => (
              <li key={`${f.url}-${i}`}>
                <SeloFonte fonte={f} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </header>
  );
}
