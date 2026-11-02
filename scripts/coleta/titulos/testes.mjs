#!/usr/bin/env node
// Testes do verificador e dos recortes (sem rede): contraexemplos do estudo de engajamento têm de ser
// reprovados; recortes têm de ser prefixos literais em fronteira de oração; o modelo de votação tem
// de dar a mesma frase quando se trocam partido, autor e nomes.
import assert from 'node:assert/strict';
import { verificarTitulo } from './regras.mjs';
import { cortarEmOracao, trechoDaEmenta, universoNumerico, limpar } from './texto.mjs';
import { modeloVotacao } from './modelos-votacoes.mjs';
import { perturbar } from './itens.mjs';

let ok = 0;
const teste = (nome, fn) => { fn(); ok++; console.log(`ok - ${nome}`); };
const ctx = (dados, extra = {}) => ({ universo: universoNumerico(dados), nominal: false, nomes: ['Fulano de Tal'], ...extra });

teste('contraexemplos do padrão editorial são reprovados', () => {
  for (const t of ['Câmara dá goleada e aprova MEI', 'Votação histórica: Senado aprova reforma', 'Câmara aprova pacote polêmico']) {
    assert.equal(verificarTitulo(t, 'modelo', ctx({})).aprovado, false, t);
  }
});
teste('número que não está no dado oficial reprova', () => {
  const r = verificarTitulo('Câmara aprova projeto que reduz imposto em 15%', 'modelo', ctx({ ementa: 'Reduz imposto.' }));
  assert.equal(r.verificacao.numeros_e_datas_conferidos, false);
});
teste('contagem de votos só em votação nominal', () => {
  const dados = { placar: { sim: 300, nao: 100 } };
  assert.equal(verificarTitulo('Câmara aprova projeto (300 Sim, 100 Não)', 'modelo', ctx(dados)).aprovado, false);
  assert.equal(verificarTitulo('Câmara aprova projeto (300 Sim, 100 Não)', 'modelo', ctx(dados, { nominal: true })).aprovado, true);
});
teste('nome de pessoa e tratamento reprovam', () => {
  assert.equal(verificarTitulo('Câmara aprova projeto de Fulano de Tal', 'modelo', ctx({})).aprovado, false);
  assert.equal(verificarTitulo('Lei de Atibaia declara a utilidade pública (de autoria do vereador José)', 'modelo', ctx({})).aprovado, false);
});
teste('sem verbo da lista fechada reprova', () => {
  assert.equal(verificarTitulo('Projeto sobre escolas', 'modelo', ctx({})).aprovado, false);
});
teste('corte é prefixo literal e não descarta ressalva', () => {
  const tese = 'É devida a correção monetária, salvo se o pagamento ocorrer no prazo; e os juros incidem desde a citação';
  const c = cortarEmOracao(tese, 70, { estrito: true });
  assert.ok(c === null || tese.startsWith(c));
  assert.ok(c === null || !/correção monetária$/.test(c), 'não pode cortar antes de "salvo"');
});
teste('trecho da ementa começa no verbo, em minúscula, e é literal', () => {
  const e = 'Institui a campanha Julho Dourado, destinada à promoção da saúde dos animais domésticos e de rua e à prevenção de zoonoses.';
  const t = trechoDaEmenta(e, 60);
  assert.ok(t && t.texto.startsWith('institui a campanha Julho Dourado'));
  assert.ok(limpar(e).toLowerCase().startsWith(t.texto.toLowerCase()));
});
teste('simetria: trocar partido, autor e nomes não muda o título do modelo', () => {
  const v = {
    id: 'x', casa: 'camara', data: '2026-01-01', orgao_sigla: 'PLEN', orgao: 'Plenário', tipo: 'nominal', resultado: 'aprovada',
    descricao: 'Aprovado o Projeto de Lei nº 1, de 2026. Sim: 300; Não: 100; Total: 400.',
    proposicao: { id: '1', sigla: 'PL', numero: 1, ano: 2026, ementa: 'Institui o Programa Escola Aberta.' },
    placar: { sim: 300, nao: 100 }, votos: [{ nome: 'Fulano de Tal', partido: 'AAA', voto: 'Sim' }], orientacoes: [{ bancada: 'AAA', orientacao: 'Sim' }],
  };
  const a = modeloVotacao(v), b = modeloVotacao(perturbar(v));
  assert.equal(a.titulo, 'Câmara aprova projeto que institui o Programa Escola Aberta (300 Sim, 100 Não)');
  assert.equal(a.titulo, b.titulo);
  const rej = modeloVotacao({ ...v, resultado: 'rejeitada', descricao: 'Rejeitado o Projeto de Lei nº 1, de 2026.' });
  assert.equal(rej.titulo, 'Câmara rejeita projeto que institui o Programa Escola Aberta (300 Sim, 100 Não)');
});
console.log(`${ok} testes passaram`);
