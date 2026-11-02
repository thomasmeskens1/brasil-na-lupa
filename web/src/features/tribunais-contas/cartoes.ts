/**
 * Cartões de Decisão das linhas do tempo dos tribunais de contas (funções puras). Parecer prévio:
 * a conclusão literal é o dado-chave. Julgamento político: placar só quando a votação é nominal
 * (diretriz 5); sem votação, a situação registrada na fonte ("aguardando relator desde …").
 */
import type { DadoChave, FonteResumo, FormaDecisao, TituloSimples } from "@/components/decisao/tipos";
import { placarOficial } from "@/components/decisao/rotulos";
import type { ExercicioPresidente, FonteTc, JulgamentoAlesp, JulgamentoCongresso, OrgaoTc, ParecerPrevioTce } from "./tipos";
import { BASE_TC, NAO_DISPONIVEL, deUf, formatarDataTc, nomeProprio, resumoParecerTce, resumoParecerTcu } from "./rotulos";

export interface DadosCartaoTc {
  chave: string;
  href: string;
  tituloOficial: string;
  simples?: TituloSimples | null;
  subtitulo: string | null;
  caminho: string;
  rotuloCaminho?: string;
  data: string | null;
  forma: FormaDecisao | null;
  dado: DadoChave | null;
  quem: string;
  fonte: FonteResumo | null;
}

function fonteDe(f: { url: string; titulo?: string | null; orgao?: string | null; acessado_em?: string | null } | null | undefined, orgao?: string): FonteResumo | null {
  if (!f?.url) return null;
  return {
    url: f.url,
    titulo: f.titulo ?? null,
    orgao: f.orgao ?? orgao ?? null,
    acessado_em: f.acessado_em ?? null,
    tipo: /\.pdf($|\?)/i.test(f.url) ? "pdf" : "oficial",
  };
}

/** Situação literal em caixa alta (ex.: "AGUARDANDO DESIGNAÇÃO DO RELATOR") em frase. */
export function frase(v: string): string {
  return v === v.toUpperCase() ? v.charAt(0) + v.slice(1).toLowerCase() : v;
}

function sigla(c: string | null): string | null {
  const m = c ? /\(([A-Z]{2,6})\)\s*$/.exec(c) : null;
  return m ? m[1] : null;
}

/** Situação do julgamento no Congresso em uma linha, só com o que a fonte registra. */
export function situacaoCongresso(jp: JulgamentoCongresso | null): string {
  if (!jp) return `Julgamento pelo Congresso Nacional: ${NAO_DISPONIVEL.toLowerCase()}.`;
  const julgado = !!jp.deliberacao || !!jp.norma_gerada;
  if (!julgado && /AGUARDANDO DESIGNA[ÇC][ÃA]O DO RELATOR/i.test(jp.situacao_literal ?? "")) {
    const s = sigla(jp.colegiado_atual);
    return `Aguardando designação de relator${s ? ` na ${s}` : ""} desde ${formatarDataTc(jp.data_situacao)}. Até a coleta, as contas não tinham sido votadas.`;
  }
  if (julgado) return "Votação registrada na fonte (ver a tramitação).";
  return `${jp.situacao_literal ? frase(jp.situacao_literal) : NAO_DISPONIVEL}${jp.data_situacao ? ` (desde ${formatarDataTc(jp.data_situacao)})` : ""}.`;
}

/* ---------- Títulos (montados só com campos do documento) ---------- */

export function tituloPresidente(e: ExercicioPresidente): string {
  const r = resumoParecerTcu(e.curadoria?.conclusao ?? e.conclusao_parecer);
  return `Contas do Presidente de ${e.exercicio}: ${r ?? "parecer prévio não disponível nos dados coletados"}`;
}

export function tituloGovernador(p: ParecerPrevioTce, o: Pick<OrgaoTc, "uf">): string {
  const r = resumoParecerTce(p.parecer);
  return `Contas do Governador ${deUf(o.uf)} de ${p.parecer.exercicio}: ${r ?? (p.data_julgamento ? "parecer prévio emitido" : "parecer prévio não publicado até a coleta")}`.replace(
    /\s+/g,
    " ",
  );
}

export function tituloPrefeito(p: ParecerPrevioTce, municipio: string): string {
  const r = resumoParecerTce(p.parecer);
  return `Contas do Prefeito de ${municipio} de ${p.parecer.exercicio}: ${r ?? "parecer não disponível em fonte aberta"}`;
}

/* ---------- Contas do Presidente ---------- */

export function cartaoParecerPresidente(e: ExercicioPresidente, orgao: string, titulo: string): DadosCartaoTc {
  const a = e.acordao;
  const c = e.curadoria;
  const conclusao = c?.conclusao ?? e.conclusao_parecer;
  return {
    chave: `parecer-${e.exercicio}`,
    href: a ? `${BASE_TC}/${orgao}/acordaos/${a.id}` : `#exercicio-${e.exercicio}-parecer`,
    tituloOficial: titulo,
    subtitulo: a ? `Parecer prévio do Tribunal de Contas da União (TCU) · Acórdão ${a.numero} — ${a.orgao}` : "Parecer prévio do Tribunal de Contas da União (TCU)",
    caminho: "tcu",
    data: a?.data_julgamento ?? null,
    forma: a ? "colegiado" : null,
    dado: conclusao
      ? { tipo: "texto", rotulo: "Conclusão do parecer (texto oficial)", texto: conclusao }
      : { tipo: "texto", rotulo: "Parecer prévio", texto: `${NAO_DISPONIVEL} nos dados coletados.` },
    quem: a ? `Plenário do TCU · relator: ${nomeProprio(a.relator)}` : "Tribunal de Contas da União (TCU)",
    fonte: c?.documento ? fonteDe(c.documento, "Tribunal de Contas da União") : a ? fonteDe({ url: a.url, titulo: `Acórdão ${a.numero}` }, "Tribunal de Contas da União") : null,
  };
}

export function cartaoJulgamentoCongresso(exercicio: string, jp: JulgamentoCongresso | null): DadosCartaoTc {
  return {
    chave: `julgamento-${exercicio}`,
    href: `#exercicio-${exercicio}-julgamento`,
    tituloOficial: `Julgamento das contas de ${exercicio} pelo Congresso Nacional`,
    subtitulo: jp?.mensagem ? `Mensagem do Congresso Nacional (MCN) ${jp.mensagem}` : null,
    caminho: "congresso",
    data: jp?.data_situacao ?? null,
    forma: null,
    dado: { tipo: "texto", rotulo: "Situação na fonte", texto: situacaoCongresso(jp) },
    quem: "Deputados federais e senadores (Congresso Nacional), depois do parecer da Comissão Mista de Planos, Orçamentos Públicos e Fiscalização (CMO)",
    fonte: fonteDe(jp?.fonte ?? null, "Congresso Nacional"),
  };
}

/* ---------- Contas do Governador e do Prefeito (TCE) ---------- */

export function cartaoParecerTce(p: ParecerPrevioTce, o: OrgaoTc, titulo: string, contasDe: string): DadosCartaoTc {
  const par = p.parecer;
  const literal = par.conclusao_literal ?? null;
  const doc = par.documento ?? p.documentos?.[0] ?? null;
  return {
    chave: `parecer-${par.exercicio}`,
    href: `#exercicio-${par.exercicio}-parecer`,
    tituloOficial: titulo,
    subtitulo: `Parecer prévio do ${o.nome} sobre as contas ${contasDe}${p.processo?.numero ? ` · processo ${p.processo.numero}` : ""}`,
    caminho: o.id,
    rotuloCaminho: o.id.toUpperCase(),
    data: p.data_julgamento ?? null,
    forma: p.data_julgamento ? "colegiado" : null,
    dado: literal
      ? { tipo: "texto", rotulo: "Conclusão (texto oficial)", texto: literal }
      : par.conclusao
        ? { tipo: "texto", rotulo: "Parecer (texto do conjunto de dados oficial)", texto: par.conclusao }
        : { tipo: "texto", rotulo: "Parecer prévio", texto: p.data_julgamento ? "Parecer emitido; conclusão não disponível nos dados coletados." : "Parecer não publicado em fonte aberta até a coleta." },
    quem: [p.orgao ?? o.nome, p.relator ? `relator: ${p.relator}` : null].filter(Boolean).join(" · "),
    fonte: fonteDe(doc, o.nome) ?? fonteDe(p.fontes[0] as FonteTc | undefined, o.nome),
  };
}

export function cartaoJulgamentoAlesp(exercicio: string, jp: JulgamentoAlesp | null, casa: string, sigla: string): DadosCartaoTc {
  const base = {
    chave: `julgamento-${exercicio}`,
    href: `#exercicio-${exercicio}-julgamento`,
    tituloOficial: `Julgamento das contas de ${exercicio} pela ${casa}`,
    caminho: sigla.toLowerCase(),
    rotuloCaminho: sigla,
    quem: `Deputados estaduais (${casa})`,
  };
  if (!jp) {
    return {
      ...base,
      subtitulo: null,
      data: null,
      forma: null,
      dado: { tipo: "texto", rotulo: "Situação", texto: "Julgamento pela Assembleia Legislativa não localizado nos dados coletados." },
      fonte: null,
    };
  }
  const prop = jp.proposicao ? `${jp.proposicao.sigla} ${jp.proposicao.numero}/${jp.proposicao.ano}` : null;
  const plenario = [...jp.votacoes]
    .filter((v) => v.tipo === "nominal" && v.placar && (v.orgao ?? "").startsWith("Plenário"))
    .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""))[0];
  const subtitulo = prop ? `Projeto de Decreto Legislativo (PDL) ${prop.replace(/^PDL\s*/, "")}` : null;
  if (plenario?.placar) {
    return {
      ...base,
      subtitulo,
      data: plenario.data,
      forma: "votacao-nominal",
      dado: { tipo: "placar", itens: placarOficial({ ...plenario.placar }), resultado: plenario.resultado },
      quem: `Deputados estaduais, no ${plenario.orgao ?? "Plenário"}`,
      fonte: fonteDe(plenario.url ? { url: plenario.url, titulo: "Registro oficial da votação" } : null, casa),
    };
  }
  return {
    ...base,
    subtitulo,
    data: jp.data_situacao,
    forma: null,
    dado: { tipo: "texto", rotulo: "Última situação (texto oficial)", texto: jp.situacao_literal ?? NAO_DISPONIVEL },
    fonte: fonteDe(jp.fonte, casa),
  };
}
