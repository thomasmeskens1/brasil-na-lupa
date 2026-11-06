#!/usr/bin/env node
// Testes do coletor do TCM-PA (sem rede): node scripts/coleta/tribunais-contas/tcm-pa/testes.mjs
// Usa fixtures/edicao.txt (trechos no formato do Diário Oficial Eletrônico, com nomes e CPF fictícios)
// e confere, se existirem, os arquivos gerados em dados/tribunais-contas/tcm-pa/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lerRobots, caminhoPermitido, AQUI, SAIDA } from './lib.mjs';
import { lerPaginaLista } from './edicoes.mjs';
import { pareceresDaEdicao, semCpf, dataSessao, limparLinhas } from './parecer.mjs';
import { carregarMunicipiosPA, casarMunicipio, montarItem, preferir, montarArquivoMunicipio } from './municipios.mjs';

let ok = 0;
function teste(nome, f) {
  try { f(); ok++; } catch (e) { console.error(`FALHOU: ${nome}\n${e.stack}`); process.exitCode = 1; }
}

const CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/;

teste('robots.txt', () => {
  const texto = 'User-agent: *\nContent-Signal: search=yes,ai-train=no,use=reference\nAllow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n';
  const r = lerRobots(texto);
  assert.equal(r.sinal, 'search=yes,ai-train=no,use=reference');
  assert.equal(caminhoPermitido(r, '/doe/doe/doe?Doe_page=2'), true);
  assert.equal(caminhoPermitido(lerRobots('User-agent: *\nDisallow: /doe/\n'), '/doe/doedocs/x.pdf'), false);
  assert.equal(caminhoPermitido(lerRobots('User-agent: BrasilNaLupa-coletor\nDisallow: /\n\nUser-agent: *\nAllow: /\n'), '/'), false);
});

teste('lista de edições', () => {
  const html = `<div class="summary">Exibindo 1-3 de 2343 resultados.</div><table><tbody>
<tr class="odd"><td>2150</td><td>Ano IX, nº 2150</td><td>23/03/2026</td><td><a href="/doe/doedocs/Diário Oficial-2150-2026.pdf">Diário Oficial-2150-2026.pdf</a></td></tr>
<tr class="even"><td>512</td><td>Edição nº 512</td><td>26/03/2019</td><td><a href="/doe/doedocs/Ano_II_512.pdf">Ano_II_512.pdf</a></td></tr>
<tr class="odd"><td>212/2016</td><td>Diário Eletrônico nº 212/2016</td><td>05/12/2016</td><td><a href="/doe/doedocs/Diario_Eletronico_05122016.pdf">x.pdf</a></td></tr>
</tbody></table>`;
  const r = lerPaginaLista(html);
  assert.equal(r.total, 2343);
  assert.equal(r.linhas.length, 3);
  assert.deepEqual(r.linhas.map((l) => l.oficial), [true, true, false]);
  assert.equal(r.linhas[0].numero, '2150');
  assert.equal(r.linhas[0].data, '2026-03-23');
  assert.equal(r.linhas[0].url, 'https://www.tcmpa.tc.br/doe/doedocs/Di%C3%A1rio%20Oficial-2150-2026.pdf');
  assert.equal(r.linhas[1].numero, '512');
});

teste('CPF retirado e ruído de página', () => {
  assert.equal(semCpf('Sr. Fulano (CPF: 111.222.333-44), exercício'), 'Sr. Fulano, exercício');
  assert.equal(semCpf('Interessado: Fulano – CPF: 111.222.333-44'), 'Interessado: Fulano –');
  assert.ok(!CPF.test(semCpf('CPF nº 111.222.333-44 e 555.666.777-88')));
  assert.deepEqual(limparLinhas('Oficial Eletrônico do TCMPA Nº 500  2\n@tcmpa\nPA\nMUNICÍPIO: AFUÁ'), ['MUNICÍPIO: AFUÁ']);
});

teste('data da sessão', () => {
  assert.deepEqual(dataSessao('Sala das Sessões do Pleno, em 23 de outubro de 2025.'), { data: '2025-10-23', literal: '23 de outubro de 2025' });
  assert.equal(dataSessao('Sala das Sessões do Pleno, de 10 a 14 de fevereiro de 2025.').data, null);
  assert.equal(dataSessao('Sessão Virtual do Pleno. Belém-PA, 09 de fevereiro de 2026.').data, '2026-02-09');
  assert.equal(dataSessao('sem fecho'), null);
});

const fixture = fs.readFileSync(path.join(AQUI, 'fixtures', 'edicao.txt'), 'utf8');
const { pareceres, descartes } = pareceresDaEdicao(fixture);
const por = Object.fromEntries(pareceres.map((p) => [p.numero, p]));

teste('resoluções reconhecidas na edição', () => {
  assert.deepEqual(pareceres.map((p) => p.numero).sort(), ['14386', '14402', '15532', '16001', '16637', '17183']);
  assert.equal(por['15555'], undefined, 'contas do instituto de previdência não entram');
  assert.equal(Object.values(descartes).reduce((a, b) => a + b, 0), 0);
});

teste('formato de 2019 (cabeçalho em maiúsculas)', () => {
  const p = por['14386'];
  assert.equal(p.municipio_literal, 'BREU BRANCO');
  assert.equal(p.exercicio, '2008');
  assert.equal(p.data_resolucao, '2018-12-12');
  assert.equal(p.processo, '1110012008-00');
  assert.equal(p.relator, 'CONSELHEIRO SEBASTIÃO CEZAR LEÃO COLARES');
  assert.equal(p.conclusao, 'PARECER PRÉVIO FAVORÁVEL Á APROVAÇÃO COM RESSALVA');
  assert.match(p.conclusao_literal, /^I – EMITIR Parecer Prévio recomendando à Câmara Municipal de BREU BRANCO, a APROVAÇÃO COM RESSALVA das contas de GOVERNO da PREFEITURA MUNICIPAL, exercício financeiro de 2008/);
  assert.ok(!/II –/.test(p.conclusao_literal));
  assert.equal(p.recurso, false);
  assert.equal(p.citacao, false);
});

teste('recurso que mantém o parecer prévio', () => {
  const p = por['14402'];
  assert.equal(p.recurso, true);
  assert.equal(p.exercicio, '1998');
  assert.equal(p.municipio_literal, 'BREJO GRANDE DO ARAGUAIA');
  assert.match(p.conclusao, /^Parecer Prévio pela NÃO APROVAÇÃO/);
  assert.match(p.conclusao_literal, /^II – DAR PROVIMENTO PARCIAL/);
});

teste('formato de 2020 (rótulos em minúsculas)', () => {
  const p = por['15532'];
  assert.equal(p.municipio_literal, 'Canaã dos Carajás');
  assert.equal(p.exercicio, '2016');
  assert.equal(p.relator, 'Conselheira Mara Lúcia');
  assert.equal(p.processo, '134001.2016.1.000');
  assert.equal(p.conclusao, 'PARECER PRÉVIO RECOMENDANDO A REGULARIDADE DAS CONTAS');
  assert.match(p.conclusao_literal, /^Pela emissão de parecer prévio recomendando à Câmara do Município a aprovação/);
});

teste('transcrição "in verbis", sessão virtual e CPF', () => {
  const p = por['17183'];
  assert.equal(p.citacao, true);
  assert.equal(p.exercicio, '2018');
  assert.equal(p.data_resolucao, null);
  assert.equal(p.sessao_literal, 'de 10 a 14 de fevereiro de 2025');
  assert.equal(p.data_sessao, null);
  assert.equal(p.conclusao, 'PARECER PRÉVIO CONTRÁRIO À APROVAÇÃO DAS CONTAS');
  assert.match(p.conclusao_literal, /que sejam REPROVADAS/);
  assert.ok(!CPF.test(JSON.stringify(p)));
});

teste('decisão sem o rótulo "DECISÃO:" e rótulos com "(a)"', () => {
  const p = por['16637'];
  assert.equal(p.municipio_literal, 'Marabá');
  assert.equal(p.municipio_origem, 'unidade "Prefeitura Municipal de ..."');
  assert.equal(p.exercicio, '2022');
  assert.equal(p.relator, 'Conselheiro(a) Mara Lúcia');
  assert.equal(p.processo, '042001.2022.1.000');
  assert.equal(p.conclusao, 'PARECER PRÉVIO RECOMENDANDO A APROVAÇÃO COM RESSALVA, DAS CONTAS');
  assert.match(p.conclusao_literal, /^pela emissão de Parecer Prévio recomendando à Câmara do Município a aprovação, com ressalva, das contas da Prefeitura Municipal de Marabá, exercício de 2022, sem o prejuízo do recolhimento de multa, com fundamento na LC N\.° 109\/2016$/);
});

teste('sem exercício escrito', () => {
  const p = por['16001'];
  assert.equal(p.exercicio, null);
  assert.equal(p.motivo_sem_exercicio, 'exercício não escrito na resolução');
});

const municipios = carregarMunicipiosPA();

teste('casamento exato com a lista oficial', () => {
  assert.equal(municipios.lista.length, 144);
  assert.equal(casarMunicipio('Canaã dos Carajás', municipios.porNome)?.id, 'canaa-dos-carajas');
  assert.equal(casarMunicipio('BREU BRANCO', municipios.porNome)?.codigo_ibge, '1501782');
  assert.equal(casarMunicipio('CIDADE DE TESTE DO NORTE', municipios.porNome), null);
  assert.equal(casarMunicipio('Breu', municipios.porNome), null);
  assert.equal(casarMunicipio('Tomé Açu', municipios.porNome)?.id, 'tome-acu');
  assert.equal(casarMunicipio('Pau D’ Arco', municipios.porNome)?.id, 'pau-darco');
  assert.equal(casarMunicipio('Redenção do Pará', municipios.porNome), null, 'nome diferente do oficial não casa');
});

teste('item e arquivo do município', () => {
  const mun = casarMunicipio('Rondon do Pará', municipios.porNome);
  const ed = { titulo: 'Ano IX, nº 2148', data: '2026-03-19', url: 'https://www.tcmpa.tc.br/doe/doedocs/do-2148-2026.pdf', lido_em: '2026-11-06' };
  const it = montarItem(por['17183'], mun, ed);
  assert.equal(it.id, 'tcm-pa-resolucao-17183');
  assert.equal(it.parecer.exercicio, '2018');
  assert.equal(it.parecer.contas_de, 'Prefeito de Rondon do Pará');
  assert.equal(it.data_julgamento, null);
  assert.equal(it.data_publicacao, '2026-03-19');
  assert.equal(it.publicacao.transcricao, true);
  assert.ok(it.lacunas.some((l) => l.includes('de 10 a 14 de fevereiro de 2025')));
  const proprio = { ...it, publicacao: { ...it.publicacao, transcricao: false, data: '2025-03-11' } };
  assert.equal(preferir(it, proprio), proprio);
  assert.equal(preferir(proprio, it), proprio);
  const arq = montarArquivoMunicipio(mun, [it], 'de 18/01/2019 a 23/03/2026');
  assert.equal(arq.municipio.codigo_ibge, mun.codigo_ibge);
  assert.equal(arq.contagens.exercicios, 1);
  assert.ok(!CPF.test(JSON.stringify(arq)));
});

teste('arquivos gerados (se existirem)', () => {
  const dir = path.join(SAIDA, 'contas-prefeitos');
  if (!fs.existsSync(dir)) return;
  const ids = new Set(municipios.lista.map((m) => m.id));
  for (const n of fs.readdirSync(dir)) {
    const texto = fs.readFileSync(path.join(dir, n), 'utf8');
    const d = JSON.parse(texto);
    assert.ok(ids.has(d.municipio.id), `município fora da lista: ${n}`);
    assert.equal(`${d.municipio.id}.json`, n);
    assert.ok(!CPF.test(texto), `CPF em ${n}`);
    assert.ok(Buffer.byteLength(texto) < 2e6, `arquivo grande demais: ${n}`);
    for (const it of d.itens) {
      assert.match(it.parecer.exercicio, /^\d{4}$/, `${n}: item sem exercício`);
      assert.ok(it.parecer.documento?.url?.startsWith('https://www.tcmpa.tc.br/doe/'), `${n}: link oficial`);
      assert.ok(it.parecer.conclusao || it.parecer.conclusao_literal, `${n}: sem conclusão`);
    }
  }
  const meta = JSON.parse(fs.readFileSync(path.join(SAIDA, 'meta.json'), 'utf8'));
  assert.equal(meta.tribunal, 'tcm-pa');
  assert.ok(!CPF.test(JSON.stringify(meta)), 'CPF no meta.json');
});

console.log(`${ok} testes ok`);
