/**
 * Lista de votações (funções puras, seguras no navegador e no servidor).
 *
 * O índice compacto public/congresso/busca.json é gerado por scripts/gerar-congresso.mjs; aqui
 * ele é decodificado e convertido para o Cartão de Decisão. Nada é deduzido: título simples só
 * quando aprovado (dados/titulos/<casa>.json); sem ele, o título oficial.
 */
import type { DadoChave, FormaDecisao, TituloSimples } from "@/components/decisao/tipos";
import { placarOficial } from "@/components/decisao/rotulos";
import type { Casa, PlacarCongresso, TipoVotacaoCongresso } from "./tipos";
import { CASA_NOME, SIGLA_PROPOSICAO, normalizar } from "./rotulos";

/** Formato de public/congresso/busca.json (ver o gerador). */
export interface IndiceBusca {
  gerado_em?: string;
  casas: Partial<Record<Casa, { atualizado_em: string | null }>>;
  temas: string[];
  /** [título da proposição, ementa, sigla] */
  p: [string, string, string][];
  /** [casa, id, data, tipo, resultado, proposição, descrição, placar, muda lei, título simples,
   *  subtítulo simples, tema, url da fonte, origem do título] */
  v: [number, string, string, number, number, number, string, (number | null)[] | null, number, string, string, number, string, string][];
}

export interface LinhaVotacao {
  casa: Casa;
  id: string;
  data: string;
  tipo: TipoVotacaoCongresso | null;
  resultado: "aprovada" | "rejeitada" | null;
  /** Ex.: "PLP 186/2026". */
  proposicao: string | null;
  propId: string | null;
  sigla: string | null;
  ementa: string;
  descricao: string;
  placar: PlacarCongresso | null;
  mudaLei: boolean;
  simples: TituloSimples | null;
  tema: string | null;
  fonteUrl: string;
  coletadoEm: string | null;
}

const CASAS_IDX: Casa[] = ["camara", "senado"];
const TIPOS_IDX: TipoVotacaoCongresso[] = ["nominal", "simbolica", "secreta"];
const CHAVES_PLACAR = ["sim", "nao", "abstencao", "obstrucao", "outros"] as const;

/** Texto do critério do filtro padrão (o mesmo do gerador). */
export const CRITERIO_MUDA_LEI =
  "Mostra as votações de propostas que podem criar ou mudar normas — propostas de emenda à Constituição, projetos de lei complementar, projetos de lei, medidas provisórias, projetos de decreto legislativo e de resolução — e esconde as etapas de procedimento, identificadas pelo começo da descrição oficial da votação: requerimentos (de urgência, de adiamento, de retirada de pauta, de encerramento da discussão e outros), alteração do regime de tramitação, redação final, preferência e recurso, além de decisões sobre questão de ordem. Votações de autoridades, mensagens, ofícios e outros tipos que não mudam normas também ficam de fora. Escolha “Tudo” para ver todas.";

export function decodificar(ind: IndiceBusca): LinhaVotacao[] {
  return ind.v.map(([c, id, data, t, r, pi, descricao, pl, l, ts, ss, tm, u, origem]) => {
    const prop = pi >= 0 ? ind.p[pi] : null;
    const casa = CASAS_IDX[c] ?? "camara";
    const tema = tm >= 0 ? (ind.temas[tm] ?? null) : null;
    let placar: PlacarCongresso | null = null;
    if (pl) {
      placar = {};
      CHAVES_PLACAR.forEach((k, n) => {
        if (typeof pl[n] === "number") placar![k] = pl[n];
      });
    }
    return {
      casa,
      id,
      data,
      tipo: TIPOS_IDX[t] ?? null,
      resultado: r === 1 ? "aprovada" : r === 0 ? "rejeitada" : null,
      proposicao: prop?.[0] || null,
      propId: pi >= 0 ? `${c}-${pi}` : null,
      sigla: prop?.[2] || prop?.[0]?.split(" ")[0] || null,
      ementa: prop?.[1] ?? "",
      descricao,
      placar,
      mudaLei: l === 1,
      simples: ts ? { titulo: ts, subtitulo: ss || null, tema, origem: origem || null } : null,
      tema,
      fonteUrl: u,
      coletadoEm: ind.casas[casa]?.atualizado_em ?? null,
    };
  });
}

/** "PLP 186/2026" → "Projeto de Lei Complementar 186/2026" (nome oficial por extenso). */
export function propPorExtenso(prop: string | null | undefined): string | null {
  if (!prop) return null;
  const m = /^([A-Z]+)\s+(.*)$/.exec(prop.trim());
  if (!m) return prop;
  const nome = SIGLA_PROPOSICAO[m[1]];
  return nome ? `${nome} ${m[2]}` : prop;
}

function cortar(t: string, max: number): string {
  const s = t.trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/**
 * Título oficial (quando não há título simples aprovado): a proposição e o começo literal da ementa,
 * para dizer do que trata o que foi votado (a mesma regra de scripts/coleta/titulos/modelos-votacoes.mjs).
 * Sem ementa, a descrição oficial da votação.
 */
export function tituloOficialVotacao(l: Pick<LinhaVotacao, "proposicao" | "descricao"> & { ementa?: string | null }): string {
  const p = propPorExtenso(l.proposicao);
  const e = l.ementa?.trim() ? ementaCurta(l.ementa) : "";
  if (p && e) return `${p}: ${e}`;
  const d = l.descricao ? cortar(l.descricao, 140) : "";
  if (p && d) return `${p}: ${d}`;
  return p ?? (d || "Votação sem proposição informada na fonte");
}

/** Começo literal da ementa (até 170 caracteres, cortado numa vírgula ou entre palavras). */
export function ementaCurta(ementa: string): string {
  const t = ementa.replace(/\s+/g, " ").trim();
  if (t.length <= 170) return t;
  const corte = t.slice(0, 170);
  const virgula = corte.lastIndexOf(", ");
  const fim = virgula >= 80 ? virgula : corte.lastIndexOf(" ");
  return `${corte.slice(0, fim > 0 ? fim : 170).replace(/[\s,;:–-]+$/, "")}…`;
}

export function formaDe(tipo: string | null | undefined): FormaDecisao | null {
  if (tipo === "nominal") return "votacao-nominal";
  if (tipo === "simbolica") return "votacao-simbolica";
  if (tipo === "secreta") return "votacao-secreta";
  return null;
}

export function resultadoTexto(r: string | null | undefined): string | null {
  return r === "aprovada" ? "aprovada" : r === "rejeitada" ? "rejeitada" : null;
}

function temPlacar(p: PlacarCongresso | null | undefined): p is PlacarCongresso {
  return !!p && Object.values(p).some((n) => typeof n === "number");
}

/**
 * Dado-chave da votação: placar só na nominal (diretriz 5); na secreta, os totais oficiais como
 * contagem (sem voto individual); na simbólica, o caminho.
 */
export function dadoDaVotacao(l: { tipo: string | null; resultado: string | null; placar?: PlacarCongresso | null }): DadoChave {
  const resultado = resultadoTexto(l.resultado);
  if (l.tipo === "nominal") {
    return { tipo: "placar", itens: temPlacar(l.placar) ? placarOficial({ ...l.placar }) : [], resultado };
  }
  if (l.tipo === "secreta") {
    return temPlacar(l.placar)
      ? { tipo: "contagem", legenda: `Votação secreta: totais oficiais, sem voto individual${resultado ? ` · resultado: ${resultado}` : ""}`, itens: placarOficial({ ...l.placar }) }
      : { tipo: "texto", texto: `Votação secreta, sem voto individual${resultado ? ` · resultado: ${resultado}` : ""}` };
  }
  if (l.tipo === "simbolica") return { tipo: "simbolica", resultado };
  return { tipo: "texto", texto: `Tipo de votação não informado na fonte${resultado ? ` · resultado: ${resultado}` : ""}` };
}

export const QUEM_DECIDIU: Record<Casa, string> = {
  camara: "Deputados federais, no Plenário da Câmara dos Deputados",
  senado: "Senadores, no Plenário do Senado Federal",
};

// ---------------------------------------------------------------- quórum

const CONSTITUICAO = "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm";

/** Quórum exigido que se determina só pela espécie da proposição (Constituição Federal). */
const QUORUM: Record<string, { camara: number; senado: number; regra: string; artigo: string; ancora: string }> = {
  PLP: {
    camara: 257,
    senado: 41,
    regra: "projeto de lei complementar precisa de maioria absoluta (mais da metade de todos os membros da casa)",
    artigo: "art. 69 da Constituição Federal: “As leis complementares serão aprovadas por maioria absoluta.”",
    ancora: "#art69",
  },
  PEC: {
    camara: 308,
    senado: 49,
    regra: "proposta de emenda à Constituição precisa de três quintos dos membros da casa, em dois turnos",
    artigo: "art. 60, § 2º, da Constituição Federal",
    ancora: "#art60",
  },
};

const RE_PARTE =
  /\bemendas? (n[ºo°.]|de plenario|do senado|da camara|aglutinativa|de redacao)|\bdestaque|questao de ordem|dispositivo|mantido o texto|suprimido o texto|\bparte d[oa]\b|\bart\. ?\d|recurso|requerimento/;

export interface ExplicacaoQuorum {
  texto: string;
  artigo: string;
  url: string;
}

/**
 * Explica um resultado que contraria a maioria simples (mais Sim que Não e, ainda assim,
 * rejeitada) SOMENTE quando o quórum exigido decorre da espécie da proposição (PLP ou PEC) e a
 * votação é de mérito (não é etapa de procedimento). Em qualquer outro caso, retorna null:
 * nada é deduzido (diretriz 1).
 */
export function explicacaoQuorum(l: {
  casa: Casa;
  sigla: string | null;
  tipo: string | null;
  resultado: string | null;
  placar?: PlacarCongresso | null;
  mudaLei: boolean;
  descricao?: string | null;
}): ExplicacaoQuorum | null {
  if (l.tipo !== "nominal" || !l.mudaLei || !l.sigla) return null;
  // Só a votação do texto como um todo (projeto, substitutivo, subemenda substitutiva global,
  // turnos da PEC). Emendas isoladas, destaques, partes do texto e questões de ordem ficam de fora.
  if (RE_PARTE.test(normalizar(l.descricao ?? ""))) return null;
  const q = QUORUM[l.sigla];
  const sim = l.placar?.sim;
  const nao = l.placar?.nao;
  if (!q || typeof sim !== "number" || typeof nao !== "number") return null;
  const necessario = q[l.casa];
  if (l.resultado !== "rejeitada" || !(sim > nao) || sim >= necessario) return null;
  const membros = l.casa === "camara" ? "513 deputados" : "81 senadores";
  return {
    texto: `Teve mais votos Sim (${sim.toLocaleString("pt-BR")}) que Não (${nao.toLocaleString("pt-BR")}), mas eram necessários ${necessario} votos Sim: ${q.regra} — ${necessario} dos ${membros}.`,
    artigo: q.artigo,
    url: `${CONSTITUICAO}${q.ancora}`,
  };
}

// ---------------------------------------------------------------- regimentos

/** Textos oficiais consolidados dos regimentos (artigos conferidos no texto oficial em 02/11/2026). */
export const REGIMENTOS: Record<Casa, { nome: string; url: string; artigos: string; resumo: string }> = {
  camara: {
    nome: "Regimento Interno da Câmara dos Deputados",
    url: "https://www2.camara.leg.br/atividade-legislativa/legislacao/regimento-interno-da-camara-dos-deputados/arquivos-1/RICDatualizadoatRCD342026.pdf",
    artigos: "arts. 184 a 186",
    resumo:
      "O art. 185 diz que o processo simbólico “será utilizado na votação das proposições em geral”: o presidente convida quem é a favor a permanecer sentado e proclama o resultado. O art. 186 lista quando a votação é nominal: quando a Constituição exige quórum especial, a juízo do presidente ou por decisão do Plenário, e quando há pedido de verificação de votação.",
  },
  senado: {
    nome: "Regimento Interno do Senado Federal",
    url: "https://www25.senado.leg.br/documents/12427/45868/RISF+2018+Volume+1.pdf/cd5769c8-46c5-4c8a-9af7-99be436b89c4",
    artigos: "arts. 292 a 294",
    resumo:
      "O art. 292 prevê a votação ostensiva pelos processos simbólico e nominal e a votação secreta. Pelo art. 293, no processo simbólico os senadores que aprovam a matéria permanecem sentados. O art. 294 diz que o processo nominal é usado quando é exigido quórum especial, por decisão do Plenário a pedido de qualquer senador ou quando há pedido de verificação.",
  },
};

// ---------------------------------------------------------------- agrupamento por dia

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function dataUTC(d: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

/** "28 OUT 2026 · quarta" */
export function rotuloDia(d: string): string {
  const x = dataUTC(d);
  if (!x) return "Data não informada na fonte";
  return `${x.getUTCDate()} ${MESES[x.getUTCMonth()]} ${x.getUTCFullYear()} · ${DIAS[x.getUTCDay()]}`;
}

export function diasEntre(a: string, b: string): number {
  const x = dataUTC(a);
  const y = dataUTC(b);
  return x && y ? Math.round(Math.abs(x.getTime() - y.getTime()) / 86400000) : 0;
}

function ddmm(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}` : d;
}

function somarDias(d: string, n: number): string {
  const x = dataUTC(d);
  if (!x) return d;
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export interface GrupoDia {
  data: string;
  rotulo: string;
  resumo: string;
  linhas: LinhaVotacao[];
  /** Intervalo sem votação antes deste grupo (do grupo mais antigo seguinte até este), se houver. */
  lacunaDepois: { de: string; ate: string; dias: number } | null;
}

/** Menor intervalo (em dias sem votação) que gera o aviso entre grupos. */
export const LACUNA_MINIMA = 7;

/** Agrupa linhas já ordenadas (mais recente primeiro) por dia, com resumo e lacunas. */
export function agruparPorDia(linhas: LinhaVotacao[], avisoLacuna: boolean): GrupoDia[] {
  const grupos: GrupoDia[] = [];
  for (const l of linhas) {
    const g = grupos[grupos.length - 1];
    if (g && g.data === l.data) g.linhas.push(l);
    else grupos.push({ data: l.data, rotulo: rotuloDia(l.data), resumo: "", linhas: [l], lacunaDepois: null });
  }
  grupos.forEach((g, i) => {
    const props = new Set(g.linhas.map((l) => l.propId ?? `${l.casa}-${l.id}`)).size;
    const cam = g.linhas.filter((l) => l.casa === "camara").length;
    const sen = g.linhas.length - cam;
    const n = g.linhas.length;
    g.resumo = [
      `${props} ${props === 1 ? "proposta" : "propostas"}`,
      `${n} ${n === 1 ? "votação" : "votações"}`,
      cam ? `Câmara ${cam}` : null,
      sen ? `Senado ${sen}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const prox = grupos[i + 1];
    if (avisoLacuna && prox && g.data && prox.data) {
      const semVotacao = diasEntre(g.data, prox.data) - 1;
      if (semVotacao >= LACUNA_MINIMA) g.lacunaDepois = { de: somarDias(prox.data, 1), ate: somarDias(g.data, -1), dias: semVotacao };
    }
  });
  return grupos;
}

export function textoLacuna(l: { de: string; ate: string; dias: number }, casas: string): string {
  const ano = l.de.slice(0, 4) !== l.ate.slice(0, 4);
  const f = (d: string) => (ano ? `${ddmm(d)}/${d.slice(0, 4)}` : ddmm(d));
  return `Sem votação que muda lei ${casas} de ${f(l.de)} a ${f(l.ate)} · ${l.dias} dias`;
}

export function casasDoFiltro(casa: string): string {
  if (casa === "camara") return `no Plenário da ${CASA_NOME.camara}`;
  if (casa === "senado") return `no Plenário do ${CASA_NOME.senado}`;
  return "nos Plenários da Câmara e do Senado";
}

/** Texto indexado para a busca (sem acento, minúsculas). */
export function textoBusca(l: LinhaVotacao): string {
  return normalizar(
    `${l.proposicao ?? ""} ${propPorExtenso(l.proposicao) ?? ""} ${l.simples?.titulo ?? ""} ${l.simples?.subtitulo ?? ""} ${l.tema ?? ""} ${l.ementa} ${l.descricao}`,
  );
}
