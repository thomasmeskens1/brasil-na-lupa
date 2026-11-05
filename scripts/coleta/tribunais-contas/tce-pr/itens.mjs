// Montagem de cada parecer prévio (um por ato do CSV) no formato ParecerPrevioTce do site, e consolidação
// com o que foi lido no PDF. Funções puras (sem rede), testadas em testes.mjs.
import { dataISO } from './lib.mjs';
import { exercicioDoRegistro, conclusaoNoResumo, cortar, lerDeliberacao } from './extrair.mjs';

/** Versão do leitor de deliberação; ao mudar, PDFs sem deliberação localizada são relidos. */
export const VERSAO_LEITURA = 1;

export const URL_BASE_DADOS = 'https://viajuris.tce.pr.gov.br/DadosAbertos/DadosAbertos/BaseDados';
export const urlCsv = (ano) => `https://viajuris.tce.pr.gov.br/DadosAbertos/DadosAbertos/DownloadArquivo?nomeArquivo=${ano}_acordaos_base_de_dados.csv`;

const PDF_OK = /^https:\/\/viajuris\.tce\.pr\.gov\.br\/Arquivos\/[\w/.-]+\.pdf$/i;

/** Chave estável do ato: o endereço do PDF (o número do ato se repete entre colegiados). */
export function chaveDoAto(r) {
  const m = String(r.UrlPDF || '').match(/\/Arquivos\/(\d{4})\/(\d{1,2})\/(\d+)\.pdf$/i);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : `${r.AnoAto}-${r.NrAto}-${String(r.DsColegiado || '').toLowerCase().replace(/[^a-z]+/g, '')}`;
}

/**
 * Item de parecer prévio a partir de uma linha do CSV. contasDe: "Prefeito de X" / "Governador do Estado do Paraná".
 * fonteCsv: fonte do arquivo anual. anoCsv: ano do arquivo (usado na mesclagem incremental).
 */
export function montarItem(r, { contasDe, tituloContas, fonteCsv, anoCsv }) {
  const ex = exercicioDoRegistro(r);
  const url = PDF_OK.test(r.UrlPDF) ? r.UrlPDF : null;
  const doc = url ? { titulo: `${r.DsTitulo} — inteiro teor (PDF)`, url } : null;
  return {
    id: `tce-pr-parecer-${chaveDoAto(r)}`,
    tribunal: 'tce-pr',
    natureza: 'parecer-previo',
    titulo: `${r.DsTitulo} — ${tituloContas}${ex ? `, exercício ${ex.ano}` : ''}`,
    ato: { tipo: r.DsTipoAto || null, numero: r.NrAto || null, ano: r.AnoAto || null, titulo_oficial: r.DsTitulo || null },
    processo: { classe: r.DsClasseProcessual || null, numero: r.NrProcesso ? `${r.NrProcesso}/${r.AnoProcesso}` : null, url: null },
    orgao: r.DsColegiado || null,
    relator: r.NmRelator || null,
    data_julgamento: dataISO(r.DtSessao),
    data_publicacao: dataISO(r.DtPublicacaoDOE),
    publicacao_literal: r.DsVeiculoPublicacao ? `${r.DsVeiculoPublicacao}${r.NrDOE ? ` nº ${r.NrDOE}` : ''}` : null,
    entidade_literal: r.DsEntidade || null,
    resumo_literal: cortar(r.DsResumo, 600),
    indexacao_literal: r.Termos || null,
    exercicio_fonte: ex ? { campo: ex.campo, trecho: ex.trecho } : null,
    parecer: {
      conclusao: null,
      conclusao_literal: null,
      conclusao_fonte: null,
      com_ressalvas: null,
      ressalvas: [],
      alertas: [],
      contas_de: contasDe,
      exercicio: ex ? String(ex.ano) : null,
      documento: doc,
    },
    votacao_literal: null,
    julgamento_politico: null,
    leitura_pdf: null,
    situacao_conferencia: 'automatico-estruturado',
    ano_arquivo_fonte: anoCsv,
    fontes: [{ titulo: fonteCsv.titulo, url: fonteCsv.url, orgao: fonteCsv.orgao, acessado_em: fonteCsv.acessado_em }],
    lacunas: [],
  };
}

/**
 * Recalcula conclusão, exercício e lacunas a partir do CSV e da leitura do PDF (item.leitura_pdf).
 * casaPolitica: "Câmara Municipal de X" / "Assembleia Legislativa do Paraná".
 */
export function consolidar(item, { casaPolitica, exercicioCsv = null }) {
  const p = item.parecer;
  const lac = [];
  const lp = item.leitura_pdf;
  // Reaplica o leitor atual ao trecho literal guardado (melhorias do leitor valem sem baixar o PDF de novo).
  if (lp && (lp.situacao === 'lido' || lp.situacao === 'sem_deliberacao') && lp.deliberacao) {
    const d2 = lerDeliberacao(lp.deliberacao.replace(/\s*\[…\]$/, ''), Infinity);
    if (d2?.item_parecer) Object.assign(lp, { situacao: 'lido', item_parecer: d2.item_parecer, conclusao: d2.conclusao, exercicio: d2.exercicio, votacao: d2.votacao || lp.votacao });
  }
  const pdfOk = lp && lp.situacao === 'lido';
  const exCsv = exercicioCsv ?? (item.exercicio_fonte ? Number(item.exercicio_fonte.trecho.match(/\d{4}/)[0]) : null);
  const exPdf = pdfOk && lp.exercicio ? lp.exercicio.ano : null;

  // Exercício: o escrito na deliberação do PDF; sem ele, o dos campos do CSV.
  p.exercicio = exPdf ? String(exPdf) : exCsv ? String(exCsv) : null;
  if (exPdf && exCsv && exPdf !== exCsv) {
    lac.push(`O conjunto de dados indica o exercício ${exCsv} ("${item.exercicio_fonte.trecho}"), mas a deliberação do PDF diz "${lp.exercicio.trecho}"; foi usado o texto do PDF`);
  }
  if (!p.exercicio) lac.push('Exercício das contas não consta nos campos do conjunto de dados nem no trecho lido do PDF');
  const anoSessao = item.data_julgamento ? Number(item.data_julgamento.slice(0, 4)) : null;
  if (p.exercicio && anoSessao && Number(p.exercicio) >= anoSessao) {
    lac.push(`O exercício indicado na fonte (${p.exercicio}) é igual ou posterior ao ano da sessão (${anoSessao}); possível erro no campo de origem, conferir no PDF`);
  }

  // Conclusão: só o texto literal (deliberação do PDF ou resumo do CSV).
  const doResumo = conclusaoNoResumo(item.resumo_literal);
  if (pdfOk && lp.item_parecer) {
    p.conclusao = lp.conclusao || lp.item_parecer;
    p.conclusao_literal = lp.item_parecer;
    p.conclusao_fonte = 'Deliberação no inteiro teor (PDF)';
  } else if (doResumo) {
    p.conclusao = doResumo;
    p.conclusao_literal = doResumo;
    p.conclusao_fonte = 'Resumo (campo DsResumo) do conjunto de dados aberto';
  } else {
    p.conclusao = null;
    p.conclusao_literal = null;
    p.conclusao_fonte = null;
    if (!lp) lac.push('Conclusão do parecer não consta no resumo do conjunto de dados; está no inteiro teor (PDF), ainda não lido pelo coletor');
    else if (lp.situacao === 'ilegivel') lac.push('Conclusão do parecer não consta no resumo; o PDF não tem texto legível por máquina (sem OCR)');
    else lac.push('Conclusão do parecer não consta no resumo; o trecho "Emitir Parecer Prévio…" não foi localizado nas páginas finais do PDF');
  }
  item.votacao_literal = pdfOk ? lp.votacao || null : null;
  if (!item.votacao_literal) lac.push('Resultado da votação (unanimidade ou maioria) não consta nos dados coletados');
  if (!item.relator) lac.push('Relator não consta no conjunto de dados');
  if (!item.data_julgamento) lac.push('Data da sessão não consta no conjunto de dados');
  if (!p.documento) lac.push('Endereço do PDF ausente ou fora do padrão no conjunto de dados');
  lac.push('Ressalvas, determinações e recomendações não foram copiadas para os dados; ver o inteiro teor (PDF)');
  lac.push(`Julgamento das contas pela ${casaPolitica} não localizado nos dados coletados`);
  item.lacunas = lac;
  if (p.exercicio) item.titulo = item.titulo.replace(/, exercício \d{4}$/, '') + `, exercício ${p.exercicio}`;
  return item;
}

/** Registro enxuto de acórdão relacionado (recurso, erro material) da mesma classe processual. */
export function montarRelacionado(r, anoCsv) {
  return {
    titulo: r.DsTitulo || null,
    tipo: r.DsTipoAto || null,
    orgao: r.DsColegiado || null,
    relator: r.NmRelator || null,
    data_sessao: dataISO(r.DtSessao),
    resumo_literal: cortar(r.DsResumo, 400),
    url: PDF_OK.test(r.UrlPDF) ? r.UrlPDF : null,
    ano_arquivo_fonte: anoCsv,
  };
}

/** Copia a leitura de PDF já feita (mesmo endereço) de um item antigo para o novo. */
export function herdarLeitura(novo, antigo) {
  const lp = antigo?.leitura_pdf;
  // Leitura sem a deliberação é refeita quando o leitor muda de versão; leitura com erro, sempre.
  const valida = lp && (lp.situacao === 'lido' || (lp.situacao !== 'erro' && lp.versao === VERSAO_LEITURA));
  if (valida && antigo.parecer?.documento?.url === novo.parecer.documento?.url) {
    novo.leitura_pdf = antigo.leitura_pdf;
  }
  return novo;
}
