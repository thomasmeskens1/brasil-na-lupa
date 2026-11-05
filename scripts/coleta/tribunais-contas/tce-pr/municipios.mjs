// Municípios do Paraná (lista oficial do Siconfi/Tesouro em dados/municipios/entes.json) e montagem do
// arquivo contas-prefeitos/<municipio>.json. A entidade do CSV ("MUNICÍPIO DE X") é casada com o nome
// oficial só por igualdade exata depois de tirar acentos, maiúsculas e a forma do apóstrofo (D'OESTE = D´OESTE
// = D OESTE); grafias diferentes (ex.: MELLO/MELO) não são casadas e ficam registradas no meta.json.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, normalizar } from './lib.mjs';
import { municipioDaEntidade } from './extrair.mjs';
import { consolidar, herdarLeitura } from './itens.mjs';

/** Chave de comparação: normalizada, com qualquer apóstrofo trocado por espaço. */
export const chaveNome = (s) => normalizar(String(s || '').replace(/['’‘´`]/g, ' '));

export const ARQ_ENTES = path.join(RAIZ, 'dados', 'municipios', 'entes.json');

export function carregarMunicipiosPR(arquivo = ARQ_ENTES) {
  const d = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const idx = Object.fromEntries(d.campos.map((c, i) => [c, i]));
  const lista = d.itens
    .filter((x) => x[idx.uf] === 'pr')
    .map((x) => ({ id: x[idx.slug], nome: x[idx.nome], codigo_ibge: String(x[idx.cod_ibge]) }));
  if (lista.length < 390) throw new Error(`lista de municípios do PR incompleta (${lista.length})`);
  const porNome = new Map();
  for (const m of lista) {
    const k = chaveNome(m.nome);
    if (porNome.has(k)) throw new Error(`nome de município repetido no PR: ${m.nome}`);
    porNome.set(k, m);
  }
  return { lista, porNome, fonte: d.fonte };
}

/** Município da entidade do CSV, ou null (não casado). */
export function casarMunicipio(entidade, porNome) {
  const nome = municipioDaEntidade(entidade, chaveNome);
  return nome ? porNome.get(nome) || null : null;
}

const ordemItem = (a, b) => (b.parecer.exercicio || '').localeCompare(a.parecer.exercicio || '')
  || (b.data_julgamento || '').localeCompare(a.data_julgamento || '') || a.id.localeCompare(b.id);

/**
 * Mescla os itens novos (anos do CSV processados por completo nesta execução) com os do arquivo antigo
 * (demais anos). Itens antigos de anos reprocessados são descartados; a leitura de PDF é herdada.
 */
export function mesclar(antigos, novos, anosProcessados) {
  const porId = new Map(antigos.map((i) => [i.id, i]));
  const ficam = antigos.filter((i) => !anosProcessados.has(i.ano_arquivo_fonte));
  const ids = new Set(ficam.map((i) => i.id));
  const out = [...ficam];
  for (const n of novos) {
    if (ids.has(n.id)) continue;
    ids.add(n.id);
    out.push(herdarLeitura(n, porId.get(n.id)));
  }
  return out;
}

export function mesclarRelacionados(antigos, novos, anosProcessados) {
  const out = (antigos || []).filter((r) => !anosProcessados.has(r.ano_arquivo_fonte));
  const urls = new Set(out.map((r) => r.url));
  for (const n of novos) if (!urls.has(n.url)) { urls.add(n.url); out.push(n); }
  return out.sort((a, b) => (b.data_sessao || '').localeCompare(a.data_sessao || ''));
}

/** Arquivo do município no formato ContasPrefeitos. todos: itens (com ou sem exercício). */
export function montarArquivoMunicipio(mun, todos, relacionados, fontesCsv) {
  const casa = `Câmara Municipal de ${mun.nome}`;
  for (const it of todos) consolidar(it, { casaPolitica: casa });
  const itens = todos.filter((i) => i.parecer.exercicio).sort(ordemItem);
  const semEx = todos.filter((i) => !i.parecer.exercicio).sort(ordemItem);
  const exercicios = [...new Set(itens.map((i) => Number(i.parecer.exercicio)))].sort((a, b) => a - b);
  const anosFonte = [...new Set(todos.map((i) => i.ano_arquivo_fonte))];
  const observacoes = [
    'Fonte: arquivos anuais de acórdãos do portal de dados abertos do TCE-PR (Viajuris), atos "Parecer Prévio" e "Acórdão de Parecer Prévio" da classe "Prestação de contas do prefeito municipal". Um item por ato; um mesmo exercício pode ter mais de um parecer quando a fonte assim registra.',
    'A conclusão é copiada literalmente da deliberação do inteiro teor (PDF) ou, na falta, do resumo do conjunto de dados; quando nenhum dos dois traz a conclusão, ela fica vazia. O campo "indexacao_literal" reproduz os termos de indexação do TCE-PR e não é o texto do parecer.',
    'O exercício das contas vem do texto da deliberação do PDF ou dos campos "DsTema"/"DsResumo" do conjunto de dados; sem ele, o ato fica em "itens_sem_exercicio".',
  ];
  return {
    atualizado_em: new Date().toISOString(),
    municipio: { id: mun.id, nome: mun.nome, uf: 'PR', codigo_ibge: mun.codigo_ibge },
    tribunal: 'tce-pr',
    periodo: exercicios.length ? { inicio: exercicios[0], fim: exercicios[exercicios.length - 1] } : undefined,
    contagens: {
      exercicios: exercicios.length,
      pareceres: todos.length,
      com_parecer_em_fonte_aberta: itens.filter((i) => i.parecer.conclusao).length,
      sem_fonte_aberta: itens.filter((i) => !i.parecer.conclusao).length,
      com_pdf: todos.filter((i) => i.parecer.documento).length,
      pdf_lido: todos.filter((i) => i.leitura_pdf?.situacao === 'lido').length,
      sem_exercicio_na_fonte: semEx.length,
    },
    fontes: fontesCsv.filter((f) => anosFonte.includes(f.ano)).map(({ ano, ...f }) => f),
    observacoes,
    itens,
    itens_sem_exercicio: semEx,
    acordaos_relacionados: relacionados,
  };
}

