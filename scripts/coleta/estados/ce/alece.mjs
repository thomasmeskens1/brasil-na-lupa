// Ceará — Assembleia Legislativa (ALECE). Fontes oficiais (pesquisa em docs/pesquisa/estados/ce.md):
//   www.al.ce.gov.br (robots.txt: só bloqueia /banco-de-imagens/download/)
//     GET  /deputados                                   cartões: em exercício, licenciados e suplentes em exercício
//   www2.al.ce.gov.br (sistema legado de proposições; robots.txt inexistente, HTTP 404; HTML com UTF-8 e ISO-8859-1 misturados)
//     POST /legislativo/proposicoes/busca.php?nome=31_legislatura&tabela=<t>&opcao=<D|T>   escolha=ano, pesquisa=AA
//     GET  /legislativo/proposicoes/ver.php?nome=31_legislatura&tabela=<t>&codigo=<n>       ficha com o andamento
//   transparencia.al.ce.gov.br (robots.txt: "Disallow:" vazio)
//     GET  /consultas-gerais/votacao-nominal/votacaoNominalcsv   índice das votações nominais (um PDF por votação)
// Funções de interpretação puras (testes.mjs); a rede fica em coletar.mjs. www.ce.gov.br NÃO é acessado (robots.txt 403).
import { Cliente, USER_AGENT, permitido, limpar, dataISO, textoPublico, chaveNome, fonte, LACUNA_PRIVACIDADE } from '../abertos/base.mjs';

export const CASA_CE = {
  uf: 'CE', casa: 'alece', nome: 'Assembleia Legislativa do Estado do Ceará (ALECE)',
  portal: 'https://www.al.ce.gov.br', legado: 'https://www2.al.ce.gov.br/legislativo/proposicoes',
  transparencia: 'https://transparencia.al.ce.gov.br', legislatura: '31_legislatura',
};

// Tabelas do sistema legado (só projetos; indicações não entram). Sigla "PLM": a ALECE numera à parte os
// projetos de lei oriundos de mensagem (Executivo, Defensoria, Ministério Público…): PL 13/2026 e o projeto
// oriundo de mensagem nº 13/2026 são proposições diferentes.
export const TABELAS = {
  projeto_lei: { sigla: 'PL', tipo: 'Projeto de Lei' },
  projeto_mens: { sigla: 'PLM', tipo: 'Projeto de Lei oriundo de Mensagem' },
  projeto_compl: { sigla: 'PLC', tipo: 'Projeto de Lei Complementar' },
  projeto_emen: { sigla: 'PEC', tipo: 'Proposta de Emenda à Constituição' },
  projeto_decre: { sigla: 'PDL', tipo: 'Projeto de Decreto Legislativo' },
  projeto_reso: { sigla: 'PR', tipo: 'Projeto de Resolução' },
};
export const SITUACOES = { D: 'Deliberado', T: 'Em tramitação' };
// Abreviações da coluna "Status" da busca (nomes completos nas opções do próprio formulário da ALECE).
const STATUS = { 'APROV.': 'aprovado', 'RETIR.': 'retirado', 'REJEIT.': 'rejeitado', 'PREJUD.': 'prejudicado', 'ARQUIV.': 'arquivado', 'VETADO': 'vetado', 'VETO': 'veto', 'SOBREST.': 'sobrestado' };

// ---------------------------------------------------------------- cliente HTTP
/** Cliente da base (robots.txt, intervalo, orçamento) com leitura em bytes (PDF e HTML de codificação mista). */
export class ClienteCE extends Cliente {
  /** GET/POST → Buffer; null quando o endereço não existe (404, 300, 410). Mesmas regras de robots.txt e intervalo. */
  async bytes(url, op = {}) {
    const { metodo = 'GET', corpo = null, tipoCorpo = 'application/x-www-form-urlencoded', aceitar = '*/*' } = op;
    const u = new URL(url);
    const regras = await this._robots(u.host);
    if (regras.bloqueado || !permitido(regras, u.pathname + u.search)) throw Object.assign(new Error(`bloqueado pelo robots.txt de ${u.host}: ${u.pathname}`), { robots: true });
    for (let t = 1; t <= 3; t++) {
      if (!this.cabe()) throw Object.assign(new Error('orçamento de tempo esgotado'), { orcamento: true });
      await this._esperarVez(u.host, regras.intervalo_usado_s * (t > 1 ? 3 : 1));
      this.requisicoes++;
      let res;
      try {
        const headers = { 'User-Agent': USER_AGENT, Accept: aceitar };
        if (corpo != null) headers['Content-Type'] = tipoCorpo;
        res = await this.fetchImpl(url, { method: metodo, headers, body: corpo ?? undefined, redirect: 'manual', signal: AbortSignal.timeout(120000) });
      } catch (e) {
        this.falhas.push(`${metodo} ${url}: ${e.message}`);
        if (t === 3) throw e;
        continue;
      }
      if ([300, 404, 410].includes(res.status)) return null;
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      // Redirecionamento só é seguido (uma vez, em https) quando aponta para o MESMO arquivo no mesmo host
      // (o servidor do Diário Oficial redireciona algumas edições para outra pasta).
      // Qualquer outro redirecionamento (ou um segundo) é tratado como "arquivo inexistente": não é seguido.
      if ([301, 302, 307, 308].includes(res.status)) {
        const loc = res.headers?.get?.('location');
        const novo = loc && !op.redirecionado ? new URL(loc, url) : null;
        if (novo && novo.host === u.host && novo.pathname.split('/').pop() === u.pathname.split('/').pop()) {
          novo.protocol = 'https:';
          return this.bytes(novo.toString(), { metodo, corpo, tipoCorpo, aceitar, redirecionado: true });
        }
        return null;
      }
      this.falhas.push(`${metodo} ${url}: HTTP ${res.status}`);
      if (![408, 429, 500, 502, 503, 504].includes(res.status) || t === 3) throw Object.assign(new Error(`HTTP ${res.status} em ${url}`), { status: res.status });
    }
    return null;
  }
  async html(url, op) { const b = await this.bytes(url, { aceitar: 'text/html', ...op }); return b ? decodificarMisto(b) : null; }
}

// ---------------------------------------------------------------- textos
/** Bytes com UTF-8 e ISO-8859-1 misturados (como no sistema legado): sequência UTF-8 válida vira o caractere; o resto, Latin-1. */
export function decodificarMisto(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  let out = '';
  let i = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0;
  const cont = (k) => k < b.length && (b[k] & 0xc0) === 0x80;
  while (i < b.length) {
    const c = b[i];
    if (c < 0x80) { out += String.fromCharCode(c); i++; continue; }
    if (c >= 0xc2 && c <= 0xdf && cont(i + 1)) { out += String.fromCodePoint(((c & 0x1f) << 6) | (b[i + 1] & 0x3f)); i += 2; continue; }
    if (c >= 0xe0 && c <= 0xef && cont(i + 1) && cont(i + 2)) {
      const cp = ((c & 0x0f) << 12) | ((b[i + 1] & 0x3f) << 6) | (b[i + 2] & 0x3f);
      if (cp >= 0x800 && (cp < 0xd800 || cp > 0xdfff)) { out += String.fromCodePoint(cp); i += 3; continue; }
    }
    if (c >= 0xf0 && c <= 0xf4 && cont(i + 1) && cont(i + 2) && cont(i + 3)) {
      const cp = ((c & 0x07) << 18) | ((b[i + 1] & 0x3f) << 12) | ((b[i + 2] & 0x3f) << 6) | (b[i + 3] & 0x3f);
      if (cp >= 0x10000 && cp <= 0x10ffff) { out += String.fromCodePoint(cp); i += 4; continue; }
    }
    out += String.fromCharCode(c); // Latin-1
    i++;
  }
  return out;
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ordm: 'º', ordf: 'ª', deg: '°', ndash: '–', mdash: '—', hellip: '…', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’' };
const ACENTOS = { acute: '́', grave: '̀', circ: '̂', tilde: '̃', uml: '̈', cedil: '̧' };
export const decodificar = (s) => String(s ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => {
    if (ENT[n.toLowerCase()]) return ENT[n.toLowerCase()];
    const a = /^([a-z])(acute|grave|circ|tilde|uml|cedil)$/i.exec(n);
    return a ? (a[1] + ACENTOS[a[2].toLowerCase()]).normalize('NFC') : m;
  });
export const textoHtml = (s) => limpar(decodificar(String(s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')));
/** "14.04.26" / "02/02/23" → ISO (século 2000). */
export const dataCurta = (s, hoje) => {
  const m = /^(\d{2})[./](\d{2})[./](\d{2}|\d{4})$/.exec(limpar(s) || '');
  return m ? dataISO(`${m[1]}/${m[2]}/${m[3].length === 2 ? `20${m[3]}` : m[3]}`, hoje) : null;
};

// ---------------------------------------------------------------- deputados
export function interpretarDeputadosCE(html, hoje) {
  const h = String(html || '');
  const iSup = h.search(/<h2[^>]*>\s*Suplentes em Exerc[íi]cio\s*<\/h2>/i);
  const itens = [];
  const re = /<div\s+class="deputado_card\s*([^"]*)"[\s\S]*?<img[\s\S]*?src="([^"]*)"[\s\S]*?<p class="deputado_card--nome[^"]*"><a href="https:\/\/www\.al\.ce\.gov\.br\/deputados\/([a-z0-9-]+)">([\s\S]*?)<\/a><\/p>\s*<p class="deputado_card--partido[^"]*">([\s\S]*?)<\/p>/g;
  for (const m of h.matchAll(re)) {
    const nome = textoHtml(m[4]);
    if (!nome) continue;
    const licenciado = /\blicenciado\b/.test(m[1]);
    const suplente = iSup >= 0 && m.index > iSup;
    const partido = textoHtml(m[5]);
    itens.push({
      id: `ce-${m[3]}`, uf: 'CE', casa: CASA_CE.casa, nome, partido: partido || null, cargo_na_casa: null,
      em_exercicio: !licenciado,
      situacao_cadastro: licenciado ? 'Licenciado (página de deputados da ALECE)' : suplente ? 'Suplente em exercício (página de deputados da ALECE)' : 'Em exercício (página de deputados da ALECE)',
      foto: /^https:\/\/www\.al\.ce\.gov\.br\/image\/\d+$/.test(m[2]) ? m[2] : null, email: null,
      url_oficial: `${CASA_CE.portal}/deputados/${m[3]}`,
      lacunas: [...(partido ? [] : ['Partido: não informado na página oficial (Informação não disponível em fonte oficial).']), 'E-mail e período do mandato: não constam dos cartões da página de deputados da ALECE.'],
    });
  }
  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    atualizado_em: hoje, uf: 'CE', casa: CASA_CE.casa,
    fonte: fonte('Deputados — em exercício, licenciados e suplentes em exercício (portal da ALECE)', `${CASA_CE.portal}/deputados`, CASA_CE.nome, hoje),
    itens,
  };
}

// ---------------------------------------------------------------- proposições (busca por ano)
export const urlBusca = (tabela, opcao) => `${CASA_CE.legado}/busca.php?nome=${CASA_CE.legislatura}&tabela=${tabela}&opcao=${opcao}`;
export const urlFicha = (tabela, codigo) => `${CASA_CE.legado}/ver.php?nome=${CASA_CE.legislatura}&tabela=${tabela}&codigo=${codigo}`;
export const corpoBusca = (ano) => `escolha=ano&pesquisa=${String(ano).slice(2)}&B1=Busca`;

function autoresCE(texto, porNome, lacunas) {
  return (limpar(texto) || '').split(/\s*[,;\/]\s*|\s+E\s+/).filter(Boolean).map((bruto) => {
    const id = porNome.get(chaveNome(bruto)) ?? null;
    if (id) return { nome: bruto, tipo: 'DEPUTADO', parlamentar_id: id };
    if (/^(PODER|COMISS|MESA|TRIBUNAL|DEFENSORIA|MINIST|GOVERN|LIDERAN|BANCADA|PROCURADORIA|ASSEMBLEIA|DEP\b|DEPUTAD)/i.test(bruto)) return { nome: bruto, tipo: null, parlamentar_id: null };
    const t = textoPublico(bruto);
    if (t.pendente) lacunas.push(LACUNA_PRIVACIDADE);
    return { nome: t.texto, tipo: null, parlamentar_id: null };
  });
}

/** Página de resultado da busca por ano → itens (só as linhas do ano pedido). Lança erro se a página não tiver a tabela. */
export function interpretarBuscaCE(html, tabela, opcao, ano, hoje, porNome = new Map()) {
  const def = TABELAS[tabela];
  const h = String(html || '');
  if (!/Encontrados|Visualizando registros/i.test(h) || !/<b>N\S{0,8} Proj\.<\/b>/i.test(h)) throw new Error('página de busca sem a tabela de resultados');
  const aa = String(ano).slice(2);
  const itens = [];
  let linhas = 0;
  for (const m of h.matchAll(/<tr>((?:(?!<\/?tr>)[\s\S])*?ver\.php\?nome=[^&']*&(?:amp;)?tabela=([a-z_]+)&(?:amp;)?codigo=(\d+)[\s\S]*?)<\/tr>/g)) {
    linhas++;
    const cel = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => textoHtml(c[1]));
    if (m[2] !== tabela || cel.length < 7) continue;
    const numero = Number(/^(\d+)\s*-?$/.exec(cel[0] || '')?.[1]);
    if (!numero || cel[1] !== aa) continue;
    const codigo = Number(m[3]);
    const lacunas = [];
    const em = textoPublico(cel[4]);
    if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
    const st2 = cel[6] && cel[6] !== '-' ? cel[6] : null;
    const st2Txt = st2 ? (STATUS[st2.toUpperCase()] ?? st2) : null;
    const lei = /^\d{1,2}\.?\d{3}$/.test(cel[3] || '') ? cel[3] : null;
    itens.push({
      id: `ce-${tabela.replace('projeto_', '')}-${codigo}`, id_oficial: codigo, tabela_oficial: tabela, uf: 'CE', casa: CASA_CE.casa,
      sigla: def.sigla, tipo: def.tipo, numero, ano: Number(ano), identificacao: `${def.sigla} ${numero}/${ano}`,
      data_apresentacao: null, data_publicacao: null, ementa: em.texto,
      autores: autoresCE(cel[2], porNome, lacunas),
      situacao: {
        texto: `${SITUACOES[opcao]}${st2Txt ? ` (${st2Txt})` : ''}`, texto_oficial: [cel[5], cel[6]].filter(Boolean).join(' '),
        etapa: `${SITUACOES[opcao]}${st2Txt ? ` (${st2Txt})` : ''}`, ultima_tramitacao: null, url_norma: null,
        lei_numero: lei,
      },
      situacao_coletada_em: hoje, detalhe_coletado_em: null,
      url: urlFicha(tabela, codigo), fonte_dados: urlBusca(tabela, opcao),
      privacidade_pendente: em.pendente || undefined,
      lacunas: [...new Set([...lacunas, 'Andamento: ficha da proposição ainda não lida.'])],
    });
  }
  const vazia = /Encontrados\s+0\s+registros/i.test(textoHtml(h) || '');
  if (!linhas && !vazia) throw new Error('página de busca sem linhas nem aviso de lista vazia');
  return { itens, linhas };
}

// ---------------------------------------------------------------- ficha da proposição
const campo = (h, rotulo) => {
  const m = new RegExp(`<b>${rotulo}<\\/b><\\/font><br><font[^>]*>([\\s\\S]*?)<\\/font><\\/td>`, 'i').exec(h);
  return m ? m[1] : null;
};
/** Ficha (ver.php) → { numero, ano, entrada, expediente, comissoes, andamento: [{data, descricao}], lei, url_lei, url_pdf, obs }. */
export function interpretarFichaCE(html, hoje) {
  const h = String(html || '');
  const nAno = /^(\d+)\/(\d{2})$/.exec(textoHtml(campo(h, 'N&ordm; do Proj\\.:')) || '');
  if (!nAno) return null;
  const tram = /Localiza&ccedil;&atilde;o:<\/b><\/font>&nbsp;<font[^>]*>[^<]*<\/font><br><font[^>]*>([\s\S]*?)<\/font><\/td>/i.exec(h)?.[1] ?? '';
  const andamento = [];
  for (const l of tram.split(/<br\s*\/?>/i)) {
    const t = textoHtml(l);
    const m = /^em\s+(\d{2}[./]\d{2}[./]\d{2,4})\s*[-–]\s*(.+)$/i.exec(t || '');
    if (m) andamento.push({ data: dataCurta(m[1], hoje), data_texto_oficial: m[1], descricao: m[2] });
  }
  const leiH = campo(h, 'Lei:') || '';
  const urlLei = /href='(https:\/\/www2\.al\.ce\.gov\.br\/legislativo\/legislacao\d*\/[^']+)'/.exec(leiH)?.[1] ?? null;
  const ementaH = campo(h, 'Ementa:') || '';
  const pdf = /href='(https:\/\/www2\.al\.ce\.gov\.br\/legislativo\/[^']+\.pdf)'/i.exec(ementaH)?.[1] ?? null;
  const lei = textoHtml(leiH);
  return {
    numero: Number(nAno[1]), ano: 2000 + Number(nAno[2]),
    entrada: dataCurta(textoHtml(campo(h, 'Entrada:')), hoje), expediente: dataCurta(textoHtml(campo(h, 'Expediente:')), hoje),
    comissoes: textoHtml(/Comiss&otilde;es:<\/b><\/font>&nbsp;<font[^>]*>([^<]*)</i.exec(h)?.[1]),
    andamento, lei: lei && lei !== '-' ? lei : null, url_lei: urlLei, url_pdf: pdf, obs: textoHtml(campo(h, 'OBS:')),
  };
}

export function aplicarFichaCE(item, f, hoje) {
  if (!f || f.numero !== item.numero || f.ano !== item.ano) return item;
  const datados = f.andamento.map((a, i) => ({ ...a, i })).filter((a) => a.data);
  const ultimo = datados.sort((a, b) => a.data.localeCompare(b.data) || a.i - b.i).pop() || null;
  return {
    ...item,
    data_apresentacao: f.entrada, data_leitura_expediente: f.expediente, url_pdf: f.url_pdf,
    situacao: {
      ...item.situacao,
      ultima_tramitacao: ultimo ? { data: ultimo.data, descricao: ultimo.descricao, local: null } : null,
      url_norma: f.url_lei, lei_numero: f.lei ?? item.situacao.lei_numero, comissoes: f.comissoes,
    },
    tramitacao: f.andamento,
    detalhe_coletado_em: hoje,
    lacunas: [
      ...(item.lacunas || []).filter((l) => !/^Andamento: ficha/.test(l)),
      'Data de apresentação: é a data de entrada registrada pela ALECE na ficha. Andamento mais recente: o de data mais recente na ficha (as datas são copiadas como publicadas).',
    ].filter((v, i, a) => a.indexOf(v) === i),
  };
}

// ---------------------------------------------------------------- índice das votações nominais (CSV)
/** CSV "LEGISLATURA;SESSÃO;MATERIA;URL" → [{ id, legislatura, sessao, materia, url }]. Lança erro se o cabeçalho mudar. */
export function interpretarIndiceVotacoesCE(csv) {
  const linhas = String(csv || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length || !/^LEGISLATURA;SESS[ÃA]O;MAT[ÉE]RIA;URL$/i.test(linhas[0].trim())) throw new Error('cabeçalho do índice de votações nominais mudou');
  const itens = [];
  for (const l of linhas.slice(1)) {
    const p = l.split(';');
    const caminho = p[p.length - 1].trim();
    const m = /^\/uploads\/votacao_nominal_materia\/([A-Za-z0-9]{10,56})\.pdf$/.exec(caminho);
    if (!m || p.length < 4) continue;
    itens.push({ id: `ce-${m[1]}`, chave: m[1], legislatura: limpar(p[0]), sessao: limpar(p[1]), materia: limpar(p.slice(2, -1).join(';')), url: `${CASA_CE.transparencia}${caminho}` });
  }
  return itens;
}
