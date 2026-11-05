#!/usr/bin/env node
// Testes sem rede do coletor do TCE-RJ: node scripts/coleta/tribunais-contas/tce-rj/testes.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lerRobots, permitido, pareceBloqueio, gravarSeMudou, normalizar, kebab, conclusaoDoIndicador } from './lib.mjs';
import { lerRegistrosEstado, montarExercicioGovernador } from './governador.mjs';
import { agruparMunicipios, carregarEntesRj, identificarMunicipio, montarMunicipio } from './prefeitos.mjs';

let ok = 0;
const teste = (nome, fn) => { fn(); ok++; console.log(`ok  ${nome}`); };

// Fixtures pequenas, no formato das respostas reais de 05/11/2026.
const ESTADO = [
  { Ente: 'ESTADO DO RIO DE JANEIRO', Ano: 2024, Indicador: 'FAVORÁVEL', Processo: '103291-1/2025', Responsavel: 'FULANO DE TAL' },
  { Ente: 'ESTADO DO RIO DE JANEIRO', Ano: 2025, Indicador: 'CONTRÁRIO', Processo: '103320-0/2026', Responsavel: 'FULANO DE TAL' },
];
const MUNICIPIOS = [
  { Municipio: 'ANGRA DOS REIS', Regiao: 'Costa Verde', Ano: 2024, Indicador: 'FAVORÁVEL', Processo: '1-1/2025', Responsavel: 'A' },
  { Municipio: 'ANGRA DOS REIS', Regiao: 'Costa Verde', Ano: 2025, Indicador: 'EM ANALISE', Processo: '2-2/2026', Responsavel: 'B' },
  { Municipio: 'ARMACAO DE BUZIOS', Regiao: 'Baixada Litorânea', Ano: 2024, Indicador: 'CONTRÁRIO', Processo: '3-3/2025', Responsavel: 'C' },
];
const ENTES = {
  campos: ['cod_ibge', 'nome', 'uf', 'slug', 'capital', 'populacao'],
  itens: [
    [3300100, 'Angra dos Reis', 'rj', 'angra-dos-reis', 0, 1],
    [3300233, 'Armação dos Búzios', 'rj', 'armacao-dos-buzios', 0, 1],
    [3550308, 'São Paulo', 'sp', 'sao-paulo', 1, 1],
  ],
};

teste('robots: Disallow vazio permite tudo', () => {
  const r = lerRobots('User-agent: *\n\nDisallow:\n');
  assert.equal(permitido(r, '/api/v1/prestacao_contas_estado'), true);
});
teste('robots: Disallow e Allow mais específico', () => {
  const r = lerRobots('User-agent: *\nDisallow: /api/\nAllow: /api/v1/publico\n');
  assert.equal(permitido(r, '/api/v1/prestacao_contas_estado'), false);
  assert.equal(permitido(r, '/api/v1/publico/x'), true);
});
teste('robots: grupo do nosso agente prevalece sobre *', () => {
  const r = lerRobots('User-agent: *\nDisallow:\n\nUser-agent: BrasilNaLupa-coletor\nDisallow: /\n');
  assert.equal(permitido(r, '/api/v1/x'), false);
});
teste('bloqueio: 403, redirecionamento e CAPTCHA param a coleta', () => {
  const res = (status, loc) => ({ status, headers: { get: () => loc ?? null } });
  assert.ok(pareceBloqueio(res(403), ''));
  assert.ok(pareceBloqueio(res(302, '/login'), ''));
  assert.ok(pareceBloqueio(res(200), '<html>Please complete the CAPTCHA</html>'));
  assert.equal(pareceBloqueio(res(200), '[{"Ano":2024}]'), null);
});
teste('texto: normalizar e kebab', () => {
  assert.equal(normalizar('  São  Gonçalo '), 'SAO GONCALO');
  assert.equal(kebab('SÃO JOSÉ DE UBÁ'), 'sao-jose-de-uba');
});
teste('indicador: só FAVORÁVEL e CONTRÁRIO viram conclusão', () => {
  assert.equal(conclusaoDoIndicador('FAVORÁVEL'), 'FAVORÁVEL');
  assert.equal(conclusaoDoIndicador('CONTRÁRIO'), 'CONTRÁRIO');
  assert.equal(conclusaoDoIndicador('EM ANALISE'), null);
  assert.equal(conclusaoDoIndicador('favoravel'), null);
});
teste('governador: leitura, conclusão literal e lacunas', () => {
  const m = lerRegistrosEstado(ESTADO);
  assert.equal(m.size, 2);
  const it = montarExercicioGovernador(2025, m.get(2025));
  assert.equal(it.id, 'tce-rj-contas-governador-2025');
  assert.equal(it.parecer.conclusao, 'CONTRÁRIO');
  assert.equal(it.processo.numero, '103320-0/2026');
  assert.equal(it.relator, null);
  assert.equal(it.data_julgamento, null);
  assert.equal(it.fontes[0].url, 'https://dados.tcerj.tc.br/api/v1/prestacao_contas_estado');
  assert.ok(it.fontes[0].acessado_em && it.fontes[0].orgao);
  const vazio = montarExercicioGovernador(2026, undefined);
  assert.equal(vazio.parecer.conclusao, null);
  assert.match(vazio.lacunas[0], /não consta/);
});
teste('governador: formato inesperado e exercício repetido falham', () => {
  assert.throws(() => lerRegistrosEstado({}), /lista/);
  assert.throws(() => lerRegistrosEstado([{ Ente: 'X', Ano: 1 }]), /campo ausente/);
  assert.throws(() => lerRegistrosEstado([ESTADO[0], ESTADO[0]]), /repetido/);
});
teste('prefeitos: identificação exata, grafia conferida e sem correspondência', () => {
  const entes = carregarEntesRj(ENTES);
  assert.equal(entes.size, 2);
  assert.equal(identificarMunicipio('ANGRA DOS REIS', entes).codigo_ibge, '3300100');
  const b = identificarMunicipio('ARMACAO DE BUZIOS', entes);
  assert.equal(b.id, 'armacao-dos-buzios');
  assert.equal(b.identificacao, 'grafia-conferida');
  const x = identificarMunicipio('ANGRA DO REI', entes); // parecido não casa
  assert.equal(x.identificacao, 'sem-correspondencia');
  assert.equal(x.codigo_ibge, null);
});
teste('prefeitos: arquivo do município com EM ANALISE sem conclusão', () => {
  const g = agruparMunicipios(MUNICIPIOS);
  const { arquivo } = montarMunicipio('ANGRA DOS REIS', g.get('ANGRA DOS REIS'), carregarEntesRj(ENTES), { inicio: 2023, fim: 2025 });
  assert.equal(arquivo.municipio.id, 'angra-dos-reis');
  assert.equal(arquivo.municipio.nome, 'Angra dos Reis');
  assert.equal(arquivo.municipio.regiao_na_fonte, 'Costa Verde');
  assert.deepEqual(arquivo.contagens, { exercicios: 3, com_parecer_em_fonte_aberta: 1, sem_fonte_aberta: 2 });
  const [i23, i24, i25] = arquivo.itens;
  assert.equal(i23.parecer.conclusao, null);
  assert.equal(i24.parecer.conclusao, 'FAVORÁVEL');
  assert.equal(i25.parecer.conclusao, null);
  assert.equal(i25.parecer.indicador_na_fonte, 'EM ANALISE');
  assert.match(i25.lacunas[0], /"EM ANALISE"/);
  assert.equal(i24.id, 'tce-rj-contas-prefeito-angra-dos-reis-2024');
  assert.ok(JSON.stringify(arquivo).length < 20000, 'arquivo enxuto');
});
teste('gravação atômica não reescreve conteúdo igual', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcerj-teste-'));
  try {
    const arq = path.join(dir, 'x', 'a.json');
    assert.equal(gravarSeMudou(arq, { a: 1, atualizado_em: '1' }), true);
    assert.equal(gravarSeMudou(arq, { a: 1, atualizado_em: '2' }), false);
    assert.equal(gravarSeMudou(arq, { a: 2 }), true);
    assert.deepEqual(fs.readdirSync(path.dirname(arq)), ['a.json']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\n${ok} testes passaram`);
