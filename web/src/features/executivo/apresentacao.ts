/**
 * Apresentação dos atos do Executivo no Cartão de Decisão (funções puras, seguras no navegador).
 * Nada é deduzido: títulos de reserva são trechos literais encurtados da ementa ou o assunto
 * registrado pelo Congresso Nacional; contagens vêm da situação oficial de cada dispositivo.
 */
import { tituloAprovado, type DadoChave, type ItemPlacar, type TituloSimples } from "@/components/decisao";
import type { DadosCartao, ItemCartao } from "./componentes/ListaCartoes";
import { explicarSigla, rotuloSituacaoFonte, rotuloSituacaoMpv, rotuloTipoVeto } from "./rotulos";

/** Trecho literal do começo do texto, cortado em fim de palavra, com reticências. */
export function encurtar(texto: string | null | undefined, max = 120): string | null {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const corte = t.slice(0, max + 1).replace(/\s+\S*$/, "");
  return `${(corte || t.slice(0, max)).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/**
 * Título simples só quando reformula o texto: o de origem "oficial" é o próprio texto oficial
 * (às vezes longo) e dá lugar ao trecho encurtado; o nome oficial continua como subtítulo.
 */
export function simplesUtil(s: TituloSimples | null | undefined): TituloSimples | null {
  if (!s || s.origem === "oficial") return null;
  return s;
}

/** Versão enxuta para listas (só o que o cartão exibe), já conferida pelas regras de aprovação. */
export function simplesLista(s: TituloSimples | null | undefined): TituloSimples | null {
  const u = simplesUtil(s);
  if (!u || !tituloAprovado(u)) return null;
  // Repassa origem, verificação e etiqueta: o cartão reaplica a regra (só "estruturado" verificado).
  return { ...u, subtitulo: u.subtitulo ?? null, tema: u.tema ?? null };
}

/** "Medida Provisória 1.300/2025". */
export function nomeMpv(m: { numero: number; ano: number }): string {
  return `Medida Provisória ${m.numero.toLocaleString("pt-BR")}/${m.ano}`;
}

/** "Veto parcial 29/2025 ao Projeto de Lei (PL) 2159/2021". */
export function nomeVeto(v: { numero: number; ano: number; tipo: string | null; materia_vetada?: string | null }): string {
  const tipo = v.tipo === "total" || v.tipo === "parcial" ? rotuloTipoVeto(v.tipo) : "Veto";
  const materia = explicarSigla(v.materia_vetada);
  return `${tipo} ${v.numero}/${v.ano}${materia ? ` ao ${materia}` : ""}`;
}

/** Título de reserva do veto: assunto registrado pelo Congresso ou a ementa encurtada. */
export function tituloReservaVeto(v: { assunto_congresso?: string | null; ementa: string | null; numero: number; ano: number }): string {
  return v.assunto_congresso?.trim() || encurtar(v.ementa) || `Veto ${v.numero}/${v.ano}`;
}

/** Título de reserva da medida provisória: a ementa encurtada. */
export function tituloReservaMpv(m: { ementa: string | null; numero: number; ano: number }): string {
  return encurtar(m.ementa) || nomeMpv(m);
}

const ORDEM_SITUACAO = ["Rejeitado", "Mantido", "Não Apreciado", "Prejudicado"];
const PRINCIPAIS = ["Rejeitado", "Mantido", "Não Apreciado"];

/**
 * Contagem oficial dos trechos vetados por situação (não são votos). Os zeros de "derrubados",
 * "mantidos" e "não apreciados" só aparecem quando as contagens da fonte somam o total.
 */
export function contagemVeto(sd: Record<string, number> | null | undefined, total?: number | null): DadoChave | null {
  const s = sd ?? {};
  const soma = Object.values(s).reduce((a, n) => a + (typeof n === "number" ? n : 0), 0);
  if (!soma) return null;
  const completa = typeof total === "number" && soma === total;
  const chaves = [
    ...ORDEM_SITUACAO.filter((k) => k in s || (completa && PRINCIPAIS.includes(k))),
    ...Object.keys(s).filter((k) => !ORDEM_SITUACAO.includes(k)),
  ];
  const itens: ItemPlacar[] = chaves.map((k) => ({ rotulo: rotuloSituacaoFonte(k), valor: s[k] ?? 0 }));
  return {
    tipo: "contagem",
    legenda: `${soma} ${soma === 1 ? "trecho vetado" : "trechos vetados"}: situação no Congresso Nacional`,
    itens,
  };
}

/** Situação da medida provisória como dado-chave (frase da fonte, padronizada). */
export function dadoMpv(m: { situacao: string | null; norma_gerada?: string | null }): DadoChave {
  return {
    tipo: "texto",
    rotulo: "Situação",
    texto: `${rotuloSituacaoMpv(m.situacao)}${m.norma_gerada ? ` · norma gerada: ${m.norma_gerada}` : ""}`,
  };
}

export const QUEM_MPV = "Presidente da República (medida provisória); depois, o Congresso Nacional";
export const QUEM_VETO = "Presidente da República (veto); depois, o Congresso Nacional em sessão conjunta";

/** Junta os campos comuns de uma lista aos do item (a fonte é mesclada campo a campo). */
export function montarCartao(padrao: Partial<DadosCartao> | undefined, c: ItemCartao["cartao"]): DadosCartao {
  const fonte = c.fonte === null ? null : c.fonte || padrao?.fonte ? { ...padrao?.fonte, ...c.fonte } : null;
  return { caminho: "presidencia", ...padrao, ...c, fonte: fonte?.url ? (fonte as DadosCartao["fonte"]) : null } as DadosCartao;
}
