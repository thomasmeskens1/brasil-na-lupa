// Diário Oficial do Estado de SP (DOE-SP), caderno Executivo > Atos Normativos:
// Leis, Leis Complementares, Decretos, Veto Total e Veto Parcial (com as razões de veto, texto integral).
// API do próprio portal: https://do-api-web-search.doe.sp.gov.br (sem documentação pública; tratar como instável).
import { obter, htmlParaLinhas, normalizarNome } from './lib.mjs';
import { API as API_ALESP } from './plenario.mjs';

export const DOE = 'https://do-api-web-search.doe.sp.gov.br';
const JOURNAL_EXECUTIVO = 'ca96256b-6ca1-407f-866e-567ef9430123';
export const SECOES = [
  { id: 'ce12bd86-26e6-432d-e519-08db6b932348', tipo: 'Lei Complementar', nome: 'Leis Complementares' },
  { id: '7b2846f0-ea2b-4ce5-7d51-08db6b94d2bf', tipo: 'Lei', nome: 'Leis' },
  { id: '81f77c5c-d935-49ac-7d52-08db6b94d2bf', tipo: 'Decreto', nome: 'Decretos' },
  { id: '56624b88-ed11-4424-b5b6-08db6b943832', tipo: 'Veto Total', nome: 'Veto Total a Projeto de Lei' },
  { id: '25d1b21a-fb6c-4335-e51a-08db6b932348', tipo: 'Veto Parcial', nome: 'Veto Parcial a Projeto de Lei' },
];
const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

/** Lista as publicações de uma seção entre duas datas (paginado). */
export async function listarSecao(secao, de, ate) {
  const itens = [];
  for (let p = 1; p < 200; p++) {
    const url = `${DOE}/v2/advanced-search/publications?JournalId=${JOURNAL_EXECUTIVO}&SectionId=${secao.id}`
      + `&FromDate=${de}&ToDate=${ate}&PageNumber=${p}&PageSize=500`;
    const j = await obter(url);
    itens.push(...(j.items || []));
    if (!j.hasNextPage) break;
  }
  return itens;
}

/** "DE 28 DE OUTUBRO DE 2026" no título → 2026-10-28 */
function dataDoTitulo(t) {
  const m = /de\s+(\d{1,2})º?\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i.exec(normalizarNome(t).toLowerCase());
  if (!m || !MESES[m[2]]) return null;
  return `${m[3]}-${String(MESES[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
function numeroDoTitulo(t) {
  const m = /\bN[º°O.]*\s*([\d.]+\d)/i.exec(t);
  return m ? m[1] : null;
}
/** Projeto vetado: pelo título ("Projeto de Lei nº 1055/2025") ou pelo texto ("Projeto de lei nº 1055, de 2025"). */
function projetoVetado(titulo, linhas) {
  let m = /PROJETO DE LEI( COMPLEMENTAR)?\s+N[º°O.]*\s*([\d.]+)\s*\/\s*(\d{4})/i.exec(titulo);
  if (!m) {
    const txt = linhas.join(' ');
    m = /Projeto de lei( complementar)?\s+n[º°o.]*\s*([\d.]+),?\s+de\s+(\d{4})/i.exec(txt);
  }
  if (!m) return null;
  return { sigla: m[1] ? 'PLC' : 'PL', numero: Number(m[2].replace(/\./g, '')), ano: Number(m[3]) };
}

const INICIO_CORPO = /^(O GOVERNADOR|A GOVERNADORA|O VICE-GOVERNADOR|TARC[IÍ]SIO|Fa[çc]o saber|[A-ZÁÉÍÓÚÂÊÔÃÕÇ .]+, (Governador|GOVERNADOR|Vice-Governador))/;

/** Ementa: texto entre o cabeçalho e "O GOVERNADOR DO ESTADO..." (literal do documento). */
const ORIGEM = /^\(\s*Projeto de lei/i;
function ementaDe(linhas, titulo) {
  const tn = normalizarNome(titulo);
  const corpo = linhas.filter((l) => !/^SEI\s*\//i.test(l) && normalizarNome(l) !== tn && !ORIGEM.test(l));
  const i = corpo.findIndex((l) => INICIO_CORPO.test(l));
  if (i <= 0) return null;
  const antes = corpo.slice(0, i).filter((l) => !/^(DECRETO|LEI)( COMPLEMENTAR)?\s+N/i.test(l));
  const e = antes.join(' ').trim();
  return e && e.length <= 1500 ? e : null;
}

/** Monta o item do índice a partir do resultado da busca e do texto integral. */
export async function montarNorma(secao, it, hoje, cacheIds) {
  const slug = it.slug;
  const pub = await obter(`${DOE}/v2/publications/${slug}`, { opcional: true });
  const titulo = (pub?.title || it.title || '').replace(/\s+/g, ' ').trim();
  const linhas = pub ? htmlParaLinhas(pub.content) : [];
  const retificacao = /^RETIFICA/i.test(normalizarNome(titulo));
  const veto = secao.tipo.startsWith('Veto');
  const lacunas = [];
  const item = {
    id: it.id,
    tipo: secao.tipo,
    secao_doe: secao.nome,
    tipo_publicacao: pub?.publicationType || null,
    retificacao,
    titulo,
    numero: retificacao || veto ? null : numeroDoTitulo(titulo),
    data_ato: dataDoTitulo(titulo),
    data_publicacao: (pub?.date || it.date || '').slice(0, 10) || null,
    ementa: null,
    url: `https://doe.sp.gov.br/${slug}`,
  };
  if (!pub) lacunas.push('Texto integral não obtido nesta execução');
  if (!veto) {
    item.ementa = retificacao ? null : ementaDe(linhas, titulo);
    // Leis: linha literal "(Projeto de lei n.º 770, de 2025, dos Deputados ...)" indica o projeto de origem.
    const origem = linhas.find((l) => ORIGEM.test(l));
    if (origem && !retificacao) {
      const m = /^\(\s*Projeto de lei( complementar)?\s+n[º°o.]*\s*([\d.]+),?\s+de\s+(\d{4})/i.exec(origem);
      item.projeto_origem = m ? { sigla: m[1] ? 'PLC' : 'PL', numero: Number(m[2].replace(/\./g, '')), ano: Number(m[3]) } : null;
      item.projeto_origem_texto = origem.length <= 6000 ? origem : null;
    }
    if (!item.ementa && !retificacao) lacunas.push('Ementa não identificada automaticamente no texto oficial; ver o documento no link');
    if (retificacao) item.texto = linhas.filter((l) => !/^SEI\s*\//i.test(l)).join('\n') || null;
  } else {
    const proj = projetoVetado(titulo, linhas);
    if (proj) {
      const chave = `${proj.sigla}-${proj.numero}-${proj.ano}`;
      if (!cacheIds.has(chave)) {
        const idTipo = proj.sigla === 'PLC' ? 2 : 1;
        let id = null;
        try {
          id = await obter(`${API_ALESP}/processo/id-por-tipo-numero-ano?idTipoProcesso=${idTipo}&numero=${proj.numero}&ano=${proj.ano}`, { tipo: 'text', opcional: true });
        } catch { id = null; }
        cacheIds.set(chave, id && /^\d+$/.test(id.trim()) ? id.trim() : null);
      }
      const idAlesp = cacheIds.get(chave);
      item.projeto = {
        ...proj,
        id_alesp: idAlesp,
        url_alesp: idAlesp ? `https://www.al.sp.gov.br/propositura/${idAlesp}` : null,
      };
      if (!idAlesp) lacunas.push('Projeto vetado não localizado na base da ALESP pelo número');
    } else {
      item.projeto = null;
      lacunas.push('Número do projeto vetado não identificado automaticamente; ver o documento no link');
    }
    const corpo = linhas.filter((l) => !/^SEI\s*\//i.test(l));
    item.razoes_veto = corpo.length ? corpo.join('\n') : null;
    item.razoes_documento = 'Mensagem do Governador à Assembleia Legislativa com as razões do veto (texto integral publicado no DOE)';
    if (!item.razoes_veto) lacunas.push('Razões do veto não publicadas no texto obtido');
  }
  item.fonte = {
    titulo: `Diário Oficial do Estado de São Paulo — ${titulo}`,
    url: item.url,
    url_dados: `${DOE}/v2/publications/${slug}`,
    orgao: 'Diário Oficial do Estado de São Paulo (Imprensa Oficial / Governo do Estado)',
    acessado_em: hoje,
  };
  if (lacunas.length) item.lacunas = lacunas;
  return item;
}
