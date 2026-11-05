#!/usr/bin/env node
// Testes do coletor do TCE-AM, sem rede: node scripts/coleta/tribunais-contas/tce-am/testes.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lerRobots, caminhoProibido, gravarSeMudou, normalizar, slug, orcamentoMs, semTempo } from './lib.mjs';
import {
  limparConteudo, numeroLiteral, extrairExercicio, extrairResponsavel, extrairRelatorTexto, relatoresCompativeis,
  extrairConclusao, itensDispositivos, ressalvasEDeterminacoes, dataSessaoISO, dataSessaoDoTexto, classificarOrgao,
} from './extrair.mjs';
import { montarItem, fecharItensMunicipio, escolherGovernador, urlApi, carregarMunicipiosAM } from './montar.mjs';

let ok = 0;
const teste = (nome, fn) => { try { fn(); ok++; } catch (e) { console.error(`FALHOU: ${nome}\n${e.stack}`); process.exitCode = 1; } };

// Tarja vertical da assinatura digital, como vem no campo "conteudo".
const TARJA = '\nE\nst\n\ne \ndo\n\ncu\nm\nen\nto\n fo\ni a\nss\nin\nad\no \n';
const cabecalho = (n, pag) => `\n \nEstado do Amazonas \n\nTRIBUNAL DE CONTAS \n \n\nPARECER PREVIO Nº ${n} – TCE – TRIBUNAL PLENO \n\nGAAPS/Decisorio feito de acordo com a Resolucao nº 30/2012-TCE/AM \n\n        TRIBUNAL DE CONTAS \n           DIV. DE ACORDAOS \n   Proc. Nº ____ \nPublicado no Diario Eletronico \ndo TCE/AM, \nPag. ${pag} \n\n`;

const GOV = cabecalho('23/2024', 1) + `1- Processo TCE - AM nº 11851/2023. \n2- Natureza: Prestacao de Contas Anual. \n3- Orgao: Governo do Estado do Amazonas. \n4- Exercicio: 2022. \n5- Responsavel: Wilson Miranda Lima (Governador). \n6- Advogado: Nao Possui. \n9- Relator: Conselheiro Mario Manoel Coelho de Mello. \n \nEMENTA: Prestacao de Contas Anual. Governo do \nEstado do Amazonas. Exercicio de 2022. \nEmissao de Parecer Previo recomendando a \naprovacao com ressalvas e recomendacoes das \nContas Governamentais. \n10- PARECER PREVIO: \n O TRIBUNAL DE CONTAS DO ESTADO DO AMAZONAS, no uso de suas atribuicoes (art. 31, §§ 1º e 2º) e acolhido, a unanimidade, o \nvoto do Excelentissimo Senhor Conselheiro-Relator, em consonancia com o pronunciamento do Ministerio Publico junto a este Tribunal: \n10.1. Emite Parecer Previo recomendando a Assembleia Legislativa do \nEstado do Amazonas a aprovacao com ressalvas e recomendacoes \nda Prestacao de Contas do Governo, de responsabilidade do Sr. Wilson Miranda Lima, de acordo com art. 22, inciso II. \n10.2. Registrar as seguintes ressalvas para o exercicio vindouro: \n10.2.1. Promova mecanismos de controle;${TARJA}\n` +
  cabecalho('23/2024', 2) + `10.2.2. Disponibilize as Atas no Portal da SEFAZ; \n10.3. Recomendar ao Governo do Estado, para o exercicio vindouro: 10.3.1 que seja realizado melhor planejamento, conforme o item 10.2.1 desta decisao; \n10.4. Arquivar os autos. \n11- Ata: 1ª Sessao Especial – Tribunal Pleno. 12- Data da Sessao: 9 de Abril de 2024 13- Quorum: Fulano. \nACORDAO Nº 23/2024 – TCE – TRIBUNAL PLENO (parte integrante do Parecer Previo nº 23/2024) \n10- ACORDAO: Vistos, relatados e discutidos, ACORDAM: 10.1. Encaminhar o processo a Assembleia. 11- Ata: 1ª Sessao Especial.`;

const PREF = cabecalho('5/2016', 1) + `1- Processo TCE - AM nº 15990/2015. \n3- Orgao: Prefeitura Municipal de Novo Airao. \n4- Exercicio: 2013. \n5- Responsavel: Fulana de Tal (Prefeita Municipal). \n9- Relator: Auditor Luiz Henrique Pereira Mendes. \nEMENTA: Prefeitura Municipal de Novo Airao. Exercicio de2013. Emissao de Parecer Previo recomendando a desaprovacao das contas anuais. \n9- PARECER PREVIO: O TRIBUNAL, acolhido, por unanimidade, a proposta de voto: 9.1. Emite Parecer Previo recomendando a Camara Municipal a desaprovacao das contas da Sra. Fulana de Tal, exercicio 2013, nos termos do art. 71, inciso I, da Constituicao. 11- Ata`;

teste('limparConteudo tira tarja e cabeçalhos de página', () => {
  const t = limparConteudo(GOV);
  assert.ok(!/E st e do/.test(t), 'tarja removida');
  assert.ok(!/Pag\. 2/.test(t), 'cabeçalho da página 2 removido');
  assert.ok(/10\.2\.1\. Promova mecanismos de controle; 10\.2\.2\. Disponibilize/.test(t));
});

teste('número literal do parecer', () => {
  assert.equal(numeroLiteral(GOV), 'PARECER PREVIO Nº 23/2024 – TCE – TRIBUNAL PLENO');
  assert.equal(numeroLiteral('PARECER PREVIO Nº73/2016 – TCE – TRIBUNAL PLENO 1- Processo'), 'PARECER PREVIO Nº73/2016 – TCE – TRIBUNAL PLENO');
  assert.equal(numeroLiteral('sem cabeçalho'), null);
});

teste('exercício: cabeçalho, ementa, objeto e divergência', () => {
  const t = limparConteudo(GOV);
  assert.deepEqual(extrairExercicio(t, 'REFERENTE AO EXERCÍCIO DE 2022').exercicio, '2022');
  assert.equal(extrairExercicio('Exercicio de2013. Emissao', null).exercicio, '2013');
  assert.equal(extrairExercicio('sem ano', 'PRESTAÇÃO DE CONTAS REFERENTE AO EXERCÍCIO DE 2019.').exercicio, '2019');
  const d = extrairExercicio('4- Exercicio: 2013. 5-', 'EXERCÍCIO DE 2012');
  assert.equal(d.exercicio, '2013');
  assert.match(d.divergente, /2013.*2012/);
  assert.equal(extrairExercicio('nada', 'nada').exercicio, null);
});

teste('responsável e relator literais', () => {
  const t = limparConteudo(GOV);
  assert.equal(extrairResponsavel(t), 'Wilson Miranda Lima (Governador)');
  assert.equal(extrairRelatorTexto(t), 'Conselheiro Mario Manoel Coelho de Mello');
  assert.equal(extrairRelatorTexto(limparConteudo(PREF)), 'Auditor Luiz Henrique Pereira Mendes');
});

teste('relatores compatíveis só com todas as palavras do nome da API', () => {
  assert.ok(relatoresCompativeis('Mário José de Moraes Costa Filho', 'Auditor Mario Jose de Moraes Costa Filho'));
  assert.ok(relatoresCompativeis('Yara Amazônia Lins Rodrigues', 'Conselheira Yara Amazonia Lins Rodrigues dos Santos'));
  assert.ok(!relatoresCompativeis('Ari Jorge Moutinho da Costa Júnior', 'Conselheira Yara Amazonia Lins Rodrigues dos Santos'));
  assert.ok(!relatoresCompativeis(null, 'Conselheiro X'));
});

teste('conclusão: aprovação com ressalvas (Governador)', () => {
  const c = extrairConclusao(limparConteudo(GOV));
  assert.equal(c.conclusao, 'pela aprovação');
  assert.equal(c.com_ressalvas, true);
  assert.match(c.conclusao_literal, /^Emite Parecer Previo recomendando a Assembleia Legislativa .* de acordo com art\. 22, inciso II$/);
  assert.match(c.ementa_literal, /aprovacao com ressalvas e recomendacoes das Contas Governamentais$/);
  assert.match(c.unanimidade_literal, /^acolhido, a unanimidade/);
  assert.equal(c.lacuna, null);
});

teste('conclusão: desaprovação; frase para antes de "11- Ata" e não corta em "art. 71"', () => {
  const c = extrairConclusao(limparConteudo(PREF));
  assert.equal(c.conclusao, 'pela desaprovação');
  assert.equal(c.com_ressalvas, false);
  assert.match(c.conclusao_literal, /art\. 71, inciso I, da Constituicao$/);
});

teste('conclusão: não aprovação, ausência e divergência viram null/lacuna', () => {
  assert.equal(extrairConclusao('Emite Parecer Previo recomendando a nao aprovacao das contas.').conclusao, 'pela não aprovação');
  const nada = extrairConclusao('Texto sem formula reconhecida.');
  assert.equal(nada.conclusao, null);
  assert.match(nada.lacuna, /não identificada/);
  const div = extrairConclusao('Emissao de Parecer Previo recomendando a aprovacao das contas. Emite Parecer Previo recomendando a desaprovacao das contas.');
  assert.equal(div.conclusao, null);
  assert.match(div.lacuna, /diferentes/);
  const verbo = extrairConclusao('EMITE PARECER PREVIO, nos termos do artigo 31, recomendando ao Poder Legislativo do Municipio, APROVAR COM RESSALVAS, a Prestacao de Contas Anual; 9.2. Determinar.');
  assert.equal(verbo.conclusao, 'pela aprovação');
  assert.equal(verbo.com_ressalvas, true);
  const doisPontos = extrairConclusao('EMITE PARECER PREVIO recomendando ao Poder Legislativo Municipal de Tapaua: a desaprovacao das contas do exercicio de 2009; 9.2. Multa.');
  assert.equal(doisPontos.conclusao, 'pela desaprovação');
  assert.equal(doisPontos.conclusao_literal, 'EMITE PARECER PREVIO recomendando ao Poder Legislativo Municipal de Tapaua: a desaprovacao das contas do exercicio de 2009');
  const ambos = extrairConclusao('Emite Parecer Previo recomendando a aprovacao das contas de governo e a desaprovacao das contas de gestao.');
  assert.equal(ambos.conclusao, null);
});

teste('itens dispositivos, ressalvas e determinações', () => {
  const itens = itensDispositivos(limparConteudo(GOV));
  assert.deepEqual(itens.map((i) => `${i.secao}:${i.numero}`), ['parecer:10.1', 'parecer:10.2', 'parecer:10.2.1', 'parecer:10.2.2', 'parecer:10.3', 'parecer:10.3.1', 'parecer:10.4', 'acordao:10.1']);
  assert.equal(itens[6].texto, 'Arquivar os autos.');
  const { ressalvas, determinacoes, tituloRessalvas, temAcordao } = ressalvasEDeterminacoes(itens);
  assert.deepEqual(ressalvas, ['Promova mecanismos de controle;', 'Disponibilize as Atas no Portal da SEFAZ;']);
  assert.match(tituloRessalvas, /^Registrar as seguintes ressalvas/);
  assert.ok(temAcordao);
  assert.deepEqual(determinacoes.map((d) => d.numero), ['10.3', '10.3.1', '10.4', '10.1']);
  assert.equal(determinacoes.at(-1).texto, 'Encaminhar o processo a Assembleia.');
  assert.match(determinacoes[1].texto, /item 10\.2\.1 desta decisao;$/);
  assert.equal(itensDispositivos('sem parte dispositiva').length, 0);
});

teste('data da sessão escrita no texto e fim da parte dispositiva em "11- Ata"', () => {
  assert.deepEqual(dataSessaoDoTexto('12- Data da Sessao: 6 de Dezembro de 2022 13- Especificacao'), { iso: '2022-12-06', literal: '6 de Dezembro de 2022' });
  assert.equal(dataSessaoDoTexto('Data da Sessao: 31 de Fevereiro de 2022'), null);
  assert.equal(dataSessaoDoTexto('sem data'), null);
  const t = '10- PARECER PREVIO: 10.1. Emite Parecer Previo recomendando a aprovacao. 10.2. Determinar a comunicacao. 11- Ata: 1ª Sessao Especial. 12- Data da Sessao: 6 de Dezembro de 2022';
  const itens = itensDispositivos(t);
  assert.equal(itens.at(-1).texto, 'Determinar a comunicacao.');
  assert.equal(extrairRelatorTexto('9- Relator: Conselheiro Julio Assis Correa Pinheiro. EMENTA: x'), 'Conselheiro Julio Assis Correa Pinheiro');
  assert.ok(relatoresCompativeis('Júlio Assis Corrêa Pinheiro', 'Conselheiro Julio Assis Correa Pinheiro.'));
  assert.equal(extrairConclusao('EMITIR PARECER PREVIO sugerindo a Assembleia que APROVE a Prestacao de Contas; 10.2.').conclusao, 'pela aprovação');
});

teste('datas e órgãos', () => {
  assert.equal(dataSessaoISO('20221206'), '2022-12-06');
  assert.equal(dataSessaoISO('20220231'), null);
  assert.equal(dataSessaoISO(''), null);
  assert.deepEqual(classificarOrgao('Governo do Estado do Amazonas'), { tipo: 'governador' });
  assert.deepEqual(classificarOrgao('Prefeitura Municipal de Manaus - PMM'), { tipo: 'prefeitura', municipio_normalizado: 'MANAUS' });
  assert.deepEqual(classificarOrgao('Prefeitura Municipal de São Paulo de Olivença'), { tipo: 'prefeitura', municipio_normalizado: 'SAO PAULO DE OLIVENCA' });
  assert.equal(classificarOrgao('Câmara Municipal de Anamã').tipo, 'outro');
});

teste('robots.txt', () => {
  const r = lerRobots('User-agent: Googlebot\nDisallow: /a\n\nUser-agent: *\nDisallow: /privado/\nDisallow: /*.pdf$\n# comentário\n');
  assert.deepEqual(r, ['/privado/', '/*.pdf$']);
  assert.ok(caminhoProibido(r, '/privado/x'));
  assert.ok(caminhoProibido(r, '/docs/a.pdf'));
  assert.ok(!caminhoProibido(r, '/decisorios/byManyFields'));
  assert.ok(caminhoProibido(lerRobots('User-agent: *\nDisallow: /'), '/qualquer'));
  assert.deepEqual(lerRobots('{"status":404}'), []);
});

const registro = (extra) => ({
  anoProcesso: '2023', numeroProcesso: '11851', anoDecisorio: '2024', numeroDecisorio: '23', conteudo: GOV,
  caminhoArquivo: 'https://jurisprudencia-fs.tce.am.gov.br/documents/x.pdf', tamanho: '594 KB', relator: 'Mario Manoel Coelho de Mello',
  natureza: 'Prestação de Contas Anual', orgao: 'Governo do Estado do Amazonas', objeto: 'EXERCÍCIO DE 2022', sessao: '1ª Sessão Especial',
  dataSessao: '20240409', orgaoJulgador: 'Tribunal Pleno', tipoDecisorio: 'Parecer Prévio', ...extra,
});

teste('montarItem: Governador', () => {
  const m = montarItem(registro());
  assert.equal(m.tipo, 'governador');
  const it = m.item;
  assert.equal(it.id, 'tce-am-contas-governador-2022');
  assert.equal(it.data_julgamento, '2024-04-09');
  assert.equal(it.processo.numero, '11851/2023');
  assert.equal(it.parecer.exercicio, '2022');
  assert.equal(it.parecer.ressalvas.length, 2);
  assert.equal(it.relator, 'Mario Manoel Coelho de Mello');
  assert.equal(it.votacoes[0].resultado, 'unanimidade');
  assert.ok(it.fontes.every((f) => f.url && f.titulo && f.orgao && f.acessado_em));
  assert.ok(it.lacunas.some((l) => /ALEAM/.test(l)));
  assert.ok(!JSON.stringify(it).includes('Promova mecanismos de controle; 10.2.2'), 'sem texto integral');
});

teste('montarItem: descartes e relator divergente', () => {
  assert.equal(montarItem(registro({ tipoDecisorio: 'Acórdão' })).tipo, 'descartado');
  assert.equal(montarItem(registro({ natureza: 'Fiscalização de Atos de Gestão' })).tipo, 'descartado');
  assert.equal(montarItem(registro({ orgao: 'Câmara Municipal de Anori' })).tipo, 'descartado');
  assert.equal(montarItem(registro({ caminhoArquivo: 'https://outro.site/x.pdf' })).item.parecer.documento, null);
  const d = montarItem(registro({ relator: 'Ari Jorge Moutinho da Costa Júnior' })).item;
  assert.equal(d.relator, 'Conselheiro Mario Manoel Coelho de Mello');
  assert.ok(d.lacunas.some((l) => /divergem sobre o relator/.test(l)));
});

teste('registro migrado sem metadados: número e colegiado do texto, sem data', () => {
  const conteudo = PREF.replace('PARECER PREVIO Nº 5/2016 – TCE', 'PARECER PREVIO Nº 009/2013 –– TCE');
  const m = montarItem(registro({
    orgao: 'Prefeitura Municipal de Novo Airão', conteudo, objeto: '', tipoDecisorio: '', tipo: 'PARECERPREVIO',
    numeroDecisorio: '0', anoDecisorio: '', dataSessao: '', orgaoJulgador: '', sessao: '',
  }));
  assert.equal(m.tipo, 'prefeitura');
  assert.equal(m.item.decisorio.numero, '9/2013');
  assert.equal(m.item.orgao, 'Tribunal Pleno');
  assert.equal(m.item.data_julgamento, null);
  assert.equal(m.item.registro_sem_metadados, true);
  assert.ok(m.item.lacunas.some((l) => /sem metadados/.test(l)));
  assert.equal(montarItem(registro({ tipoDecisorio: '', tipo: 'ACORDAO' })).tipo, 'descartado');
  assert.equal(montarItem(registro({ tipoDecisorio: '', tipo: 'PARECERPREVIO', conteudo: 'sem cabecalho' })).tipo, 'descartado');
});

teste('prefeitos: município, ids únicos e lacuna da Câmara', () => {
  const a = montarItem(registro({ orgao: 'Prefeitura Municipal de Novo Airão', conteudo: PREF, numeroDecisorio: '5', anoDecisorio: '2016', objeto: '' }));
  const b = montarItem(registro({ orgao: 'Prefeitura Municipal de Novo Airão', conteudo: PREF, numeroDecisorio: '9', anoDecisorio: '2016', objeto: '' }));
  assert.equal(a.tipo, 'prefeitura');
  assert.equal(a.municipio_normalizado, 'NOVO AIRAO');
  const mun = { id: 'novo-airao', nome: 'Novo Airão' };
  const itens = fecharItensMunicipio(mun, [b.item, a.item]);
  assert.deepEqual(itens.map((i) => i.id), ['tce-am-contas-prefeito-novo-airao-2013-pp-5-2016', 'tce-am-contas-prefeito-novo-airao-2013-pp-9-2016']);
  assert.equal(itens[0].parecer.contas_de, 'Prefeito de Novo Airão');
  assert.equal(itens[0].parecer.conclusao, 'pela desaprovação');
  // Idempotente: fechar de novo não duplica lacunas.
  const de2 = fecharItensMunicipio(mun, itens);
  assert.equal(de2[0].lacunas.length, itens[0].lacunas.length);
  assert.equal(de2[0].lacunas.filter((l) => /Câmara Municipal de Novo Airão/.test(l)).length, 1);
});

teste('Governador: escolha do parecer mais recente é idempotente', () => {
  const a = montarItem(registro()).item;
  const b = { ...montarItem(registro({ numeroDecisorio: '40', dataSessao: '20250101' })).item };
  const e = escolherGovernador([a, b]);
  assert.equal(e.decisorio.numero, '40/2024');
  assert.equal(escolherGovernador([e, a]).lacunas.filter((l) => /^Há outro/.test(l)).length, 1);
});

teste('URL da API leva todos os parâmetros, com espaço como %20', () => {
  const u = urlApi({ strAnoDecisorio: '2024', strNatureza: 'Prestação de Contas Anual' });
  assert.match(u, /strAnoDecisorio=2024/);
  assert.match(u, /strNatureza=Presta%C3%A7%C3%A3o%20de%20Contas%20Anual$/);
  assert.match(u, /strConteudo=null&/);
});

teste('municípios do AM pela lista oficial do repositório', () => {
  const m = carregarMunicipiosAM();
  assert.equal(m.size, 62);
  assert.equal(m.get('SAO GABRIEL DA CACHOEIRA').id, 'sao-gabriel-da-cachoeira');
  assert.equal(m.get('MANAUS').codigo_ibge, '1302603');
});

teste('utilitários e orçamento de tempo', () => {
  assert.equal(normalizar(' Lábrea  do  Sul '), 'LABREA DO SUL');
  assert.equal(slug('Santo Antônio do Içá'), 'santo-antonio-do-ica');
  const antes = process.env.COLETA_ORCAMENTO_MIN;
  process.env.COLETA_ORCAMENTO_MIN = '0.0001';
  assert.ok(semTempo());
  delete process.env.COLETA_ORCAMENTO_MIN;
  assert.equal(orcamentoMs(), Infinity);
  if (antes !== undefined) process.env.COLETA_ORCAMENTO_MIN = antes;
});

teste('gravação atômica só quando o conteúdo muda', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tceam-teste-'));
  try {
    const arq = path.join(dir, 'a.json');
    assert.equal(gravarSeMudou(arq, { x: 1, atualizado_em: '1' }), true);
    assert.equal(gravarSeMudou(arq, { x: 1, atualizado_em: '2' }), false);
    assert.equal(gravarSeMudou(arq, { x: 2, atualizado_em: '3' }), true);
    assert.deepEqual(fs.readdirSync(dir), ['a.json']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`${ok} testes passaram${process.exitCode ? ' (há falhas acima)' : ''}`);
