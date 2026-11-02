// Proposições da ALESP (PL, PLC, PEC, PDL, PR): lista por ano, autores, detalhes e última tramitação.
import { obter, decodificarEntidades } from './lib.mjs';
import { API } from './plenario.mjs';

export const TIPOS_PROJETO = { 1: 'PL', 2: 'PLC', 3: 'PR', 4: 'PDL', 5: 'PEC' };
export const SIGLAS_PROJETO = new Set(Object.values(TIPOS_PROJETO));
const QS_TIPOS = Object.keys(TIPOS_PROJETO).map((t) => `listaIdTipoProcesso=${t}`).join('&');

/** Lista todas as proposições dos tipos acompanhados com ano de apresentação = ano. */
export async function listarProposicoes(ano) {
  const itens = [];
  for (let page = 0; page < 100; page++) {
    const j = await obter(`${API}/processo?page=${page}&size=1000&ano=${ano}&${QS_TIPOS}`);
    itens.push(...(j.content || []));
    if (j.last !== false) break;
  }
  return itens;
}

/** Autores de vários processos (lotes de 100). Retorna Map idProcesso → [{ nome, matricula }]. */
export async function autoresEmLote(ids) {
  const mapa = new Map();
  const lotes = [];
  for (let i = 0; i < ids.length; i += 100) lotes.push(ids.slice(i, i + 100));
  await Promise.all(lotes.map(async (lote) => {
    const j = await obter(`${API}/processo/autores/lote?idsProcessos=${lote.join(',')}`);
    for (const [id, lista] of Object.entries(j || {})) {
      mapa.set(String(id), (lista || [])
        .sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99))
        .map((a) => ({ nome: a.nome || null, parlamentar_id: a.matricula != null ? String(a.matricula) : null })));
    }
  }));
  return mapa;
}

const textoPuro = (h) => decodificarEntidades(String(h || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/** Situação atual: etapa, regime e última tramitação (texto oficial), com link para norma quando houver. */
export async function situacaoDoProcesso(id) {
  const [det, tram] = await Promise.all([
    obter(`${API}/processo/detalhes/${id}`, { opcional: true }),
    obter(`${API}/processo/tramitacoes/${id}?page=0&size=1`, { opcional: true }),
  ]);
  const ult = tram?.content?.[0] || null;
  const linkNorma = ult?.descricao ? /href="(https:\/\/www\.al\.sp\.gov\.br\/norma\/\d+)"/.exec(ult.descricao) : null;
  return {
    situacao: {
      etapa: det?.etapa || null,
      regime_tramitacao: det?.regimeTramitacao || null,
      fase: det?.faseDiscussao?.txNmDiscussao ? det.faseDiscussao.txNmDiscussao.replace(/\s*-\s*$/, '') : null,
      ultima_tramitacao: ult ? { data: ult.data || null, descricao: textoPuro(ult.descricao) } : null,
      url_norma: linkNorma ? linkNorma[1] : (det?.urlNorma || null),
      norma: det?.descricaoNorma || null,
      houve_veto: det?.houveVeto ?? null,
      tipo_veto: det?.tipoVeto ?? null,
      deliberacao_veto: det?.deliberacaoAlesp ?? null,
    },
    tem_votacao_comissao: det?.flPossuiVotacaoComissao === true,
    tem_votacao_plenario: det?.flPossuiVotacaoPlenario === true,
    data_situacao: ult?.data || null,
  };
}

/** Item do índice a partir da listagem (+ autores + situação). */
export function montarProposicao(p, autores, sit, hoje) {
  const lacunas = [];
  if (!sit) lacunas.push('Situação não coletada nesta execução');
  else if (!sit.situacao.ultima_tramitacao) lacunas.push('Tramitação não informada pela fonte');
  return {
    id: String(p.idProcesso),
    sigla: p.tipoProcesso || TIPOS_PROJETO[p.idTipoProcesso] || null,
    numero: p.numeroTipo ?? null,
    ano: p.anoTipo ?? null,
    descricao: p.descricao || null,
    ementa: p.resumo || null,
    data_publicacao: p.dtPublicacao || null,
    autor: {
      nome: p.autorPrincipal || null,
      tipo: p.tipoAutorPrincipal || null,
      partido: p.siglaPartidoPrincipal || null,
      parlamentar_id: p.tipoAutorPrincipal === 'Parlamentar' && p.numeroAutorPrincipal != null ? String(p.numeroAutorPrincipal) : null,
    },
    autores: autores || [],
    situacao: sit?.situacao ?? null,
    tem_votacao_comissao: sit?.tem_votacao_comissao ?? null,
    tem_votacao_plenario: sit?.tem_votacao_plenario ?? null,
    url: `https://www.al.sp.gov.br/propositura/${p.idProcesso}`,
    url_sem_papel: p.urlSemPapel || null,
    situacao_coletada_em: sit ? hoje : null,
    ...(lacunas.length ? { lacunas } : {}),
  };
}

/** Processos com tramitação num dia (GET /notificacao/tramitacoes/{data}): Map id → conteúdo. */
export async function processosComTramitacao(dia) {
  const j = await obter(`${API}/notificacao/tramitacoes/${dia}`, { opcional: true });
  const m = new Map();
  for (const e of Array.isArray(j) ? j : []) {
    const c = e.conteudo || {};
    if (e.tipoConteudo !== 'PROCESSO' || !SIGLAS_PROJETO.has(c.sigla)) continue;
    m.set(String(e.idProcesso ?? e.idConteudo), {
      id: String(e.idProcesso ?? e.idConteudo), sigla: c.sigla, tipo: c.tipo || null,
      numero: c.numero ?? null, ano: c.ano ?? null, ementa: c.ementa || null,
    });
  }
  return m;
}
