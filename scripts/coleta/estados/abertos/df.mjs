// Distrito Federal — Câmara Legislativa (CLDF). Fonte: API pública documentada do Processo Legislativo
// Eletrônico (PLe), https://ple.cl.df.gov.br/pleservico/api/public ("Autenticação: não requerida";
// documentação em https://dados.cl.df.gov.br/dataset/proposicoes e /dataset/normas).
//   deputados:    GET  /autor/listar                      (autores do tipo PARLAMENTAR com situação ATIVO)
//   proposições:  POST /proposicao/filter?page&size&sort  {"ano":"AAAA","ementa":true}
//   normas:       POST /norma/buscar?page&size            {"operadorLogico":"AND","ano":"AAAA"} (leis, LCs, decretos…)
//   norma:        GET  /norma/{id}                        (proposição de origem e publicação no DODF)
// A API não traz votações nem voto de deputado: as votações da CLDF ficam nas atas (PDF). O histórico da
// proposição traz login e IP de servidores: nunca é gravado. Link de página da proposição: o mesmo que o próprio
// PLe usa na lista de busca (/#/proposicao/{id}/consultar); a norma não tem página própria no PLe (link: DODF ou API). Funções de interpretação puras (testes.mjs).
import { limpar, dataISO, textoPublico, chaveNome, emailInstitucional, fonte, LACUNA_PRIVACIDADE } from './base.mjs';

export const CASA_DF = {
  uf: 'DF', casa: 'cldf', nome: 'Câmara Legislativa do Distrito Federal (CLDF)',
  api: 'https://ple.cl.df.gov.br/pleservico/api/public', web: 'https://ple.cl.df.gov.br',
  dominios_email: ['cl.df.gov.br'],
};

// ---------------------------------------------------------------- deputados
export function interpretarAutoresDF(lista, hoje) {
  const itens = (Array.isArray(lista) ? lista : [])
    .filter((a) => a?.tipoAutor === 'PARLAMENTAR' && a?.situacao === 'ATIVO' && Number.isFinite(a?.id))
    .map((a) => {
      const partido = limpar(a.partidoPoliticoSigla);
      return {
        id: String(a.id), uf: 'DF', casa: CASA_DF.casa, nome: limpar(a.nome), partido,
        em_exercicio: null, situacao_cadastro: 'ATIVO',
        foto: typeof a.urlImagem === 'string' && /^https:\/\/www\.cl\.df\.gov\.br\//.test(a.urlImagem) ? a.urlImagem : null,
        email: emailInstitucional(a.email, CASA_DF.dominios_email), url_oficial: null,
        lacunas: [
          ...(partido ? [] : ['Partido: não informado no cadastro de autores do PLe (Informação não disponível em fonte oficial).']),
          'Situação "ATIVO" é a do cadastro de autores do PLe; o período de mandato não vem nessa fonte.',
        ],
      };
    });
  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    atualizado_em: hoje, uf: 'DF', casa: CASA_DF.casa,
    fonte: fonte('Autores parlamentares ativos — API pública do PLe/CLDF', `${CASA_DF.api}/autor/listar`, CASA_DF.nome, hoje),
    itens,
  };
}

// ---------------------------------------------------------------- proposições
/** "PL 2519/2026" → { sigla, numero, ano }. */
export function separarSigla(s) {
  const m = /^\s*([A-ZÀ-Ú]+)\s+(\d+)\/(\d{4})\s*$/.exec(String(s || ''));
  return m ? { sigla: m[1], numero: Number(m[2]), ano: Number(m[3]) } : null;
}

const semCerquilha = (s) => limpar(String(s || '').replace(/^#|#$/g, '').split('#').filter(Boolean).join('; '));

export function interpretarProposicaoDF(r, hoje, porNomeParl = new Map()) {
  if (!Number.isFinite(r?.id)) return null;
  const s = separarSigla(r.siglaNumeroAno);
  const em = textoPublico(r.ementa);
  const lacunas = ['Data de apresentação: a lista da API traz a data de leitura em Plenário ("data_leitura").'];
  if (!s) lacunas.push('Sigla e número: não informados de forma legível na lista da API.');
  if (em.pendente) lacunas.push(LACUNA_PRIVACIDADE);
  // "autoria" é texto ("Deputado X, Deputada Y"); liga ao deputado só com nome idêntico ao do cadastro de autores.
  const autoriaBruta = limpar(r.autoria);
  const nomes = autoriaBruta ? autoriaBruta.split(/\s*,\s*/).filter(Boolean) : [];
  const autores = nomes.map((n) => {
    const pid = porNomeParl.get(chaveNome(n)) ?? null;
    if (pid || /^(Deputad[oa]|Comiss|Mesa|Poder|Tribunal|Defensoria|Minist|Governador)/i.test(n)) return { nome: n, parlamentar_id: pid };
    const t = textoPublico(n);
    if (t.pendente) lacunas.push(LACUNA_PRIVACIDADE);
    return { nome: t.texto, parlamentar_id: null };
  });
  return {
    id: `df-${r.id}`, id_oficial: r.id, uf: 'DF', casa: CASA_DF.casa,
    sigla: s?.sigla ?? null, tipo: limpar(r.tipoProposicao), numero: s?.numero ?? null, ano: s?.ano ?? null,
    identificacao: limpar(r.siglaNumeroAno), data_apresentacao: null, data_leitura: dataISO(r.dataLeitura, hoje),
    ementa: em.texto, autores, tema: semCerquilha(r.temaNome), regiao_administrativa: semCerquilha(r.regiaoAdministrativaNome),
    situacao: { texto: limpar(r.etapa), etapa: limpar(r.etapa) }, situacao_coletada_em: hoje,
    url: `${CASA_DF.web}/#/proposicao/${r.id}/consultar`,
    fonte_dados: `${CASA_DF.api}/proposicao/${r.id}/detalhe`,
    privacidade_pendente: em.pendente || undefined, lacunas: [...new Set(lacunas)],
  };
}

// ---------------------------------------------------------------- normas
const PREFIXO = (t) => {
  const d = String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/lei complementar/.test(d)) return 'lc';
  if (/^lei/.test(d)) return 'lei';
  if (/decreto legislativo/.test(d)) return 'dl';
  if (/decreto/.test(d)) return 'dec';
  if (/emenda/.test(d)) return 'elo';
  if (/resolu/.test(d)) return 'res';
  return d.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'norma';
};

/** Item da lista /norma/buscar (sem detalhe). */
export function interpretarNormaListaDF(r, hoje) {
  if (!Number.isFinite(r?.id)) return null;
  const m = /(\d+)\/(\d{4})\s*$/.exec(r.siglaNumeroAno || '');
  const numero = m ? Number(m[1]) : null;
  const ano = Number(r.ano) || (m ? Number(m[2]) : null);
  const em = textoPublico(r.ementa);
  const tipo = limpar(r.tipoNorma);
  return {
    id: `${PREFIXO(tipo)}-${numero ?? r.id}-${ano ?? 'sem-ano'}`, id_oficial: r.id, uf: 'DF', casa: CASA_DF.casa,
    tipo, numero, ano, nome_oficial: limpar(r.siglaNumeroAno), data_assinatura: dataISO(r.dataAssinatura, hoje),
    data_publicacao: null, publicacao: null, ementa: em.texto, autoria: limpar(r.autores),
    projeto_origem: null, url: `${CASA_DF.api}/norma/${r.id}`,
    fonte: fonte(`${tipo || 'Norma'} — API pública de Normas do PLe/CLDF`, `${CASA_DF.api}/norma/${r.id}`, CASA_DF.nome, hoje),
    detalhe_coletado: false, privacidade_pendente: em.pendente || undefined,
    lacunas: ['Publicação no Diário Oficial do DF: detalhe da norma ainda não coletado.', ...(em.pendente ? [LACUNA_PRIVACIDADE] : [])],
  };
}

/** Acrescenta o detalhe de /norma/{id}: publicação no DODF e proposição de origem (ids oficiais). */
export function aplicarDetalheNormaDF(item, d, hoje) {
  if (!d || d.id !== item.id_oficial) return item;
  const pubs = (d.normaFontes || []).map((f) => ({
    tipo: limpar(f?.tipoPublicacao?.nome), data: dataISO(f?.publicacaoDiario?.dataPublicacao, hoje),
    nome: limpar(f?.publicacaoDiario?.nomeCompleto), url: /^https:\/\/dodf\.df\.gov\.br\//.test(f?.publicacaoDiario?.urlPublicacao || '') ? f.publicacaoDiario.urlPublicacao : null,
  })).filter((p) => p.data || p.nome);
  const original = pubs.filter((p) => p.tipo === 'Publicação').sort((a, b) => String(a.data).localeCompare(String(b.data)))[0] || null;
  const po = d.proposicaoNorma;
  const s = po ? separarSigla(`${po.tipoProposicao?.sigla || ''} ${po.numeroDefinitivo || ''}`) : null;
  const lacunas = item.lacunas.filter((l) => !/^Publicação no Diário Oficial do DF/.test(l));
  if (!original) lacunas.push('Publicação no Diário Oficial do DF: não informada no cadastro da norma.');
  return {
    ...item, detalhe_coletado: true,
    data_publicacao: original?.data ?? null, publicacao: original?.nome ?? null,
    publicacoes: pubs, url: original?.url || item.url,
    projeto_origem: po && Number.isFinite(po.id) ? {
      id: `df-${po.id}`, identificacao: s ? `${s.sigla} ${s.numero}/${s.ano}` : null,
      sigla: s?.sigla ?? null, numero: s?.numero ?? null, ano: s?.ano ?? null, url: `${CASA_DF.web}/#/proposicao/${po.id}/consultar`,
    } : null,
    origem: limpar(d.normaOrigem?.sigla),
    temas: (d.normaTemas || []).map((t) => limpar(t?.tema?.nome)).filter(Boolean),
    lacunas: [...new Set(lacunas)],
  };
}
