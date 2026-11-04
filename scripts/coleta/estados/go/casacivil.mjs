// Interpretação das respostas da API aberta da Casa Civil de Goiás (legisla.casacivil.go.gov.br/api), Brasil na Lupa.
// Funções puras (sem rede), testadas em testes.mjs. Nada é deduzido: campo ausente fica null e a lacuna é anotada.
// Só o Poder Executivo: leis (sancionadas e publicadas), leis complementares, decretos numerados, emendas
// constitucionais e mensagens de veto (com as razões, em texto integral). A Assembleia (ALEGO) não é acessada.
import { limpar, dataISO, textoPublico, fonte, LACUNA_PRIVACIDADE } from '../abertos/base.mjs';

export const CASA_CIVIL = {
  uf: 'GO',
  casa: 'alego',
  site: 'https://legisla.casacivil.go.gov.br',
  api: 'https://legisla.casacivil.go.gov.br/api',
  nome: 'Secretaria de Estado da Casa Civil de Goiás',
  doe: 'Diário Oficial do Estado de Goiás',
};

/** Tipos coletados: id na API → [prefixo do id, tipo no contrato do site]. */
export const TIPOS_GO = {
  2: ['lei', 'Lei'],
  1: ['lc', 'Lei Complementar'],
  3: ['dec', 'Decreto'],
  13: ['ec', 'Emenda Constitucional'],
};

const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');

/** Página pública da norma e da mensagem de veto no site da Casa Civil. */
export const urlLegislacao = (id) => `${CASA_CIVIL.site}/pesquisa_legislacao/${id}`;
export const urlVeto = (id) => `${CASA_CIVIL.site}/pesquisa_mensagem_veto/${id}`;

/** HTML do texto oficial → texto com uma linha por parágrafo (links viram o texto do link). */
export function htmlParaTexto(html) {
  if (!html) return null;
  const t = String(html)
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h\d|footer|tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  const linhas = t.split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean);
  return linhas.length ? linhas.join('\n') : null;
}

// Linhas do cabeçalho e da assinatura da mensagem de veto que só trazem agentes públicos no exercício da função
// (o presidente da Assembleia como destinatário, o governador que assina) ou o nome do prédio da Assembleia.
const LINHA_DESTINATARIO = /^(?:Deputad[oa]\s+Estadual\s+[A-ZÀ-Ý][^\d,;:]{2,60}|Pal[áa]cio\s+[A-ZÀ-Ý][^\d,;:]{2,60})$/;
const LINHA_CARGO_GOVERNADOR = /^Governador(?:a)?\s+do\s+Estado(?:\s+de\s+Goi[áa]s)?\.?$/i;

/** Texto oficial com particulares mascarados, preservando as quebras de parágrafo. */
function textoLongoPublico(texto) {
  if (!texto) return { texto: null, pendente: false };
  let pendente = false;
  const todas = texto.split('\n');
  const linhas = todas.map((l, i) => {
    const assinatura = LINHA_CARGO_GOVERNADOR.test(todas[i + 1] ?? '') && /^[A-ZÀ-Ý][A-ZÀ-Ý\s.'-]{3,60}$/.test(l);
    if (assinatura || LINHA_DESTINATARIO.test(l)) return l;
    const r = textoPublico(l);
    if (r.pendente) pendente = true;
    return r.texto;
  });
  return { texto: linhas.filter(Boolean).join('\n') || null, pendente };
}

/** Edições do Diário Oficial informadas pela Casa Civil (a lista da API traz datas em dd/mm/aaaa). */
function publicacoes(diarios, hoje) {
  return (Array.isArray(diarios) ? diarios : []).map((d) => ({
    data: dataISO(d?.data_diario ?? d?.data, hoje),
    numero: limpar(d?.numero),
    suplemento: d?.suplemento === true || /^sim$/i.test(String(d?.suplemento ?? '')) ? true : d?.suplemento === false || /^n[aã]o$/i.test(String(d?.suplemento ?? '')) ? false : null,
    url: /^https?:\/\//.test(String(d?.link_download ?? '')) ? String(d.link_download) : null,
  })).filter((p) => p.data || p.numero);
}

/** Item da lista /api/v1/pesquisa/legislacoes → norma (contrato de dados/estados/<uf>/normas). */
export function interpretarLegislacaoGO(r, hoje) {
  const t = TIPOS_GO[r?.tipo_legislacao?.id ?? r?.tipo_legislacao_id];
  if (!r?.id || !t) return null;
  const [prefixo, tipo] = t;
  const numero = limpar(r.numero);
  const ano = Number(r.ano) || null;
  const lacunas = [];
  const em = textoPublico(r.ementa);
  if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
  if (!em.texto) lacunas.push('Ementa não informada pela Casa Civil.');
  const pub = publicacoes(r.diarios, hoje);
  const primeira = pub.find((p) => p.url) || pub[0] || null;
  if (!pub.length) lacunas.push('Publicação no Diário Oficial não informada pela Casa Civil.');
  else if (!primeira?.url) lacunas.push('Link da edição do Diário Oficial ainda não informado pela Casa Civil: o link leva à página da norma no site da Casa Civil.');
  const autor = limpar(r.autor);
  const pagina = urlLegislacao(r.id);
  const nome = numero ? `${tipo} nº ${numero}${ano ? `, de ${ano}` : ''}` : null;
  return {
    id: `${prefixo}-${soDigitos(numero) || `id${r.id}`}-${ano ?? 'sd'}`,
    id_oficial: r.id,
    uf: CASA_CIVIL.uf,
    tipo,
    tipo_oficial: limpar(r.tipo_legislacao?.nome),
    numero,
    ano,
    nome_oficial: nome,
    titulo: nome,
    data_assinatura: dataISO(r.data_legislacao, hoje),
    data_publicacao: pub.map((p) => p.data).filter(Boolean).sort()[0] ?? null,
    publicacao: pub,
    ementa: em.texto,
    autoria: autor,
    projeto_origem_texto: autor ? `Autoria registrada pela Casa Civil: ${autor}` : null,
    numero_processo_projeto_lei: limpar(r.numero_processo_projeto_lei),
    situacao: limpar(r.estado_legislacao?.nome),
    url: primeira?.url ?? pagina,
    url_casa_civil: pagina,
    fonte: fonte(`${tipo} — API da Casa Civil de Goiás`, pagina, CASA_CIVIL.nome, hoje),
    lacunas,
  };
}

/** Item da lista /api/v1/pesquisa/mensagens_veto → veto (sem as razões; ver aplicarDetalheVetoGO). */
export function interpretarVetoListaGO(r, hoje) {
  if (!r?.id) return null;
  const tv = limpar(r.tipo_veto);
  const tipo = /^parcial/i.test(tv ?? '') ? 'Veto Parcial' : /^(integral|total)/i.test(tv ?? '') ? 'Veto Total' : 'Veto';
  const numero = limpar(r.numero);
  const ano = Number(r.ano) || null;
  const em = textoPublico(r.ementa);
  const lacunas = ['Data de publicação no Diário Oficial não informada pela Casa Civil: a data mostrada é a da mensagem de veto.'];
  if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
  const texto = em.texto ?? '';
  const autografo = /Aut[óo]grafo de Lei n[ºo°]?\s*([\d.]+)/i.exec(texto)?.[1] ?? null;
  const processos = [...texto.matchAll(/ALEGO\s+com\s+o?s?\s*Processos?\s+n[ºo°]?\s*([\d./]+(?:\s*\(SEI[^)]*\))?(?:\s*e\s*n[ºo°]?\s*[\d./]+)?)/gi)].map((m) => m[1].replace(/\s*\(SEI[^)]*\)/g, '').trim());
  const lei = r.legislacao?.numero ? `${limpar(r.legislacao?.tipo_legislacao?.nome ?? r.tipo_legislacao?.nome) ?? 'Lei'} nº ${limpar(r.legislacao.numero)}` : null;
  const origem = [
    autografo ? `Autógrafo de Lei nº ${autografo}` : null,
    processos.length ? `processo na Assembleia nº ${processos.join(', ')}` : null,
    lei ? `norma relacionada na Casa Civil: ${lei}` : null,
  ].filter(Boolean);
  const pagina = urlVeto(r.id);
  const nome = numero ? `Ofício Mensagem nº ${numero}/${ano ?? ''} (${tipo.toLowerCase()})`.replace('/ (', ' (') : null;
  return {
    id: `veto-${r.id}`,
    id_oficial: r.id,
    uf: CASA_CIVIL.uf,
    tipo,
    tipo_oficial: tv,
    numero,
    ano,
    nome_oficial: nome,
    titulo: nome,
    data_assinatura: dataISO(r.data, hoje),
    data_publicacao: null,
    publicacao: [],
    ementa: em.texto,
    autoria: null,
    projeto_origem_texto: origem.length ? origem.join('; ') : null,
    legislacao_relacionada: r.legislacao?.id ? { id_oficial: r.legislacao.id, nome: lei, url: urlLegislacao(r.legislacao.id) } : null,
    razoes_veto: null,
    detalhe_coletado: false,
    url: pagina,
    url_casa_civil: pagina,
    url_pdf: `${CASA_CIVIL.api}/v1/pesquisa/mensagens_veto/${r.id}/pdf`,
    fonte: fonte('Mensagem de veto — API da Casa Civil de Goiás', pagina, CASA_CIVIL.nome, hoje),
    lacunas: [...lacunas, 'Razões do veto: texto integral ainda não coletado.'],
  };
}

/** Detalhe /api/v1/pesquisa/mensagens_veto/{id} → razões do veto em texto integral (campo "conteudo"). */
export function aplicarDetalheVetoGO(v, d, hoje) {
  const bruto = htmlParaTexto(d?.conteudo);
  const r = textoLongoPublico(bruto);
  const lacunas = v.lacunas.filter((l) => !/^Razões do veto/.test(l) && l !== LACUNA_PRIVACIDADE);
  if (!r.texto) lacunas.push('Razões do veto não informadas pela Casa Civil.');
  if (r.pendente || v.lacunas.includes(LACUNA_PRIVACIDADE)) lacunas.push(LACUNA_PRIVACIDADE);
  const assunto = /^Assunto:\s*(.+)$/im.exec(r.texto ?? '')?.[1]?.replace(/\.\s*$/, '').trim() ?? null;
  return {
    ...v,
    titulo: assunto && v.nome_oficial ? `${v.nome_oficial}: ${assunto}` : v.titulo,
    razoes_veto: r.texto,
    detalhe_coletado: true,
    fonte: { ...v.fonte, acessado_em: hoje },
    lacunas: [...new Set(lacunas)],
  };
}
