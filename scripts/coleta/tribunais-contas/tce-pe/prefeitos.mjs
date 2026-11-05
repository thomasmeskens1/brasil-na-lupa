// Contas dos Prefeitos: entidade "Resultados" filtrada por Tipo=Governo e exercício; a esfera municipal (M) é filtrada aqui.
// Um arquivo por município, com um item por exercício (de PRIMEIRO_EXERCICIO até o ano anterior ao atual).
// O nome do município é o literal do campo MunicipioUJPrincipalProcesso; nenhum nome é casado por semelhança.
import { consultar, fonte, slug } from './lib.mjs';
import { normalizarRegistro, agruparPorProcesso, resumirProcesso, montarItem, ordenarProcessos, NOME_TRIBUNAL, URL_DOC_RESULTADOS } from './parecer.mjs';

const UJ_PREFEITURA = /^Prefeitura (Municipal|da Cidade)\b/i;

/** Resultados municipais de contas de governo de um exercício (~190 registros, ~150 KB). */
export async function baixarExercicioMunicipal(exercicio) {
  const { url, conteudo } = await consultar('Resultados', { Tipo: 'Governo', ExercicioPrincipalProcesso: exercicio });
  const todos = conteudo.map(normalizarRegistro);
  const regs = todos.filter((r) => r.esfera === 'M' && r.tipo === 'Governo' && r.exercicio === exercicio && r.municipio && UJ_PREFEITURA.test(r.uj));
  return { exercicio, url, regs, descartados: todos.length - regs.length };
}

/** Itens de um município num exercício, a partir dos registros baixados. */
export function itemMunicipio(mun, exercicio, regs, urlConsulta) {
  const doMun = regs.filter((r) => r.municipio === mun.nome && r.exercicio === exercicio && r.esfera === 'M' && r.tipo === 'Governo' && UJ_PREFEITURA.test(r.uj));
  const resumos = ordenarProcessos([...agruparPorProcesso(doMun).values()].map(resumirProcesso));
  const item = montarItem({
    id: `tce-pe-contas-prefeito-${mun.id}-${exercicio}`,
    titulo: `Parecer prévio do ${NOME_TRIBUNAL} sobre as contas do Prefeito de ${mun.nome} — exercício ${exercicio}`,
    contasDe: `Prefeito de ${mun.nome}`,
    exercicio,
    resumo: resumos[0] ?? null,
    outros: resumos.slice(1),
    urlConsulta,
    casaJulgadora: `Câmara Municipal de ${mun.nome}`,
    comDocumentos: false, // o link do parecer fica em parecer.documento e o do processo em processo.url
    lacunaSemRegistro: 'Parecer prévio não encontrado na API de Dados Abertos do TCE-PE (entidade "Resultados", que lista processos eletrônicos julgados) até a coleta',
  });
  const ujs = [...new Set(doMun.map((r) => r.uj))];
  if (ujs.length) item.unidade_jurisdicionada_literal = ujs.length === 1 ? ujs[0] : ujs;
  return item;
}

/** Junta os itens novos aos já gravados (exercícios não baixados nesta execução são mantidos). */
export function montarArquivoMunicipio(mun, existente, novosPorAno, periodo) {
  const antigos = new Map((existente?.itens ?? []).map((i) => [Number(i.parecer?.exercicio), i]));
  const itens = [];
  for (let ano = periodo.inicio; ano <= periodo.fim; ano++) {
    const novo = novosPorAno.get(ano);
    // Exercício nunca baixado (nem nesta execução nem antes) fica de fora até ser coletado.
    if (novo) itens.push(novo);
    else if (antigos.has(ano)) itens.push(antigos.get(ano));
  }
  const validos = itens;
  const anos = validos.map((i) => Number(i.parecer.exercicio));
  return {
    atualizado_em: new Date().toISOString(),
    municipio: { id: mun.id, nome: mun.nome, uf: 'PE' },
    tribunal: 'tce-pe',
    periodo: anos.length ? { inicio: Math.min(...anos), fim: Math.max(...anos) } : periodo,
    contagens: {
      exercicios: validos.length,
      com_parecer_em_fonte_aberta: validos.filter((i) => i.parecer.conclusao).length,
      sem_fonte_aberta: validos.filter((i) => !i.parecer.conclusao).length,
    },
    fontes: [
      fonte('API de Dados Abertos do TCE-PE — entidade "Resultados" (documentação oficial)', URL_DOC_RESULTADOS),
    ],
    observacoes: [
      `Resultado de cada exercício copiado literalmente do campo "Resultado" da API de Dados Abertos do TCE-PE (processos eletrônicos de prestação de contas de governo, a partir do exercício de ${anos.length ? Math.min(...anos) : periodo.inicio}).`,
      'Ressalvas, determinações e recomendações estão no documento do parecer prévio no e-TCE (link em cada exercício); o coletor não abre o documento.',
      'O julgamento das contas é feito pela Câmara Municipal; ainda não coletado.',
    ],
    itens: validos,
  };
}

/** Municípios presentes nos registros baixados ({ id, nome }), sem colisão de id. */
export function municipiosDosRegistros(regs) {
  const porId = new Map();
  for (const r of regs) {
    const id = slug(r.municipio);
    if (!id) continue;
    const ja = porId.get(id);
    if (ja && ja.nome !== r.municipio) throw new Error(`dois nomes de município geram o mesmo id "${id}": "${ja.nome}" e "${r.municipio}"`);
    porId.set(id, { id, nome: r.municipio });
  }
  return porId;
}
