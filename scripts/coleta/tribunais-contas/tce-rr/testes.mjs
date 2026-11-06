#!/usr/bin/env node
// Testes do coletor do TCE-RR (sem rede): node scripts/coleta/tribunais-contas/tce-rr/testes.mjs
// Os trechos de documento abaixo reproduzem a estrutura de pareceres reais do SEI do TCE-RR (encurtados).
// Também confere, se existirem, os arquivos gerados em dados/tribunais-contas/tce-rr/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { interpretarRobots, caminhoPermitido, decodificar, dataBR, SAIDA } from './lib.mjs';
import { linkSei, normalizarDeliberacao, idDaSerie } from './fonte.mjs';
import { htmlParaTexto, decodificarEntidades } from './html.mjs';
import { lerParecer, dataPorExtenso, limparRelator } from './extrair.mjs';
import { exercicioDe, municipioDoOrgao, enteDe, tipoContas, conclusaoDe, dataPublicacaoDe, interpretar } from './interpretar.mjs';
import { carregarMunicipiosRR } from './municipios.mjs';
import { montarMunicipio, montarGovernador, eContasDeGoverno } from './montar.mjs';
import { leituraDe } from './coletar.mjs';

let ok = 0;
function teste(nome, f) {
  try { f(); ok++; } catch (e) { console.error(`FALHOU: ${nome}\n${e.stack}`); process.exitCode = 1; }
}
const P = (linhas) => `<html><head><title>SEI/TCERR - 1 - Parecer Pr&eacute;vio</title></head><body>${linhas.map((l) => `<p class="Texto"><span>${l}</span></p>`).join('\n')}<img src="data:image/png;base64,AAAA"></body></html>`;
const { porNome, lista } = carregarMunicipiosRR();

const MUNICIPAL = P([
  'TRIBUNAL DE CONTAS DE RORAIMA', 'Parecer Pr&eacute;vio n&ordm; 001/2026-TCERR-PLENO', 'Processo n&ordm; 005763/2019',
  'Boletim Interno em 13/02/2026', 'DETCERR de 19/02/2026, se&ccedil;&atilde;o Jurisdicional, p&aacute;gina 8 do di&aacute;rio nr. 1776',
  '<b>1. PROCESSO N&ordm; <a href="x">001642/2022</a></b>',
  '<b>2. ASSUNTO: </b>Presta&ccedil;&atilde;o de Contas Anuais de Governo do Chefe do Poder Executivo e da Gest&atilde;o Fiscal do Munic&iacute;pio de Boa Vista &ndash; exerc&iacute;cio 2021',
  '3. &Oacute;RG&Atilde;O: Prefeitura Municipal de Boa Vista', '4. RESPONS&Aacute;VE L : Arthur Henrique Brand&atilde;o Machado - Prefeito',
  '5. RELATORA: Conselheira Cilene Lago Salom&atilde;o - Resolu&ccedil;&atilde;o n&ordm; 004/2024-TCERR/PLENO',
  '6. MINIST&Eacute;RIO P&Uacute;BLICO DE CONTAS: Paulo S&eacute;rgio Oliveira de Sousa', '8. REPRESENTANTE LEGAL : Fulana de Tal &ndash; OAB/RR 433',
  'PRESTA&Ccedil;&Atilde;O DE CONTAS ANUAIS DO PREFEITO. EXERC&Iacute;CIO DE 2021. PARECER PR&Eacute;VIO PELA REGULARIDADE COM RESSALVAS. INCISO II DO ARTIGO 17 DA LCE N&ordm; 006/94. ARQUIVAMENTO.',
  '9. PARECER PR&Eacute;VIO:', 'Vistos, relatados e discutidos os presentes autos, e',
  'Considerando que foram atendidos os limites de Pessoal;',
  'Os Conselheiros do Tribunal de Contas do Estado de Roraima, reunidos em Sess&atilde;o Plen&aacute;ria Especial, por unanimidade, S&Atilde;O DE PARECER:',
  '9.1. Que a C&acirc;mara Municipal de Boa Vista , julgue REGULARES COM RESSALVAS , as Contas Anuais do Prefeito, relativas ao exerc&iacute;cio de 2021, em raz&atilde;o das seguintes ressalvas:',
  '11. DATA DA SESS&Atilde;O: 11 de fevereiro de 2026', 'VOTO', 'Considerando irregularidades graves (texto do voto, não lido)',
]);

const GOVERNADOR = P([
  'TRIBUNAL DE CONTAS DE RORAIMA', 'Parecer Pr&eacute;vio n&ordm; Parecer Pr&eacute;vio 008/2025-TCERR-PLENO', 'Processo n&ordm; 005763/2019',
  'DETCERR de 09/09/2025, se&ccedil;&atilde;o Jurisdicional', '1. PROCESSO SEI N&ordm; 001643/2022',
  '2. ASSUNTO: Presta&ccedil;&atilde;o de Contas Anuais do Governador e da Gest&atilde;o Fiscal do Estado de Roraima &ndash; Exerc&iacute;cio 2021',
  '3. &Oacute;RG&Atilde;O: Governo do Estado de Roraima', '4. RESPONS&Aacute;VEL: Fulano - Governador', '5. RELATORA: Conselheira Cilene Lago Salom&atilde;o',
  'PRESTA&Ccedil;&Atilde;O DE CONTAS ANUAIS DO GOVERNADOR. EXERC&Iacute;CIO DE 2021. CONTAS REGULARES COM RESSALVAS. RECOMENDA&Ccedil;&Otilde;ES.',
  '8. PARECER PR&Eacute;VIO:', 'O Plen&aacute;rio do Tribunal de Contas do Estado de Roraima, reunido na Sess&atilde;o Plen&aacute;ria, e;', '&Eacute; de Parecer:',
  '8.1. Que a Assembleia Legislativa do Estado de Roraima - ALE, julgue regulares com ressalvas, as Contas Anuais do Governador, exerc&iacute;cio de 2021;',
  '9. PER&Iacute;ODO DA SESS&Atilde;O: 01 a 08 de setembro de 2025',
]);

const ANTIGO = P([
  'TRIBUNAL DE CONTAS DE RORAIMA', 'Parecer Pr&eacute;vio n&ordm; 004/2000-TCERR-PLENO', 'Processo n&ordm; 005763/2019',
  'PUBLICADO NO DI&Aacute;RIO OFICIAL DO ESTADO N&ordm; 078 DE: 26/04/2000.', '&ldquo;DELIBERA&Ccedil;&Atilde;O REFORMADA PELO AC&Oacute;RD&Atilde;O N&ordm; 033/2014-TCERR-PLENO&rdquo;',
  '1. Processo TCE/RR N.&ordm; 0135/98', '2. Assunto: Presta&ccedil;&atilde;o de Contas &ndash; Exerc&iacute;cio 1997', '3. &Oacute;rg&atilde;o: Prefeitura Municipal de Mucaja&iacute;',
  '4. Respons&aacute;vel: Sr.&ordf; Fulana', '5. Relator: Conselheiro Henrique Manoel Fernandes Machado',
  'O Tribunal de Contas do Estado de Roraima, &agrave; unanimidade dos Conselheiro presentes, e;', 'Considerando as impropriedades apontadas.',
  '&Eacute; de Parecer, que as Contas do Munic&iacute;pio de Mucaja&iacute;, exerc&iacute;cio de 1997, sejam julgadas, por essa Egr&eacute;gia C&acirc;mara, IRREGULARES , com fulcro no art. 17, inciso III.',
  '8. Ata n.&ordm; 010 - Plen&aacute;rio', '9. Data da Sess&atilde;o: 19 de abril de 2000 - Ordin&aacute;ria',
]);

teste('robots.txt', () => {
  const r = interpretarRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /sei/privado\nCrawl-delay: 5\n');
  assert.equal(caminhoPermitido(r.regras, '/sei/controlador_externo.php'), true);
  assert.equal(caminhoPermitido(r.regras, '/sei/privado/x'), false);
  assert.equal(r.crawlDelayS, 5);
  assert.equal(caminhoPermitido(interpretarRobots('User-agent: *\nDisallow: /\n').regras, '/api'), false);
  assert.equal(caminhoPermitido(interpretarRobots('User-agent: *\nDisallow:\n').regras, '/api'), true);
});

teste('codificação e entidades', () => {
  assert.equal(decodificar(Buffer.from('Presta\xe7\xe3o', 'latin1'), 'text/html; charset=ISO-8859-1'), 'Prestação');
  assert.equal(decodificarEntidades('&Oacute;RG&Atilde;O &ccedil; n&ordm; &#150; &ndash;'), 'ÓRGÃO ç nº – –');
  assert.equal(dataBR('31/02/2020'), null);
  assert.equal(dataPorExtenso('11 de fevereiro de 2026'), '2026-02-11');
  assert.equal(dataPorExtenso('01 a 08 de setembro de 2026'), null);
  assert.equal(dataPorExtenso('06/10/2022'), '2022-10-06');
  assert.equal(limparRelator('Conselheira Cilene Lago Salomão (Res. 004/2024-TCERR-PLENO)'), 'Conselheira Cilene Lago Salomão');
});

teste('lista da API', () => {
  assert.equal(idDaSerie([{ descricao: 'Acórdão', id: 8 }, { descricao: 'Parecer Prévio', id: 496 }]), 496);
  assert.throws(() => idDaSerie([{ descricao: 'Acórdão', id: 8 }]));
  const d = normalizarDeliberacao({ id: 1234591, numeroDocumento: '001/2026-TCERR-PLENO', nomeSerie: 'Parecer Prévio', descricaoColegiado: 'Pleno', dataPublicacao: '2026-02-20', ano: '2021', cv: '1186536', crc: '4a0d5aad', link: 'null/sei/...' });
  assert.equal(d.url, 'https://sei.tcerr.tc.br/sei/controlador_externo.php?acao=md_tcerr_dp_gerar_hash&id_orgao_acesso_externo=0&cv=1186536&crc=4A0D5AAD');
  assert.equal(linkSei('12a', 'ABCDEF12'), null);
});

teste('parecer municipal moderno', () => {
  const p = lerParecer(htmlParaTexto(MUNICIPAL));
  assert.equal(p.numero, '001/2026-TCERR-PLENO');
  assert.equal(p.processo, '001642/2022');
  assert.equal(p.orgao, 'Prefeitura Municipal de Boa Vista');
  assert.equal(p.responsavel, 'Arthur Henrique Brandão Machado - Prefeito');
  assert.equal(p.relator, 'Conselheira Cilene Lago Salomão');
  assert.equal(p.data_sessao, '2026-02-11');
  assert.deepEqual(p.anotacoes_literal, []);
  assert.ok(!p.dispositivo.some((l) => /VOTO|texto do voto/.test(l)), 'voto não entra no dispositivo');
  const i = interpretar(p, porNome);
  assert.equal(i.exercicio, 2021);
  assert.equal(i.ente.municipio.codigo_ibge, '1400100');
  assert.equal(i.tipo_contas, 'governo');
  assert.equal(i.conclusao, 'pela regularidade das contas com ressalvas');
  assert.equal(i.conclusao_literal, 'PARECER PRÉVIO PELA REGULARIDADE COM RESSALVAS');
  assert.equal(i.data_publicacao, '2026-02-19');
});

teste('parecer do Governador', () => {
  const p = lerParecer(htmlParaTexto(GOVERNADOR));
  assert.equal(p.numero, '008/2025-TCERR-PLENO');
  assert.equal(p.sessao_literal, '01 a 08 de setembro de 2025');
  assert.equal(p.data_sessao, null);
  const i = interpretar(p, porNome);
  assert.equal(i.ente.tipo, 'governo-estadual');
  assert.equal(i.exercicio, 2021);
  assert.equal(i.conclusao, 'pela regularidade das contas com ressalvas');
});

teste('parecer antigo (sem título "PARECER PRÉVIO")', () => {
  const p = lerParecer(htmlParaTexto(ANTIGO));
  assert.equal(p.processo, '0135/98');
  assert.equal(p.data_sessao, '2000-04-19');
  assert.equal(p.anotacoes_literal.length, 1);
  const i = interpretar(p, porNome);
  assert.equal(i.exercicio, 1997);
  assert.equal(i.tipo_contas, 'prestacao-de-contas');
  assert.equal(i.conclusao, 'pela irregularidade das contas');
  assert.equal(i.data_publicacao, '2000-04-26');
});

teste('exercício', () => {
  assert.equal(exercicioDe({ assunto: 'Prestação de Contas de Governo - 2004' }).exercicio, 2004);
  assert.equal(exercicioDe({ assunto: 'Prestação de Contas de Governo', orgao: 'Prefeitura Municipal do Cantá - Exercício 2019' }).exercicio, 2019);
  const d = exercicioDe({ assunto: 'Prestação de Contas de Gestão, exercício de 2011', ementa: 'EXERCÍCIO DE 2012.' });
  assert.equal(d.exercicio, 2011);
  assert.equal(d.divergencia, 'ementa: 2012');
  assert.equal(exercicioDe({ assunto: 'Prestação de Contas', ementa: 'EXERCÍCIOS DE 2016 E EXERCÍCIO DE 2017' }).exercicio, null);
  assert.equal(exercicioDe({ assunto: 'Tomada de Contas Especial' }).exercicio, null);
});

teste('município pelo nome exato', () => {
  assert.equal(lista.length, 15);
  assert.equal(municipioDoOrgao('Prefeitura Municipal de Cantá/RR'), 'canta');
  assert.equal(municipioDoOrgao('Prefeitura Municipal de Amajari – RR; Fundo Municipal de Saúde de Amajari – RR.'), 'amajari');
  assert.equal(municipioDoOrgao('Município de Pacaraima1'), 'pacaraima');
  assert.equal(municipioDoOrgao('Prefeitura Municipal de Boa Vista – PMBV'), 'boa vista');
  assert.equal(municipioDoOrgao('Prefeitura Municipal de de Mucajaí'), 'mucajai');
  assert.equal(enteDe('Governo do Estado de Roraima.', porNome).tipo, 'governo-estadual');
  assert.equal(enteDe('Prefeitura do Município de São João da Baliza', porNome).municipio.id, 'sao-joao-da-baliza');
  // Grafia diferente do nome oficial não é ligada.
  assert.equal(enteDe('Prefeitura Municipal de São Luiz do Anauá', porNome).tipo, 'municipio-nao-casado');
  assert.equal(enteDe('Governo do Estado de Roraima', porNome).tipo, 'governo-estadual');
  assert.equal(enteDe('Câmara Municipal de Boa Vista', porNome).tipo, 'outro');
});

teste('tipo de contas', () => {
  assert.equal(tipoContas('Prestação de Contas Anuais do Prefeito e da Gestão Fiscal - Exercício 2018'), 'governo');
  assert.equal(tipoContas('Prestação de Contas de Gestão – exercício 2015'), 'gestao');
  assert.equal(tipoContas('Prestação de Contas de Governo e de Gestão - Exercício 2012'), 'governo-e-gestao');
  assert.equal(tipoContas('Prestação de Contas – exercício 2005'), 'prestacao-de-contas');
  assert.equal(tipoContas('Tomada de Contas Especial nas Contas de Gestão - Exercício 2016'), 'tomada-de-contas-especial');
  assert.equal(eContasDeGoverno({ tipo_contas: 'tomada-de-contas-especial', assunto: 'Tomada de Contas Especial nas Contas de Governo do Prefeito - exercício 2012' }), true);
  assert.equal(eContasDeGoverno({ tipo_contas: 'tomada-de-contas-especial', assunto: 'Tomada de Contas Especial – Exercício 2017' }), false);
  assert.equal(eContasDeGoverno({ tipo_contas: 'gestao', assunto: 'Prestação de Contas de Gestão' }), false);
});

teste('conclusão: fórmulas e divergências', () => {
  const c = (ementa, dispositivo = []) => conclusaoDe({ ementa, dispositivo });
  assert.equal(c('PRESTAÇÃO DE CONTAS. PARECER PRÉVIO PELO JULGAMENTO DAS CONTAS COMO IRREGULARES - ALÍNEA "E".').conclusao, 'pela irregularidade das contas');
  assert.equal(c('PRESTAÇÃO DE CONTAS. PARECER PRÉVIO PELO JULGAMENTO DAS CONTAS COMO IRREGULARES - ALÍNEA "E".').conclusao_literal, 'PARECER PRÉVIO PELO JULGAMENTO DAS CONTAS COMO IRREGULARES');
  assert.equal(c('EXERCÍCIO DE 2017. PARECER PRÉVIO PARA FINS DE RECONHECIMENTO DA PRESCRIÇÃO QUINQUENAL.').conclusao, 'pelo reconhecimento da prescrição');
  assert.equal(c('PARECER PRÉVIO. REGULARES COM RESSALVAS. ARQUIVAMENTO.').conclusao, 'pela regularidade das contas com ressalvas');
  assert.equal(c('c) pela emissão de Parecer Prévio favorável à regularidade das Contas da Prefeitura Municipal de Mucajaí, exercício 1994, com ressalvas, na forma do Art. 17;').conclusao, 'pela regularidade das contas com ressalvas');
  // Descrição de achados na ementa não é conclusão ("ABERTURA IRREGULAR DE CRÉDITOS").
  assert.equal(c('ABERTURA IRREGULAR DE CRÉDITOS ADICIONAIS. FALHAS DE TRANSPARÊNCIA.').conclusao, null);
  // Ementa e decisão diferentes → em branco, com lacuna.
  const d = c('SUGERIR O RECONHECIMENTO DA PRESCRIÇÃO.PARECER PRÉVIO PELO JULGAMENTO DAS CONTAS COMO IRREGULARES.');
  assert.equal(d.conclusao, null);
  assert.match(d.lacunas[0], /mais de uma conclusão/);
  // Considerando com opinião do MPC não é a decisão.
  const e = c(null, ['O Plenário…, e', 'Considerando o Parecer do MPC, que opina pela regularidade com ressalvas das presentes contas;', 'É de Parecer:', '8.1. que as contas … sejam julgadas IRREGULARES;']);
  assert.equal(e.conclusao, 'pela irregularidade das contas');
  // Item que não emite opinião sobre as contas não conta.
  assert.equal(c(null, ['É de Parecer:', '8.1 pela recomendação ao atual gestor para evitar a reincidência das irregularidades;']).conclusao, null);
  assert.equal(c(null, ['É de Parecer:', '8.1. Que a Câmara Municipal de Normandia julgue a presente Prestação de Contas, REGULARES, com as seguintes RESSALVAS: 8.1.1. precariedade']).conclusao, 'pela regularidade das contas com ressalvas');
  assert.equal(c(null, ['É de Parecer:', '8.1. que sejam julgadas REGULARES as contas de resultado, com fundamento no inciso I do art. 17;']).conclusao, 'pela regularidade das contas');
  assert.equal(c(null, ['ACORDAM os Conselheiros, em:', '10.1. emitir Parecer Prévio contrário à aprovação das Contas do Município;']).conclusao, 'pela desaprovação das contas');
});

teste('data de publicação', () => {
  assert.equal(dataPublicacaoDe(['Boletim Interno em 16/09/2026', 'DETCERR num. 1913, de 17/09/2026, secao Jurisdicional']), '2026-09-17');
  assert.equal(dataPublicacaoDe(['DETCERR Nº 1436', 'Publicação: 10/09/2024', 'Disponibilização: 09/09/2024']), '2024-09-10');
  assert.equal(dataPublicacaoDe(['Publicação: 17 de maio de 2022', 'Disponibilização: 16 de maio de 2022 – 9h']), '2022-05-17');
  assert.equal(dataPublicacaoDe(['PUBLICADO NO DOE 2754 DE 05/05/16']), '2016-05-05');
  assert.equal(dataPublicacaoDe(['PUBLICADO NO DIÁRIO OFICIAL DO ESTADO Nº 1567 DE 04 /06 / 1997.']), '1997-06-04');
  assert.equal(dataPublicacaoDe(['Publicado no DOE 1866, de 04/09/2012 – Circulação em 10/09/2012']), '2012-09-04');
  assert.equal(dataPublicacaoDe(['DETCERR Nº 1427', 'Republicação: 28/08/2024', 'Disponibilização: 27/08/2024']), null);
});

teste('montagem dos arquivos', () => {
  const del = (id, numero) => ({ id, numero, colegiado: 'Pleno', url: `https://sei.tcerr.tc.br/sei/controlador_externo.php?acao=md_tcerr_dp_gerar_hash&id_orgao_acesso_externo=0&cv=${id}&crc=ABCDEF12` });
  const m = leituraDe(MUNICIPAL, false, porNome);
  const ges = { ...m, tipo_contas: 'gestao', assunto: 'Prestação de Contas de Gestão – exercício 2021', conclusao: null };
  const semEx = { ...m, exercicio: null };
  const mun = porNome.get('boa vista');
  const d = montarMunicipio(mun, [{ del: del(1, '001/2026-TCERR-PLENO'), lei: m }, { del: del(2, '002/2026-TCERR-PLENO'), lei: ges }, { del: del(3, '003/2026-TCERR-PLENO'), lei: semEx }], 'consulta', 2023);
  assert.equal(d.municipio.codigo_ibge, '1400100');
  assert.equal(d.itens.length, 1);
  assert.equal(d.outros_pareceres.length, 1);
  assert.equal(d.itens_sem_exercicio.length, 1);
  assert.deepEqual(d.exercicios_sem_parecer_na_serie, [2022, 2023]);
  const it = d.itens[0];
  assert.equal(it.parecer.exercicio, '2021');
  assert.equal(it.parecer.contas_de, 'Prefeito de Boa Vista');
  assert.equal(it.data_julgamento, '2026-02-11');
  assert.ok(it.lacunas.some((l) => /Câmara Municipal de Boa Vista/.test(l)));
  assert.ok(!JSON.stringify(d).includes('OAB/RR'), 'advogados não são copiados');
  const g = montarGovernador([{ del: del(4, '008/2025-TCERR-PLENO'), lei: leituraDe(GOVERNADOR, false, porNome) }, { del: del(5, '001/2024-TCERR-PLENO'), lei: { ...leituraDe(GOVERNADOR, false, porNome), tipo_contas: 'gestao' } }], 'consulta');
  assert.equal(g.arquivos.size, 1);
  assert.equal(g.arquivos.get(2021).outros_pareceres.length, 1);
  assert.match(g.arquivos.get(2021).lacunas[0], /outro parecer prévio/);
});

// ---- Arquivos gerados (se a coleta já rodou)
teste('arquivos gerados', () => {
  const dirPref = path.join(SAIDA, 'contas-prefeitos');
  const dirGov = path.join(SAIDA, 'contas-governador');
  if (!fs.existsSync(dirPref)) return;
  const ibge = new Set(lista.map((m) => m.codigo_ibge));
  for (const n of fs.readdirSync(dirPref)) {
    const d = JSON.parse(fs.readFileSync(path.join(dirPref, n), 'utf8'));
    assert.equal(`${d.municipio.id}.json`, n);
    assert.ok(ibge.has(d.municipio.codigo_ibge), `código IBGE de ${n}`);
    assert.ok(d.itens.length > 0);
    for (const it of d.itens) {
      assert.match(it.parecer.exercicio, /^\d{4}$/);
      assert.ok(!it.parecer.conclusao || it.parecer.conclusao_literal, `${it.id}: conclusão sem trecho literal`);
      assert.match(it.parecer.documento.url, /^https:\/\/sei\.tcerr\.tc\.br\//);
    }
  }
  if (fs.existsSync(dirGov)) for (const n of fs.readdirSync(dirGov)) {
    const it = JSON.parse(fs.readFileSync(path.join(dirGov, n), 'utf8'));
    assert.equal(`${it.parecer.exercicio}.json`, n);
  }
});

console.log(`${ok} testes ok`);
