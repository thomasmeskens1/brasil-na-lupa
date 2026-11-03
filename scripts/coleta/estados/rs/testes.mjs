#!/usr/bin/env node
// Testes offline do coletor do RS (sem rede): robots.txt, busca, página da proposição, votações e LEGIS.
// Amostras reais reduzidas em scripts/coleta/estados/rs/amostras/ (baixadas em 02/11/2026).
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { interpretarRobots, permitidoPorRobots, omitirParticulares, autorPublico, dataBR, manterDataColeta } from './lib.mjs';
import { jsonEmbutido, itemDaBusca, montarVotacao } from './alrs.mjs';
import { lerListaLegis, lerFichaLegis, montarNorma, TIPOS_NORMA } from './legis.mjs';

const AM = path.join(path.dirname(fileURLToPath(import.meta.url)), 'amostras');
let ok = 0;
const teste = (nome, fn) => { fn(); ok++; console.log(`ok - ${nome}`); };

teste('robots.txt: curingas, regra mais longa e grupo do agente', () => {
  const almg = interpretarRobots(`User-agent: *\nAllow: /documentacao/\nAllow: /api/ajuda/\nAllow: /api/v2/\n\nDisallow: /api/v2/*?*p=\nDisallow: /api/v2/*?*ord=\nDisallow: /api/v2/*?*tp=\nDisallow: /api/v2/*?*ordenacao=\nDisallow: /\n`);
  const p = (c) => permitidoPorRobots(almg.regras, c).permitido;
  assert.equal(p('/api/v2/proposicoes/pesquisa/direcionada?tipo=PL&ano=2026&ini=20261001&fim=20261031&formato=json'), true);
  assert.equal(p('/api/v2/proposicoes/pesquisa/direcionada?tipo=PL&ano=2026&p=2'), false);
  assert.equal(p('/api/v2/proposicoes/pesquisa/avancada?tp=10&expr=greve'), false);
  assert.equal(p('/api/v2/legislacao/mineira/pesquisa/direcionada?tipo=LEI&ord=0'), false);
  assert.equal(p('/arquivo/proposicoes/download?ano=2026&tipo=CSV'), false, 'CSV fora dos caminhos liberados');
  assert.equal(p('/documentacao/arquivos'), true);
  const drupal = interpretarRobots('User-agent: *\nAllow: /core/*.css$\nDisallow: /core/\nDisallow: /search/\nCrawl-delay: 3\n');
  assert.equal(permitidoPorRobots(drupal.regras, '/proposicao/PL/188/2024').permitido, true);
  assert.equal(permitidoPorRobots(drupal.regras, '/core/a.css').permitido, true);
  assert.equal(permitidoPorRobots(drupal.regras, '/core/a.css?x').permitido, false);
  assert.equal(permitidoPorRobots(drupal.regras, '/search/node').permitido, false);
  assert.equal(drupal.crawlDelay, 3);
  const esp = interpretarRobots('User-agent: *\nDisallow: /\n\nUser-agent: brasil-na-lupa-coletor\nDisallow: /privado/\n');
  assert.equal(permitidoPorRobots(esp.regras, '/proposicao').permitido, true);
  assert.equal(permitidoPorRobots(esp.regras, '/privado/x').permitido, false);
});

teste('privacidade: nomes de particulares e proponentes', () => {
  const r = omitirParticulares('Concede o título de Cidadão Honorário do Estado ao Senhor João da Silva Pereira, de Porto Alegre.');
  assert.equal(r.omitido, true);
  assert.match(r.texto, /\[nome de particular omitido\]/);
  assert.doesNotMatch(r.texto, /João/);
  assert.equal(omitirParticulares('Altera a denominação de escola estadual localizada no Município de Santa Maria').omitido, false);
  assert.doesNotMatch(omitirParticulares('Concede o título de Cidadão Honorário do Estado ao Sr. Felipe Souza Pereira, o Felca.').texto, /Felca|Felipe/);
  assert.match(omitirParticulares('A Escola Estadual X passa a denominar-se Escola Estadual Maria da Silva Souza.').texto, /Escola Estadual \[nome de particular omitido\]/);
  const s = omitirParticulares('Altera a Lei nº 15.766, de 20 de dezembro de 2021 (ICMS pertencente aos municípios).');
  assert.equal(s.omitido, false);
  assert.equal(autorPublico('Deputado(a) Edivilson Brum').omitido, false);
  assert.equal(autorPublico('Poder Executivo').omitido, false);
  assert.equal(autorPublico('Maria de Souza').nome, '[nome de particular omitido]');
});

teste('datas e manutenção da data de coleta', () => {
  assert.deepEqual(dataBR('11/08/2026 14:00:00'), { data: '2026-08-11', hora: '14:00' });
  assert.deepEqual(dataBR(''), { data: null, hora: null });
  const a = { x: 1, coletado_em: '2026-11-01' };
  assert.equal(manterDataColeta({ x: 1, coletado_em: '2026-11-03' }, a).coletado_em, '2026-11-01');
  assert.equal(manterDataColeta({ x: 2, coletado_em: '2026-11-03' }, a).coletado_em, '2026-11-03');
});

teste('busca: lista embutida vira itens do índice', () => {
  const j = jsonEmbutido(fs.readFileSync(path.join(AM, 'busca-PL-2026.html'), 'utf8'));
  const itens = j.alergs_opine_proposicoes.proposicoes.map(itemDaBusca);
  assert.equal(itens.length, 3);
  assert.equal(itens[0].id, 'rs-PL-1-2026');
  assert.equal(itens[0].uf, 'RS');
  assert.equal(itens[0].casa, 'alrs');
  assert.equal(itens[0].url, 'https://ww4.al.rs.gov.br/proposicao/PL/1/2026');
  assert.match(itens[0].data_protocolo, /^2026-\d\d-\d\d$/);
});

teste('página da proposição: votações de Plenário e de comissão (PL 188/2024)', () => {
  const j = jsonEmbutido(fs.readFileSync(path.join(AM, 'proposicao-PL-188-2024.html'), 'utf8'));
  const prop = { id: 'rs-PL-188-2024', id_fonte: '351f6756-2e4b-11ef-813d-0242ac170004', sigla: 'PL', numero: 188, ano: 2024, ementa: 'x', url: 'https://ww4.al.rs.gov.br/proposicao/PL/188/2024' };
  const [ccj, plen] = j['#votacoes'].lista.map((v) => montarVotacao(v, prop, { hoje: '2026-11-02', mapaDeputados: new Map() }));
  assert.equal(plen.orgao, 'Plenário');
  assert.equal(plen.tipo, 'nominal');
  assert.equal(plen.data, '2026-08-11');
  assert.equal(plen.votos.length, 50);
  assert.deepEqual(plen.placar, { sim: 50, nao: 0, abstencao: 0, obstrucao: 0, outros: 0 });
  assert.equal(plen.resultado, 'aprovada');
  assert.equal(plen.lacunas.length, 0);
  assert.ok(plen.votos.every((v) => v.nome && v.partido && v.voto === 'Sim' && v.uf === 'RS'));
  assert.equal(plen.uf, 'RS'); assert.equal(plen.casa, 'alrs');
  assert.equal(plen.fonte.url, prop.url);
  assert.equal(ccj.orgao, 'Comissão');
  assert.equal(ccj.orgao_sigla, 'CCJ');
  assert.equal(ccj.placar, null, 'comissão: Favorável/Contrário sem conversão para sim/não');
  assert.deepEqual(ccj.placar_oficial, [{ opcao: 'Favorável', votos: 9 }]);
  assert.ok(ccj.votos.every((v) => v.voto === 'Favorável'));
  assert.match(ccj.conferencia_placar, /conferem/);
  // Partido por votação: o mesmo deputado pode ter partidos diferentes em datas diferentes.
  const fred = (v) => v.votos.find((x) => x.nome === 'Frederico Antunes')?.partido;
  assert.equal(fred(ccj), 'PP'); assert.equal(fred(plen), 'PSD');
});

teste('conferência: divergência entre votos e totais vira lacuna', () => {
  const j = jsonEmbutido(fs.readFileSync(path.join(AM, 'proposicao-PL-188-2024.html'), 'utf8'));
  const v = structuredClone(j['#votacoes'].lista[1]);
  v.votos.pop();
  const r = montarVotacao(v, { id: 'x', sigla: 'PL', numero: 1, ano: 2024, url: 'u' }, { hoje: '2026-11-02' });
  assert.ok(r.lacunas.some((l) => /não confere/.test(l)));
});

teste('LEGIS: lista e ficha (Lei 16.563 ← PL 188/2024, DOE 177)', () => {
  const lista = lerListaLegis(fs.readFileSync(path.join(AM, 'legis-lista.html'), 'latin1'));
  assert.equal(lista.total, 108);
  assert.equal(lista.linhas.length, 3);
  assert.ok(lista.linhas.every((l) => /^\d+$/.test(l.id) && l.data && l.ementa));
  const ficha = lerFichaLegis(fs.readFileSync(path.join(AM, 'legis-ficha-77402.html'), 'latin1'));
  assert.deepEqual(ficha.proposicao, { sigla: 'PL', numero: 188, ano: 2024 });
  assert.equal(ficha.data, '2026-09-11');
  assert.equal(ficha.publicacao[0].edicao, 177);
  assert.equal(ficha.publicacao[0].data, '2026-09-14');
  assert.equal(ficha.publicacao[0].pagina, '6');
  assert.match(ficha.ementa, /ICMS/);
  const n = montarNorma(TIPOS_NORMA[0], { id: '77402', numero: '16563', data: '2026-09-11', ementa: 'x' }, ficha, { hoje: '2026-11-02' });
  assert.equal(n.id, 'rs-lei-16563-2026');
  assert.equal(n.nome_oficial, 'Lei nº 16.563, de 11/09/2026');
  assert.equal(n.projeto_origem[0].proposicao_id, 'rs-PL-188-2024');
  assert.equal(n.uf, 'RS');
});

console.log(`\n${ok} testes passaram.`);
