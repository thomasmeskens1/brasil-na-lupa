// Pará — Assembleia Legislativa (ALEPA). Fontes oficiais (pesquisa em docs/pesquisa/estados/pa.md):
//   Portal (ASP.NET MVC + DevExpress, HTML; robots.txt inexistente, HTTP 404):
//     GET  /Institucional/Deputados                             cartões dos 41 deputados (nome e partido; id no estado do componente)
//     POST /Legislativo/VotacoesNominais  Ano, Mes, Mes_VI      lista mensal das votações nominais
//     GET  /Legislativo/DetalhesVotacaoNominal?IdProposicao=&IdVotacao=   SIM / NÃO / ABSTENÇÃO / NÃO VOTARAM, com nome, partido e quantidade
//     POST /Legislativo/Proposicoes  Ano, DataInicio, DataFim, ComboBoxTipoProposicao(_VI)   cartões (10 por página)
//     GET  /Legislativo/DetalhesProposicao?IdProposicao=        situação, regime, votação no Plenário por turno
//   Banco de Leis (API aberta documentada em https://bancodeleis.alepa.pa.gov.br/api.php; robots.txt inexistente):
//     GET  /api/leis.php?ano=&tipo=&numero=                     até 50 resultados por chamada (sem paginação)
// Funções de interpretação puras (testes.mjs); a rede fica em coletar.mjs.
import { Cliente, limpar, dataISO, textoPublico, chaveNome, fonte, LACUNA_PRIVACIDADE } from '../abertos/base.mjs';

export const CASA_PA = {
  uf: 'PA', casa: 'alepa', nome: 'Assembleia Legislativa do Estado do Pará (ALEPA)',
  portal: 'https://www.alepa.pa.gov.br', leis: 'https://bancodeleis.alepa.pa.gov.br',
};
export const USER_AGENT_PA = 'BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)';

// Tipos do formulário de proposições (valores do componente, lidos em 04/11/2026). Só projetos entram.
export const TIPOS_PROP = {
  1: { sigla: 'PDL', tipo: 'Projeto de Decreto Legislativo', fonte: 'PROJETO DE DECRETO LEGISLATIVO' },
  2: { sigla: 'PEC', tipo: 'Proposta de Emenda à Constituição', fonte: 'PROJETO DE EMENDA CONSTITUCIONAL' },
  3: { sigla: 'PL', tipo: 'Projeto de Lei', fonte: 'PROJETO DE LEI ORDINÁRIA' },
  4: { sigla: 'PLC', tipo: 'Projeto de Lei Complementar', fonte: 'PROJETO DE LEI COMPLEMENTAR' },
  5: { sigla: 'PR', tipo: 'Projeto de Resolução', fonte: 'PROJETO DE RESOLUÇÃO' },
};
const SIGLA_POR_FONTE = new Map(Object.values(TIPOS_PROP).map((t) => [chaveNome(t.fonte), t]));

// Tipos do Banco de Leis (parâmetro "tipo", conferidos um a um em 04/11/2026).
export const TIPOS_NORMA = {
  3: { tipo: 'Lei', prefixo: 'lei', fonte: 'Lei Ordinária' },
  4: { tipo: 'Lei Complementar', prefixo: 'lc', fonte: 'Lei Complementar' },
  2: { tipo: 'Decreto', prefixo: 'dec', fonte: 'Decreto Estadual' },
  1: { tipo: 'Decreto Legislativo', prefixo: 'dl', fonte: 'Decreto Legislativo' },
  10: { tipo: 'Resolução', prefixo: 'res', fonte: 'Resoluções' },
  11: { tipo: 'Emenda Constitucional', prefixo: 'ec', fonte: 'Emendas Constitucionais Estaduais' },
};
export const LIMITE_API_LEIS = 50;

// ---------------------------------------------------------------- cliente HTTP
/** Cliente da base (robots.txt, intervalo, orçamento) com o User-Agent do Brasil na Lupa exigido para o Pará. */
export class ClientePA extends Cliente {
  constructor(op = {}) {
    super(op);
    const f = this.fetchImpl;
    this.fetchImpl = (url, o = {}) => f(url, { ...o, headers: { ...(o.headers || {}), 'User-Agent': USER_AGENT_PA } });
  }
  /** POST de formulário (application/x-www-form-urlencoded). */
  formulario(url, campos) {
    return this.texto(url, { metodo: 'POST', corpo: new URLSearchParams(campos).toString(), tipoCorpo: 'application/x-www-form-urlencoded', aceitar: 'text/html' });
  }
}

// ---------------------------------------------------------------- HTML
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ordm: 'º', ordf: 'ª', deg: '°' };
export const decodificar = (s) => String(s ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
export const textoHtml = (s) => limpar(decodificar(String(s ?? '').replace(/<[^>]+>/g, ' ')));
/** Só o conteúdo principal da página (descarta menus, que mudam sem afetar os dados). */
export const principal = (html) => { const h = String(html || ''); const i = h.indexOf('<main'); const f = h.lastIndexOf('</main>'); return i >= 0 && f > i ? h.slice(i, f) : h; };
const pageCount = (h) => { const m = /'pageCount':(\d+)/.exec(h); return m ? Number(m[1]) : null; };

// ---------------------------------------------------------------- deputados
export function interpretarDeputadosPA(html, hoje) {
  const h = principal(html);
  const keys = /'keys':\[([^\]]*)\]/.exec(h)?.[1]?.match(/'(\d+)'/g)?.map((k) => k.replace(/'/g, '')) || [];
  const lista = [...h.matchAll(/<img class='deputado-image' src='([^']*)'[\s\S]*?<div class='card-info'><span>([^<]*)<\/span><span>([^<]*)<\/span><p>([^<]*)<\/p>/g)];
  const itens = [];
  lista.forEach((m, i) => {
    const nome = textoHtml(m[3]);
    if (!nome) return;
    const id = keys.length === lista.length ? keys[i] : null;
    const partido = textoHtml(m[4]);
    const foto = /^https:\/\//.test(m[1]) ? m[1].replace(/\\/g, '/').replace(/\?timestamp=\d+$/, '').replace(/ /g, '%20') : null;
    itens.push({
      id: id ? `pa-${id}` : `pa-${chaveNome(nome).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, id_oficial: id ? Number(id) : null,
      uf: 'PA', casa: CASA_PA.casa, nome, tratamento: textoHtml(m[2]), partido: partido || null, cargo_na_casa: null, em_exercicio: null,
      foto, email: null, url_oficial: id ? `${CASA_PA.portal}/Institucional/Deputado/${id}` : `${CASA_PA.portal}/Institucional/Deputados`,
      lacunas: [
        ...(partido ? [] : ['Partido: não informado na página oficial (Informação não disponível em fonte oficial).']),
        'Lista da página "Deputados da 61ª legislatura" da ALEPA; o período de mandato e a situação de exercício não vêm nessa página.',
      ],
    });
  });
  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    atualizado_em: hoje, uf: 'PA', casa: CASA_PA.casa,
    fonte: fonte('Deputados da 61ª legislatura — Assembleia Legislativa do Pará', `${CASA_PA.portal}/Institucional/Deputados`, CASA_PA.nome, hoje),
    itens,
  };
}

// ---------------------------------------------------------------- proposições (lista do formulário)
/** "PROJETO DE LEI ORDINÁRIA Nº 686/2026, DE 27/10/2026" → partes. */
export function identificacaoPA(s) {
  const m = /^(.+?)\s+N\s*[º°o]\s*(\d+)\s*\/\s*(\d{4})(?:\s*,\s*DE\s+(\d{2}\/\d{2}\/\d{4}))?/i.exec(limpar(s) || '');
  return m ? { tipoFonte: limpar(m[1]), numero: Number(m[2]), ano: Number(m[3]), data: m[4] || null } : null;
}

function autoresPA(texto, porNome, lacunas) {
  return (limpar(texto) || '').split(/\s*[,;]\s*|\s+E\s+(?=DEP)/).filter(Boolean).map((bruto) => {
    const m = /^DEP(?:UTAD[OA])?\.?\s+(.+)$/i.exec(bruto);
    if (m) return { nome: bruto, tipo: 'DEPUTADO', parlamentar_id: porNome.get(chaveNome(m[1])) ?? null };
    if (/^(PODER|COMISS|MESA|TRIBUNAL|DEFENSORIA|MINIST|GOVERN|LIDERAN|BANCADA|PROCURADORIA|ASSEMBLEIA|CHEFE)/i.test(bruto)) return { nome: bruto, tipo: null, parlamentar_id: null };
    const t = textoPublico(bruto);
    if (t.pendente) lacunas.push(LACUNA_PRIVACIDADE);
    return { nome: t.texto, tipo: null, parlamentar_id: null };
  });
}

/** Página de resultado do formulário → { itens, paginas, vazia }. Lança erro se a página for de erro do portal. */
export function interpretarListaProposicoesPA(html, hoje, porNome = new Map()) {
  const h = principal(html);
  if (/<title>\s*Ops/i.test(String(html)) || /N[ãa]o foi poss[íi]vel carregar a p[áa]gina/i.test(h)) throw new Error('página de erro do portal');
  const itens = [];
  let cartoes = 0;
  for (const m of h.matchAll(/onCardClick\("(\/Legislativo\/DetalhesProposicao\?IdProposicao=(\d+)[^"]*)"\)'\s*class='card-proposicao'>([\s\S]*?)<\/div>/g)) {
    cartoes++;
    const corpo = m[3];
    const autor = textoHtml(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(corpo)?.[1]);
    const ident = identificacaoPA(textoHtml(/<span>([\s\S]*?)<\/span>/.exec(corpo)?.[1]));
    const def = ident ? SIGLA_POR_FONTE.get(chaveNome(ident.tipoFonte)) : null;
    if (!ident || !def) continue;
    const lacunas = ['Data de apresentação: é a data de entrada registrada pela ALEPA na lista de proposições.'];
    const em = textoPublico(textoHtml(/<p>([\s\S]*?)<\/p>/.exec(corpo)?.[1]));
    if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
    const autores = autoresPA(autor, porNome, lacunas);
    const id = Number(m[2]);
    const url = `${CASA_PA.portal}/Legislativo/DetalhesProposicao?IdProposicao=${id}`;
    itens.push({
      id: `pa-${id}`, id_oficial: id, uf: 'PA', casa: CASA_PA.casa, sigla: def.sigla, tipo: def.tipo, tipo_texto_oficial: ident.tipoFonte,
      numero: ident.numero, ano: ident.ano, identificacao: `${def.sigla} ${ident.numero}/${ident.ano}`,
      data_apresentacao: dataISO(ident.data, hoje), data_publicacao: null, ementa: em.texto, autores,
      situacao: { texto: null, etapa: null, regime: null, ultima_tramitacao: null, url_norma: null },
      situacao_coletada_em: null, detalhe_coletado_em: null,
      url, fonte_dados: url, url_pdf: `https://downloads.alepa.pa.gov.br/Projeto/${id}.PDF`,
      privacidade_pendente: em.pendente || undefined,
      lacunas: [...new Set([...lacunas, 'Situação: detalhe da proposição ainda não coletado.'])],
    });
  }
  const vazia = /N[ãa]o foi encontrada nenhuma proposi/i.test(h);
  if (!cartoes && !vazia) throw new Error('página de proposições sem cartões nem aviso de lista vazia');
  return { itens, paginas: pageCount(h) ?? (itens.length ? 1 : 0), vazia: vazia && !cartoes, cartoes };
}

// ---------------------------------------------------------------- detalhe da proposição
const campos = (bloco) => Object.fromEntries([...String(bloco).matchAll(/<p>([^<:]+):\s*([\s\S]*?)<\/p>/g)].map((m) => [chaveNome(decodificar(m[1])), textoHtml(m[2])]));

export function interpretarDetalheProposicaoPA(html, hoje) {
  const h = principal(html);
  if (!/items-container/.test(h)) return null;
  // Cada grupo aparece duas vezes no HTML (cabeçalho aberto e fechado): o conteúdo de todos os trechos do mesmo título é somado.
  const grupos = new Map();
  for (const g of h.split(/<span class="[^"]*dx-vam">/).slice(1)) {
    const t = chaveNome(textoHtml(g.split('</span>')[0]));
    grupos.set(t, (grupos.get(t) || '') + g);
  }
  const r = campos(grupos.get('REFERENCIAS') || '');
  const plen = { html: grupos.get('VOTACAO NO PLENARIO') || '' };
  const turnos = [];
  for (const b of (plen?.html || '').split(/<div style='padding: 0; margin: 0;[^']*'>/).slice(1)) {
    const c = campos(b);
    const v = /DetalhesVotacaoNominal\?IdProposicao=(\d+)&(?:amp;)?IdVotacao=(\d+)/.exec(b);
    if (!c.TURNO && !c.RESULTADO) continue;
    turnos.push({ turno: c.TURNO || null, data: dataISO(c.DATA, hoje), resultado: c.RESULTADO || null, id_votacao: v ? Number(v[2]) : null });
  }
  return { situacao: r.SITUACAO || null, regime: r.REGIME || null, data_entrada: dataISO(r['DATA DA ENTRADA'], hoje), origem: r.ORIGEM || null, turnos };
}

export function aplicarDetalhePA(item, det, hoje) {
  if (!det) return item;
  const ultimo = [...det.turnos].filter((t) => t.data).sort((a, b) => a.data.localeCompare(b.data)).pop() || null;
  return {
    ...item,
    situacao: {
      ...item.situacao, texto: det.situacao, etapa: det.situacao, regime: det.regime,
      ultima_tramitacao: ultimo ? { data: ultimo.data, descricao: `Plenário — ${ultimo.turno}: ${ultimo.resultado ?? 'resultado não informado'}`, local: 'Plenário' } : null,
    },
    deliberacoes_plenario: det.turnos,
    situacao_coletada_em: hoje, detalhe_coletado_em: hoje,
    lacunas: (item.lacunas || []).filter((l) => !/^Situação: detalhe/.test(l)),
  };
}

// ---------------------------------------------------------------- votações nominais
/** Lista mensal → [{ id_proposicao, id_votacao, data, titulo }]. */
export function interpretarListaVotacoesPA(html, hoje) {
  const h = principal(html);
  if (/Erro ao carregar os dados, tente novamente/i.test(h)) throw new Error('o portal respondeu "Erro ao carregar os dados"');
  const itens = [];
  for (const m of h.matchAll(/<a class='pauta-item-title' href='\/Legislativo\/DetalhesVotacaoNominal\?IdProposicao=(\d+)&(?:amp;)?IdVotacao=(\d+)'>([^<]*)<\/a>/g)) {
    const titulo = textoHtml(m[3]);
    itens.push({ id_proposicao: Number(m[1]), id_votacao: Number(m[2]), data: dataISO(/^(\d{2}\/\d{2}\/\d{4})/.exec(titulo || '')?.[1], hoje), titulo });
  }
  return { itens, paginas: pageCount(h) ?? (itens.length ? 1 : 0) };
}

const SECOES = { SIM: 'Sim', NAO: 'Não', ABSTENCAO: 'Abstenção', 'NAO VOTARAM': 'Não votou' };

/**
 * Detalhe da votação nominal → votação no contrato de dados/esquema.json, ou { erro } quando a conferência falha
 * (quantidade de cada lista ≠ número de nomes, ou nome sem partido): nesse caso nada é gravado.
 */
export function interpretarVotacaoPA(html, ref, hoje, porNome = new Map(), projetos = new Map()) {
  const h = principal(html);
  const cab = {};
  for (const m of h.matchAll(/<td><strong>([^<:]+):<\/strong>([\s\S]*?)<\/td>/g)) cab[chaveNome(decodificar(m[1]))] = textoHtml(m[2]);
  if (!cab.PROJETO || !cab.DATA) return { erro: 'cabeçalho da votação não encontrado' };
  const secoes = [];
  for (const m of h.matchAll(/<div class="section-title">([^<]*)<\/div>\s*<div class="votos-lista">([\s\S]*?)<\/div>\s*<p class="quantidade">Quantidade:\s*(\d+)<\/p>/g)) {
    const titulo = chaveNome(decodificar(m[1]));
    const celulas = [...m[2].matchAll(/<div class="voto-item">([\s\S]*?)<\/div>/g)].map((c) => textoHtml(c[1]));
    secoes.push({ titulo, rotulo: textoHtml(m[1]), celulas, quantidade: Number(m[3]) });
  }
  if (secoes.length !== 4 || secoes.some((s) => !SECOES[s.titulo])) return { erro: `listas de votação inesperadas (${secoes.map((s) => s.titulo).join(', ')})` };
  const votos = [];
  const placar = {};
  for (const s of secoes) {
    if (s.celulas.length % 2 !== 0) return { erro: `lista "${s.rotulo}" com nome sem partido (${s.celulas.length} células)` };
    const n = s.celulas.length / 2;
    if (n !== s.quantidade) return { erro: `lista "${s.rotulo}": ${n} nomes, mas a página informa quantidade ${s.quantidade}` };
    for (let i = 0; i < s.celulas.length; i += 2) {
      const nome = s.celulas[i];
      if (!nome) return { erro: `lista "${s.rotulo}" com nome vazio` };
      votos.push({ parlamentar_id: porNome.get(chaveNome(nome)) ?? null, nome, partido: s.celulas[i + 1] || null, uf: 'PA', voto: SECOES[s.titulo], voto_texto_oficial: s.rotulo });
    }
    placar[s.titulo === 'SIM' ? 'sim' : s.titulo === 'NAO' ? 'nao' : s.titulo === 'ABSTENCAO' ? 'abstencao' : 'Não votaram'] = s.quantidade;
  }
  const total = secoes.reduce((t, s) => t + s.quantidade, 0);
  if (votos.length !== total) return { erro: `soma das listas (${votos.length}) diferente do total das quantidades (${total})` };
  const nomes = new Set(votos.map((v) => chaveNome(v.nome)));
  if (nomes.size !== votos.length) return { erro: 'deputado repetido nas listas de votação' };
  placar.total = total;
  const ident = identificacaoPA(cab.PROJETO);
  const def = ident ? SIGLA_POR_FONTE.get(chaveNome(ident.tipoFonte)) : null;
  const pid = `pa-${ref.id_proposicao}`;
  const proj = projetos.get(pid);
  const forma = chaveNome(cab.VOTACAO) === 'VOTACAO NOMINAL' ? 'nominal' : null;
  const resultadoTxt = cab.RESULTADO || null;
  const url = `${CASA_PA.portal}/Legislativo/DetalhesVotacaoNominal?IdProposicao=${ref.id_proposicao}&IdVotacao=${ref.id_votacao}`;
  const lacunas = ['Hora da votação: não informada na página oficial.', 'Orientação das bancadas: não publicada pela ALEPA.'];
  if (votos.some((v) => !v.parlamentar_id)) lacunas.push('Algum nome da lista de votação não tem grafia idêntica à da página de deputados; o voto aparece sem ligação com o perfil.');
  if (!forma) return { erro: `forma da votação não é nominal ("${cab.VOTACAO}")` };
  return {
    votacao: {
      id: `pa-${ref.id_votacao}`, id_fonte: ref.id_votacao, uf: 'PA', casa: CASA_PA.casa,
      data: dataISO(cab.DATA, hoje), hora: null, orgao: 'Plenário', orgao_sigla: 'PLEN', orgao_nome: 'Plenário',
      sessao: { titulo: cab.TIPO && cab.NUMERO ? `${cab.NUMERO}ª ${cab.TIPO.toLowerCase().replace(/^./, (c) => c.toUpperCase())}` : cab.TIPO || null, tipo: cab.TIPO || null, numero: Number(cab.NUMERO) || null },
      etapa: cab.TURNO || null,
      proposicao: {
        id: pid, sigla: def?.sigla ?? null, tipo: def?.tipo ?? ident?.tipoFonte ?? null, numero: ident?.numero ?? null, ano: ident?.ano ?? null,
        ementa: proj?.ementa ?? null, url: `${CASA_PA.portal}/Legislativo/DetalhesProposicao?IdProposicao=${ref.id_proposicao}`,
      },
      autoria_texto_oficial: cab.AUTOR || null,
      descricao: `${cab.PROJETO} - ${cab.TURNO || 'turno não informado'}`,
      resultado: /^APROVAD/i.test(resultadoTxt || '') ? 'aprovada' : /^REJEITAD/i.test(resultadoTxt || '') ? 'rejeitada' : null,
      resultado_texto_oficial: resultadoTxt, tipo: forma, tipo_texto_oficial: cab.VOTACAO,
      placar, placar_origem: 'totais-oficiais',
      conferencia_placar: `As ${total} linhas das quatro listas (Sim, Não, Abstenção e Não votaram) conferem com as quantidades informadas na página oficial.`,
      votos_situacao: 'publicados', votos,
      url, url_pdf: `${url}&type=PDF`,
      fonte: fonte('Votação nominal — portal da ALEPA', url, CASA_PA.nome, hoje),
      lacunas,
    },
  };
}

// ---------------------------------------------------------------- normas (Banco de Leis)
export function interpretarNormaPA(r, hoje) {
  const def = Object.values(TIPOS_NORMA).find((t) => t.fonte === limpar(r?.tipo));
  if (!def || !Number.isFinite(Number(r?.id))) return null;
  const numero = /^\d+$/.test(String(r.numero ?? '').trim()) ? Number(r.numero) : null;
  const ano = /^\d{4}$/.test(String(r.ano ?? '').trim()) ? Number(r.ano) : null;
  const em = textoPublico(r.ementa);
  const pdf = /^https:\/\/bancodeleis\.alepa\.pa\.gov\.br\//.test(r.link_pdf || '') ? r.link_pdf : null;
  const lacunas = [
    'Datas de assinatura e de publicação: não informadas pela API do Banco de Leis (estão no texto da norma, em PDF).',
    'Proposição de origem: não informada pela API do Banco de Leis.',
  ];
  if (numero === 0 || numero == null) lacunas.push(`Número: a API informa "${limpar(r.numero) ?? ''}".`);
  if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
  return {
    id: `${def.prefixo}-${numero || `id${r.id}`}-${ano ?? 'sem-ano'}`, id_oficial: Number(r.id), uf: 'PA', casa: CASA_PA.casa,
    tipo: def.tipo, tipo_texto_oficial: def.fonte, numero: numero || null, ano,
    nome_oficial: numero && ano ? `${def.tipo} nº ${numero.toLocaleString('pt-BR')}/${ano}` : null,
    data_assinatura: null, data_publicacao: null, ementa: em.texto, projeto_origem: null,
    url: pdf, fonte: fonte(`${def.fonte} — API do Banco de Leis da ALEPA`, `${CASA_PA.leis}/api/leis.php?numero=${encodeURIComponent(limpar(r.numero) ?? '')}&ano=${ano ?? ''}`, CASA_PA.nome, hoje),
    privacidade_pendente: em.pendente || undefined, lacunas,
  };
}

/**
 * Prefixos de número para varrer um tipo com mais de 50 normas no ano (a API corta em 50 e não pagina; o filtro
 * "numero" acha o trecho em qualquer posição). Do maior número visto para baixo: "116", "115", … (dois dígitos a menos).
 */
export function prefixosIniciais(maiorNumero) {
  const s = String(maiorNumero);
  const tam = Math.max(1, s.length - 2);
  const topo = Number(s.slice(0, tam));
  const out = [];
  for (let p = topo; p >= (tam === 1 ? 1 : 10 ** (tam - 1)); p--) out.push(String(p));
  return out;
}
export const filhos = (p) => Array.from({ length: 10 }, (_, d) => `${p}${d}`);

// ---------------------------------------------------------------- janelas de datas
const diaMs = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
/** Divide [ini, fim] (datas ISO, inclusivas) em até n partes de dias inteiros. */
export function dividirJanela(ini, fim, n) {
  const a = Date.parse(`${ini}T12:00:00Z`), b = Date.parse(`${fim}T12:00:00Z`);
  const dias = Math.round((b - a) / diaMs) + 1;
  const partes = Math.max(1, Math.min(n, dias));
  const out = [];
  let ini2 = a;
  for (let i = 0; i < partes; i++) {
    const tam = Math.round(dias / partes * (i + 1)) - Math.round(dias / partes * i);
    const fim2 = ini2 + (tam - 1) * diaMs;
    out.push([iso(ini2), iso(fim2)]);
    ini2 = fim2 + diaMs;
  }
  return out;
}
/** Janelas mensais de um ano até hoje: [["2026-01-01","2026-01-31"], …]. */
export function janelasMensais(ano, hoje) {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const ini = `${ano}-${String(m).padStart(2, '0')}-01`;
    if (ini > hoje) break;
    const fim = iso(Date.UTC(ano, m, 0, 12));
    out.push([ini, fim]);
  }
  return out;
}
export const dataBRdeISO = (s) => s.split('-').reverse().join('/');
