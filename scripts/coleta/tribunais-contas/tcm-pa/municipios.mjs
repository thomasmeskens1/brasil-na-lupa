// Municípios do Pará (lista oficial do Siconfi/Tesouro em dados/municipios/entes.json), casamento do
// nome escrito na resolução com o nome oficial e montagem dos itens e arquivos por município.
// Casamento só por igualdade exata depois de tirar acentos, maiúsculas, espaços e a forma do apóstrofo
// (PAU D'ARCO = PAU D´ARCO) e do hífen (TOMÉ-AÇU = TOMÉ AÇU); grafias diferentes não são casadas e ficam registradas no meta.json.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, normalizar, fonte } from './lib.mjs';
import { URL_PAGINA_DOE } from './edicoes.mjs';

export const chaveNome = (s) => normalizar(String(s || '').replace(/['’‘´`\-–]/g, ' ')).replace(/\s+/g, ' ');

export const ARQ_ENTES = path.join(RAIZ, 'dados', 'municipios', 'entes.json');

export function carregarMunicipiosPA(arquivo = ARQ_ENTES) {
  const d = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const idx = Object.fromEntries(d.campos.map((c, i) => [c, i]));
  const lista = d.itens
    .filter((x) => x[idx.uf] === 'pa')
    .map((x) => ({ id: x[idx.slug], nome: x[idx.nome], codigo_ibge: String(x[idx.cod_ibge]) }));
  if (lista.length !== 144) throw new Error(`lista de municípios do PA com ${lista.length} itens (esperado 144)`);
  const porNome = new Map();
  for (const m of lista) {
    const k = chaveNome(m.nome);
    if (porNome.has(k)) throw new Error(`nome de município repetido no PA: ${m.nome}`);
    porNome.set(k, m);
  }
  return { lista, porNome, fonte: d.fonte };
}

export const casarMunicipio = (nome, porNome) => (nome ? porNome.get(chaveNome(nome)) || null : null);

const fmtNumero = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Item no formato ParecerPrevioTce (web/src/features/tribunais-contas/tipos.ts). */
export function montarItem(p, mun, edicao) {
  const contasDe = `Prefeito de ${mun.nome}`;
  const lacunas = [
    'Ressalvas, multas e determinações não foram separadas do texto: estão na resolução publicada no Diário Oficial Eletrônico (link da fonte)',
    'Resultado da votação (unanimidade ou maioria) não foi separado do texto',
    `Julgamento das contas pela Câmara Municipal de ${mun.nome} não coletado`,
  ];
  const dataJulg = p.data_resolucao || p.data_sessao || null;
  if (!dataJulg) {
    lacunas.unshift(p.sessao_literal
      ? `A resolução registra a sessão "${p.sessao_literal}"; a data exata do julgamento não consta`
      : 'Data do julgamento não escrita na publicação');
  }
  if (!p.processo) lacunas.push('Número do processo não escrito na publicação');
  if (!p.relator) lacunas.push('Relator não escrito na publicação');
  if (p.citacao) lacunas.push('Texto lido da transcrição desta resolução dentro de outra publicação do Diário Oficial Eletrônico');
  if (p.recurso) lacunas.push('Decisão em recurso: a resolução original sobre o mesmo exercício pode estar em outra publicação');
  const doc = {
    titulo: `Diário Oficial Eletrônico do TCM-PA — ${edicao.titulo}, de ${edicao.data.split('-').reverse().join('/')} (PDF)`,
    url: edicao.url,
    sha256: edicao.sha256 || null,
  };
  return {
    id: `tcm-pa-resolucao-${p.numero}`,
    tribunal: 'tcm-pa',
    natureza: 'parecer-previo',
    titulo: `Resolução nº ${fmtNumero(p.numero)} do TCM-PA — parecer prévio sobre as contas de governo de ${mun.nome}${p.recurso ? ' (recurso)' : ''} — exercício ${p.exercicio}`,
    ato: { tipo: 'Resolução', numero: p.numero, titulo_oficial: p.numero_literal },
    processo: { classe: p.recurso ? (p.assunto_literal || 'Recurso') : (p.assunto_literal || 'Prestação de contas de governo'), numero: p.processo, url: null },
    orgao: null,
    relator: p.relator,
    data_julgamento: dataJulg,
    data_resolucao: p.data_resolucao,
    sessao_literal: p.sessao_literal,
    data_publicacao: edicao.data,
    recurso: p.recurso,
    parecer: {
      conclusao: p.conclusao,
      com_ressalvas: /ressalva/i.test(`${p.conclusao || ''} ${p.conclusao_literal || ''}`),
      conclusao_literal: p.conclusao_literal,
      ressalvas: [],
      alertas: [],
      contas_de: contasDe,
      exercicio: p.exercicio,
      documento: doc,
    },
    ementa_literal: p.ementa_literal,
    municipio_literal: p.municipio_literal,
    unidade_jurisdicionada_literal: p.orgao_literal,
    publicacao: { edicao: edicao.titulo, data: edicao.data, url: edicao.url, transcricao: p.citacao },
    julgamento_politico: null,
    situacao_conferencia: 'automatico-texto-pdf',
    coletado_em: edicao.lido_em || null,
    fontes: [fonte(doc.titulo, edicao.url, edicao.lido_em || undefined), fonte('Diário Oficial Eletrônico — Tribunal de Contas dos Municípios do Pará', URL_PAGINA_DOE, edicao.lido_em || undefined)],
    lacunas,
  };
}

/** Prefere a publicação própria à transcrição; entre iguais, a mais antiga. */
export function preferir(a, b) {
  if (!a) return b;
  if (a.publicacao.transcricao !== b.publicacao.transcricao) return a.publicacao.transcricao ? b : a;
  return (b.publicacao.data || '') < (a.publicacao.data || '') ? b : a;
}

const ordemItem = (a, b) => (b.parecer.exercicio || '').localeCompare(a.parecer.exercicio || '')
  || (b.data_julgamento || b.data_publicacao || '').localeCompare(a.data_julgamento || a.data_publicacao || '') || a.id.localeCompare(b.id);

/** Arquivo do município no formato ContasPrefeitos. */
export function montarArquivoMunicipio(mun, itens, periodoEdicoes = null) {
  const lista = [...itens].sort(ordemItem);
  const exercicios = [...new Set(lista.map((i) => Number(i.parecer.exercicio)))].sort((a, b) => a - b);
  return {
    atualizado_em: new Date().toISOString(),
    municipio: { id: mun.id, nome: mun.nome, uf: 'PA', codigo_ibge: mun.codigo_ibge },
    tribunal: 'tcm-pa',
    periodo: exercicios.length ? { inicio: exercicios[0], fim: exercicios[exercicios.length - 1] } : undefined,
    contagens: {
      exercicios: exercicios.length,
      pareceres: lista.length,
      com_parecer_em_fonte_aberta: lista.filter((i) => i.parecer.conclusao).length,
      sem_fonte_aberta: lista.filter((i) => !i.parecer.conclusao).length,
      recursos: lista.filter((i) => i.recurso).length,
    },
    fontes: [fonte('Diário Oficial Eletrônico — Tribunal de Contas dos Municípios do Pará', URL_PAGINA_DOE)],
    observacoes: [
      `Fonte: resoluções de parecer prévio sobre a prestação de contas de governo da Prefeitura publicadas no Diário Oficial Eletrônico do TCM-PA (edições em PDF listadas no site${periodoEdicoes ? `, ${periodoEdicoes}` : ""}).`,
      'Conclusão, exercício, processo, relator e datas são copiados do texto da resolução; o CPF de pessoas foi retirado. Um item por resolução: um exercício pode ter mais de uma (por exemplo, a decisão de um recurso).',
      'Resoluções sem exercício escrito, ou com exercícios diferentes no mesmo texto, não aparecem aqui e estão contadas no registro da coleta.',
    ],
    itens: lista,
  };
}
