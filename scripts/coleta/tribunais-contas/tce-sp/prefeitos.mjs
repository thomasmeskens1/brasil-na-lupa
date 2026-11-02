// Contas dos Prefeitos: conjunto de dados aberto "Pareceres" do TCE-SP (transparencia.tce.sp.gov.br),
// "Consolidação de todos os pareceres emitidos pelo Tribunal para as Contas de Prefeituras no período de 2008 a 2017".
// A pesquisa de pareceres de 2018 em diante fica em www10.tce.sp.gov.br, proibido pelo robots.txt: não é acessada.
import { obter, lerZip, sha256, fonte, dataISO } from './lib.mjs';

export const URL_PARECERES = 'https://transparencia.tce.sp.gov.br/sites/default/files/conjunto-dados/pareceres/pareceres.zip';
export const URL_CONJUNTOS = 'https://transparencia.tce.sp.gov.br/conjunto-de-dados';

// Municípios acompanhados (código IBGE oficial). Novos municípios entram aqui.
export const MUNICIPIOS = [{ id: 'atibaia', nome: 'Atibaia', codigo_ibge: '3504107' }];

export const LACUNA_LAI = 'Não disponível em fonte aberta; pedido via Lei de Acesso à Informação enviado ao TCE-SP';

const COLUNAS = ['codigo_ibge', 'municipio', 'exercicio', 'processo', 'parecer', 'voto_link', 'data_transito_julgado'];

/** Baixa o ZIP e devolve as linhas do CSV (ISO-8859-1, separador ';'). */
export async function baixarPareceres() {
  const r = await obter(URL_PARECERES, { tipo: 'bin' });
  const entradas = lerZip(r.corpo).filter((e) => /\.csv$/i.test(e.nome));
  if (entradas.length !== 1) throw new Error(`pareceres.zip: esperado 1 CSV, encontrados ${entradas.length}`);
  const texto = new TextDecoder('latin1').decode(entradas[0].conteudo).replace(/\r/g, '');
  const [cab, ...linhas] = texto.split('\n').filter((l) => l.trim());
  const cols = cab.split(';').map((c) => c.trim());
  if (COLUNAS.some((c, i) => cols[i] !== c)) throw new Error(`pareceres.csv: cabeçalho inesperado: ${cab}`);
  const registros = linhas.map((l) => {
    const v = l.split(';');
    return Object.fromEntries(cols.map((c, i) => [c, (v[i] ?? '').trim()]));
  });
  return {
    registros,
    sha256: sha256(r.corpo),
    last_modified: r.cabecalhos['last-modified'] || null,
    nome_csv: entradas[0].nome,
  };
}

/** Monta o arquivo de um município: um item julgamento/parecer por exercício. */
export function montarMunicipio(mun, base, ultimoExercicio) {
  const regs = base.registros.filter((r) => r.codigo_ibge === mun.codigo_ibge);
  const porAno = new Map(regs.map((r) => [Number(r.exercicio), r]));
  const anosBase = regs.map((r) => Number(r.exercicio));
  const primeiro = Math.min(2008, ...anosBase);
  const fonteBase = {
    ...fonte('Conjunto de dados "Pareceres" — Contas de Prefeituras 2008 a 2017 (Portal da Transparência do TCE-SP)', URL_PARECERES),
    pagina: URL_CONJUNTOS,
    sha256: base.sha256,
    atualizado_na_fonte: base.last_modified,
  };
  const itens = [];
  for (let ano = primeiro; ano <= ultimoExercicio; ano++) {
    const r = porAno.get(ano);
    const it = {
      id: `tce-sp-contas-prefeito-${mun.id}-${ano}`,
      tribunal: 'tce-sp',
      natureza: 'parecer-previo',
      titulo: `Parecer prévio do Tribunal de Contas do Estado de São Paulo sobre as contas do Prefeito de ${mun.nome} — exercício ${ano}`,
      processo: { classe: 'Contas de Prefeitura', numero: r ? r.processo : null, incidente_ou_registro: null, url: null },
      orgao: null,
      relator: null,
      data_julgamento: null,
      data_transito_em_julgado: r ? dataISO(r.data_transito_julgado) : null,
      parecer: {
        conclusao: r ? r.parecer : null,
        ressalvas: [],
        alertas: [],
        contas_de: `Prefeito de ${mun.nome}`,
        exercicio: String(ano),
      },
      link_voto_na_fonte: r && r.voto_link ? r.voto_link : null,
      julgamento_politico: null,
      // Sem linha no conjunto: a lacuna (ausência em fonte aberta) é o dado exibido.
      situacao_conferencia: 'automatico-estruturado',
      fontes: r ? [fonteBase] : [{
        ...fonte('Contas Anuais — aba "Contas Municipais (Parecer)" (consulta oficial no navegador)', 'https://www.tce.sp.gov.br/contas-anuais'),
        observacao: 'A consulta abre um serviço em www10.tce.sp.gov.br, proibido para robôs; não foi acessada pelo coletor',
      }],
      lacunas: [],
    };
    if (r) {
      it.lacunas.push('Data da sessão de julgamento e relator não constam no conjunto de dados; a data informada é a do trânsito em julgado');
      it.lacunas.push('Ressalvas e recomendações do parecer não constam no conjunto de dados');
      if (/^https?:\/\/www2\.tce\.sp\.gov\.br\//i.test(it.link_voto_na_fonte || '')) {
        it.lacunas.push('O link do voto informado pelo conjunto de dados aponta para www2.tce.sp.gov.br, que recusou acesso (HTTP 403) no teste de 02/11/2026; o documento não foi aberto');
      }
    } else {
      it.lacunas.push(LACUNA_LAI);
    }
    it.lacunas.push(`Julgamento das contas pela Câmara Municipal de ${mun.nome} não localizado nos dados coletados`);
    itens.push(it);
  }
  return {
    atualizado_em: new Date().toISOString(),
    municipio: { id: mun.id, nome: mun.nome, uf: 'SP', codigo_ibge: mun.codigo_ibge },
    tribunal: 'tce-sp',
    periodo: { inicio: primeiro, fim: ultimoExercicio },
    contagens: {
      exercicios: itens.length,
      com_parecer_em_fonte_aberta: itens.filter((i) => i.parecer.conclusao).length,
      sem_fonte_aberta: itens.filter((i) => !i.parecer.conclusao).length,
    },
    fontes: [fonteBase],
    observacoes: [
      'A consulta oficial de pareceres municipais (aba "Contas Municipais (Parecer)" de https://www.tce.sp.gov.br/contas-anuais) fica em www10.tce.sp.gov.br, cujo robots.txt proíbe robôs ("Disallow: /"); o coletor não a acessa.',
      'O conjunto de dados "Pareceres" não é atualizado desde 14/10/2020 (cabeçalho Last-Modified) e cobre os exercícios de 2008 a 2017. Se passar a trazer exercícios novos, o coletor os inclui automaticamente.',
    ],
    itens,
  };
}
