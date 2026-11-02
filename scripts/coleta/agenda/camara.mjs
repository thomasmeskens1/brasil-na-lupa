// Câmara dos Deputados: sessões do Plenário (eventos do órgão 180), pauta e votações de cada evento.
// Fonte: API de Dados Abertos v2 (https://dadosabertos.camara.leg.br/api/v2).
import { obter, paraCada, limpar, categoriaSituacao } from './lib.mjs';
import { desfechoCamara } from './desfecho.mjs';

export const API = 'https://dadosabertos.camara.leg.br/api/v2';
const ORGAO_PLENARIO = 180;
const ORGAO = 'Câmara dos Deputados';

export const urlPaginaEvento = (id) => `https://www.camara.leg.br/evento-legislativo/${id}`;
const urlProposicao = (id) => `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`;

/** Tipo neutro a partir de "descricaoTipo" e "descricao" oficiais. */
export function tipoCamara(descricaoTipo, descricao) {
  const t = `${descricaoTipo || ''} ${descricao || ''}`;
  if (/sess[ãa]o (conjunta|do congresso)/i.test(t)) return 'sessão do Congresso Nacional';
  if (/n[ãa]o deliberativa/i.test(descricaoTipo || '')) return 'não deliberativa';
  if (/deliberativa/i.test(descricaoTipo || '')) {
    if (/extraordin/i.test(t)) return 'deliberativa extraordinária';
    if (/ordin[áa]ria/i.test(t)) return 'deliberativa ordinária';
    return 'deliberativa (a fonte não diz se ordinária ou extraordinária)';
  }
  return 'não informado';
}

/** Vídeo: a API traz em "urlRegistro" o link do registro em vídeo publicado pela Câmara. */
function videoOficial(url) {
  if (!url) return null;
  try {
    const h = new URL(url).hostname;
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)camara\.leg\.br$/.test(h)) return url;
  } catch { /* url inválida */ }
  return null;
}

async function listarEventos(inicio, fim) {
  const out = [];
  let url = `${API}/eventos?idOrgao=${ORGAO_PLENARIO}&dataInicio=${inicio}&dataFim=${fim}&itens=100&ordem=ASC&ordenarPor=dataHoraInicio`;
  for (let pag = 0; url && pag < 50; pag++) {
    const r = await obter(url);
    out.push(...(r.dados || []));
    url = (r.links || []).find((l) => l.rel === 'next')?.href || null;
  }
  return out;
}

const docResumo = (p) => p && ({
  id: p.id != null ? String(p.id) : null,
  sigla: p.siglaTipo || null,
  numero: p.numero != null && String(p.numero) !== '0' ? Number(p.numero) : null,
  ano: p.ano != null && String(p.ano) !== '0' ? Number(p.ano) : null,
  ementa: limpar(p.ementa),
  url: p.id != null ? urlProposicao(p.id) : null,
});

/** Agrupa as linhas da pauta por "ordem" (a API repete o item para cada documento: parecer, substitutivo…). */
function montarItens(linhas, realizada, acessado_em, idEvento) {
  const porOrdem = new Map();
  for (const l of linhas) {
    const k = l.ordem ?? `sem-ordem-${porOrdem.size}`;
    if (!porOrdem.has(k)) porOrdem.set(k, []);
    porOrdem.get(k).push(l);
  }
  const itens = [];
  for (const [ordem, ls] of porOrdem) {
    const p0 = ls[0];
    const rel = ls.find((l) => l.proposicaoRelacionada_)?.proposicaoRelacionada_ || null;
    const docPauta = p0.proposicao_ || null;
    const itemERequerimento = (docPauta?.siglaTipo || '').toUpperCase() === 'REQ';
    // Quando o documento em pauta é parecer/substitutivo de outra proposição, a matéria é a relacionada.
    const principal = rel && !itemERequerimento ? rel : (docPauta || rel);
    const documentos = [];
    const vistos = new Set();
    for (const l of ls) {
      const d = docResumo(l.proposicao_);
      if (d && !vistos.has(d.id)) { vistos.add(d.id); documentos.push(d); }
    }
    const relatores = [];
    for (const l of ls) {
      const r = l.relator;
      if (r?.nome && !relatores.some((x) => x.id === r.id)) {
        relatores.push({ id: r.id != null ? String(r.id) : null, nome: r.nome, partido: r.siglaPartido || null, uf: r.siglaUf || null });
      }
    }
    const votacoes = [...new Set(ls.map((l) => /votacoes\/([^/]+)\/?$/.exec(l.uriVotacao || '')?.[1]).filter(Boolean))];
    const situacao = ls.map((l) => l.situacaoItem).find(Boolean) || null;
    const { desfecho, desfecho_texto_oficial } = desfechoCamara(situacao, { itemERequerimento, sessaoRealizada: realizada });
    const lacunas = [];
    if (!relatores.length) lacunas.push('relator: Informação não disponível em fonte oficial');
    if (desfecho === 'não informado') lacunas.push(realizada ? 'desfecho: a fonte não informa nos termos das categorias' : 'desfecho: sessão ainda não realizada');
    itens.push({
      ordem: typeof ordem === 'number' ? ordem : null,
      titulo: limpar(p0.titulo),
      topico: limpar(p0.topico),
      regime: limpar(p0.regime),
      proposicao: docResumo(principal),
      materia_relacionada: itemERequerimento && rel ? docResumo(rel) : null,
      documentos_em_pauta: documentos,
      relatores,
      desfecho,
      desfecho_texto_oficial,
      votacoes,
      fonte: { titulo: `Pauta do evento ${idEvento} — Dados Abertos da Câmara dos Deputados`, url: `${API}/eventos/${idEvento}/pauta`, orgao: ORGAO, acessado_em },
      lacunas,
    });
  }
  return itens;
}

/**
 * Coleta as sessões do Plenário da Câmara no período e a pauta de cada uma.
 * Retorna { sessoes: [...], pautas: Map(sessao_id → itens|null), falhas: [] }.
 */
export async function coletarCamara(inicio, fim, acessado_em) {
  const eventos = await listarEventos(inicio, fim);
  const falhas = [];
  const pautas = new Map();
  const sessoes = [];
  await paraCada(eventos, async (e) => {
    const situacao = categoriaSituacao(e.situacao);
    const realizada = situacao === 'encerrada' || situacao === 'em andamento';
    const id = `camara-${e.id}`;
    let linhas = null;
    try {
      linhas = (await obter(`${API}/eventos/${e.id}/pauta`, { opcional: true }))?.dados ?? [];
    } catch (err) { falhas.push(`pauta do evento ${e.id}: ${err.message}`); }
    pautas.set(id, linhas == null ? null : montarItens(linhas, realizada, acessado_em, e.id));
    let votacoesEvento = null;
    const tipo = tipoCamara(e.descricaoTipo, e.descricao);
    if (realizada && tipo.startsWith('deliberativa')) {
      try {
        const v = (await obter(`${API}/eventos/${e.id}/votacoes`, { opcional: true }))?.dados ?? [];
        votacoesEvento = { quantidade: v.length, ids: v.map((x) => x.id).sort() };
      } catch (err) { falhas.push(`votações do evento ${e.id}: ${err.message}`); }
    }
    const [data, horaIni] = String(e.dataHoraInicio || '').split('T');
    const lacunas = [];
    const video = videoOficial(e.urlRegistro);
    if (!video) lacunas.push(realizada ? 'vídeo: Informação não disponível em fonte oficial' : 'vídeo: ainda não publicado pela fonte');
    sessoes.push({
      id,
      casa: 'camara',
      casa_nome: ORGAO,
      codigo_oficial: String(e.id),
      data: data || null,
      hora: horaIni ? horaIni.slice(0, 5) : null,
      hora_fim: e.dataHoraFim ? String(e.dataHoraFim).split('T')[1]?.slice(0, 5) || null : null,
      tipo,
      tipo_oficial: limpar(e.descricaoTipo),
      descricao_oficial: limpar(e.descricao),
      numero: null,
      situacao,
      situacao_oficial: limpar(e.situacao),
      local: limpar(e.localCamara?.nome) || limpar(e.localExterno) || null,
      link_oficial: urlPaginaEvento(e.id),
      video_oficial: video,
      votacoes_do_evento: votacoesEvento,
      fonte: { titulo: `Evento ${e.id} do Plenário — Dados Abertos da Câmara dos Deputados`, url: `${API}/eventos/${e.id}`, orgao: ORGAO, acessado_em },
      lacunas,
    });
  });
  return { sessoes, pautas, falhas, total_eventos: eventos.length };
}
