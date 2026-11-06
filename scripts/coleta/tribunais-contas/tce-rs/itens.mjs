// Montagem dos itens de parecer prévio (formato de dados/esquema.json, natureza "parecer-previo") a partir de uma
// decisão dos dados abertos, do documento correspondente da pesquisa de jurisprudência e da página do Governador.
// Só campos literais das fontes; o que falta vira lacuna.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, chaveNome, slug, hojeISO, fonte } from './lib.mjs';
import { pareceresDaDecisao, PAGINA_PESQUISA } from './fontes.mjs';

export const NOME_TRIBUNAL = 'Tribunal de Contas do Estado do Rio Grande do Sul';
export const CASA_ESTADUAL = 'Assembleia Legislativa do Estado do Rio Grande do Sul';

const LACUNAS_COMUNS = [
  'Ressalvas e recomendações: só nos documentos oficiais da decisão (links)',
  'Votação (unanimidade ou maioria) não informada nos dados abertos',
  'Data do trânsito em julgado não informada',
  'Recursos posteriores (embargos) não acompanhados',
];

export function fonteJuris(doc) {
  return fonte('Pesquisa de Jurisprudência do TCE-RS — exercício, relator e links', PAGINA_PESQUISA);
}

function documentosJuris(doc) {
  const docs = [];
  if (doc?.link_decisao) docs.push({ titulo: 'Decisão (visualizador do TCE-RS)', url: doc.link_decisao });
  if (doc?.link_relatorio_voto && doc.link_relatorio_voto !== doc.link_decisao) docs.push({ titulo: 'Relatório e voto (visualizador do TCE-RS)', url: doc.link_relatorio_voto });
  return docs;
}

/** Base comum de um item ligado a uma decisão (dec normalizada) e ao documento da jurisprudência (doc ou null). */
function base({ id, titulo, contasDe, exercicio, dec, doc, fonteDec }) {
  return {
    id,
    tribunal: 'tce-rs',
    natureza: 'parecer-previo',
    titulo,
    processo: { classe: dec?.tipo_processo ?? null, numero: doc?.processo_formatado ?? dec?.nr_processo ?? null, url: null },
    orgao: dec?.orgao_julgador ?? null,
    sessao_literal: dec ? [dec.tipo_sessao ? `Sessão ${String(dec.tipo_sessao).toLowerCase()}` : 'Sessão', dec.numero_sessao ? `nº ${dec.numero_sessao}` : null, dec.ano_sessao ? `de ${dec.ano_sessao}` : null].filter(Boolean).join(' ') : null,
    relator: doc?.relator ?? null,
    data_julgamento: dec?.data_sessao ?? null,
    data_publicacao: doc?.data_publicacao ?? null,
    data_transito_em_julgado: null,
    responsaveis_literal: [],
    parecer: { conclusao: null, conclusao_literal: null, ressalvas: [], alertas: [], contas_de: contasDe, exercicio: String(exercicio), documento: null },
    julgamento_politico: null,
    documentos: documentosJuris(doc),
    situacao_conferencia: 'automatico-estruturado',
    coletado_em: hojeISO(),
    ano_sessao: dec?.ano_sessao ?? null,
    fontes: [fonteDec ? { titulo: fonteDec.titulo, url: fonteDec.url, orgao: fonteDec.orgao, acessado_em: fonteDec.acessado_em } : null, doc ? fonteJuris(doc) : null].filter(Boolean),
    lacunas: [],
  };
}

function lacunasDecisao(item, dec, doc, casa) {
  const { errata } = pareceresDaDecisao(dec.decisao);
  if (errata) item.lacunas.push('O campo da decisão traz anotação de errata ou retificação na fonte; o texto copiado é o do arquivo de dados abertos');
  if (!doc) item.lacunas.push('Documento da decisão não localizado na pesquisa de jurisprudência para esta sessão; relator e links não informados');
  item.lacunas.push(...LACUNAS_COMUNS, `Julgamento pela ${casa} não coletado`);
}

/* ---------- Prefeitos ---------- */

/**
 * Itens de uma decisão municipal, um por responsável com parecer (o TCE-RS emite um parecer para cada pessoa
 * que exerceu o cargo no exercício). Retorna [] se a decisão não traz parecer por responsável.
 */
export function itensMunicipais(mun, exercicio, dec, doc, fonteDec) {
  const { pareceres } = pareceresDaDecisao(dec.decisao);
  const casa = `Câmara Municipal de ${mun.nome}`;
  return pareceres.map((p) => {
    const item = base({
      id: `tce-rs-contas-prefeito-${mun.id}-${exercicio}-${dec.nr_processo}-${dec.data_sessao}-${slug(p.nome)}`,
      titulo: `Parecer do TCE-RS sobre as contas de ${p.nome} (Executivo Municipal de ${mun.nome}) — exercício ${exercicio}`,
      contasDe: `Executivo Municipal de ${mun.nome} (responsável: ${p.nome})`,
      exercicio, dec, doc, fonteDec,
    });
    item.processo.codigo_dados_abertos = dec.nr_processo;
    item.unidade_jurisdicionada_literal = dec.nome_orgao;
    item.responsaveis_literal = [p.nome];
    item.parecer.conclusao = p.parecer;
    item.parecer.conclusao_literal = p.parecer ? `${p.nome}: ${p.parecer}` : `${p.nome}: ${p.todos.join('; ')}`;
    if (!p.parecer) item.lacunas.push(`A decisão traz mais de uma linha de parecer para o mesmo responsável (${p.todos.join('; ')}); resumo deixado em branco`);
    if (p.outras.length) item.outras_deliberacoes_literal = p.outras;
    lacunasDecisao(item, dec, doc, casa);
    return item;
  });
}

const ordemItem = (a, b) => b.parecer.exercicio.localeCompare(a.parecer.exercicio) || (b.data_julgamento ?? '').localeCompare(a.data_julgamento ?? '') || a.id.localeCompare(b.id);

/** Arquivo contas-prefeitos/<municipio>.json (itens novos dos anos processados + itens antigos dos demais anos). */
export function montarArquivoMunicipio(mun, existente, novos, anosProcessados) {
  const antigos = (existente?.itens ?? []).filter((i) => !anosProcessados.has(Number(i.ano_sessao)));
  const ids = new Set(novos.map((i) => i.id));
  const itens = [...novos, ...antigos.filter((i) => !ids.has(i.id))].sort(ordemItem);
  const exercicios = [...new Set(itens.map((i) => Number(i.parecer.exercicio)))].sort((a, b) => a - b);
  const porUrl = new Map();
  for (const f of itens.flatMap((i) => i.fontes)) if (/dados\.tce\.rs\.gov\.br/.test(f.url) && !porUrl.has(f.url)) porUrl.set(f.url, f);
  const fontesUsadas = [...porUrl.values()].sort((a, b) => b.url.localeCompare(a.url));
  return {
    atualizado_em: new Date().toISOString(),
    municipio: { id: mun.id, nome: mun.nome, uf: 'RS', codigo_ibge: mun.codigo_ibge },
    tribunal: 'tce-rs',
    periodo: exercicios.length ? { inicio: exercicios[0], fim: exercicios[exercicios.length - 1] } : undefined,
    contagens: {
      exercicios: exercicios.length,
      pareceres: itens.length,
      com_parecer_em_fonte_aberta: itens.filter((i) => i.parecer.conclusao).length,
      sem_fonte_aberta: itens.filter((i) => !i.parecer.conclusao).length,
    },
    fontes: [...fontesUsadas, fonteJuris(null)],
    observacoes: [
      'O parecer de cada responsável é copiado literalmente do campo "DECISAO" dos arquivos anuais de decisões do Portal de Dados Abertos do TCE-RS (processos de contas de governo do Executivo Municipal: "Contas Anuais", "Contas de Governo" e "Processo de Contas - Executivo").',
      'O TCE-RS emite um parecer para cada pessoa que exerceu o cargo no exercício (por exemplo, prefeito e vice-prefeito); cada parecer aparece separado, com o nome como está na decisão.',
      'O exercício das contas vem do campo "Exercício" da pesquisa de jurisprudência do TCE-RS para o mesmo processo; decisões sem exercício nessa base não são mostradas e entram como lacuna no registro do coletor.',
      'O julgamento das contas é feito pela Câmara Municipal; ainda não coletado.',
    ],
    itens,
  };
}

/** Municípios do RS (lista oficial do Siconfi/Tesouro em dados/municipios/entes.json), indexados pelo nome exato. */
export function carregarMunicipiosRS(arquivo = path.join(RAIZ, 'dados', 'municipios', 'entes.json')) {
  const d = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const idx = Object.fromEntries(d.campos.map((c, i) => [c, i]));
  const lista = d.itens.filter((x) => x[idx.uf] === 'rs').map((x) => ({ id: x[idx.slug], nome: x[idx.nome], codigo_ibge: String(x[idx.cod_ibge]) }));
  if (lista.length < 490) throw new Error(`lista de municípios do RS incompleta (${lista.length})`);
  const porNome = new Map();
  for (const m of lista) {
    const k = chaveNome(m.nome);
    if (porNome.has(k)) throw new Error(`nome de município repetido no RS: ${m.nome}`);
    porNome.set(k, m);
  }
  return { lista, porNome, fonte: d.fonte };
}

/** Município de "PM DE X" (dados abertos) ou "EXECUTIVO MUNICIPAL DE X" (jurisprudência), só por igualdade exata. */
export function municipioDoOrgao(nome, porNome) {
  const m = String(nome ?? '').trim().match(/^(?:PM|EXECUTIVO MUNICIPAL) DE (.+)$/i);
  return m ? porNome.get(chaveNome(m[1])) ?? null : null;
}

/* ---------- Governador ---------- */

/** Item de um exercício do Governador. linha: linha da página; dec/doc: decisão e documento da jurisprudência (ou null). */
export function itemGovernador(linha, dec, doc, fonteDec, fontePagina) {
  const ex = linha.exercicio;
  const item = base({
    id: `tce-rs-contas-governador-${ex}`,
    titulo: `Parecer prévio do ${NOME_TRIBUNAL} sobre as contas do Governador — exercício ${ex}`,
    contasDe: 'Governador do Rio Grande do Sul',
    exercicio: ex, dec, doc, fonteDec,
  });
  if (fontePagina) item.fontes.unshift(fontePagina);
  item.processo.numero = linha.processo_formatado ?? item.processo.numero;
  item.processo.url = linha.processo_url;
  if (!item.processo.classe) item.processo.classe = 'Contas do Governador (parecer prévio)';
  item.governador_literal = linha.governador_literal;
  item.documentos = [...linha.arquivos.map((a) => ({ titulo: `${a.titulo} — exercício ${ex} (PDF)`, url: a.url })), ...item.documentos];
  if (linha.processo_url) item.documentos.push({ titulo: `Processo ${linha.processo_formatado ?? ''} na consulta processual do TCE-RS`.replace(/\s+/g, ' '), url: linha.processo_url });
  if (!dec) {
    if (linha.situacao_literal) item.situacao_processo_literal = linha.situacao_literal;
    item.lacunas.push(linha.situacao_literal
      ? `Parecer prévio na situação "${linha.situacao_literal}" na página oficial do TCE-RS até a coleta`
      : 'Decisão com o parecer não localizada nos arquivos anuais de decisões do Portal de Dados Abertos (publicados a partir das sessões de 2011); o parecer está no PDF oficial do exercício');
    item.lacunas.push(`Julgamento das contas pela ${CASA_ESTADUAL} não localizado nos dados coletados`);
    return item;
  }
  const { pareceres } = pareceresDaDecisao(dec.decisao);
  item.responsaveis_literal = pareceres.map((p) => p.nome);
  const valores = [...new Set(pareceres.map((p) => p.parecer))];
  item.parecer.conclusao = valores.length === 1 ? valores[0] : null;
  item.parecer.conclusao_literal = pareceres.map((p) => `${p.nome}: ${p.parecer ?? p.todos.join('; ')}`).join('; ');
  if (valores.length > 1) item.lacunas.push('A decisão traz pareceres diferentes para os responsáveis do exercício; o resumo fica em branco e o texto de cada um está na conclusão literal');
  lacunasDecisao(item, dec, doc, CASA_ESTADUAL);
  return item;
}
