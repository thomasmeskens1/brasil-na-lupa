// Endereços e leitura das fontes oficiais do STF usadas pelo coletor.
// NÃO usa nada em portal.stf.jus.br/processos/* (bloqueado pelo robots.txt); essas URLs aparecem só como
// link público para o leitor (detalhe.asp), nunca são acessadas. A trava fica em lib.mjs (permitidoPorRobots).
import { obter } from './lib.mjs';

export const ORGAO = 'Supremo Tribunal Federal';
export const PORTAL = 'https://portal.stf.jus.br';
export const URL_TODOS_TEMAS = `${PORTAL}/jurisprudenciaRepercussao/todostemas.asp`;
export const urlTese = (n) => `${PORTAL}/jurisprudenciaRepercussao/verTeseTema.asp?numTema=${n}`;
export const urlPlenarioVirtualTema = (n) => `${PORTAL}/jurisprudenciaRepercussao/detalharProcesso.asp?numeroTema=${n}`;
export const urlProcessoPublico = (incidente) => `${PORTAL}/processos/detalhe.asp?incidente=${incidente}`; // só link
export const URL_COMPOSICAO = `${PORTAL}/textos/verTexto.asp?servico=bibliotecaConsultaProdutoBibliotecaPastaMinistro&pagina=ComposicaoAtual`;
export const URL_TURMAS = `${PORTAL}/textos/verTexto.asp?servico=sobreStfComposicaoTurma&pagina=principal`;
export const urlPautaProcesso = (classe, numero) => `${PORTAL}/pauta/services/processo-service.asp?classe=${encodeURIComponent(classe)}&numero=${encodeURIComponent(numero)}`;
const SISTEMAS = 'https://sistemas.stf.jus.br/repgeral/votacao';
export const urlVotacaoSessaoVirtual = (incidente) => `${SISTEMAS}?sessaoVirtual=${incidente}`;
export const urlVotacaoIncidentes = (incidente) => `${SISTEMAS}?oi=${incidente}`;
export const urlVotacaoTema = (n) => `${SISTEMAS}?tema=${n}`;
export const URL_API_JURIS = 'https://jurisprudencia.stf.jus.br/api/search/search';
export const urlPesquisaJurisprudencia = (titulo, base = 'acordaos') =>
  `https://jurisprudencia.stf.jus.br/pages/search?base=${base}&sinonimo=true&plural=true&page=1&pageSize=10&sort=_score&sortBy=desc&isAdvance=true&classeNumeroIncidente=${encodeURIComponent(titulo)}`;

export const fonte = (titulo, url, hoje) => ({ titulo, url, orgao: ORGAO, acessado_em: hoje });

// ---------- Repercussão geral ----------
export const lerTodosTemas = () => obter(URL_TODOS_TEMAS, { tipo: 'text', timeoutMs: 300000 });
export const lerTese = (n) => obter(urlTese(n), { tipo: 'cp1252' });

// ---------- Composição ----------
export const lerComposicao = () => obter(URL_COMPOSICAO, { tipo: 'text' });
export const lerTurmas = () => obter(URL_TURMAS, { tipo: 'text' });

// ---------- Plenário Virtual (JSON usado pelo próprio portal) ----------
export async function lerSessaoVirtual(incidente) {
  const r = await obter(urlVotacaoSessaoVirtual(incidente), { opcional: true });
  return Array.isArray(r) ? r : [];
}
export async function lerVotacaoTema(n) {
  const r = await obter(urlVotacaoTema(n), { opcional: true });
  return r?.package?.repercussaoGeral?.processoLeadingCase ?? null;
}

// ---------- Pauta (JSON do portal; caminho /pauta permitido) ----------
export async function lerPautaProcesso(classe, numero) {
  const r = await obter(urlPautaProcesso(classe, numero), { opcional: true });
  return Array.isArray(r) ? r : [];
}

// ---------- API de jurisprudência (POST, Elasticsearch) ----------
// O firewall da API recusa (HTTP 403) consultas com "size" acima de 250: páginas de 200.
const TAM_PAGINA = 200;
const CAMPOS_ACORDAO = ['base', 'id', 'titulo', 'julgamento_data', 'publicacao_data', 'acordao_ata', 'orgao_julgador',
  'relator_processo_nome', 'relator_acordao_nome', 'is_repercussao_geral_merito', 'documental_tese_tema_texto',
  'documental_tese_texto', 'inteiro_teor_url', 'dje_url', 'externo_seq_objeto_incidente', 'dg_atualizado_em', 'ementa_texto'];

/** Acórdãos publicados de uma lista de incidentes (uma única consulta). → Map incidente → hits[] */
export async function lerAcordaosPorIncidente(incidentes) {
  const mapa = new Map();
  const lista = [...new Set(incidentes.map(Number))];
  for (let i = 0; i < lista.length; i += 50) {
    const lote = lista.slice(i, i + 50);
    for (let from = 0; ; from += TAM_PAGINA) {
      const r = await obter(URL_API_JURIS, {
        corpo: {
          size: TAM_PAGINA, from, _source: CAMPOS_ACORDAO,
          query: { bool: { filter: [{ terms: { externo_seq_objeto_incidente: lote } }] } },
          post_filter: { bool: { must: [{ term: { base: 'acordaos' } }] } },
          sort: [{ julgamento_data: 'desc' }],
        },
      });
      const hits = r?.result?.hits?.hits ?? [];
      for (const h of hits) {
        const s = h._source;
        const k = Number(s.externo_seq_objeto_incidente);
        if (!mapa.has(k)) mapa.set(k, []);
        mapa.get(k).push(s);
      }
      if (hits.length < TAM_PAGINA || from > 2000) break;
    }
  }
  return mapa;
}

/** Súmulas vinculantes (base "sumulas", título com "vinculante"). */
export async function lerSumulasVinculantes() {
  const itens = [];
  let total = null;
  for (let from = 0; from <= 2000; from += TAM_PAGINA) {
    const r = await obter(URL_API_JURIS, {
      corpo: {
        size: TAM_PAGINA, from,
        query: { bool: { filter: [{ query_string: { query: 'vinculante', fields: ['titulo'] } }] } },
        post_filter: { term: { base: 'sumulas' } },
        sort: [{ julgamento_data: 'desc' }],
      },
    });
    total = r?.result?.hits?.total?.value ?? total;
    const hits = r?.result?.hits?.hits ?? [];
    itens.push(...hits.map((h) => h._source));
    if (hits.length < TAM_PAGINA) break;
  }
  return { total, itens };
}
