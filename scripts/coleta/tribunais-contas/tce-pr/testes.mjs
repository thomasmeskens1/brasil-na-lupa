#!/usr/bin/env node
// Testes sem rede do coletor do TCE-PR: node scripts/coleta/tribunais-contas/tce-pr/testes.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lerRobots, caminhoPermitido, dataISO, normalizar, gravarSeMudou } from './lib.mjs';
import { COLUNAS, criarLeitorCsv, exercicioDoRegistro, conclusaoNoResumo, lerDeliberacao, secoesDeliberacao, municipioDaEntidade, cortar } from './extrair.mjs';
import { montarItem, consolidar, herdarLeitura, chaveDoAto, VERSAO_LEITURA } from './itens.mjs';
import { chaveNome, casarMunicipio, mesclar, montarArquivoMunicipio } from './municipios.mjs';

let ok = 0;
const teste = (nome, fn) => { try { fn(); ok++; } catch (e) { console.error(`FALHOU: ${nome}\n${e.stack}`); process.exitCode = 1; } };

// ---- fixture: duas linhas reais (encurtadas) do CSV de 2026, uma com quebra de linha e aspas dentro do campo
const linha = (o) => COLUNAS.map((c) => o[c] ?? '').join(';');
const r1 = {
  DsTipoAto: 'Acórdão de Parecer Prévio', NrAto: '14', AnoAto: '2026', DsClasseProcessual: '"PRESTAÇÃO DE CONTAS DO PREFEITO MUNICIPAL         "',
  NrProcesso: '153706', AnoProcesso: '2025', DsTitulo: 'Parecer Prévio 14/2026', NmCategoriaPublicacao: 'Parecer Prévio', DsColegiado: 'Primeira Câmara',
  DsEntidade: 'MUNICÍPIO DE SIQUEIRA CAMPOS', DsInteressado: 'FULANO e MUNICÍPIO DE SIQUEIRA CAMPOS', DsVeiculoPublicacao: 'DETC',
  DtPublicacaoDOE: '04/02/2026 00:00:00', DtSessao: '26/01/2026 12:00:00', NrDOE: '3609', NmRelator: 'JOSE DURVAL MATTOS DO AMARAL',
  Termos: 'Ressalva > Regularidade', DsTema: 'Prestação de contas do prefeito municipal de Siqueira Campos, exercício de 2024.',
  UrlPDF: 'https://viajuris.tce.pr.gov.br/Arquivos/2026/2/000200509.pdf',
};
const r2 = { ...r1, NrAto: '15', DsResumo: '"Linha um;\nlinha ""dois"". Parecer Prévio pela regularidade das contas."', DsTema: '', UrlPDF: 'https://viajuris.tce.pr.gov.br/Arquivos/2026/2/000200510.pdf' };
const CSV = '﻿' + COLUNAS.join(';') + '\r\n' + linha(r1) + '\r\n' + linha(r2) + '\r\n';

teste('leitor de CSV em pedaços (BOM, CRLF, aspas, quebra de linha no campo)', () => {
  for (const tam of [1, 7, 64, CSV.length]) {
    const regs = [];
    const l = criarLeitorCsv((r) => regs.push(r));
    for (let i = 0; i < CSV.length; i += tam) l.empurrar(CSV.slice(i, i + tam));
    l.fim();
    assert.equal(regs.length, 2);
    assert.equal(regs[0].DsClasseProcessual, 'PRESTAÇÃO DE CONTAS DO PREFEITO MUNICIPAL');
    assert.equal(regs[1].DsResumo, 'Linha um;\nlinha "dois". Parecer Prévio pela regularidade das contas.');
  }
});

teste('cabeçalho diferente é rejeitado', () => {
  const l = criarLeitorCsv(() => {});
  assert.throws(() => l.empurrar('A;B;C\n'), /cabeçalho inesperado/);
});

teste('robots.txt', () => {
  const r = lerRobots('User-agent: *\nDisallow:\n');
  assert.deepEqual(r.disallow, []);
  assert.ok(caminhoPermitido(r, '/DadosAbertos/DadosAbertos/DownloadArquivo?nomeArquivo=2026_acordaos_base_de_dados.csv'));
  const r2b = lerRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /Arquivos/\nAllow: /Arquivos/2026/\nCrawl-delay: 5\n');
  assert.equal(r2b.crawlDelayS, 5);
  assert.ok(!caminhoPermitido(r2b, '/Arquivos/2025/1/x.pdf'));
  assert.ok(caminhoPermitido(r2b, '/Arquivos/2026/1/x.pdf'));
  assert.ok(caminhoPermitido(r2b, '/DadosAbertos/'));
});

teste('datas, normalização e corte', () => {
  assert.equal(dataISO('26/01/2026 12:00:00'), '2026-01-26');
  assert.equal(dataISO(''), null);
  assert.equal(normalizar('  Município  de Piraí '), 'MUNICIPIO DE PIRAI');
  assert.equal(chaveNome("Pérola D´Oeste"), chaveNome("Pérola d'Oeste"));
  assert.equal(chaveNome('ITAPEJARA D OESTE'), chaveNome("Itapejara d'Oeste"));
  assert.notEqual(chaveNome('Munhoz de Mello'), chaveNome('Munhoz de Melo'));
  assert.equal(municipioDaEntidade('MUNICÍPIO DA LAPA', normalizar), 'LAPA');
  assert.equal(municipioDaEntidade('ASSEMBLEIA LEGISLATIVA DO ESTADO DO PARANÁ', normalizar), null);
  assert.equal(cortar('abc def', 3), 'abc […]');
});

teste('exercício só quando escrito na fonte', () => {
  assert.deepEqual(exercicioDoRegistro({ DsTema: r1.DsTema, DsResumo: '' }), { ano: 2024, trecho: 'exercício de 2024', campo: 'DsTema' });
  assert.equal(exercicioDoRegistro({ DsTema: '', DsResumo: 'Exercício de 202 Proposta' }), null);
  assert.equal(exercicioDoRegistro({ DsTema: '', DsResumo: 'Estado. Exercício de 2023. Parecer' }).campo, 'DsResumo');
});

teste('conclusão no resumo: só frase literal, nunca "Proposta"', () => {
  assert.equal(conclusaoNoResumo('Estado. Exercício de 2023. Parecer Prévio pela regularidade das contas com aposição de ressalvas.'),
    'Parecer Prévio pela regularidade das contas com aposição de ressalvas.');
  assert.equal(conclusaoNoResumo('Exercício de 2020. Proposta de Parecer Prévio pela Regularidade com Ressalva.'), null);
  assert.equal(conclusaoNoResumo('Porecatu - exercício de 2021 - Instrução da CGM. Pela Regularidade das Contas.'), 'Pela Regularidade das Contas.');
  assert.equal(conclusaoNoResumo(''), null);
  assert.equal(conclusaoNoResumo('Ressalva > Regularidade'), null);
});

const PDF_FIM = `PCA 2024 | MUNICÍPIO DE SIQUEIRA CAMPOS | Deliberação
DOCUMENTO E ASSINATURA(S) DIGITAIS
48
5. Deliberação
Decidem os membros da Primeira Câmara do TRIBUNAL DE CONTAS DO ESTADO DO PARANÁ, nos
termos do voto do Relator, Conselheiro JOSE DURVAL MATTOS DO AMARAL, por unanimidade:
a. Emitir Parecer Prévio pela REGULARIDADE das contas do senhor FULANO,
na qualidade de prefeito do MUNICÍPIO DE SIQUEIRA CAMPOS, relativas ao exercício de
2024.
b. RESSALVAR, nesse momento, as contas em virtude do:
i. desempenho na área da Previdência Social.
Após o trânsito em julgado da deliberação, encaminhem-se os autos.
Votaram, nos termos acima, os Conselheiros FULANO e BELTRANO.`;

teste('deliberação do PDF (prefeito)', () => {
  const d = lerDeliberacao(PDF_FIM, 800);
  assert.equal(d.votacao, 'por unanimidade');
  assert.equal(d.conclusao, 'Parecer Prévio pela REGULARIDADE');
  assert.match(d.item_parecer, /^Emitir Parecer Prévio pela REGULARIDADE .* relativas ao exercício de 2024\.$/);
  assert.deepEqual(d.exercicio, { ano: 2024, trecho: 'exercício de 2024' });
  assert.ok(!/Votaram/.test(d.deliberacao));
  assert.ok(!/DOCUMENTO E ASSINATURA/.test(d.deliberacao));
  assert.equal(lerDeliberacao('texto sem deliberação'), null);
});

teste('deliberação com quebra de página entre "ACORDAM" e "os membros" e itens em romanos', () => {
  const t = `VISTOS, relatados e discutidos, ACORDAM
1 Fonte: CGM. Instrução n. 2876/2023.
DOCUMENTO E ASSINATURA(S) DIGITAIS
TRIBUNAL DE CONTAS DO ESTADO DO PARANÁ
Os membros da Primeira Câmara, nos termos do voto do Relator, por unanimidade, em:
I – Emitir Parecer Prévio recomendando a regularidade da Prestação de Contas Anual do Prefeito Municipal de VERÊ, relativas ao exercício financeiro de 2020. II – encaminhar à CMEX.`;
  const d = lerDeliberacao(t);
  assert.equal(d.votacao, 'por unanimidade');
  assert.equal(d.conclusao, 'Parecer Prévio recomendando a regularidade');
  assert.match(d.item_parecer, /exercício financeiro de 2020\.$/);
  assert.equal(d.exercicio.ano, 2020);
});

teste('"Emitir parecer prévio:" com a conclusão no subitem seguinte', () => {
  const d = lerDeliberacao('ACORDAM os membros da Segunda Câmara, por unanimidade, em: I. Emitir parecer prévio: a) pela regularidade das contas do Município de X, exercício de 2018. II. Arquivar.');
  assert.equal(d.item_parecer, 'Emitir parecer prévio: a) pela regularidade das contas do Município de X, exercício de 2018.');
  assert.equal(d.exercicio.ano, 2018);
  const e = lerDeliberacao('ACORDAM os membros da Primeira Câmara, por unanimidade, em: I – Emitir, com fundamento no art. 1º, I, da Lei Complementar Estadual nº 113/2005, parecer prévio deste Tribunal recomendando o julgamento pela irregularidade das contas do Município de Y, exercício de 2019. II – Arquivar.');
  assert.equal(e.conclusao, 'parecer prévio deste Tribunal recomendando o julgamento pela irregularidade');
});

const GOV_FIM = `VISTOS, relatados e discutidos, ACORDAM OS MEMBROS DO TRIBUNAL PLENO do TRIBUNAL DE CONTAS DO ESTADO DO PARANÁ, nos termos do voto do Relator, por maioria absoluta, em:
Emitir parecer prévio pela regularidade das contas do Poder Executivo do Estado do Paraná, referentes ao exercício de 2023, com aposição de ressalvas, nos termos a seguir: RESSALVAS:
TRIBUNAL DE CONTAS DO ESTADO DO PARANÁ
1. Incompatibilidade entre valores; 2. Inadequação da metodologia. DETERMINAÇÕES: 1. Elaborar e publicar o demonstrativo; RECOMENDAÇÕES: 1. Divulgar Notas Explicativas;`;

teste('deliberação do PDF (governador) e seções numeradas', () => {
  const d = lerDeliberacao(GOV_FIM, 20000);
  assert.equal(d.votacao, 'por maioria absoluta');
  assert.equal(d.conclusao, 'parecer prévio pela regularidade');
  assert.match(d.item_parecer, /nos termos a seguir:$/);
  assert.equal(d.exercicio.ano, 2023);
  const s = secoesDeliberacao(d.deliberacao);
  assert.deepEqual(s.map((x) => `${x.grupo} ${x.numero}`), ['RESSALVAS 1', 'RESSALVAS 2', 'DETERMINAÇÕES 1', 'RECOMENDAÇÕES 1']);
  assert.equal(s[0].texto, 'Incompatibilidade entre valores');
});

const fonteCsv = { titulo: 'Acórdãos 2026', url: 'https://viajuris.tce.pr.gov.br/x.csv', orgao: 'TCE-PR', acessado_em: '2026-11-05' };
const mun = { id: 'siqueira-campos', nome: 'Siqueira Campos', codigo_ibge: '4126306' };
const reg = (o) => Object.fromEntries(COLUNAS.map((c) => [c, String(o[c] ?? '').replace(/^"|"$/g, '').trim()]));

teste('item: sem PDF lido, conclusão nula e lacuna; com PDF, texto literal', () => {
  const it = montarItem(reg(r1), { contasDe: 'Prefeito de Siqueira Campos', tituloContas: 'contas do Prefeito de Siqueira Campos', fonteCsv, anoCsv: 2026 });
  assert.equal(it.id, 'tce-pr-parecer-2026-2-000200509');
  assert.equal(chaveDoAto(reg(r1)), '2026-2-000200509');
  assert.equal(it.indexacao_literal, 'Ressalva > Regularidade');
  assert.ok(!('DsInteressado' in it) && !JSON.stringify(it).includes('FULANO'));
  consolidar(it, { casaPolitica: 'Câmara Municipal de Siqueira Campos' });
  assert.equal(it.parecer.conclusao, null);
  assert.equal(it.parecer.exercicio, '2024');
  assert.ok(it.lacunas.some((l) => /ainda não lido/.test(l)));
  it.leitura_pdf = { situacao: 'lido', versao: VERSAO_LEITURA, ...lerDeliberacao(PDF_FIM) };
  consolidar(it, { casaPolitica: 'Câmara Municipal de Siqueira Campos' });
  assert.equal(it.parecer.conclusao, 'Parecer Prévio pela REGULARIDADE');
  assert.equal(it.votacao_literal, 'por unanimidade');
  assert.ok(!it.lacunas.some((l) => /ainda não lido|votação/.test(l)));
});

teste('item: exercício divergente e exercício ≥ ano da sessão viram lacuna', () => {
  const it = montarItem(reg({ ...r1, DsTema: 'exercício de 2026' }), { contasDe: 'x', tituloContas: 'x', fonteCsv, anoCsv: 2026 });
  consolidar(it, { casaPolitica: 'Câmara' });
  assert.ok(it.lacunas.some((l) => /igual ou posterior ao ano da sessão/.test(l)));
  it.leitura_pdf = { situacao: 'lido', ...lerDeliberacao(PDF_FIM) };
  consolidar(it, { casaPolitica: 'Câmara' });
  assert.equal(it.parecer.exercicio, '2024');
  assert.ok(it.lacunas.some((l) => /a deliberação do PDF diz/.test(l)));
});

teste('mesclagem incremental e herança da leitura do PDF', () => {
  const novo = (r, ano) => montarItem(reg(r), { contasDe: 'x', tituloContas: 'x', fonteCsv, anoCsv: ano });
  const velho2024 = novo({ ...r1, UrlPDF: 'https://viajuris.tce.pr.gov.br/Arquivos/2024/1/1.pdf' }, 2024);
  const velho2026 = novo(r1, 2026);
  velho2026.leitura_pdf = { situacao: 'lido', item_parecer: 'Emitir…' };
  const removido = novo({ ...r1, UrlPDF: 'https://viajuris.tce.pr.gov.br/Arquivos/2026/9/9.pdf' }, 2026);
  const out = mesclar([velho2024, velho2026, removido], [novo(r1, 2026)], new Set([2026]));
  assert.deepEqual(out.map((i) => i.id).sort(), [velho2024.id, velho2026.id].sort());
  assert.equal(out.find((i) => i.id === velho2026.id).leitura_pdf.situacao, 'lido');
  const semDelib = novo(r1, 2026);
  assert.equal(herdarLeitura(semDelib, { ...velho2026, leitura_pdf: { situacao: 'sem_deliberacao', versao: VERSAO_LEITURA - 1 } }).leitura_pdf, null);
});

teste('arquivo do município: itens sem exercício separados, contagens', () => {
  const porNome = new Map([[chaveNome(mun.nome), mun]]);
  assert.equal(casarMunicipio('MUNICIPIO DE SIQUEIRA CAMPOS', porNome), mun);
  assert.equal(casarMunicipio('MUNICÍPIO DE SIQUEIRA CAMPO', porNome), null);
  const a = montarItem(reg(r1), { contasDe: 'Prefeito de Siqueira Campos', tituloContas: 'contas', fonteCsv, anoCsv: 2026 });
  const b = montarItem(reg(r2), { contasDe: 'Prefeito de Siqueira Campos', tituloContas: 'contas', fonteCsv, anoCsv: 2026 });
  const arq = montarArquivoMunicipio(mun, [a, b], [], [{ ...fonteCsv, ano: 2026 }]);
  assert.equal(arq.itens.length, 1);
  assert.equal(arq.itens_sem_exercicio.length, 1);
  assert.equal(arq.contagens.pareceres, 2);
  assert.equal(arq.municipio.uf, 'PR');
  assert.ok(arq.itens.every((i) => typeof i.parecer.exercicio === 'string'));
  assert.equal(arq.fontes[0].ano, undefined);
});

teste('gravação atômica sem regravar conteúdo igual', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcepr-teste-'));
  try {
    const arq = path.join(dir, 'x.json');
    assert.equal(gravarSeMudou(arq, { a: 1, atualizado_em: '1' }), true);
    assert.equal(gravarSeMudou(arq, { a: 1, atualizado_em: '2' }), false);
    assert.equal(gravarSeMudou(arq, { a: 2 }), true);
    assert.deepEqual(fs.readdirSync(dir), ['x.json']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

console.log(`${ok} testes passaram${process.exitCode ? ' (com falhas acima)' : ''}`);
