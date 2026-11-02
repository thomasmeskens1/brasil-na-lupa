// Temas.csv + Processos.csv → objetos de tema (dados/stj/temas/<numero>.json), sem dedução:
// campos vazios ficam null; duplicatas são removidas e divergências da fonte vão para "lacunas".
import { normalizarEspacos } from './lib.mjs';

const nulo = (s) => { const v = String(s ?? '').trim(); return v === '' ? null : v; };
const textoOuNulo = (s) => { const v = String(s ?? '').replace(/\r/g, '').trim(); return v === '' ? null : v; };
export const ASSUNTOS_ICMS = new Set(['5946', '5947', '10556']);

/** "6035- Cofins, 6039- PIS" → [{ codigo, descricao, texto }] (separa só antes de "<código>-"). */
export function separarAssuntos(s) {
  const v = nulo(s);
  if (!v) return [];
  return v.split(/,\s*(?=\d+\s*-)/).map((x) => {
    const m = x.trim().match(/^(\d+)\s*-\s*(.*)$/);
    return m ? { codigo: m[1], descricao: m[2].trim(), texto: x.trim() } : { codigo: null, descricao: x.trim(), texto: x.trim() };
  });
}

/** Agrupa as linhas de Temas.csv por sequencialPrecedente (Temas e linhas sem tipo). */
export function agruparTemas(linhas) {
  const grupos = new Map();
  let linhasDuplicadas = 0;
  for (const r of linhas) {
    if (r.tipoPrecedente !== 'Tema' && r.tipoPrecedente !== '') continue;
    const k = r.sequencialPrecedente;
    if (!grupos.has(k)) grupos.set(k, []);
    else linhasDuplicadas++;
    grupos.get(k).push(r);
  }
  return { grupos, linhasDuplicadas };
}

/** Processos.csv agrupado por sequencialPrecedente, com linhas idênticas removidas. */
export function agruparProcessos(linhas) {
  const porSeq = new Map();
  let identicas = 0;
  const vistos = new Set();
  for (const r of linhas) {
    const chave = JSON.stringify(r);
    if (vistos.has(chave)) { identicas++; continue; }
    vistos.add(chave);
    const k = r.sequencialPrecedente;
    if (!porSeq.has(k)) porSeq.set(k, []);
    porSeq.get(k).push(r);
  }
  return { porSeq, identicas };
}

const CAMPOS_PROC = {
  numeroRegistro: 'numero_registro', ministroRelator: 'relator', leadingCase: 'leading_case',
  dataAfetacao: 'data_afetacao', dataPublicacaoAfetacao: 'data_publicacao_afetacao', NOME_MINISTRO_AFETACAO: 'ministro_proposta_afetacao',
  observacaoAfetacao: 'observacao_afetacao', dataVistaMPF: 'data_vista_mpf', dataJulgamento: 'data_julgamento',
  dataPbulicacaoAcordao: 'data_publicacao_acordao', 'dataPublicacaoEmbargosDeDeclaração': 'data_publicacao_embargos',
  processoSTF: 'processo_stf', dataRemessaSTF: 'data_remessa_stf', situacaoProcessoSTF: 'situacao_processo_stf',
  tribunalOrigem: 'tribunal_origem', siglaTribunalOrigem: 'tribunal_origem_sigla', origemUF: 'uf_origem',
  tipoJusticaOrigem: 'tipo_justica_origem', quantidadeProcessosSuspensoNaOrigem: 'processos_suspensos_na_origem',
  'Desafetação': 'desafetacao', 'Embargos de Divergência': 'embargos_divergencia',
};

/** Processos de um tema: um item por processo; campos que divergem entre linhas repetidas viram lacuna. */
function montarProcessos(linhas, lacunas) {
  const porProc = new Map();
  for (const r of linhas) {
    const k = `${r.Processo}|${r.numeroRegistro}`;
    if (!porProc.has(k)) porProc.set(k, []);
    porProc.get(k).push(r);
  }
  const saida = [];
  for (const grupo of porProc.values()) {
    const base = grupo[0];
    const p = { processo: nulo(base.Processo) };
    const alternativos = {};
    for (const [orig, dest] of Object.entries(CAMPOS_PROC)) {
      let v = nulo(base[orig]);
      if (dest === 'processos_suspensos_na_origem' && v !== null && /^\d+$/.test(v)) v = Number(v);
      p[dest] = v;
      const outros = [...new Set(grupo.map((g) => nulo(g[orig])))];
      if (outros.length > 1) {
        alternativos[dest] = outros;
        lacunas.push(`Processos.csv traz o ${p.processo} em ${grupo.length} linhas com "${orig}" diferente: ${outros.map((x) => x ?? 'vazio').join(' × ')} (todos os valores guardados em valores_alternativos_fonte)`);
      }
    }
    p.valores_alternativos_fonte = Object.keys(alternativos).length ? alternativos : null;
    p.paradigma = p.leading_case === 'S' ? true : p.leading_case === 'N' ? false : null;
    saida.push(p);
  }
  return saida.sort((a, b) => (b.paradigma === true) - (a.paradigma === true) || String(a.processo).localeCompare(String(b.processo)));
}

/** Datas (ISO) que contam para o período de coleta. */
export function datasDoTema(t) {
  const ds = [t.datas.afetacao, t.datas.julgamento, t.datas.publicacao];
  for (const p of t.processos) ds.push(p.data_afetacao, p.data_publicacao_afetacao, p.data_julgamento, p.data_publicacao_acordao, p.data_publicacao_embargos);
  return ds.filter(Boolean);
}

/** Monta o tema a partir das linhas (já agrupadas) do Temas.csv e do Processos.csv. */
export function montarTema(linhasTema, linhasProc, { urlTemasCsv, urlProcessosCsv, hoje }) {
  const r = linhasTema[0];
  const lacunas = [];
  const rg = [];
  for (const l of linhasTema) {
    const n = nulo(l.numeroRepercussaoGeralSTF), d = textoOuNulo(l.descricaoRepercussaoGeral);
    if ((n || d) && !rg.some((x) => x.numero === n && x.descricao === d)) rg.push({ numero: n, descricao: d });
  }
  if (linhasTema.length > 1) {
    const difs = Object.keys(r).filter((k) => linhasTema.some((l) => l[k] !== r[k]));
    const soRG = difs.every((k) => k === 'numeroRepercussaoGeralSTF' || k === 'descricaoRepercussaoGeral');
    if (!soRG) lacunas.push(`Temas.csv traz este precedente em ${linhasTema.length} linhas com diferenças em: ${difs.join(', ')}. Guardada a primeira linha.`);
  }
  const tipoFonte = r.tipoPrecedente;
  if (tipoFonte === '') lacunas.push('Tipo de precedente vazio no Temas.csv');
  const assuntos = separarAssuntos(r.Assuntos);
  const processos = montarProcessos(linhasProc ?? [], lacunas);
  if (!processos.length) lacunas.push('Nenhum processo vinculado no Processos.csv');
  const relatores = [...new Set(processos.filter((p) => p.paradigma).map((p) => p.relator).filter(Boolean))];
  const qs = textoOuNulo(r.questaoSubmetidaAJulgamento), tese = textoOuNulo(r.teseFirmada);
  const tema = {
    id: `stj-tema-${r.numeroPrecedente}`,
    numero: r.numeroPrecedente,
    sequencial: r.sequencialPrecedente,
    tipo_precedente: tipoFonte === 'Tema' ? 'Tema Repetitivo' : null,
    tipo_precedente_fonte: nulo(tipoFonte),
    orgao_sigla: nulo(r.orgaoJulgador),
    orgao: null,
    situacao: nulo(r.situacao),
    questao: qs,
    tese,
    informacoes_complementares: textoOuNulo(r.informacoesComplementares),
    anotacoes_nugepnac: textoOuNulo(r.anotacoesNUGEPNAC),
    delimitacao_julgado: textoOuNulo(r.delimitacaoJulgado),
    entendimento_anterior: textoOuNulo(r.entendimentoAnterior),
    referencia_legislativa: textoOuNulo(r.referenciaLegislativa),
    referencia_sumular: textoOuNulo(r.referenciaSumular),
    sumula_originada: textoOuNulo(r.sumulaOriginada),
    audiencia_publica: { registro_fonte: nulo(r.audienciaPublica), data: nulo(r.dataAudienciaPublica) },
    assuntos,
    repercussao_geral_stf: rg,
    relator: relatores.length ? relatores : null,
    datas: {
      afetacao: nulo(r.dataPrimeiraAfetacao), julgamento: nulo(r.dataJulgamento), publicacao: nulo(r.dataPublicacaoAcordao),
      transito_em_julgado: null,
    },
    processos,
    colecoes: [],
    criterios_icms: {
      assunto_cnj_icms: assuntos.some((a) => ASSUNTOS_ICMS.has(a.codigo)),
      questao_ou_tese_menciona_icms: /\bICMS\b/i.test(`${qs ?? ''} ${tese ?? ''}`),
    },
    url_oficial: null,
    pagina_oficial: null,
    julgamento: null,
    pautas: [],
    fontes: [
      { titulo: 'STJ — Dados Abertos: precedentes qualificados (Temas.csv)', url: urlTemasCsv, orgao: 'Superior Tribunal de Justiça', acessado_em: hoje },
      { titulo: 'STJ — Dados Abertos: precedentes qualificados (Processos.csv)', url: urlProcessosCsv, orgao: 'Superior Tribunal de Justiça', acessado_em: hoje },
    ],
    lacunas,
  };
  if (!tema.relator) lacunas.push('Relator do processo paradigma não informado no Processos.csv');
  if (!tema.tese) lacunas.push('Tese firmada não disponível em fonte oficial (campo vazio no Temas.csv)');
  return tema;
}

/** Normaliza para comparar nomes/UF sem diferenças de caixa e espaços. */
export const chave = (s) => normalizarEspacos(s).toUpperCase();
