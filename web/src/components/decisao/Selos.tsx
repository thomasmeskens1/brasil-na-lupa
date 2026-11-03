/**
 * Selos do Cartão de Decisão.
 *
 * SeloCaminho — órgão pelo qual a decisão foi tomada + data:
 *   <SeloCaminho caminho="confaz" data="2026-10-03" />            // "CONFAZ · 03/10/2026"
 *   <SeloCaminho caminho="camara" data={v.data} rotuloData="votado em" />
 *
 * SeloFonte — fonte oficial compacta, alvo de toque ≥ 44 px, com data de coleta (diretrizes 2 e 13):
 *   <SeloFonte fonte={{ url, titulo: "Convênio ICMS 127/2026", orgao: "CONFAZ", acessado_em: "2026-11-02" }} />
 *   <SeloFonte fonte={f} compacto />   // uma linha: "Oficial · CONFAZ ↗ · coletado em 02/11/2026"
 */
import type { Caminho, FonteResumo } from "./tipos";
import { formatarData, rotuloCaminho } from "./rotulos";

export interface SeloCaminhoProps {
  caminho: Caminho;
  /** Substitui o nome curto padrão (ex.: "Plenário do Senado"). */
  rotulo?: string;
  /** Data da decisão, AAAA-MM-DD. Sem data, mostra só o caminho. */
  data?: string | null;
  /** Texto antes da data para leitor de tela e tela (padrão: nenhum). Ex.: "votado em". */
  rotuloData?: string;
  className?: string;
}

export function SeloCaminho({ caminho, rotulo, data, rotuloData, className = "" }: SeloCaminhoProps) {
  const curto = rotulo ?? rotuloCaminho(caminho);
  const extenso = rotuloCaminho(caminho, true);
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--cor-secundaria)] ${className}`}>
      <span className="selo selo-escuro">
        {curto}
        {extenso !== curto ? <span className="sr-only"> ({extenso})</span> : null}
      </span>
      {data ? (
        <span>
          {rotuloData ? `${rotuloData} ` : ""}
          <time dateTime={data.slice(0, 10)}>{formatarData(data)}</time>
        </span>
      ) : null}
    </p>
  );
}

export interface EtiquetaDecisaoProps {
  /** Texto montado só de campos estruturados (ex.: "Aprovado 312 × 140", "Veto mantido"). */
  texto: string;
  className?: string;
}

/**
 * Etiqueta à frente do título — marca-texto (.destaque-neon) com o MESMO tratamento para qualquer
 * desfecho: "Aprovado" e "Rejeitado", "Veto mantido" e "Veto derrubado" usam a mesma cor (diretriz 11).
 *   <EtiquetaDecisao texto="Aprovado 312 × 140" />
 */
export function EtiquetaDecisao({ texto, className = "" }: EtiquetaDecisaoProps) {
  return <span className={`destaque-neon text-sm leading-snug ${className}`}>{texto}</span>;
}

const PREFIXO: Record<NonNullable<FonteResumo["tipo"]>, string> = {
  oficial: "Oficial",
  pdf: "PDF oficial",
  reportagem: "Reportagem",
};

export interface SeloFonteProps {
  fonte: FonteResumo;
  /** Uma linha só (rodapé do cartão). Padrão: título do documento + linha de coleta. */
  compacto?: boolean;
  className?: string;
}

export function SeloFonte({ fonte, compacto = false, className = "" }: SeloFonteProps) {
  const tipo = fonte.tipo ?? "oficial";
  const nome = compacto ? fonte.orgao || fonte.titulo || "Fonte oficial" : fonte.titulo || fonte.orgao || "Fonte oficial";
  const externo = /^https?:\/\//.test(fonte.url);
  const coleta = fonte.acessado_em ? `coletado em ${formatarData(fonte.acessado_em)}` : null;
  const link = (
    <a
      href={fonte.url}
      className="lk inline-flex min-h-11 items-center gap-1.5 py-1 text-sm"
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      title={compacto && fonte.titulo ? fonte.titulo : undefined}
    >
      <span className="tag-fonte">{PREFIXO[tipo]}</span>
      <span>{nome}</span>
      {externo ? (
        <>
          <span aria-hidden="true">↗</span>
          <span className="sr-only"> (abre em nova aba)</span>
        </>
      ) : null}
    </a>
  );
  if (compacto) {
    return (
      <p className={`flex flex-wrap items-center gap-x-2 text-sm text-[var(--cor-secundaria)] ${className}`}>
        {link}
        {coleta ? <span>· {coleta}</span> : null}
      </p>
    );
  }
  return (
    <div className={className}>
      {link}
      {coleta || (fonte.orgao && fonte.titulo) ? (
        <p className="meta">
          {fonte.orgao && fonte.titulo ? `${fonte.orgao}${coleta ? " · " : ""}` : ""}
          {coleta}
        </p>
      ) : null}
    </div>
  );
}
