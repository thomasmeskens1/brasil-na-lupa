#!/usr/bin/env node
// Testes do coletor do TCE-PE (sem rede): node scripts/coleta/tribunais-contas/tce-pe/testes.mjs
// Usa a fixture fixtures/resultados.json (registros reais da API, com um registro municipal fictício marcado "DE TESTE")
// e confere, se existirem, os arquivos gerados em dados/tribunais-contas/tce-pe/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { interpretarRobots, caminhoPermitido, decodificar, codificarLatin1, lerResposta, slug, gravarSeMudou, AQUI, SAIDA } from './lib.mjs';
import { normalizarRegistro, agruparPorProcesso, resumirProcesso } from './parecer.mjs';
import { montarExercicioGovernador, numeroDoLink } from './governador.mjs';
import { itemMunicipio, montarArquivoMunicipio, municipiosDosRegistros } from './prefeitos.mjs';

let ok = 0;
function teste(nome, f) {
  try { f(); ok++; } catch (e) { console.error(`FALHOU: ${nome}\n${e.stack}`); process.exitCode = 1; }
}

const bruto = fs.readFileSync(path.join(AQUI, 'fixtures', 'resultados.json'), 'utf8');
const regs = lerResposta(bruto, 'Resultados').map(normalizarRegistro);
const URL = 'https://sistemas.tcepe.tc.br/DadosAbertos/Resultados!json?teste';

teste('robots.txt', () => {
  const r = interpretarRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /DadosAbertos/Privado\nAllow: /DadosAbertos/Privado/ok\n');
  assert.equal(caminhoPermitido(r, '/DadosAbertos/Resultados!json'), true);
  assert.equal(caminhoPermitido(r, '/DadosAbertos/Privado/x'), false);
  assert.equal(caminhoPermitido(r, '/DadosAbertos/Privado/ok'), true);
  assert.equal(caminhoPermitido(interpretarRobots('User-agent: *\nDisallow: /\n'), '/qualquer'), false);
  assert.equal(caminhoPermitido(interpretarRobots('User-agent: *\nDisallow:\n'), '/qualquer'), true);
});

teste('ISO-8859-1', () => {
  const buf = Buffer.from('{"a":"Prestação de Contas — Rejeição"}'.replace('—', '-'), 'latin1');
  assert.equal(JSON.parse(decodificar(buf, 'application/json;charset=ISO-8859-1')).a, 'Prestação de Contas - Rejeição');
  assert.equal(codificarLatin1('Prestação de Contas'), 'Presta%E7%E3o%20de%20Contas');
  assert.equal(codificarLatin1(2023), '2023');
});

teste('envelope da API', () => {
  assert.throws(() => lerResposta('{"resposta":{"status":"ERRO"}}', 'X'));
  assert.throws(() => lerResposta('<html>', 'X'));
  assert.throws(() => lerResposta('{"resposta":{"status":"OK","tamanhoResultado":"10","limiteResultado":"10","conteudo":[]}}', 'X'));
});

teste('slug', () => {
  assert.equal(slug('Belém de São Francisco'), 'belem-de-sao-francisco');
  assert.equal(slug('Vertente do Lério'), 'vertente-do-lerio');
  assert.equal(slug("Ilha de Itamaracá"), 'ilha-de-itamaraca');
});

teste('agrupamento e divergência', () => {
  const g = agruparPorProcesso(regs.filter((r) => r.exercicio === 2014));
  assert.equal(g.size, 1);
  const r = resumirProcesso([...g.values()][0]);
  assert.deepEqual(r.responsaveis, ['Eduardo Henrique Accioly Campos', 'João Soares Lyra Neto']);
  assert.equal(r.resultado, 'Aprovação');
  const div = resumirProcesso([regs[0], { ...regs[1], resultado: 'Rejeição' }]);
  assert.equal(div.resultado, null);
  assert.match(div.lacunas[0], /valores diferentes para o resultado/);
});

teste('governador com parecer', () => {
  const it = montarExercicioGovernador(2021, regs, URL);
  assert.equal(it.id, 'tce-pe-contas-governador-2021');
  assert.equal(it.parecer.conclusao, 'Aprovação com ressalvas');
  assert.equal(it.parecer.com_ressalvas, undefined); // o literal já diz "com ressalvas"
  assert.equal(it.parecer.exercicio, '2021');
  assert.equal(it.data_julgamento, '2024-12-04');
  assert.equal(it.orgao, 'Tribunal Pleno');
  assert.equal(it.processo.numero, '22100604-7');
  assert.equal(it.relator, 'DIRCEU RODOLFO DE MELO JÚNIOR');
  assert.ok(it.fontes[0].url && it.fontes[0].orgao && it.fontes[0].acessado_em && it.fontes[0].titulo);
  const it14 = montarExercicioGovernador(2014, regs, URL);
  assert.equal(it14.parecer.conclusao, 'Aprovação');
  assert.equal(it14.parecer.com_ressalvas, undefined); // "Aprovação" sem "com ressalvas": nada é deduzido
  assert.equal(it14.outros_processos, undefined);
});

teste('governador sem parecer', () => {
  const vazio = montarExercicioGovernador(2023, regs, URL);
  assert.equal(vazio.parecer.conclusao, null);
  assert.equal(vazio.data_julgamento, null);
  assert.match(vazio.lacunas[0], /não encontrado/);
  const pend = { url: 'https://sistemas.tcepe.tc.br/DadosAbertos/Processos!json?x', processos: [{ numero: '24100726-4', situacao: 'Não Julgado', tipo: 'Governo', url: 'https://etce.tcepe.tc.br/epp/ConsultaExternaTCE/listView.seam?cprc=24100726&digito=4' }] };
  const comPend = montarExercicioGovernador(2023, regs, URL, pend);
  assert.equal(comPend.processo.numero, '24100726-4');
  assert.equal(comPend.situacao_processo_literal, 'Não Julgado');
  assert.equal(comPend.parecer.conclusao, null);
  assert.equal(comPend.fontes.length, 2);
  assert.equal(numeroDoLink('241007264', pend.processos[0].url), '24100726-4');
  assert.equal(numeroDoLink('241007264', null), '241007264');
});

teste('prefeitos', () => {
  const muns = municipiosDosRegistros(regs.filter((r) => r.esfera === 'M'));
  assert.deepEqual([...muns.keys()].sort(), ['lagoa-dos-gatos', 'recife']);
  assert.throws(() => municipiosDosRegistros([{ municipio: 'São Vicente Ferrer' }, { municipio: 'São Vicente Férrer' }]));
  const lg = muns.get('lagoa-dos-gatos');
  const it = itemMunicipio(lg, 2023, regs, URL);
  assert.equal(it.parecer.conclusao, 'Aprovação com ressalvas');
  assert.equal(it.parecer.contas_de, 'Prefeito de Lagoa dos Gatos');
  assert.equal(it.orgao, '2ª Câmara');
  assert.ok(it.parecer.documento.url.includes('validaDoc'));
  const rec = itemMunicipio(muns.get('recife'), 2023, regs, URL);
  assert.equal(rec.parecer.conclusao, 'Rejeição');
  assert.equal(rec.parecer.com_ressalvas, undefined);
  assert.equal(rec.parecer.documento, undefined); // sem link na API, sem documento
  assert.equal(rec.unidade_jurisdicionada_literal, 'Prefeitura da Cidade do Recife');
  const sem = itemMunicipio(lg, 2024, [], URL);
  assert.equal(sem.parecer.conclusao, null);
  // Junção: exercício antigo mantido, novo substitui, exercício nunca baixado fica de fora.
  const antigo = { itens: [{ ...sem, parecer: { ...sem.parecer, exercicio: '2015', conclusao: 'Rejeição' } }] };
  const d = montarArquivoMunicipio(lg, antigo, new Map([[2023, it], [2024, sem]]), { inicio: 2014, fim: 2025 });
  assert.deepEqual(d.itens.map((i) => i.parecer.exercicio), ['2015', '2023', '2024']);
  assert.deepEqual(d.periodo, { inicio: 2015, fim: 2024 });
  assert.deepEqual(d.contagens, { exercicios: 3, com_parecer_em_fonte_aberta: 2, sem_fonte_aberta: 1 });
  assert.equal(d.municipio.uf, 'PE');
});

teste('gravação atômica sem regravar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcepe-teste-'));
  try {
    const arq = path.join(dir, 'x.json');
    assert.equal(gravarSeMudou(arq, { a: 1, atualizado_em: '1' }), true);
    assert.equal(gravarSeMudou(arq, { a: 1, atualizado_em: '2' }), false);
    assert.equal(gravarSeMudou(arq, { a: 2, atualizado_em: '3' }), true);
    assert.deepEqual(fs.readdirSync(dir), ['x.json']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Conferência dos dados gerados (formato lido por web/src/features/tribunais-contas/dados.ts).
const RESULTADOS = new Set(['Aprovação', 'Aprovação com ressalvas', 'Rejeição']);
function conferirItem(it, onde) {
  assert.ok(it.id && it.titulo && it.parecer && typeof it.parecer.exercicio === 'string', `${onde}: campos básicos`);
  assert.ok(Array.isArray(it.fontes) && it.fontes.length && it.fontes.every((f) => f.url && f.titulo && f.orgao && f.acessado_em), `${onde}: fontes`);
  assert.ok(Array.isArray(it.lacunas) && Array.isArray(it.parecer.ressalvas) && Array.isArray(it.parecer.alertas), `${onde}: listas`);
  if (it.parecer.conclusao !== null && !RESULTADOS.has(it.parecer.conclusao)) console.warn(`aviso: ${onde}: resultado novo na API: "${it.parecer.conclusao}"`);
  if (!it.parecer.conclusao) assert.ok(it.lacunas.length, `${onde}: sem conclusão precisa de lacuna`);
}
teste('dados gerados', () => {
  const dg = path.join(SAIDA, 'contas-governador');
  if (fs.existsSync(dg)) for (const n of fs.readdirSync(dg)) {
    assert.match(n, /^\d{4}\.json$/);
    conferirItem(JSON.parse(fs.readFileSync(path.join(dg, n), 'utf8')), n);
  }
  const dp = path.join(SAIDA, 'contas-prefeitos');
  if (fs.existsSync(dp)) for (const n of fs.readdirSync(dp)) {
    assert.match(n, /^[a-z0-9-]{2,40}\.json$/, n);
    const texto = fs.readFileSync(path.join(dp, n), 'utf8');
    assert.ok(texto.split('\n').length < 5000, `${n}: arquivo grande demais`);
    const d = JSON.parse(texto);
    assert.equal(`${d.municipio.id}.json`, n);
    assert.equal(d.municipio.uf, 'PE');
    const anos = d.itens.map((i) => i.parecer.exercicio);
    assert.equal(new Set(anos).size, anos.length, `${n}: exercício repetido`);
    d.itens.forEach((it) => conferirItem(it, `${n} ${it.parecer.exercicio}`));
  }
});

console.log(`${ok} grupos de testes ok${process.exitCode ? ' (com falhas)' : ''}`);
