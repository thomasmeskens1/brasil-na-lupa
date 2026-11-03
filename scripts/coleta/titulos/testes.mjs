#!/usr/bin/env node
// Testes do gerador/verificador (sem rede). Só existem as origens "estruturado" (modelo fixo de campos)
// e "oficial" (texto do órgão sem alteração). Os erros de precisão da 2ª revisão entram como contraexemplos.
import assert from 'node:assert/strict';
import path from 'node:path';
import { verificarTitulo, verificarEtiqueta, ORIGENS } from './regras.mjs';
import { universoNumerico } from './texto.mjs';
import { etiquetaVotacao } from './modelos-votacoes.mjs';
import { modeloIcms, etiquetaIcms, modeloContasTce, etiquetaContasTce, modeloCredito, etiquetaVeto, etiquetaMp } from './modelos-atos.mjs';
import { etiquetaTemaStj, etiquetaTemaStf, teseReal } from './modelos-justica.mjs';
import { siglasSemExtenso, carregarVetos } from './conteudo.mjs';
import { perturbar, carregarSecao } from './itens.mjs';
import { contextoVerificacao } from './verificar.mjs';
import { SAIDA, lerJson } from './lib.mjs';

let ok = 0;
const teste = (nome, fn) => { fn(); ok++; console.log(`ok - ${nome}`); };
const ctx = (dados, extra = {}) => ({ universo: universoNumerico(dados), nominal: false, nomes: ['Fulano de Tal'], modelo: 'credito', literais: [], ...extra });
const votacao = (extra = {}) => ({
  id: 'x', casa: 'camara', data: '2026-01-01', tipo: 'nominal', resultado: 'aprovada',
  descricao: 'Aprovado o Projeto de Lei nº 1, de 2026. Sim: 300; Não: 100; Total: 400.',
  proposicao: { id: '1', sigla: 'PL', numero: 1, ano: 2026, ementa: 'Institui o Programa Escola Aberta.' },
  placar: { sim: 300, nao: 100 }, votos: [{ nome: 'Fulano de Tal', partido: 'AAA', voto: 'Sim' }],
  ...extra,
});

// ---------- regras gerais ----------
teste('só duas origens', () => assert.deepEqual(ORIGENS, ['estruturado', 'oficial']));
teste('palavras proibidas e número fora do dado reprovam', () => {
  for (const t of ['Câmara dá goleada e abre crédito', 'Votação histórica: lei abre crédito']) assert.equal(verificarTitulo(t, 'estruturado', ctx({})).aprovado, false, t);
  assert.equal(verificarTitulo('Lei federal abre crédito especial de R$ 15,00', 'estruturado', ctx({ ementa: 'R$ 10,00' })).verificacao.numeros_e_datas_conferidos, false);
});
teste('modelo desconhecido e trecho não literal reprovam', () => {
  assert.equal(verificarTitulo('Lei federal abre crédito especial de R$ 10,00', 'estruturado', ctx({ e: 'R$ 10,00' }, { modelo: 'reescrita' })).aprovado, false);
  const r = verificarTitulo('Lei federal abre crédito especial de R$ 10,00', 'estruturado', ctx({ e: 'R$ 10,00' }, { textos: ['Abre crédito especial no valor de R$ 10,00'], literais: ['crédito especial', 'em favor do Ministério do Norte'] }));
  assert.equal(r.aprovado, false);
  assert.match(r.motivos.join(), /não literal/);
});
teste('título diferente do refeito pelo modelo reprova', () => {
  assert.equal(verificarTitulo('Lei federal abre crédito especial de R$ 10,00', 'estruturado', ctx({ e: 'R$ 10,00' }, { titulo_refeito: 'outro' })).aprovado, false);
});
teste('nome de pessoa reprova', () => {
  assert.equal(verificarTitulo('Lei federal abre crédito de Fulano de Tal', 'estruturado', ctx({})).aprovado, false);
});

// ---------- modelos estruturados ----------
teste('crédito: verbo literal, um único valor, beneficiário literal', () => {
  const e = 'Abre crédito extraordinário, em favor do Ministério de Minas e Energia, no valor de R$ 6.605.000.000,00, para os fins que especifica.';
  const c = modeloCredito(e, 'Medida provisória', 'https://x');
  assert.equal(c.titulo, 'Medida provisória abre crédito extraordinário de R$ 6.605.000.000,00 em favor do Ministério de Minas e Energia');
  for (const l of c.literais) assert.ok(e.includes(l), l);
  assert.ok(modeloCredito('Abre crédito especial no valor de R$ 1,00 e de R$ 2,00.', 'Lei federal').erro, 'dois valores');
  // lista de beneficiários nunca é cortada (MP 1.377/2026)
  const lista = modeloCredito('Abre crédito extraordinário, em favor do Ministério da Agricultura e Pecuária, da Advocacia Geral da União, e de Operações Oficiais de Crédito, no valor de R$ 13.285.000.000,00, para os fins que especifica.', 'Medida provisória');
  assert.ok(!/em favor do Ministério da Agricultura e Pecuária$/.test(lista.titulo), lista.titulo);
  assert.equal(modeloCredito('Institui o programa X.', 'Lei federal'), null);
});
teste('ICMS: uma mudança, valores do texto da norma', () => {
  const d = { mudancas: [{ item: 'Gasolina', antes: '1,3721', depois: '1,47', unidade: 'R$ por litro', vigencia: '2025-02-01', fonte: 'https://ex/cv' }], fontes: [] };
  assert.equal(modeloIcms(d).titulo, 'ICMS de gasolina passa de R$ 1,3721 para R$ 1,47 por litro a partir de 01/02/2025');
  assert.equal(etiquetaIcms(d), 'ICMS: de R$ 1,3721 para R$ 1,47 por litro');
  const autor = { mudancas: [{ item: 'X', antes: '50%', depois: '100%', fonte: 'https://ex/pl.pdf' }], fontes: [{ titulo: 'PL original e exposição de motivos', url: 'https://ex/pl.pdf' }] };
  assert.ok(modeloIcms(autor).erro);
  assert.equal(etiquetaIcms(autor), null);
});
teste('contas: mesmo molde para prefeito e governador; parecer não é julgamento', () => {
  const sem = { parecer: { conclusao: 'Favorável', exercicio: '2016' } };
  const com = { parecer: { conclusao: 'favorável', exercicio: '2024', com_ressalvas: true } };
  assert.equal(modeloContasTce(sem, 'Prefeito').titulo, 'Tribunal de Contas emite parecer favorável às contas de 2016 do Prefeito; ressalvas não informadas na fonte');
  assert.equal(modeloContasTce(com, 'Governador').titulo, 'Tribunal de Contas emite parecer favorável às contas de 2024 do Governador, com ressalvas');
  assert.equal(etiquetaContasTce(com), 'Parecer favorável, com ressalvas');
  assert.ok(!/aprovad/i.test(etiquetaContasTce(com)));
});

// ---------- etiquetas ----------
teste('etiqueta de votação: placar só em nominal; mesmo formato para aprovado e rejeitado', () => {
  assert.equal(etiquetaVotacao(votacao()), 'Aprovado 300 × 100');
  assert.equal(etiquetaVotacao(votacao({ resultado: 'rejeitada', descricao: 'Rejeitado o Projeto.', placar: { sim: 100, nao: 300 } })), 'Rejeitado 100 × 300');
  assert.equal(etiquetaVotacao(votacao({ tipo: 'simbolica', placar: null })), 'Aprovado em votação simbólica');
  assert.equal(etiquetaVotacao(votacao({ resultado: 'rejeitada', descricao: 'Aprovado o Projeto.' })), null, 'resultado e descrição divergem');
  const plp = votacao({ resultado: 'rejeitada', descricao: 'Rejeitado o PLP.', placar: { sim: 252, nao: 176 }, proposicao: { sigla: 'PLP', numero: 1, ano: 2026 } });
  assert.equal(etiquetaVotacao(plp), 'Rejeitado 252 × 176 (mínimo 257 Sim)');
  assert.equal(etiquetaVotacao(votacao({ placar: { sim: 10, nao: 300 } })), 'Aprovado', 'placar contraditório: sem números');
  assert.equal(etiquetaVotacao(votacao()), etiquetaVotacao(perturbar(votacao())), 'simetria');
});
teste('etiqueta de veto e de MP vêm de contagens e situação', () => {
  const d = (s) => ({ situacao: s });
  assert.equal(etiquetaVeto({ dispositivos: [d('mantido'), d('mantido')] }), 'Veto mantido');
  assert.equal(etiquetaVeto({ dispositivos: [d('derrubado'), d('mantido'), d('mantido')] }), 'Veto derrubado em 1 de 3 trechos');
  assert.equal(etiquetaVeto({ dispositivos: [d(null)] }), 'Veto aguarda decisão do Congresso');
  assert.equal(etiquetaMp({ situacao: 'perdeu eficácia' }), 'Medida provisória perdeu a eficácia');
  assert.equal(etiquetaMp({ situacao: 'outra coisa' }), null);
});
teste('2ª revisão: aviso "Aguardando a publicação do acórdão" não é tese; sem repercussão geral não é tese fixada', () => {
  assert.equal(teseReal('*Aguardando a publicação do acórdão do julgamento de mérito'), false);
  assert.equal(etiquetaTemaStj({ situacao: 'Trânsito em Julgado', tese: '*Aguardando a publicação do acórdão' }), null);
  assert.equal(etiquetaTemaStj({ situacao: 'Trânsito em Julgado', tese: 'É devida a correção.' }), 'Tese firmada, decisão definitiva');
  assert.equal(etiquetaTemaStf({ tese: 'Tese qualquer', situacao: { repercussao_geral: 'Não há repercussão geral (questão infraconstitucional)' } }), 'Sem repercussão geral');
});
teste('verificador de etiqueta: número fora do dado e tamanho', () => {
  assert.equal(verificarEtiqueta('Aprovado 300 × 100', { universo: universoNumerico({ placar: { sim: 300, nao: 100 } }) }).aprovado, true);
  assert.equal(verificarEtiqueta('Aprovado 301 × 100', { universo: universoNumerico({ placar: { sim: 300, nao: 100 } }) }).aprovado, false);
  assert.equal(verificarEtiqueta('Aprovado 300 × 100', { universo: universoNumerico({ placar: { sim: 300, nao: 100 } }), refeita: 'Rejeitado' }).aprovado, false);
});
teste('siglas sem extenso', () => {
  assert.deepEqual(siglasSemExtenso('Senado aprova indicação para o Conselho Nacional de Justiça - CNJ'), []);
  assert.deepEqual(siglasSemExtenso('STF fixa tese sobre o art. 19 do MCI'), ['MCI']);
});

// ---------- contra os dados reais ----------
const saida = (s) => lerJson(path.join(SAIDA, `${s}.json`))?.itens || {};
const SECOES_DADOS = ['camara', 'senado', 'executivo', 'stj', 'stf', 'alesp', 'governo-sp', 'atibaia', 'icms', 'tribunais-contas'];
teste('dados: toda origem é "estruturado" ou "oficial"; estruturado só nos modelos fixos', () => {
  for (const s of SECOES_DADOS) {
    for (const [id, t] of Object.entries(saida(s))) {
      assert.ok(ORIGENS.includes(t.origem), `${s} ${id} ${t.origem}`);
      if (t.origem === 'estruturado') assert.ok(['credito', 'icms-mudanca', 'contas-tce'].includes(t.modelo), `${s} ${id}`);
      assert.equal(t.verificacao?.aprovado_pelo_verificador, true, `${s} ${id}`);
    }
  }
});
teste('dados: título oficial é idêntico ao texto do órgão', () => {
  for (const s of ['executivo', 'stj', 'stf', 'icms', 'tribunais-contas']) {
    const porId = new Map(carregarSecao(s).map((i) => [i.id, i]));
    for (const [id, t] of Object.entries(saida(s))) if (t.origem === 'oficial') assert.equal(t.titulo, porId.get(id).oficial.titulo, `${s} ${id}`);
  }
});
teste('dados: todo item vetado por qualquer analista (duas rodadas) está como "oficial", com veto_vies', () => {
  const vetos = carregarVetos();
  assert.ok(vetos.size >= 1);
  for (const [k, vieses] of vetos) {
    const [s, id] = k.split('|');
    const t = saida(s)[id];
    if (!t) continue; // item que saiu da coleta
    assert.equal(t.origem, 'oficial', k);
    assert.deepEqual([...t.verificacao.veto_vies].sort(), [...vieses].sort(), k);
  }
});
teste('dados: erros de precisão da 2ª revisão não voltam (cria × autoriza, tese placeholder, nomes)', () => {
  const cam = saida('camara'), ex = saida('executivo'), stj = saida('stj'), stf = saida('stf');
  assert.ok(!/^Câmara aprova/.test(cam['2503832-46']?.titulo || ''));
  assert.ok(!/Fronteira do Norte/.test(ex['lei-15520-2026']?.titulo || ''));
  assert.ok(!/fixa tese/.test(stj['stj-tema-1241']?.titulo || ''));
  assert.notEqual(stj['stj-tema-1241']?.etiqueta, 'Tese firmada, decisão definitiva');
  assert.ok(!/fixa tese/.test(stf['stf-tema-791']?.titulo || ''));
  assert.notEqual(stf['stf-tema-791']?.etiqueta, 'Tese fixada');
});
teste('dados: nenhum nome de advogado particular nos títulos do STF (diretriz 12)', () => {
  for (const [id, t] of Object.entries(saida('stf'))) {
    assert.ok(!/\bADV\.?\s*\(A\/S\)\s*:\s*(?!\[nome de particular omitido\])\p{Lu}/u.test(`${t.titulo} ${t.subtitulo}`), id);
  }
});
teste('simetria nos estruturados reais', () => {
  for (const s of ['executivo', 'icms', 'tribunais-contas']) {
    for (const it of carregarSecao(s)) {
      const c = it.construir(it.raw);
      if (!c?.titulo) continue;
      assert.equal(contextoVerificacao(it, c).titulo_perturbado, c.titulo, `${s} ${it.id}`);
    }
  }
});
console.log(`${ok} testes passaram`);
