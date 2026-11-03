#!/usr/bin/env node
// Testes offline do coletor de MG (sem rede): parser das atas do Diário do Legislativo, conferências,
// janelas de pesquisa sem paginação e montagem de proposições/normas.
// Amostras reais reduzidas em scripts/coleta/estados/mg/amostras/ (Diário de 30/10/2026; deputados em 02/11/2026).
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { normalizarNome } from '../rs/lib.mjs';
import { limparTexto, separarAtas, lerVotacoesDaAta, totaisProclamados, acharProposicao } from './diario.mjs';
import { porJanelas, meses, conferirParametros, montarNorma, montarProposicao, TIPOS_NORMA } from './almg.mjs';

const AM = path.join(path.dirname(fileURLToPath(import.meta.url)), 'amostras');
let ok = 0;
const teste = async (nome, fn) => { await fn(); ok++; console.log(`ok - ${nome}`); };

const deps = JSON.parse(fs.readFileSync(path.join(AM, 'deputados-em-exercicio.json'), 'utf8')).list;
const mapa = new Map(deps.map((d) => [normalizarNome(d.nome), d]));
const texto = fs.readFileSync(path.join(AM, 'diario-2026-10-30-trecho.txt'), 'utf8');
const paginas = texto.split(/=====PAGINA \d+=====\n?/);

await teste('limpeza: cabeçalhos de data e rodapés de página saem do texto', () => {
  const l = limparTexto(paginas);
  assert.ok(!l.some((x) => /^Página \d+ de \d+/.test(x)));
  assert.ok(!l.some((x) => /^Sexta-feira, 30 de outubro de 2026$/.test(x)));
  assert.deepEqual(limparTexto(['Betão (PT)\nSexta-feira, 1º de maio de 2026\nBella Gonçalves (PT)']), ['Betão (PT)', 'Bella Gonçalves (PT)'], 'cabeçalho com dia ordinal (1º) no meio de uma lista');
});

await teste('atas: só Plenário, com número, tipo e data', () => {
  const atas = separarAtas(limparTexto(paginas));
  assert.equal(atas.length, 1);
  assert.equal(atas[0].numero, 36);
  assert.equal(atas[0].tipo, 'ORDINARIA');
  assert.equal(atas[0].data, '2026-10-28');
  const com = separarAtas(['ATA DA 18ª REUNIÃO ORDINÁRIA DA COMISSÃO DE CONSTITUIÇÃO E JUSTIÇA NA 4ª SESSÃO LEGISLATIVA', 'ORDINÁRIA DA 20ª LEGISLATURA', 'x']);
  assert.equal(com.length, 0);
  const curta = separarAtas(['ATA DA 33ª REUNIÃO ORDINÁRIA DA 4ª SESSÃO LEGISLATIVA ORDINÁRIA DA 20ª LEGISLATURA, EM 12/8/2026', 'x']);
  assert.equal(curta[0].data, '2026-08-12', 'data sem zero à esquerda (Diário de 14/08/2026)');
});

await teste('votações nominais: PL 4.172/2025 (45 sim) e Veto 36/2026 (46 não, com correções orais)', () => {
  const [ata] = separarAtas(limparTexto(paginas));
  const { aceitas, recusadas } = lerVotacoesDaAta(ata, mapa);
  const pl = aceitas.find((v) => v.proposicao.sigla === 'PL' && v.proposicao.numero === 4172);
  assert.ok(pl);
  assert.equal(pl.votos.length, 45);
  assert.deepEqual(pl.totais_proclamados, { sim: 45, 'não': 0 });
  assert.equal(pl.turno, '2º turno');
  assert.equal(pl.resultado, 'aprovada');
  assert.ok(pl.votos.every((v) => v.voto === 'Sim' && v.parlamentar_id && v.partido));
  const vet = aceitas.find((v) => v.proposicao.sigla === 'VET');
  assert.equal(vet.proposicao.numero, 36);
  assert.equal(vet.votos.length, 46);
  assert.equal(vet.placar.nao, 46);
  assert.equal(vet.placar.sim, 0);
  assert.equal(vet.resultado, 'rejeitada');
  assert.match(vet.orientacao_registro, /desejarem manter o veto registrarão “sim”/);
  assert.match(vet.objeto, /parágrafo único do art\. 8º/);
  assert.ok(vet.votos.some((v) => v.nome === 'Raul Belém' && v.voto === 'Não'), 'voto registrado oralmente consta da lista');
  // PL 3.830/2025: duas votações eletrônicas (substitutivo e emenda) e uma só lista → recusadas.
  assert.equal(recusadas.length, 2);
  assert.ok(recusadas.every((r) => /única lista nominal para 2 votações/.test(r.motivo)));
  assert.ok(!aceitas.some((v) => v.proposicao.numero === 3830));
});

await teste('recusa: nome fora da lista oficial', () => {
  const [ata] = separarAtas(limparTexto(paginas));
  const a2 = { ...ata, linhas: ata.linhas.map((l) => (l === 'Betão (PT)' ? 'Fulano Inexistente (PT)' : l)) };
  const { recusadas } = lerVotacoesDaAta(a2, mapa);
  assert.ok(recusadas.some((r) => /sem correspondência na lista oficial/.test(r.motivo) && /Fulano Inexistente/.test(r.motivo)));
});

await teste('recusa: lista com número de nomes diferente do total proclamado', () => {
  const [ata] = separarAtas(limparTexto(paginas));
  let tirou = false;
  const a2 = { ...ata, linhas: ata.linhas.filter((l) => { if (!tirou && l === 'Zé Laviola (NOVO)') { tirou = true; return false; } return true; }) };
  const { recusadas } = lerVotacoesDaAta(a2, mapa);
  assert.ok(recusadas.some((r) => /com 44 nomes, mas a ata proclama 45/.test(r.motivo)));
});

await teste('totais proclamados e proposição', () => {
  assert.deepEqual(totaisProclamados('A presidenta – Votaram “sim” 38 deputados. Votaram “não” 10 deputados, totalizando 48 todos.'), { sim: 38, 'não': 10 });
  assert.deepEqual(totaisProclamados('Registre-se o voto “não” do deputado X. Portanto, votaram “não” 46 deputados; não houve voto favorável.'), { 'não': 46, sim: 0 });
  assert.deepEqual(acharProposicao('do Projeto de Lei Complementar nº 12/2026, do governador'), { sigla: 'PLC', tipo: 'Projeto de Lei Complementar', numero: 12, ano: 2026 });
  assert.equal(acharProposicao('do Projeto de Lei nº 4.172/2025').numero, 4172);
});

await teste('janelas: dividem até caber em 1 página e registram dias com mais de 20', async () => {
  const datas = { '2026-10-05': 15, '2026-10-06': 18, '2026-10-20': 25 };
  const ler = async (ini, fim) => {
    let total = 0;
    const itens = [];
    for (const [d, n] of Object.entries(datas)) if (d >= ini && d <= fim) { total += n; for (let i = 0; i < n; i++) itens.push(`${d}#${i}`); }
    return { total, itens: itens.slice(0, 20) };
  };
  const acc = await porJanelas(ler, '2026-10-01', '2026-10-31');
  assert.equal(acc.itens.filter((x) => x.startsWith('2026-10-05')).length, 15);
  assert.equal(acc.itens.filter((x) => x.startsWith('2026-10-06')).length, 18);
  assert.deepEqual(acc.incompletas, [{ ini: '2026-10-20', fim: '2026-10-20', total: 25, lidos: 20 }]);
  assert.deepEqual(meses('2026-01-15', '2026-03-02'), [['2026-01-15', '2026-01-31'], ['2026-02-01', '2026-02-28'], ['2026-03-01', '2026-03-02']]);
});

await teste('robots: nenhuma URL com p=, tp=, ord= ou ordenacao=', () => {
  assert.throws(() => conferirParametros('https://dadosabertos.almg.gov.br/api/v2/x?tipo=PL&p=2'));
  assert.throws(() => conferirParametros('https://dadosabertos.almg.gov.br/api/v2/x?tp=50'));
  assert.equal(conferirParametros('https://dadosabertos.almg.gov.br/api/v2/x?tipo=PL&expressao=Registraram'), 'https://dadosabertos.almg.gov.br/api/v2/x?tipo=PL&expressao=Registraram');
});

await teste('montagem: proposição e norma (formato do contrato)', () => {
  const p = montarProposicao({
    siglaTipoProjeto: 'PL', numero: '6214', ano: '2026', tipoProjeto: 'PROJETO DE LEI',
    autor: 'Deputada Maria Clara Marra                 PSDB\n', ementa: 'Declara de utilidade pública a Associação de Inclusão de Campos Altos.',
    autoresEstruturados: [{ id: 28874, nome: 'Deputada Maria Clara Marra', partido: 'PSDB' }],
    dataPublicacao: '2026-10-23', situacao: 'Aguardando designação de relator em comissão',
    listaHistoricoTramitacoes: [{ data: '2026-10-21', local: 'Plenário', historico: 'Proposição recebida em Plenário.' }, { data: '2027-01-10', local: 'Governador', historico: 'Transformado em Lei nº 26.100, de 9 de janeiro de 2027.' }],
  }, '2026-11-02');
  assert.equal(p.id, 'mg-PL-6214-2026');
  assert.equal(p.autor, 'Deputada Maria Clara Marra PSDB');
  assert.equal(p.autores[0].parlamentar_id, '28874');
  assert.equal(p.norma_gerada.numero, 26100);
  assert.equal(p.url, 'https://www.almg.gov.br/projetos-de-lei/PL/6214/2026/');
  const n = montarNorma(TIPOS_NORMA[0], {
    numero: '26054', ano: '2026', data: '20260901', origem: 'Legislativo', ementa: 'Declara de utilidade pública o Instituto X.',
    fonte: '<a href="https://diariolegislativo.almg.gov.br/2026/L20260902.pdf">Publicação</a> - Diário do Legislativo - 02/09/2026 Pág. 1 Col. 1',
  }, '2026-11-02');
  assert.equal(n.id, 'mg-lei-26054-2026');
  assert.equal(n.nome_oficial, 'Lei nº 26.054, de 01/09/2026');
  assert.deepEqual(n.publicacao[0], { veiculo: 'Diário do Legislativo', data: '2026-09-02', pagina: '1', coluna: '1', texto_oficial: 'Publicação - Diário do Legislativo - 02/09/2026 Pág. 1 Col. 1', url: 'https://diariolegislativo.almg.gov.br/2026/L20260902.pdf' });
  assert.equal(n.uf, 'MG'); assert.equal(n.casa, 'almg');
});

console.log(`\n${ok} testes passaram.`);
