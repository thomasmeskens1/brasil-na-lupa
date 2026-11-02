// Testes dos leitores do coletor de Atibaia (sem rede): node --test scripts/coleta/atibaia/testes.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { atosDaPagina, presencaDaPagina, lerCabecalhoEdicao, lerData } from './atos.mjs';
import { lerCalendario } from './imprensa.mjs';
import { centavos, resumirDespesas } from './financas.mjs';
import { consolidar } from './normas.mjs';

const ED = { numero: '3051', data: '2026-10-31', url: 'https://x/pdf/2026/3051_a.pdf' };

test('datas por extenso', () => {
  assert.equal(lerData('de 28 de outubro 2026'), '2026-10-28');
  assert.equal(lerData('De 07 de julho de 2026'), '2026-07-07');
  assert.equal(lerData('1º de março de 2025.'), '2025-03-01');
  assert.equal(lerData('31 de fevereiro de 2026'), null);
});

test('cabeçalho da edição', () => {
  assert.deepEqual(lerCabecalhoEdicao(['Terça-feira, 7 de julho de 2026 - n.º 3005 - Ano XXX - Edição Extraordinária']),
    { data: '2026-07-07', numero: '3005', extraordinaria: true });
});

test('lei com ementa inequívoca → alta', () => {
  const pg = { pagina: 17, blocos: [{ col: 'esquerda', linhas: [
    'Memorando 65.950/2026', 'LEI N° 5.196', 'de 28 de outubro 2026',
    'Declara a utilidade pública da ASSOCIAÇÃO X.', '(de autoria do vereador Fulano)',
    'A CÂMARA MUNICIPAL DA ESTÂNCIA DE ATIBAIA, aprova', 'Art. 1º ...'] }] };
  const [a] = atosDaPagina(pg, ED);
  assert.equal(a.confianca, 'alta');
  assert.equal(a.id, 'atibaia-lei-5196-2026');
  assert.equal(a.ementa, 'Declara a utilidade pública da ASSOCIAÇÃO X. (de autoria do vereador Fulano)');
  assert.equal(a.autoria_na_ementa, 'de autoria do vereador Fulano');
});

test('decreto com data na mesma linha → alta', () => {
  const pg = { pagina: 2, blocos: [{ col: 'largura', linhas: [
    'DECRETO Nº 11.900, DE 20 DE OUTUBRO DE 2026', 'Regulamenta a Lei nº 5.100.', 'O PREFEITO DA ESTÂNCIA DE ATIBAIA, no uso'] }] };
  const [a] = atosDaPagina(pg, ED);
  assert.equal(a.confianca, 'alta');
  assert.equal(a.data, '2026-10-20');
  assert.equal(a.numero, '11.900');
});

test('ementa que atravessa o fim do bloco → revisar', () => {
  const pg = { pagina: 3, blocos: [{ col: 'esquerda', linhas: ['DECRETO Nº 11.901', 'De 20 de outubro de 2026', 'Dispõe sobre'] },
    { col: 'direita', linhas: ['a nomeação de membros.', 'O PREFEITO DA ESTÂNCIA DE ATIBAIA'] }] };
  const [a] = atosDaPagina(pg, ED);
  assert.equal(a.confianca, 'revisar');
  assert.ok(a.motivos.some((m) => m.includes('bloco de coluna termina')));
});

test('sem data / promulgação pela Câmara → revisar', () => {
  const pg = { pagina: 4, blocos: [{ col: 'esquerda', linhas: [
    'LEI Nº 5.000', 'Dispõe sobre algo importante.', 'O PRESIDENTE DA CÂMARA MUNICIPAL promulga'] }] };
  const [a] = atosDaPagina(pg, ED);
  assert.equal(a.confianca, 'revisar');
  assert.ok(a.motivos.some((m) => m.includes('data não encontrada')));
  assert.ok(a.motivos.some((m) => m.includes('promulgado pela Câmara')));
});

test('citações em minúsculas não viram ato', () => {
  const pg = { pagina: 5, blocos: [{ col: 'esquerda', linhas: ['nos termos da Lei nº 3.169, de 03 de maio de 2001.', 'Decreto nº 11.547, de 2025'] }] };
  assert.equal(atosDaPagina(pg, ED).length, 0);
});

test('lista de presença da ata', () => {
  const pg = { pagina: 30, blocos: [
    { col: 'esquerda', linhas: ['PRESIDENTE: Fulano de Tal', '1º SECRETÁRIO: Beltrano Silva'] },
    { col: 'largura', linhas: ['Ata da 36ª Sessão Ordinária da Câmara.', 'Aos 27 de outubro de 2026, às 17:07 horas,',
      'ESTIVERAM PRESENTES NESTA SESSÃO, OS SEGUINTES VEREADORES: Vereador Fulano de Tal - PSB; Vereador'] },
    { col: 'esquerda', linhas: ['Beltrano Silva – MDB; Ciclano Souza -'] }, { col: 'direita', linhas: ['PL.'] },
    { col: 'esquerda', linhas: ['VEREADOR AUSENTE: não houve.'] }] };
  const r = presencaDaPagina(pg);
  assert.equal(r.valida, true);
  assert.equal(r.data_sessao, '2026-10-27');
  assert.deepEqual(r.presentes.map((p) => p.partido), ['PSB', 'MDB', 'PL']);
  assert.equal(r.mesa.length, 2);
});

test('calendário oficial', () => {
  const html = `<div class="month-year">Outubro</div><div class="day_num ignore">30</div>
    <div class="day_num"><span>3</span><div><a href='pdf/2026/3041_${'a'.repeat(32)}.pdf'></a></div>
    <div><a href='pdf/2026/3041B_${'b'.repeat(32)}.pdf'></a></div></div>
    <div class="month-year">Setembro</div><div class="day_num"><span>30</span><div><a href='pdf/2026/3039.pdf'></a></div></div>`;
  const e = lerCalendario(html, 2026);
  assert.deepEqual(e.map((x) => [x.edicao, x.data]), [['3039', '2026-09-30'], ['3041', '2026-10-03'], ['3041B', '2026-10-03']]);
});

test('valores do TCE-SP em centavos', () => {
  assert.equal(centavos('1194,90'), 119490);
  assert.equal(centavos('-4.865,40'), -486540);
  assert.equal(centavos('3297511,4'), 329751140);
  assert.equal(centavos('abc'), null);
  const r = resumirDespesas([{ orgao: 'P', evento: 'Pago', vl_despesa: '0,10' }, { orgao: 'P', evento: 'Pago', vl_despesa: '0,20' }]);
  assert.equal(r.por_evento[0].total, 0.3);
});

test('consolidação: republicação igual vira um item; ementas diferentes vão para a curadoria', () => {
  const ato = (ed, ementa, num = 5196) => ({ id_candidato: `${ed}-p1-b0-l0`, id: `atibaia-lei-${num}-2026`, tipo: 'lei', tipo_nome: 'Lei',
    numero: num.toLocaleString('pt-BR'), numero_int: num, data: '2026-10-28', ementa, pagina: 1, confianca: 'alta', motivos: [] });
  const reg = { edicoes: [
    { edicao: '3051', data: '2026-10-31', url: 'u1', atos: [ato('3051', 'Declara X.'), ato('3051b', 'Outra.', 5197)] },
    { edicao: '3052', data: '2026-11-03', url: 'u2', atos: [ato('3052', 'Declara  x.'), ato('3052b', 'Diferente.', 5197)] }] };
  const r = consolidar([reg], { decisoes: [] }, '2026-11-02');
  assert.equal(r.indices['2026'].length, 1);
  assert.equal(r.indices['2026'][0].outras_publicacoes.length, 1);
  assert.equal(r.pendentes.length, 2);
  const r2 = consolidar([reg], { decisoes: [{ id_candidato: '3051b-p1-b0-l0', decisao: 'incluir', revisor: 'X' }] }, '2026-11-02');
  assert.equal(r2.indices['2026'].find((i) => i.numero === '5.197').confianca, 'revisada');
});

test('cabeçalho com letras espaçadas', () => {
  const pg = { pagina: 33, blocos: [{ col: 'direita', linhas: [
    'D E C R E T O Nº 11.631', 'de 31 de março de 2026', 'Altera o artigo 1º do Decreto nº 11.000.',
    'DANIEL DA ROCHA MARTINI, Prefeito da Estância de Atibaia, usando', 'D E C R E T A:'] }] };
  const [a] = atosDaPagina(pg, { numero: '2953', data: '2026-04-01' });
  assert.equal(a.confianca, 'alta');
  assert.equal(a.id, 'atibaia-decreto-11631-2026');
  assert.equal(a.ementa, 'Altera o artigo 1º do Decreto nº 11.000.');
});

test('página de coluna única: ementa na faixa de largura total logo abaixo', () => {
  const pg = { pagina: 44, blocos: [
    { col: 'esquerda', linhas: ['Memorando 62.232/2026', 'L E I N° 5.193', 'de 29 de setembro 2026'] },
    { col: 'largura', linhas: ['Dispõe sobre a oficialização da Rua X. (de autoria do Vereador Y).',
      'A CÂMARA MUNICIPAL DA ESTÂNCIA DE ATIBAIA, aprova e o PREFEITO MUNICIPAL'] }] };
  const [a] = atosDaPagina(pg, { numero: '3039', data: '2026-09-30' });
  assert.equal(a.confianca, 'alta');
  assert.equal(a.ementa_em_faixa_abaixo, true);
  assert.equal(a.ementa, 'Dispõe sobre a oficialização da Rua X. (de autoria do Vereador Y).');
  // Com conteúdo na coluna direita ao lado (bloco seguinte não é de largura total), continua em revisão.
  const pg2 = { pagina: 1, blocos: [pg.blocos[0], { col: 'direita', linhas: ['Outro texto'] }, pg.blocos[1]] };
  assert.equal(atosDaPagina(pg2, { numero: '3039', data: '2026-09-30' })[0].confianca, 'revisar');
});
