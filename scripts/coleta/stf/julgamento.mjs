// Monta dados/stf/julgamentos/<id>.json (formato "julgamento" de dados/esquema.json) a partir de:
// acórdão publicado (API de jurisprudência), Plenário Virtual (votos), pauta (ambiente da sessão) e lista de temas.
import { normalizarEspacos, entidades, chaveNome } from './lib.mjs';
import { fonte, urlProcessoPublico, urlVotacaoSessaoVirtual, urlVotacaoTema, urlPautaProcesso, urlPesquisaJurisprudencia, URL_TODOS_TEMAS, urlTese } from './fontes.mjs';
import { paragrafoFinal, sessaoDoTexto, partesDaDecisao, participacao, redatorNoTexto } from './texto.mjs';
import { votacaoDaLista, votacoesDoTema, divergentes } from './votos.mjs';

export const LACUNA_ACORDAO = 'Aguardando publicação do acórdão';
const SEM_VOTO_PRESENCIAL = 'Julgamento presencial: voto individual de cada ministro não disponível em fonte oficial estruturada (Informação não disponível em fonte oficial)';

export const idJulgamento = (identificacao) => 'stf-' + identificacao.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function decompor(identificacao) {
  const m = identificacao.match(/^([A-Za-z]+) (\d+)(?: (.+))?$/);
  if (!m) throw new Error(`identificação inválida: ${identificacao}`);
  return { classe: m[1].toUpperCase(), numero: m[2], sufixo: m[3] ?? null };
}
const limparHtml = (s) => (s ? normalizarEspacos(entidades(String(s).replace(/<p>/gi, '\n').replace(/<[^>]+>/g, ' '))) || null : null);
const temNomes = (lista, nome) => { const a = chaveNome(nome).split(' '); return lista.some((x) => { const b = chaveNome(x).split(' '); return a.every((t) => b.includes(t)) || b.every((t) => a.includes(t)); }); };

/** Acórdão do julgamento: o mais recente julgado a partir de `inicio`; descartado se anterior à última sessão virtual. */
function escolherAcordao(acordaos, inicio, ultimaLista) {
  const c = (acordaos ?? []).filter((a) => (a.julgamento_data ?? '') >= inicio).sort((a, b) => b.julgamento_data.localeCompare(a.julgamento_data));
  if (!c.length) return { acordao: null, motivo: null };
  const a = c[0];
  const iniLista = ultimaLista ? ultimaLista.sessao.inicio : null;
  if (iniLista && iniLista > a.julgamento_data) return { acordao: null, motivo: `acórdão publicado (${a.titulo}, julgado em ${a.julgamento_data}) é anterior à última sessão virtual (${iniLista})` };
  return { acordao: a, motivo: null };
}

/** Última passagem do processo pela pauta (só o processo principal: descricaoCadeia vazia). */
function ultimaPauta(pauta) {
  const ps = pauta.flatMap((g) => g.processos ?? []).filter((p) => !p.descricaoCadeia && p.dataInicio);
  const iso = (s) => s.split('/').reverse().join('-');
  ps.sort((a, b) => iso(a.dataInicio).localeCompare(iso(b.dataInicio)) || (a.tipoSessao === 'L') - (b.tipoSessao === 'L'));
  const p = ps[ps.length - 1];
  return p ? { ambiente: p.ambienteSessao === 'F' ? 'presencial' : p.ambienteSessao === 'V' ? 'virtual' : null, inicio: iso(p.dataInicio), fim: p.dataFim ? iso(p.dataFim) : null, julgado: p.situacaoProcessoSessao === 'J', id_lista: p.idListaJulgamento ?? null, bruto: { ambienteSessao: p.ambienteSessao, situacaoProcessoSessao: p.situacaoProcessoSessao } } : null;
}

/**
 * caso: { id, identificacao, incidente, tema?, relacionados[], observacao? }
 * src: { acordaos[], sv (listasDoIncidente), temaPv (processoLeadingCase|null), pauta[]|null, tema (montarTema)|null }
 */
export function montarJulgamento(caso, src, { indice, hoje, inicio, colecao }) {
  const { classe, numero, sufixo } = decompor(caso.identificacao);
  const lacunas = [];
  const fontes = [];
  let situacao = 'automatico-estruturado';
  const listas = src.sv?.listas ?? [];
  const ultimaListaBruta = listas[listas.length - 1] ?? null;
  const ultimaLista = ultimaListaBruta ? { ...ultimaListaBruta, sessao: { ...ultimaListaBruta.sessao, inicio: ultimaListaBruta.sessao.dataInicio.split('/').reverse().join('-'), fim: ultimaListaBruta.sessao.dataFim?.split('/').reverse().join('-') ?? null } } : null;

  // Conferência de identidade do incidente
  if (src.sv?.identificacao && src.sv.identificacao !== caso.identificacao) {
    lacunas.push(`Identificação do incidente no Plenário Virtual ("${src.sv.identificacao}") difere da esperada ("${caso.identificacao}")`);
    situacao = 'pendente';
  }
  const { acordao, motivo } = escolherAcordao(src.acordaos, inicio, ultimaLista);
  if (motivo) lacunas.push(`Acórdão publicado não corresponde ao último julgamento: ${motivo}`);
  if (acordao && acordao.titulo.replace(/ RG$/, '') !== caso.identificacao.replace(/ RG$/, '')) {
    lacunas.push(`Título do acórdão ("${acordao.titulo}") difere da identificação esperada ("${caso.identificacao}")`);
    situacao = 'pendente';
  }

  const certidao = acordao ? paragrafoFinal(acordao.acordao_ata) : null;
  if (!acordao) lacunas.push(LACUNA_ACORDAO);
  else if (!certidao) lacunas.push('Texto da decisão não disponível no acórdão publicado (Informação não disponível em fonte oficial)');

  // Sessão
  let sessao = { ambiente: null, inicio: null, fim: null, trecho: null, origem: null };
  const pauta = src.pauta ? ultimaPauta(src.pauta) : null;
  const ehRg = Boolean(acordao && / RG$/.test(acordao.titulo)) || (!acordao && !ultimaLista && src.temaPv);
  if (certidao) {
    const s = sessaoDoTexto(certidao);
    if (s.ambiente) sessao = { ...s, origem: 'texto da decisão do acórdão' };
    else if (ehRg && src.temaPv) sessao = { ambiente: 'virtual', inicio: null, fim: null, trecho: null, origem: 'Plenário Virtual da repercussão geral' };
  } else if (ultimaLista?.ministroDestaque) {
    sessao = { ambiente: 'presencial', inicio: pauta?.ambiente === 'presencial' ? pauta.inicio : null, fim: null, trecho: null, origem: `destaque registrado no Plenário Virtual (${normalizarEspacos(ultimaLista.ministroDestaque.descricao)})${pauta?.ambiente === 'presencial' ? ' e pauta do Plenário' : ''}` };
  } else if (pauta?.ambiente === 'presencial' && (!ultimaLista || pauta.inicio >= ultimaLista.sessao.inicio)) {
    sessao = { ambiente: 'presencial', inicio: pauta.inicio, fim: pauta.fim, trecho: null, origem: 'pauta do Plenário' };
  } else if (ultimaLista && !ultimaLista.ministroVista && !ultimaLista.ministroDestaque && ultimaLista.sessao.fim && ultimaLista.sessao.fim < hoje
    && (!pauta || (pauta.ambiente === 'virtual' && pauta.inicio === ultimaLista.sessao.inicio))) {
    sessao = { ambiente: 'virtual', inicio: ultimaLista.sessao.inicio, fim: ultimaLista.sessao.fim, trecho: null, origem: 'última lista do Plenário Virtual (sem vista nem destaque) e pauta do Plenário' };
  } else if (ehRg && src.temaPv) {
    sessao = { ambiente: 'virtual', inicio: null, fim: null, trecho: null, origem: 'Plenário Virtual da repercussão geral' };
  }
  if (!sessao.ambiente) lacunas.push('Ambiente da sessão de julgamento (virtual ou presencial) não confirmado em fonte permitida');

  // Partes da decisão (texto literal)
  const part = certidao ? participacao(certidao) : null;
  const partes = certidao ? partesDaDecisao(certidao) : [];
  const votacoes = partes.map((p) => ({
    origem: 'certidao',
    parte: p.parte,
    partes_citadas: p.partes_citadas,
    resultado: p.resultado,
    trecho: p.trecho,
    vencidos: p.vencidos,
    vencidos_trechos: p.vencidos_trechos,
    impedidos: part.impedidos.nomes,
    ausentes: part.ausentes.nomes,
    presidente: part.presidente,
    votos: [],
  }));
  if (certidao && !partes.length) lacunas.push('O texto da decisão não registra "por unanimidade" nem "por maioria": resultado da votação não disponível em fonte oficial');
  if (partes.some((p) => p.vencidos_so_cargo.length)) lacunas.push('Vencido identificado no texto só pelo cargo (ex.: "Relator"); nome não copiado');
  if (partes.some((p) => p.resultado === 'unanimidade' && p.vencidos.length)) { lacunas.push('Trecho com "por unanimidade" e "vencido" ao mesmo tempo: conferir'); situacao = 'pendente'; }
  if (partes.some((p) => !p.parte)) lacunas.push('Em algum item, o trecho não nomeia uma única parte da decisão (mérito, tese, modulação…): parte fica em branco e o trecho literal acompanha o resultado');

  // Votos individuais: só Plenário Virtual
  let conferencia = { resultado: 'nao-aplicavel', detalhe: null };
  if (sessao.ambiente === 'presencial') {
    lacunas.push(SEM_VOTO_PRESENCIAL);
  } else if (ehRg && src.temaPv) {
    const { votacoes: vs, problemas } = votacoesDoTema(src.temaPv, { indice, tema: caso.tema });
    if (problemas.length) { lacunas.push(`Correspondência de ministros não conferida: ${problemas.join('; ')}`); situacao = 'pendente'; }
    votacoes.push(...vs);
    fontes.push(fonte(`Plenário Virtual – votação da repercussão geral do Tema ${caso.tema}`, urlVotacaoTema(caso.tema), hoje));
  } else if (sessao.ambiente === 'virtual' && ultimaLista) {
    const datasConferem = !sessao.inicio || (sessao.inicio === ultimaLista.sessao.inicio && sessao.fim === ultimaLista.sessao.fim);
    if (!datasConferem) {
      lacunas.push(`A última lista do Plenário Virtual (${ultimaLista.sessao.inicio} a ${ultimaLista.sessao.fim}) não corresponde à sessão registrada no texto da decisão (${sessao.inicio} a ${sessao.fim}); votos individuais não atribuídos`);
    } else {
      const { votacao, descartados, problemas } = votacaoDaLista(ultimaListaBruta, { incidente: caso.incidente, indice });
      if (descartados.length) lacunas.push(`Votos descartados da lista do Plenário Virtual (cópias de outras sessões ou repetidos): ${descartados.join('; ')}`);
      if (problemas.length) { lacunas.push(`Correspondência código → nome não conferida em ministros.json: ${problemas.join('; ')}`); situacao = 'pendente'; }
      // Conferência com a certidão: só quando há uma única votação por maioria, sem redator e sem o relator entre os vencidos.
      const maiorias = votacoes.filter((v) => v.origem === 'certidao' && v.resultado === 'maioria');
      const relatorNome = votacao.relator?.ministro ?? '';
      const redator = acordao?.relator_acordao_nome || (certidao ? redatorNoTexto(certidao) : null);
      if (certidao && partes.length) {
        const div = divergentes(votacao);
        if (partes.every((p) => p.resultado === 'unanimidade')) {
          conferencia = div.length ? { resultado: 'diverge', detalhe: `texto oficial registra unanimidade; Plenário Virtual registra divergência de ${div.join(', ')}` } : { resultado: 'coincide', detalhe: 'unanimidade no texto oficial; nenhum voto de divergência no Plenário Virtual' };
        } else if (maiorias.length === 1 && partes.length === 1 && !redator && !temNomes(maiorias[0].vencidos, relatorNome)) {
          const venc = maiorias[0].vencidos;
          const ok = venc.length === div.length && venc.every((n) => temNomes(div, n));
          conferencia = ok ? { resultado: 'coincide', detalhe: `vencidos do texto oficial (${venc.join(', ')}) = votos de divergência no Plenário Virtual` } : { resultado: 'diverge', detalhe: `vencidos do texto oficial: ${venc.join(', ') || 'nenhum'}; divergência no Plenário Virtual: ${div.join(', ') || 'nenhuma'}` };
        } else conferencia = { resultado: 'nao-aplicavel', detalhe: 'decisão com várias partes, redator para o acórdão ou relator vencido: comparação automática não se aplica' };
      }
      if (conferencia.resultado === 'diverge') {
        lacunas.push(`Votos do Plenário Virtual divergem do texto oficial da decisão (prevalece o texto oficial; votos não exibidos): ${conferencia.detalhe}`);
        votacao.votos = [];
      }
      if (!acordao) lacunas.push('Votos do Plenário Virtual exibidos conforme a última lista da sessão; o resultado oficial (texto da decisão) aguarda a publicação do acórdão');
      votacoes.push(votacao);
      fontes.push(fonte(`Plenário Virtual – listas de julgamento de ${caso.identificacao}`, urlVotacaoSessaoVirtual(caso.incidente), hoje));
    }
  } else {
    lacunas.push('Voto individual de cada ministro não disponível em fonte oficial estruturada');
  }

  // Relator / redator / órgão
  const relator = acordao?.relator_processo_nome ?? (ultimaLista?.ministroRelator?.descricao ? normalizarEspacos(ultimaLista.ministroRelator.descricao) : null) ?? src.tema?.relator ?? null;
  if (!relator) lacunas.push('Relator não disponível em fonte oficial');
  else if (/PRESIDENTE/i.test(relator) && !/MIN\. /.test(relator)) lacunas.push('Relator registrado na fonte como "Ministro Presidente"');
  const redator = acordao ? (acordao.relator_acordao_nome ?? null) : null;
  if (!acordao) lacunas.push('Data de julgamento não disponível em fonte permitida até a publicação do acórdão');

  // Precedente
  const ehControle = ['ADI', 'ADC', 'ADO', 'ADPF'].includes(classe);
  // Tese do próprio acórdão quando houver (ex.: RE 1490708 RG traz a redação original e a nota de alteração);
  // a tese atual do tema (página da tese) fica ao lado quando difere.
  const teseAcordao = limparHtml(acordao?.documental_tese_texto);
  const tese = teseAcordao ?? src.tema?.tese ?? null;
  const teseTemaDiferente = teseAcordao && src.tema?.tese && normalizarEspacos(src.tema.tese) !== normalizarEspacos(teseAcordao) ? src.tema.tese : undefined;
  const precedente = {
    tipo: caso.tema ? 'repercussao-geral' : ehControle ? 'controle-concentrado' : 'outro',
    numero: caso.tema ? String(caso.tema) : null,
    tese,
    tese_fonte: teseAcordao ? 'acórdão publicado (campo tese)' : tese ? 'página da tese do tema' : null,
    tese_atual_do_tema: teseTemaDiferente,
    questao: src.tema?.titulo ?? null,
    situacao_tema: src.tema ? src.tema.situacao : undefined,
    data_tese: src.tema?.data_tese ?? undefined,
  };
  if (!tese) lacunas.push('Tese não disponível em fonte oficial');

  // Fontes
  if (acordao) {
    fontes.unshift(fonte(`Acórdão ${acordao.titulo} – pesquisa de jurisprudência do STF`, urlPesquisaJurisprudencia(acordao.titulo), hoje));
    if (acordao.inteiro_teor_url) fontes.push(fonte(`Inteiro teor do acórdão ${acordao.titulo}`, acordao.inteiro_teor_url, hoje));
    if (acordao.dje_url) fontes.push(fonte(`Diário da Justiça eletrônico – ${acordao.titulo}`, acordao.dje_url, hoje));
  }
  if (src.pauta) fontes.push(fonte(`Pauta do Plenário – ${classe} ${numero}`, urlPautaProcesso(classe, numero), hoje));
  if (caso.tema) { fontes.push(fonte('Repercussão Geral – lista de todos os temas', URL_TODOS_TEMAS, hoje)); if (src.tema?.tese) fontes.push(fonte(`Tese do Tema ${caso.tema}`, urlTese(caso.tema), hoje)); }

  const conjunto = certidao && /julgamento conjunto/i.test(certidao) ? (certidao.match(/\(Julgamento conjunto[^)]*\)/i)?.[0] ?? null) : null;
  if (caso.observacao) lacunas.push(`Recorte: ${caso.observacao}`);

  return {
    id: caso.id,
    tribunal: 'stf',
    colecoes: [colecao],
    processo: { classe, numero, sufixo, identificacao: caso.identificacao, incidente_ou_registro: String(caso.incidente), url: urlProcessoPublico(caso.incidente) },
    julgamento_conjunto_trecho: conjunto,
    relacionados: caso.relacionados ?? [],
    precedente,
    orgao: acordao?.orgao_julgador ?? (ultimaLista?.sessao?.colegiado?.descricao ?? null),
    sessao: { ambiente: sessao.ambiente, inicio: sessao.inicio, fim: sessao.fim, trecho_oficial: sessao.trecho, origem: sessao.origem },
    relator,
    redator_acordao: redator,
    data_julgamento: acordao?.julgamento_data ?? null,
    data_publicacao: acordao?.publicacao_data ?? null,
    certidao_literal: certidao,
    certidao_fonte: acordao ? { titulo: `Acórdão ${acordao.titulo} (campo "decisão" da ata)`, url: acordao.inteiro_teor_url ?? urlPesquisaJurisprudencia(acordao.titulo) } : null,
    ementa: acordao?.ementa_texto ? acordao.ementa_texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join('\n') : null,
    participacao: part ? { ausentes: part.ausentes, impedidos: part.impedidos, suspeitos: part.suspeitos, nao_participaram: part.nao_participaram } : null,
    votacoes,
    conferencia_votos_x_certidao: conferencia,
    situacao_conferencia: situacao,
    acordao_atualizado_na_fonte_em: acordao?.dg_atualizado_em ?? null,
    fontes,
    lacunas: [...new Set(lacunas)],
    atualizado_em: hoje,
  };
}

export const resumoJulgamento = (j) => ({
  id: j.id, identificacao: j.processo.identificacao, tema: j.precedente.numero, tipo: j.precedente.tipo,
  data_julgamento: j.data_julgamento, data_publicacao: j.data_publicacao, ambiente: j.sessao.ambiente, relator: j.relator,
  resultados: j.votacoes.filter((v) => v.origem === 'certidao').map((v) => ({ parte: v.parte, resultado: v.resultado, vencidos: v.vencidos })),
  votos_plenario_virtual: j.votacoes.some((v) => v.origem === 'plenario-virtual' && v.votos.length),
  acordao_publicado: Boolean(j.certidao_literal), situacao_conferencia: j.situacao_conferencia, colecoes: j.colecoes,
});
