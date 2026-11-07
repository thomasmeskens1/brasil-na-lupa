#!/usr/bin/env node
// Testes offline do coletor de patrimônio (sem rede). Uso: node --test scripts/coleta/patrimonio/testes.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { centavos, dataIso, cpfValido, escolherCandidatura, vincularSenadores, acumularBem, itemParlamentar } from './bens.mjs';

test('valores do TSE em centavos', () => {
  assert.equal(centavos('1695000,00'), 169500000);
  assert.equal(centavos('1.234,5'), 123450);
  assert.equal(centavos('12'), 1200);
  assert.equal(centavos(''), null);
  assert.equal(centavos('#NULO'), null);
});

test('datas e CPF', () => {
  assert.equal(dataIso('23/10/1976'), '1976-10-23');
  assert.equal(dataIso('#NULO'), null);
  assert.equal(cpfValido('12345678901'), true);
  assert.equal(cpfValido('-4'), false);
  assert.equal(cpfValido('00000000000'), false);
});

test('candidatura: ordinária antes de suplementar', () => {
  const c = escolherCandidatura([{ sq: '2', ordinaria: 0, turno: 1 }, { sq: '1', ordinaria: 1, turno: 1 }]);
  assert.equal(c.sq, '1');
  assert.equal(escolherCandidatura([]), null);
});

test('senadores: só titular, só correspondência única de UF + nascimento', () => {
  const eleitos = [
    { sq: 'a', uf: 'AC', nascimento: '1976-10-23' },
    { sq: 'b', uf: 'SP', nascimento: '1960-01-01' },
    { sq: 'c', uf: 'SP', nascimento: '1960-01-01' },
  ];
  const { vinculos, sem } = vincularSenadores([
    { id: '1', uf: 'AC', nascimento: '1976-10-23', titular: true },
    { id: '2', uf: 'SP', nascimento: '1960-01-01', titular: true },
    { id: '3', uf: 'AC', nascimento: '1976-10-23', titular: false },
    { id: '4', uf: 'RJ', nascimento: '1976-10-23', titular: true },
  ], eleitos);
  assert.deepEqual([...vinculos.keys()], ['1']);
  assert.deepEqual(sem.map((s) => s.id), ['2', '3', '4']);
  assert.match(sem[0].motivo, /mais de uma/);
});

test('item: total, ordem do TSE e nenhum campo pessoal ou de descrição', () => {
  const m = new Map();
  acumularBem(m, { sq: 'x', ordem: '2', tipo: 'APARTAMENTO', valor: '100,00', atualizado: '01/09/2022' });
  acumularBem(m, { sq: 'x', ordem: '1', tipo: 'Terra nua', valor: '50,50', atualizado: '02/09/2022' });
  const it = itemParlamentar({ ano: 2022, cargo: 'Deputado federal', uf: 'AC', sq: 'x', situacao: 'ELEITO POR QP' }, m.get('x'));
  assert.equal(it.total, 150.5);
  assert.deepEqual(it.bens, [['Terra nua', 50.5], ['Apartamento', 100]]);
  assert.equal(it.ultima_atualizacao_tse, '2022-09-02');
  assert.ok(!/cpf|nascimento|descri/i.test(JSON.stringify(it)));
});
