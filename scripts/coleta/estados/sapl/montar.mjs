// Montagem dos arquivos publicados a partir dos registros normalizados e das tabelas de apoio.
// Funções puras. Formato: definições de dados/esquema.json (parlamentar, votacao, norma) + uf e casa.
import { TIPO_VOTACAO, ROTULO_TIPO_VOTACAO, VOTO_INDISPONIVEL, LACUNA_PRIVACIDADE } from './normalizar.mjs';

const semVazios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** Índices das tabelas de apoio (gravadas em tabelas.json) para consulta rápida. */
export function indexarTabelas(t) {
  const mapa = (lista) => new Map((lista || []).map((x) => [x.id, x]));
  const filiacoes = new Map();
  for (const f of t.filiacoes || []) {
    if (!filiacoes.has(f.parlamentar_id)) filiacoes.set(f.parlamentar_id, []);
    filiacoes.get(f.parlamentar_id).push(f);
  }
  return {
    bruto: t,
    tiposMateria: mapa(t.tipos_materia), tiposResultado: mapa(t.tipos_resultado), tiposNorma: mapa(t.tipos_norma),
    tiposSessao: mapa(t.tipos_sessao), status: mapa(t.status_tramitacao), partidos: mapa(t.partidos),
    parlamentares: mapa(t.parlamentares), autores: mapa(t.autores), filiacoes,
    legislatura: t.legislatura_atual || null, mandatos: t.mandatos || [],
  };
}

/** Sigla do partido do parlamentar numa data, pela filiação registrada no SAPL (null se ausente ou ambígua). */
export function partidoEm(tab, parlamentarId, data) {
  if (!data) return null;
  const fs = (tab.filiacoes.get(parlamentarId) || []).filter((f) => f.inicio && f.inicio <= data && (!f.fim || f.fim >= data));
  const siglas = [...new Set(fs.map((f) => tab.partidos.get(f.partido_id)?.sigla).filter(Boolean))];
  return siglas.length === 1 ? siglas[0] : null;
}

export function fonte(ctx, titulo, caminho) {
  return { titulo, url: `https://${ctx.cfg.host}${caminho}`, orgao: ctx.cfg.nome, acessado_em: ctx.hoje };
}

// ---------------------------------------------------------------- parlamentares
export function montarParlamentares(ctx) {
  const { tab, cfg, hoje } = ctx;
  const leg = tab.legislatura;
  const porParl = new Map();
  for (const m of tab.mandatos.filter((x) => leg && x.legislatura_id === leg.id)) {
    if (!porParl.has(m.parlamentar_id)) porParl.set(m.parlamentar_id, []);
    porParl.get(m.parlamentar_id).push(m);
  }
  const itens = [];
  for (const [pid, ms] of porParl) {
    const p = tab.parlamentares.get(pid) || {};
    const vigente = ms.find((m) => m.inicio && m.inicio <= hoje && (!m.fim || m.fim >= hoje) && !m.afastado && !m.fim_causa);
    itens.push(semVazios({
      id: String(pid), nome: p.nome || null, nome_civil: p.nome_civil || null,
      partido: partidoEm(tab, pid, hoje), uf: cfg.uf, casa: cfg.casa,
      em_exercicio: Boolean(vigente) && p.ativo !== false,
      titular: ms.some((m) => m.titular === true),
      mandatos: ms.map((m) => ({ inicio: m.inicio, fim: m.fim, titular: m.titular })).sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))),
      foto: p.foto || null, url_oficial: `https://${cfg.host}/parlamentar/${pid}`,
      email: p.email_institucional || null,
    }));
  }
  itens.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  return {
    atualizado_em: hoje, uf: cfg.uf, casa: cfg.casa,
    legislatura: leg ? { numero: leg.numero, inicio: leg.inicio, fim: leg.fim } : null,
    fonte: fonte(ctx, `Mandatos da ${leg?.numero ?? ''}ª legislatura — SAPL da ${cfg.nome}`, `/api/parlamentares/mandato/?legislatura=${leg?.id ?? ''}`),
    itens,
  };
}

// ---------------------------------------------------------------- proposições
export function rotuloMateria(ctx, m) {
  const t = ctx.tab.tiposMateria.get(m.tipo_id);
  return { sigla: t?.sigla || null, tipo: t?.descricao || null, identificacao: t ? `${t.sigla} ${m.numero}/${m.ano}` : null };
}

export function montarProposicao(ctx, m) {
  const { tab, cfg } = ctx;
  const r = rotuloMateria(ctx, m);
  const autores = (m.autores_ids || []).map((aid) => {
    const a = tab.autores.get(aid);
    return a ? { nome: a.nome, parlamentar_id: a.parlamentar_id != null ? String(a.parlamentar_id) : null } : null;
  }).filter(Boolean);
  const tr = m.ultima_tramitacao;
  const lacunas = [...(m.lacunas || [])];
  if ((m.autores_ids || []).length && autores.length < m.autores_ids.length) lacunas.push('Autoria: tabela de autores ainda não coletada por completo.');
  if (m.privacidade_pendente || tr?.privacidade_pendente) lacunas.push(LACUNA_PRIVACIDADE);
  return semVazios({
    id: `${cfg.uf.toLowerCase()}-${m.id}`, id_oficial: m.id, uf: cfg.uf, casa: cfg.casa,
    sigla: r.sigla, tipo: r.tipo, numero: m.numero, ano: m.ano, identificacao: r.identificacao,
    data_apresentacao: m.data_apresentacao, ementa: m.ementa, apelido: m.apelido || null,
    em_tramitacao: m.em_tramitacao, autores, situacao: tr ? {
      texto: tr.texto, status: tab.status.get(tr.status_id)?.descricao || null, data: tr.data,
    } : null,
    url: `https://${cfg.host}/materia/${m.id}`, url_texto: m.texto_original,
    fonte_dados: `https://${cfg.host}/api/materia/materialegislativa/${m.id}/`,
    // campos internos do coletor (reconstrução do registro na execução seguinte)
    tipo_id: m.tipo_id, autores_ids: m.autores_ids, ultima_tramitacao: tr || null, atualizado_fonte: m.atualizado_fonte,
    privacidade_pendente: m.privacidade_pendente, lacunas: [...new Set(lacunas)],
  });
}

// ---------------------------------------------------------------- normas
function prefixoNorma(desc) {
  const d = String(desc || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/lei complementar/.test(d)) return 'lc';
  if (/lei delegada/.test(d)) return 'ld';
  if (/^lei/.test(d)) return 'lei';
  if (/decreto legislativo/.test(d)) return 'dl';
  if (/decreto/.test(d)) return 'dec';
  if (/resolu/.test(d)) return 'res';
  if (/emenda/.test(d)) return 'ec';
  return d.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'norma';
}

export function montarNorma(ctx, n) {
  const { tab, cfg } = ctx;
  const t = tab.tiposNorma.get(n.tipo_id);
  const lacunas = [...(n.lacunas || [])];
  if (n.privacidade_pendente) lacunas.push(LACUNA_PRIVACIDADE);
  const mat = n.materia_id != null ? ctx.materias.get(n.materia_id) : null;
  return semVazios({
    id: `${prefixoNorma(t?.descricao)}-${String(n.numero || '').replace(/\D/g, '') || n.id}-${n.ano}`,
    id_oficial: n.id, uf: cfg.uf, casa: cfg.casa,
    tipo: t?.descricao || null, sigla_tipo: t?.sigla || null, numero: n.numero, ano: n.ano,
    nome_oficial: n.nome_oficial, data: n.data, data_publicacao: n.data_publicacao,
    publicacao: n.veiculo_publicacao, ementa: n.ementa, esfera: n.esfera === 'E' ? 'estadual' : n.esfera,
    projeto_origem: n.materia_id != null ? {
      id: `${cfg.uf.toLowerCase()}-${n.materia_id}`, identificacao: mat ? rotuloMateria(ctx, mat).identificacao : null,
      url: `https://${cfg.host}/materia/${n.materia_id}`,
    } : null,
    url: `https://${cfg.host}/norma/${n.id}`, url_texto: n.texto_integral,
    fonte: fonte(ctx, n.nome_oficial || 'Norma jurídica — SAPL', `/api/norma/normajuridica/${n.id}/`),
    tipo_id: n.tipo_id, materia_id: n.materia_id, veiculo_publicacao: n.veiculo_publicacao, atualizado_fonte: n.atualizado_fonte,
    privacidade_pendente: n.privacidade_pendente, lacunas: [...new Set(lacunas)],
  });
}

// ---------------------------------------------------------------- sessões
export function montarSessao(ctx, s) {
  const { tab, cfg } = ctx;
  return semVazios({
    id: `${cfg.uf.toLowerCase()}-${s.id}`, id_oficial: s.id, uf: cfg.uf, casa: cfg.casa,
    nome: s.nome, tipo: tab.tiposSessao.get(s.tipo_id)?.nome || null, numero: s.numero,
    data_inicio: s.data_inicio, hora_inicio: s.hora_inicio, data_fim: s.data_fim, hora_fim: s.hora_fim,
    url: `https://${cfg.host}/sessao/${s.id}`, url_resumo: `https://${cfg.host}/sessao/${s.id}/resumo`,
    url_video: s.url_video, url_audio: s.url_audio, pauta_pdf: s.pauta_pdf, ata_pdf: s.ata_pdf,
    tipo_id: s.tipo_id, lacunas: s.lacunas || [],
  });
}

export function montarItemPauta(ctx, it) {
  const mat = it.materia_id != null ? ctx.materias.get(it.materia_id) : null;
  return semVazios({
    ...it,
    etapa_nome: it.etapa === 'ordemdia' ? 'Ordem do Dia' : 'Expediente',
    materia: mat ? rotuloMateria(ctx, mat).identificacao : null,
    tipo_votacao_nome: ROTULO_TIPO_VOTACAO[it.tipo_votacao] || null,
  });
}

// ---------------------------------------------------------------- votações
/**
 * reg: registro normalizado (ou null se só os votos chegaram); votos: [{ parlamentar_id, voto }].
 * situacaoVotos(reg, votos, tipo) → 'coletados' | 'inexistentes-na-fonte' | 'em-coleta'.
 */
export function montarVotacao(ctx, idOficial, reg, votos, situacaoVotos) {
  const { tab, cfg } = ctx;
  const lacunas = [...(reg?.lacunas || [])];
  const item = reg ? ctx.pauta.get(reg.ordem_id != null ? `ordemdia-${reg.ordem_id}` : `expedientemateria-${reg.expediente_id}`) : null;
  const sessao = item?.sessao_id != null ? ctx.sessoes.get(item.sessao_id) : null;
  const materiaId = reg?.materia_id ?? item?.materia_id ?? null;
  const mat = materiaId != null ? ctx.materias.get(materiaId) : null;
  const tipoNum = item?.tipo_votacao ?? null;
  const tipo = TIPO_VOTACAO[tipoNum] || null;
  if (reg && !item) lacunas.push('Tipo de votação (nominal, simbólica ou secreta): item da pauta ainda não coletado.');
  else if (item && !tipo) lacunas.push(`Tipo de votação registrado na fonte: ${ROTULO_TIPO_VOTACAO[tipoNum] || 'não informado'}.`);
  if (!reg) lacunas.push('Registro da votação (resultado e totais) ainda não coletado; só os votos individuais.');
  const tr = reg ? tab.tiposResultado.get(reg.tipo_resultado_id) : null;
  const nat = String(tr?.natureza || '').toLowerCase();
  const resultado = /^a/.test(nat) ? 'aprovada' : /^r/.test(nat) ? 'rejeitada' : null;
  if (reg && !resultado) lacunas.push('Resultado: ver o texto oficial em "resultado_oficial".');
  const totais = reg ? { sim: reg.sim, nao: reg.nao, abstencao: reg.abstencao } : null;

  let listaVotos = [];
  let placar = null;
  let placarOrigem = null;
  let conferencia = null;
  const situacao = situacaoVotos(reg, votos, tipo);
  if (tipo === 'nominal') {
    listaVotos = votos.map((v) => {
      const p = tab.parlamentares.get(v.parlamentar_id);
      return {
        parlamentar_id: String(v.parlamentar_id), nome: p?.nome || null,
        partido: partidoEm(tab, v.parlamentar_id, reg?.data || null), uf: cfg.uf, voto: v.voto,
      };
    }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    if (listaVotos.some((v) => !v.nome)) lacunas.push('Nome de parlamentar ainda não coletado para parte dos votos.');
    if (listaVotos.some((v) => !v.partido)) lacunas.push('Partido: filiação na data da votação não registrada no SAPL para parte dos votos (exibir "Informação não disponível em fonte oficial").');
    if (totais && tipo === 'nominal') {
      placar = { sim: totais.sim, nao: totais.nao, abstencao: totais.abstencao, obstrucao: null, outros: null };
      placarOrigem = 'totais-oficiais';
      if (situacao === 'coletados') {
        const c = (x) => votos.filter((v) => v.voto === x).length;
        const confere = c('Sim') === totais.sim && c('Não') === totais.nao && c('Abstenção') === totais.abstencao;
        conferencia = confere
          ? `Totais do registro oficial conferem com a contagem dos ${votos.length} votos individuais.`
          : `Totais do registro oficial (${totais.sim} Sim, ${totais.nao} Não, ${totais.abstencao} Abstenção) diferem da contagem dos votos individuais (${c('Sim')}, ${c('Não')}, ${c('Abstenção')}); guardados como a fonte traz.`;
        if (!confere) lacunas.push(conferencia);
      }
    }
    if (tipo === 'nominal' && situacao === 'inexistentes-na-fonte') {
      lacunas.push(`Voto individual: ${VOTO_INDISPONIVEL} (votação nominal sem registro de voto por deputado no SAPL).`);
    }
    if (situacao === 'em-coleta') lacunas.push('Votos individuais ainda em coleta (carga incremental); não exibir como ausência.');
  } else if (tipo === 'secreta') {
    if (totais) { placar = { sim: totais.sim, nao: totais.nao, abstencao: totais.abstencao, obstrucao: null, outros: null }; placarOrigem = 'totais-oficiais'; }
    lacunas.push('Votação secreta: votos individuais não são atribuídos.');
  } else if (tipo === 'simbolica') {
    lacunas.push(`Votação simbólica: voto individual — ${VOTO_INDISPONIVEL}. Os números lançados no registro ficam em "totais_registrados" e não são votos de deputados.`);
    if (votos.length) lacunas.push(`A fonte tem ${votos.length} registros por parlamentar para este item, mas o tipo de votação registrado é simbólica; não são exibidos como votos individuais.`);
  }
  if (tipo == null && votos.length) lacunas.push(`${votos.length} votos por parlamentar já coletados, exibidos só depois de confirmado na pauta que a votação é nominal.`);
  if (reg?.privacidade_pendente) lacunas.push(LACUNA_PRIVACIDADE);
  const r = mat ? rotuloMateria(ctx, mat) : null;
  return semVazios({
    id: `${cfg.uf.toLowerCase()}-${idOficial}`, id_oficial: idOficial, uf: cfg.uf, casa: cfg.casa,
    data: reg?.data || null, hora: reg?.hora || null, orgao: 'Plenário',
    sessao: sessao ? { id: `${cfg.uf.toLowerCase()}-${sessao.id}`, nome: sessao.nome, data: sessao.data_inicio, url: `https://${cfg.host}/sessao/${sessao.id}/resumo` } : null,
    etapa: item ? (item.etapa === 'ordemdia' ? 'Ordem do Dia' : 'Expediente') : null,
    numero_item: item?.numero_ordem ?? null,
    proposicao: materiaId != null ? {
      id: `${cfg.uf.toLowerCase()}-${materiaId}`, sigla: r?.sigla || null, tipo: r?.tipo || null,
      numero: mat?.numero ?? null, ano: mat?.ano ?? null, ementa: mat?.ementa ?? null, url: `https://${cfg.host}/materia/${materiaId}`,
    } : null,
    descricao: item ? `${item.etapa === 'ordemdia' ? 'Ordem do Dia' : 'Expediente'}, item ${item.numero_ordem ?? '—'}${r?.identificacao ? ` — ${r.identificacao}` : ''}` : null,
    resultado, resultado_oficial: tr?.nome || null, resultado_pauta: item?.resultado || null, observacao_oficial: reg?.observacao || null,
    tipo, placar, placar_origem: placarOrigem, conferencia_placar: conferencia,
    totais_registrados: tipo === 'simbolica' ? totais : undefined,
    votos_situacao: situacao, votos: listaVotos,
    registrado_em: reg?.registrado_em || null,
    url: sessao ? `https://${cfg.host}/sessao/${sessao.id}/resumo` : null,
    fonte: fonte(ctx, 'Registro de votação — SAPL', `/api/sessao/registrovotacao/${idOficial}/`),
    fonte_votos: fonte(ctx, 'Votos por parlamentar — SAPL', `/api/sessao/votoparlamentar/?votacao=${idOficial}`),
    registro_fonte: reg || null,
    lacunas: [...new Set(lacunas)],
  });
}

export function resumoVotacao(v) {
  return semVazios({
    id: v.id, data: v.data, hora: v.hora, sessao: v.sessao?.nome || null,
    proposicao: v.proposicao ? (v.proposicao.sigla ? `${v.proposicao.sigla} ${v.proposicao.numero}/${v.proposicao.ano}` : v.proposicao.id) : null,
    descricao: v.descricao, resultado: v.resultado, resultado_oficial: v.resultado_oficial, tipo: v.tipo,
    placar: v.placar, votos_situacao: v.votos_situacao, n_votos: v.votos.length,
  });
}
