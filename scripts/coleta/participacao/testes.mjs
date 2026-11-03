// Testes offline (sem rede) do coletor de participação oficial:
//   node --test scripts/coleta/participacao/testes.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { lerCsv } from '../camara/lib.mjs';
import { interpretarRobots, permitido, ClienteHost, Bloqueado } from './http.mjs';
import { extrairEcidadania, extrairEnqueteCamara, somarCsvEcidadania, inteiroBR, NAO_DISPONIVEL } from './extrair.mjs';
import { registroSenado, registroCamara, escolher } from './coletar.mjs';

// ---------- amostras reduzidas, no formato das páginas oficiais (coletadas em 03/11/2026) ----------
const SENADO_ABERTA = `<html><head><title>Consulta Pública - MPV 1394/2026 :: Portal e-Cidadania - Senado Federal</title></head><body>
<!--     <span class="contabilizacao-favor"  tal:content="structure votosFavor">10+</span> -->
<section class="materia-votacao"><section class="hidden-xs sec-votacao">
<div class="cp-pergunta">Você apoia essa proposição?</div>
<div id="barra-voto"><a class="btn btn-primary" data-voto="favor">SIM</a><a class="btn btn-danger" data-voto="contra">NÃO</a></div></section>
<figure class="grafico-consulta-publica"><header><span>Sim</span><span>Não</span></header>
<footer><span class="contabilizacao-favor">525.337</span>
<span class="contabilizacao-contra">81.553</span></footer></figure>
<div><div id="msg-contabilizacao-voto">Votos apurados até 03/11/2026 19:39:13</div></div></section></body></html>`;

const SENADO_ENCERRADA = `<title>Consulta Pública - PLP 68/2024 :: Portal e-Cidadania - Senado Federal</title>
<div class="tramitacao-encerrada text-right">TRAMITAÇÃO ENCERRADA</div>
<section class="materia-votacao"><div class="cp-msg-result">RESULTADO FINAL:</div>
<figure class="grafico-consulta-publica"><footer>
<span class="contabilizacao-favor">49</span>
<span class="contabilizacao-contra">424</span></footer></figure>
<div class="light-text">Este texto não é mais passível de votação.</div></section>`;

const SENADO_NAO_PASSIVEL = `<title>Consulta Pública - MSF 3/2025 :: Portal e-Cidadania - Senado Federal</title>
<div>Tipo de Matéria não passível de votação!</div><div class="tramitacao-encerrada">TRAMITAÇÃO ENCERRADA</div>`;

const CAMARA_RESULTADOS = `<h2>Resultado</h2><p>Resultado parcial desde 06/02/2025</p>
<p>Qual sua opinião sobre a PEC 2/2025?</p><table><tr><th>Opção</th><th>Participações</th><th>Percentual</th></tr>
<tr><th class="grafico-barras__item resumo-resposta__opiniao" data-th="Opção">Concordo totalmente</th>
<td class="grafico-barras__item resumo-resposta__participacoes" data-th="Participações">460</td>
<td class="grafico-barras__item resumo-resposta__percentual" data-th="Percentual">1%</td></tr>
<tr><th class="grafico-barras__item resumo-resposta__opiniao" data-th="Opção">Estou indeciso</th>
<td class="grafico-barras__item resumo-resposta__participacoes" data-th="Participações">32</td>
<td class="grafico-barras__item resumo-resposta__percentual" data-th="Percentual">0%</td></tr>
<tr><th class="grafico-barras__item resumo-resposta__opiniao" data-th="Opção">Discordo totalmente</th>
<td class="grafico-barras__item resumo-resposta__participacoes" data-th="Participações">95.278</td>
<td class="grafico-barras__item resumo-resposta__percentual" data-th="Percentual">99%</td></tr></table>`;

const CSV = '"Dados atualizados até 02/11/2026"\r\n'
  + '"CÓD. MATÉRIA";"NOME DA MATÉRIA";"EMENTA";"AUTORIA";"STATUS ATUAL";"UF DO CIDADÃO";"VOTO SIM";"VOTO NÃO";"TOTAL"\r\n'
  + '"164914";"PLP 68/2024";"Institui o IBS; e dá ""outras"" providências.";"Câmara Dos Deputados";"Descontinuado";"AC";"";"1";"1"\r\n'
  + '"164914";"PLP 68/2024";"Institui o IBS;\r\ncom quebra de linha";"Câmara Dos Deputados";"Descontinuado";"SP";"49";"1.423";"1.472"\r\n'
  + '"603";"PDS 16/1984";"Outra";"Câmara Dos Deputados";"Descontinuado";"MG";"5";"1";"6"\r\n';

test('números no formato brasileiro', () => {
  assert.equal(inteiroBR('95.278'), 95278);
  assert.equal(inteiroBR('0'), 0);
  assert.equal(inteiroBR('10+'), null);
  assert.equal(inteiroBR('1,5'), null);
});

test('e-Cidadania: consulta aberta (resultado parcial), ignora comentários do HTML', () => {
  const p = extrairEcidadania(SENADO_ABERTA);
  assert.equal(p.identificacao, 'MPV 1394/2026');
  assert.equal(p.situacao, 'aberta');
  assert.equal(p.sim, 525337);
  assert.equal(p.nao, 81553);
  assert.equal(p.apurado_ate, '03/11/2026 19:39:13');
  assert.equal(p.rotulo_oficial, null);
});

test('e-Cidadania: consulta encerrada (RESULTADO FINAL)', () => {
  const p = extrairEcidadania(SENADO_ENCERRADA);
  assert.equal(p.situacao, 'encerrada');
  assert.equal(p.rotulo_oficial, 'RESULTADO FINAL');
  assert.equal(p.frase_oficial, 'Este texto não é mais passível de votação.');
  assert.deepEqual([p.sim, p.nao], [49, 424]);
});

test('e-Cidadania: matéria não passível de votação fica sem números', () => {
  const p = extrairEcidadania(SENADO_NAO_PASSIVEL);
  assert.equal(p.situacao, 'nao_passivel');
  const r = registroSenado({ id: '167955', identificacao: 'MSF 3/2025' }, p, { acessadoEm: '2026-11-03' });
  assert.equal(r.consulta, null);
  assert.equal(r.lacuna, NAO_DISPONIVEL);
  assert.equal(r.observacao_oficial, 'Tipo de Matéria não passível de votação!');
  assert.equal(r.canal.url, 'https://www12.senado.leg.br/ecidadania/visualizacaomateria?id=167955');
});

test('e-Cidadania: página ausente grava só o link e a lacuna', () => {
  const r = registroSenado({ id: '1', identificacao: 'X 1/2025' }, null, { acessadoEm: '2026-11-03' });
  assert.equal(r.consulta, null);
  assert.equal(r.lacuna, NAO_DISPONIVEL);
  assert.equal(r.fonte.acessado_em, '2026-11-03');
});

test('CSV de dados abertos: soma por matéria e conferência com a página', () => {
  const csv = somarCsvEcidadania(CSV, lerCsv, ['164914']);
  assert.equal(csv.dados_ate, '2026-11-02');
  assert.deepEqual(csv.soma.get('164914'), { sim: 49, nao: 1424, linhas: 2 });
  assert.equal(csv.soma.has('603'), false);
  const pag = extrairEcidadania(SENADO_ENCERRADA);
  const r = registroSenado({ id: '164914' }, pag, { acessadoEm: '2026-11-03', csv });
  assert.match(r.conferencia_dados_abertos.resultado, /^diverge/);
  const r2 = registroSenado({ id: '164914' }, { ...pag, nao: 1424 }, { acessadoEm: '2026-11-03', csv });
  assert.equal(r2.conferencia_dados_abertos.resultado, 'confere');
});

test('Câmara: resultados da enquete copiados na ordem da página', () => {
  const p = extrairEnqueteCamara(CAMARA_RESULTADOS);
  assert.equal(p.situacao, 'aberta');
  assert.equal(p.rotulo_oficial, 'Resultado parcial desde 06/02/2025');
  assert.equal(p.desde, '2025-02-06');
  assert.equal(p.pergunta, 'Qual sua opinião sobre a PEC 2/2025?');
  assert.deepEqual(p.opcoes.map((o) => [o.opcao, o.participacoes, o.percentual]), [
    ['Concordo totalmente', 460, '1%'], ['Estou indeciso', 32, '0%'], ['Discordo totalmente', 95278, '99%'],
  ]);
  const r = registroCamara({ id: '2483164', identificacao: 'PEC 2/2025' }, p, { acessadoEm: '2026-11-03' });
  assert.equal(r.canal.url, 'https://www.camara.leg.br/enquetes/2483164');
  assert.equal(r.fonte.url, 'https://www.camara.leg.br/enquetes/2483164/resultados');
  assert.equal(r.lacuna, null);
});

test('Câmara: "Resultado final" e página sem tabela', () => {
  assert.equal(extrairEnqueteCamara('<p>Resultado final desde 04/05/2018</p>').situacao, 'encerrada');
  const r = registroCamara({ id: '9' }, extrairEnqueteCamara('<p>nada</p>'), { acessadoEm: '2026-11-03' });
  assert.equal(r.enquete, null);
  assert.equal(r.lacuna, NAO_DISPONIVEL);
});

test('ordem de visita: nunca verificadas primeiro; encerradas puladas sem --forcar', () => {
  const ids = ['3', '1', '2', '4'];
  const verificados = { 1: '2026-11-02T00:00:00Z', 2: '2026-11-01T00:00:00Z' };
  const situacoes = { 4: 'encerrada' };
  assert.deepEqual(escolher(ids, { verificados, situacoes }), ['3', '2', '1']);
  assert.deepEqual(escolher(ids, { verificados, situacoes, limite: 2 }), ['3', '2']);
  assert.deepEqual(escolher(ids, { verificados, situacoes, forcar: true }), ['3', '4', '2', '1']);
});

test('robots.txt: grupo * da Câmara permite /enquetes e proíbe /comentarios', () => {
  const r = interpretarRobots('User-agent: GPTBot\nDisallow: /wp-admin*\n\nUser-agent: *\nDisallow: /comentarios/*\nDisallow: /*.pdf\nCrawl-delay: 2');
  assert.equal(r.grupo, '*');
  assert.equal(permitido(r, '/enquetes/2483164/resultados'), true);
  assert.equal(permitido(r, '/comentarios/1'), false);
  assert.equal(r.crawlDelay, 2);
});

function respostaFalsa(status, corpo = '', headers = {}) {
  return { status, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, text: async () => corpo, arrayBuffer: async () => Buffer.from(corpo) };
}

test('cliente: robots.txt é a primeira requisição; caminho proibido não é pedido; 403 bloqueia sem contorno', async () => {
  const pedidos = [];
  const fetchImpl = async (url) => {
    pedidos.push(new URL(url).pathname);
    if (url.endsWith('/robots.txt')) return respostaFalsa(200, 'User-agent: *\nDisallow: /privado');
    return respostaFalsa(403, 'Forbidden');
  };
  const c = new ClienteHost('exemplo.leg.br', { fetchImpl, dormir: async () => {}, pausaMs: 0 });
  await assert.rejects(() => c.obter('/x'), /robots\.txt de exemplo\.leg\.br ainda não lido/);
  await c.lerRobots();
  await assert.rejects(() => c.obter('/privado/1'), Bloqueado);
  await assert.rejects(() => c.obter('/enquetes/1'), Bloqueado);
  await assert.rejects(() => c.obter('/enquetes/2'), Bloqueado);
  assert.deepEqual(pedidos, ['/robots.txt', '/enquetes/1']);
});

test('cliente: retentativa em 503 e 500 aceito como "sem enquete"', async () => {
  let n = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith('/robots.txt')) return respostaFalsa(404, '');
    if (url.includes('/a')) { n++; return n < 2 ? respostaFalsa(503) : respostaFalsa(200, 'ok'); }
    return respostaFalsa(500, 'erro');
  };
  const c = new ClienteHost('exemplo.leg.br', { fetchImpl, dormir: async () => {}, pausaMs: 0 });
  await c.lerRobots();
  assert.equal((await c.obter('/a')).corpo, 'ok');
  assert.equal((await c.obter('/b', { statusAceitos: [500] })).status, 500);
  assert.equal(c.estat.retentativas, 1);
});
