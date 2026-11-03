// Normalização dos registros do SPL Ágape (funções puras, sem rede nem arquivo).
// Só campos permitidos: nunca CPF/CNPJ do autor, telefone, endereço, e-mail pessoal, perfil
// biográfico (traz nascimento, filiação, cônjuge) nem o "resumo gerado por IA" das páginas.
// Textos passam pelas regras de privacidade do projeto (diretriz 12), as mesmas do coletor de
// Atibaia: nome de particular → "[nome de particular omitido]"; documento → "[documento omitido]".
import { ementaPublica, NOME_OMITIDO } from '../../atibaia/privacidade.mjs';
import { extrairDeliberacoes, normasCitadas } from './deliberacoes.mjs';

export { NOME_OMITIDO };
export const LACUNA_PRIVACIDADE =
  'Trecho com possível nome de particular aguardando conferência; mostrado como "[trecho em dúvida …]" até a curadoria (diretriz 12).';

const limpar = (s) => {
  if (s == null) return null;
  const t = String(s).replace(/\r\n?/g, '\n').replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return t || null;
};

export const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const normalizarNome = (s) => semAcento(s).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** "03/09/2026 09:58:42" → { data: "2026-09-03", hora: "09:58" }; ISO também aceito. */
export function dataHora(valor) {
  const s = String(valor ?? '').trim();
  let m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(s);
  let a, me, d, h = null;
  if (m) { [, d, me, a] = m; if (m[4]) h = `${m[4]}:${m[5]}`; }
  else if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s))) { [, a, me, d] = m; if (m[4] && `${m[4]}:${m[5]}` !== '00:00') h = `${m[4]}:${m[5]}`; }
  else return { data: null, hora: null };
  const iso = `${a}-${me}-${d}`;
  const dt = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso || +a < 1889) return { data: null, hora: null };
  return { data: iso, hora: h };
}

/**
 * URL de arquivo do SPL: corrige o domínio duplicado da Alese
 * ("https://host/https://host/Arquivo/…" → "https://host/Arquivo/…"), completa caminho relativo
 * e só aceita endereço do próprio host da Casa.
 */
export function urlArquivo(valor, host) {
  let s = String(valor ?? '').trim();
  if (!s) return null;
  for (let m; (m = /^https?:\/\/[^/]+\/+(https?:\/\/.+)$/i.exec(s));) s = m[1];
  if (s.startsWith('/')) s = `https://${host}${s}`;
  else if (!/^https?:\/\//i.test(s)) s = `https://${host}/${s}`;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.hostname !== host) return null;
  u.protocol = 'https:';
  return u.toString();
}

/** Texto público com as regras de privacidade (regras de curadoria por id, quando houver). */
export function textoPublico(texto, regras = []) {
  const t = limpar(texto);
  if (!t) return { texto: null, pendente: false };
  const r = ementaPublica(t, regras);
  return { texto: r.ementa_publica, pendente: r.duvidas.length > 0 };
}

export function emailInstitucional(email, dominios) {
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e)) return null;
  const dom = e.split('@')[1];
  return dominios.some((d) => dom === d || dom.endsWith('.' + d)) ? e : null;
}

// ---------------------------------------------------------------- parlamentares
export function normParlamentar(r, cfg) {
  const situacao = limpar(r.parlamentarSituacao);
  const foto = urlArquivo(r.parlamentarFoto, cfg.host);
  return {
    id: String(r.parlamentarID),
    nome: limpar(r.parlamentarNome),
    nome_civil: limpar(r.parlamentarRazaoSocial),
    partido: limpar(r.partidoSigla),
    partido_nome: limpar(r.partidoNome),
    legislatura: Number(r.parlamentarLegislatura) || null,
    situacao_fonte: situacao,
    em_exercicio: situacao ? /^ativo$/i.test(situacao) : null,
    cargo_mesa: limpar(r.parlamentarMesaCargo) && !/n[ãa]o participa/i.test(r.parlamentarMesaCargo) ? limpar(r.parlamentarMesaCargo) : null,
    autor_id: Number.isFinite(Number(r.autorID)) && Number(r.autorID) > 0 ? String(r.autorID) : null,
    foto,
    email: emailInstitucional(r.parlamentarEmail, cfg.dominios_email),
  };
}

/** Índices para reconhecer deputado autor (por autorId na Alese; por nome civil/parlamentar na ALBA). */
export function indiceParlamentares(lista) {
  const porAutor = new Map();
  const porNome = new Map();
  for (const p of lista || []) {
    if (p.autor_id) porAutor.set(p.autor_id, p);
    for (const n of [p.nome, p.nome_civil]) if (n) porNome.set(normalizarNome(n), p);
  }
  return { porAutor, porNome };
}

// Autor institucional (pode ser exibido pelo nome do órgão).
const INSTITUCIONAL = /\b(PODER\s+EXECUTIVO|PODER\s+JUDICI|GOVERNADOR|GOVERNO\s+DO\s+ESTADO|MESA\s+DIRETORA|MESA\b|COMISS[AÃ]O|TRIBUNAL|MINIST[EÉ]RIO\s+P[UÚ]BLICO|DEFENSORIA|PROCURADORIA|ASSEMBLEIA|SECRETARIA|CORREGEDORIA|LIDERAN[CÇ]A|BANCADA|BLOCO\s+PARLAMENTAR|CONSELHO\s+ESTADUAL|PRESID[EÊ]NCIA\s+DA\s+ASSEMBLEIA|C[AÂ]MARA\s+MUNICIPAL|PREFEITURA)\b/i;
const GABINETE_DEPUTADO = /^\s*GAB(?:INETE)?\.?\s+(?:D[OA]\s+)?(?:DEP(?:UTAD[OA])?\.?)\s/i;

/**
 * Autor de proposição a partir do AutorRequerenteDados (e CoAutores): deputado → nome parlamentar
 * e id; órgão público → nome do órgão; demais (ex.: presidente de entidade) → nome omitido.
 */
export function autorPublico(dados, idx) {
  if (!dados || typeof dados !== 'object') return null;
  const nome = limpar(dados.nomeRazao ?? dados.nome ?? dados.autor ?? dados.parlamentar);
  const setor = limpar(dados.setor);
  const autorId = dados.autorId ?? dados.autorID ?? null;
  if (!nome && !(autorId > 0)) return null;
  const p = (autorId != null && idx.porAutor.get(String(autorId))) || (nome && idx.porNome.get(normalizarNome(nome)));
  if (p) return { nome: p.nome, parlamentar_id: p.id };
  if (nome && (GABINETE_DEPUTADO.test(setor || '') || /^DEPUTAD[OA]\s/i.test(nome))) return { nome, parlamentar_id: null, observacao: 'deputado(a) fora da lista atual da Casa' };
  if (nome && INSTITUCIONAL.test(nome) && !/\bPRESIDENTE\s+D[AEO]\s+ENTIDADE/i.test(nome)) return { nome, parlamentar_id: null };
  return { nome: NOME_OMITIDO, parlamentar_id: null };
}

const TIPO_NORMATIVO = /projeto|proposta\s+de\s+emenda|veto|mensagem|emenda\s+constitucional|substitutivo/i;
export const ehTipoNormativo = (tipo, sigla) => TIPO_NORMATIVO.test(String(tipo || '')) || /^(PL|PLC|PEC|PDL|PR|PRS|VETO|VET|MSG|PLO)$/i.test(String(sigla || ''));

export function normTramitacao(t, cfg, regras) {
  const d = [t.dataAcaoSaida, t.dataAssinatura, t.dataRecebimento, t.data].map(dataHora).find((x) => x.data) || { data: null, hora: null };
  const c = textoPublico(t.complemento, regras(`tramitacao-${t.id}`));
  return {
    id: Number(t.id),
    data: d.data,
    hora: d.hora,
    fase: limpar(t.fase),
    setor: limpar(t.setor),
    acao: limpar(t.acao),
    complemento: c.texto,
    arquivo: urlArquivo(t.arquivo, cfg.host),
    privacidade_pendente: c.pendente || undefined,
  };
}

/**
 * Proposição normalizada (registro guardado no índice do ano).
 * ctx: { cfg, idx (indiceParlamentares), regras(chave) → regras de curadoria, hoje }.
 */
export function normProposicao(r, ctx) {
  const { cfg, idx, regras } = ctx;
  const id = Number(r.id);
  const lacunas = [];
  const ementa = textoPublico(r.assunto, regras(`proposicao-${id}`));
  const tram = (Array.isArray(r.Tramitacoes) ? r.Tramitacoes : []).filter((t) => t && t.id).map((t) => normTramitacao(t, cfg, regras));
  tram.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || b.id - a.id);
  const autores = [];
  const principal = autorPublico(r.AutorRequerenteDados, idx);
  if (principal) autores.push({ ...principal, papel: 'autor' });
  for (const co of Array.isArray(r.CoAutores) ? r.CoAutores : []) {
    const a = autorPublico(co, idx);
    if (a && !autores.some((x) => x.nome === a.nome && x.nome !== NOME_OMITIDO)) autores.push({ ...a, papel: 'coautor' });
  }
  if (!autores.length) lacunas.push('Autoria: não informada na fonte.');
  if (autores.some((a) => a.nome === NOME_OMITIDO)) lacunas.push('Autoria: pessoa que não é agente público (nome omitido; ver documento oficial).');
  const situacao = limpar(r.situacao);
  if (!cfg.situacao_confiavel && situacao) lacunas.push(ctx.lacunaSituacao);
  const apresentada = dataHora(r.data);
  const numero = Number(r.numero);
  const ano = Number(r.ano) || (apresentada.data ? Number(apresentada.data.slice(0, 4)) : null);
  const sigla = limpar(r.sigla);
  const tipo = limpar(r.tipo);
  const { deliberacoes, correcoes } = extrairDeliberacoes(tram);
  const normas = normasCitadas(tram);
  if (correcoes.length) lacunas.push('A tramitação registra correção de despacho anterior; conferir o texto oficial antes de usar o resultado.');
  const pendente = ementa.pendente || tram.some((t) => t.privacidade_pendente);
  if (pendente) lacunas.push(LACUNA_PRIVACIDADE);
  const normativo = ehTipoNormativo(tipo, sigla);
  const ultima = tram[0] || null;
  return {
    id: `${cfg.uf.toLowerCase()}-${id}`,
    id_oficial: id,
    uf: cfg.uf,
    casa: cfg.casa,
    sigla,
    tipo,
    tipo_id: Number(r.tipoId) || null,
    numero: Number.isFinite(numero) ? numero : null,
    ano,
    identificacao: sigla && Number.isFinite(numero) && ano ? `${sigla} ${numero}/${ano}` : null,
    processo: limpar(r.processo),
    data_apresentacao: apresentada.data,
    ementa: ementa.texto,
    autores,
    situacao_fonte: situacao,
    ultima_tramitacao: ultima ? { data: ultima.data, fase: ultima.fase, setor: ultima.setor, acao: ultima.acao, complemento: ultima.complemento } : null,
    n_tramitacoes: tram.length,
    tramitacao: normativo ? tram.map(({ privacidade_pendente, ...t }) => t) : undefined,
    deliberacoes: deliberacoes.length ? deliberacoes : undefined,
    correcoes: correcoes.length ? correcoes : undefined,
    normas_citadas: normas.length ? normas : undefined,
    url: `https://${cfg.host}/spl/processo.aspx?id=${id}`,
    url_texto: urlArquivo(r.arquivo, cfg.host),
    fonte_dados: `https://${cfg.host}/api/publico/proposicao/?proposicaoID=${id}`,
    acessado_em: ctx.hoje,
    privacidade_pendente: pendente || undefined,
    lacunas,
  };
}
