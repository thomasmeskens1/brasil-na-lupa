#!/usr/bin/env node
// Testes offline do coletor RN (sem rede). Amostras pequenas no formato real da API eLegis
// (valores pessoais trocados por fictícios). Uso: node scripts/coleta/estados/rn/testes.mjs
import assert from 'node:assert/strict';
import { interpretarRobots, permitido, verificarPrivacidade, textoPublico, dataBR } from './base.mjs';
import { montarParlamentar, montarProposicao, montarVotacao, situacaoDaTramitacao, siglaDe } from './elegis.mjs';
import { lerListaLeis, LISTAS } from './leis.mjs';

let ok = 0;
const teste = (nome, fn) => { fn(); ok++; console.log(`ok - ${nome}`); };
const hoje = '2026-11-03';

teste('robots.txt: grupo *, Disallow vazio libera tudo; Crawl-delay e Disallow lidos', () => {
  const r1 = interpretarRobots('User-agent: *\nDisallow:\n');
  assert.deepEqual(r1.disallow, []);
  assert.equal(permitido(r1, '/qualquer'), true);
  const r2 = interpretarRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nCrawl-delay: 60\nDisallow: /api/\nAllow: /api/publico/\n');
  assert.equal(r2.crawl_delay_s, 60);
  assert.equal(permitido(r2, '/api/x'), false);
  assert.equal(permitido(r2, '/api/publico/proposicao/'), true);
  assert.equal(permitido(r2, '/leis'), true);
  const r3 = interpretarRobots('User-agent: voto-em-quem-coletor\nDisallow: /\n');
  assert.equal(permitido(r3, '/'), false);
});

const parlBruto = {
  id: 8, nomeParlamentar: 'DEPUTADA CRISTIANE DANTAS', vigencia: { inicio: '2019-02-01T02:00:00.000Z', fim: null },
  pessoa: { id: 17, nome: 'CRISTIANE BEZERRA DE SOUZA DANTAS', cpf: '00000000000', dataNascimento: '1900-01-01T00:00:00.000Z' },
  filiacoes: [
    { vigencia: { inicio: '2020-01-01T01:00:00.000Z', fim: '2026-04-01T00:00:00.000Z' }, partido: { nome: 'SDD' } },
    { vigencia: { inicio: '2026-04-08T00:00:00.000Z', fim: null }, partido: { nome: 'PSDB' } },
  ],
};
teste('parlamentar: CPF e nascimento descartados; partido vigente', () => {
  const p = montarParlamentar(parlBruto, hoje);
  const s = JSON.stringify(p);
  assert.ok(!s.includes('00000000000') && !s.includes('1900-01-01') && !/cpf|nascimento/i.test(s));
  assert.equal(p.partido, 'PSDB');
  assert.equal(p.em_exercicio, true);
  assert.equal(p.id, '8');
  verificarPrivacidade(p);
});

teste('verificarPrivacidade barra chave cpf, CPF formatado e e-mail pessoal', () => {
  assert.throws(() => verificarPrivacidade({ a: { cpf: 'x' } }));
  assert.throws(() => verificarPrivacidade({ t: 'inscrito no 123.456.789-01' }));
  assert.throws(() => verificarPrivacidade({ t: 'fulano@gmail.com' }));
  assert.ok(verificarPrivacidade({ email: 'dep.x@al.es.gov.br', t: 'Lei do CPF na nota' }));
});

const proc = {
  id: 63344, numero: 2442, ano: 2026, ementa: 'Veto Parcial ao Projeto de Lei nº 12/2026, que altera dispositivos da Lei Complementar Estadual nº 251.',
  informacaoLei: null, dataEntrada: '2026-07-27T00:00:00.000Z', dataArquivamento: null,
  propositura: { tipo: { id: 21, sigla: 'VET', descricao: 'VETO' }, numero: 12, ano: 2026 },
  iniciativa: { tipo: 'ORGAO', descricao: 'GOVERNO DO ESTADO', parlamentar: null },
  publicacao: [{ observacao: 'Publicado no DLE do dia 05/09/2026.', linkDOE: 'https://dle.al.rn.leg.br/abrearquivo/X/', origem: { data: '2026-09-08T07:38:36.000Z' } }],
  comissao: [{ sigla: 'CCJR', descricao: 'Comissão de Constituição, Justiça e Redação', assessor: 'NOME DE SERVIDOR', relator: 'DEPUTADO KLEBER RODRIGUES' }],
  resultadoVotacao: { id: 60001, dataSituacaoAbertura: '2026-09-01T11:00:00.000Z', resultadoVotacao: 'R', reuniao: { id: 3019 } },
};
const reuniaoPlen = { id: 3019, dataInicio: '2026-09-01T10:30:00.000Z', reuniaoComissao: [], tipoReuniao: { nome: 'Sessão Plenária Ordinária' },
  resultadoVotacao: { id: 60001, resultadoVotacao: 'R', dataSituacaoAbertura: '2026-09-01T11:00:00.000Z' } };
const voto = (id, nome, partido, v) => ({ id: id * 100, voto: v, parlamentar: { id, nomeParlamentar: nome, partido: { nome: partido } } });
const detNominal = {
  tipoVotacao: 'A',
  reuniao: { id: 3019, numero: 78, remota: true, dataInicio: '2026-09-01T10:30:00.000Z', tipoReuniao: { nome: 'Sessão Plenária Ordinária' }, reuniaoComissao: [] },
  votacao: { dados: [voto(8, 'DEPUTADA CRISTIANE DANTAS', 'PSDB', 0), voto(10, 'DEPUTADA EUDIANE MACEDO', 'PV', 0), voto(12, 'DEPUTADO FRANCISCO DO PT', 'PT', 2)],
    total: 3, resumo: { sim: 0, nao: 2, abstencao: 1 } },
  obstrucao: { dados: [], total: 0 },
  presenca: { dados: [{ id: 8, nomeParlamentar: 'DEPUTADA CRISTIANE DANTAS', partido: { nome: 'PSDB' }, evento: { chave: 'presenca' } },
    { id: 60, nomeParlamentar: 'DEPUTADA TEREZINHA MAIA', partido: { nome: 'PL' }, evento: { chave: 'ausencia-justificada' } },
    { id: 7, nomeParlamentar: 'DEPUTADO CORONEL AZEVEDO', partido: { nome: 'PL' }, evento: null }], total: 3 },
};

teste('votação nominal: votos publicados quando conferem com o resumo', () => {
  const v = montarVotacao(proc, reuniaoPlen, detNominal, { hoje });
  assert.equal(v.id, 'rn-63344-3019');
  assert.equal(v.tipo, 'nominal');
  assert.equal(v.resultado, 'rejeitada');
  assert.equal(v.orgao, 'Plenário');
  assert.equal(v.data, '2026-09-01');
  assert.deepEqual(v.placar, { sim: 0, nao: 2, abstencao: 1, obstrucao: 0, outros: null });
  assert.equal(v.votos.length, 3);
  assert.deepEqual(v.votos.map((x) => x.voto).sort(), ['Abstenção', 'Não', 'Não']);
  assert.equal(v.presenca.find((p) => p.parlamentar_id === '7').registro, 'sem registro');
  assert.equal(v.fonte.acessado_em, hoje);
  assert.ok(v.fonte.url.startsWith('https://transparencialegislativa.al.rn.leg.br/projeto/'));
  verificarPrivacidade(v);
});

teste('votação nominal: contagem divergente → nenhum voto publicado, placar oficial e lacuna', () => {
  const det = structuredClone(detNominal);
  det.votacao.resumo = { sim: 1, nao: 1, abstencao: 1 };
  const v = montarVotacao(proc, reuniaoPlen, det, { hoje });
  assert.equal(v.votos.length, 0);
  assert.equal(v.placar.sim, 1);
  assert.ok(v.lacunas.some((l) => /não publicados/.test(l)));
  assert.ok(v.problemas_leitura.length > 0);
  const det2 = structuredClone(detNominal);
  det2.votacao.dados[0].voto = 7;
  assert.equal(montarVotacao(proc, reuniaoPlen, det2, { hoje }).votos.length, 0);
});

teste('votação aberta sem nenhum registro: resumo zerado não vira placar', () => {
  const det = { ...structuredClone(detNominal), votacao: { dados: [], total: 0, resumo: { sim: 0, nao: 0, abstencao: 0 } } };
  const v = montarVotacao(proc, reuniaoPlen, det, { hoje });
  assert.equal(v.placar, null);
  assert.equal(v.votos_situacao, 'inexistentes-na-fonte');
  assert.equal(montarVotacao(proc, reuniaoPlen, detNominal, { hoje }).votos_situacao, 'coletados');
  assert.equal(montarVotacao(proc, reuniaoPlen, detNominal, { hoje }).proposicao.id, 'rn-63344');
});

teste('votação secreta: placar oficial, votos vazios, "votou" vira comparecimento', () => {
  const det = { ...structuredClone(detNominal), tipoVotacao: 'S' };
  det.votacao = { dados: [{ voto: 'votou', parlamentar: { id: 8, nomeParlamentar: 'DEPUTADA CRISTIANE DANTAS', partido: { nome: 'PSDB' } } }], total: 1, resumo: { sim: 1, nao: 0, abstencao: 0 } };
  const v = montarVotacao(proc, reuniaoPlen, det, { hoje });
  assert.equal(v.tipo, 'secreta');
  assert.equal(v.votos.length, 0);
  assert.equal(v.placar.sim, 1);
  assert.equal(v.comparecimento[0].situacao, 'votou');
  assert.ok(v.lacunas.some((l) => l.includes('Informação não disponível em fonte oficial')));
});

teste('votação ostensiva: sem placar nem voto individual', () => {
  const det = { ...structuredClone(detNominal), tipoVotacao: 'O', votacao: { dados: [], total: 0, resumo: { sim: 0, nao: 0, abstencao: 0 } } };
  const v = montarVotacao(proc, reuniaoPlen, det, { hoje });
  assert.equal(v.tipo, 'ostensiva');
  assert.equal(v.placar, null);
  assert.equal(v.votos.length, 0);
  assert.ok(v.lacunas.some((l) => l.includes('Informação não disponível em fonte oficial')));
});

teste('votação em comissão: órgão e sigla da comissão', () => {
  const r = { ...reuniaoPlen, id: 3029, reuniaoComissao: [{ comissao: { sigla: 'CCJR', nome: 'Comissão de Constituição, Justiça e Redação' } }] };
  const v = montarVotacao(proc, r, detNominal, { hoje });
  assert.equal(v.orgao, 'comissão');
  assert.equal(v.orgao_sigla, 'CCJR');
});

teste('proposição: assessor descartado, relator mantido, situação da tramitação', () => {
  const sit = situacaoDaTramitacao([
    { linkDOE: null, origem: { setor: { nome: 'PRESIDÊNCIA ' }, data: '2026-09-15T11:28:16.000Z' }, situacaoProcesso: { nome: 'Determinado o arquivamento' } },
    { linkDOE: null, origem: { setor: { nome: 'MESA DIRETORA' }, data: '2026-09-02T07:43:52.000Z' }, situacaoProcesso: { nome: 'Veto Rejeitado' } },
  ], hoje);
  assert.equal(sit.texto, 'Determinado o arquivamento');
  const p = montarProposicao(proc, { hoje, situacao: sit, temVotacao: true });
  assert.equal(p.sigla, 'VET');
  assert.equal(p.comissoes[0].relator, 'DEPUTADO KLEBER RODRIGUES');
  assert.ok(!JSON.stringify(p).includes('NOME DE SERVIDOR'));
  assert.equal(siglaDe({ propositura: { tipo: { sigla: '', descricao: 'MENSAGEM' } } }), 'MSG');
});

teste('privacidade em ementa: nome de particular após "Sr." é mascarado', () => {
  const r = textoPublico('Concede Título de Cidadão Norte-rio-grandense ao Sr. João Batista Pereira.');
  assert.ok(!r.texto.includes('João Batista Pereira'));
});

teste('leis: lista HTML oficial', () => {
  const html = `<li class="list-group-item">
    <a href='https://www.al.rn.leg.br/storage/legislacao/2026/wej7nn0zbuv62xoqcu11bv7qzpqno9.pdf' target="_blank"> <i class="fa"></i> Lei Ordinária 12.931 de 19.10.2026</a><br />
    Institui a Política Estadual &ldquo;Cidade Segura&rdquo; e estabelece diretrizes.
  </li>
  <li class="list-group-item"><a href='https://exemplo.com/x.pdf'>Lei 1 de 01.01.2026</a> fora do domínio</li>`;
  const itens = lerListaLeis(html, LISTAS[0], { hoje });
  assert.equal(itens.length, 1);
  assert.equal(itens[0].id, 'lei-12931-2026');
  assert.equal(itens[0].data_assinatura, '2026-10-19');
  assert.equal(itens[0].ementa, 'Institui a Política Estadual “Cidade Segura” e estabelece diretrizes.');
});

teste('leis: data do título incoerente com a pasta oficial ou futura não é publicada', () => {
  const html = `<li class="list-group-item"><a href='https://www.al.rn.leg.br/storage/legislacao/2023/abc.pdf'>Lei Ordinária 11.500 de 10.05.3023</a><br/>Dispõe sobre X.</li>
  <li class="list-group-item"><a href='https://www.al.rn.leg.br/storage/legislacao/2026/def.pdf'>Lei Ordinária 12.626 de 31.12.2026</a><br/>Institui Y.</li>`;
  const itens = lerListaLeis(html, LISTAS[0], { hoje });
  assert.equal(itens[0].ano, 2023);
  assert.equal(itens[0].data_assinatura, null);
  assert.equal(itens[1].data_assinatura, null);
  assert.ok(itens[1].lacunas[0].includes('Lei Ordinária 12.626 de 31.12.2026'));
});

teste('dataBR', () => {
  assert.deepEqual(dataBR('29/10/2026 17:12:36'), { data: '2026-10-29', hora: '17:12' });
});

console.log(`\n${ok} teste(s) RN ok`);
