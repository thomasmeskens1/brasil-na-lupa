/**
 * Ponto de entrada dos dados da seção Impostos: lista dos impostos (ordem: consumo, renda,
 * patrimônio), rótulos dos filtros e linha do tempo oficial da transição 2023–2033.
 */
import { IMPOSTOS_CONSUMO } from "./dados-consumo";
import { IMPOSTOS_RENDA_PATRIMONIO } from "./dados-renda-patrimonio";
import type { Base, ChaveFonte, Esfera, Imposto } from "./tipos";

export const IMPOSTOS: Imposto[] = [...IMPOSTOS_CONSUMO, ...IMPOSTOS_RENDA_PATRIMONIO];

export function impostoPorSlug(slug: string): Imposto | null {
  return IMPOSTOS.find((i) => i.slug === slug) ?? null;
}

export const ROTULO_ESFERA: Record<Esfera, string> = {
  federal: "Federal (União)",
  estadual: "Estadual",
  municipal: "Municipal",
};

export const ROTULO_BASE: Record<Base, string> = {
  consumo: "Consumo",
  renda: "Renda",
  patrimonio: "Patrimônio",
};

/** "Federal (União)", "Estadual e Municipal"… */
export function esferasPorExtenso(e: Esfera[]): string {
  const r = e.map((x) => ROTULO_ESFERA[x]);
  return r.length > 1 ? `${r.slice(0, -1).join(", ")} e ${r[r.length - 1]}` : r[0];
}

export interface MarcoLinha {
  /** Ano ou data, exibido em destaque. */
  quando: string;
  titulo: string;
  itens: { texto: string; fonte: ChaveFonte }[];
}

/** Linha do tempo oficial (Emenda Constitucional nº 132/2023, ADCT arts. 125 a 129; Lei Complementar nº 214/2025). */
export const LINHA_DO_TEMPO: MarcoLinha[] = [
  {
    quando: "2023",
    titulo: "A Constituição muda",
    itens: [
      { texto: "20/12/2023: promulgada a Emenda Constitucional nº 132, que cria a CBS, o IBS e o Imposto Seletivo.", fonte: "ec132" },
    ],
  },
  {
    quando: "2025",
    titulo: "As regras são detalhadas em lei",
    itens: [
      {
        texto: "16/1/2025: sancionada, com vetos parciais, a Lei Complementar nº 214, que regulamenta a CBS, o IBS e o Imposto Seletivo.",
        fonte: "lc214",
      },
    ],
  },
  {
    quando: "2026",
    titulo: "Fase de teste",
    itens: [
      { texto: "13/1/2026: Lei Complementar nº 227 institui o Comitê Gestor do IBS.", fonte: "lc227" },
      { texto: "CBS de 0,9% e IBS estadual de 0,1%, compensados com o PIS e a Cofins.", fonte: "lc214" },
      { texto: "Quem cumpre as obrigações acessórias fica dispensado de recolher a CBS e o IBS.", fonte: "lc214" },
    ],
  },
  {
    quando: "2027",
    titulo: "Começam a CBS e o Imposto Seletivo",
    itens: [
      { texto: "A CBS e o Imposto Seletivo passam a ser cobrados.", fonte: "ec132" },
      { texto: "PIS e Cofins são extintos.", fonte: "ec132" },
      { texto: "IPI com alíquota zero, exceto para produtos incentivados da Zona Franca de Manaus.", fonte: "ec132" },
      { texto: "2027 e 2028: IBS de 0,05% estadual e 0,05% municipal; CBS reduzida em 0,1 ponto percentual.", fonte: "ec132" },
      { texto: "Devolução da CBS (cashback) calculada sobre o consumo a partir de janeiro de 2027.", fonte: "lc214" },
    ],
  },
  {
    quando: "2029",
    titulo: "ICMS e ISS começam a diminuir",
    itens: [
      { texto: "ICMS e ISS passam a 9/10 (nove décimos) das alíquotas fixadas na legislação.", fonte: "ec132" },
      { texto: "Devolução do IBS (cashback) calculada sobre o consumo a partir de janeiro de 2029.", fonte: "lc214" },
    ],
  },
  {
    quando: "2030",
    titulo: "Transição continua",
    itens: [{ texto: "ICMS e ISS a 8/10 (oito décimos) das alíquotas.", fonte: "ec132" }],
  },
  {
    quando: "2031",
    titulo: "Transição continua",
    itens: [{ texto: "ICMS e ISS a 7/10 (sete décimos) das alíquotas.", fonte: "ec132" }],
  },
  {
    quando: "2032",
    titulo: "Último ano da transição",
    itens: [{ texto: "ICMS e ISS a 6/10 (seis décimos) das alíquotas.", fonte: "ec132" }],
  },
  {
    quando: "2033",
    titulo: "Modelo final",
    itens: [
      { texto: "ICMS e ISS são extintos.", fonte: "ec132" },
      { texto: "Vigência integral do novo modelo, segundo a Receita Federal.", fonte: "receitaEntenda" },
    ],
  },
];
