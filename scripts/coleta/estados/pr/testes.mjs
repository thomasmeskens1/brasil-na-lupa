#!/usr/bin/env node
// Testes offline do coletor do Paraná (ALEP). Amostras reduzidas de respostas reais de 04/11/2026
// (estrutura preservada). Rodar: node scripts/coleta/estados/pr/testes.mjs
import assert from 'node:assert/strict';
import { interpretarRobots, permitido, conferirPrivacidade } from '../abertos/base.mjs';
import {
  ClienteHttp, dataBR, textoSeguro, interpretarDeputadosPR, interpretarProposicaoPR, interpretarDetalhePR, aplicarDetalhePR,
  votacoesDoProjetoPR, interpretarNormaPR, aplicarDetalheNormaPR, ligarPR,
} from './alep.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const HOJE = '2026-11-04';

// ---------------------------------------------------------------- robots.txt reais
{
  const api = interpretarRobots('# robotstxt.org/\n\nUser-agent: *\nDisallow: /api/account\nDisallow: /api/users/\nDisallow: /management/\nDisallow: /v2/api-docs/\n');
  ok(permitido(api, '/api/public/proposicao/filtrar'), 'API pública liberada');
  ok(!permitido(api, '/api/users/1'), 'área de sistema proibida');
  const portal = interpretarRobots('User-agent: *\nDisallow: /publicador\nDisallow: /api/\nDisallow: /search\n\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nCrawl-delay: 10\nDisallow: /api/\n');
  ok(permitido(portal, '/deputados/conheca'), 'página de deputados liberada');
  ok(!permitido(portal, '/api/votacoes/sessoes'), 'Controle de Votações (/api/) proibido');
}

// Cliente: robots.txt do host só-http é pedido por http://, antes de tudo; caminho proibido nunca é pedido.
{
  const pedidos = [];
  let relogio = 0;
  const fetchImpl = async (url) => {
    pedidos.push(url);
    if (url.endsWith('/robots.txt')) return { status: 200, ok: true, headers: { get: () => 'text/plain' }, text: async () => 'User-agent: *\nDisallow: /api/users/\n' };
    return { status: 200, ok: true, headers: { get: () => 'application/json' }, text: async () => '{"sucesso":true}' };
  };
  const c = new ClienteHttp({ prazoMs: 1e12, fetchImpl, agora: () => relogio, dormirImpl: async (ms) => { relogio += ms; }, hostsSoHttp: ['webservices.assembleia.pr.leg.br'] });
  eq(await c.json('http://webservices.assembleia.pr.leg.br/api/public/proposicao/1'), { sucesso: true });
  eq(pedidos[0], 'http://webservices.assembleia.pr.leg.br/robots.txt', 'robots por http, primeiro');
  await assert.rejects(() => c.json('http://webservices.assembleia.pr.leg.br/api/users/1'), /robots/); n++;
  eq(pedidos.length, 2, 'caminho proibido não gerou requisição');
  eq(c.resumoRobots()['webservices.assembleia.pr.leg.br'].url, 'http://webservices.assembleia.pr.leg.br/robots.txt');
}

// ---------------------------------------------------------------- datas
eq(dataBR('2026-09-09T03:00:00.000+0000', HOJE), '2026-09-09', 'meia-noite de Brasília');
eq(dataBR('2026-01-01T02:00:00.000+0000', HOJE), '2025-12-31', 'UTC → Brasília');
eq(dataBR('2027-01-01T12:00:00.000+0000', HOJE), null, 'data futura');
eq(dataBR(null, HOJE), null);

// ---------------------------------------------------------------- textos com número em formato de documento
{
  const t = textoSeguro('JUNTADA DO PROTOCOLO 23.456.789-0 E DO CPF 123.456.789-01; LEI Nº 14.277');
  eq(t.texto, 'JUNTADA DO PROTOCOLO [número omitido] E DO [documento omitido]; LEI Nº 14.277', 'com contexto "CPF" a base já mascara; sem contexto, número omitido');
  ok(t.omitiu);
  conferirPrivacidade({ t: t.texto }); n++;
  const det = interpretarDetalhePR({ codigo: 1, tramites: [{ local: 'DAP - ORDEM DO DIA', acoes: [{ codigo: 9, data: '2026-05-05T18:00:00.000+0000', descricao: 'INFORMAÇÃO', observacao: 'E-PROTOCOLO 12.345.678-9' }] }] }, HOJE);
  eq(det.ultima.descricao, 'INFORMAÇÃO: E-PROTOCOLO [número omitido]');
  ok(det.omitiu, 'omissão anotada');
}

// ---------------------------------------------------------------- deputados
const card = (slug, nome, partido, cargo) => `<div class="deputado-card " style="animation-delay: 0s">
  <a href="https://www.assembleia.pr.leg.br/deputados/perfil/${slug}" class="relative">
  <img src="https://storage2.assembleia.pr.leg.br/img/x=/full-fit-in/300x300/deputados/${slug}.jpg" class="w-full" alt="Foto">
  <div class="flex justify-center"><p class="w-max text-white text-center font-semibold uppercase text-sm px-2 pb-1 pt-2 rounded-t-lg bg-green-500">${cargo}</p></div>
  <h3 class="font-bold text-blue-700 text-lg ">\n ${nome}\n </h3>
  ${partido ? `<p class="text-gray-500 text-sm italic">\n ${partido}\n </p>` : ''}
  </a></div>`;
const HTML = `<html>${card('alexandre-curi', 'ALEXANDRE CURI', 'REP', 'Presidente')}${card('ana-julia', 'ANA JÚLIA', 'PT', 'Deputada')}${card('sem-partido', 'FULANO TESTE', null, 'Deputado')}<footer><p>CNPJ: 77.799.542/0001-09</p></footer></html>`;
const parl = interpretarDeputadosPR(HTML, HOJE);
{
  eq(parl.itens.map((p) => p.id), ['alexandre-curi', 'ana-julia', 'sem-partido'], 'ordem alfabética');
  eq([parl.itens[0].partido, parl.itens[0].cargo_na_casa, parl.itens[1].cargo_na_casa], ['REP', 'Presidente', null]);
  eq(parl.itens[2].partido, null, 'partido ausente fica null');
  ok(parl.itens[2].lacunas[0].includes('Informação não disponível em fonte oficial'));
  eq(parl.itens[1].url_oficial, 'https://www.assembleia.pr.leg.br/deputados/perfil/ana-julia');
  ok(parl.itens[0].foto.startsWith('https://storage2.assembleia.pr.leg.br/'), 'foto só do domínio oficial');
}
const porNome = new Map(parl.itens.map((p) => [p.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(), p.id]));

// ---------------------------------------------------------------- proposições
const LISTA = [
  { codigo: 121086, numero: 747, ano: 2024, autor: 'DEPUTADO ALEXANDRE CURI, DEPUTADA ANA JULIA, PODER EXECUTIVO', dataRecebimento: '2024-12-09T12:56:58.000+0000', siglaTipoProposicao: null, tipoProposicao: 'PROJETO DE LEI', assunto: 'ANIMAIS', ementa: 'DISPÕE SOBRE A DISTRIBUIÇÃO DE QUAISQUER ANIMAIS VIVOS, A TÍTULO DE BRINDE, PROMOÇÃO OU SORTEIO, EM EVENTOS PÚBLICOS.', status: 'TRAMITANDO', localAtual: 'COMISSÃO DE CONSTITUIÇÃO E JUSTIÇA', normasLegais: [], tramites: [] },
  { codigo: 130001, numero: 10, ano: 2026, autor: 'DEPUTADO X', tipoProposicao: 'REQUERIMENTO', ementa: 'REQUER...', status: 'TRAMITANDO' },
];
const DETALHE = {
  codigo: 121086, numero: 747, ano: 2024, status: 'ARQUIVADA', localAtual: 'DIRETORIA LEGISLATIVA', regimeUrgencia: 'NÃO', tipoArquivamento: 'ARQUIVADO',
  normasLegais: [{ codigo: 66492, numero: 23448, ano: 2026, codigoTipoNormaLegal: 1, descricaoTipoNormaLegal: 'Lei' }],
  tramites: [
    { local: 'COMISSÃO DE CONSTITUIÇÃO E JUSTIÇA', acoes: [{ codigo: 469620, data: '2025-08-19T16:50:39.000+0000', descricao: 'PARECER FAVORÁVEL COM EMENDA(S)', observacao: 'APROVADO O PARECER FAVORÁVEL COM EMENDA', relator: 'DEPUTADA MABEL CANTO' }] },
    { local: 'DAP - ORDEM DO DIA', acoes: [
      { codigo: 480001, data: '2026-04-13T18:00:00.000+0000', descricao: '1º TURNO - APROVADO', observacao: null },
      { codigo: 480002, data: '2026-04-14T18:00:00.000+0000', descricao: '2º TURNO', observacao: 'RECEBEU UMA EMENDA DE PLENÁRIO, RETORNA À COMISSÃO DE CONSTITUIÇÃO E JUSTIÇA.' },
    ] },
    { local: 'DAP - ORDEM DO DIA', acoes: [
      { codigo: 490001, data: '2026-08-04T18:00:00.000+0000', descricao: '2º TURNO - APROVADO COM EMENDA', observacao: null },
      { codigo: 490002, data: '2026-08-10T18:00:00.000+0000', descricao: 'DISPENSADA A REDAÇÃO FINAL', observacao: 'VOTAÇÃO DE REDAÇÃO FINAL DISPENSADA.' },
    ] },
    { local: 'DIRETORIA LEGISLATIVA', acoes: [{ codigo: 500001, data: '2026-09-16T15:00:00.000+0000', descricao: 'ARQUIVADO', observacao: null }] },
  ],
};
{
  const itens = LISTA.map((r) => interpretarProposicaoPR(r, HOJE, porNome)).filter(Boolean);
  eq(itens.length, 1, 'requerimento fica de fora');
  const p = itens[0];
  eq([p.id, p.sigla, p.numero, p.ano, p.identificacao, p.data_apresentacao], ['pr-121086', 'PRO', 747, 2024, 'PRO 747/2024', '2024-12-09']);
  eq(p.autores.map((a) => a.parlamentar_id), ['alexandre-curi', 'ana-julia', null], 'deputado ligado por nome idêntico (sem acento)');
  eq(p.situacao.etapa, 'TRAMITANDO');
  eq(p.detalhe_coletado_em, null);
  eq(p.url, 'http://webservices.assembleia.pr.leg.br/api/public/proposicao/121086');

  const det = interpretarDetalhePR(DETALHE, HOJE);
  eq(det.deliberacoes.map((d) => d.descricao), ['1º TURNO - APROVADO', '2º TURNO - APROVADO COM EMENDA'], 'só resultados na Ordem do Dia; "2º TURNO" sem resultado e "DISPENSADA" ficam de fora');
  eq(det.ultima, { data: '2026-09-16', descricao: 'ARQUIVADO', local: 'DIRETORIA LEGISLATIVA' });
  eq(det.normas, [{ codigo: 66492, tipo: 'Lei', numero: 23448, ano: 2026, id: 'lei-23448-2026' }]);
  const comDet = aplicarDetalhePR(p, det, HOJE);
  eq([comDet.situacao.etapa, comDet.situacao.regime_urgencia, comDet.detalhe_coletado_em], ['ARQUIVADA', 'NÃO', HOJE]);

  const vot = votacoesDoProjetoPR(comDet, HOJE);
  eq(vot.map((v) => v.id), ['pr-480001', 'pr-490001']);
  eq([vot[0].data, vot[0].orgao, vot[0].tipo, vot[0].votos.length, vot[0].placar], ['2026-04-13', 'Plenário', null, 0, null]);
  eq(vot[0].resultado_texto_oficial, '1º TURNO - APROVADO');
  ok(vot[0].lacunas.some((l) => l.includes('Informação não disponível em fonte oficial') && l.includes('pedidos-lai/pr.md')), 'voto indisponível, com menção à LAI');

  // ---------------------------------------------------------------- normas
  const LISTA_N = [
    { codigo: 66492, data: '2026-09-09T03:00:00.000+0000', ementa: 'DISPÕE SOBRE A DISTRIBUIÇÃO DE QUAISQUER ANIMAIS VIVOS.', autores: 'DEPUTADO ALEXANDRE CURI', numero: 23448, ano: 2026, codigoTipoNormaLegal: 1, descricaoTipoNormaLegal: 'Lei', numeroDiarioOficialMovimentacao: 12224, tipoMovimentacao: 'PROMULGADO(A)', conclusaoMovimentacao: 'Promulgada', dataPublicacaoDiarioOficialMovimentacao: '2026-09-09T03:00:00.000+0000', veiculoPublicacao: null },
    { codigo: 65892, data: '2026-04-09T03:00:00.000+0000', ementa: 'EXONERAÇÕES', numero: 271, ano: 2026, codigoTipoNormaLegal: 7, descricaoTipoNormaLegal: 'Ato' },
  ];
  const normas = LISTA_N.map((r) => interpretarNormaPR(r, HOJE)).filter(Boolean);
  eq(normas.length, 1, 'ato administrativo fica de fora');
  const lei = normas[0];
  eq([lei.id, lei.nome_oficial, lei.data_assinatura, lei.data_publicacao, lei.publicacao, lei.conclusao], ['lei-23448-2026', 'Lei nº 23.448/2026', '2026-09-09', '2026-09-09', 'Diário Oficial nº 12224', 'Promulgada']);
  ok(lei.lacunas.some((l) => /nome do diário/.test(l)), 'veículo não deduzido');
  const det2 = aplicarDetalheNormaPR(lei, { codigo: 66492, movimentacoes: [{ tipo: 'PROMULGADO(A)', conclusao: 'Promulgada', data: '2026-09-09T03:00:00.000+0000', dataPublicacaoDiarioOficial: '2026-09-09T03:00:00.000+0000', numeroDiarioOficial: '12224' }], proposicoes: [{ codigo: 121086, numero: 747, ano: 2024, tipoProposicao: 'PROJETO DE LEI', siglaTipoProposicao: null }] }, HOJE);
  eq(det2.projeto_origem, { id: 'pr-121086', identificacao: 'PRO 747/2024', tipo: 'PROJETO DE LEI', sigla: 'PRO', numero: 747, ano: 2024, url: 'http://webservices.assembleia.pr.leg.br/api/public/proposicao/121086' });
  ok(!det2.lacunas.some((l) => /^Proposição de origem/.test(l)), 'lacuna resolvida');
  eq(aplicarDetalheNormaPR(lei, { codigo: 1 }, HOJE), lei, 'detalhe de outra norma é ignorado');

  ligarPR([lei], [comDet]);
  eq(comDet.situacao.url_norma, lei.url, 'projeto ligado à lei pelo código oficial');
  eq(lei.projeto_origem.id, 'pr-121086');
  conferirPrivacidade([parl, comDet, vot, lei, det2]); n++;
}

console.log(`OK: ${n} conferências.`);
