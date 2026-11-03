// ALRN — API eLegis da Transparência Legislativa (sem documentação pública; rotas e códigos tirados do
// próprio site transparencialegislativa.al.rn.leg.br, arquivo /bundle.js). Funções puras de montagem:
// recebem o JSON da fonte e devolvem os registros no formato de dados/esquema.json (+ uf, casa).
// Privacidade: a rota de parlamentares traz CPF e data de nascimento; aqui só são lidos campos
// escolhidos um a um (nada é copiado em bloco). O nome do assessor das comissões também é descartado.
import { textoPublico, dataISO } from './base.mjs';

export const API = 'https://api-transparencialegislativa.al.rn.leg.br/elegis-api-transp-legislativa';
export const SITE = 'https://transparencialegislativa.al.rn.leg.br';
export const ORGAO = 'Assembleia Legislativa do Estado do Rio Grande do Norte (ALRN)';
export const UF = 'RN';
export const CASA = 'alrn';

// Códigos do próprio site (bundle.js): voto 0 = Não, 1 = Sim, 2 = Abstenção.
export const VOTOS = { 0: 'Não', 1: 'Sim', 2: 'Abstenção' };
// Tipo de votação: A = Aberto, S = Secreto, O = Ostensivo, X = Simbólico.
export const TIPOS_VOTACAO = {
  A: { tipo: 'nominal', texto: 'Votação aberta (nominal)' },
  S: { tipo: 'secreta', texto: 'Votação secreta' },
  O: { tipo: 'ostensiva', texto: 'Votação ostensiva' },
  X: { tipo: 'simbolica', texto: 'Votação simbólica' },
};
// Resultado: A = Aprovada, R = Rejeitada, X = Retirado de pauta, N = Não apreciado.
export const RESULTADOS = {
  A: { resultado: 'aprovada', texto: 'Aprovada' },
  R: { resultado: 'rejeitada', texto: 'Rejeitada' },
  X: { resultado: null, texto: 'Retirado de pauta' },
  N: { resultado: null, texto: 'Não apreciado' },
};
// Tipos de proposição que entram no índice (os demais — requerimentos, ofícios, comunicações,
// indicações, títulos honoríficos — só aparecem quando têm votação).
export const SIGLAS_INDICE = new Set(['PL', 'PLC', 'PEC', 'PDL', 'PRES', 'VET', 'MSG']);

const lacunaVoto = 'Informação não disponível em fonte oficial';

/** Sigla da proposição; a Mensagem do Governo vem com sigla vazia. */
export function siglaDe(p) {
  const t = p?.propositura?.tipo || {};
  if (t.sigla) return String(t.sigla).trim();
  if (/^MENSAGEM$/i.test(String(t.descricao || '').trim())) return 'MSG';
  return null;
}

export function urlProjeto(id) { return `${SITE}/projeto/${id}`; }

/** Parlamentar (campos escolhidos; CPF e data de nascimento nunca são lidos). */
export function montarParlamentar(p, hoje) {
  const filiacoes = Array.isArray(p.filiacoes) ? p.filiacoes : [];
  const vigentes = filiacoes.filter((f) => !f?.vigencia?.fim || dataISO(f.vigencia.fim) >= hoje);
  const atual = vigentes.sort((a, b) => String(b?.vigencia?.inicio).localeCompare(String(a?.vigencia?.inicio)))[0];
  const fimMandato = dataISO(p?.vigencia?.fim);
  return {
    id: String(p.id),
    uf: UF,
    casa: CASA,
    nome: p.nomeParlamentar || null,
    nome_civil: p?.pessoa?.nome || null,
    partido: atual?.partido?.nome || null,
    em_exercicio: !fimMandato || fimMandato >= hoje,
    mandato: { inicio: dataISO(p?.vigencia?.inicio), fim: fimMandato },
    filiacoes: filiacoes.map((f) => ({ partido: f?.partido?.nome || null, inicio: dataISO(f?.vigencia?.inicio), fim: dataISO(f?.vigencia?.fim) }))
      .sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))),
    foto: null,
    url_oficial: `${SITE}/parlamentar/${p.id}`,
    email: null,
  };
}

/** Proposição para o índice anual. */
export function montarProposicao(p, { hoje, situacao = null, temVotacao = false, regras = [] }) {
  const em = textoPublico(p.ementa, regras);
  const ini = p.iniciativa || {};
  const pubs = (Array.isArray(p.publicacao) ? p.publicacao : [])
    .filter((x) => x?.origem?.data)
    .sort((a, b) => String(b.origem.data).localeCompare(String(a.origem.data)));
  const pub = pubs[0];
  const sigla = siglaDe(p);
  return {
    id: `rn-${p.id}`,
    id_oficial: p.id,
    uf: UF,
    casa: CASA,
    sigla,
    tipo: p?.propositura?.tipo?.descricao?.trim() || null,
    numero: p?.propositura?.numero ?? null,
    ano: p?.propositura?.ano ?? null,
    descricao: sigla ? `${sigla} ${p?.propositura?.numero ?? '?'}/${p?.propositura?.ano ?? '?'}` : null,
    processo: { numero: p.numero ?? null, ano: p.ano ?? null },
    ementa: em.texto,
    ...(em.duvidas ? { privacidade_pendente: true } : {}),
    data_apresentacao: dataISO(p.dataEntrada),
    autor: {
      nome: ini.descricao || null,
      tipo: ini.tipo || null,
      parlamentar_id: ini?.parlamentar?.id != null ? String(ini.parlamentar.id) : null,
      partido: ini?.parlamentar?.partido?.nome || null,
    },
    comissoes: (Array.isArray(p.comissao) ? p.comissao : []).map((c) => ({ sigla: c.sigla || null, nome: c.descricao || null, relator: c.relator || null })),
    informacao_lei: p.informacaoLei || null,
    data_arquivamento: dataISO(p.dataArquivamento),
    ultima_publicacao: pub ? { data: dataISO(pub.origem.data), texto: pub.observacao || null, url: pub.linkDOE || null } : null,
    situacao,
    tem_votacao: temVotacao,
    url: urlProjeto(p.id),
    fonte_dados: `${API}/processo/${p.id}`,
  };
}

/** Última tramitação (a lista vem da mais recente para a mais antiga). */
export function situacaoDaTramitacao(lista, hoje) {
  const t = (Array.isArray(lista) ? lista : []).filter((x) => x?.origem?.data)
    .sort((a, b) => String(b.origem.data).localeCompare(String(a.origem.data)))[0];
  if (!t) return null;
  return {
    texto: t?.situacaoProcesso?.nome?.trim() || null,
    setor: t?.origem?.setor?.nome?.trim() || null,
    data: dataISO(t.origem.data),
    url_diario: t.linkDOE || null,
    coletada_em: hoje,
  };
}

/**
 * Votação de uma reunião. proc: item do processo (ultimas-votacoes ou processo/{id});
 * reuniao: item de processo/{id}/reunioes; det: processo/{id}/detalhamento-votacao/{reuniao}.
 */
export function montarVotacao(proc, reuniao, det, { hoje, regras = [] }) {
  const lacunas = [];
  const problemas = [];
  const codTipo = det?.tipoVotacao ?? null;
  const tv = TIPOS_VOTACAO[codTipo] || null;
  const codRes = reuniao?.resultadoVotacao?.resultadoVotacao ?? null;
  const res = RESULTADOS[codRes] || null;
  const r = det?.reuniao || {};
  const comissao = (reuniao?.reuniaoComissao || r.reuniaoComissao || [])[0]?.comissao || null;
  const ehComissao = !!comissao;
  const sigla = siglaDe(proc);
  const em = textoPublico(proc.ementa, regras);
  const dados = Array.isArray(det?.votacao?.dados) ? det.votacao.dados : [];
  const resumo = det?.votacao?.resumo || null;
  const obst = Array.isArray(det?.obstrucao?.dados) ? det.obstrucao.dados : [];
  const pessoa = (x) => ({
    parlamentar_id: x?.id != null ? String(x.id) : null, nome: x?.nomeParlamentar || null, partido: x?.partido?.nome || null,
  });

  let placar = null;
  let votos = [];
  let comparecimento;
  let conferencia;
  let votosSituacao = "inexistentes-na-fonte";
  if (!tv) {
    lacunas.push(`Tipo de votação "${codTipo}" sem correspondência na legenda do site oficial; votos individuais não publicados`);
    conferencia = 'Tipo de votação desconhecido: nada conferido.';
  } else if (tv.tipo === 'nominal' && !dados.length) {
    // Votação aberta sem nenhum registro de voto: o resumo vem zerado e não é placar.
    lacunas.push(`Voto individual e placar: ${lacunaVoto} (votação aberta sem registros de voto na fonte; resumo zerado).`);
    conferencia = 'Sem registros de voto na fonte; resumo zerado não publicado como placar.';
  } else if (tv.tipo === 'nominal') {
    placar = resumo ? { sim: resumo.sim ?? null, nao: resumo.nao ?? null, abstencao: resumo.abstencao ?? null, obstrucao: det?.obstrucao?.total ?? obst.length, outros: null } : null;
    // Conferência: cada código precisa ter legenda e a contagem tem de bater com o resumo oficial.
    const cont = { 0: 0, 1: 0, 2: 0 };
    for (const d of dados) {
      if (!(d?.voto in VOTOS)) problemas.push(`código de voto desconhecido: ${JSON.stringify(d?.voto)}`);
      else cont[d.voto]++;
    }
    if (!resumo) problemas.push('resumo oficial (sim/não/abstenção) ausente');
    else {
      if (cont[1] !== resumo.sim) problemas.push(`Sim: ${cont[1]} votos × resumo ${resumo.sim}`);
      if (cont[0] !== resumo.nao) problemas.push(`Não: ${cont[0]} votos × resumo ${resumo.nao}`);
      if (cont[2] !== resumo.abstencao) problemas.push(`Abstenção: ${cont[2]} votos × resumo ${resumo.abstencao}`);
    }
    if (det?.votacao?.total != null && det.votacao.total !== dados.length) problemas.push(`total ${det.votacao.total} × ${dados.length} registros`);
    if (!dados.length) problemas.push('nenhum voto individual registrado');
    if (!problemas.length) {
      votos = dados.map((d) => ({ ...pessoa(d.parlamentar), uf: UF, voto: VOTOS[d.voto], voto_codigo: String(d.voto) }))
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
      votosSituacao = "coletados";
      conferencia = `Os ${votos.length} votos individuais conferem com o resumo oficial da votação (Sim, Não e Abstenção).`;
    } else {
      lacunas.push('Votos individuais não publicados: a contagem dos registros não conferiu com o resumo oficial. Consulte a página oficial.');
      votosSituacao = "nao-conferidos";
      conferencia = 'Votos individuais não conferidos; placar copiado do resumo oficial.';
    }
  } else if (tv.tipo === 'secreta') {
    placar = resumo ? { sim: resumo.sim ?? null, nao: resumo.nao ?? null, abstencao: resumo.abstencao ?? null, obstrucao: det?.obstrucao?.total ?? obst.length, outros: null } : null;
    // Na votação secreta a fonte só registra quem votou ("votou"): é comparecimento, não voto.
    comparecimento = dados.map((d) => ({ ...pessoa(d.parlamentar), situacao: d?.voto === 'votou' ? 'votou' : String(d?.voto ?? '') }))
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    lacunas.push(`Voto individual: ${lacunaVoto} (votação secreta). A lista de comparecimento registra só quem votou.`);
    votosSituacao = "nao-se-aplica";
    conferencia = 'Placar copiado do resumo oficial da votação secreta.';
  } else {
    // Ostensiva ou simbólica: a fonte não registra voto individual nem placar.
    lacunas.push(`Voto individual e placar: ${lacunaVoto} (${tv.texto.toLowerCase()}).`);
    conferencia = 'Sem placar na fonte.';
  }
  if (!res) lacunas.push(`Resultado: código "${codRes}" sem legenda na fonte oficial`);
  else if (!res.resultado) lacunas.push(`Resultado registrado como "${res.texto}"`);
  if (em.duvidas) lacunas.push('Ementa com trecho em análise de privacidade (nome possivelmente de particular)');

  const presenca = (Array.isArray(det?.presenca?.dados) ? det.presenca.dados : []).map((x) => ({
    ...pessoa(x), registro: x?.evento?.chave || 'sem registro',
  })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

  const urlDados = `${API}/processo/${proc.id}/detalhamento-votacao/${reuniao.id}`;
  const desc = sigla ? `${sigla} ${proc?.propositura?.numero}/${proc?.propositura?.ano}` : (proc?.propositura?.tipo?.descricao || 'Proposição');
  return {
    id: `rn-${proc.id}-${reuniao.id}`,
    uf: UF,
    casa: CASA,
    data: dataISO(r.dataInicio || reuniao.dataInicio),
    hora: null,
    orgao: ehComissao ? 'comissão' : 'Plenário',
    orgao_sigla: ehComissao ? (comissao.sigla || null) : 'PLEN',
    orgao_nome: ehComissao ? (comissao.nome || null) : 'Plenário da Assembleia Legislativa do Estado do Rio Grande do Norte',
    sessao: { id: r.id ?? reuniao.id, numero: r.numero ?? null, tipo: r?.tipoReuniao?.nome || reuniao?.tipoReuniao?.nome || null, remota: r.remota ?? null },
    proposicao: {
      id: `rn-${proc.id}`, id_oficial: proc.id, sigla, tipo: proc?.propositura?.tipo?.descricao?.trim() || null,
      numero: proc?.propositura?.numero ?? null, ano: proc?.propositura?.ano ?? null,
      ementa: em.texto, url: urlProjeto(proc.id),
    },
    descricao: null,
    resultado: res ? res.resultado : null,
    resultado_texto_oficial: res ? res.texto : null,
    resultado_codigo: codRes,
    tipo: tv ? tv.tipo : null,
    tipo_texto_oficial: tv ? tv.texto : null,
    tipo_codigo: codTipo,
    placar,
    placar_origem: placar ? 'totais-oficiais' : null,
    conferencia_placar: conferencia,
    votos_situacao: votosSituacao,
    votos,
    ...(comparecimento ? { comparecimento } : {}),
    obstrucao: obst.map(pessoa),
    presenca,
    registrado_em: (() => {
      // A rota de reuniões não traz os horários; a lista de últimas votações traz os da votação mais recente.
      const rv = reuniao?.resultadoVotacao?.dataSituacaoAbertura ? reuniao.resultadoVotacao
        : (proc?.resultadoVotacao?.id != null && proc.resultadoVotacao.id === reuniao?.resultadoVotacao?.id ? proc.resultadoVotacao : {});
      return { abertura: rv.dataSituacaoAbertura || null, fechamento: rv.dataSituacaoFechamento || null };
    })(),
    fonte: {
      titulo: `Votação — ${desc} (${r?.tipoReuniao?.nome || 'reunião'} de ${dataISO(r.dataInicio) || '?'}) — Transparência Legislativa da ALRN`,
      url: urlProjeto(proc.id), url_dados: urlDados, orgao: ORGAO, acessado_em: hoje,
    },
    url: urlProjeto(proc.id),
    lacunas: [
      ...lacunas,
      'Descrição do que foi votado: a fonte não traz texto próprio; vale a proposição indicada',
      'Hora: a fonte registra horários sem fuso declarado (campo registrado_em, texto da fonte)',
    ],
    ...(problemas.length ? { problemas_leitura: problemas.slice(0, 20) } : {}),
  };
}
