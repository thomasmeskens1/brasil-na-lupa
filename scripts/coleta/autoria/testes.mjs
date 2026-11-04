#!/usr/bin/env node
// Testes offline do coletor de autoria (nenhuma requisição de rede real).
// Uso: node --test scripts/coleta/autoria/testes.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lerRobots, permitido, percorrerCsv, gravarAtomico, obter, carregarRobots, MAX_PARALELO, USER_AGENT } from './lib.mjs';
import { aprovadasDoCsv, autoresDoCsv, montar as montarCamara } from './camara.mjs';
import { transformadasDaLista, resumirProcesso, montar as montarSenado } from './senado.mjs';

test('robots.txt: grupo * e regra mais longa', () => {
  const r = lerRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /privado\nAllow: /privado/aberto\n');
  assert.deepEqual(r.disallow, ['/privado']);
  assert.equal(permitido(r, 'https://x.gov.br/privado/a'), false);
  assert.equal(permitido(r, 'https://x.gov.br/privado/aberto/1'), true);
  assert.equal(permitido(r, 'https://x.gov.br/api/v2'), true);
});

test('User-Agent identifica o projeto', () => {
  assert.match(USER_AGENT, /Brasil na Lupa/);
  assert.equal(MAX_PARALELO, 2);
});

test('CSV com aspas, ; e quebra de linha dentro do campo', () => {
  const linhas = [];
  percorrerCsv('"a";"b"\n"1";"x;y"\n"2";"linha\num"\n', (l) => linhas.push(l));
  assert.deepEqual(linhas, [{ a: '1', b: 'x;y' }, { a: '2', b: 'linha\num' }]);
});

const CAB = '"id";"siglaTipo";"numero";"ano";"descricaoTipo";"ementa";"dataApresentacao";"urnFinal";"ultimoStatus_dataHora";"ultimoStatus_descricaoSituacao";"ultimoStatus_idSituacao"\n';
const PROPS = CAB +
  '"10";"PL";"1";"2023";"Projeto de Lei";"Ementa  um";"2023-03-01T10:00:00";"urn:lex:br:federal:lei:2024-01-01;1";"2024-01-02T00:00:00";"Transformado em Norma Jurídica";"1140"\n' +
  '"11";"PL";"2";"2023";"Projeto de Lei";"Ementa dois";"2023-03-01T10:00:00";"";"2024-01-02T00:00:00";"Aguardando Apreciação pelo Senado Federal";"926"\n' +
  '"12";"PL";"3";"2023";"Projeto de Lei";"Antes da legislatura";"2023-01-20T10:00:00";"";"2024-01-02T00:00:00";"Transformado em Norma Jurídica";"1140"\n';
const AUT = '"idProposicao";"idDeputadoAutor";"uriAutor";"tipoAutor";"nomeAutor";"ordemAssinatura";"proponente"\n' +
  '"10";"204379";"https://dadosabertos.camara.leg.br/api/v2/deputados/204379";"Deputado(a)";"A";"1";"1"\n' +
  '"10";"";"https://dadosabertos.camara.leg.br/api/v2/deputados/555";"Deputado(a)";"B";"2";"1"\n' +
  '"10";"";"https://dadosabertos.camara.leg.br/api/v2/orgaos/78";"Órgão do Poder Legislativo";"Senado Federal - X";"1";"1"\n' +
  '"11";"204379";"";"Deputado(a)";"A";"1";"1"\n';

test('Câmara: só "Transformado em Norma Jurídica" apresentadas desde 01/02/2023', () => {
  const ap = aprovadasDoCsv(PROPS);
  assert.deepEqual([...ap.keys()], ['10']);
  const p = ap.get('10');
  assert.equal(p.identificacao, 'PL 1/2023');
  assert.equal(p.ementa, 'Ementa um');
  assert.equal(p.urn_norma, 'urn:lex:br:federal:lei:2024-01-01;1');
  assert.match(p.url, /idProposicao=10$/);
});

test('Câmara: autores deputados (id do campo ou da URI); órgãos ignorados', () => {
  const ap = aprovadasDoCsv(PROPS);
  const au = autoresDoCsv(AUT, ap);
  assert.deepEqual([...au.keys()].sort(), ['204379', '555']);
  assert.equal(au.get('555').get('10'), 2);
  const final = montarCamara({ aprovadas: ap, autores: au, fontes: [], hoje: '2026-11-03' });
  assert.deepEqual(final.autores['204379'], [['10', 1]]);
  assert.equal(final.totais.proposicoes_transformadas_em_norma, 1);
  assert.equal(final.periodo.inicio, '2023-02-01');
});

test('Senado: lista filtrada pela situação atual e pelo período', () => {
  const ids = transformadasDaLista([
    { id: 1, situacaoAtual: 'TRANSFORMADA EM NORMA JURÍDICA', dataApresentacao: '2023-05-01' },
    { id: 2, situacaoAtual: 'TRANSFORMADA EM NORMA JURÍDICA COM VETO PARCIAL', dataApresentacao: '2024-05-01' },
    { id: 3, situacaoAtual: 'APROVADA', dataApresentacao: '2024-05-01' },
    { id: 4, situacaoAtual: 'TRANSFORMADA EM NORMA JURÍDICA', dataApresentacao: '2022-05-01' },
  ]);
  assert.deepEqual(ids, ['1', '2']);
  assert.deepEqual(transformadasDaLista(null), []);
});

test('Senado: processo resumido com norma gerada e só autores senadores', () => {
  const p = resumirProcesso({
    id: 9, codigoMateria: 77, identificacao: 'PL 5/2024', sigla: 'PL', numero: '5', ano: 2024, descricaoSigla: 'Projeto de Lei',
    conteudo: { ementa: 'Dispõe  sobre X.' }, documento: { dataApresentacao: '2024-02-02', autoria: [
      { codigoParlamentar: 5672, siglaTipo: 'SENADOR', ordem: 2 }, { codigoParlamentar: 1, siglaTipo: 'DEPUTADO', ordem: 1 },
    ] },
    situacaoAtual: 'TRANSFORMADA EM NORMA JURÍDICA', dataSituacaoAtual: '2025-01-01',
    normaGerada: { descricao: 'Lei nº 15.000 de 01/01/2025', tipo: 'Lei Numerada', dataAssinatura: '2025-01-01', veiculoPublicacao: '[DOU  de 02/01/2025]' },
  });
  assert.deepEqual(p.autores, { 5672: 2 });
  assert.equal(p.ementa, 'Dispõe sobre X.');
  assert.equal(p.norma.publicacao, '[DOU de 02/01/2025]');
  assert.match(p.url, /materia\/77$/);
  const sem = { ...p, norma: null, autores: { 5672: 1 } };
  const final = montarSenado({
    consultados: new Set(['5672', '1']), porSenador: new Map([['5672', ['9', '10']], ['1', []]]),
    processos: new Map([['9', p], ['10', sem]]), fontes: [], hoje: '2026-11-03',
  });
  assert.deepEqual(final.autores, { 5672: [['9', 2]] }); // o processo sem norma gerada fica de fora
  assert.deepEqual(final.consultados, ['1', '5672']);
  assert.equal(final.proposicoes['9'].autores, undefined);
});

test('gravação atômica não reescreve conteúdo igual', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoria-'));
  const arq = path.join(dir, 'a', 'x.json');
  assert.equal(gravarAtomico(arq, { a: 1 }), true);
  assert.equal(gravarAtomico(arq, { a: 1 }), false);
  assert.equal(gravarAtomico(arq, { a: 2 }), true);
  assert.deepEqual(fs.readdirSync(path.dirname(arq)), ['x.json']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('robots.txt é lido antes, bloqueia e o paralelismo nunca passa de 2', async () => {
  const chamadas = [];
  let simultaneas = 0, pico = 0;
  const falso = async (url, opts) => {
    chamadas.push(url);
    assert.match(opts.headers['User-Agent'], /Brasil na Lupa/);
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /proibido\n', { status: 200 });
    simultaneas++; pico = Math.max(pico, simultaneas);
    await new Promise((r) => setTimeout(r, 15));
    simultaneas--;
    return new Response('{"ok":true}', { status: 200, headers: { etag: '"e1"' } });
  };
  await carregarRobots('teste.invalid', falso);
  const rs = await Promise.all([1, 2, 3, 4, 5].map((i) => obter(`https://teste.invalid/api/${i}`, { buscar: falso })));
  assert.equal(chamadas[0], 'https://teste.invalid/robots.txt');
  assert.ok(rs.every((r) => r.dados.ok && r.etag === '"e1"'));
  assert.ok(pico <= 2, `pico de ${pico} requisições simultâneas`);
  await assert.rejects(obter('https://teste.invalid/proibido/1', { buscar: falso }), /robots/);
});
