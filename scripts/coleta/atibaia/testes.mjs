// Testes dos leitores do coletor de Atibaia (sem rede): node --test scripts/coleta/atibaia/testes.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { atosDaPagina, presencaDaPagina, lerCabecalhoEdicao, lerData } from './atos.mjs';
import { lerCalendario } from './imprensa.mjs';
import { centavos, resumirDespesas } from './financas.mjs';
import { consolidar } from './normas.mjs';
import { ementaPublica, temDocumentoPessoal, semDocumentos, NOME_OMITIDO, DOC_OMITIDO } from './privacidade.mjs';

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

// ------------------------------------------------------------ privacidade (diretriz 12)
// Nomes fictícios.
const N = NOME_OMITIDO, D = DOC_OMITIDO;

test('privacidade: CPF/RG viram [documento omitido]; CNPJ de entidade fica', () => {
  const e = 'Autoriza o uso ao Sr. João Fictício da Silva, inscrito no CPF nº 123.456.789-01, RG nº 12.345.678-9, de área pública.';
  const r = ementaPublica(e);
  assert.equal(r.ementa_publica, `Autoriza o uso ao Sr. ${N}, inscrito no ${D}, ${D}, de área pública.`);
  assert.equal(r.duvidas.length, 0);
  assert.equal(semDocumentos('CPF nº 301.173.608- 13, de um espaço'), `${D}, de um espaço`);
  assert.equal(semDocumentos('inscrito no CPF (nº ocultado), de um espaço'), `inscrito no ${D}, de um espaço`);
  const cnpj = 'Autorização de uso à Associação Amigos do Bairro X, CNPJ nº 12.345.678/0001-90, neste município.';
  assert.equal(ementaPublica(cnpj).ementa_publica, cnpj);
  assert.equal(temDocumentoPessoal('CPF 123.456.789-01'), true);
  assert.equal(temDocumentoPessoal('CNPJ 12.345.678/0001-90'), false);
});

test('privacidade: particular após Sr./Sra., munícipe, permissionário, em favor de, concede … a', () => {
  for (const [e, esperado] of [
    ['Revoga o Decreto nº 1, que autoriza o uso do Box nº 4 ao Sr. Luiz Fictício dos Santos.', `Revoga o Decreto nº 1, que autoriza o uso do Box nº 4 ao Sr. ${N}.`],
    ['Autoriza uso de espaço a Sra. Beltrana Exemplo, para banca.', `Autoriza uso de espaço a Sra. ${N}, para banca.`],
    ['Concede isenção ao munícipe JOSÉ EXEMPLO DE SOUZA.', `Concede isenção ao munícipe ${N}.`],
    ['Altera a permissão do permissionário Fulano Fictício Neto no Mercado.', `Altera a permissão do permissionário ${N} no Mercado.`],
    ['Dispõe sobre autorização de uso do Box nº 14 do Mercado Municipal, à Luciana Fictícia Alves.', `Dispõe sobre autorização de uso do Box nº 14 do Mercado Municipal, à ${N}.`],
  ]) {
    const r = ementaPublica(e);
    assert.equal(r.ementa_publica, esperado, e);
    assert.equal(r.mascaras[0].origem, 'automatico');
  }
});

test('privacidade: microempreendedor (nome de pessoa + CNPJ) tem nome e CNPJ omitidos', () => {
  const e = 'Dispõe sobre a autorização de uso à título precário à Fábio Fictício Pereira, CNPJ 38.000.000/0001-25, de um espaço.';
  assert.equal(ementaPublica(e).ementa_publica, `Dispõe sobre a autorização de uso à título precário à ${N}, ${D}, de um espaço.`);
});

test('privacidade: agentes públicos, entidades, empresas e homenagens em logradouro ficam', () => {
  for (const e of [
    'Institui o Dia X. (de autoria dos Vereadores Fulano Silva, Dr. Beltrano, José Fictício Machado e Lucas Exemplo).',
    'Dispõe sobre a denominação da “Rua Maria Fictícia da Cruz” no bairro do Portão. (de autoria do Vereador Antônio Exemplo de Lima)',
    'Dispõe sobre a denominação de “GEORGINA FICTÍCIA BERALDES”, a atual Rua 3.',
    'Calçadão localizado na Rua José Alvim, entre as ruas José Bim e José Pires no centro.',
    'Autoriza o uso de área à empresa Kablan Exemplo Engenharia Ltda., CNPJ nº 31.000.000/0001-08.',
    'Dispõe sobre ato de substituição temporária do Prefeito da Estância de Atibaia.',
    'Nomeia os Membros do Conselho Municipal de Saúde, para o biênio 2025/2026.',
    'Nomeia João Fictício Souza para o cargo de Secretário Municipal de Saúde.',
  ]) {
    const r = ementaPublica(e);
    assert.equal(r.ementa_publica, e, e);
    assert.equal(r.duvidas.length, 0, e);
  }
});

test('privacidade: ato de pessoal de servidor comum mascara o nome e mantém o cargo', () => {
  const r = ementaPublica('Exonera MARIA FICTÍCIA DA SILVA do cargo de Assessor Técnico da Secretaria de Saúde.');
  assert.equal(r.ementa_publica, `Exonera ${N} do cargo de Assessor Técnico da Secretaria de Saúde.`);
  const r2 = ementaPublica('Concede aposentadoria a Pedro Fictício Ramos, Agente de Serviços.');
  assert.equal(r2.ementa_publica, `Concede aposentadoria a ${N}, Agente de Serviços.`);
});

test('privacidade: dúvida (nome sem contexto, honraria) segura o ato; mascaras.json decide', () => {
  const e = 'Institui a Semana Ana Fictícia Lopes de conscientização.';
  const r = ementaPublica(e);
  assert.equal(r.duvidas.length, 1);
  assert.equal(r.duvidas[0].trecho, 'Ana Fictícia Lopes');
  assert.equal(ementaPublica('Concede Título de Cidadão Atibaiense a Carlos Fictício Prado.').duvidas.length, 1);
  // Lista de curadoria: manter (substituir_por igual ao trecho) ou omitir.
  const manter = ementaPublica(e, [{ trecho: 'Ana Fictícia Lopes', substituir_por: 'Ana Fictícia Lopes' }]);
  assert.equal(manter.duvidas.length, 0);
  assert.equal(manter.ementa_publica, e);
  const omitir = ementaPublica(e, [{ trecho: 'Ana Fictícia Lopes', substituir_por: N }]);
  assert.equal(omitir.ementa_publica, `Institui a Semana ${N} de conscientização.`);
  assert.deepEqual(omitir.mascaras.map((m) => m.origem), ['lista']);
  // Trecho da lista que não existe na ementa (lista desatualizada) volta a ser dúvida.
  assert.equal(ementaPublica('Outra ementa.', [{ trecho: 'Nome Inexistente', substituir_por: N }]).duvidas.length, 1);
});

test('consolidação: ementa_publica em todos os itens; dúvida vai para mascaras-pendentes até a decisão', () => {
  const ato = (n, ementa) => ({ id_candidato: `3051-p1-b0-l${n}`, id: `atibaia-decreto-${n}-2026`, tipo: 'decreto', tipo_nome: 'Decreto',
    numero: n.toLocaleString('pt-BR'), numero_int: n, data: '2026-10-28', ementa, pagina: 1, confianca: 'alta', motivos: [] });
  const reg = { edicoes: [{ edicao: '3051', data: '2026-10-31', url: 'u1', atos: [
    ato(11900, 'Dispõe sobre autorização de uso ao Sr. Fulano Fictício, inscrito no CPF nº 123.456.789-01, de banca.'),
    ato(11901, 'Institui a Semana Ana Fictícia Lopes.'),
    ato(11902, 'Regulamenta a Lei nº 5.100.')] }] };
  const r = consolidar([reg], { decisoes: [] }, '2026-11-02');
  const itens = r.indices['2026'];
  assert.equal(itens.length, 2);
  assert.ok(itens.every((i) => typeof i.ementa_publica === 'string'));
  assert.ok(itens.every((i) => !temDocumentoPessoal(i.ementa) && !temDocumentoPessoal(i.ementa_publica)));
  const banca = itens.find((i) => i.numero === '11.900');
  assert.equal(banca.ementa_publica, `Dispõe sobre autorização de uso ao Sr. ${N}, inscrito no ${D}, de banca.`);
  assert.equal(banca.mascaramento.nomes_omitidos_automatico, 1);
  assert.equal(r.mascarasPendentes.length, 1);
  assert.equal(r.mascarasPendentes[0].ato_id, 'atibaia-decreto-11901-2026');
  const r2 = consolidar([reg], { decisoes: [] }, '2026-11-02',
    { 'atibaia-decreto-11901-2026': [{ trecho: 'Ana Fictícia Lopes', substituir_por: N }] });
  assert.equal(r2.mascarasPendentes.length, 0);
  const sem = r2.indices['2026'].find((i) => i.numero === '11.901');
  assert.equal(sem.ementa_publica, `Institui a Semana ${N}.`);
  assert.equal(sem.mascaramento.nomes_omitidos_lista, 1);
  assert.equal(r2.estatisticas.mascarados_lista, 1);
});
