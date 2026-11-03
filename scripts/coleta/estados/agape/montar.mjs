// Montagem dos arquivos publicados (funções puras). Formato: definições "parlamentar", "votacao" e
// "norma" de dados/esquema.json, com "uf" e "casa". Votação só existe quando a tramitação oficial
// registra uma deliberação; o voto de cada deputado é sempre "Informação não disponível em fonte
// oficial" (as duas Casas não o publicam) e nunca é deduzido de "unanimidade" ou de notícia.
import { LACUNA_VOTO_INDIVIDUAL, VOTO_INDISPONIVEL } from './deliberacoes.mjs';

const semVazios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
export const anoDe = (d) => (d && /^\d{4}/.test(d) ? d.slice(0, 4) : 'sem-data');

export function fonte(cfg, titulo, caminho, hoje, host = cfg.host) {
  return { titulo, url: /^https?:/.test(caminho) ? caminho : `https://${host}${caminho}`, orgao: cfg.nome, acessado_em: hoje };
}

export function montarParlamentares(lista, cfg, hoje) {
  const itens = lista.map((p) => semVazios({
    id: p.id, nome: p.nome, nome_civil: p.nome_civil, partido: p.partido, partido_nome: p.partido_nome,
    uf: cfg.uf, casa: cfg.casa, em_exercicio: p.em_exercicio, situacao_fonte: p.situacao_fonte,
    legislatura: p.legislatura, cargo_mesa: p.cargo_mesa, foto: p.foto,
    url_oficial: `https://${cfg.host}/spl/parlamentar.aspx?id=${p.id}`, email: p.email, autor_id: p.autor_id,
  })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  const legs = [...new Set(itens.map((p) => p.legislatura).filter(Boolean))];
  return {
    atualizado_em: hoje, uf: cfg.uf, casa: cfg.casa,
    legislatura: legs.length === 1 ? { numero: legs[0] } : null,
    fonte: fonte(cfg, `Parlamentares — dados abertos do SPL da ${cfg.sigla}`, '/api/publico/parlamentar/', hoje),
    observacao: 'Em exercício = situação "Ativo" na fonte. Sem telefone, gabinete, perfil biográfico ou e-mail que não seja do domínio da Casa.',
    itens,
  };
}

export const idVotacao = (p, d) => `${p.uf.toLowerCase()}-${p.id_oficial}-${d.id}`;

export function montarVotacao(p, d, cfg) {
  const lacunas = [LACUNA_VOTO_INDIVIDUAL];
  if (!d.tipo) lacunas.push('Forma de votação (nominal, simbólica ou outra): não informada no registro oficial.');
  if (d.tipo === 'unanimidade-registrada') lacunas.push('O registro informa unanimidade, sem lista de deputados presentes; nenhum voto individual é atribuído.');
  if (d.tipo === 'maioria-registrada') lacunas.push('O registro informa aprovação/rejeição por maioria, sem placar nem nomes.');
  if (d.tipo === 'nominal') lacunas.push('O registro menciona votação nominal, mas a lista de votos por deputado não é publicada em fonte oficial estruturada.');
  if (/bancada|bloco|lideran/i.test(d.descricao)) lacunas.push('O registro menciona posição de bancada; isso não identifica o voto de cada deputado.');
  if (!d.data) lacunas.push('Data da deliberação: não consta no texto do registro (a data do lançamento na tramitação está em "data_registro").');
  if (!d.orgao) lacunas.push(`Órgão que deliberou: não informado no registro, lançado pelo setor "${d.setor_registro || 'não informado'}".`);
  if (p.correcoes?.length) lacunas.push(`A tramitação registra correção de despacho: "${p.correcoes.map((c) => c.texto).join('" / "')}".`);
  if (p.privacidade_pendente) lacunas.push('Trecho com possível nome de particular aguardando conferência (diretriz 12).');
  return semVazios({
    id: idVotacao(p, d), id_oficial: d.id, uf: cfg.uf, casa: cfg.casa,
    data: d.data, hora: null, data_registro: d.data_registro,
    orgao: d.orgao, orgao_registro: d.setor_registro,
    proposicao: { id: p.id, sigla: p.sigla, tipo: p.tipo, numero: p.numero, ano: p.ano, ementa: p.ementa, url: p.url },
    descricao: d.descricao, objeto: d.objeto, etapa: d.etapa,
    resultado: d.resultado, resultado_oficial: d.descricao,
    tipo: d.tipo, tipo_origem: d.tipo ? 'texto do registro oficial' : null,
    placar: d.placar, placar_origem: d.placar ? 'totais-oficiais' : null,
    conferencia_placar: d.placar ? 'Números copiados do texto do registro oficial; sem lista nominal para conferência.' : null,
    orientacoes: [], votos: [], votos_situacao: 'nao-publicado-na-fonte', voto_individual: VOTO_INDISPONIVEL,
    outros_registros: d.outros_registros?.length ? d.outros_registros : undefined,
    documento: d.documento, url: p.url,
    fonte: { titulo: `Tramitação de ${p.identificacao || p.id} — SPL da ${cfg.sigla}`, url: p.fonte_dados, orgao: cfg.nome, acessado_em: p.acessado_em },
    lacunas: [...new Set(lacunas)],
  });
}

export function resumoVotacao(v) {
  return semVazios({
    id: v.id, data: v.data, data_registro: v.data_registro, orgao: v.orgao,
    proposicao: v.proposicao.sigla ? `${v.proposicao.sigla} ${v.proposicao.numero}/${v.proposicao.ano}` : v.proposicao.id,
    descricao: v.descricao, objeto: v.objeto, resultado: v.resultado, tipo: v.tipo, placar: v.placar,
    votos_situacao: v.votos_situacao,
  });
}

/** Proposição como gravada no índice (deliberações com a referência do arquivo de votação). */
export function proposicaoPublicada(p) {
  if (!p.deliberacoes) return p;
  return { ...p, deliberacoes: p.deliberacoes.map((d) => ({ ...d, votacao_ref: idVotacao(p, d) })) };
}

export function indiceNormas(itens, cfg, ano, hoje, fontes, abrangencia) {
  const ord = [...itens].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || String(a.id).localeCompare(String(b.id)));
  return { atualizado_em: hoje, uf: cfg.uf, casa: cfg.casa, ano: Number(ano) || null, abrangencia, fontes, itens: ord.map((n) => semVazios({ uf: cfg.uf, ...n })) };
}
