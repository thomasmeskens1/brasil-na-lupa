// Santa Catarina — Assembleia Legislativa (ALESC). Fontes oficiais (HTML, sem API; lidas em 04/11/2026):
//   Deputados:      página inicial do portal (https://www.alesc.sc.gov.br/): 40 cartões com nome, partido e foto.
//                   O robots.txt do portal (WordPress) proíbe /wp-json/, /?rest_route=, /search/ e /?s=: nada disso é usado.
//   e-Legis:        https://portalelegis.alesc.sc.gov.br (sem robots.txt: HTTP 404, nenhuma restrição declarada)
//     /proposicoes/processo-legislativo?tipoPropositura=N&inicio=AAAA-01-01&fim=AAAA-12-31&arquivados=1&page=P  (10 por página)
//     /proposicoes/{id}/tramitacoes                     andamento completo (data, setor de origem e destino, situação)
//     /sessoes-plenarias?page=P                         sessões (10 por página, mais novas primeiro)
//     /sessoes-plenarias/{id}/ordem-do-dia              itens votados, com resultado e "Votação simbólica" ou "Votação nominal"
//     /extrato-votacao/{id}                             nome e voto de cada deputado (fragmento pedido pelo próprio site com
//                                                       o cabeçalho X-Requested-With; sem ele o servidor responde 405). Sem partido.
//   Legislação SC:  https://leis.alesc.sc.gov.br (sem robots.txt): /legislativo e /executivo?ano=AAAA&sort=data_desc&page=P
//                   (5 por página; a lista vem no HTML renderizado pelo servidor) e /ato-normativo/{id} (ficha da lei com
//                   procedência, proposição de origem e número/data do Diário Oficial do Estado).
// O partido de cada deputado na data da votação não é publicado pelo extrato: fica "Informação não disponível em fonte
// oficial" (nunca preenchido com a lista atual). Funções puras (testes.mjs); a rede fica em coletar.mjs.
import { Cliente, interpretarRobots, limpar, dataISO, textoPublico, chaveNome, fonte, LACUNA_PRIVACIDADE } from '../abertos/base.mjs';

export const USER_AGENT_SC = 'BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)';
export const INDISPONIVEL = 'Informação não disponível em fonte oficial';
export const CASA_SC = {
  uf: 'SC', casa: 'alesc', nome: 'Assembleia Legislativa do Estado de Santa Catarina (ALESC)',
  portal: 'https://www.alesc.sc.gov.br', elegis: 'https://portalelegis.alesc.sc.gov.br', leis: 'https://leis.alesc.sc.gov.br',
};
const C = CASA_SC;

// ---------------------------------------------------------------- cliente HTTP
/**
 * Robots.txt com todos os grupos aplicáveis somados (o portal da ALESC tem dois grupos "User-agent: *").
 * Mesmo resultado de interpretarRobots quando há um grupo só.
 */
export function interpretarRobotsSC(texto) {
  // Cada grupo (linhas "User-agent" seguidas + regras) é lido pela função da base; os grupos do nosso robô (ou, sem
  // eles, todos os grupos "*") são somados, como manda a RFC 9309.
  const grupos = [];
  let atual = null, ultimaFoiAgente = false;
  for (const linha of String(texto || '').split(/\r?\n/)) {
    const ag = /^\s*user-agent\s*:\s*([^#]*)/i.exec(linha);
    if (ag) {
      if (!ultimaFoiAgente || !atual) { atual = { agentes: [], linhas: [] }; grupos.push(atual); }
      atual.agentes.push(ag[1].trim().toLowerCase());
      atual.linhas.push(linha);
      ultimaFoiAgente = true;
      continue;
    }
    if (/^\s*[A-Za-z-]+\s*:/.test(linha.replace(/#.*$/, ''))) ultimaFoiAgente = false;
    if (atual) atual.linhas.push(linha);
  }
  const meus = grupos.filter((g) => g.agentes.some((a) => a !== '*' && a && (USER_AGENT_SC.toLowerCase().includes(a) || a.includes('brasilnalupa'))));
  const usados = meus.length ? meus : grupos.filter((g) => g.agentes.includes('*'));
  const out = { disallow: [], allow: [], crawl_delay_s: null };
  for (const g of usados) {
    const r = interpretarRobots(['User-agent: *', ...g.linhas.filter((l) => !/^\s*user-agent\s*:/i.test(l))].join('\n'));
    out.disallow.push(...r.disallow); out.allow.push(...r.allow);
    if (r.crawl_delay_s != null) out.crawl_delay_s = Math.max(out.crawl_delay_s ?? 0, r.crawl_delay_s);
  }
  return { disallow: [...new Set(out.disallow)], allow: [...new Set(out.allow)], crawl_delay_s: out.crawl_delay_s };
}

/** Cliente da base com o User-Agent do projeto, robots.txt somado e o cabeçalho do próprio site no extrato de votação. */
export class ClienteSC extends Cliente {
  constructor(op = {}) {
    super(op);
    const f = this.fetchImpl;
    this.fetchImpl = (url, o = {}) => {
      const headers = { ...(o.headers || {}), 'User-Agent': USER_AGENT_SC };
      if (new URL(url).pathname.startsWith('/extrato-votacao/')) headers['X-Requested-With'] = 'XMLHttpRequest';
      return f(url, { ...o, headers });
    };
  }
  /** robots.txt lido pela base (antes de qualquer outra requisição ao host), com os grupos "*" somados (a base lê só o primeiro). */
  async _robots(host) {
    if (this.robots.has(host)) return this.robots.get(host);
    let texto = null;
    const f = this.fetchImpl;
    this.fetchImpl = async (url, o) => {
      const res = await f(url, o);
      if (!String(url).endsWith('/robots.txt')) return res;
      const corpo = await res.text();
      texto = corpo;
      return { status: res.status, ok: res.ok, headers: res.headers, text: async () => corpo };
    };
    let r;
    try { r = await super._robots(host); } finally { this.fetchImpl = f; }
    if (r.status === 200 && !r.bloqueado && /robots\.txt lido/.test(r.observacao || '') && texto != null) {
      Object.assign(r, interpretarRobotsSC(texto));
      r.intervalo_usado_s = r.crawl_delay_s != null ? Math.max(this.intervaloPadraoS, Math.ceil(r.crawl_delay_s) + 1) : this.intervaloPadraoS;
    }
    return r;
  }
}

// ---------------------------------------------------------------- HTML
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', raquo: '»', laquo: '«', ordm: 'º', ordf: 'ª', ndash: '–', mdash: '—', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’' };
export const desentidade = (s) => String(s ?? '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
/** Texto visível de um trecho de HTML. */
export const txt = (h) => limpar(desentidade(String(h ?? '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')));
const todos = (re, s) => [...String(s ?? '').matchAll(re)];

/**
 * Id opaco do e-Legis (5 letras e números, com maiúsculas) → id seguro para nome de arquivo em sistema que não
 * diferencia maiúsculas: minúsculas + máscara das posições maiúsculas (base 36). "NpwW5" → "npww5-9".
 */
export function idSeguro(op) {
  const s = String(op ?? '');
  if (!/^[A-Za-z0-9]{1,20}$/.test(s)) return null;
  let mascara = 0;
  for (let i = 0; i < s.length; i++) if (/[A-Z]/.test(s[i])) mascara += 2 ** i;
  return `${s.toLowerCase()}-${mascara.toString(36)}`;
}

/** "PL./0675/2026" → { sigla: "PL", numero: 675, ano: 2026, identificacao: "PL 675/2026", identificacao_oficial }. */
export function identificacaoSC(s) {
  const t = limpar(s);
  const m = /^([A-Z]{1,6})\.?\s*\/\s*0*(\d{1,6})\s*\/\s*(\d{4})$/.exec(t || '');
  if (!m) return { sigla: null, numero: null, ano: null, identificacao: null, identificacao_oficial: t };
  const numero = Number(m[2]);
  const ano = Number(m[3]);
  return { sigla: m[1], numero, ano, identificacao: `${m[1]} ${numero}/${ano}`, identificacao_oficial: t };
}

// ---------------------------------------------------------------- deputados
/** Cartões da página inicial do portal: /deputado/<slug>/, foto, nome e partido como publicados. */
export function interpretarDeputadosSC(html, hoje) {
  const itens = [];
  const vistos = new Set();
  for (const m of todos(/<article[^>]*lab-card-team[^>]*>([\s\S]*?)<\/article>/gi, html)) {
    const b = m[1];
    const slug = /href="https:\/\/www\.alesc\.sc\.gov\.br\/deputado\/([a-z0-9-]+)\/?"/i.exec(b)?.[1];
    const nome = txt(/<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(b)?.[1]);
    if (!slug || !nome || vistos.has(slug)) continue;
    vistos.add(slug);
    const partido = txt(/<span[^>]*lab-button[^>]*>([\s\S]*?)<\/span>/i.exec(b)?.[1]);
    const foto = /<img[^>]*src="(https:\/\/www\.alesc\.sc\.gov\.br\/wp-content\/uploads\/[^"]+)"/i.exec(b)?.[1] ?? null;
    const lacunas = ['E-mail e período do mandato: não publicados nos cartões da página inicial da ALESC (Informação não disponível em fonte oficial nesta coleta).'];
    if (!partido) lacunas.push(`Partido: ${INDISPONIVEL} (o cartão da ALESC não traz a sigla).`);
    itens.push({
      id: slug, uf: C.uf, casa: C.casa, nome, partido: partido || null, em_exercicio: null,
      situacao_cadastro: 'Na lista de deputados da página inicial da ALESC', foto, email: null,
      url_oficial: `${C.portal}/deputado/${slug}/`, lacunas,
    });
  }
  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    atualizado_em: hoje, uf: C.uf, casa: C.casa,
    fonte: fonte('Deputados — página inicial do portal da ALESC', `${C.portal}/`, C.nome, hoje),
    observacao: 'Partido como publicado hoje no cartão de cada deputado. Não é usado para votações passadas.',
    itens,
  };
}

/** Nome do autor ("Deputada Paulinha") → chave para ligar ao deputado (só nome idêntico ao do cartão). */
export const chaveAutor = (s) => chaveNome(String(s ?? '').replace(/^(Deputad[oa]|Dep\.)\s+/i, ''));

// ---------------------------------------------------------------- proposições (lista)
const INSTITUICAO = /^(GOVERNAD|MESA|COMISS|TRIBUNAL|DEFENSORIA|MINIST|PROCURADORIA|ASSEMBLEIA|BANCADA|LIDERAN|PODER|PRESID|TRIBUNAL|UNIVERSIDADE|C[AÂ]MARA|PREFEIT)/i;
export function autoresSC(lis, porNome, lacunas) {
  return lis.map((n) => {
    const pid = porNome.get(chaveAutor(n)) ?? null;
    if (pid || /^Deputad[oa]\s/i.test(n) || INSTITUICAO.test(n)) return { nome: n, parlamentar_id: pid };
    const t = textoPublico(n);
    if (t.pendente) lacunas.push(LACUNA_PRIVACIDADE);
    return { nome: t.texto, parlamentar_id: null };
  });
}
const lis = (h) => todos(/<li[^>]*>([\s\S]*?)<\/li>/gi, h).map((m) => txt(m[1])).filter(Boolean);

/** Opções do filtro "tipoPropositura" do formulário (nome oficial de cada tipo). */
export function tiposPropositura(html) {
  const sel = /<select name="tipoPropositura"[\s\S]*?<\/select>/i.exec(html)?.[0] || '';
  return todos(/<option value="(\d+)"[^>]*>([\s\S]*?)<\/option>/gi, sel).map((m) => ({ codigo: Number(m[1]), nome: txt(m[2]) }));
}

/** "Exibindo 1 - 10 de 1.560" → 1560. */
export const totalExibindo = (html) => {
  const m = /Exibindo\s+[\d.]+\s*-\s*[\d.]+\s+de\s+([\d.]+)/i.exec(txt(html) || '');
  return m ? Number(m[1].replace(/\./g, '')) : null;
};

/** Cartões de /proposicoes/processo-legislativo. tipo = nome oficial do filtro usado na consulta. */
export function interpretarListaProposicoesSC(html, tipo, hoje, porNome = new Map()) {
  const out = [];
  for (const m of todos(/<div class="card card-alesc mb-3">([\s\S]*?)(?=<div class="card card-alesc mb-3">|<nav|<ul class="pagination|$)/gi, html)) {
    const b = m[1];
    const a = /<h4 class="card-title">\s*<a href="\/proposicoes\/([A-Za-z0-9]+)">([^<]+)<\/a>/i.exec(b);
    if (!a) continue;
    const idf = identificacaoSC(a[2]);
    const campo = (rot) => {
      const r = new RegExp(`fw-bold[^>]*>\\s*${rot}\\s*</div>\\s*<div class="col-lg-10">([\\s\\S]*?)</div>\\s*</div>`, 'i').exec(b);
      return r ? r[1] : null;
    };
    const lacunas = [];
    const em = textoPublico(txt(/<p class="mb-1 fst-italic"[^>]*>([\s\S]*?)<\/p>/i.exec(b)?.[1]));
    if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
    const autores = autoresSC(lis(campo('Autoria')), porNome, lacunas);
    if (!autores.length) lacunas.push(`Autoria: ${INDISPONIVEL}.`);
    if (!idf.sigla) lacunas.push('Sigla, número ou ano: a identificação da fonte não segue o padrão "SIGLA/NNNN/AAAA".');
    const sid = idSeguro(a[1]);
    out.push({
      id: `sc-${sid}`, id_oficial: a[1], uf: C.uf, casa: C.casa,
      sigla: idf.sigla, tipo, numero: idf.numero, ano: idf.ano, identificacao: idf.identificacao, identificacao_oficial: idf.identificacao_oficial,
      data_apresentacao: dataISO(txt(campo('Entrada')), hoje), ementa: em.texto, autores,
      situacao: { texto: txt(campo('Situação atual')), etapa: txt(campo('Situação atual')), lotacao: txt(campo('Setor atual')), ultima_tramitacao: null, url_norma: null, norma: null },
      situacao_coletada_em: hoje,
      url: `${C.elegis}/proposicoes/${a[1]}/tramitacoes`,
      privacidade_pendente: em.pendente || undefined,
      lacunas: [...new Set(lacunas)],
    });
  }
  return out;
}

/** Chave que muda quando a proposição anda (decide se a tramitação precisa ser relida). */
export const marcaAndamento = (p) => `${p?.situacao?.texto ?? ''}|${p?.situacao?.lotacao ?? ''}`;

// ---------------------------------------------------------------- tramitação
/** /proposicoes/{id}/tramitacoes → { regime, materia, processo_origem, itens (mais recente primeiro) }. */
export function interpretarTramitacaoSC(html, hoje) {
  const linha = (rot) => txt(new RegExp(`<th>\\s*${rot}\\s*</th>\\s*<td>([\\s\\S]*?)</td>`, 'i').exec(html)?.[1]);
  const orig = /Processo de Origem:\s*<a href="\/proposicoes\/([A-Za-z0-9]+)\/tramitacoes">([^<]+)<\/a>/i.exec(html);
  const itens = [];
  for (const m of todos(/<li class="timeline-item[^"]*">([\s\S]*?)<\/li>/gi, html)) {
    const b = m[1];
    const setores = todos(/<small class="text-center">([\s\S]*?)<\/small>/gi, b).map((x) => txt(x[1]));
    const desc = textoPublico(txt(/<p class="mb-1 text-primary fst-italic">([\s\S]*?)<\/p>/i.exec(b)?.[1]));
    const pub = /<a href="(https?:\/\/[^"]+)"[^>]*>\s*<i[^>]*><\/i>\s*Publicação/i.exec(b)?.[1] ?? null;
    itens.push({
      data: dataISO(txt(/<p class="mb-1 text-muted">\s*<small>([\s\S]*?)<\/small>/i.exec(b)?.[1]), hoje),
      situacao: txt(/<p class="mb-1 fw-bold">([\s\S]*?)<\/p>/i.exec(b)?.[1]),
      descricao: desc.texto, origem: setores[0] ?? null, destino: setores[1] ?? null, publicacao: pub,
      ...(desc.pendente ? { privacidade_pendente: true } : {}),
    });
  }
  // A fonte lista do mais antigo para o mais novo; a ordem original desempata datas iguais.
  const ord = itens.map((x, i) => ({ x, i })).sort((a, b) => String(b.x.data || '').localeCompare(String(a.x.data || '')) || b.i - a.i).map((o) => o.x);
  return {
    regime: linha('Regime de tramitação'), materia: linha('Matéria legislativa'),
    processo_origem: orig ? { id: `sc-${idSeguro(orig[1])}`, id_oficial: orig[1], identificacao_oficial: limpar(orig[2]), url: `${C.elegis}/proposicoes/${orig[1]}/tramitacoes` } : null,
    itens: ord,
  };
}

export function aplicarTramitacaoSC(p, t, hoje) {
  const ult = t.itens[0] || null;
  const pend = t.itens.some((x) => x.privacidade_pendente);
  return {
    ...p, regime_tramitacao: t.regime, materia: t.materia, processo_origem: t.processo_origem,
    tramitacao: t.itens, tramitacao_marca: marcaAndamento(p), tramitacao_coletada_em: hoje,
    situacao: { ...p.situacao, ultima_tramitacao: ult ? { data: ult.data, descricao: [ult.situacao, ult.descricao].filter(Boolean).join(': ') } : null },
    privacidade_pendente: p.privacidade_pendente || pend || undefined,
    lacunas: pend ? [...new Set([...(p.lacunas || []), LACUNA_PRIVACIDADE])] : p.lacunas,
  };
}

// ---------------------------------------------------------------- sessões
/** Cartões de /sessoes-plenarias: id, título, data e hora, situação. */
export function interpretarSessoesSC(html, hoje) {
  const out = [];
  for (const m of todos(/<div class="card card-alesc mb-4">([\s\S]*?)(?=<div class="card card-alesc mb-4">|<ul class="pagination|$)/gi, html)) {
    const b = m[1];
    const id = /\/sessoes-plenarias\/([A-Za-z0-9]+)\/ordem-do-dia/i.exec(b)?.[1];
    if (!id) continue;
    const quando = /(\d{2}\/\d{2}\/\d{4})\s*·\s*(\d{2}:\d{2})/.exec(txt(b) || '');
    out.push({
      id: `sc-${idSeguro(id)}`, id_oficial: id, titulo: txt(/<h4[^>]*>([\s\S]*?)<\/h4>/i.exec(b)?.[1]),
      data: quando ? dataISO(quando[1], '9999-12-31') : null, hora: quando ? quando[2] : null,
      situacao: txt(/<span class="badge[^"]*">\s*<i[^>]*><\/i>([\s\S]*?)<\/span>/i.exec(b)?.[1]),
      url: `${C.elegis}/sessoes-plenarias/${id}/ordem-do-dia`,
    });
  }
  return out;
}
export const ultimaPagina = (html, base) => {
  const ns = todos(new RegExp(`${base.replace(/[/?]/g, '\\$&')}[^"]*?page=(\\d+)`, 'g'), html).map((m) => Number(m[1]));
  return ns.length ? Math.max(...ns) : 1;
};

/** Ordem do Dia: ficha da sessão + itens votados por seção ("Processos » Votação", "Solicitações » Votação"). */
export function interpretarOrdemDoDiaSC(html, hoje) {
  const linha = (rot) => txt(new RegExp(`<th>\\s*${rot}\\s*</th>\\s*<td>([\\s\\S]*?)</td>`, 'i').exec(html)?.[1]);
  const inicio = /(\d{2}\/\d{2}\/\d{4})\s+às\s+(\d{2}:\d{2})/.exec(linha('Início') || '');
  const sessao = {
    titulo: txt(/<h4 class="card-title[^"]*">([\s\S]*?)<\/h4>/i.exec(html)?.[1]), tipo: linha('Tipo de reunião'),
    data: inicio ? dataISO(inicio[1], hoje) : null, hora_inicio: inicio ? inicio[2] : null, situacao: linha('Situação'),
  };
  const corpo = html.split(/<div class="col-lg-8">/i).slice(1).join('') || '';
  const pedacos = corpo.split(/<h5 class="m-0">/i);
  const itens = [];
  for (const p of pedacos.slice(1)) {
    const secao = txt(p.slice(0, p.indexOf('</h5>')));
    for (const m of todos(/<div class="border-bottom mb-3">([\s\S]*?)(?=<div class="border-bottom mb-3">|<footer|$)/gi, p)) {
      const b = m[1];
      const a = /<a href="\/proposicoes\/([A-Za-z0-9]+)">([^<]+)<\/a>/i.exec(b);
      if (!a) continue;
      const badges = todos(/<span class="badge[^"]*">([\s\S]*?)<\/span>/gi, b.split(/<strong>Autoria/i)[0]).map((x) => txt(x[1])).filter(Boolean);
      const forma = badges.find((x) => /^Vota[çc][ãa]o/i.test(x)) ?? null;
      // Só itens votados: comunicados ao Plenário e itens retirados de pauta não trazem a forma da votação.
      if (!forma) continue;
      const resultado = badges.filter((x) => x !== forma).join(' · ') || null;
      const autoria = /<strong>Autoria<\/strong>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i.exec(b)?.[1];
      itens.push({
        secao, numero_item: itens.length + 1, proposicao_id_oficial: a[1], identificacao_oficial: limpar(a[2]),
        resultado_oficial: resultado, forma_oficial: forma,
        autoria: autoria ? lis(autoria) : [],
        ementa: txt(/<p class="fst-italic text-secondary mb-1">([\s\S]*?)<\/p>/i.exec(b)?.[1]),
        extrato_id_oficial: /hx-get="\/extrato-votacao\/([A-Za-z0-9]+)"/i.exec(b)?.[1] ?? null,
      });
    }
  }
  return { sessao, itens };
}

// ---------------------------------------------------------------- extrato de votação
/**
 * Fragmento /extrato-votacao/{id}: identificação, situação mostrada no cabeçalho e um cartão por deputado (nome + voto).
 * conferido = cada cartão trouxe exatamente um nome e um voto (a soma dos votos é igual ao número de cartões).
 */
export function interpretarExtratoSC(html) {
  const cartoes = String(html ?? '').split(/<div class="border rounded bg-body p-2">/i).slice(1);
  const votos = [];
  let defeituosos = 0;
  for (const c of cartoes) {
    const m = /<div>([^<]+)<\/div>\s*<div>\s*<span class="badge[^"]*">([^<]+)<\/span>\s*<\/div>/i.exec(c);
    if (!m || !txt(m[1]) || !txt(m[2])) { defeituosos++; continue; }
    votos.push({ nome: txt(m[1]), voto: txt(m[2]) });
  }
  const contagem = {};
  for (const v of votos) contagem[v.voto] = (contagem[v.voto] ?? 0) + 1;
  const soma = Object.values(contagem).reduce((s, n) => s + n, 0);
  return {
    identificacao_oficial: txt(/<h4[^>]*>([\s\S]*?)<\/h4>/i.exec(html)?.[1]),
    cabecalho: txt(/<h5[^>]*>([\s\S]*?)<\/h5>/i.exec(html)?.[1]),
    votos, contagem, cartoes: cartoes.length, conferido: cartoes.length > 0 && defeituosos === 0 && soma === cartoes.length,
  };
}

const RESULTADO = { aprovado: 'aprovada', aprovada: 'aprovada', rejeitado: 'rejeitada', rejeitada: 'rejeitada' };
const FORMA = (s) => (/nominal/i.test(s || '') ? 'nominal' : /simb[óo]lica/i.test(s || '') ? 'simbolica' : /secreta/i.test(s || '') ? 'secreta' : null);

/** Item da Ordem do Dia (+ extrato, se nominal) → votação no contrato de dados/esquema.json. */
export function votacaoSC(sessao, item, extrato, ctx) {
  const { hoje, porNome = new Map(), props = new Map() } = ctx;
  const idf = identificacaoSC(item.identificacao_oficial);
  const pid = `sc-${idSeguro(item.proposicao_id_oficial)}`;
  const prop = props.get(pid);
  const tipo = FORMA(item.forma_oficial);
  const lacunas = [];
  let votos = [];
  let placar = null;
  let situacao = 'nao-se-aplica';
  let conferencia = null;
  if (tipo === 'nominal') {
    if (!item.extrato_id_oficial) { situacao = 'nao-publicado-na-fonte'; lacunas.push('Votação nominal sem "Extrato de votação" publicado na Ordem do Dia.'); }
    else if (!extrato) { situacao = 'em-coleta'; lacunas.push('Extrato de votação ainda não lido; fica para a próxima execução.'); }
    else if (!extrato.conferido || (extrato.identificacao_oficial && extrato.identificacao_oficial !== item.identificacao_oficial)) {
      situacao = 'nao-conferido';
      lacunas.push(`Extrato de votação não gravado: a conferência falhou (${extrato.cartoes} cartões, ${extrato.votos.length} votos lidos; identificação "${extrato.identificacao_oficial ?? '?'}"). Consulte a fonte oficial.`);
    } else {
      situacao = 'coletados';
      votos = extrato.votos.map((v) => ({ parlamentar_id: porNome.get(chaveNome(v.nome)) ?? null, nome: v.nome, partido: null, uf: C.uf, voto: v.voto }));
      const c = extrato.contagem;
      const conhecidos = (c.Sim ?? 0) + (c['Não'] ?? 0) + (c['Abstenção'] ?? 0);
      placar = { sim: c.Sim ?? 0, nao: c['Não'] ?? 0, abstencao: c['Abstenção'] ?? 0, obstrucao: null, outros: votos.length - conhecidos || null, total: votos.length };
      conferencia = `O extrato oficial não publica totais: o placar é a contagem dos ${votos.length} nomes do extrato. Conferido antes de gravar: ${extrato.cartoes} cartões, cada um com um nome e um voto (soma ${Object.entries(c).map(([k, n]) => `${n} ${k}`).join(' + ')} = ${votos.length}), e a identificação do extrato (${extrato.identificacao_oficial}) igual à da Ordem do Dia.`;
      lacunas.push(`Partido de cada deputado na data da votação: ${INDISPONIVEL} (o extrato traz só o nome e o voto; a lista atual de partidos não é usada para votações passadas).`);
      if (/veto/i.test(item.ementa || '') || idf.sigla === 'MSV') lacunas.push('Sentido do voto em veto ("Sim" para manter ou para derrubar): não escrito no extrato. Consulte a ata da sessão.');
      if (votos.some((v) => !v.parlamentar_id)) lacunas.push('Algum nome do extrato não é idêntico ao da lista atual de deputados: aparece sem link para perfil.');
    }
  } else if (tipo === 'simbolica') {
    lacunas.push('Votação simbólica: a fonte não registra o voto de cada deputado.');
  } else {
    situacao = 'inexistentes-na-fonte';
    lacunas.push('Forma da votação não informada na Ordem do Dia.');
  }
  const res = String(item.resultado_oficial || '').toLowerCase();
  return {
    id: `${sessao.id}-v${item.numero_item}`, uf: C.uf, casa: C.casa,
    data: sessao.data, hora: null, orgao: 'Plenário',
    sessao: { id: sessao.id, id_oficial: sessao.id_oficial, titulo: sessao.titulo, tipo: sessao.tipo ?? null, data: sessao.data, hora_inicio: sessao.hora_inicio ?? null, url: sessao.url },
    etapa: item.secao, numero_item: item.numero_item,
    proposicao: {
      id: pid, id_oficial: item.proposicao_id_oficial, sigla: idf.sigla, tipo: prop?.tipo ?? null, numero: idf.numero, ano: idf.ano,
      identificacao_oficial: item.identificacao_oficial, ementa: textoPublico(item.ementa).texto, url: `${C.elegis}/proposicoes/${item.proposicao_id_oficial}/tramitacoes`,
    },
    descricao: `${item.identificacao_oficial}: ${item.resultado_oficial ?? 'resultado não informado'} (${item.secao})`,
    resultado: RESULTADO[res] ?? null, resultado_texto_oficial: item.resultado_oficial, resultado_oficial: item.resultado_oficial,
    tipo, tipo_texto_oficial: item.forma_oficial,
    placar, placar_origem: placar ? 'contagem-dos-votos' : null, conferencia_placar: conferencia,
    votos_situacao: situacao, votos,
    extrato_id_oficial: item.extrato_id_oficial ?? null,
    url: sessao.url,
    url_extrato: item.extrato_id_oficial ? `${C.elegis}/extrato-votacao/${item.extrato_id_oficial}` : null,
    fonte: fonte(`Ordem do Dia — ${sessao.titulo ?? 'sessão plenária'} (e-Legis/ALESC)`, sessao.url, C.nome, hoje),
    lacunas,
  };
}

// ---------------------------------------------------------------- normas (Legislação SC)
/** Junta os pedaços "self.__next_f.push([1,"…"])" do HTML (dados que o próprio servidor envia junto da página). */
export function payloadNext(html) {
  let s = '';
  for (const m of todos(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g, html)) {
    try { s += JSON.parse(`"${m[1]}"`); } catch { /* pedaço ilegível: ignorado */ }
  }
  return s;
}
/** Objeto JSON que começa logo depois de `"chave":` no texto (casamento de chaves, respeitando strings). */
export function objetoApos(texto, chave) {
  const i = texto.indexOf(`"${chave}":`);
  if (i < 0) return null;
  let j = texto.indexOf('{', i);
  if (j < 0) return null;
  let nivel = 0, str = false, esc = false;
  for (let k = j; k < texto.length; k++) {
    const ch = texto[k];
    if (str) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') str = false; continue; }
    if (ch === '"') str = true;
    else if (ch === '{') nivel++;
    else if (ch === '}' && --nivel === 0) { try { return JSON.parse(texto.slice(j, k + 1)); } catch { return null; } }
  }
  return null;
}

const TIPO_NORMA = { 'Lei Ordinária': ['Lei', 'lei'], 'Lei Complementar': ['Lei Complementar', 'lc'], 'Decreto Executivo': ['Decreto', 'dec'], 'Decreto Legislativo': ['Decreto Legislativo', 'dl'], 'Resolução': ['Resolução', 'res'], 'Emenda Constitucional': ['Emenda Constitucional', 'ec'] };
const und = (v) => (v === '$undefined' ? null : v);

/** Página da lista (/legislativo ou /executivo) → { total, itens }. Atos internos da Casa ficam de fora. */
export function interpretarListaNormasSC(html, secao, hoje) {
  const r = objetoApos(payloadNext(html), 'resultadoPesquisa');
  if (!r) return null;
  const itens = [];
  for (const e of r.entries || []) {
    const p = e?.entry?.properties || {};
    const idOf = limpar(p['ato-normativo:id']);
    if (!idOf || !/^\d+$/.test(idOf) || p['ato-normativo:interno'] === true) continue;
    const tipoOf = limpar(p['ato-normativo:tipo-ato-normativo']);
    // Portarias e instruções normativas (administração da Casa) ficam de fora.
    if (!TIPO_NORMA[tipoOf]) continue;
    const [tipo, pref] = TIPO_NORMA[tipoOf] || [tipoOf, 'norma'];
    const numero = Number.isFinite(p['ato-normativo:numero']) ? p['ato-normativo:numero'] : null;
    const ano = Number.isFinite(p['ato-normativo:ano']) ? p['ato-normativo:ano'] : null;
    const em = textoPublico(p['cm:description']);
    const autores = (Array.isArray(p['ato-normativo:autor']) ? p['ato-normativo:autor'] : []).map(limpar).filter(Boolean);
    const lacunas = [];
    if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
    if (secao === 'executivo') lacunas.push('Número e data do Diário Oficial do Estado: não publicados na ficha do decreto na Legislação SC (Informação não disponível em fonte oficial nesta coleta). O texto oficial é o publicado no DOE-SC.');
    else lacunas.push('Publicação no Diário Oficial e proposição de origem: ficha da lei ainda não lida.');
    itens.push({
      id: `${pref}-${numero ?? 'sn'}-${ano ?? 'sem-ano'}-${idOf}`, id_oficial: Number(idOf), uf: C.uf, casa: C.casa,
      esfera: secao === 'executivo' ? 'Poder Executivo (Governador)' : 'Poder Legislativo',
      procedencia_oficial: limpar(p['ato-normativo:procedencia']),
      tipo, tipo_oficial: tipoOf, numero, ano, nome_oficial: limpar(p['cm:title']),
      data_assinatura: dataISO(String(p['ato-normativo:data-ato-normativo'] || '').slice(0, 10), hoje),
      data_publicacao: null, publicacao: null, vigencia_inicio: dataISO(und(p['ato-normativo:vigencia-inicio']), '9999-12-31'),
      ementa: em.texto, autores, tema: limpar(p['ato-normativo:tema']), projeto_origem: null,
      url: `${C.leis}/ato-normativo/${idOf}`,
      fonte: fonte(`${limpar(p['cm:title']) || 'Ato normativo'} — Legislação SC (ALESC)`, `${C.leis}/ato-normativo/${idOf}`, C.nome, hoje),
      detalhe_coletado: secao === 'executivo' ? null : false,
      privacidade_pendente: em.pendente || undefined, lacunas,
    });
  }
  return { total: r.pagination?.totalItems ?? null, itens };
}

/** Ficha /ato-normativo/{id} de uma lei: Procedência, Natureza (proposição de origem) e DOE (número, data e PDF). */
export function interpretarFichaLeiSC(html, hoje) {
  const bloco = /<div class="procedencia">([\s\S]*?)<\/div>/i.exec(html)?.[1];
  if (!bloco) return null;
  const nat = /Natureza:\s*(?:<a href="([^"]+)"[^>]*>([^<]+)<\/a>|([^<]+))/i.exec(bloco);
  const doe = /DOE:\s*(?:<a href="([^"]+)"[^>]*>([^<]+)<\/a>|([\d.]+))\s*,?\s*de\s*(\d{2}\/\d{2}\/\d{4})/i.exec(bloco);
  const natTxt = limpar(desentidade(nat?.[2] ?? nat?.[3] ?? ''));
  const natId = /\/proposicoes\/([A-Za-z0-9]+)/.exec(nat?.[1] || '')?.[1] ?? null;
  return {
    procedencia: txt(/Procedência:\s*([^<]+)/i.exec(bloco)?.[1]),
    natureza: natTxt || null, natureza_id_oficial: natId,
    doe: doe ? { numero: limpar(doe[2] ?? doe[3]), data: dataISO(doe[4], hoje), url: doe[1] && /^https:\/\/portal\.doe\.sea\.sc\.gov\.br\//.test(doe[1]) ? doe[1] : null } : null,
  };
}

export function aplicarFichaLeiSC(n, f, hoje) {
  if (!f) return { ...n, detalhe_coletado: true, lacunas: [...n.lacunas.filter((l) => !/^Publicação no Diário Oficial e proposição/.test(l)), 'Ficha da lei sem o bloco "Procedência / Natureza / DOE".'] };
  const lacunas = n.lacunas.filter((l) => !/^Publicação no Diário Oficial e proposição/.test(l));
  if (!f.doe) lacunas.push(`Publicação no Diário Oficial: ${INDISPONIVEL} na ficha da lei.`);
  const idf = identificacaoSC(f.natureza);
  if (!f.natureza) lacunas.push('Proposição de origem: não informada na ficha da lei.');
  return {
    ...n, detalhe_coletado: true, procedencia: f.procedencia,
    data_publicacao: f.doe?.data ?? null,
    publicacao: f.doe ? [{ veiculo: 'Diário Oficial do Estado de Santa Catarina (DOE-SC)', numero: f.doe.numero, data: f.doe.data, url: f.doe.url }] : null,
    projeto_origem: f.natureza ? {
      id: f.natureza_id_oficial ? `sc-${idSeguro(f.natureza_id_oficial)}` : null, identificacao: idf.identificacao ?? f.natureza,
      identificacao_oficial: f.natureza, sigla: idf.sigla, numero: idf.numero, ano: idf.ano,
      url: f.natureza_id_oficial ? `${C.elegis}/proposicoes/${f.natureza_id_oficial}/tramitacoes` : null,
    } : null,
    lacunas: [...new Set(lacunas)],
  };
}
