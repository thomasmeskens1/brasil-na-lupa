/**
 * Imagem Open Graph (prévia do link no WhatsApp e redes) no estilo neutro do Cartão de Decisão:
 * marca "Brasil na Lupa", caminho + forma + data, título, nome oficial, dado-chave (placar
 * completo, antes → depois ou o caminho da decisão), fonte e data de coleta DENTRO da imagem
 * (engajamento, seções 5.1, 5.2 e 5.6). Sem foto, sem cor de partido, mesma cor para Sim e Não.
 *
 * Uso numa rota (ex.: app/congresso/votacoes/[casa]/[id]/opengraph-image.tsx):
 *
 *   import { imagemDecisaoOG, TAMANHO_OG, TIPO_OG } from "@/components/compartilhar/og";
 *   export const size = TAMANHO_OG;
 *   export const contentType = TIPO_OG;
 *   export const alt = "Resumo da votação com placar oficial e fonte";
 *   export default async function Image({ params }: { params: Promise<{ casa: string; id: string }> }) {
 *     const { casa, id } = await params;
 *     const v = await lerVotacao(casa, id);
 *     const t = resolverTitulo({ tituloOficial: …, simples: tituloSimplesDe(titulos, id) });
 *     return imagemDecisaoOG({
 *       titulo: t.titulo, subtitulo: t.subtitulo, caminho: "camara", forma: "votacao-nominal",
 *       data: v.data, dado: { tipo: "placar", itens: placarOficial(v.placar), resultado: v.resultado },
 *       fonte: { orgao: "Câmara dos Deputados", acessado_em: v.fonte.acessado_em },
 *       endereco: `brasilnalupa…/congresso/votacoes/${casa}/${id}`,   // opcional, impresso no rodapé
 *     });
 *   }
 *   // Se a rota tiver generateStaticParams, exporte o mesmo generateStaticParams aqui
 *   // para gerar as imagens no build (custo zero por acesso).
 *
 * Importe este arquivo só em rotas de imagem (não pelo índice @/components/compartilhar),
 * para não levar next/og às páginas.
 */
import { ImageResponse } from "next/og";
import type { Caminho, DadoChave, FonteResumo, FormaDecisao } from "../decisao/tipos";
import { NAO_DISPONIVEL, formatarData, formatarNumero, rotuloCaminho } from "../decisao/rotulos";
import { MARCA } from "./texto";

export const TAMANHO_OG = { width: 1200, height: 630 };
export const TIPO_OG = "image/png";

const COR = {
  fundo: "#121214",
  faixa: "#ccff00",
  texto: "#ffffff",
  apoio: "#a0a0a5",
  borda: "#2e2e33",
  superficie: "#1a1a1d",
  placar: ["#f0f0f2", "#b4b4ba", "#7a7a82", "#4a4a50", "#2a2a2e"],
};

const FORMA: Record<FormaDecisao, string> = {
  "votacao-nominal": "votação nominal",
  "votacao-simbolica": "votação simbólica",
  "votacao-secreta": "votação secreta",
  colegiado: "decisão de colegiado",
  "ato-individual": "ato individual",
  julgamento: "julgamento",
};

export interface DadosImagemOG {
  titulo: string;
  subtitulo?: string | null;
  caminho: Caminho;
  rotuloCaminho?: string;
  forma?: FormaDecisao | null;
  data?: string | null;
  dado?: DadoChave | null;
  fonte: Pick<FonteResumo, "orgao" | "titulo" | "acessado_em">;
  /** Endereço impresso no rodapé (prints e Status não têm link clicável). */
  endereco?: string | null;
  /** "corrigido em DD/MM/AAAA" quando houver correção (diretriz 13). AAAA-MM-DD. */
  corrigidoEm?: string | null;
}

function cortar(t: string, max: number): string {
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function Bloco({ dado }: { dado: DadoChave }) {
  const caixa = {
    display: "flex",
    flexDirection: "column" as const,
    marginTop: 22,
    padding: "14px 24px",
    border: `2px solid ${COR.borda}`,
    borderRadius: 12,
    background: COR.superficie,
  };
  if (dado.tipo === "placar" || dado.tipo === "contagem") {
    const total = dado.itens.reduce((s, i) => s + Math.max(0, i.valor), 0);
    return (
      <div style={caixa}>
        <div style={{ display: "flex", fontSize: 24, color: COR.apoio, fontWeight: 600 }}>
          {dado.tipo === "placar"
            ? `PLACAR OFICIAL${dado.resultado ? ` · resultado: ${dado.resultado}` : ""}`
            : (dado.legenda ?? "Contagem oficial")}
        </div>
        {total > 0 ? (
          <div style={{ display: "flex", height: 16, marginTop: 10, borderRadius: 6, overflow: "hidden", background: COR.placar[4] }}>
            {dado.itens
              .map((i, n) => ({ ...i, n }))
              .filter((i) => i.valor > 0)
              .map((i) => (
                <div
                  key={i.rotulo}
                  style={{
                    display: "flex",
                    width: `${(i.valor / total) * 100}%`,
                    height: 16,
                    background: COR.placar[Math.min(i.n, 4)],
                    borderRight: "3px solid #fff",
                  }}
                />
              ))}
          </div>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", marginTop: 6 }}>
          {dado.itens.map((i) => (
            <div key={i.rotulo} style={{ display: "flex", alignItems: "baseline", marginRight: 36 }}>
              <span style={{ fontSize: 26, color: COR.apoio, marginRight: 10 }}>{i.rotulo}</span>
              <span style={{ fontSize: 44, fontWeight: 700, color: COR.texto }}>{formatarNumero(i.valor)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (dado.tipo === "mudanca") {
    return (
      <div style={caixa}>
        {dado.item ? <div style={{ display: "flex", fontSize: 24, color: COR.apoio, fontWeight: 600 }}>{dado.item}</div> : null}
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", marginTop: 6 }}>
          <span style={{ fontSize: 26, color: COR.apoio, marginRight: 10 }}>ANTES</span>
          <span style={{ fontSize: 48, fontWeight: 600, color: COR.texto }}>{dado.antes ?? NAO_DISPONIVEL}</span>
          <span style={{ fontSize: 40, color: COR.apoio, margin: "0 20px" }}>→</span>
          <span style={{ fontSize: 26, color: COR.apoio, marginRight: 10 }}>DEPOIS</span>
          <span style={{ fontSize: 48, fontWeight: 700, color: COR.texto }}>{dado.depois ?? NAO_DISPONIVEL}</span>
          {dado.unidade ? <span style={{ fontSize: 26, color: COR.apoio, marginLeft: 12 }}>{dado.unidade}</span> : null}
        </div>
        {dado.vigencia ? (
          <div style={{ display: "flex", fontSize: 24, color: COR.apoio, marginTop: 6 }}>a partir de {formatarData(dado.vigencia)}</div>
        ) : null}
      </div>
    );
  }
  const texto =
    dado.tipo === "simbolica"
      ? `Votação simbólica — sem voto individual registrado${dado.resultado ? ` · resultado: ${dado.resultado}` : ""}`
      : dado.tipo === "sem-votacao"
        ? `Decisão sem votação: ${dado.caminho}`
        : `${dado.rotulo ? `${dado.rotulo}: ` : ""}${dado.texto}`;
  return (
    <div style={caixa}>
      <div style={{ display: "flex", fontSize: 30, color: COR.texto }}>{cortar(texto, 140)}</div>
    </div>
  );
}

/** Elemento JSX da imagem (útil para compor outro formato). */
export function CartaoOG(d: DadosImagemOG) {
  const linha = [
    rotuloCaminho(d.caminho, true).toUpperCase().replace(/\s*\(.*\)$/, ""),
    d.forma ? FORMA[d.forma] : null,
    d.data ? formatarData(d.data) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const fonte = d.fonte.orgao || d.fonte.titulo || "Fonte oficial";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: COR.fundo,
        color: COR.texto,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 56px",
          background: COR.faixa,
          color: "#121214",
          fontSize: 28,
        }}
      >
        <span style={{ fontWeight: 700 }}>{MARCA.toUpperCase()}</span>
        <span style={{ fontSize: 24 }}>decisões com fonte oficial</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexShrink: 1, overflow: "hidden", padding: "26px 56px 0" }}>
        <div style={{ display: "flex", fontSize: 26, color: COR.apoio, fontWeight: 600 }}>{d.rotuloCaminho ?? linha}</div>
        <div style={{ display: "block", marginTop: 10, fontSize: 46, fontWeight: 700, lineHeight: 1.15, lineClamp: 3 }}>
          {cortar(d.titulo, 110)}
        </div>
        {d.subtitulo ? (
          <div style={{ display: "flex", marginTop: 8, fontSize: 28, color: COR.apoio }}>{cortar(d.subtitulo, 80)}</div>
        ) : null}
        {d.dado ? <Bloco dado={d.dado} /> : null}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          padding: "12px 56px 14px",
          borderTop: `2px solid ${COR.borda}`,
          fontSize: 22,
          color: COR.apoio,
        }}
      >
        <span>
          {`Fonte: ${cortar(fonte, 60)}${d.fonte.acessado_em ? ` · coletado em ${formatarData(d.fonte.acessado_em)}` : ""}${
            d.corrigidoEm ? ` · corrigido em ${formatarData(d.corrigidoEm)}` : ""
          }`}
        </span>
        {d.endereco ? <span style={{ marginTop: 2 }}>{`Quem decidiu e fonte completa: ${cortar(d.endereco, 70)}`}</span> : null}
      </div>
    </div>
  );
}

/** ImageResponse 1200×630 pronta para opengraph-image.tsx / twitter-image.tsx. */
export function imagemDecisaoOG(d: DadosImagemOG): ImageResponse {
  return new ImageResponse(<CartaoOG {...d} />, { ...TAMANHO_OG });
}
