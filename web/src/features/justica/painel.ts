/**
 * Números oficiais, julgamentos acompanhados e explicações da lista única da Justiça (somente
 * servidor / build). Os números são contagens dos campos da fonte (situação, tipo, tese registrada).
 */
import type { GrupoNumeros, ItemFiltro, NumeroOficial } from "@/features/executivo/componentes/ListaFiltros";
import type { TipoExplicado } from "@/features/executivo/componentes/TiposExplicados";
import { cartaoJulgamentoStf } from "./cartoes";
import { CLASSE_STF } from "./apresentacao";
import { COM_TESE, TRIBUNAL_STF, TRIBUNAL_STJ, nomeRelator } from "./lista";
import { COLECOES, TERMOS_JUSTICA, rotuloOrgao } from "./rotulos";
import type { IndiceStf, IndiceStj } from "./tipos";

function fontesDe(f: { titulo?: string | null; url: string; orgao?: string | null; acessado_em?: string | null } | null, coleta: string | null) {
  return f?.url ? [{ titulo: f.titulo ?? f.url, url: f.url, orgao: f.orgao ?? null, acessado_em: f.acessado_em ?? coleta }] : [];
}

function porSituacao(m: Record<string, number> | undefined, filtroBase: Record<string, string>, chave: string, lista: [string, string][]): NumeroOficial[] {
  return lista
    .filter(([k]) => m?.[k])
    .map(([k, rotulo]) => ({ valor: m![k], rotulo, explicacao: `“${k}” na fonte`, filtro: { ...filtroBase, [chave]: k } }));
}

export function numerosStj(ind: IndiceStj): GrupoNumeros | null {
  if (!ind.total) return null;
  const c = ind.contagens;
  const base = { tribunal: TRIBUNAL_STJ };
  return {
    id: "numeros-stj",
    titulo: TRIBUNAL_STJ,
    descricao: "Temas repetitivos e de relevância publicados nos dados abertos do tribunal, pela situação registrada em cada um.",
    fontes: fontesDe(ind.fonte, ind.atualizado_em),
    itens: [
      { valor: ind.total, rotulo: "Temas no total", filtro: base },
      ...(c?.com_tese ? [{ valor: c.com_tese, rotulo: "Com tese firmada", explicacao: "texto da tese registrado na fonte", filtro: { ...base, tese: COM_TESE } }] : []),
      ...porSituacao(c?.por_situacao, base, "situacao", [
        ["Afetado", "Afetados ao rito dos repetitivos"],
        ["Em Julgamento", "Em julgamento"],
        ["Trânsito em Julgado", "Com trânsito em julgado"],
        ["Cancelado", "Cancelados"],
      ]),
    ],
  };
}

export function numerosStf(ind: IndiceStf): GrupoNumeros | null {
  if (!ind.total) return null;
  const c = ind.contagens;
  const base = { tribunal: TRIBUNAL_STF };
  return {
    id: "numeros-stf",
    titulo: TRIBUNAL_STF,
    descricao: "Temas de repercussão geral da lista oficial do tribunal, pela situação registrada em cada um.",
    fontes: fontesDe(ind.fonte, ind.atualizado_em),
    itens: [
      { valor: ind.total, rotulo: "Temas no total", filtro: base },
      ...(c?.com_tese ? [{ valor: c.com_tese, rotulo: "Com tese firmada", explicacao: "texto da tese registrado na fonte", filtro: { ...base, tese: COM_TESE } }] : []),
      ...porSituacao(c?.por_situacao, base, "repercussao", [
        ["Há repercussão geral", "Com repercussão geral"],
        ["Há repercussão geral com reafirmação de Jurisprudência", "Com repercussão geral e reafirmação de jurisprudência"],
        ["Não há repercussão geral", "Sem repercussão geral"],
        ["Não há repercussão geral (questão infraconstitucional)", "Sem repercussão geral (questão infraconstitucional)"],
      ]),
      ...porSituacao(c?.por_andamento, base, "situacao", [["Em julgamento", "Em julgamento"]]),
    ],
  };
}

/** Julgamentos acompanhados do STF (ações como ADI e recursos), com o resultado literal da certidão. */
export function itensJulgamentosStf(ind: IndiceStf): ItemFiltro[] {
  return ind.julgamentos.map((j) => {
    const classe = (j.identificacao ?? "").split(" ")[0];
    const rel = nomeRelator(j.relator);
    const trecho = j.resultado_trecho ?? "";
    const resultado = [/por\s+unanimidade/i.test(trecho) ? "Por unanimidade" : null, /por\s+maioria/i.test(trecho) ? "Por maioria" : null].filter(
      (x): x is string => !!x,
    );
    return {
      id: `stf-j-${j.id}`,
      cartao: { ...cartaoJulgamentoStf(j), tema: j.tema_dia_a_dia ?? null, etiqueta: j.etiqueta ?? undefined },
      busca: `${j.identificacao ?? ""} ${j.tema ?? ""} ${j.relator ?? ""} ${j.resultado_trecho ?? ""} ${j.ementa_inicio ?? ""}`,
      facetas: {
        tribunal: TRIBUNAL_STF,
        tipo: CLASSE_STF[classe] ?? (classe || "Julgamento"),
        orgao: j.orgao ? rotuloOrgao(j.orgao) : null,
        relator: rel ? [rel] : [],
        ano: j.data_julgamento ? j.data_julgamento.slice(0, 4) : null,
        tema: j.tema_dia_a_dia ?? null,
        resultado,
        colecao: (j.colecoes ?? []).map((k) => COLECOES[k]?.titulo ?? k),
      },
    };
  });
}

const T = TERMOS_JUSTICA;

export const TIPOS_STJ: TipoExplicado[] = [
  {
    termo: "Tema repetitivo (STJ)",
    frase: "Questão de lei federal repetida em muitos processos, que o STJ julga uma vez para fixar uma tese seguida pelos demais tribunais.",
    mais: [T.repetitivo.explicacao, T.afetacao.explicacao, T.paradigma.explicacao],
  },
  {
    termo: "Tema de relevância (STJ)",
    frase: "Questão de lei federal que o STJ reconheceu como relevante, requisito do recurso especial desde 2022.",
    mais: [T.relevancia.explicacao],
  },
];

export const TIPOS_STF: TipoExplicado[] = [
  {
    termo: "Repercussão geral (STF)",
    frase: "Questão constitucional que ultrapassa o caso concreto; o STF julga uma vez e a tese vale para casos iguais.",
    mais: [T.repercussao.explicacao],
  },
  {
    termo: "Ações de controle de constitucionalidade (STF)",
    frase: "Ações, como a ADI, em que o STF decide diretamente se uma lei está de acordo com a Constituição.",
    mais: [T.controleConcentrado.explicacao, T.plenarioVirtual.explicacao, T.certidao.explicacao],
  },
];

export const TIPOS_COMUNS: TipoExplicado[] = [
  { termo: "Tese", frase: T.tese.explicacao },
  {
    termo: "Ministro relator",
    frase: "Ministro que conduz o processo e apresenta o primeiro voto.",
    mais: [T.relator.explicacao],
  },
  {
    termo: "Por unanimidade e por maioria",
    frase: "Expressões copiadas do texto oficial do julgamento; o site não as deduz da contagem de votos.",
    mais: [
      "“Por unanimidade” indica que todos os ministros que votaram acompanharam a mesma decisão; “por maioria”, que houve ao menos um voto vencido.",
      T.vencido.explicacao,
      "Quando o texto oficial do julgamento não foi coletado ou não traz essas expressões, o item não aparece nesse filtro.",
    ],
  },
  { termo: "Órgão julgador", frase: "Grupo de ministros que julgou a questão, como uma Seção ou a Corte Especial no STJ e o Plenário no STF.", mais: [T.secao.explicacao] },
];
