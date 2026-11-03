// Normalização dos registros da API do SAPL 3: só campos permitidos (nunca CPF, RG, telefone,
// endereço, data de nascimento, IP ou usuário do sistema), datas validadas e textos com nomes de
// particulares omitidos (diretriz 12, regras do coletor de Atibaia, importadas sem alteração).
import { ementaPublica } from '../../atibaia/privacidade.mjs';

export const VOTO_INDISPONIVEL = 'Informação não disponível em fonte oficial';
export const TIPO_VOTACAO = { 1: 'simbolica', 2: 'nominal', 3: 'secreta' };
export const ROTULO_TIPO_VOTACAO = { 1: 'Simbólica', 2: 'Nominal', 3: 'Secreta', 4: 'Leitura' };

// ---------------------------------------------------------------- datas
/**
 * Valida data da fonte (AAAA-MM-DD ou ISO com hora). Datas impossíveis, anteriores a 1889 ou
 * posteriores a hoje + futuroDias viram null (o valor bruto volta em "invalida", para a lacuna).
 */
export function validarData(valor, { hoje, futuroDias = 0, minimo = '1889-11-15' } = {}) {
  if (valor == null || valor === '') return { data: null, invalida: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
  if (!m) return { data: null, invalida: String(valor) };
  const d = `${m[1]}-${m[2]}-${m[3]}`;
  const dt = new Date(`${d}T12:00:00Z`);
  if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== d) return { data: null, invalida: String(valor) };
  let limite = hoje;
  if (hoje && futuroDias) { const x = new Date(`${hoje}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + futuroDias); limite = x.toISOString().slice(0, 10); }
  if (d < minimo || (limite && d > limite)) return { data: null, invalida: d };
  return { data: d, invalida: null };
}

/** Hora HH:MM de um ISO com fuso (o SAPL grava no horário de Brasília, -03:00). */
export function horaDe(iso) {
  const m = /T(\d{2}):(\d{2})/.exec(String(iso || ''));
  return m ? `${m[1]}:${m[2]}` : null;
}

export const lacunaData = (campo, bruto) =>
  `Data "${campo}" registrada na fonte como "${bruto}", valor impossível ou posterior à coleta; não corrigida (exibir "Informação não disponível em fonte oficial").`;

// ---------------------------------------------------------------- textos
const limpar = (s) => (s == null ? null : String(s).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim() || null);

/** Texto público: nomes de particulares e documentos omitidos; trechos em dúvida ficam marcados (com hash). */
export function textoPublico(texto, regras = []) {
  const t = limpar(texto);
  if (!t) return { texto: t, pendente: false, omitidos: 0 };
  const r = ementaPublica(t, regras);
  return { texto: r.ementa_publica, pendente: r.duvidas.length > 0, omitidos: r.mascaras.length + r.documentos };
}

export const LACUNA_PRIVACIDADE =
  'Trecho com possível nome de particular aguardando conferência; mostrado como "[trecho em dúvida …]" até a curadoria (diretriz 12).';

// ---------------------------------------------------------------- registros
const id = (v) => (Number.isFinite(v) ? v : (v && Number.isFinite(v.id) ? v.id : null));

export function normParlamentar(r) {
  return {
    id: r.id,
    nome: limpar(r.nome_parlamentar),
    nome_civil: limpar(r.nome_completo),
    ativo: typeof r.ativo === 'boolean' ? r.ativo : null,
    foto: typeof r.fotografia === 'string' && /^https?:\/\//.test(r.fotografia) ? r.fotografia : null,
    email: typeof r.email === 'string' ? r.email.trim().toLowerCase() : null,
  };
}

/** E-mail só se for do domínio institucional da Casa (o SAPL pode ter e-mail pessoal). */
export function emailInstitucional(email, dominios) {
  if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) return null;
  const dom = email.split('@')[1];
  return dominios.some((d) => dom === d || dom.endsWith('.' + d)) ? email : null;
}

export function normMandato(r) {
  return {
    id: r.id, parlamentar_id: id(r.parlamentar), legislatura_id: id(r.legislatura), titular: r.titular ?? null,
    inicio: r.data_inicio_mandato || null, fim: r.data_fim_mandato || null,
    afastado: r.tipo_afastamento != null, fim_causa: r.tipo_causa_fim_mandato != null,
  };
}

export function normFiliacao(r) {
  return { id: r.id, parlamentar_id: id(r.parlamentar), partido_id: id(r.partido), inicio: r.data || null, fim: r.data_desfiliacao || null };
}

export function normMateria(r, { hoje, regras }) {
  const lacunas = [];
  const d = validarData(r.data_apresentacao, { hoje, futuroDias: 1 });
  if (d.invalida) lacunas.push(lacunaData('data de apresentação', d.invalida));
  const em = textoPublico(r.ementa, regras(`materia-${r.id}`));
  return {
    id: r.id, tipo_id: id(r.tipo), numero: r.numero ?? null, ano: r.ano ?? null,
    data_apresentacao: d.data, ementa: em.texto, privacidade_pendente: em.pendente || undefined,
    apelido: limpar(r.apelido), em_tramitacao: typeof r.em_tramitacao === 'boolean' ? r.em_tramitacao : null,
    autores_ids: Array.isArray(r.autores) ? r.autores.map(id).filter((x) => x != null) : [],
    texto_original: typeof r.texto_original === 'string' && /^https?:\/\//.test(r.texto_original) ? r.texto_original : null,
    atualizado_fonte: r.data_ultima_atualizacao || null,
    lacunas,
  };
}

export function normTramitacao(r, { hoje, regras }) {
  const d = validarData(r.data_tramitacao, { hoje, futuroDias: 1 });
  const t = textoPublico(r.texto, regras(`tramitacao-${r.id}`));
  return { id: r.id, materia_id: id(r.materia), data: d.data, status_id: id(r.status), texto: t.texto, privacidade_pendente: t.pendente || undefined };
}

export function normSessao(r, { hoje }) {
  const lacunas = [];
  const di = validarData(r.data_inicio, { hoje, futuroDias: 366 });
  if (di.invalida) lacunas.push(lacunaData('data de início', di.invalida));
  const df = validarData(r.data_fim, { hoje, futuroDias: 366 });
  const url = (v) => (typeof v === 'string' && /^https?:\/\//.test(v) ? v : null);
  return {
    id: r.id, nome: limpar(r.__str__), numero: r.numero ?? null, tipo_id: id(r.tipo),
    data_inicio: di.data, hora_inicio: limpar(r.hora_inicio), data_fim: df.data, hora_fim: limpar(r.hora_fim),
    url_video: url(r.url_video), url_audio: url(r.url_audio), pauta_pdf: url(r.upload_pauta), ata_pdf: url(r.upload_ata),
    lacunas,
  };
}

export function normItemPauta(r, etapa, { hoje, regras }) {
  const d = validarData(r.data_ordem, { hoje, futuroDias: 366 });
  const obs = textoPublico(r.observacao, regras(`${etapa}-${r.id}`));
  return {
    id: r.id, etapa, sessao_id: id(r.sessao_plenaria), materia_id: id(r.materia), data: d.data,
    numero_ordem: r.numero_ordem ?? null, tipo_votacao: r.tipo_votacao ?? null,
    resultado: limpar(r.resultado), observacao: obs.texto, privacidade_pendente: obs.pendente || undefined,
  };
}

export function normRegistro(r, { hoje, regras }) {
  const lacunas = [];
  const d = validarData(r.data_hora, { hoje, futuroDias: 1 });
  if (d.invalida) lacunas.push(lacunaData('data da votação', d.invalida));
  const obs = textoPublico(r.observacao, regras(`registro-${r.id}`));
  const n = (v) => (Number.isFinite(v) ? v : null);
  return {
    id: r.id, materia_id: id(r.materia), ordem_id: id(r.ordem), expediente_id: id(r.expediente),
    tipo_resultado_id: id(r.tipo_resultado_votacao), sim: n(r.numero_votos_sim), nao: n(r.numero_votos_nao),
    abstencao: n(r.numero_abstencoes), observacao: obs.texto, privacidade_pendente: obs.pendente || undefined,
    data: d.data, hora: d.data ? horaDe(r.data_hora) : null, registrado_em: d.data ? r.data_hora : null, lacunas,
  };
}

export function normVoto(r) {
  return { id: r.id, votacao_id: id(r.votacao), parlamentar_id: id(r.parlamentar), voto: limpar(r.voto), data_hora: r.data_hora || null };
}

export function normNorma(r, { hoje, regras }) {
  const lacunas = [];
  const d = validarData(r.data, { hoje, futuroDias: 1 });
  if (d.invalida) lacunas.push(lacunaData('data da norma', d.invalida));
  const dp = validarData(r.data_publicacao, { hoje, futuroDias: 1 });
  if (dp.invalida) lacunas.push(lacunaData('data de publicação', dp.invalida));
  const em = textoPublico(r.ementa, regras(`norma-${r.id}`));
  return {
    id: r.id, tipo_id: id(r.tipo), numero: limpar(r.numero), ano: r.ano ?? null, data: d.data, data_publicacao: dp.data,
    veiculo_publicacao: limpar(r.veiculo_publicacao), ementa: em.texto, privacidade_pendente: em.pendente || undefined,
    materia_id: id(r.materia), esfera: r.esfera_federacao || null,
    texto_integral: typeof r.texto_integral === 'string' && /^https?:\/\//.test(r.texto_integral) ? r.texto_integral : null,
    nome_oficial: limpar(r.__str__), atualizado_fonte: r.data_ultima_atualizacao || null, lacunas,
  };
}

/** Data (AAAA-MM-DD validada) usada para o cursor de cada rota. */
export function dataDoRegistro(rota, r, hoje) {
  const campo = {
    sessaoplenaria: 'data_inicio', ordemdia: 'data_ordem', expedientemateria: 'data_ordem', registrovotacao: 'data_hora',
    votoparlamentar: 'data_hora', materialegislativa: 'data_apresentacao', normajuridica: 'data', tramitacao: 'data_tramitacao',
  }[rota];
  return validarData(r?.[campo], { hoje, futuroDias: 366 }).data;
}
