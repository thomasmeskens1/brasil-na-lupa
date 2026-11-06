// Amapá — Assembleia Legislativa (ALAP). Fontes oficiais (pesquisa em docs/pesquisa/estados/ap.md, conferida em 06/11/2026):
//   eLegis (Laravel, HTML; robots.txt "User-agent: * / Disallow:", tudo liberado):
//     GET /portal/proposicoes?tipo_proposicao=&ano=&page=     tabela com 50 por página (data de protocolo, número, origem, ementa)
//     GET /portal/proposicao/{id}                             ficha: regime, origem, ementa, protocolo, PDF, veto, "Movimentação"
//     GET /portal/proposicao/{id}/votacao                     voto de cada deputado (por sessão) e totais (favoráveis, contra…)
//     GET /portal/sessoes-csv?ano=                            lista oficial das sessões (data, hora e nome)
//     GET /portal/legislacao?tipo_proposicao_id=&ano=&page=   leis, com nº do DOE, data de publicação e projeto de origem
//   Portal institucional (al.ap.leg.br; robots.txt responde HTTP 403, sem regra declarada pela RFC 9309):
//     GET /pagina.php?pg=exibir_legislatura                   deputados da legislatura atual (nome parlamentar e partido)
// Funções de interpretação puras (testes.mjs); a rede fica em coletar.mjs.
import { limpar, dataISO, textoPublico, chaveNome, fonte, LACUNA_PRIVACIDADE } from '../abertos/base.mjs';

export const CASA_AP = {
  uf: 'AP', casa: 'alap', nome: 'Assembleia Legislativa do Estado do Amapá (ALAP)',
  elegis: 'https://elegis.al.ap.leg.br', portal: 'https://al.ap.leg.br',
};

// Tipos do filtro de proposições (valores do formulário, lidos em 06/11/2026). Indicações, moções e requerimentos não entram.
export const TIPOS_PROP = {
  1: { sigla: 'PLO', tipo: 'Projeto de Lei Ordinária', fonte: 'Projeto de Lei Ordinária' },
  2: { sigla: 'PLC', tipo: 'Projeto de Lei Complementar', fonte: 'Projeto de Lei Complementar' },
  4: { sigla: 'PEC', tipo: 'Proposta de Emenda à Constituição', fonte: 'Proposta de Emenda Constitucional' },
  9: { sigla: 'PR', tipo: 'Projeto de Resolução', fonte: 'Projeto de Resolução' },
  6: { sigla: 'VET', tipo: 'Veto', fonte: 'Veto' },
  10: { sigla: 'PDL', tipo: 'Projeto de Decreto Legislativo', fonte: 'Projeto de Decreto Legislativo' },
};
const TIPO_POR_FONTE = new Map(Object.values(TIPOS_PROP).map((t) => [chaveNome(t.fonte), t]));

// Tipos do filtro "Legislação" (06/11/2026).
export const TIPOS_NORMA = {
  1: { tipo: 'Lei', prefixo: 'lei', fonte: 'Lei Ordinária' },
  2: { tipo: 'Lei Complementar', prefixo: 'lc', fonte: 'Lei Complementar' },
  4: { tipo: 'Emenda Constitucional', prefixo: 'ec', fonte: 'Emenda Constitucional' },
  9: { tipo: 'Resolução', prefixo: 'res', fonte: 'Resolução' },
  10: { tipo: 'Decreto Legislativo', prefixo: 'dl', fonte: 'Decreto Legislativo' },
};
const NORMA_POR_FONTE = new Map(Object.values(TIPOS_NORMA).map((t) => [chaveNome(t.fonte), t]));

// ---------------------------------------------------------------- HTML
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ordm: 'º', ordf: 'ª', deg: '°', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' };
const ACENTOS = { aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', atilde: 'ã', otilde: 'õ', acirc: 'â', ecirc: 'ê', ocirc: 'ô', agrave: 'à', ccedil: 'ç', uuml: 'ü' };
export const decodificar = (s) => String(s ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => {
    if (ENT[n.toLowerCase()]) return ENT[n.toLowerCase()];
    const a = ACENTOS[n.toLowerCase()];
    return a ? (n[0] === n[0].toUpperCase() ? a.toUpperCase() : a) : m;
  });
export const textoHtml = (s) => limpar(decodificar(String(s ?? '').replace(/<[^>]+>/g, ' ')));
/** Só o conteúdo principal do eLegis (descarta menus e rodapé, que mudam sem afetar os dados). */
export const principal = (html) => {
  const h = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '');
  const i = h.indexOf('<section class="app"');
  const f = h.indexOf('<footer', i);
  return i >= 0 ? h.slice(i, f > i ? f : undefined) : '';
};
const linhas = (tbody) => [...String(tbody).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]));
/** "Próximo »" com page=N+1 → há mais páginas. */
export const temProxima = (html) => /page=\d+[^"]*">\s*Pr[óo]ximo/i.test(String(html)) || /rel="next"/.test(String(html));
/** "<strong>224</strong> proposição(ões) encontrada(s)." / "<strong>70</strong> itens encontrados." */
export const totalEncontrado = (html) => { const m = /<strong>(\d+)<\/strong>\s*(?:proposi|itens)/.exec(String(html)); return m ? Number(m[1]) : null; };

/** "Projeto de Lei Ordinária nº 0043/26-GEA" → partes (o sufixo é a origem: GEA, AL, PGJ, TJ…). */
export function identificacaoAP(s) {
  const m = /^(.+?)\s+n[º°o]\s*(\d+)\s*\/\s*(\d{2})\s*-\s*([A-Za-z]+)$/i.exec(limpar(decodificar(s)) || '');
  if (!m) return null;
  return { tipoFonte: limpar(m[1]), numero: `${m[2]}-${m[4].toUpperCase()}`, ano: 2000 + Number(m[3]), oficial: limpar(decodificar(s)) };
}

// ---------------------------------------------------------------- deputados (portal institucional)
export function interpretarDeputadosAP(html, hoje) {
  const h = String(html || '');
  const leg = /<option[^>]*selected[^>]*>\s*([IVXLC]+ Legislatura \(\d{4} \/ \d{4}\))[^<]*<\/option>/.exec(h)?.[1] || null;
  const itens = [];
  const re = /iddeputado=(\d+)"\s+onmouseover="Tip\('<b>Dep\.<\/b>\s*([^<]*)<br>[\s\S]*?<b>Partido:<\/b>\s*([^<]*)<br>[\s\S]*?<img class="foto-deputado" src="([^"]*)"[\s\S]*?<p class="ls-title-5">\s*([^<]*?)\s*<\/p>/g;
  for (const m of h.matchAll(re)) {
    const id = Number(m[1]);
    const nome = textoHtml(m[2]);
    if (!nome || !id) continue;
    const partido = textoHtml(m[3]);
    const trat = /^(Deputad[oa])\s/.exec(textoHtml(m[5]) || '')?.[1] || null;
    const foto = /^fotodeputado\/[^"<>]+\.(jpe?g|png)$/i.test(m[4]) ? `${CASA_AP.portal}/${encodeURI(m[4])}` : null;
    itens.push({
      id: `ap-${id}`, id_oficial: id, uf: 'AP', casa: CASA_AP.casa, nome, tratamento: trat, partido: partido || null, cargo_na_casa: null, em_exercicio: null,
      foto, email: null, url_oficial: `${CASA_AP.portal}/pagina.php?pg=exibir_parlamentar&iddeputado=${id}`,
      lacunas: [
        ...(partido ? [] : ['Partido: não informado na página oficial (Informação não disponível em fonte oficial).']),
        `Lista da página "Deputados" da ALAP${leg ? ` (${leg})` : ''}; o partido aparece como escrito na página. O período de mandato e a situação de exercício não vêm nessa página.`,
      ],
    });
  }
  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    atualizado_em: hoje, uf: 'AP', casa: CASA_AP.casa, legislatura: leg,
    fonte: fonte('Deputados da legislatura atual — Assembleia Legislativa do Amapá', `${CASA_AP.portal}/pagina.php?pg=exibir_legislatura`, CASA_AP.nome, hoje),
    itens,
  };
}

// ---------------------------------------------------------------- autoria ("Origem")
const ORGAOS = /^(PODER|COMISS|MESA|TRIBUNAL|DEFENSORIA|MINIST|GOVERN|PROCURADORIA|ASSEMBLEIA|TRIBUNAL|CORREGEDORIA|LIDERAN|BANCADA)/i;
export function autoresAP(texto, porNome, lacunas) {
  const t = limpar(decodificar(texto));
  if (!t) return [];
  const m = /^Deputad[oa]s?\s+(.+)$/i.exec(t);
  if (m && !/[,;]|\se\s/.test(m[1])) return [{ nome: t, tipo: 'Deputado', parlamentar_id: porNome.get(chaveNome(m[1])) ?? null }];
  if (m || ORGAOS.test(t)) return [{ nome: t, tipo: null, parlamentar_id: null }];
  const p = textoPublico(t);
  if (p.pendente) lacunas.push(LACUNA_PRIVACIDADE);
  return [{ nome: p.texto, tipo: null, parlamentar_id: null }];
}

// ---------------------------------------------------------------- lista de proposições
/** Página da lista → { itens, total, proxima }. Lança erro se a página não tiver a tabela nem o total. */
export function interpretarListaProposicoesAP(html, hoje, porNome = new Map()) {
  const h = principal(html);
  const total = totalEncontrado(h);
  if (total == null) throw new Error('página de proposições sem o total de resultados');
  const tbody = /<tbody>([\s\S]*?)<\/tbody>/.exec(h.slice(h.indexOf('</form>')))?.[1] || '';
  const itens = [];
  for (const c of linhas(tbody)) {
    if (c.length < 5) continue;
    const idm = /\/portal\/proposicao\/(\d+)"/.exec(c[4]);
    const ident = identificacaoAP(textoHtml(c[1]));
    const def = ident ? TIPO_POR_FONTE.get(chaveNome(ident.tipoFonte)) : null;
    if (!idm || !def) continue;
    const id = Number(idm[1]);
    const lacunas = ['Data de apresentação: é a data de protocolo mostrada na lista de proposições do eLegis.'];
    const em = textoPublico(textoHtml(c[3]));
    if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
    const url = `${CASA_AP.elegis}/portal/proposicao/${id}`;
    itens.push({
      id: `ap-${id}`, id_oficial: id, uf: 'AP', casa: CASA_AP.casa, sigla: def.sigla, tipo: def.tipo, tipo_texto_oficial: ident.tipoFonte,
      numero: ident.numero, ano: ident.ano, identificacao: ident.oficial,
      data_apresentacao: dataISO(textoHtml(c[0]), hoje), data_publicacao: null, ementa: em.texto, autores: autoresAP(c[2], porNome, lacunas),
      situacao: { texto: null, etapa: null, regime: null, ultima_tramitacao: null, url_norma: null },
      situacao_coletada_em: null, detalhe_coletado_em: null, url, fonte_dados: url, url_pdf: null,
      privacidade_pendente: em.pendente || undefined,
      lacunas: [...new Set([...lacunas, 'Andamento: ficha da proposição ainda não coletada.'])],
    });
  }
  return { itens, total, proxima: temProxima(h) };
}

// ---------------------------------------------------------------- ficha da proposição
/** Ficha → { regime, origem, data_protocolo, url_pdf, url_votacao, veto, movimentacao: [{data, descricao}] } ou null. */
export function interpretarDetalheAP(html, hoje, id) {
  const h = principal(html);
  if (!/<h1[^>]*>/.test(h)) return null;
  const campo = (rot) => textoHtml(new RegExp(`<strong>${rot}:</strong>([\\s\\S]*?)</p>`).exec(h)?.[1]);
  const regime = textoHtml(/Regime de Tramita[çc][ãa]o:\s*([^<]*)</.exec(h)?.[1]);
  const pdf = /<strong>Texto Original:<\/strong>[\s\S]*?href="(\/storage\/proposicoes\/[A-Za-z0-9_-]+\.pdf)"/.exec(h)?.[1];
  const votacao = new RegExp(`href="https://elegis\\.al\\.ap\\.leg\\.br/portal/proposicao/${id}/votacao"`).test(h);
  const vetoM = /<strong>Veto:<\/strong>\s*<a href="https:\/\/elegis\.al\.ap\.leg\.br\/portal\/proposicao\/(\d+)">([^<]*)<\/a>/.exec(h);
  const i = h.indexOf('Movimentação da proposição');
  const tb = i >= 0 ? /<tbody>([\s\S]*?)<\/tbody>/.exec(h.slice(i))?.[1] || '' : '';
  const movimentacao = linhas(tb).filter((c) => c.length >= 2).map((c) => ({ data: dataISO(textoHtml(c[0]), hoje), descricao: textoPublico(textoHtml(c[1])).texto }))
    .filter((m) => m.data && m.descricao);
  return {
    regime: regime || null, origem: campo('Origem'), data_protocolo: dataISO(campo('Data de Protocolo'), hoje),
    url_pdf: pdf ? `${CASA_AP.elegis}${pdf}` : null, url_votacao: votacao ? `${CASA_AP.elegis}/portal/proposicao/${id}/votacao` : null,
    veto: vetoM ? { id: `ap-${vetoM[1]}`, identificacao: textoHtml(vetoM[2]) } : null, movimentacao,
  };
}

/** "Votado em Sessão em 02/04/2026 às 17:30" → [{data, hora}] (como registrado na movimentação). */
export function votadoEmSessao(movimentacao) {
  return (movimentacao || []).map((m) => /^Votado em Sess[ãa]o em (\d{2})\/(\d{2})\/(\d{4}) [àa]s (\d{2}:\d{2})/.exec(m.descricao || ''))
    .filter(Boolean).map((r) => ({ data: `${r[3]}-${r[2]}-${r[1]}`, hora: r[4] }));
}

export function aplicarDetalheAP(item, det, hoje) {
  if (!det) return item;
  const ult = det.movimentacao[0] || null;
  return {
    ...item,
    situacao: {
      ...item.situacao, texto: ult?.descricao ?? null, etapa: null, regime: det.regime,
      ultima_tramitacao: ult ? { data: ult.data, descricao: ult.descricao, local: null } : null,
    },
    tramitacao: det.movimentacao,
    veto: det.veto,
    url_pdf: det.url_pdf,
    url_votacao: det.url_votacao,
    situacao_coletada_em: hoje, detalhe_coletado_em: hoje,
    lacunas: [...new Set([...(item.lacunas || []).filter((l) => !/^Andamento: ficha/.test(l)),
      'Situação: o eLegis não mostra a situação na ficha; aparece o último registro da "Movimentação da proposição".'])],
  };
}

// ---------------------------------------------------------------- sessões (CSV oficial)
/** CSV "Data e Hora",Sessão → [{ data, hora, titulo }]. */
export function interpretarSessoesCsv(csv, hoje) {
  const out = [];
  for (const l of String(csv || '').replace(/^\uFEFF/, '').split(/\r?\n/).slice(1)) {
    const m = /^"(\d{2}\/\d{2}\/\d{4}) [àa]s (\d{2}:\d{2})","([^"]+)"$/.exec(l.trim());
    if (m) out.push({ data: dataISO(m[1], hoje), hora: m[2], titulo: limpar(m[3]) });
  }
  return out.filter((s) => s.data);
}

// ---------------------------------------------------------------- votação (voto de cada deputado)
const VOTOS = { FAVORAVEL: 'Sim', CONTRA: 'Não', CONTRARIO: 'Não', ABSTENCAO: 'Abstenção', 'SEM VOTO': 'Sem voto' };
const TOTAIS = [['sim', /Votos Favor[áa]veis:\s*(\d+)/i], ['nao', /Votos Contra:\s*(\d+)/i], ['abstencao', /Absten[çc][õo]es:\s*(\d+)/i], ['Sem voto', /Sem voto:\s*(\d+)/i]];
const CHAVE_VOTO = { Sim: 'sim', 'Não': 'nao', 'Abstenção': 'abstencao', 'Sem voto': 'Sem voto' };

/** Página "Votação" → { blocos: [{ sessao, votos:[{nome, voto_texto_oficial}], totais }] } ou { erro }. */
export function lerPaginaVotacao(html) {
  const h = principal(html);
  if (!/- Vota[çc][ãa]o<\/h1>/.test(h)) return { erro: 'título da página de votação não encontrado' };
  const partes = h.split(/<h2[^>]*>/).slice(1);
  const blocos = [];
  for (const p of partes) {
    const sessao = textoHtml(p.split('</h2>')[0]);
    const tb = /<tbody>([\s\S]*?)<\/tbody>/.exec(p)?.[1];
    if (!tb) continue;
    const votos = linhas(tb).filter((c) => c.length >= 2).map((c) => ({ nome: textoHtml(c[0]), voto_texto_oficial: textoHtml(c[1]) }));
    const resto = textoHtml(p.slice(p.indexOf('</table>')));
    const totais = Object.fromEntries(TOTAIS.map(([k, re]) => [k, re.exec(resto || '') ? Number(re.exec(resto)[1]) : null]));
    blocos.push({ sessao, votos, totais });
  }
  if (!blocos.length) return { erro: 'página de votação sem lista de votos' };
  return { blocos };
}

/** Sessão da votação → { data, hora } só quando o nome é idêntico ao da lista oficial e confere com a movimentação. */
export function dataDaSessao(titulo, sessoes, votadoEm, desde) {
  const cand = sessoes.filter((s) => chaveNome(s.titulo) === chaveNome(titulo) && (!desde || s.data >= desde));
  if (cand.length !== 1) return null;
  const s = cand[0];
  if (votadoEm.length && !votadoEm.some((v) => v.data === s.data && v.hora === s.hora)) return null;
  return { data: s.data, hora: s.hora };
}

/**
 * Votação no contrato de dados/esquema.json, ou { erro } quando a conferência falha (valor de voto desconhecido,
 * nome repetido, total da página diferente do número de nomes): nesse caso nada é gravado.
 */
export function votacaoAP(bloco, k, n, proj, det, sessoes, hoje, porNome = new Map()) {
  const votos = [];
  const cont = { sim: 0, nao: 0, abstencao: 0, 'Sem voto': 0 };
  for (const v of bloco.votos) {
    const voto = VOTOS[chaveNome(v.voto_texto_oficial)];
    if (!v.nome || !voto) return { erro: `valor de voto não reconhecido ("${v.voto_texto_oficial}") ou nome vazio` };
    cont[CHAVE_VOTO[voto]]++;
    votos.push({ parlamentar_id: porNome.get(chaveNome(v.nome)) ?? null, nome: v.nome, partido: null, uf: 'AP', voto, voto_texto_oficial: v.voto_texto_oficial });
  }
  if (new Set(votos.map((v) => chaveNome(v.nome))).size !== votos.length) return { erro: 'deputado repetido na lista de votação' };
  if (Object.values(bloco.totais).some((x) => x == null)) return { erro: 'totais da votação não encontrados na página' };
  for (const [key, val] of Object.entries(bloco.totais)) if (cont[key] !== val) return { erro: `total "${key}" da página (${val}) diferente do número de nomes (${cont[key]})` };
  const quando = dataDaSessao(bloco.sessao, sessoes, votadoEmSessao(det?.movimentacao), proj.data_apresentacao);
  const sm = /^(\d+)ª\s+Sess[ãa]o\s+(Ordin[áa]ria|Extraordin[áa]ria|Solene|Especial)/i.exec(bloco.sessao || '');
  const url = `${CASA_AP.elegis}/portal/proposicao/${proj.id_oficial}/votacao`;
  const lacunas = [
    'Resultado: a página da votação traz o voto de cada deputado e os totais, mas não escreve o resultado (aprovado ou rejeitado).',
    'Partido: a página da votação não informa o partido de cada deputado.',
    'Tipo de votação: a página não usa o termo "nominal"; o voto de cada deputado é publicado na página "Votação" da proposição.',
  ];
  if (!quando) lacunas.push('Data: o nome da sessão não pôde ser ligado, sem ambiguidade, à lista oficial de sessões e à movimentação da proposição.');
  if (votos.some((v) => !v.parlamentar_id)) lacunas.push('Algum nome da lista de votação não tem grafia idêntica à da página de deputados; o voto aparece sem ligação com o perfil.');
  return {
    votacao: {
      id: n > 1 ? `ap-${proj.id_oficial}-v${k + 1}` : `ap-${proj.id_oficial}-v`, id_fonte: proj.id_oficial, uf: 'AP', casa: CASA_AP.casa,
      data: quando?.data ?? null, hora: quando?.hora ?? null, orgao: 'Plenário', orgao_sigla: 'PLEN', orgao_nome: 'Plenário',
      sessao: { titulo: bloco.sessao || null, tipo: sm ? `Sessão ${sm[2]}` : null, numero: sm ? Number(sm[1]) : null },
      etapa: null,
      proposicao: { id: proj.id, sigla: proj.sigla, tipo: proj.tipo, numero: proj.numero, ano: proj.ano, ementa: proj.ementa ?? null, url: proj.url },
      descricao: `${proj.identificacao} — ${bloco.sessao || 'sessão não informada'}`,
      resultado: null, resultado_texto_oficial: null, tipo: 'nominal', tipo_texto_oficial: null,
      placar: { ...bloco.totais, total: votos.length }, placar_origem: 'totais-oficiais',
      conferencia_placar: `Os ${votos.length} nomes da lista conferem com os totais da página (favoráveis, contra, abstenções e sem voto).`,
      votos_situacao: 'publicados', votos,
      url, url_csv: `${url}-csv`,
      fonte: fonte('Votação da proposição — eLegis da ALAP', url, CASA_AP.nome, hoje),
      lacunas,
    },
  };
}

// ---------------------------------------------------------------- legislação
/** Página "Legislação" → { itens, total, proxima }. */
export function interpretarLegislacaoAP(html, hoje, anoFiltro = null) {
  const h = principal(html);
  const total = totalEncontrado(h);
  if (total == null) throw new Error('página de legislação sem o total de resultados');
  const tbody = /<tbody>([\s\S]*?)<\/tbody>/.exec(h.slice(h.lastIndexOf('</form>')))?.[1] || '';
  const itens = [];
  for (const c of linhas(tbody)) {
    if (c.length < 6) continue;
    // A lista às vezes repete "nº" ("Lei Complementar nº nº 0189") ou não traz a data ("Lei Complementar nº 0186").
    const m = /^(.+?)\s+n[º°o]\s*(?:n[º°o]\s*)?(\d+)(?:\s*,\s*de\s+(\d{2}\/\d{2}\/\d{4}))?$/i.exec(textoHtml(c[0]) || '');
    const def = m ? NORMA_POR_FONTE.get(chaveNome(m[1])) : null;
    if (!def) continue;
    const numero = Number(m[2]);
    const dataAto = m[3] ? dataISO(m[3], hoje) : null;
    // Sem a data da norma, o ano é o do filtro "Ano" da própria consulta oficial.
    const ano = dataAto ? Number(dataAto.slice(0, 4)) : anoFiltro;
    if (!ano) continue;
    const origem = /href="https:\/\/elegis\.al\.ap\.leg\.br\/portal\/proposicao\/(\d+)">([^<]*)<\/a>/.exec(c[4]);
    const ident = origem ? identificacaoAP(textoHtml(origem[2])) : null;
    const defP = ident ? TIPO_POR_FONTE.get(chaveNome(ident.tipoFonte)) : null;
    const texto = /href="(https:\/\/elegis\.al\.ap\.leg\.br\/portal\/proposicao\/\d+\/texto-integral)"/.exec(c[5])?.[1] || null;
    const doe = /^\d+$/.test(textoHtml(c[2]) || '') ? textoHtml(c[2]) : null;
    const em = textoPublico(textoHtml(c[1]));
    const lacunas = [];
    if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
    if (!dataAto) lacunas.push('Data da norma: não informada na lista de legislação.');
    if (!doe) lacunas.push('Número do Diário Oficial: não informado na lista de legislação.');
    if (!origem) lacunas.push('Proposição de origem: não informada na lista de legislação.');
    const urlLista = `${CASA_AP.elegis}/portal/legislacao?tipo_proposicao_id=${Object.keys(TIPOS_NORMA).find((k) => TIPOS_NORMA[k] === def)}&ano=${ano}`;
    itens.push({
      id: `${def.prefixo}-${numero}-${ano}`, uf: 'AP', casa: CASA_AP.casa, tipo: def.tipo, tipo_texto_oficial: limpar(m[1]),
      numero, ano, nome_oficial: textoHtml(c[0]), data_assinatura: dataAto, data_publicacao: dataISO(textoHtml(c[3]), hoje),
      diario_oficial: doe ? { numero: doe, data: dataISO(textoHtml(c[3]), hoje) } : null,
      ementa: em.texto,
      projeto_origem_texto: origem ? textoHtml(origem[2]) : null,
      projeto: ident && defP ? { sigla: defP.sigla, numero: ident.numero, ano: ident.ano, url: `${CASA_AP.elegis}/portal/proposicao/${origem[1]}` } : null,
      url: texto ?? urlLista,
      fonte: fonte(`${def.tipo} — Legislação do eLegis da ALAP`, urlLista, CASA_AP.nome, hoje),
      lacunas,
    });
  }
  return { itens, total, proxima: temProxima(h) };
}
