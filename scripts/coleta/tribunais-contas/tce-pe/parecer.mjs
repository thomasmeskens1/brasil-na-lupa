// Conversão dos registros da entidade "Resultados" (API de Dados Abertos do TCE-PE) em itens de parecer prévio
// no formato de dados/esquema.json (julgamento, natureza "parecer-previo"). Só campos literais da API.
import { fonte, dataISO, link, hojeISO } from './lib.mjs';

export const NOME_TRIBUNAL = 'Tribunal de Contas do Estado de Pernambuco';
export const URL_CATALOGO = 'https://sistemas.tcepe.tc.br/DadosAbertos/Exemplo!listar';
export const URL_DOC_RESULTADOS = 'https://sistemas.tcepe.tc.br/DadosAbertos/Exemplo!detalhar?dadosAbertos.id=42';

const t = (v) => (v == null ? '' : String(v).trim());

/** Campos de interesse de um registro, aparados. */
export function normalizarRegistro(r) {
  return {
    processo: t(r.Processo),
    esfera: t(r.EsferaUJPrincipalProcesso),
    uj: t(r.NomeUJPrincipalProcesso),
    municipio: t(r.MunicipioUJPrincipalProcesso),
    exercicio: Number(t(r.ExercicioPrincipalProcesso)) || null,
    modalidade: t(r.Modalidade),
    tipo: t(r.Tipo),
    colegiado: t(r.NomeColegiado) || null,
    status: t(r.StatusProcesso) || null,
    pessoa: t(r.NomePessoa) || null,
    data_sessao: dataISO(r.DataSessaoJulgamento),
    relator: t(r.NomeRelator) || null,
    resultado: t(r.Resultado) || null,
    documento: t(r.Documento) || null,
    ano_documento: t(r.AnoAcordaoParecer) || null,
    link_documento: link(r.LinkDocumento),
    link_processo: link(r.LinkProcesso),
  };
}

/** Agrupa registros por processo (a API repete o processo, uma linha por responsável). */
export function agruparPorProcesso(regs) {
  const m = new Map();
  for (const r of regs) {
    if (!r.processo) continue;
    if (!m.has(r.processo)) m.set(r.processo, []);
    m.get(r.processo).push(r);
  }
  return m;
}

const unicos = (l) => [...new Set(l.filter(Boolean))];

/**
 * Resume as linhas de um processo. Quando as linhas divergem num campo (resultado, data, relator…),
 * o campo fica null e a divergência vira lacuna: nada é escolhido por conta própria.
 */
export function resumirProcesso(linhas) {
  const lacunas = [];
  const campo = (k, rotulo) => {
    const v = unicos(linhas.map((l) => l[k]));
    if (v.length > 1) { lacunas.push(`A API traz valores diferentes para ${rotulo} no mesmo processo (${v.map((x) => `"${x}"`).join(', ')}); campo deixado em branco`); return null; }
    return v[0] ?? null;
  };
  return {
    processo: linhas[0].processo,
    exercicio: linhas[0].exercicio,
    modalidade: campo('modalidade', 'a modalidade'),
    tipo: campo('tipo', 'o tipo'),
    colegiado: campo('colegiado', 'o colegiado'),
    status: campo('status', 'a situação do processo'),
    data_sessao: campo('data_sessao', 'a data da sessão'),
    relator: campo('relator', 'o relator'),
    resultado: campo('resultado', 'o resultado'),
    documento: campo('documento', 'o documento'),
    ano_documento: campo('ano_documento', 'o ano do parecer'),
    link_documento: campo('link_documento', 'o link do documento'),
    link_processo: campo('link_processo', 'o link do processo'),
    responsaveis: unicos(linhas.map((l) => l.pessoa)),
    lacunas,
  };
}

/** Item de parecer prévio a partir do resumo de um processo (ou null = sem registro na API). */
export function montarItem({ id, titulo, contasDe, exercicio, resumo, urlConsulta, casaJulgadora, lacunaSemRegistro, outros = [], comDocumentos = true }) {
  const fonteApi = fonte('API de Dados Abertos do TCE-PE — entidade "Resultados" (processos eletrônicos julgados)', urlConsulta);
  const base = {
    id,
    tribunal: 'tce-pe',
    natureza: 'parecer-previo',
    titulo,
    processo: { classe: null, numero: null, url: null },
    orgao: null,
    relator: null,
    data_julgamento: null,
    data_transito_em_julgado: null,
    situacao_processo_literal: null,
    responsaveis_literal: [],
    parecer: { conclusao: null, ressalvas: [], alertas: [], contas_de: contasDe, exercicio: String(exercicio) },
    julgamento_politico: null,
    documentos: [],
    situacao_conferencia: 'automatico-estruturado',
    coletado_em: hojeISO(),
    fontes: [fonteApi],
    lacunas: [],
  };
  if (!resumo) {
    if (!comDocumentos) delete base.documentos;
    base.lacunas.push(lacunaSemRegistro);
    base.lacunas.push(`Julgamento das contas pela ${casaJulgadora} não localizado nos dados coletados`);
    return base;
  }
  const r = resumo;
  base.processo = {
    classe: [r.modalidade, r.tipo ? `tipo ${r.tipo}` : null].filter(Boolean).join(' — ') || null,
    numero: r.processo,
    url: r.link_processo,
  };
  base.orgao = r.colegiado;
  base.relator = r.relator;
  base.data_julgamento = r.data_sessao;
  base.situacao_processo_literal = r.status;
  base.responsaveis_literal = r.responsaveis;
  base.parecer.conclusao = r.resultado;
  // com_ressalvas não é preenchido: o texto literal ("Aprovação com ressalvas") já diz, e o site acrescentaria
  // " com ressalvas" de novo ao resumo (resumoParecerTce em web/src/features/tribunais-contas/rotulos.ts).
  if (!comDocumentos) delete base.documentos;
  if (r.link_documento) {
    base.parecer.documento = { titulo: `${r.documento || 'Documento do julgamento'}${r.ano_documento ? ` (${r.ano_documento})` : ''} — e-TCE`, url: r.link_documento };
    base.documentos?.push({ titulo: `${r.documento || 'Documento do julgamento'}${r.ano_documento ? ` (${r.ano_documento})` : ''}`, url: r.link_documento });
  }
  if (r.link_processo) base.documentos?.push({ titulo: `Processo ${r.processo} na consulta externa do e-TCE`, url: r.link_processo });
  if (r.documento && !/parecer pr[ée]vio/i.test(r.documento)) base.lacunas.push(`O documento informado pela API é "${r.documento}", não "Parecer Prévio"`);
  base.lacunas.push(...r.lacunas);
  if (!r.resultado) base.lacunas.push('Resultado do julgamento não informado pela API');
  base.lacunas.push('Ressalvas, determinações e recomendações não constam na API; estão no documento do parecer (link do e-TCE, não aberto pelo coletor)');
  base.lacunas.push('Resultado da votação (unanimidade ou maioria) e votos de cada conselheiro não constam na API');
  base.lacunas.push(`Data do trânsito em julgado não consta na API; a situação literal do processo é "${r.status ?? 'não informada'}"`);
  if (outros.length) {
    base.outros_processos = outros.map((o) => ({ numero: o.processo, resultado: o.resultado, data_julgamento: o.data_sessao, colegiado: o.colegiado, situacao_literal: o.status, url: o.link_processo, documento_url: o.link_documento }));
    base.lacunas.push(`A API traz mais de um processo de contas de governo para este exercício (${[r, ...outros].map((o) => o.processo).join(', ')}); o item mostra o de sessão mais recente e os demais estão em "outros_processos"`);
  }
  base.lacunas.push(`Julgamento das contas pela ${casaJulgadora} não localizado nos dados coletados`);
  return base;
}

/** Ordena processos do mesmo exercício: sessão mais recente primeiro, depois número do processo. */
export function ordenarProcessos(lista) {
  return [...lista].sort((a, b) => (b.data_sessao ?? '').localeCompare(a.data_sessao ?? '') || a.processo.localeCompare(b.processo));
}
