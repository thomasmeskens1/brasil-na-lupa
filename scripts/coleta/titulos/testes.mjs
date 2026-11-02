#!/usr/bin/env node
// Testes do verificador, dos recortes e das regras da revisão de viés (sem rede). Os títulos vetados
// pelos analistas na 1ª amostra entram como contraexemplos.
import assert from 'node:assert/strict';
import path from 'node:path';
import { verificarTitulo } from './regras.mjs';
import { cortarEmOracao, trechoDaEmenta, trechoCredito, universoNumerico, limpar } from './texto.mjs';
import { modeloVotacao } from './modelos-votacoes.mjs';
import { modeloIcms, modeloContasTce, modeloMp } from './modelos-atos.mjs';
import { modeloTemaStf } from './modelos-justica.mjs';
import { termosAusentes, alertasNaoLiterais, escopoPerdido, siglasSemExtenso, carregarVetos } from './conteudo.mjs';
import { perturbar, carregarSecao } from './itens.mjs';
import { contextoVerificacao } from './verificar.mjs';
import { SAIDA, lerJson } from './lib.mjs';

let ok = 0;
const teste = (nome, fn) => { fn(); ok++; console.log(`ok - ${nome}`); };
const ctx = (dados, extra = {}) => ({ universo: universoNumerico(dados), nominal: false, nomes: ['Fulano de Tal'], ...extra });
const votacao = (extra = {}) => ({
  id: 'x', casa: 'camara', data: '2026-01-01', orgao_sigla: 'PLEN', orgao: 'Plenário', tipo: 'nominal', resultado: 'aprovada',
  descricao: 'Aprovado o Projeto de Lei nº 1, de 2026. Sim: 300; Não: 100; Total: 400.',
  proposicao: { id: '1', sigla: 'PL', numero: 1, ano: 2026, ementa: 'Institui o Programa Escola Aberta.' },
  placar: { sim: 300, nao: 100 }, votos: [{ nome: 'Fulano de Tal', partido: 'AAA', voto: 'Sim' }], orientacoes: [{ bancada: 'AAA', orientacao: 'Sim' }],
  ...extra,
});

// ---------- regras gerais ----------
teste('contraexemplos do padrão editorial são reprovados', () => {
  for (const t of ['Câmara dá goleada e aprova MEI', 'Votação histórica: Senado aprova reforma', 'Câmara aprova pacote polêmico']) {
    assert.equal(verificarTitulo(t, 'modelo', ctx({})).aprovado, false, t);
  }
});
teste('número que não está no dado oficial reprova', () => {
  assert.equal(verificarTitulo('Câmara aprova projeto que reduz imposto em 15%', 'modelo', ctx({ ementa: 'Reduz imposto.' })).verificacao.numeros_e_datas_conferidos, false);
});
teste('contagem de votos só em votação nominal', () => {
  const d = { placar: { sim: 300, nao: 100 } };
  assert.equal(verificarTitulo('Câmara aprova projeto (300 Sim, 100 Não)', 'modelo', ctx(d)).aprovado, false);
  assert.equal(verificarTitulo('Câmara aprova projeto (300 Sim, 100 Não)', 'modelo', ctx(d, { nominal: true })).aprovado, true);
});
teste('nome de pessoa e tratamento reprovam; termos como "Senhor Bom Jesus" não', () => {
  assert.equal(verificarTitulo('Câmara aprova projeto de Fulano de Tal', 'modelo', ctx({})).aprovado, false);
  assert.equal(verificarTitulo('Lei de Atibaia declara a utilidade pública (de autoria do vereador José)', 'modelo', ctx({})).aprovado, false);
  assert.equal(verificarTitulo('Câmara aprova projeto que declara a Romaria do Senhor Bom Jesus da Lapa', 'modelo', ctx({})).aprovado, true);
});
teste('corte de tese é prefixo literal e não descarta ressalva', () => {
  const tese = 'É devida a correção monetária, salvo se o pagamento ocorrer no prazo; e os juros incidem desde a citação';
  const c = cortarEmOracao(tese, 70, { estrito: true });
  assert.ok(c === null || (tese.startsWith(c) && !/monetária$/.test(c)));
});
teste('simetria: trocar partido, autor e nomes não muda o título do modelo', () => {
  const v = votacao();
  assert.equal(modeloVotacao(v).titulo, 'Câmara aprova projeto que institui o Programa Escola Aberta (300 Sim, 100 Não)');
  assert.equal(modeloVotacao(v).titulo, modeloVotacao(perturbar(v)).titulo);
});

// ---------- regras da revisão de viés ----------
teste('a) termo de conteúdo da manchete precisa existir no texto oficial', () => {
  const ementa = 'Dispõe sobre a realização de testes de aptidão física por gestantes e puérperas em concursos públicos da administração pública federal.';
  assert.deepEqual(termosAusentes('Deputados aprovam projeto que garante segunda chamada em concursos para gestantes e puérperas', [ementa]).sort(), ['chamada', 'garante', 'segunda'].sort());
  assert.deepEqual(termosAusentes('Câmara aprova testes de aptidão física para gestantes em concursos públicos federais', [ementa]), []);
});
teste('a) escopo: título não pode perder a restrição "federal" da ementa', () => {
  assert.deepEqual(escopoPerdido('Câmara aprova regras para gestantes em concursos', 'testes em concursos da administração pública federal'), ['federal']);
});
teste('b) comparativos e promessas de efeito só passam se literais na ementa', () => {
  assert.deepEqual(alertasNaoLiterais('Senado aprova regras mais rígidas para devedor contumaz', ['Dispõe sobre direitos, garantias e deveres dos contribuintes']).map((x) => x.toLowerCase()), ['mais', 'rígidas']);
  assert.deepEqual(alertasNaoLiterais('MP amplia o prazo', ['Amplia o prazo de adesão']), []);
});
teste('c) rejeição com mais Sim que Não traz o quórum da espécie, ou cai para o oficial', () => {
  const plp = votacao({ resultado: 'rejeitada', descricao: 'Rejeitado o Projeto de Lei Complementar nº 1, de 2026.', placar: { sim: 252, nao: 176 }, proposicao: { id: '1', sigla: 'PLP', numero: 1, ano: 2026, ementa: 'Institui o Programa Escola Aberta.' } });
  assert.match(modeloVotacao(plp).titulo, /\(252 Sim, 176 Não; eram necessários 257 Sim\)$/);
  const pl = votacao({ resultado: 'rejeitada', descricao: 'Rejeitado o Projeto de Lei nº 1, de 2026.', placar: { sim: 252, nao: 176 } });
  assert.ok(modeloVotacao(pl).erro);
  const sen = { ...plp, casa: 'senado', descricao: 'Votação nominal do Projeto de Lei Complementar nº 1, de 2026.', placar: { sim: 33, nao: 27 } };
  assert.match(modeloVotacao(sen).titulo, /eram necessários 41 Sim/);
});
teste('d) o objeto do título é o item votado (subemenda, emenda, destaque)', () => {
  const sub = votacao({ resultado: 'rejeitada', descricao: 'Rejeitada a Subemenda Substitutiva ao Projeto de Lei nº 1, de 2026, adotada pelo relator.', placar: { sim: 10, nao: 300 } });
  assert.match(modeloVotacao(sub).titulo, /^Câmara rejeita substitutivo ao projeto/);
  const em = votacao({ resultado: 'rejeitada', descricao: 'Rejeitada a Emenda de Plenário n. 7.', placar: { sim: 10, nao: 300 } });
  assert.match(modeloVotacao(em).titulo, /^Câmara rejeita emenda ao projeto/);
});
teste('e) votação nominal sem placar reprova', () => {
  const r = verificarTitulo('Câmara aprova projeto que institui o programa', 'agencia-camara', ctx({}, { nominal: true, placarObrigatorio: true, textos: ['Institui o programa'] }));
  assert.equal(r.aprovado, false);
});
teste('f) números da exposição de motivos não entram como fato', () => {
  const d = { mudancas: [{ item: 'Parte X', antes: '50%', depois: '100%', fonte: 'https://ex/pl.pdf' }], fontes: [{ titulo: 'PL original e exposição de motivos', url: 'https://ex/pl.pdf' }] };
  assert.ok(modeloIcms(d).erro);
});
teste('g) nunca "altera a Lei nº X" sozinho', () => {
  assert.equal(trechoDaEmenta('Altera a Lei nº 9.605, de 12 de fevereiro de 1998.', 100), null);
  assert.equal(trechoDaEmenta('Acrescenta § 4º-A ao art. 150 da Constituição Federal.', 100), null);
  assert.match(trechoDaEmenta('Altera a Lei nº 10.705, de 28 de dezembro de 2000, para fixar alíquotas progressivas do imposto.', 80).texto, /para fixar alíquotas progressivas/);
});
teste('h) crédito: verbo "abre" e valor oficial', () => {
  assert.equal(trechoCredito('Abre crédito extraordinário, em favor do Ministério de Minas e Energia, no valor de R$ 6.605.000.000,00, para os fins que especifica.', 100),
    'abre crédito extraordinário de R$ 6.605.000.000,00 em favor do Ministério de Minas e Energia');
  const mp = { ementa: 'Abre crédito extraordinário, em favor do Ministério X, no valor de R$ 10,00, para os fins que especifica.', links: {} };
  assert.match(modeloMp(mp, { manchete: { titulo: 'MP amplia crédito', origem: 'agencia-camara' } }).titulo, /^Medida provisória abre crédito extraordinário de R\$ 10,00/);
});
teste('i) tese sem artefato de numeração e com sigla por extenso', () => {
  const t = { tese: 'Reconhecimento da inconstitucionalidade parcial e progressiva do art. 19 do MCI. 1. Enquanto não sobrevier nova legislação, o art. 19 deve ser interpretado de forma que os provedores respondam civilmente por danos', titulo: 'Tema', situacao: { repercussao_geral: 'Há repercussão geral' } };
  const m = modeloTemaStf(t);
  assert.ok(m.erro || (!/MCI 1/.test(m.titulo) && !siglasSemExtenso(m.titulo).length));
  assert.deepEqual(siglasSemExtenso('Senado aprova indicação para o Conselho Nacional de Justiça - CNJ'), []);
  assert.deepEqual(siglasSemExtenso('STF fixa tese sobre o art. 19 do MCI'), ['MCI']);
});
teste('j) etapa informada pela tramitação entra antes do placar', () => {
  assert.match(modeloVotacao(votacao(), { etapa: 'segue para o Senado' }).titulo, /; segue para o Senado \(300 Sim, 100 Não\)$/);
});
teste('l) contas: mesmo molde para prefeito e governador; lacuna de ressalvas é dita', () => {
  const sem = modeloContasTce({ parecer: { conclusao: 'Favorável', exercicio: '2016', ressalvas: [] } }, 'Prefeito');
  const com = modeloContasTce({ parecer: { conclusao: 'favorável', exercicio: '2024', com_ressalvas: true } }, 'Governador');
  assert.equal(sem.titulo, 'Tribunal de Contas emite parecer favorável às contas de 2016 do Prefeito; ressalvas não informadas na fonte');
  assert.equal(com.titulo, 'Tribunal de Contas emite parecer favorável às contas de 2024 do Governador, com ressalvas');
});

// ---------- contra os dados reais: vetos da 1ª amostra ----------
const vetos = carregarVetos();
const saida = (s) => lerJson(path.join(SAIDA, `${s}.json`))?.itens || {};
teste('vetos: todo item vetado por qualquer analista está como "oficial", com veto_vies', () => {
  assert.ok(vetos.size >= 1);
  for (const [k, vieses] of vetos) {
    const [s, id] = k.split('|');
    const t = saida(s)[id];
    assert.ok(t, k);
    assert.equal(t.origem, 'oficial', k);
    assert.deepEqual([...t.verificacao.veto_vies].sort(), [...vieses].sort(), k);
  }
});
teste('manchetes vetadas são reprovadas pelas novas regras (contraexemplos)', () => {
  const casos = [
    ['camara', '2236186-60', 'Câmara rejeita criação de novo regime para socorrer ou liquidar bancos'],
    ['camara', '2405705-65', 'Deputados aprovam projeto que garante segunda chamada em concursos para gestantes e puérperas'],
    ['senado', '7010', 'Senado aprova regras mais rígidas para devedor contumaz'],
    ['senado', '6955', 'Senado aprova benefício fiscal para micro e pequenas empresas exportarem mais'],
    ['executivo', 'mpv-1389-2026', 'Medida provisória amplia crédito para subsídios aos preços dos combustíveis'],
    ['executivo', 'lei-15510-2026', 'Lei cria Semana Nacional da Empresa Júnior, a ser celebrada em abril'],
    ['executivo', 'mpv-1366-2026', 'Medida provisória cria financiamento para entregadores comprarem motos e bicicletas elétricas'],
  ];
  const porSecao = new Map();
  for (const [s, id, titulo] of casos) {
    if (!porSecao.has(s)) porSecao.set(s, new Map(carregarSecao(s).map((i) => [i.id, i])));
    const it = porSecao.get(s).get(id);
    assert.ok(it, `${s} ${id}`);
    const r = verificarTitulo(titulo, s === 'senado' ? 'agencia-senado' : 'agencia-camara', contextoVerificacao(it, { titulo, origem: 'agencia-camara' }));
    assert.equal(r.aprovado, false, titulo);
  }
});
teste('k) consistência: a mesma proposição usa o mesmo apelido oficial nas seções', () => {
  const lei = saida('executivo')['lcp-225-2026'];
  const voto = saida('senado')['7010'];
  assert.match(lei.titulo, /Código de Defesa do Contribuinte/);
  assert.ok(voto.origem === 'oficial' || /Código de Defesa do Contribuinte/.test(voto.titulo));
});
console.log(`${ok} testes passaram`);
