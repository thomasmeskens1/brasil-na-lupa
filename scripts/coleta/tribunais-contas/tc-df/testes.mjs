#!/usr/bin/env node
// Testes do coletor do TC-DF (sem rede): node scripts/coleta/tribunais-contas/tc-df/testes.mjs
// Fixtures: trechos literais do texto (pdftotext) das atas das Sessões Especiais nos PDFs oficiais de 2024, 2019 e 2009
// e páginas reais da API do WordPress do site do TCDF (só os campos usados). Confere também os arquivos gerados, se houver.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { interpretarRobots, caminhoPermitido, gravarSeMudou, AQUI, SAIDA } from './lib.mjs';
import { lerAta, limpar, dataBr, conclusaoCurta, itensDeLetra, textoLegivel } from './ata.mjs';
import { lerTitulo, lerPost, exerciciosDosPosts, documentosDaPagina } from './paginas.mjs';
import { montarItem, motivoNaoPublicar } from './item.mjs';

let ok = 0;
function teste(nome, f) {
  try { f(); ok++; } catch (e) { console.error(`FALHOU: ${nome}\n${e.stack}`); process.exitCode = 1; }
}
const fixture = (n) => fs.readFileSync(path.join(AQUI, 'fixtures', n), 'utf8');
const posts = JSON.parse(fixture('posts.json'));

teste('robots.txt', () => {
  const r = interpretarRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\nCrawl-delay: 5\n');
  assert.equal(caminhoPermitido(r.regras, '/wp-json/wp/v2/posts'), true);
  assert.equal(caminhoPermitido(r.regras, '/wp-admin/x'), false);
  assert.equal(caminhoPermitido(r.regras, '/wp-admin/admin-ajax.php'), true);
  assert.equal(r.crawlDelayS, 5);
  assert.equal(caminhoPermitido(interpretarRobots('User-agent: *\nDisallow: /\n').regras, '/qualquer'), false);
  assert.equal(caminhoPermitido(interpretarRobots('User-agent: *\nDisallow:\n').regras, '/qualquer'), true);
});

teste('títulos das páginas', () => {
  assert.deepEqual(lerTitulo('Contas de Governo 2024 &#8211; Relatora Anilcéia Luzia Machado'), { exercicio: '2024', titulo_literal: 'Contas de Governo 2024 – Relatora Anilcéia Luzia Machado', relator: 'Anilcéia Luzia Machado' });
  assert.equal(lerTitulo('Contas de Governo 2009 – Relator Manoel Paulo de Andrade Neto *').relator, 'Manoel Paulo de Andrade Neto');
  assert.equal(lerTitulo('Contas de Governo 1961 &#8211; Relator &#8211;').relator, null);
  assert.equal(lerTitulo('TCDF aprova com ressalvas as Contas de Governo de 2017'), null);
  assert.equal(lerTitulo('Contas de Governo de 2018 são aprovadas com ressalvas pelo TCDF'), null);
});

teste('documentos da página', () => {
  const p2019 = lerPost(posts.find((p) => p.id === 2487986));
  assert.equal(p2019.exercicio, '2019');
  assert.match(p2019.rapp.url, /RAPP2019/);
  assert.equal(p2019.rapp.titulo, 'Contas de Governo 2019');
  assert.deepEqual(p2019.documentos.map((d) => d.tipo).sort(), ['decreto-legislativo', 'relatorio']);
  const p2008 = lerPost(posts.find((p) => p.id === 2463276));
  assert.match(p2008.rapp.url, /contas2008\.pdf$/);
  assert.ok(p2008.documentos.some((d) => d.tipo === 'versao-simplificada'));
  const p2009 = lerPost(posts.find((p) => p.id === 2463183));
  assert.match(p2009.sobrestado, /sobrestado no TCDF/);
  // Sem link "Contas de Governo AAAA" e com dois relatórios possíveis: nenhum é escolhido.
  assert.equal(documentosDaPagina('<a href="https://x/a.pdf">a</a><a href="https://x/b.pdf">b</a>', '2020').rapp, null);
  const { porAno, ignorados } = exerciciosDosPosts([...posts, { id: 1, title: { rendered: 'Notícia qualquer' }, content: { rendered: '' } }]);
  assert.equal(porAno.size, 4);
  assert.deepEqual(ignorados, ['Notícia qualquer']);
});

teste('datas e limpeza', () => {
  assert.equal(dataBr('26/11/2025'), '2025-11-26');
  assert.equal(dataBr('23.03.2011'), '2011-03-23');
  assert.equal(dataBr('32/01/2020'), null);
  assert.equal(limpar('linha um\nDocumento assinado digitalmente. Para verificar as assinaturas, acesse ...\n425\ne-DOC 87FFDC08 Proc 00600-00000689/2024-80-e\nlinha dois'), 'linha um linha dois');
  assert.equal(textoLegivel('\f\f\f  \f'), false);
});

teste('ata de 2024: decisão transcrita', () => {
  const a = lerAta(fixture('ata-2024.txt'));
  assert.equal(a.exercicio, '2024');
  assert.equal(a.votacao, 'por unanimidade');
  assert.deepEqual(a.sessao, { numero: '550', data: '2025-11-26', literal: 'Sessão Especial nº 550, realizada em 26/11/2025' });
  assert.equal(a.ato.numero, '1/2025');
  assert.equal(a.ato.processo, '00600-00000689/2024-80');
  assert.equal(a.ato.relator_literal, 'Conselheira ANILCÉIA LUZIA MACHADO');
  assert.match(a.parecer, /^é de PARECER que: I\. as Contas apresentadas pelo Governo do Distrito Federal pertinentes ao exercício de 2024/);
  assert.match(a.parecer, /estão tecnicamente aptas a receber aprovação da Câmara Legislativa do Distrito Federal – CLDF, com as seguintes ressalvas e determinação$/);
  assert.equal(a.conclusao, 'aprovação');
  assert.equal(a.com_ressalvas, true);
  assert.equal(a.ressalvas.length, 4);
  assert.match(a.ressalvas[0], /^a\) quanto à administração financeira e orçamentária: i\. superestimativa/);
  assert.match(a.ressalvas[3], /^d\) quanto à gestão das políticas públicas/);
  assert.deepEqual(a.determinacoes, ['providenciar solução para as ressalvas apontadas.']);
  assert.deepEqual(a.responsaveis, ['Ibaneis Rocha Barros Júnior']);
  assert.match(a.proclamacao, /^Colhidos os votos dos Senhores Conselheiros, que se manifestaram, por unanimidade/);
});

teste('ata de 2019: proclamação sem transcrição do parecer', () => {
  const a = lerAta(fixture('ata-2019.txt'));
  assert.equal(a.exercicio, '2019');
  assert.equal(a.decisao, null);
  assert.equal(a.parecer, null);
  assert.equal(a.conclusao_literal, null);
  assert.equal(a.conclusao, null);
  assert.equal(a.votacao, 'por unanimidade');
  assert.match(a.proclamacao, /a DECISÃO, por unanimidade, consubstanciada na aprovação do Parecer Prévio/);
});

teste('ata de 2009: conclusão só na frase dos votos, sem rótulo curto', () => {
  const a = lerAta(fixture('ata-2009.txt'));
  assert.equal(a.exercicio, '2009');
  assert.equal(a.conclusao_fonte, 'votos');
  assert.match(a.conclusao_literal, /não estão tecnicamente aptas para merecer, deste Tribunal de Contas, parecer favorável à aprovação/);
  assert.equal(a.conclusao, null); // "não estão tecnicamente aptas" não vira rótulo: vale o texto literal
  assert.equal(a.votacao, 'por maioria');
  assert.deepEqual(a.sessao, { numero: '515', data: '2011-03-23', literal: 'ATA DA SESSÃO ESPECIAL Nº 515, DE 23.03.2011' });
});

teste('conclusão curta só com redação literal conhecida', () => {
  assert.deepEqual(conclusaoCurta('as Contas ... estão tecnicamente aptas a receber aprovação da Câmara Legislativa do Distrito Federal'), { conclusao: 'aprovação', com_ressalvas: false });
  assert.deepEqual(conclusaoCurta('as contas não estão tecnicamente aptas a receber aprovação'), { conclusao: null, com_ressalvas: null });
  assert.deepEqual(conclusaoCurta('parecer pela rejeição das contas'), { conclusao: null, com_ressalvas: null });
  assert.deepEqual(itensDeLetra('a) quanto à x: i. um; ii. dois; b) quanto à y: i. três'), ['a) quanto à x: i. um; ii. dois', 'b) quanto à y: i. três']);
});

teste('registro do exercício e regras de publicação', () => {
  const pagina = lerPost(posts.find((p) => p.id === 2496214));
  const leitura = { url: pagina.rapp.url, situacao: 'lido', versao: 1, lido_em: '2026-11-06', sha256: 'x', bytes: 1, paginas: 486, ata: lerAta(fixture('ata-2024.txt')) };
  assert.equal(motivoNaoPublicar(pagina, leitura), null);
  assert.match(motivoNaoPublicar(pagina, null), /ainda não lido/);
  assert.match(motivoNaoPublicar(pagina, { ...leitura, situacao: 'ilegivel' }), /digitalizado/);
  assert.match(motivoNaoPublicar(pagina, { ...leitura, ata: { ...leitura.ata, exercicio: '2023' } }), /diferente do título/);
  assert.match(motivoNaoPublicar(pagina, { ...leitura, ata: { ...leitura.ata, sessao: null, ato: null } }), /data da Sessão Especial/);
  const it = montarItem(pagina, leitura, 'https://www2.tc.df.gov.br/wp-json/wp/v2/posts/2496214');
  assert.equal(it.id, 'tc-df-contas-governador-2024');
  assert.equal(it.parecer.exercicio, '2024');
  assert.equal(it.data_julgamento, '2025-11-26');
  assert.equal(it.processo.numero, '00600-00000689/2024-80');
  assert.equal(it.relator, 'Anilcéia Luzia Machado');
  assert.equal(it.votacao_literal, 'por unanimidade');
  assert.equal(it.parecer.documento.url, pagina.rapp.url);
  assert.ok(it.lacunas.some((l) => /Câmara Legislativa do Distrito Federal/.test(l)));
  assert.ok(!JSON.stringify(it).match(/analista/i));
});

teste('gravação só com mudança', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcdf-teste-'));
  try {
    const arq = path.join(dir, 'x.json');
    assert.equal(gravarSeMudou(arq, { a: 1, atualizado_em: '1' }), true);
    assert.equal(gravarSeMudou(arq, { a: 1, atualizado_em: '2' }), false);
    assert.equal(gravarSeMudou(arq, { a: 2, atualizado_em: '2' }), true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Arquivos gerados pela coleta (se existirem): contrato mínimo lido pelo site.
const dirGov = path.join(SAIDA, 'contas-governador');
if (fs.existsSync(dirGov)) {
  teste('arquivos gerados', () => {
    const arqs = fs.readdirSync(dirGov).filter((n) => /^\d{4}\.json$/.test(n));
    assert.ok(arqs.length > 0);
    for (const n of arqs) {
      const it = JSON.parse(fs.readFileSync(path.join(dirGov, n), 'utf8'));
      assert.equal(it.parecer.exercicio, n.slice(0, 4), n);
      assert.equal(it.id, `tc-df-contas-governador-${n.slice(0, 4)}`);
      assert.ok(it.data_julgamento && /^\d{4}-\d{2}-\d{2}$/.test(it.data_julgamento), n);
      assert.ok(it.fontes.length && it.fontes.every((f) => /^https:\/\/www2\.tc\.df\.gov\.br\//.test(f.url)), n);
      assert.ok(Array.isArray(it.lacunas) && Array.isArray(it.parecer.ressalvas), n);
      if (it.parecer.conclusao) assert.match(it.parecer.conclusao_literal, /tecnicamente aptas? (a|para) receber aprova/, n);
      assert.ok(fs.statSync(path.join(dirGov, n)).size < 200000, `${n} grande demais`);
    }
    const meta = JSON.parse(fs.readFileSync(path.join(SAIDA, 'meta.json'), 'utf8'));
    assert.equal(meta.tribunal, 'tc-df');
    assert.ok(Array.isArray(meta.robots_e_restricoes) && meta.robots_e_restricoes.length);
  });
}

console.log(`${ok} teste(s) ok${process.exitCode ? ' (com falhas)' : ''}`);
