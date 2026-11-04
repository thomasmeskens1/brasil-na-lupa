/**
 * Texto oficial com as siglas acessíveis (diretrizes 9 e 15; WCAG 3.1.4). O texto não muda:
 * cada sigla conhecida (siglas.ts) é envolvida em <abbr title="nome por extenso">. Na primeira
 * ocorrência da página, o leitor de tela ouve também o nome por extenso; se o glossário tiver a
 * explicação da sigla, ela vira <Termo> (botão com balão).
 *
 *   import { TextoComSiglas } from "@/components/glossario";
 *   <p><TextoComSiglas>{a.ementa}</TextoComSiglas></p>
 *   <Link href={…}><TextoComSiglas explicar={false}>{v.titulo}</TextoComSiglas></Link>  // dentro de link/botão: sem balão
 *
 * "Primeira ocorrência da página": em componentes de servidor, o conjunto de siglas já
 * explicadas é um por requisição (React `cache`). Em componentes de cliente, `cache` não guarda
 * nada e cada <TextoComSiglas> explica a primeira ocorrência dentro do próprio texto. Para dividir
 * o mesmo conjunto entre vários textos, passe `vistas` (um Set criado fora do render).
 */
import { cache, Fragment } from "react";
import { BalaoTermo } from "./BalaoTermo";
import { definicaoDe, type EntradaGlossario } from "./glossarios";
import { segmentarSiglas } from "./marcarSiglas";

const siglasDaPagina = cache(() => new Set<string>());

export interface TextoComSiglasProps {
  /** Texto oficial, exatamente como na fonte. */
  children?: string | null;
  /** Mesmo que children (para quem prefere prop). */
  texto?: string | null;
  /** false dentro de link ou botão: só <abbr>, sem o botão do glossário. Padrão: true. */
  explicar?: boolean;
  /** Conjunto de siglas já explicadas (padrão: o da página). */
  vistas?: Set<string>;
  /** Glossário extra, consultado antes do geral (como em <Termo>). */
  glossario?: readonly EntradaGlossario[];
}

export function TextoComSiglas({ children, texto, explicar = true, vistas, glossario }: TextoComSiglasProps) {
  const t = texto ?? children ?? "";
  if (!t) return null;
  const segmentos = segmentarSiglas(t, vistas ?? siglasDaPagina());
  return (
    <>
      {segmentos.map((s, i) => {
        if (typeof s === "string") return <Fragment key={i}>{s}</Fragment>;
        // Já explicada no próprio texto ("Supremo Tribunal Federal (STF)"): fica como está.
        if (s.explicadaNoTexto) return <Fragment key={i}>{s.texto}</Fragment>;
        const nome = s.sigla.nome;
        if (!s.primeira) {
          return (
            <abbr key={i} title={nome} className="no-underline">
              {s.texto}
            </abbr>
          );
        }
        const e = explicar ? definicaoDe(s.sigla.sigla, glossario) : null;
        if (e) return <BalaoTermo key={i} texto={s.texto} titulo={e.termo} definicao={e.explicacao} extenso={nome} />;
        return (
          <Fragment key={i}>
            <abbr title={nome} className="no-underline">
              {s.texto}
            </abbr>
            <span className="sr-only"> ({nome})</span>
          </Fragment>
        );
      })}
    </>
  );
}
