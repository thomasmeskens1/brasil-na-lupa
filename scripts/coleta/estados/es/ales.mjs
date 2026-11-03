// ALES — API pública da Assembleia Legislativa do Espírito Santo ("Ales Digital", www3.al.es.gov.br/api/publico)
// e "Boletim de Votação Nominal" (tipo RVP, PDF do painel eletrônico). Funções puras de montagem.
// Privacidade: o campo AutorRequerenteDados das proposições traz CPF, e-mail e telefone de quem protocolou;
// aqui só são lidos campos escolhidos um a um (nunca cpf_cnpj, email, telefone, endereço, setor).
import { textoPublico, dataBR, normalizarNome, verificarPrivacidade } from '../rn/base.mjs';

export const HOST = 'www3.al.es.gov.br';
export const API = `https://${HOST}/api/publico`;
export const ORGAO = 'Assembleia Legislativa do Estado do Espírito Santo (ALES)';
export const UF = 'ES';
export const CASA = 'ales';
export const NOME_OMITIDO = '[nome de particular omitido]';

// Proposições que entram no índice anual (as demais — requerimentos, indicações, ofícios, boletins etc. — não).
export const SIGLAS_INDICE = new Set(['PL', 'PLC', 'PEC', 'PDL', 'PR', 'MV', 'MGE']); // MV = Veto, MGE = Mensagem do Governo do Estado
// Normas (API de legislação, campo tipo): 3 = Lei Ordinária, 4 = Lei Complementar, 2 = Emenda à Constituição Estadual.
export const TIPOS_NORMA = [
  { tipoId: 3, prefixo: 'lei', nome: 'Lei Ordinária' },
  { tipoId: 4, prefixo: 'lc', nome: 'Lei Complementar' },
  { tipoId: 2, prefixo: 'ec', nome: 'Emenda à Constituição Estadual' },
];

const num = (s) => (s == null || s === '' || !Number.isFinite(Number(s)) ? null : Number(s));
const EMAIL_INSTITUCIONAL = /^[A-Za-z0-9._%+-]+@al\.es\.gov\.br$/i;

/** Deputado (perfil, telefone, gabinete e frequência não são gravados; e-mail só o institucional). */
export function montarParlamentar(p) {
  const email = String(p.parlamentarEmail || '').trim();
  return {
    id: String(p.parlamentarID),
    uf: UF,
    casa: CASA,
    nome: p.parlamentarNome || null,
    nome_civil: null,
    nome_exibicao: p.parlamentarRazaoSocial || null,
    partido: p.partidoSigla || null,
    partido_nome: p.partidoNome || null,
    em_exercicio: p.parlamentarSituacao === 'Ativos',
    situacao_fonte: p.parlamentarSituacao || null,
    legislatura: num(p.parlamentarLegislatura),
    cargo_mesa: p.parlamentarMesaCargo && p.parlamentarMesaCargo !== 'não participa' ? p.parlamentarMesaCargo : null,
    comissoes: (Array.isArray(p.comissoesAtuantes) ? p.comissoesAtuantes : []).map((c) => ({ id: c.comissaID ?? null, nome: c.comissaoNome || null, cargo: c.comissaoCargo || null })),
    foto: /^https:\/\/www3\.al\.es\.gov\.br\//.test(p.parlamentarFoto || '') ? p.parlamentarFoto : null,
    url_oficial: null,
    email: EMAIL_INSTITUCIONAL.test(email) ? email : null,
  };
}

const INSTITUCIONAL = /\b(GOVERNADOR|GOVERNO|MESA|COMISS[AÃ]O|TRIBUNAL|DEFENSORIA|MINIST[EÉ]RIO|PODER|PROCURADORIA|ASSEMBLEIA|DEPUTAD[OA]|SECRETARIA|PRESID[EÊ]NCIA|LIDERAN[CÇ]A|BANCADA|FRENTE|CONSELHO|UNIVERSIDADE)\b/i;

/**
 * Autor da proposição: mantido só quando é órgão/cargo público ou deputado da lista oficial
 * (correspondência exata de nome). Senão, omitido (pode ser pessoa física que protocolou).
 */
export function autorPublico(dados, indiceNomes) {
  const nome = dados?.nomeRazao ? String(dados.nomeRazao).trim() : '';
  if (!nome) return { nome: null, parlamentar_id: null, omitido: false };
  const id = indiceNomes?.get(chaveNome(nome)) ?? null;
  if (id) return { nome, parlamentar_id: id, omitido: false };
  if (INSTITUCIONAL.test(nome)) return { nome, parlamentar_id: null, omitido: false };
  return { nome: NOME_OMITIDO, parlamentar_id: null, omitido: true };
}

/** Última tramitação (a fonte lista da mais recente para a mais antiga). */
export function ultimaTramitacao(lista) {
  const t = (Array.isArray(lista) ? lista : []).filter((x) => x && (x.fase || x.acao))[0];
  if (!t) return null;
  const quando = dataBR(t.dataAcaoSaida || t.dataRecebimento || t.dataAssinatura || t.data || '');
  return { fase: t.fase || null, setor: t.setor || null, acao: t.acao || null, data: quando.data };
}

export function montarProposicao(p, { hoje, indiceNomes, regras = [] }) {
  const em = textoPublico(p.assunto, regras);
  const autor = autorPublico(p.AutorRequerenteDados, indiceNomes);
  const ult = ultimaTramitacao(p.Tramitacoes);
  const apres = dataBR(p.data);
  const lacunas = [];
  if (autor.omitido) lacunas.push('Autor não identificado como agente público na lista oficial; nome omitido (diretriz de privacidade)');
  if (em.duvidas) lacunas.push('Ementa com trecho em análise de privacidade (nome possivelmente de particular)');
  return {
    id: `es-${p.id}`,
    id_oficial: p.id,
    uf: UF,
    casa: CASA,
    sigla: p.sigla || null,
    tipo: p.tipo || null,
    numero: num(p.numero),
    ano: num(p.ano),
    descricao: p.sigla ? `${p.sigla} ${p.numero}/${p.ano}` : null,
    processo: p.processo || null,
    protocolo: p.protocolo || null,
    ementa: em.texto,
    ...(em.duvidas ? { privacidade_pendente: true } : {}),
    data_apresentacao: apres.data,
    autor: { nome: autor.nome, parlamentar_id: autor.parlamentar_id },
    situacao: { texto: p.situacao || null, ultima_fase: ult?.fase ?? null, setor: ult?.setor ?? null, acao: ult?.acao ?? null, data: ult?.data ?? null, coletada_em: hoje },
    url: /^https:\/\/www3\.al\.es\.gov\.br\//.test(p.arquivo || '') ? p.arquivo : null,
    fonte_dados: `${API}/proposicao/?proposicaoID=${p.id}`,
    lacunas,
  };
}

export function montarNorma(x, tipo, { hoje, regras = [] }) {
  const em = textoPublico(x.ementa, regras);
  const numero = num(x.numero), ano = num(x.ano);
  const url = x.arquivoHtml || x.arquivo || null;
  const lacunas = [];
  if (!url) lacunas.push('Texto da norma sem endereço na fonte');
  if (em.duvidas) lacunas.push('Ementa com trecho em análise de privacidade (nome possivelmente de particular)');
  return {
    id: numero != null && ano ? `${tipo.prefixo}-${numero}-${ano}` : `${tipo.prefixo}-${x.id}`,
    id_oficial: x.id,
    uf: UF,
    tipo: x.tipo || tipo.nome,
    numero,
    ano,
    nome_oficial: `${x.tipo || tipo.nome} nº ${x.numero}/${x.ano}`,
    data: dataBR(x.data).data,
    ementa: em.texto,
    ...(em.duvidas ? { privacidade_pendente: true } : {}),
    origem: x.origem || null,
    situacao: x.situacao || null,
    url,
    fonte_dados: `${API}/legislacao/${x.id}`,
    fonte: { titulo: `${tipo.nome} — legislação da ALES`, url: `${API}/legislacao?tipo=${tipo.tipoId}&ano=${ano}`, orgao: ORGAO, acessado_em: hoje },
    lacunas,
  };
}

// ---------------------------------------------------------------- nomes do boletim
// O boletim abrevia alguns nomes ("DEL DANILO BAHIENSE", "ENG. JOSÉ ESMERALDO"). Expansões fixas e
// conferidas na lista oficial; a ligação só é feita quando o nome expandido corresponde a UM deputado.
const ABREVIACOES = { DEL: 'DELEGADO', ENG: 'ENGENHEIRO', CEL: 'CORONEL', CAP: 'CAPITAO', PROF: 'PROFESSOR', PROFA: 'PROFESSORA', DRA: 'DRA', DR: 'DR' };
export const chaveNome = (s) => normalizarNome(s).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const expandir = (k) => k.split(' ').map((t) => ABREVIACOES[t] || t).join(' ');

/** Mapa nome normalizado → id (só nomes sem ambiguidade). */
export function indiceDeNomes(parlamentares) {
  const m = new Map(), dup = new Set();
  for (const p of parlamentares) {
    for (const k of new Set([chaveNome(p.nome), expandir(chaveNome(p.nome))])) {
      if (m.has(k) && m.get(k) !== p.id) dup.add(k);
      m.set(k, p.id);
    }
  }
  for (const k of dup) m.delete(k);
  return m;
}
export function ligarNome(nome, indice) {
  const k = chaveNome(nome);
  return indice.get(k) ?? indice.get(expandir(k)) ?? null;
}

// ---------------------------------------------------------------- boletim (RVP)
export const VOTOS_CONHECIDOS = new Set(['Sim', 'Não', 'Abstenção', 'Ausente', 'Não votou', 'Licenciado']);
const SIGLA_TIPO = [
  [/^Projeto de Lei Complementar/i, 'PLC'],
  [/^Projeto de Lei/i, 'PL'],
  [/^Proposta de Emenda (?:à |a )?Constitui/i, 'PEC'],
  [/^Projeto de Decreto Legislativo/i, 'PDL'],
  [/^Projeto de Resolução/i, 'PR'],
];

/** Proposição citada no título do boletim ("Veto Total, ao Projeto de Lei nº 326/2019"). */
export function lerTitulo(titulo) {
  const t = String(titulo || '').trim();
  const veto = /^Veto\s+(Total|Parcial)\b[\s,]*(?:ao|do|a|à)?\s*/i.exec(t);
  const resto = veto ? t.slice(veto[0].length) : t;
  const m = /n[º°o.]*\s*(\d+)\s*\/\s*(\d{4})/i.exec(resto);
  const sigla = (SIGLA_TIPO.find(([re]) => re.test(resto)) || [])[1] || null;
  return {
    sigla, numero: m ? Number(m[1]) : null, ano: m ? Number(m[2]) : null,
    objeto: veto ? `Veto ${veto[1][0].toUpperCase()}${veto[1].slice(1).toLowerCase()}` : null,
  };
}

/**
 * Interpreta as linhas do boletim e confere com os totais impressos.
 * Devolve { ok, problemas[], cabecalho{...}, votos[{nome, partido, voto, hora}], totais{sim,nao,abstencao}, resultado }.
 */
export function lerBoletim(linhas) {
  const problemas = [];
  const cab = { emitido_em: null, sessao: null, titulo: null, turno: null, modo: null, inicio: null, termino: null, descricao: [] };
  const votos = [];
  let totais = null, resultado = null;
  let zona = 'cabecalho';
  const RODAPE = /^(Autenticar documento|com o identificador|MP n|Página \d+ de \d+)/i;
  const VOTO = /^(.+?) \(([^()]+)\) ([A-Za-zÀ-ÿ]+(?: [A-Za-zÀ-ÿ]+)?)(?: (\d{2}:\d{2}:\d{2}))?$/;
  for (const l of linhas) {
    if (/^Parlamentar Voto Hora$/i.test(l)) { zona = 'votos'; continue; }
    if (RODAPE.test(l)) { if (zona === 'votos') zona = 'quebra'; continue; }
    if (zona === 'quebra') continue; // cabeçalho repetido na página seguinte, até "Parlamentar Voto Hora"
    if (zona === 'cabecalho') {
      let m;
      if (!cab.emitido_em && (m = /^Lista de votação (\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/i.exec(l))) { cab.emitido_em = m[1]; continue; }
      if (!cab.sessao && /SESS[ÃA]O/i.test(l) && /LEGISLATURA/i.test(l)) { cab.sessao = l; continue; }
      if ((m = /^Turno:\s*(.+?)\s+Início:\s*(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/i.exec(l))) { cab.turno = m[1]; cab.inicio = m[2]; continue; }
      if ((m = /^Modo:\s*(.+?)\s+Término:\s*(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/i.exec(l))) { cab.modo = m[1]; cab.termino = m[2]; continue; }
      if (cab.sessao && !cab.turno && !cab.titulo) { cab.titulo = l; continue; }
      if (cab.modo) cab.descricao.push(l);
      continue;
    }
    if (zona === 'votos') {
      let m;
      if ((m = /^Totais:\s*Sim:\s*(\d+)\s*Não:\s*(\d+)\s*Abstenção:\s*(\d+)/i.exec(l))) {
        totais = { sim: Number(m[1]), nao: Number(m[2]), abstencao: Number(m[3]) }; zona = 'fim'; continue;
      }
      if ((m = VOTO.exec(l))) {
        if (!VOTOS_CONHECIDOS.has(m[3])) problemas.push(`voto desconhecido: "${m[3]}"`);
        votos.push({ nome: m[1].trim(), partido: m[2].trim(), voto: m[3], hora: m[4] || null });
      } else problemas.push(`linha não reconhecida na lista de votos: "${l.slice(0, 80)}"`);
      continue;
    }
    if (zona === 'fim') {
      const m = /^Resultado:\s*(.+)$/i.exec(l);
      if (m && !resultado) resultado = m[1].trim();
    }
  }
  if (!cab.modo) problemas.push('modo de votação não identificado');
  else if (!/^Nominal$/i.test(cab.modo)) problemas.push(`modo de votação "${cab.modo}" (não nominal)`);
  if (!cab.inicio) problemas.push('data de início não identificada');
  if (!totais) problemas.push('totais não encontrados no boletim');
  if (!votos.length) problemas.push('nenhuma linha de voto');
  const nomes = new Set();
  for (const v of votos) { if (nomes.has(v.nome)) problemas.push(`nome repetido: ${v.nome}`); nomes.add(v.nome); }
  if (totais) {
    const c = (x) => votos.filter((v) => v.voto === x).length;
    if (c('Sim') !== totais.sim) problemas.push(`Sim: ${c('Sim')} linhas × total ${totais.sim}`);
    if (c('Não') !== totais.nao) problemas.push(`Não: ${c('Não')} linhas × total ${totais.nao}`);
    if (c('Abstenção') !== totais.abstencao) problemas.push(`Abstenção: ${c('Abstenção')} linhas × total ${totais.abstencao}`);
  }
  return { ok: problemas.length === 0, problemas, cabecalho: { ...cab, descricao: cab.descricao.join(' ') || null }, votos, totais, resultado };
}

const RESULTADOS = { aprovada: 'aprovada', aprovado: 'aprovada', rejeitada: 'rejeitada', rejeitado: 'rejeitada' };

/** Número e ano do boletim a partir do nome do arquivo oficial (…-RVP532026-…). */
export function numeroBoletim(url) {
  const m = /RVP(\d+)(\d{4})-/.exec(String(url || ''));
  return m ? { numero: Number(m[1]), ano: Number(m[2]) } : { numero: null, ano: null };
}

/** Registro de votação a partir do boletim conferido (só chamar com lido.ok === true). */
export function montarVotacaoBoletim(item, lido, { hoje, sha256, indiceNomes, proposicaoId = null, regras = [] }) {
  const cab = lido.cabecalho;
  const ini = dataBR(cab.inicio);
  const tit = lerTitulo(cab.titulo);
  const desc = textoPublico(cab.descricao, regras);
  const assunto = textoPublico(item.assunto, regras);
  const lacunas = [];
  let semId = 0;
  const votos = lido.votos.map((v) => {
    const id = ligarNome(v.nome, indiceNomes);
    if (!id) semId++;
    return { parlamentar_id: id, nome: v.nome, partido: v.partido, uf: UF, voto: v.voto, hora_registro: v.hora };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (semId) lacunas.push(`${semId} nome(s) do boletim sem correspondência na lista oficial de deputados; identificador deixado em branco`);
  const porTipo = {};
  for (const v of votos) porTipo[v.voto] = (porTipo[v.voto] || 0) + 1;
  const resTxt = lido.resultado || null;
  const resultado = resTxt ? (RESULTADOS[resTxt.toLowerCase()] ?? null) : null;
  if (!resTxt) lacunas.push('Resultado não consta do boletim');
  else if (!resultado) lacunas.push(`Resultado registrado no boletim como "${resTxt}"`);
  if (!proposicaoId) lacunas.push('Proposição votada identificada só pelo título do boletim (sem correspondência única na API de proposições)');
  if (desc.duvidas || assunto.duvidas) lacunas.push('Texto com trecho em análise de privacidade (nome possivelmente de particular)');
  if (votos.some((v) => v.voto === 'Ausente' && v.hora_registro)) lacunas.push('Há registros "Ausente" com horário no boletim; reproduzidos como constam');
  const bol = numeroBoletim(item.arquivo);
  const reg = {
    id: `es-rvp-${item.id}`,
    uf: UF,
    casa: CASA,
    data: ini.data,
    hora: ini.hora,
    orgao: 'Plenário',
    orgao_sigla: 'PLEN',
    orgao_nome: 'Plenário da Assembleia Legislativa do Estado do Espírito Santo',
    sessao: { texto: cab.sessao, inicio: cab.inicio, termino: cab.termino },
    turno: cab.turno,
    proposicao: {
      id: proposicaoId ? `es-${proposicaoId}` : null, id_oficial: proposicaoId, sigla: tit.sigla, numero: tit.numero, ano: tit.ano,
      objeto: tit.objeto, titulo_boletim: cab.titulo,
      url: proposicaoId ? `${API}/proposicao/?proposicaoID=${proposicaoId}` : null,
    },
    descricao: desc.texto,
    descricao_abertura: cab.titulo,
    resultado,
    resultado_texto_oficial: resTxt,
    tipo: 'nominal',
    modo_texto_oficial: cab.modo,
    placar: { sim: lido.totais.sim, nao: lido.totais.nao, abstencao: lido.totais.abstencao, obstrucao: null, outros: null },
    votos_por_tipo: porTipo,
    placar_origem: 'totais-oficiais',
    conferencia_placar: `As ${votos.length} linhas do boletim conferem com os totais impressos (Sim, Não e Abstenção).`,
    votos_situacao: 'coletados',
    votos,
    boletim: { id_oficial: item.id, numero: bol.numero, ano: bol.ano, protocolo: item.protocolo || null, assunto_protocolo: assunto.texto, emitido_em: cab.emitido_em },
    fonte: {
      titulo: `Boletim de Votação Nominal${bol.numero ? ` nº ${bol.numero}/${bol.ano}` : ''} — ${cab.titulo || ''} (${cab.sessao || ''})`,
      url: item.arquivo, url_dados: `${API}/proposicao/?proposicaoID=${item.id}`, orgao: ORGAO, acessado_em: hoje,
    },
    documento_sha256: sha256,
    url: item.arquivo,
    lacunas: [...lacunas, 'Placar: o boletim não traz total de obstrução nem de "Ausente"/"Não votou" (ver votos_por_tipo)'],
  };
  verificarPrivacidade(reg);
  return reg;
}
