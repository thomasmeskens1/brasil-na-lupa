// Pernambuco — Assembleia Legislativa (ALEPE). Fontes:
//   deputados:   https://dadosabertos.alepe.pe.gov.br/api/v1/parlamentares/?formato=json   (JSON: nome e partido)
//   projetos:    https://dadosabertos.alepe.pe.gov.br/api/v1/proposicoes/projetos/?ano=AAAA (XML; pública, fora da documentação)
//   detalhe:     .../proposicoes/projetos/?docid=N&tipoprop=p  (histórico, resultado de cada discussão, autógrafo e nº da lei)
//   normas:      https://legis.alepe.pe.gov.br/lista.aspx?tiponorma=T  (HTML; lista do ano corrente: leis, LCs, decretos do Executivo, ECs)
// O XML traz só o RESULTADO de cada discussão em Plenário ("APROVADA EM PRIMEIRA DISCUSSÃO"), sem a forma da votação
// nem o voto de cada deputado: tipo null e voto individual "Informação não disponível em fonte oficial".
// Funções de interpretação puras (testadas offline em testes.mjs); a rede fica em coletarPE().
import { lerXml, filho, filhos, textoDe, decodificar } from './xml.mjs';
import { limpar, dataISO, textoPublico, chaveNome, slug, fonte, VOTO_INDISPONIVEL, LACUNA_PRIVACIDADE } from './base.mjs';

export const CASA_PE = {
  uf: 'PE', casa: 'alepe', nome: 'Assembleia Legislativa do Estado de Pernambuco (ALEPE)',
  api: 'https://dadosabertos.alepe.pe.gov.br/api/v1', legis: 'https://legis.alepe.pe.gov.br',
  site: 'https://proposicoes.alepe.pe.gov.br',
};
// Siglas usadas pela própria ALEPE para os tipos de projeto (sistema de proposições).
export const SIGLAS_PE = {
  'PROJETO DE LEI ORDINÁRIA': 'PLO', 'PROJETO DE LEI COMPLEMENTAR': 'PLC', 'PROPOSTA DE EMENDA A CONSTITUIÇÃO': 'PEC',
  'PROJETO DE RESOLUÇÃO': 'PR', 'PROJETO DE LEI ORÇAMENTÁRIA ANUAL': 'LOA', 'PROJETO DE LEI DE DIRETRIZES ORÇAMENTÁRIAS': 'LDO',
  'PROJETO DE PLANO PLURIANUAL': 'PPA', 'PROJETO DE DECRETO LEGISLATIVO': 'PDL',
};
// Tipo de norma da lista do legis.alepe → prefixo do id e tipo exibido.
export const TIPOS_NORMA_PE = {
  1: { tipo: 'Lei', prefixo: 'lei', rotulo: /^Lei Ordin[aá]ria/i },
  2: { tipo: 'Lei Complementar', prefixo: 'lc', rotulo: /^Lei Complementar/i },
  6: { tipo: 'Decreto', prefixo: 'dec', rotulo: /^Decreto/i },
  13: { tipo: 'Emenda Constitucional', prefixo: 'ec', rotulo: /^Emenda Constitucional/i },
};
// Tipo do projeto → tipo de norma que o autógrafo gera (para ligar projeto e lei pelo número oficial).
const NORMA_DO_PROJETO = { PLO: 'lei', LOA: 'lei', LDO: 'lei', PPA: 'lei', PLC: 'lc', PEC: 'ec' };

// ---------------------------------------------------------------- deputados
export function interpretarParlamentaresPE(lista, hoje) {
  const itens = (Array.isArray(lista) ? lista : []).map((r) => {
    const nome = limpar(r?.nomeParlamentar);
    if (!nome) return null;
    return {
      id: slug(nome), uf: 'PE', casa: CASA_PE.casa, nome, partido: limpar(r.partido),
      em_exercicio: null, foto: null, email: null, url_oficial: null,
      lacunas: ['A API de dados abertos da ALEPE traz só o nome e o partido: sem identificador, mandato, foto ou situação de exercício.'],
    };
  }).filter(Boolean);
  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    atualizado_em: hoje, uf: 'PE', casa: CASA_PE.casa,
    fonte: fonte('Parlamentares — Dados Abertos da ALEPE', `${CASA_PE.api}/parlamentares/?formato=json`, CASA_PE.nome, hoje),
    itens,
  };
}

// ---------------------------------------------------------------- projetos (lista)
export function interpretarListaPE(xml, hoje, parlamentares = []) {
  const raiz = lerXml(xml);
  const porNome = new Map(parlamentares.map((p) => [chaveNome(p.nome), p.id]));
  return filhos(raiz, 'projeto').map((p) => {
    const a = p.attrs;
    const docid = Number(a.docid);
    if (!Number.isFinite(docid)) return null;
    const tipo = limpar(a.tipo);
    const sigla = SIGLAS_PE[tipo] || null;
    const numero = Number(a.numero) || null;
    const ano = Number(a.ano) || null;
    const em = textoPublico(a.ementa);
    const lacunas = [];
    if (!sigla) lacunas.push(`Sigla do tipo "${tipo}" não conhecida pelo coletor.`);
    if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
    const autores = filhos(filho(p, 'autores'), 'autor').map((au) => autorPE(au.attrs, porNome, lacunas));
    return {
      id: `pe-${docid}`, id_oficial: docid, uf: 'PE', casa: CASA_PE.casa, sigla, tipo, numero, ano,
      identificacao: sigla && numero && ano ? `${sigla} ${numero}/${ano}` : null,
      legislatura: limpar(a.legislatura), data_publicacao: dataISO(a.dataPublicacao, hoje), data_apresentacao: null,
      ementa: em.texto, autores, situacao: null,
      url: `${CASA_PE.site}/proposicoes/detalhes?docid=${docid}&tipoprop=p`,
      fonte_dados: `${CASA_PE.api}/proposicoes/projetos/?docid=${docid}&tipoprop=p`,
      privacidade_pendente: em.pendente || undefined, lacunas: [...new Set(lacunas)],
    };
  }).filter(Boolean);
}

function autorPE(attrs, porNome, lacunas) {
  const tipo = limpar(attrs.tipo);
  const bruto = limpar(attrs.nome);
  // Deputado e comissão ficam; autor externo (governador, tribunais, cidadãos) passa pelo mascaramento de particulares.
  let nome = bruto;
  if (tipo !== 'DEPUTADO' && tipo !== 'COMISSAO') {
    const t = textoPublico(bruto);
    nome = t.texto;
    if (t.pendente) lacunas.push(LACUNA_PRIVACIDADE);
  }
  return { nome, tipo, parlamentar_id: tipo === 'DEPUTADO' ? porNome.get(chaveNome(bruto)) ?? null : null };
}

// ---------------------------------------------------------------- projeto (detalhe)
/** Detalhe → { situacao, discussoes: [{ data, resultado }], lei: { numero, resultado, assinatura } | null, regime }. */
export function interpretarDetalhePE(xml, hoje) {
  const p = lerXml(xml);
  if (!p || p.tag !== 'projeto') return null;
  const eventos = filhos(filho(p, 'historico'), 'evento').map((e) => ({ data: dataISO(e.attrs.data, hoje), acao: textoDe(e, 'acao') })).filter((e) => e.acao);
  const ultimo = [...eventos].reverse().find((e) => e.data) || eventos[eventos.length - 1] || null;
  const discussoes = filhos(filho(p, 'historicoResultado'), 'discussao').map((d) => ({ data: dataISO(d.attrs.data, hoje), resultado: textoDe(d, 'resultado') })).filter((d) => d.resultado);
  const aut = filho(p, 'autografo');
  const numLei = aut ? Number(String(textoDe(aut, 'lei') || '').replace(/\D/g, '')) || null : null;
  const datasAut = Object.fromEntries(filhos(filho(aut, 'datas'), 'data').map((d) => [d.attrs.tipo, dataISO(d.texto, hoje)]));
  return {
    resultado_final: textoDe(p, 'resultadoFinal'), regime: textoDe(p, 'regimeTramitacao'), lotacao: textoDe(p, 'lotacaoAtual'),
    ultimo_evento: ultimo, eventos, discussoes,
    lei: numLei ? { numero: numLei, resultado: textoDe(aut, 'resultado'), data_assinatura: datasAut.assinatura || null, data_envio_executivo: datasAut.envioExecutivo || null } : null,
    tem_justificativa: Boolean(textoDe(p, 'justificativa')),
  };
}

/** Aplica o detalhe ao item da lista (só campos oficiais; texto literal da fonte). */
export function aplicarDetalhePE(item, det, hoje) {
  const situacao = {
    texto: det.resultado_final || det.ultimo_evento?.acao || null,
    etapa: det.resultado_final || null,
    lotacao: det.lotacao, regime: det.regime,
    ultima_tramitacao: det.ultimo_evento ? { data: det.ultimo_evento.data, descricao: det.ultimo_evento.acao } : null,
    url_norma: null,
  };
  const pref = NORMA_DO_PROJETO[item.sigla];
  const lei = det.lei ? { ...det.lei, chave_norma: pref ? `${pref}-${det.lei.numero}` : null } : null;
  return {
    ...item, situacao, situacao_coletada_em: hoje, discussoes: det.discussoes, lei_gerada: lei,
    justificativa_oficial: det.tem_justificativa ? `Texto da justificativa do autor na página oficial: ${item.url}` : null,
  };
}

/** Uma "votação" por discussão em Plenário com resultado de aprovação ou rejeição registrado. */
export function votacoesDoProjetoPE(item, hoje) {
  const out = [];
  (item.discussoes || []).forEach((d, i) => {
    if (!/APROVAD|REJEITAD/i.test(d.resultado || '')) return;
    out.push({
      id: `pe-${item.id_oficial}-${i + 1}`, uf: 'PE', casa: CASA_PE.casa, data: d.data, hora: null, orgao: 'Plenário',
      sessao: null, etapa: null,
      proposicao: { id: item.id, sigla: item.sigla, tipo: item.tipo, numero: item.numero, ano: item.ano, ementa: item.ementa, url: item.url },
      descricao: `${item.identificacao || item.id}: ${d.resultado}`,
      resultado: null, resultado_texto_oficial: d.resultado, resultado_oficial: d.resultado,
      tipo: null, placar: null, votos_situacao: 'inexistentes-na-fonte', votos: [],
      url: item.url, fonte: fonte('Histórico de resultados da proposição — Dados Abertos da ALEPE', item.fonte_dados, CASA_PE.nome, hoje),
      lacunas: [
        'Forma da votação (nominal, simbólica ou secreta): não informada pela fonte, que registra só o resultado da discussão.',
        `Voto individual: ${VOTO_INDISPONIVEL}.`,
        'Sessão: a fonte informa só a data.',
      ],
    });
  });
  return out;
}

// ---------------------------------------------------------------- normas (legis.alepe)
const tirarTags = (s) => limpar(decodificar(String(s).replace(/<[^>]+>/g, ' ')));
export function interpretarListaNormasPE(html, tiponorma, hoje) {
  const def = TIPOS_NORMA_PE[tiponorma];
  if (!def) return [];
  const out = [];
  for (const tr of String(html).match(/<tr[\s\S]*?<\/tr>/g) || []) {
    const a = /<span class="nome-norma">\s*<a href='texto\.aspx\?id=(\d+)[^>]*>([\s\S]*?)<\/a>/.exec(tr);
    if (!a) continue;
    const nomeOficial = tirarTags(a[2]);
    if (!def.rotulo.test(nomeOficial || '')) continue;
    const num = /n[°º]\s*([\d.]+)/i.exec(nomeOficial || '');
    const numero = num ? Number(num[1].replace(/\./g, '')) : null;
    const pub = /Publicad[ao] no DOE\s*(\d{2}\/\d{2}\/\d{4})/i.exec(tr);
    const dataPub = pub ? dataISO(pub[1], hoje) : null;
    const em = /<td class="ementa-norma[^"]*">\s*<div class="fLeft">([\s\S]*?)<\/div>/.exec(tr);
    const ementa = textoPublico(em ? tirarTags(em[1]) : null);
    const id = Number(a[1]);
    const ano = dataPub ? Number(dataPub.slice(0, 4)) : null;
    out.push({
      id: `${def.prefixo}-${numero ?? id}-${ano ?? 'sem-ano'}`, id_oficial: id, uf: 'PE', casa: CASA_PE.casa,
      tipo: def.tipo, numero, ano, nome_oficial: nomeOficial, data_assinatura: null, data_publicacao: dataPub,
      publicacao: dataPub ? 'Diário Oficial do Estado de Pernambuco' : null, ementa: ementa.texto,
      url: `${CASA_PE.legis}/texto.aspx?id=${id}&tipo=TEXTOORIGINAL`,
      url_dados_referenciais: `${CASA_PE.legis}/dadosReferenciais.aspx?id=${id}`,
      fonte: fonte(`Legislação Estadual — ${def.tipo} (ALEPE)`, `${CASA_PE.legis}/lista.aspx?tiponorma=${tiponorma}`, CASA_PE.nome, hoje),
      privacidade_pendente: ementa.pendente || undefined,
      lacunas: [
        'Data de assinatura: não informada na lista; ver o texto oficial.',
        ...(dataPub ? [] : ['Data de publicação no Diário Oficial: não informada na lista.']),
        ...(ementa.pendente ? [LACUNA_PRIVACIDADE] : []),
      ],
    });
  }
  return out;
}

/** Liga norma ↔ projeto quando o autógrafo do projeto cita o número da lei (e o tipo bate). */
export function ligarNormasPE(normas, projetos) {
  // Numeração das leis de PE é sequencial e única por tipo: a chave é tipo + número (sem o ano).
  const porChave = new Map(normas.map((n) => [n.id.replace(/-[^-]+$/, ''), n]));
  for (const p of projetos) {
    const k = p.lei_gerada?.chave_norma;
    const n = k ? porChave.get(k) : null;
    if (!n) continue;
    n.projeto_origem = { id: p.id, identificacao: p.identificacao, sigla: p.sigla, numero: p.numero, ano: p.ano, url: p.url };
    if (p.lei_gerada.data_assinatura && !n.data_assinatura) {
      n.data_assinatura = p.lei_gerada.data_assinatura;
      n.lacunas = n.lacunas.filter((l) => !/^Data de assinatura/.test(l));
      n.data_assinatura_fonte = 'autógrafo do projeto (Dados Abertos da ALEPE)';
    }
    if (p.situacao) p.situacao.url_norma = n.url;
  }
}
