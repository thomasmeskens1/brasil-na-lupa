#!/usr/bin/env node
// Testes offline do coletor do Maranhão (ALEMALEGIS). Amostras reduzidas a partir de respostas reais da API
// de 04/11/2026 (estrutura preservada; anexos e nomes de particulares trocados por valores fictícios).
import assert from 'node:assert/strict';
import { conferirPrivacidade, Cliente } from '../abertos/base.mjs';
import {
  CASA_MA, interpretarDeputadosMA, interpretarAutores, interpretarMateriaMA, interpretarTramitacaoMA, marcaAndamento,
  interpretarNormaListaMA, aplicarDetalheNormaMA, resumirSessoesMA, urlMateria,
} from './alema.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const HOJE = '2026-11-04';

// ---------------------------------------------------------------- deputados
const COMPOSICAO = [
  { id: 50, parliamentaryName: 'Othelino Neto', fullName: 'Othelino Neto' },
  { id: 119, parliamentaryName: 'Carlos Lula', fullName: 'Carlos Lula' },
  { id: 999, parliamentaryName: 'Sem Cadastro', fullName: 'Sem Cadastro' },
  { id: 119, parliamentaryName: 'Carlos Lula', fullName: 'Carlos Lula' },
];
const CADASTRO = [
  { id: 50, fullName: 'Othelino Neto', parliamentaryName: 'Othelino Neto', partyAffiliationId: { partyName: 'Partido Socialista Brasileiro', partyAcronym: 'PSB', currentParty: true }, activeInHouse: 'ACTIVE', legislatureId: { id: 17 } },
  { id: 119, fullName: 'Carlos Lula', parliamentaryName: 'Carlos Lula', partyAffiliationId: { partyName: 'Partido Socialista Brasileiro', partyAcronym: 'PSB', currentParty: true }, activeInHouse: 'INACTIVE', legislatureId: { id: 20 } },
  { id: 144, fullName: 'Fora da Composição', parliamentaryName: 'Fora', partyAffiliationId: null, activeInHouse: 'ACTIVE', legislatureId: { id: 20 } },
];
{
  const p = interpretarDeputadosMA(COMPOSICAO, CADASTRO, HOJE);
  eq(p.itens.map((x) => x.id), ['119', '50', '999'], 'só a composição da legislatura, sem repetição, em ordem alfabética');
  const o = p.itens.find((x) => x.id === '50');
  eq([o.partido, o.em_exercicio, o.situacao_cadastro], ['PSB', true, 'Ativo na Casa'], 'cadastro de outra legislatura vale pelo id');
  eq(p.itens.find((x) => x.id === '119').em_exercicio, false, 'INACTIVE → false');
  const s = p.itens.find((x) => x.id === '999');
  eq([s.partido, s.em_exercicio], [null, null], 'sem cadastro: nada deduzido');
  ok(s.lacunas.some((l) => /não encontrado/.test(l)), 'lacuna anotada');
  ok(o.url_oficial.endsWith('/sapl/protocol/parliamentary/details/50'), 'link da página pública');
  eq(p.legislatura, 20);
  conferirPrivacidade(p); n++;
}

// ---------------------------------------------------------------- proposições
const porNome = new Map([['NETO EVANGELISTA', '36'], ['MICAL DAMASCENO', '101']]);
const MATERIA = {
  id: 101494, matterTypeDescription: 'Projeto de Resolução Legislativa', matterTypeSigla: 'PRE', number: '93', year: '2026',
  ement: 'Concede Medalha do Mérito Legislativo.\n\n', authorNames: 'Neto Evangelista', currentLocation: 'Diretoria Geral da Mesa',
  situation: 'Proposição aprovada', lastAction: 'Matéria lida em plenário no dia 03/11/2026', forwardingDate: '2026-11-03',
  presentationDate: '2026-11-03', publicationDate: null,
  files: [{ id: 1, filePath: 'uploads/legislative-matter/full-text/101494/x.docx', name: 'x.docx' }],
  legalNorms: [{ id: 3009, number: '12985', year: '2026', description: 'Lei', acronym: 'LEI' }],
};
{
  const p = interpretarMateriaMA(MATERIA, HOJE, porNome);
  eq([p.id, p.sigla, p.numero, p.ano, p.identificacao], ['ma-101494', 'PRE', 93, 2026, 'PRE 93/2026']);
  eq(p.ementa, 'Concede Medalha do Mérito Legislativo.', 'ementa limpa');
  eq(p.autores, [{ nome: 'Neto Evangelista', parlamentar_id: '36' }], 'autor ligado pelo nome idêntico');
  eq(p.data_apresentacao, '2026-11-03');
  eq(p.data_publicacao, null, 'publicação ausente fica null');
  eq(p.situacao.ultima_tramitacao, { data: '2026-11-03', descricao: 'Matéria lida em plenário no dia 03/11/2026' });
  eq(p.situacao.etapa, 'Proposição aprovada', 'situação como a fonte traz');
  ok(p.situacao.url_norma.endsWith('/legal-norm/detail/3009'), 'norma gerada com link');
  eq(p.situacao.norma, 'Lei nº 12985/2026');
  eq(p.url, urlMateria(101494));
  ok(!('files' in p) && !JSON.stringify(p).includes('uploads/'), 'anexos não gravados');
  ok(!p.lacunas.length, 'sem lacunas');
  conferirPrivacidade(p); n++;
  const semAutor = interpretarMateriaMA({ ...MATERIA, authorNames: '', legalNorms: [] }, HOJE, porNome);
  eq(semAutor.autores, []);
  ok(semAutor.lacunas.some((l) => /Autoria/.test(l)), 'autoria ausente anotada');
  eq(semAutor.situacao.url_norma, null);
  eq(interpretarMateriaMA({ id: 'x' }, HOJE), null, 'id inválido');
  const futura = interpretarMateriaMA({ ...MATERIA, presentationDate: '2027-01-01' }, HOJE, porNome);
  eq(futura.data_apresentacao, null, 'data futura descartada');
}
{
  const a = interpretarAutores('PODER EXECUTIVO; Mical Damasceno', porNome);
  eq(a.autores, [{ nome: 'PODER EXECUTIVO', parlamentar_id: null }, { nome: 'Mical Damasceno', parlamentar_id: '101' }]);
  eq(a.pendente, false);
  const h = interpretarMateriaMA({ ...MATERIA, ement: 'Concede o Título de Cidadão Maranhense ao Senhor Fulano Beltrano de Tal.' }, HOJE, porNome);
  ok(!/Fulano/.test(h.ementa) && h.privacidade_pendente === true, 'nome de particular homenageado não aparece');
  ok(h.lacunas.some((l) => /diretriz 12/.test(l)), 'lacuna de privacidade anotada');
}
// Tramitação
{
  const T = [
    { id: 111884, matterDate: '2026-10-29', localUnit: null, urgent: { description: 'Não' }, status: { description: 'Tramitação inicial gerada automaticamente pelo sistema' },
      destinationUnit: { organization: { name: 'Diretoria Geral da Mesa' } }, actionText: 'Tramitação inicial', legislativeMatterId: 101485, fullText: [{ filePath: 'uploads/a.docx' }] },
    { id: 111903, matterDate: '2026-11-03', localUnit: { organization: { name: 'Diretoria Geral da Mesa' } }, urgent: { description: 'Não' }, status: { description: 'Aguardando publicação' },
      destinationUnit: { organization: { name: 'Diário' } }, actionText: 'Matéria lida em plenário no dia 03/11/2026', legislativeMatterId: 101485 },
    { id: 1, matterDate: '2026-11-03', legislativeMatterId: 5 },
  ];
  const t = interpretarTramitacaoMA(T, 101485, HOJE);
  eq(t.map((x) => x.id_oficial), [111903, 111884], 'mais recente primeiro; de outra matéria fica fora');
  eq([t[0].origem, t[0].destino, t[0].status, t[0].urgente], ['Diretoria Geral da Mesa', 'Diário', 'Aguardando publicação', false]);
  eq(t[1].origem, null);
  ok(!JSON.stringify(t).includes('uploads/'), 'anexos da tramitação não gravados');
  const p = interpretarMateriaMA(MATERIA, HOJE, porNome);
  ok(marcaAndamento(p) !== marcaAndamento({ ...p, situacao: { ...p.situacao, ultima_tramitacao: { data: '2026-11-04', descricao: 'x' } } }), 'marca muda quando a matéria anda');
}

// ---------------------------------------------------------------- normas
{
  const L = { id: 3014, legalNormType: { description: 'Lei Complementar', additionalData: { Sigla: 'LC' } }, year: '2026', date: '2026-10-26T00:00:00', number: '300', ement: 'Altera a Lei Complementar nº 130/2009.' };
  const it = interpretarNormaListaMA(L, HOJE);
  eq([it.id, it.tipo, it.numero, it.ano, it.data_assinatura, it.nome_oficial], ['lc-300-2026-3014', 'Lei Complementar', 300, 2026, '2026-10-26', 'Lei Complementar nº 300/2026']);
  eq(it.detalhe_coletado, false);
  ok(it.url.endsWith('/legal-norm/detail/3014'));
  const lo = interpretarNormaListaMA({ ...L, id: 3020, legalNormType: { description: 'Lei Ordinária', additionalData: { Sigla: 'LO' } } }, HOJE);
  const le = interpretarNormaListaMA({ ...L, id: 3021, legalNormType: { description: 'Lei', additionalData: { Sigla: 'LEI' } } }, HOJE);
  ok(lo.id !== le.id, '"Lei" e "Lei Ordinária" com o mesmo número não colidem');
  const D = {
    id: 3014, federativeSphereType: 'ESTADUAL', publicationDate: '2026-10-26T00:00:00', publicationVehicle: null,
    legislativeMatter: { id: 100457, legislativeMatterType: { description: 'Projeto de Lei Complementar', additionalData: { Sigla: 'PLC' } }, number: '1', year: '2026', fullText: [{ filePath: 'uploads/x.pdf' }] },
    fullText: { filePath: 'uploads/legal_norm/full-text/3014/LC_300.doc' },
  };
  const det = aplicarDetalheNormaMA(it, D, HOJE);
  eq([det.detalhe_coletado, det.data_publicacao, det.esfera], [true, '2026-10-26', 'ESTADUAL']);
  eq(det.projeto_origem, { id: 'ma-100457', identificacao: 'PLC 1/2026', sigla: 'PLC', numero: 1, ano: 2026, tipo: 'Projeto de Lei Complementar', url: urlMateria(100457) });
  ok(!det.lacunas.length, 'lacuna do detalhe removida');
  ok(!JSON.stringify(det).includes('uploads/'));
  eq(aplicarDetalheNormaMA(it, { ...D, id: 1 }, HOJE), it, 'detalhe de outra norma é ignorado');
  const semPub = aplicarDetalheNormaMA(it, { ...D, publicationDate: null, legislativeMatter: null }, HOJE);
  eq([semPub.data_publicacao, semPub.projeto_origem], [null, null]);
  eq(semPub.lacunas.length, 2, 'publicação e origem ausentes anotadas');
  conferirPrivacidade(det); n++;
}

// ---------------------------------------------------------------- sessões
{
  const S = [{ id: 33, number: '86', plenarySessionType: { description: 'I - Ordinária' }, startDate: '2026-10-07T09:49:04', status: 'ENDED', plenaryPresentCount: 27,
    attachments: [{ name: 'Ata_Sessao_86_2026-10-07', isMinutes: true }, { name: 'outro', isMinutes: false }] }];
  const r = resumirSessoesMA(S, new Map([[33, []]]), HOJE);
  eq(r, [{ id_oficial: 33, numero: 86, tipo: 'I - Ordinária', data: '2026-10-07', situacao: 'ENDED', presentes_plenario: 27, atas: ['Ata_Sessao_86_2026-10-07'], votos_publicados: 0, url: `${CASA_MA.web}/plenary-session/detail/33` }]);
  eq(resumirSessoesMA(S, new Map(), HOJE)[0].votos_publicados, null, 'sem resposta: null, não zero');
}

// ---------------------------------------------------------------- cliente: robots.txt em HTML não bloqueia; intervalo de 2 s
{
  const pedidos = [];
  let agora = 0;
  const fetchImpl = async (url) => {
    pedidos.push(url);
    if (url.endsWith('/robots.txt')) return { status: 200, headers: { get: () => 'text/html' }, text: async () => '<!doctype html><html></html>' };
    return { status: 200, ok: true, text: async () => '[{"id":1}]' };
  };
  const cl = new Cliente({ prazoMs: 1e12, fetchImpl, agora: () => agora, dormirImpl: async (ms) => { agora += ms; } });
  const d1 = await cl.json(`${CASA_MA.api}/parliamentary/filter/legislature/20`);
  await cl.json(`${CASA_MA.api}/plenary-session`);
  eq(d1, [{ id: 1 }]);
  ok(pedidos[0].endsWith('/robots.txt'), 'robots.txt primeiro');
  ok(agora >= 4000, 'intervalo mínimo entre requisições');
  ok(/BrasilNaLupa-coletor/.test((await import('../abertos/base.mjs')).USER_AGENT), 'User-Agent honesto');
}

console.log(`testes MA: ${n} verificações ok`);
