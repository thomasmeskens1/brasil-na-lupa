// Testes offline (sem rede) dos leitores de presença e despesas do Senado:
//   node --test scripts/coleta/senado/testes-presenca-despesas.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lerRobots, permitido, sessoesDeliberativas, contagemTipos, registrosEmVotacoes, licencasNoAno, formatar, NAO_DISPONIVEL,
} from './presenca.mjs';
import {
  classificarFornecedor, formatarCnpj, agregarCeaps, lerRecursosUtilizados, montarArquivoSenador, NOME_OMITIDO,
} from './despesas.mjs';

// ---------- amostras pequenas, no formato das fontes oficiais ----------
const AGENDA = [
  { Data: '2026-10-05', Hora: '14:00', TipoSessao: 'SESSÃO NÃO DELIBERATIVA ', CodigoSessao: '590397', Casa: 'SF', SituacaoSessao: 'Sessão não realizada' },
  { Data: '2026-10-06', Hora: '14:00', NumeroSessao: '128ª SESSÃO ', TipoSessao: 'SESSÃO DELIBERATIVA ORDINÁRIA ', CodigoSessao: '590398', Casa: 'SF', SituacaoSessao: 'Encerrada', DescricaoTipoPresenca: 'Semipresencial' },
  { Data: '2026-10-06', Hora: '19:00', TipoSessao: 'SESSÃO DELIBERATIVA EXTRAORDINÁRIA ', CodigoSessao: '590500', Casa: 'SF', SituacaoSessao: 'Encerrada' },
  { Data: '2026-10-07', Hora: '14:00', TipoSessao: 'SESSÃO DELIBERATIVA ORDINÁRIA ', CodigoSessao: '590600', Casa: 'SF', SituacaoSessao: 'Cancelada' },
  { Data: '2026-10-08', Hora: '10:00', TipoSessao: 'SESSÃO CONJUNTA ', CodigoSessao: '590700', Casa: 'CN', SituacaoSessao: 'Encerrada' },
  { Data: '2026-11-03', Hora: '14:00', TipoSessao: 'SESSÃO DELIBERATIVA ORDINÁRIA ', CodigoSessao: '590800', Casa: 'SF', SituacaoSessao: 'Em andamento' },
  { Data: '2026-10-06', Hora: '14:00', TipoSessao: 'SESSÃO DELIBERATIVA ORDINÁRIA ', CodigoSessao: '590398', Casa: 'SF', SituacaoSessao: 'Encerrada' }, // repetida
  { Data: '2025-12-10', Hora: '14:00', TipoSessao: 'SESSÃO DELIBERATIVA ORDINÁRIA ', CodigoSessao: '500000', Casa: 'SF', SituacaoSessao: 'Encerrada' },
];
const TIPOS = new Map([['P-NRV', 'Presente – Não registrou voto'], ['LS', 'Licença saúde'], ['NCom', 'Não Compareceu']]);
const VOTACOES = [
  { dataSessao: '2026-10-06', votos: [
    { codigoParlamentar: 5672, siglaVotoParlamentar: 'Sim' }, { codigoParlamentar: 22, siglaVotoParlamentar: 'LS' },
    { codigoParlamentar: 825, siglaVotoParlamentar: 'P-NRV' }] },
  { dataSessao: '2026-10-07', votos: [
    { codigoParlamentar: 5672, siglaVotoParlamentar: 'Não' }, { codigoParlamentar: 22, siglaVotoParlamentar: 'LS' },
    { codigoParlamentar: 825, siglaVotoParlamentar: 'XYZ', descricaoVotoParlamentar: 'Descrição da fonte' }] },
  { dataSessao: '2025-12-10', votos: [{ codigoParlamentar: 5672, siglaVotoParlamentar: 'Sim' }] },
];
const CEAPS = [
  { id: 1, ano: 2026, mes: 1, codSenador: 5672, nomeSenador: 'ALAN RICK', tipoDespesa: 'Divulgação da atividade parlamentar', cpfCnpj: '11.521.613/0001-90', fornecedor: 'EMPRESA A LTDA', documento: '6426', detalhamento: 'x', valorReembolsado: 749 },
  { id: 2, ano: 2026, mes: 1, codSenador: 5672, nomeSenador: 'ALAN RICK', tipoDespesa: 'Aluguel de imóveis para escritório político', cpfCnpj: '860.***.***-53', fornecedor: 'MARIA PARTICULAR', documento: '1-2026', detalhamento: null, valorReembolsado: 4000 },
  { id: 3, ano: 2026, mes: 2, codSenador: 5672, nomeSenador: 'ALAN RICK', tipoDespesa: 'Divulgação da atividade parlamentar', cpfCnpj: '11521613000190', fornecedor: 'EMPRESA A LTDA', documento: '6500', detalhamento: null, valorReembolsado: 251.1 },
  { id: 4, ano: 2026, mes: 2, codSenador: 5672, nomeSenador: 'ALAN RICK', tipoDespesa: 'Passagens aéreas, aquáticas e terrestres nacionais', cpfCnpj: '05.120.923/0001-09', fornecedor: 'AGÊNCIA B', documento: '00051', detalhamento: 'Passageiros: FULANO DE TAL (Matrícula 1)', valorReembolsado: -100.05 },
  { id: 5, ano: 2026, mes: 3, codSenador: 5672, nomeSenador: 'ALAN RICK', tipoDespesa: null, cpfCnpj: '1234567890123', fornecedor: 'JOÃO SEM CNPJ', documento: null, detalhamento: null, valorReembolsado: 10 },
  { id: 6, ano: 2026, mes: 3, codSenador: 22, nomeSenador: 'ESPERIDIÃO AMIN', tipoDespesa: 'Divulgação da atividade parlamentar', cpfCnpj: '33.481.714/0001-18', fornecedor: 'HOTUR LTDA', documento: null, detalhamento: null, valorReembolsado: 500 },
  { id: 7, ano: 2025, mes: 12, codSenador: 22, nomeSenador: 'ESPERIDIÃO AMIN', tipoDespesa: 'Divulgação da atividade parlamentar', cpfCnpj: '33.481.714/0001-18', fornecedor: 'HOTUR LTDA', documento: null, detalhamento: null, valorReembolsado: 999 },
];
const RECURSOS = { statusCode: 200, data: [{ parlamentar: { nome: 'Alan Rick', partido: 'REPUBLICANOS', estado: 'AC' }, ano: 2026,
  cotas: { despesas: [{ recurso: 'Divulgação da atividade parlamentar', valor: 1000.1 }, { recurso: 'Aluguel de imóveis para escritório político', valor: 4000 }], totalValor: 5000.1 },
  gastosNaoInclusos: { despesas: [{ recurso: 'Correios', valor: 40941.41 }], totalValor: 40941.41 } }] };

// ---------- presença ----------
test('robots.txt: grupo "*", regra mais longa vence', () => {
  const r = lerRobots('User-Agent: Googlebot\nDisallow: /\n\nUser-Agent: *\nDisallow: /web/cmo\nAllow: /web/cmo/aberto\nCrawl-delay: 10\n');
  assert.deepEqual(r, { disallow: ['/web/cmo'], allow: ['/web/cmo/aberto'] });
  assert.equal(permitido(r, 'https://h/web/cmo/x'), false);
  assert.equal(permitido(r, 'https://h/web/cmo/aberto/1'), true);
  assert.equal(permitido(r, 'https://h/dadosabertos/votacao'), true);
  assert.equal(permitido(null, 'https://h/x'), false, 'host sem robots carregado = bloqueado');
  assert.equal(permitido({ disallow: [], allow: [], sem_arquivo: 'HTTP 403' }, 'https://h/x'), true);
});

test('sessões deliberativas: só SF, deliberativa, encerrada, do ano, sem repetição', () => {
  const s = sessoesDeliberativas(AGENDA, 2026);
  assert.deepEqual(s.map((x) => x.codigo), ['590398', '590500']);
  assert.equal(s[0].tipo, 'SESSÃO DELIBERATIVA ORDINÁRIA');
  assert.equal(s[0].numero, '128ª SESSÃO');
  assert.equal(s[0].modalidade, 'Semipresencial');
  assert.equal(s[0].url, 'https://legis.senado.leg.br/dadosabertos/plenario/encontro/590398');
  assert.equal(s[1].modalidade, null);
  const c = contagemTipos(AGENDA, 2026);
  assert.equal(c['SF | SESSÃO NÃO DELIBERATIVA | Sessão não realizada'], 1);
  assert.equal(c['CN | SESSÃO CONJUNTA | Encerrada'], 1);
});

test('registros nas votações: contagem literal por sigla, com descrição oficial, só do ano', () => {
  const r = registrosEmVotacoes(VOTACOES, TIPOS, 2026);
  assert.equal(r.get('5672').votacoes, 2);
  assert.deepEqual(r.get('5672').por_registro, [{ codigo: 'Não', registro: 'Não', quantidade: 1 }, { codigo: 'Sim', registro: 'Sim', quantidade: 1 }]);
  assert.deepEqual(r.get('22').por_registro, [{ codigo: 'LS', registro: 'Licença saúde', quantidade: 2 }]);
  assert.deepEqual(r.get('825').por_registro.map((x) => x.registro), ['Descrição da fonte', 'Presente – Não registrou voto']);
});

test('licenças que alcançam o ano', () => {
  const j = { LicencaParlamentar: { Parlamentar: { Licencas: { Licenca: [
    { DataInicio: '2026-10-08', DataFim: '2026-10-08', DescricaoTipoAfastamento: 'Missão política ou cultural de interesse parlamentar' },
    { DataInicio: '2025-12-20', DataFim: '2026-01-05', DescricaoTipoAfastamento: 'Licença saúde' },
    { DataInicio: '2025-03-01', DataFim: '2025-03-02', DescricaoTipoAfastamento: 'Licença particular' },
  ] } } } };
  assert.deepEqual(licencasNoAno(j, 2026), [
    { inicio: '2025-12-20', fim: '2026-01-05', tipo: 'Licença saúde' },
    { inicio: '2026-10-08', fim: '2026-10-08', tipo: 'Missão política ou cultural de interesse parlamentar' },
  ]);
  // Uma única licença vem como objeto, não lista
  const um = { LicencaParlamentar: { Parlamentar: { Licencas: { Licenca: { DataInicio: '2026-02-01', DataFim: null } } } } };
  assert.deepEqual(licencasNoAno(um, 2026), [{ inicio: '2026-02-01', fim: null, tipo: NAO_DISPONIVEL }]);
  assert.deepEqual(licencasNoAno({ LicencaParlamentar: { Parlamentar: {} } }, 2026), []);
});

// ---------- despesas ----------
test('classificação do fornecedor', () => {
  assert.equal(classificarFornecedor('66.970.229/0132-26'), 'pessoa jurídica');
  assert.equal(classificarFornecedor('11521613000190'), 'pessoa jurídica');
  assert.equal(classificarFornecedor('195.***.***-49'), 'pessoa física');
  assert.equal(classificarFornecedor('19512345649'), 'pessoa física');
  assert.equal(classificarFornecedor('1234567890123'), 'não identificado');
  assert.equal(classificarFornecedor(null), 'não identificado');
  assert.equal(formatarCnpj('11521613000190'), '11.521.613/0001-90');
});

test('agregação da CEAPS: totais em centavos, só do ano, particulares omitidos', () => {
  const { senadores, totais } = agregarCeaps(CEAPS, 2026);
  assert.deepEqual(totais, { cpf_de_fornecedor_omitidos: 1, documento_de_fornecedor_nao_identificado: 1, documentos_sem_tipo: 1, fora_do_ano: 1 });
  const a = senadores.get('5672');
  assert.equal(a.docs, 5);
  assert.equal(a.c, 74900 + 400000 + 25110 - 10005 + 1000);
  const arq = montarArquivoSenador({ s: a, ano: 2026, hoje: '2026-11-03', of: lerRecursosUtilizados(RECURSOS),
    exercicio: { id: '5672', nome: 'Alan Rick', partido: 'REPUBLICANOS', uf: 'AC', url_oficial: 'https://www25.senado.leg.br/web/senadores/senador/-/perfil/5672' },
    fonteArq: { titulo: 't', url: 'u', orgao: 'Senado Federal', acessado_em: '2026-11-03' } });
  assert.equal(arq.total_liquido, 4910.05);
  assert.equal(arq.documentos_qtd, 5);
  assert.equal(arq.total_pagina_oficial, 5000.1);
  assert.equal(arq.pagina_oficial.diferenca_para_arquivo, 90.05);
  assert.equal(arq.em_exercicio, true);
  assert.deepEqual(arq.por_mes, [{ mes: 1, documentos: 2, total_liquido: 4749 }, { mes: 2, documentos: 2, total_liquido: 151.05 }, { mes: 3, documentos: 1, total_liquido: 10 }]);
  assert.deepEqual(arq.por_tipo[0], { tipo: 'Aluguel de imóveis para escritório político', documentos: 1, total_liquido: 4000 });
  assert.ok(arq.por_tipo.some((t) => t.tipo === null && t.total_liquido === 10));
  // CNPJ formatado e não formatado do mesmo fornecedor juntam-se
  assert.deepEqual(arq.por_fornecedor.find((f) => f.cnpj === '11.521.613/0001-90'), { fornecedor: 'EMPRESA A LTDA', cnpj: '11.521.613/0001-90', tipo_fornecedor: 'pessoa jurídica', documentos: 2, total_liquido: 1000.1 });
  const part = arq.por_fornecedor.find((f) => f.fornecedor === NOME_OMITIDO);
  assert.deepEqual(part, { fornecedor: NOME_OMITIDO, cnpj: null, tipo_fornecedor: 'pessoa física ou sem CNPJ na fonte', documentos: 2, total_liquido: 4010 });
  assert.equal(arq.url_documentos, 'https://www6g.senado.leg.br/transparencia/sen/5672/?ano=2026');
  assert.equal(arq.lacunas.length, 2); // diferença com a página oficial + documento sem tipo
  // Privacidade: nada de CPF, nome de particular, detalhamento ou número de documento no arquivo gravado
  const texto = formatar(arq);
  for (const proibido of ['860.', '***', 'MARIA PARTICULAR', 'JOÃO SEM CNPJ', '1234567890123', 'FULANO', 'Passageiros', '6426', '1-2026']) {
    assert.ok(!texto.includes(proibido), `não pode conter ${proibido}`);
  }
});

test('senador em exercício sem documentos: total da soma vazia e lacuna explícita', () => {
  const arq = montarArquivoSenador({ s: null, ano: 2026, hoje: '2026-11-03', of: null,
    exercicio: { id: '9999', nome: 'Fulano', partido: 'X', uf: 'DF', url_oficial: null }, fonteArq: null });
  assert.equal(arq.total_liquido, 0);
  assert.equal(arq.documentos_qtd, 0);
  assert.equal(arq.pagina_oficial, null);
  assert.match(arq.lacunas[0], /Nenhum documento/);
  assert.equal(arq.url_oficial, 'https://www25.senado.leg.br/web/senadores/senador/-/perfil/9999');
});

test('recursos utilizados: só a parte da CEAPS', () => {
  const r = lerRecursosUtilizados(RECURSOS);
  assert.equal(r.total, 5000.1);
  assert.equal(r.por_tipo.length, 2);
  assert.equal(r.uf, 'AC');
  assert.equal(lerRecursosUtilizados({ data: [] }), null);
});
