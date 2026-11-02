// Monta o registro "julgamento" (dados/esquema.json) de um acórdão do TCU a partir do item do índice
// (campos literais da API de dados abertos) e, para as Contas do Presidente, da curadoria do parecer
// prévio e da situação no Congresso.
//
// Regras (diretriz 1): nada é deduzido. Resultado "por unanimidade"/"por maioria" só entra se a expressão
// estiver literalmente no sumário da API; vencidos, presentes e declarações de voto ficam vazios com lacuna,
// porque o campo estruturado "QUORUM" só existe no arquivo anual de jurisprudência (sites.tcu.gov.br),
// que não é acessado.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, urlOficial } from './acordaos.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
export const DIR_CURADORIA = path.join(RAIZ, 'dados', 'tribunais-contas', 'tcu', 'curadoria');

export const LACUNA_QUORUM =
  'Ministros presentes, vencidos, voto de desempate e declarações de voto: a API de dados abertos do TCU não traz esses dados. O campo estruturado "quórum" só existe no arquivo anual de jurisprudência, publicado em host que proíbe robôs de inteligência artificial e que, por isso, não acessamos. Consulte o inteiro teor no link oficial.';
export const LACUNA_RESULTADO =
  'Resultado (por unanimidade ou por maioria): a expressão não consta nos campos da API de dados abertos do TCU; não é deduzido.';
const LACUNA_PROCESSO =
  'Número e classe do processo, assunto, revisor e redator do acórdão: a API de dados abertos do TCU não traz esses campos.';
const LACUNA_SESSAO = 'Tipo de sessão (ordinária ou extraordinária): a API não informa.';
const LACUNA_DISPOSITIVO = 'Texto da decisão ("ACORDAM…"): a API não traz; o inteiro teor está no link do documento oficial.';

/** Curadoria do parecer prévio (texto literal copiado do inteiro teor oficial), se existir. */
export function lerCuradoriaParecer(exercicio) {
  try { return JSON.parse(fs.readFileSync(path.join(DIR_CURADORIA, `contas-presidente-${exercicio}.json`), 'utf8')); } catch { return null; }
}

function resultadoLiteral(texto) {
  const m = String(texto || '').match(/\bpor (unanimidade|maioria)\b/i);
  return m ? `por ${m[1].toLowerCase()}` : null;
}


export function montarJulgamento(it, { colecoes, natureza, def, julgamentoPolitico, hoje }) {
  const url = urlOficial(it);
  const lacunas = [LACUNA_PROCESSO, LACUNA_SESSAO, LACUNA_DISPOSITIVO];
  const resultado = resultadoLiteral(it.sumario);
  if (!resultado) lacunas.push(LACUNA_RESULTADO);
  lacunas.push(LACUNA_QUORUM);
  if (!it.sumario) lacunas.push('Sumário: vazio na API (acórdão de relação).');

  const fontes = [
    { titulo: `${it.titulo} — pesquisa de jurisprudência do TCU`, url, orgao: 'Tribunal de Contas da União', acessado_em: hoje },
    ...(it.url_pdf ? [{ titulo: `${it.titulo} — inteiro teor (PDF)`, url: it.url_pdf, orgao: 'Tribunal de Contas da União', acessado_em: hoje }] : []),
    { titulo: 'API de dados abertos do TCU — acórdãos (origem dos campos estruturados)', url: API, orgao: 'Tribunal de Contas da União', acessado_em: hoje },
  ];

  const j = {
    id: it.id,
    tribunal: 'tcu',
    chave_oficial: it.id,
    natureza,
    colecoes,
    titulo: it.titulo,
    numero: `${it.numero}/${it.ano}`,
    ata: it.ata,
    tipo: it.tipo,
    processo: { classe: null, numero: null, incidente_ou_registro: it.id, url },
    orgao: it.colegiado,
    sessao: null,
    relator: it.relator,
    revisor: null,
    redator_acordao: null,
    data_julgamento: it.data_sessao,
    data_publicacao: null,
    situacao: it.situacao,
    assunto: null,
    sumario: it.sumario,
    certidao_literal: null,
    votacoes: [{ parte: 'mérito', resultado, vencidos: [], impedidos: [], ausentes: [], presidente: null, votos: [] }],
    quorum: { presentes: [], vencidos: [], voto_desempate: null, declaracoes_de_voto: [] },
    documentos: it.url_pdf ? [{ titulo: 'Inteiro teor (relatório, voto e acórdão) — PDF', url: it.url_pdf }] : [],
    situacao_conferencia: 'automatico-estruturado',
    fontes,
    lacunas,
  };

  if (natureza === 'parecer-previo') {
    const cur = def.exercicio ? lerCuradoriaParecer(def.exercicio) : null;
    j.parecer = {
      contas_de: 'Presidente da República',
      exercicio: def.exercicio ?? null,
      conclusao: cur?.conclusao ?? null,
      ressalvas: cur?.ressalvas ?? [],
      alertas: cur?.alertas ?? [],
      ...(cur?.recomendacoes?.length ? { recomendacoes: cur.recomendacoes } : {}),
      origem: cur ? cur.origem : null,
      documento: cur?.documento ?? null,
    };
    if (cur) {
      if (cur.acordao_key !== it.id) lacunas.push(`Curadoria do parecer aponta outra KEY (${cur.acordao_key}); conferir.`);
      if (!fontes.some((f) => f.url === cur.documento.url)) fontes.push({ titulo: cur.documento.titulo, url: cur.documento.url, orgao: 'Tribunal de Contas da União', acessado_em: cur.documento.acessado_em });
      for (const l of cur.lacunas || []) lacunas.push(l);
    } else {
      lacunas.push('Conclusão, ressalvas e alertas do parecer prévio: a API traz só o sumário; o texto do parecer ainda não foi copiado do inteiro teor por curadoria.');
    }
    j.julgamento_politico = julgamentoPolitico ?? null;
    if (!julgamentoPolitico) lacunas.push('Situação do julgamento das contas pelo Congresso Nacional: não obtida nesta coleta.');
    else for (const l of julgamentoPolitico.lacunas || []) lacunas.push(l);
  }
  return j;
}

/** contas-do-presidente.json: um registro por exercício (acórdão do TCU, conclusão literal e Congresso). */
export function resumoContas(contas, julgamentos, congresso, hoje) {
  const exercicios = [...contas.itens, ...contas.somente_congresso].map((c) => {
    const j = c.key ? julgamentos.get(c.key) : null;
    const jp = congresso.get(`MCN ${c.mcn.numero}/${c.mcn.ano}`) ?? null;
    const lacunas = [];
    if (!c.key) lacunas.push(`Acórdão do TCU sobre as contas de ${c.exercicio}: anterior a 2025, fora do período coletado da API.`);
    else if (!j) lacunas.push(`Acórdão ${c.numero}/${c.ano} não encontrado no índice da API.`);
    return {
      exercicio: c.exercicio,
      acordao: j ? { id: j.id, numero: j.numero, orgao: j.orgao, data_julgamento: j.data_julgamento, relator: j.relator, url: j.processo.url } : null,
      conclusao_parecer: j?.parecer?.conclusao ?? null,
      julgamento_politico: jp,
      lacunas,
    };
  }).sort((a, b) => a.exercicio.localeCompare(b.exercicio));
  return {
    atualizado_em: hoje,
    tribunal: 'tcu',
    descricao: 'Contas do Presidente da República: o TCU emite parecer prévio (art. 71, I, da Constituição) e o Congresso Nacional julga as contas (art. 49, IX), a partir da Mensagem do Congresso Nacional (MCN) que as encaminha.',
    exercicios,
  };
}
