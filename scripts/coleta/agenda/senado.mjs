// Senado Federal (e sessões do Congresso Nacional, publicadas pelo Senado): agenda do Plenário,
// pauta de cada encontro e resultado dos itens. Fonte: Dados Abertos Legislativos do Senado.
import { obter, paraCada, limpar, hora, lista, categoriaSituacao, mesesEntre } from './lib.mjs';
import { desfechoSenado } from './desfecho.mjs';

export const API = 'https://legis.senado.leg.br/dadosabertos';
const ORGAO = 'Senado Federal';

export const urlPaginaSessao = (cod) => `https://www25.senado.leg.br/web/atividade/sessao-plenaria/-/pauta/${cod}`;
const urlMateria = (cod) => `https://www25.senado.leg.br/web/atividade/materias/-/materia/${cod}`;
const compacta = (d) => d.replace(/-/g, '');

/** Tipo neutro a partir do tipo oficial, da casa (SF/CN) e do indicador "deliberativo" do encontro. */
export function tipoSenado(tipoOficial, casa, deliberativo) {
  const t = (tipoOficial || '').toUpperCase();
  if (casa === 'CN') return 'sessão do Congresso Nacional';
  if (t.includes('NÃO DELIBERATIVA') || t.includes('NAO DELIBERATIVA')) return 'não deliberativa';
  if (t.includes('DELIBERATIVA EXTRAORDIN')) return 'deliberativa extraordinária';
  if (t.includes('DELIBERATIVA ORDIN')) return 'deliberativa ordinária';
  if (deliberativo === 'N') return 'não deliberativa';
  if (deliberativo === 'S') return 'deliberativa (a fonte não diz se ordinária ou extraordinária)';
  return 'não informado';
}

function videoOficial(url) {
  if (!url) return null;
  try {
    const h = new URL(url).hostname;
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)senado\.leg\.br$|(^|\.)congressonacional\.leg\.br$/.test(h)) return url;
  } catch { /* url inválida */ }
  return null;
}

/** Relatores citados no texto do parecer que acompanha o item ("Relator: Senador Fulano, …"). */
export function relatoresDoTexto(texto) {
  const out = [];
  const re = /Relator(a)?(\s*["“]?ad hoc["”]?)?:\s*((?:Senador|Senadora|Deputado|Deputada)\s+[^,;()\n:]+)/g;
  let m;
  while ((m = re.exec(String(texto || '')))) {
    // O nome termina no primeiro ponto final de frase ("… Carlos Viana. Parecer …"); abreviações
    // curtas como "Dra." ou "Jr." não encerram o nome.
    let completo = m[3].trim();
    const corte = /(\p{L}{4,})\.\s+\p{Lu}/u.exec(completo);
    if (corte) completo = completo.slice(0, corte.index + corte[1].length);
    completo = completo.replace(/\.$/, '').trim();
    const nome = completo.replace(/^(Senador|Senadora|Deputado|Deputada)\s+/, '');
    if (!out.some((r) => r.nome === nome)) {
      out.push({ nome, cargo_citado: completo.split(/\s+/)[0], ad_hoc: Boolean(m[2]), origem: 'texto do parecer citado na pauta oficial' });
    }
  }
  return out;
}

const numero = (x) => (x != null && /^\d+$/.test(String(x).trim()) ? Number(x) : null);
const ehRequerimento = (sigla) => /^(REQ|RQS|RQN|RQJ)$/i.test(sigla || '');

function itemDaPauta(ip, { resultado, realizada, votacoesLocais, acessado_em, cod }) {
  const ml = ip.materiaLegislativa || {};
  const sigla = ml.siglaIdentificacao || null;
  const codMateria = ml.codMateria || ip.codMateria || null;
  const decisoesPauta = lista(ip.itensResultado?.itemResultado).filter((r) => r.indItemPrincipal === 'S').map((r) => r.txtDecisao);
  const { desfecho, desfecho_texto_oficial } = desfechoSenado(resultado, {
    retirado: ip.retirado === 'S', adiado: ip.adiado === 'S', sessaoRealizada: realizada,
    decisoesPauta, itemERequerimento: ehRequerimento(sigla),
  });
  const relatores = relatoresDoTexto(`${ip.rodape || ''} ${resultado?.parecer || ''}`);
  const lacunas = [];
  if (!relatores.length) lacunas.push('relator: Informação não disponível em fonte oficial');
  if (desfecho === 'não informado') lacunas.push(realizada ? 'desfecho: a fonte não informa nos termos das categorias' : 'desfecho: sessão ainda não realizada');
  return {
    ordem: numero(ip.sequencial),
    titulo: limpar(ml.identificacao) || limpar(ip.identificacao),
    tipo_item: limpar(ip.tipoItemPauta?.descricao),
    apreciacao: limpar(ip.apreciacao),
    proposicao: {
      id: codMateria ? String(codMateria) : null,
      id_processo: ml.idProcesso ? String(ml.idProcesso) : null,
      sigla,
      numero: numero(ml.numeroIdentificacao),
      ano: numero(ml.anoIdentificacao),
      ementa: limpar(ml.ementa) || limpar(ip.ementa),
      url: codMateria ? urlMateria(codMateria) : null,
    },
    parecer_citado: limpar(ip.rodape),
    relatores,
    retirado_na_pauta: ip.retirado === 'S',
    adiado_na_pauta: ip.adiado === 'S',
    desfecho,
    desfecho_texto_oficial,
    votacoes: codMateria ? (votacoesLocais.get(`${cod}|${codMateria}`) || []) : [],
    fonte: { titulo: `Pauta do encontro ${cod} — Dados Abertos do Senado Federal`, url: `${API}/plenario/encontro/${cod}/pauta`, orgao: ORGAO, acessado_em },
    lacunas,
  };
}

/** Item montado só com a agenda (quando a pauta do encontro não veio). */
function itemDaAgenda(m, { realizada, acessado_em, cod, dataCompacta }) {
  const lacunas = ['relator: Informação não disponível em fonte oficial'];
  lacunas.push(realizada ? 'desfecho: a fonte não informa nos termos das categorias' : 'desfecho: sessão ainda não realizada');
  return {
    ordem: numero(m.SequenciaOrdem),
    titulo: limpar(m.DescricaoIdentificacaoMateria) || limpar(m.Identificacao),
    tipo_item: limpar(m.DescricaoTipoPauta),
    apreciacao: limpar(m.Apreciacao),
    proposicao: {
      id: m.CodigoMateria ? String(m.CodigoMateria) : null, id_processo: null,
      sigla: m.SiglaMateria || null, numero: numero(m.NumeroMateria), ano: numero(m.AnoMateria),
      ementa: limpar(m.Ementa), url: m.CodigoMateria ? urlMateria(m.CodigoMateria) : null,
    },
    parecer_citado: null, relatores: [], retirado_na_pauta: null, adiado_na_pauta: null,
    desfecho: 'não informado', desfecho_texto_oficial: null, votacoes: [],
    fonte: { titulo: `Agenda do Plenário — Dados Abertos do Senado Federal (sessão ${cod})`, url: `${API}/plenario/agenda/mes/${dataCompacta}`, orgao: ORGAO, acessado_em },
    lacunas,
  };
}

/**
 * Coleta sessões do Senado e do Congresso no período.
 * votacoesLocais: Map("codigoSessao|codigoMateria" → [ids]) a partir de dados/senado/votacoes.
 */
export async function coletarSenado(inicio, fim, acessado_em, votacoesLocais = new Map()) {
  const meses = mesesEntre(inicio, fim);
  const falhas = [];
  const agenda = [];
  const resultados = new Map(); // codigoItem → item do resultado
  await paraCada(meses, async (m) => {
    const d = compacta(m);
    const a = await obter(`${API}/plenario/agenda/mes/${d}`);
    for (const s of lista(a?.AgendaPlenario?.Sessoes?.Sessao)) agenda.push({ ...s, _mes: d });
    try {
      const r = await obter(`${API}/plenario/resultado/mes/${d}`, { opcional: true });
      for (const s of lista(r?.ResultadoPlenario?.Sessoes?.Sessao)) {
        for (const it of lista(s.Itens?.Item)) resultados.set(`${s.codigoSessao}|${it.codigoItem}`, it);
      }
    } catch (err) { falhas.push(`resultado do mês ${d}: ${err.message}`); }
  });
  const noPeriodo = agenda.filter((s) => s.Data >= inicio && s.Data <= fim);
  const unicos = [...new Map(noPeriodo.map((s) => [s.CodigoSessao, s])).values()];
  const sessoes = [];
  const pautas = new Map();
  await paraCada(unicos, async (s) => {
    const cod = String(s.CodigoSessao);
    const casa = s.Casa === 'CN' ? 'congresso' : 'senado';
    const id = `${casa}-${cod}`;
    let enc = null;
    try {
      enc = lista((await obter(`${API}/plenario/encontro/${cod}`, { opcional: true }))?.ServicoPlenario?.encontros?.encontro)[0] || null;
    } catch (err) { falhas.push(`encontro ${cod}: ${err.message}`); }
    const situacao = categoriaSituacao(s.SituacaoSessao || enc?.tipoSituacao?.nome);
    const realizada = situacao === 'encerrada' || situacao === 'em andamento';
    const tipo = tipoSenado(s.TipoSessao, s.Casa, enc?.deliberativo);
    const materias = lista(s.Materias?.Materia);
    let itens = [];
    if (materias.length || tipo.startsWith('deliberativa') || (casa === 'congresso' && !/SOLENE/i.test(s.TipoSessao || ''))) {
      try {
        const p = await obter(`${API}/plenario/encontro/${cod}/pauta`, { opcional: true });
        const ips = lista(p?.ServicoPlenario?.itensPauta?.itemPauta);
        itens = ips.map((ip) => itemDaPauta(ip, { resultado: resultados.get(`${cod}|${ip.codigo}`) || null, realizada, votacoesLocais, acessado_em, cod }));
        if (!itens.length && materias.length) itens = materias.map((m) => itemDaAgenda(m, { realizada, acessado_em, cod, dataCompacta: s._mes }));
      } catch (err) {
        falhas.push(`pauta do encontro ${cod}: ${err.message}`);
        itens = materias.length ? materias.map((m) => itemDaAgenda(m, { realizada, acessado_em, cod, dataCompacta: s._mes })) : null;
      }
    }
    pautas.set(id, itens);
    const video = videoOficial(enc?.linkVideo);
    const lacunas = [];
    if (!enc) lacunas.push('detalhe do encontro não obtido nesta coleta');
    if (!video) lacunas.push(realizada ? 'vídeo: Informação não disponível em fonte oficial' : 'vídeo: ainda não publicado pela fonte');
    sessoes.push({
      id,
      casa,
      casa_nome: casa === 'congresso' ? 'Congresso Nacional' : ORGAO,
      codigo_oficial: cod,
      data: s.Data,
      hora: hora(s.Hora),
      hora_fim: null,
      tipo,
      tipo_oficial: limpar(enc?.tipoSessao?.nome) || limpar(s.TipoSessao),
      descricao_oficial: limpar(s.Evento?.DescricaoEvento) || limpar(enc?.finalidade),
      numero: limpar(s.NumeroSessao),
      situacao,
      situacao_oficial: limpar(s.SituacaoSessao),
      local: limpar(s.LocalSessao) || limpar(enc?.local),
      link_oficial: urlPaginaSessao(cod),
      video_oficial: video,
      votacoes_do_evento: null,
      fonte: { titulo: `Agenda do Plenário (${s._mes.slice(4, 6)}/${s._mes.slice(0, 4)}) e encontro ${cod} — Dados Abertos do Senado Federal`, url: `${API}/plenario/encontro/${cod}`, orgao: ORGAO, acessado_em },
      lacunas,
    });
  });
  return { sessoes, pautas, falhas, total_agenda: unicos.length };
}
