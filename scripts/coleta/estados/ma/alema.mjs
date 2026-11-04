// Maranhão — Assembleia Legislativa (ALEMA). Fonte: API pública JSON (sem documentação) do sistema ALEMALEGIS,
// https://alemalegis.al.ma.leg.br/api/v1/public (sem autenticação; rotas mapeadas a partir do código do próprio site).
//   composição da 20ª legislatura: GET /parliamentary/filter/legislature/20     (id e nome dos 42 parlamentares)
//   cadastro (partido, atividade): GET /parliamentary?page&size                (todas as legislaturas; cruzado pelo id)
//   matérias do ano:               GET /legislative-matter/filter/access?page&size&sort=id,desc&year=AAAA
//   tramitação de uma matéria:     GET /processing/filter/legislative-matter/{id}
//   normas do ano:                 GET /legal-norm/filter?page&size&sort=id,desc&year=AAAA
//   norma (publicação e origem):   GET /legal-norm/{id}
//   sessões e votos:               GET /plenary-session, GET /votes/plenary-session/{id}
// O cadastro de cada parlamentar fica ligado a uma única legislatura (a do primeiro mandato no sistema): por isso
// a lista sai da rota de composição da legislatura 20, e não do campo "legislatureId" do cadastro.
// A rota de detalhe do parlamentar traz campos de CPF, RG e endereço (vazios hoje): nunca é chamada.
// Os anexos das proposições (cartão CNPJ, estatutos, declarações) não são gravados.
// Links de página: as rotas públicas do próprio ALEMALEGIS (/sapl/protocol/...). Funções puras (testes.mjs).
import { limpar, dataISO, textoPublico, chaveNome, fonte, LACUNA_PRIVACIDADE } from '../abertos/base.mjs';

export const CASA_MA = {
  uf: 'MA', casa: 'alema', nome: 'Assembleia Legislativa do Estado do Maranhão (ALEMA)',
  api: 'https://alemalegis.al.ma.leg.br/api/v1/public', web: 'https://alemalegis.al.ma.leg.br/sapl/protocol',
  legislatura: 20,
};
const C = CASA_MA;
export const urlMateria = (id) => `${C.web}/legislative-matter/detail/${id}`;
export const urlNorma = (id) => `${C.web}/legal-norm/detail/${id}`;
export const urlParlamentar = (id) => `${C.web}/parliamentary/details/${id}`;

// ---------------------------------------------------------------- deputados
/**
 * composicao: lista de /parliamentary/filter/legislature/20; cadastro: content de /parliamentary (todas as legislaturas).
 * Partido = filiação marcada como atual no cadastro; "em exercício" = campo "Atividade" do cadastro ("ACTIVE").
 */
export function interpretarDeputadosMA(composicao, cadastro, hoje) {
  const porId = new Map((Array.isArray(cadastro) ? cadastro : []).filter((p) => Number.isFinite(p?.id)).map((p) => [p.id, p]));
  const vistos = new Set();
  const itens = [];
  for (const c of Array.isArray(composicao) ? composicao : []) {
    if (!Number.isFinite(c?.id) || vistos.has(c.id)) continue;
    vistos.add(c.id);
    const cad = porId.get(c.id) || null;
    const nome = limpar(c.parliamentaryName) || limpar(cad?.parliamentaryName);
    if (!nome) continue;
    const filiacao = cad?.partyAffiliationId;
    const partido = filiacao && filiacao.currentParty !== false ? limpar(filiacao.partyAcronym) : null;
    const ativ = cad?.activeInHouse;
    const lacunas = [
      'Foto e e-mail: a API pública não os traz na lista (a foto só sai por link temporário). Informação não disponível em fonte oficial nesta coleta.',
      'Período do mandato: a API traz a composição da 20ª legislatura (2023–2026), sem as datas de posse e de afastamento.',
    ];
    if (!cad) lacunas.push('Cadastro do parlamentar não encontrado na lista geral da API: partido e atividade não informados.');
    else if (!partido) lacunas.push('Partido: não informado no cadastro do ALEMALEGIS (Informação não disponível em fonte oficial).');
    itens.push({
      id: String(c.id), uf: C.uf, casa: C.casa, nome, nome_civil: limpar(c.fullName) || limpar(cad?.fullName),
      partido, partido_nome: partido ? limpar(filiacao.partyName) : null,
      em_exercicio: ativ === 'ACTIVE' ? true : ativ === 'INACTIVE' ? false : null,
      situacao_cadastro: ativ === 'ACTIVE' ? 'Ativo na Casa' : ativ === 'INACTIVE' ? 'Inativo na Casa' : null,
      legislatura: C.legislatura, foto: null, email: null, url_oficial: urlParlamentar(c.id), lacunas,
    });
  }
  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    atualizado_em: hoje, uf: C.uf, casa: C.casa, legislatura: C.legislatura,
    fonte: fonte(`Composição da ${C.legislatura}ª legislatura — API pública do ALEMALEGIS`, `${C.api}/parliamentary/filter/legislature/${C.legislatura}`, C.nome, hoje),
    itens,
  };
}

// ---------------------------------------------------------------- proposições
const INSTITUICAO = /^(PODER|MESA|COMISS|TRIBUNAL|DEFENSORIA|MINIST|GOVERNAD|PROCURADORIA|ASSEMBLEIA|C[AÂ]MARA|PREFEIT|LIDERAN|BANCADA)/i;
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Autores (texto "authorNames"); liga ao deputado só com nome idêntico ao da composição. */
export function interpretarAutores(texto, porNomeParl = new Map()) {
  const bruto = limpar(texto);
  if (!bruto) return { autores: [], pendente: false };
  let pendente = false;
  const autores = bruto.split(/\s*[;,]\s*/).filter(Boolean).map((n) => {
    const pid = porNomeParl.get(chaveNome(n)) ?? null;
    if (pid || INSTITUICAO.test(n)) return { nome: n, parlamentar_id: pid };
    const t = textoPublico(n);
    if (t.pendente) pendente = true;
    return { nome: t.texto, parlamentar_id: null };
  });
  return { autores, pendente };
}

export function interpretarMateriaMA(r, hoje, porNomeParl = new Map()) {
  if (!Number.isFinite(r?.id)) return null;
  const sigla = limpar(r.matterTypeSigla);
  const numero = num(r.number);
  const ano = num(r.year);
  const em = textoPublico(r.ement);
  const au = interpretarAutores(r.authorNames, porNomeParl);
  const lacunas = [];
  if (!sigla || numero == null || !ano) lacunas.push('Sigla, número ou ano: não informados na lista da API.');
  if (!au.autores.length) lacunas.push('Autoria: não informada na lista da API (Informação não disponível em fonte oficial).');
  if (em.pendente || au.pendente) lacunas.push(LACUNA_PRIVACIDADE);
  const normas = (Array.isArray(r.legalNorms) ? r.legalNorms : []).filter((n) => Number.isFinite(n?.id));
  const norma = normas[0] || null;
  const situacao = limpar(r.situation);
  return {
    id: `ma-${r.id}`, id_oficial: r.id, uf: C.uf, casa: C.casa,
    sigla, tipo: limpar(r.matterTypeDescription), numero, ano,
    identificacao: sigla && numero != null && ano ? `${sigla} ${numero}/${ano}` : null,
    data_apresentacao: dataISO(r.presentationDate, hoje), data_publicacao: dataISO(r.publicationDate, hoje),
    ementa: em.texto, autores: au.autores,
    situacao: {
      texto: situacao, etapa: situacao, lotacao: limpar(r.currentLocation),
      ultima_tramitacao: limpar(r.lastAction) ? { data: dataISO(r.forwardingDate, hoje), descricao: textoPublico(r.lastAction).texto } : null,
      url_norma: norma ? urlNorma(norma.id) : null,
      norma: norma ? limpar(`${limpar(norma.description) || 'Norma'} nº ${limpar(norma.number) || '?'}/${limpar(norma.year) || '?'}`) : null,
    },
    normas_geradas: normas.map((n) => ({ id_oficial: n.id, tipo: limpar(n.description), sigla: limpar(n.acronym), numero: num(n.number), ano: num(n.year), url: urlNorma(n.id) })),
    situacao_coletada_em: hoje,
    url: urlMateria(r.id),
    fonte_dados: `${C.api}/legislative-matter/filter/access?year=${ano ?? ''}&sort=id,desc`,
    privacidade_pendente: em.pendente || au.pendente || undefined,
    lacunas,
  };
}

/** Chave que muda quando a matéria anda (decide se a tramitação precisa ser relida). */
export const marcaAndamento = (p) => `${p?.situacao?.ultima_tramitacao?.data ?? ''}|${p?.situacao?.ultima_tramitacao?.descricao ?? ''}|${p?.situacao?.lotacao ?? ''}`;

const unidade = (u) => (u ? limpar(u.organization?.name) || limpar(u.commission?.name) || limpar(u.parliamentary?.parliamentaryName) || null : null);

/** Lista de /processing/filter/legislative-matter/{id} → andamentos (mais recente primeiro), sem anexos. */
export function interpretarTramitacaoMA(lista, idOficial, hoje) {
  const itens = (Array.isArray(lista) ? lista : [])
    .filter((t) => Number.isFinite(t?.id) && (t.legislativeMatterId == null || t.legislativeMatterId === idOficial))
    .map((t) => ({
      id_oficial: t.id,
      data: dataISO(t.matterDate, hoje) ?? dataISO(t.forwardingDate, hoje),
      origem: unidade(t.localUnit), destino: unidade(t.destinationUnit),
      status: limpar(t.status?.description), descricao: textoPublico(t.actionText).texto,
      urgente: t.urgent?.description === 'Sim' ? true : t.urgent?.description === 'Não' ? false : null,
    }));
  itens.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || b.id_oficial - a.id_oficial);
  return itens;
}

// ---------------------------------------------------------------- normas
const PREFIXO = (sigla, tipo) => {
  const d = String(tipo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/complementar/.test(d)) return 'lc';
  if (/^lei/.test(d)) return 'lei';
  if (/resolu/.test(d)) return 'res';
  if (/emenda/.test(d)) return 'ec';
  if (/decreto/.test(d)) return 'dl';
  return String(sigla || 'norma').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'norma';
};

/** Item de /legal-norm/filter (sem detalhe). O id público inclui o id oficial: "Lei" e "Lei Ordinária" convivem na fonte. */
export function interpretarNormaListaMA(r, hoje) {
  if (!Number.isFinite(r?.id)) return null;
  const tipo = limpar(r.legalNormType?.description);
  const sigla = limpar(r.legalNormType?.additionalData?.Sigla);
  const numero = num(r.number);
  const ano = num(r.year);
  const em = textoPublico(r.ement);
  return {
    id: `${PREFIXO(sigla, tipo)}-${numero ?? 'sn'}-${ano ?? 'sem-ano'}-${r.id}`, id_oficial: r.id, uf: C.uf, casa: C.casa,
    tipo, sigla, numero, ano, nome_oficial: tipo && numero != null ? `${tipo} nº ${numero}/${ano ?? '?'}` : null,
    data_assinatura: dataISO(r.date, hoje), data_publicacao: null, publicacao: null,
    ementa: em.texto, projeto_origem: null, url: urlNorma(r.id),
    fonte: fonte(`${tipo || 'Norma'} — API pública do ALEMALEGIS`, `${C.api}/legal-norm/${r.id}`, C.nome, hoje),
    detalhe_coletado: false, privacidade_pendente: em.pendente || undefined,
    lacunas: ['Data de publicação e projeto de origem: detalhe da norma ainda não coletado.', ...(em.pendente ? [LACUNA_PRIVACIDADE] : [])],
  };
}

/** Acrescenta o detalhe de /legal-norm/{id}: data de publicação, veículo e matéria de origem (id oficial). */
export function aplicarDetalheNormaMA(item, d, hoje) {
  if (!d || d.id !== item.id_oficial) return item;
  const lm = d.legislativeMatter;
  const sigla = limpar(lm?.legislativeMatterType?.additionalData?.Sigla);
  const numero = num(lm?.number);
  const ano = num(lm?.year);
  const lacunas = item.lacunas.filter((l) => !/^Data de publicação e projeto de origem/.test(l));
  const dataPub = dataISO(d.publicationDate, hoje);
  if (!dataPub) lacunas.push('Data de publicação: não informada no cadastro da norma (Informação não disponível em fonte oficial).');
  if (!lm) lacunas.push('Projeto de origem: não informado no cadastro da norma.');
  return {
    ...item, detalhe_coletado: true,
    data_publicacao: dataPub, publicacao: limpar(d.publicationVehicle?.description ?? d.publicationVehicle) || null,
    esfera: limpar(d.federativeSphereType),
    projeto_origem: lm && Number.isFinite(lm.id) ? {
      id: `ma-${lm.id}`, identificacao: sigla && numero != null && ano ? `${sigla} ${numero}/${ano}` : null,
      sigla, numero, ano, tipo: limpar(lm.legislativeMatterType?.description), url: urlMateria(lm.id),
    } : null,
    lacunas: [...new Set(lacunas)],
  };
}

// ---------------------------------------------------------------- sessões e votos
/** Resumo das sessões cadastradas (só contagens e atas: a API não traz voto nominal hoje). */
export function resumirSessoesMA(sessoes, votosPorSessao, hoje) {
  return (Array.isArray(sessoes) ? sessoes : []).filter((s) => Number.isFinite(s?.id)).map((s) => ({
    id_oficial: s.id, numero: num(s.number), tipo: limpar(s.plenarySessionType?.description),
    data: dataISO(s.startDate, hoje), situacao: limpar(s.status), presentes_plenario: num(s.plenaryPresentCount),
    atas: (s.attachments || []).filter((a) => a?.isMinutes).map((a) => limpar(a.name)).filter(Boolean),
    votos_publicados: Array.isArray(votosPorSessao.get(s.id)) ? votosPorSessao.get(s.id).length : null,
    url: `${C.web}/plenary-session/detail/${s.id}`,
  }));
}
