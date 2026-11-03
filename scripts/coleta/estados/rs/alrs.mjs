// ALRS: busca de proposições (lista completa embutida na página de pesquisa) e página da proposição
// (JSON "drupal-settings-json" com dados, comissões e votações nominais com deputado + partido + voto).
import { obter, dataBR, omitirParticulares, autorPublico, normalizarNome } from './lib.mjs';

export const PORTAL = 'https://ww4.al.rs.gov.br';
export const ORGAO = 'Assembleia Legislativa do Estado do Rio Grande do Sul (ALRS)';
// VT/VP (veto total/parcial) levam o número e o ano do projeto vetado.
export const TIPOS_POR_ANO = ['PL', 'PLC', 'PEC', 'PDL', 'PR', 'VT', 'VP'];

export const urlBusca = (sigla, ano) =>
  `${PORTAL}/legislativo/pesquisa?siglaTipoProposicao=${encodeURIComponent(sigla)}${ano ? `&anoProposicao=${ano}` : ''}`;
export const urlProposicao = (sigla, numero, ano) => `${PORTAL}/proposicao/${sigla}/${numero}/${ano}`;

/** Lê o JSON de configuração embutido pelo Drupal. */
export function jsonEmbutido(html) {
  const m = /<script type="application\/json" data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('JSON embutido (drupal-settings-json) não encontrado: a página mudou de formato');
  return JSON.parse(m[1]);
}

/** Lista de proposições de um tipo (e ano). A ALRS devolve todos os resultados de uma vez (~10 a 60 s). */
export async function listar(sigla, ano) {
  const html = await obter(urlBusca(sigla, ano), { tipo: 'text', timeoutMs: 150000, maxTentativas: 2 });
  const j = jsonEmbutido(html);
  const lista = j.alergs_opine_proposicoes?.proposicoes;
  if (!Array.isArray(lista)) throw new Error(`busca ${sigla}/${ano ?? 'todos'}: campo alergs_opine_proposicoes.proposicoes ausente`);
  return lista;
}

/** Assinatura do estado da proposição na busca: se mudar, a página é lida de novo. */
export const assinaturaBusca = (p) => JSON.stringify([p.dthSituacaoProposicao, p.descricao, (p.situacoesPorPeriodo || []).length, p.siglaLocal]);

/** Item do índice a partir da busca (antes de ler a página). */
export function itemDaBusca(p) {
  const sigla = p.siglaTipoProposicao, numero = Number(p.nroProposicao), ano = Number(p.anoProposicao);
  const em = omitirParticulares(p.ementa || null);
  const aut = autorPublico(p.nomeProponente);
  const lacunas = [];
  if (em.omitido) lacunas.push('Nome de particular omitido na ementa (diretriz 12); texto integral na página oficial.');
  if (aut.omitido) lacunas.push('Proponente sem função pública identificada: nome omitido (diretriz 12).');
  return {
    id: `rs-${sigla}-${numero}-${ano}`,
    id_fonte: p.proposicaoId || null,
    uf: 'RS', casa: 'alrs',
    sigla, numero, ano,
    ementa: em.texto,
    proponente: aut.nome,
    data_protocolo: dataBR(p.dthProtocolo).data,
    data_apresentacao: dataBR(p.dthProtocolo).data,
    autores: aut.nome ? [{ nome: aut.nome }] : [],
    situacao: p.descricao || null,
    data_situacao: dataBR(p.dthSituacaoProposicao).data,
    local: p.siglaLocal || null,
    situacoes: (p.situacoesPorPeriodo || []).map((s) => ({ situacao: s.situacao, data: dataBR(s.data).data })),
    url: urlProposicao(sigla, numero, ano),
    assinatura_busca: assinaturaBusca(p),
    lacunas,
  };
}

const RESULTADOS = { aprovado: 'aprovada', aprovada: 'aprovada', 'aprovado(a)': 'aprovada', rejeitado: 'rejeitada', rejeitada: 'rejeitada', 'rejeitado(a)': 'rejeitada' };
const PLACAR = { sim: 'sim', 'não': 'nao', nao: 'nao', 'abstenção': 'abstencao', abstencao: 'abstencao', 'obstrução': 'obstrucao' };

/** Monta o registro de votação (contrato estadual: definição "votacao" + uf + casa). */
export function montarVotacao(v, prop, { hoje, mapaDeputados }) {
  const plen = v.tipoVotacao === 'PlenarySession';
  const reuniao = plen ? v.sessaoPlenaria : v.reuniaoComissao;
  const quando = dataBR(plen ? reuniao?.dataInicioSessaoPlenaria : reuniao?.dataReuniao);
  const lacunas = [];
  const votos = (v.votos || []).map((x) => ({
    parlamentar_id: mapaDeputados?.get(normalizarNome(x.nomeParlamentar)) ?? x.idParlamentar ?? null,
    parlamentar_id_votacao: x.idParlamentar || null,
    nome: x.nomeParlamentar,
    partido: (x.siglaPartidoParlamentar || '').trim() || null,
    uf: 'RS',
    voto: x.nomeOpcaoVoto,
    voto_codigo: x.idOpcaoVoto || null,
  })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const oficiais = (v.resultados || []).map((r) => ({ opcao: r.nomeOpcaoVoto, votos: r.numeroVotos }));
  // Conferência: contagem dos votos nominais por opção = totais oficiais da própria fonte.
  const contagem = {};
  for (const x of votos) contagem[x.voto] = (contagem[x.voto] || 0) + 1;
  const confere = oficiais.every((r) => (contagem[r.opcao] || 0) === r.votos)
    && Object.keys(contagem).every((k) => oficiais.some((r) => r.opcao === k));
  const tipoTexto = v.nomeTipoVotacao || null;
  let tipo = null;
  if (/secret/i.test(tipoTexto || '')) tipo = 'secreta';
  else if (/simb[oó]lic/i.test(tipoTexto || '')) tipo = 'simbolica';
  else if (votos.length) tipo = 'nominal';
  else lacunas.push('Forma de votação não informada pela fonte e sem votos individuais registrados.');
  if (tipo === 'secreta' && votos.length) lacunas.push('Fonte classifica a votação como secreta mas traz votos: votos não publicados.');
  let placar = null;
  const chave = (o) => PLACAR[String(o || '').trim().toLowerCase()];
  if (plen && oficiais.length && oficiais.every((r) => chave(r.opcao))) {
    placar = { sim: 0, nao: 0, abstencao: 0, obstrucao: 0, outros: 0 };
    for (const r of oficiais) placar[chave(r.opcao)] += r.votos;
  } else if (oficiais.length) {
    lacunas.push('Opções de voto da fonte (ex.: Favorável/Contrário) reproduzidas sem conversão em "placar_oficial"; placar null.');
  }
  if (votos.length && !confere) lacunas.push('A contagem dos votos individuais não confere com os totais oficiais da própria página; ambos reproduzidos como estão.');
  const resTexto = v.resultadoFinal?.descricaoResultadoVotacao || null;
  const principal = (v.proposicoes || []).find((p) => p.proposicaoId === prop.id_fonte) || (v.proposicoes || [])[0] || null;
  return {
    id: `rs-${v.idItem}`,
    id_fonte: v.idItem,
    uf: 'RS', casa: 'alrs',
    data: quando.data,
    hora: null,
    hora_inicio_reuniao: quando.hora,
    orgao: plen ? 'Plenário' : 'Comissão',
    orgao_sigla: plen ? 'PLEN' : (reuniao?.siglaComissao || null),
    orgao_nome: plen ? 'Plenário da Assembleia Legislativa do Estado do Rio Grande do Sul' : (reuniao?.nomeComissao || null),
    sessao: reuniao ? {
      id: plen ? reuniao.idSessaoPlenaria : reuniao.idReuniaoComissao,
      titulo: reuniao.titulo || null,
      numero: plen ? reuniao.numeroSessaoPlenaria : reuniao.numeroReuniao,
      tipo: plen ? reuniao.nomeTipoSessaoPlenaria : reuniao.nomeTipoReuniao,
      fase: plen ? (v.faseSessaoPlenaria?.nomeFaseSessaoPlenaria || null) : (v.faseReuniaoComissao?.nomeFaseVotacaoReuniao || null),
    } : null,
    proposicao: {
      id: prop.id, sigla: prop.sigla, numero: prop.numero, ano: prop.ano, ementa: prop.ementa, url: prop.url,
    },
    proposicoes: (v.proposicoes || []).length > 1 ? v.proposicoes.map((p) => ({
      sigla: p.siglaProposicao, numero: p.numeroProposicao, ano: p.anoProposicao,
      url: urlProposicao(p.siglaProposicao, p.numeroProposicao, p.anoProposicao),
    })) : null,
    descricao: [tipoTexto, principal?.faseProposicao].filter(Boolean).join(' — ') || null,
    tipo_votacao_texto_oficial: tipoTexto,
    ordem_na_reuniao: v.numeroOrdemVotacao ?? null,
    resultado: RESULTADOS[String(resTexto || '').toLowerCase()] ?? null,
    resultado_texto_oficial: resTexto,
    tipo,
    placar,
    placar_oficial: oficiais,
    placar_origem: oficiais.length ? 'totais-oficiais' : null,
    conferencia_placar: votos.length
      ? (confere ? `Os ${votos.length} votos individuais conferem, opção por opção, com os totais oficiais da página.` : 'Divergência entre votos individuais e totais oficiais (ver lacunas).')
      : 'Sem votos individuais na fonte.',
    orientacoes: [],
    votos: tipo === 'secreta' ? [] : votos,
    registrado_em: v.dataCriacaoRegistroVotacao ? (() => { const d = dataBR(v.dataCriacaoRegistroVotacao); return d.data ? `${d.data}T${d.hora || '00:00'}` : null; })() : null,
    url: prop.url,
    fonte: { titulo: `${prop.sigla} ${prop.numero}/${prop.ano} — votações (página da proposição)`, url: prop.url, orgao: ORGAO, acessado_em: hoje },
    lacunas,
    _observacao_hora: 'hora null: a fonte informa só o horário de início da sessão/reunião (hora_inicio_reuniao).',
  };
}

/** Lê a página da proposição: detalhes, comissões e votações. */
export async function lerProposicao(item, { hoje, mapaDeputados }) {
  const html = await obter(item.url, { tipo: 'text', timeoutMs: 45000, maxTentativas: 2 });
  const j = jsonEmbutido(html);
  const d = j['#proposicao']?.dados;
  if (!d) throw new Error(`${item.url}: bloco #proposicao ausente`);
  const em = omitirParticulares(d.ementa || item.ementa);
  const aut = autorPublico(d.proponente || item.proponente);
  const comissoes = (j['#comissoes']?.lista || []).map((c) => ({
    sigla: c.siglaComissao || null,
    data_inclusao: dataBR(c.dataInclusaoComissao).data,
    relator: c.nomeParlamentar || null,
    data_designacao: dataBR(c.dataDesignacao).data,
    parecer: c.parecer || null,
    resultado_parecer: c.resultadoParecer || null,
    data_votacao: dataBR(c.dataVotacao).data,
  }));
  const prop = {
    ...item,
    ementa: em.texto,
    proponente: aut.nome,
    autores: aut.nome ? [{ nome: aut.nome }] : [],
    situacao: d.descricaoSituacao || item.situacao,
    data_situacao: dataBR(d.dataSituacaoProposicao).data || item.data_situacao,
    numero_processo: d.numeroProcesso || null,
    data_protocolo: dataBR(d.dataProtocolo).data || item.data_protocolo,
    assunto: d.assunto || null,
    tramitacao_local: d.tramitacao || null,
    situacoes: (d.situacoesPorPeriodo || []).map((s) => ({ situacao: s.situacao, data: dataBR(s.data).data })),
    tem_texto: !!(d.linkTexto && d.linkTexto !== 'ND'),
    tem_justificativa: !!(d.linkJustificativa && d.linkJustificativa !== 'ND'),
    comissoes,
    pagina_coletada_em: hoje,
  };
  const lac = new Set(item.lacunas || []);
  if (em.omitido) lac.add('Nome de particular omitido na ementa (diretriz 12); texto integral na página oficial.');
  if (aut.omitido) lac.add('Proponente sem função pública identificada: nome omitido (diretriz 12).');
  if (prop.tem_texto || prop.tem_justificativa) lac.add('Texto e justificativa: a ALRS só os entrega por link temporário assinado; consultar pela página oficial da proposição.');
  prop.lacunas = [...lac];
  const votacoes = (j['#votacoes']?.lista || []).map((v) => montarVotacao(v, prop, { hoje, mapaDeputados }));
  prop.votacoes = votacoes.map((v) => v.id);
  return { prop, votacoes };
}
