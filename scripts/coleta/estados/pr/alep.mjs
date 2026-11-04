// Paraná — Assembleia Legislativa (ALEP). Fontes oficiais:
//   API pública de dados abertos (documentada em https://transparencia.assembleia.pr.leg.br/servicos/dados-abertos;
//   só responde em http://; o robots.txt do host bloqueia apenas /api/account, /api/users, /management/ etc.):
//     POST /proposicao/filtrar {"ano":AAAA}       lista do ano (todos os tipos; ficam só os projetos)
//     GET  /proposicao/{codigo}                    trâmites e ações (resultado de cada turno na Ordem do Dia), normas geradas
//     POST /norma-legal/filtrar {"ano":AAAA}       leis, leis complementares, resoluções, decretos legislativos, emendas constitucionais
//     GET  /norma-legal/{codigo}                   movimentações (sanção/promulgação, Diário Oficial) e proposição de origem
//   Deputados: página HTML "Conheça os deputados" (https://www.assembleia.pr.leg.br/deputados/conheca), permitida pelo robots.txt.
// NÃO usado: o "Controle de Votações" do Portal da Transparência (caminho /api/ proibido pelo robots.txt e busca com
// reCAPTCHA). Por isso não há voto de deputado: tipo null e "Informação não disponível em fonte oficial".
// Funções de interpretação puras (testes.mjs); a rede fica em coletar.mjs.
import { Cliente, limpar, dataISO, textoPublico, chaveNome, fonte, VOTO_INDISPONIVEL, LACUNA_PRIVACIDADE } from '../abertos/base.mjs';

export const CASA_PR = {
  uf: 'PR', casa: 'alep', nome: 'Assembleia Legislativa do Estado do Paraná (ALEP)',
  api: 'http://webservices.assembleia.pr.leg.br/api/public',
  doc: 'https://transparencia.assembleia.pr.leg.br/servicos/dados-abertos',
  portal: 'https://www.assembleia.pr.leg.br',
  votacoes: 'https://transparencia.assembleia.pr.leg.br/plenario/controle-de-votacao',
};
export const LAI_PR = 'docs/pesquisa/pedidos-lai/pr.md';

// Tipos de proposição de /proposicao/campos (sigla oficial da ALEP), lidos em 04/11/2026. Só projetos e vetos entram.
export const TIPOS_PROP = {
  'PROJETO DE LEI': 'PRO', 'PROJETO DE LEI COMPLEMENTAR': 'PLC', 'PROJETO DECRETO LEGISLATIVO': 'PDL',
  'PROJETO DE RESOLUÇÃO': 'RES', 'PROPOSTA DE EMENDA À CONSTITUIÇÃO': 'PEC', VETO: 'VET',
};
// Tipos de norma legal (/norma-legal/campos). Atos, ofícios, portarias e designações (administração da Casa) ficam de fora.
export const TIPOS_NORMA = {
  1: { tipo: 'Lei', prefixo: 'lei' }, 2: { tipo: 'Lei Complementar', prefixo: 'lc' }, 3: { tipo: 'Resolução', prefixo: 'res' },
  4: { tipo: 'Decreto Legislativo', prefixo: 'dl' }, 5: { tipo: 'Emenda Constitucional', prefixo: 'ec' },
};

// ---------------------------------------------------------------- cliente HTTP
/** Cliente da base com robots.txt lido por http:// nos hosts que só respondem em http (a API da ALEP). */
export class ClienteHttp extends Cliente {
  constructor(op = {}) {
    super(op);
    this.soHttp = new Set(op.hostsSoHttp || []);
    const f = this.fetchImpl;
    this.fetchImpl = (url, o) => {
      const u = new URL(url);
      if (this.soHttp.has(u.host) && u.protocol === 'https:' && u.pathname === '/robots.txt') u.protocol = 'http:';
      return f(u.toString(), o);
    };
  }
  async _robots(host) {
    const r = await super._robots(host);
    if (this.soHttp.has(host)) r.url = `http://${host}/robots.txt`;
    return r;
  }
}

// ---------------------------------------------------------------- datas
/** "2026-09-09T03:00:00.000+0000" (UTC) → data no horário de Brasília (UTC−3, sem horário de verão desde 2019). */
export function dataBR(v, hoje) {
  const s = limpar(v);
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)([+-]\d{2}):?(\d{2})$/.exec(s);
  if (!m) return dataISO(s, hoje);
  const t = Date.parse(`${m[1]}T${m[2]}${m[3]}:${m[4]}`);
  if (!Number.isFinite(t)) return null;
  return dataISO(new Date(t - 3 * 3600000).toISOString().slice(0, 10), hoje);
}

// Números no formato de CPF ou RG (o e-Protocolo do Paraná usa o mesmo desenho, "12.345.678-9"): omitidos por precaução.
const NUM_DOC = /(?<![\d.\/])(?:\d{3}\.\d{3}\.\d{3}\s*-\s*\d{2}|\d{1,2}\.\d{3}\.\d{3}\s*-\s*[\dXx])(?![\d\/])/g;
export const NUMERO_OMITIDO = '[número omitido]';
export const LACUNA_NUMERO =
  'Número no formato de documento pessoal (CPF ou RG) omitido por precaução (diretriz 12); o texto completo está no documento oficial.';
/** textoPublico + omissão de números com formato de documento pessoal. { texto, pendente, omitiu }. */
export function textoSeguro(s) {
  const t = textoPublico(s);
  if (!t.texto) return { ...t, omitiu: false };
  const texto = t.texto.replace(NUM_DOC, NUMERO_OMITIDO);
  return { texto, pendente: t.pendente, omitiu: texto !== t.texto };
}

const milhar = (n) => (Number.isFinite(n) ? n.toLocaleString('pt-BR') : null);

// ---------------------------------------------------------------- deputados (HTML)
const tirarTags = (s) => limpar(String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"'));

export function interpretarDeputadosPR(html, hoje) {
  const itens = [];
  for (const bloco of String(html || '').split(/<div class="deputado-card/).slice(1)) {
    const card = bloco.split('</a>')[0];
    const slugM = /href="https:\/\/www\.assembleia\.pr\.leg\.br\/deputados\/perfil\/([a-z0-9-]+)"/.exec(card);
    const nome = tirarTags(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(card)?.[1]);
    if (!slugM || !nome) continue;
    const partido = tirarTags(/<p\s+class="text-gray-500 text-sm italic">([\s\S]*?)<\/p>/.exec(card)?.[1]);
    const cargo = tirarTags(/<p\s+class="[^"]*bg-green-500[^"]*">([\s\S]*?)<\/p>/.exec(card)?.[1]);
    const foto = /<img src="(https:\/\/storage2\.assembleia\.pr\.leg\.br\/[^"]+)"/.exec(card)?.[1] ?? null;
    itens.push({
      id: slugM[1], uf: 'PR', casa: CASA_PR.casa, nome, partido: partido || null,
      cargo_na_casa: cargo && !/^Deputad[oa]$/i.test(cargo) ? cargo : null,
      em_exercicio: null, foto, email: null, url_oficial: `${CASA_PR.portal}/deputados/perfil/${slugM[1]}`,
      lacunas: [
        ...(partido ? [] : ['Partido: não informado na página oficial (Informação não disponível em fonte oficial).']),
        'Lista da página "Conheça os deputados" da ALEP; o período de mandato e a situação de exercício não vêm nessa página.',
      ],
    });
  }
  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    atualizado_em: hoje, uf: 'PR', casa: CASA_PR.casa,
    fonte: fonte('Conheça os deputados — Assembleia Legislativa do Paraná', `${CASA_PR.portal}/deputados/conheca`, CASA_PR.nome, hoje),
    itens,
  };
}

// ---------------------------------------------------------------- autoria
/** "DEPUTADO X, DEPUTADA Y, PODER EXECUTIVO" → autores; deputado ligado só por nome idêntico ao da página oficial. */
export function autoresPR(texto, porNome, lacunas) {
  return (limpar(texto) || '').split(/\s*,\s*/).filter(Boolean).map((bruto) => {
    const m = /^DEPUTAD[OA]\s+(.+)$/i.exec(bruto);
    if (m) return { nome: bruto, tipo: 'DEPUTADO', parlamentar_id: porNome.get(chaveNome(m[1])) ?? null };
    if (/^(PODER|COMISS|MESA|TRIBUNAL|DEFENSORIA|MINIST|GOVERNAD|TODOS|LIDERAN|BANCADA)/i.test(bruto)) return { nome: bruto, tipo: null, parlamentar_id: null };
    const t = textoSeguro(bruto);
    if (t.pendente) lacunas.push(LACUNA_PRIVACIDADE);
    return { nome: t.texto, tipo: null, parlamentar_id: null };
  });
}

// ---------------------------------------------------------------- proposições
export function interpretarProposicaoPR(r, hoje, porNome = new Map()) {
  if (!Number.isFinite(r?.codigo)) return null;
  const tipo = limpar(r.tipoProposicao);
  const sigla = limpar(r.siglaTipoProposicao) || TIPOS_PROP[tipo] || null;
  if (!sigla || !Object.values(TIPOS_PROP).includes(sigla)) return null;
  const numero = Number.isFinite(r.numero) ? r.numero : null;
  const ano = Number.isFinite(r.ano) ? r.ano : null;
  const em = textoSeguro(r.ementa);
  const lacunas = ['Data de apresentação: é a data de recebimento registrada pela ALEP (campo "dataRecebimento" da API).'];
  if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
  if (em.omitiu) lacunas.push(LACUNA_NUMERO);
  const autores = autoresPR(r.autor, porNome, lacunas);
  const url = `${CASA_PR.api}/proposicao/${r.codigo}`;
  return {
    id: `pr-${r.codigo}`, id_oficial: r.codigo, uf: 'PR', casa: CASA_PR.casa, sigla, tipo, numero, ano,
    identificacao: numero && ano ? `${sigla} ${numero}/${ano}` : null,
    data_apresentacao: dataBR(r.dataRecebimento, hoje), data_publicacao: null,
    ementa: em.texto, autores, assunto: limpar(r.assunto),
    situacao: { texto: limpar(r.status), etapa: limpar(r.status), local_atual: limpar(r.localAtual), ultima_tramitacao: null, url_norma: null },
    situacao_coletada_em: hoje, detalhe_coletado_em: null,
    url, fonte_dados: url,
    privacidade_pendente: em.pendente || undefined, lacunas: [...new Set(lacunas)],
  };
}

const PLENARIO = /ORDEM DO DIA/i;
const DELIBERACAO = /APROVAD|REJEITAD/i;

/** Detalhe /proposicao/{codigo} → campos oficiais (trâmites resumidos, resultado de cada turno, normas geradas). */
export function interpretarDetalhePR(d, hoje) {
  if (!d || !Number.isFinite(d.codigo)) return null;
  const acoes = [];
  let omitiu = false;
  for (const t of d.tramites || []) {
    for (const a of t.acoes || []) {
      const ds = textoSeguro(a.descricao), ob = textoSeguro(a.observacao), lc = textoSeguro(t.local);
      const descricao = ds.texto;
      if (!descricao) continue;
      omitiu ||= ds.omitiu || ob.omitiu || lc.omitiu;
      acoes.push({ codigo: a.codigo, data: dataBR(a.data, hoje), local: lc.texto, descricao, observacao: ob.texto });
    }
  }
  const ordenadas = acoes.filter((a) => a.data).sort((x, y) => x.data.localeCompare(y.data) || (x.codigo ?? 0) - (y.codigo ?? 0));
  const ultima = ordenadas[ordenadas.length - 1] || null;
  const deliberacoes = acoes
    .filter((a) => PLENARIO.test(a.local || '') && DELIBERACAO.test(a.descricao) && !/DISPENSAD/i.test(a.descricao) && Number.isFinite(a.codigo))
    .map((a) => ({ codigo: a.codigo, data: a.data, descricao: a.descricao, observacao: a.observacao }));
  const normas = (d.normasLegais || []).filter((n) => Number.isFinite(n?.codigo)).map((n) => {
    const def = TIPOS_NORMA[n.codigoTipoNormaLegal];
    return { codigo: n.codigo, tipo: limpar(n.descricaoTipoNormaLegal), numero: n.numero ?? null, ano: n.ano ?? null, id: def && n.numero && n.ano ? `${def.prefixo}-${n.numero}-${n.ano}` : null };
  });
  return {
    regime_urgencia: limpar(d.regimeUrgencia), status: limpar(d.status), local_atual: limpar(d.localAtual), tipo_arquivamento: limpar(d.tipoArquivamento),
    ultima: ultima ? { data: ultima.data, descricao: ultima.observacao ? `${ultima.descricao}: ${ultima.observacao}` : ultima.descricao, local: ultima.local } : null,
    deliberacoes, normas, omitiu,
  };
}

export function aplicarDetalhePR(item, det, hoje) {
  if (!det) return item;
  return {
    ...item,
    situacao: {
      texto: det.status ?? item.situacao?.texto ?? null, etapa: det.status ?? item.situacao?.etapa ?? null,
      local_atual: det.local_atual ?? item.situacao?.local_atual ?? null, regime_urgencia: det.regime_urgencia,
      tipo_arquivamento: det.tipo_arquivamento,
      ultima_tramitacao: det.ultima ? { data: det.ultima.data, descricao: det.ultima.descricao, local: det.ultima.local } : null,
      url_norma: item.situacao?.url_norma ?? null,
    },
    situacao_coletada_em: hoje, detalhe_coletado_em: hoje,
    deliberacoes_plenario: det.deliberacoes, normas_geradas: det.normas,
    lacunas: det.omitiu ? [...new Set([...(item.lacunas || []), LACUNA_NUMERO])] : item.lacunas,
  };
}

/** Uma "votação" por deliberação registrada na Ordem do Dia (só o resultado; sem forma nem voto de deputado). */
export function votacoesDoProjetoPR(item, hoje) {
  return (item.deliberacoes_plenario || []).map((d) => {
    const resultado = d.observacao ? `${d.descricao} (${d.observacao})` : d.descricao;
    return {
      id: `pr-${d.codigo}`, uf: 'PR', casa: CASA_PR.casa, data: d.data, hora: null, orgao: 'Plenário',
      sessao: null, etapa: null,
      proposicao: { id: item.id, sigla: item.sigla, tipo: item.tipo, numero: item.numero, ano: item.ano, ementa: item.ementa, url: item.url },
      descricao: `${item.identificacao || item.id}: ${resultado}`,
      resultado: null, resultado_texto_oficial: resultado, resultado_oficial: resultado,
      tipo: null, placar: null, votos_situacao: 'inexistentes-na-fonte', votos: [],
      url: item.url, fonte: fonte('Trâmites da proposição — API pública de dados abertos da ALEP', item.fonte_dados, CASA_PR.nome, hoje),
      lacunas: [
        'Forma da votação (nominal, simbólica ou secreta) e placar: não informados pela API pública, que registra só o resultado na Ordem do Dia.',
        `Voto individual: ${VOTO_INDISPONIVEL}. O "Controle de Votações" da ALEP fica num caminho fechado a robôs pelo robots.txt e exige reCAPTCHA; não é acessado. Pedido pela Lei de Acesso à Informação (LAI) redigido em ${LAI_PR}.`,
        'Sessão: a API informa só a data do lançamento.',
      ],
    };
  });
}

// ---------------------------------------------------------------- normas
export function interpretarNormaPR(r, hoje) {
  if (!Number.isFinite(r?.codigo)) return null;
  const def = TIPOS_NORMA[r.codigoTipoNormaLegal];
  if (!def) return null;
  const numero = Number.isFinite(r.numero) ? r.numero : null;
  const ano = Number.isFinite(r.ano) ? r.ano : null;
  const em = textoSeguro(r.ementa);
  const diario = limpar(r.numeroDiarioOficialMovimentacao);
  const dataPub = dataBR(r.dataPublicacaoDiarioOficialMovimentacao, hoje);
  const url = `${CASA_PR.api}/norma-legal/${r.codigo}`;
  const lacunas = ['Proposição de origem: detalhe da norma ainda não coletado.'];
  if (!dataPub) lacunas.push('Publicação no Diário Oficial: não informada na API.');
  if (diario && !limpar(r.veiculoPublicacao)) lacunas.push('Veículo da publicação: a API informa o número do Diário Oficial, mas não o nome do diário.');
  if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
  if (em.omitiu) lacunas.push(LACUNA_NUMERO);
  return {
    id: `${def.prefixo}-${numero ?? r.codigo}-${ano ?? 'sem-ano'}`, id_oficial: r.codigo, uf: 'PR', casa: CASA_PR.casa,
    tipo: def.tipo, numero, ano, nome_oficial: numero && ano ? `${def.tipo} nº ${milhar(numero)}/${ano}` : null,
    data_assinatura: dataBR(r.data, hoje), data_publicacao: dataPub,
    publicacao: diario ? `${limpar(r.veiculoPublicacao) || 'Diário Oficial'} nº ${diario}` : null,
    conclusao: limpar(r.conclusaoMovimentacao), movimentacao: limpar(r.tipoMovimentacao),
    ementa: em.texto, autoria: limpar(r.autores), assunto: limpar(r.assunto),
    projeto_origem: null, url,
    fonte: fonte(`${def.tipo} — API pública de dados abertos da ALEP (normas legais)`, url, CASA_PR.nome, hoje),
    detalhe_coletado: false, privacidade_pendente: em.pendente || undefined, lacunas: [...new Set(lacunas)],
  };
}

/** Detalhe /norma-legal/{codigo}: movimentações e proposição(ões) de origem. */
export function aplicarDetalheNormaPR(item, d, hoje) {
  if (!d || d.codigo !== item.id_oficial) return item;
  const movs = (d.movimentacoes || []).map((m) => ({
    tipo: limpar(m.tipo), conclusao: limpar(m.conclusao), data: dataBR(m.data, hoje),
    data_publicacao: dataBR(m.dataPublicacaoDiarioOficial, hoje), diario_oficial: limpar(m.numeroDiarioOficial), observacao: textoSeguro(m.observacao).texto,
  })).filter((m) => m.tipo || m.data);
  const origens = (d.proposicoes || []).filter((p) => Number.isFinite(p?.codigo)).map((p) => {
    const tipo = limpar(p.tipoProposicao);
    const sigla = limpar(p.siglaTipoProposicao) || TIPOS_PROP[tipo] || null;
    return {
      id: `pr-${p.codigo}`, identificacao: sigla && p.numero && p.ano ? `${sigla} ${p.numero}/${p.ano}` : null, tipo,
      sigla, numero: p.numero ?? null, ano: p.ano ?? null, url: `${CASA_PR.api}/proposicao/${p.codigo}`,
    };
  });
  const lacunas = item.lacunas.filter((l) => !/^Proposição de origem/.test(l));
  if (!origens.length) lacunas.push('Proposição de origem: não informada no cadastro da norma.');
  const primeira = movs.find((m) => m.data_publicacao) || null;
  return {
    ...item, detalhe_coletado: true, movimentacoes: movs,
    data_publicacao: item.data_publicacao ?? primeira?.data_publicacao ?? null,
    publicacao: item.publicacao ?? (primeira?.diario_oficial ? `Diário Oficial nº ${primeira.diario_oficial}` : null),
    conclusao: item.conclusao ?? primeira?.conclusao ?? null, movimentacao: item.movimentacao ?? primeira?.tipo ?? null,
    projeto_origem: origens[0] || null, projetos_origem: origens.length > 1 ? origens : undefined,
    lacunas: [...new Set(lacunas)],
  };
}

/** Liga projeto ↔ norma pelo código oficial (normasLegais do projeto ou proposicoes da norma). */
export function ligarPR(normas, projetos) {
  const normaPorCodigo = new Map(normas.map((n) => [n.id_oficial, n]));
  const projPorId = new Map(projetos.map((p) => [p.id, p]));
  for (const p of projetos) {
    for (const g of p.normas_geradas || []) {
      const n = normaPorCodigo.get(g.codigo);
      if (!n) continue;
      if (!n.projeto_origem) {
        n.projeto_origem = { id: p.id, identificacao: p.identificacao, tipo: p.tipo, sigla: p.sigla, numero: p.numero, ano: p.ano, url: p.url };
        n.lacunas = n.lacunas.filter((l) => !/^Proposição de origem/.test(l));
      }
      if (p.situacao) p.situacao.url_norma = n.url;
    }
  }
  for (const n of normas) {
    const p = n.projeto_origem ? projPorId.get(n.projeto_origem.id) : null;
    if (p?.situacao && !p.situacao.url_norma) p.situacao.url_norma = n.url;
  }
}
