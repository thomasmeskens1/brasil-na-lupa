#!/usr/bin/env node
// Testes offline do coletor do Amapá (ALAP). Amostras reduzidas de páginas reais de 06/11/2026 (estrutura preservada,
// listas encurtadas) em fixtures/. Rodar: node scripts/coleta/estados/ap/testes.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cliente, chaveNome, conferirPrivacidade } from '../abertos/base.mjs';
import {
  decodificar, identificacaoAP, autoresAP, interpretarDeputadosAP, interpretarListaProposicoesAP, interpretarDetalheAP, aplicarDetalheAP,
  votadoEmSessao, interpretarSessoesCsv, lerPaginaVotacao, dataDaSessao, votacaoAP, interpretarLegislacaoAP, temProxima,
} from './alap.mjs';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const ler = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const HOJE = '2026-11-06';

// ---------------------------------------------------------------- cliente: robots.txt antes de tudo; 403 sem regra; tudo liberado
{
  const pedidos = [];
  let relogio = 0;
  const fetchImpl = async (url) => {
    pedidos.push(url);
    if (url === 'https://al.ap.leg.br/robots.txt') return { status: 403, ok: false, headers: { get: () => 'text/html' }, text: async () => '<html>403 Forbidden</html>' };
    if (url.endsWith('/robots.txt')) return { status: 200, ok: true, headers: { get: () => 'text/plain' }, text: async () => 'User-agent: *\nDisallow:\n' };
    return { status: 200, ok: true, headers: { get: () => 'text/html' }, text: async () => 'ok' };
  };
  const c = new Cliente({ prazoMs: 1e12, fetchImpl, agora: () => relogio, dormirImpl: async (ms) => { relogio += ms; }, intervaloPadraoS: 3 });
  eq(await c.texto('https://elegis.al.ap.leg.br/portal/proposicoes?ano=2026'), 'ok');
  eq(await c.texto('https://elegis.al.ap.leg.br/portal/proposicao/1'), 'ok');
  eq(pedidos[0], 'https://elegis.al.ap.leg.br/robots.txt', 'robots.txt primeiro');
  ok(relogio >= 6000, 'intervalo mínimo de 3 s entre requisições ao mesmo host');
  eq(await c.texto('https://al.ap.leg.br/pagina.php?pg=exibir_legislatura'), 'ok');
  eq(pedidos[3], 'https://al.ap.leg.br/robots.txt', 'robots.txt do segundo host antes da página');
  ok(/nenhuma restrição/.test(c.resumoRobots()['al.ap.leg.br'].observacao));
  // robots.txt inacessível → host bloqueado
  const c2 = new Cliente({ prazoMs: 1e12, fetchImpl: async () => { throw new Error('timeout'); }, dormirImpl: async () => {} });
  await assert.rejects(() => c2.texto('https://diofe.portal.ap.gov.br/x'), /bloqueado pelo robots/); n++;
}

// ---------------------------------------------------------------- textos
eq(decodificar('Sess&atilde;o Ordin&aacute;ria &Aacute; n&ordm; 4&ordf;'), 'Sessão Ordinária Á nº 4ª');
eq(identificacaoAP(' Projeto de Lei Ordinária nº 0043/26-GEA'), { tipoFonte: 'Projeto de Lei Ordinária', numero: '0043-GEA', ano: 2026, oficial: 'Projeto de Lei Ordinária nº 0043/26-GEA' });
eq(identificacaoAP('Veto nº 0050/26-GEA')?.numero, '0050-GEA');
eq(identificacaoAP('Lei nº 12'), null);

// ---------------------------------------------------------------- deputados
const deps = interpretarDeputadosAP(ler('deputados.html'), HOJE);
eq(deps.legislatura, 'IX Legislatura (2023 / 2027)');
eq(deps.itens.length, 3);
eq(deps.itens[0], {
  id: 'ap-74', id_oficial: 74, uf: 'AP', casa: 'alap', nome: 'Aldilene Souza', tratamento: 'Deputada', partido: 'PDT', cargo_na_casa: null, em_exercicio: null,
  foto: 'https://al.ap.leg.br/fotodeputado/230828122115Aldilene%20Souza.jpg', email: null,
  url_oficial: 'https://al.ap.leg.br/pagina.php?pg=exibir_parlamentar&iddeputado=74',
  lacunas: ['Lista da página "Deputados" da ALAP (IX Legislatura (2023 / 2027)); o partido aparece como escrito na página. O período de mandato e a situação de exercício não vêm nessa página.'],
});
ok(deps.itens.every((d) => !('nome_completo' in d) && !('profissao' in d)), 'nome completo e profissão não são gravados');
eq(deps.itens.map((d) => d.partido), ['PDT', 'UNIÃO BRASIL (UNIÃO)', 'REPUBLICANOS']);
conferirPrivacidade(deps); n++;
const porNome = new Map([...deps.itens.map((d) => [chaveNome(d.nome), d.id]), [chaveNome('Roberto Góes'), 'ap-91']]);

// ---------------------------------------------------------------- autoria
eq(autoresAP('Deputado Roberto Góes', porNome, []), [{ nome: 'Deputado Roberto Góes', tipo: 'Deputado', parlamentar_id: 'ap-91' }]);
eq(autoresAP('Deputada Fulana Sem Cadastro', porNome, []), [{ nome: 'Deputada Fulana Sem Cadastro', tipo: 'Deputado', parlamentar_id: null }], 'sem casamento aproximado');
eq(autoresAP('PODER EXECUTIVO', porNome, []), [{ nome: 'PODER EXECUTIVO', tipo: null, parlamentar_id: null }]);

// ---------------------------------------------------------------- lista de proposições
const lista = interpretarListaProposicoesAP(ler('proposicoes.html'), HOJE, porNome);
eq(lista.total, 224);
ok(lista.proxima, 'há próxima página');
eq(lista.itens.length, 3);
const p0 = lista.itens[0];
eq([p0.id, p0.sigla, p0.numero, p0.ano, p0.data_apresentacao, p0.identificacao], ['ap-111322', 'PLO', '0046-GEA', 2026, '2026-11-04', 'Projeto de Lei Ordinária nº 0046/26-GEA']);
eq(p0.autores, [{ nome: 'PODER EXECUTIVO', tipo: null, parlamentar_id: null }]);
ok(/^Autoriza o Poder Executivo/.test(p0.ementa));
assert.throws(() => interpretarListaProposicoesAP('<section class="app"><p>erro</p></section>', HOJE), /sem o total/); n++;
ok(!temProxima('<a href="?page=1">&laquo; Anterior</a>'), 'sem próxima');

// ---------------------------------------------------------------- ficha
const det = interpretarDetalheAP(ler('ficha.html'), HOJE, 106555);
eq(det.regime, 'Art. 53, I - URGÊNCIA');
eq(det.origem, 'Poder Executivo');
eq(det.data_protocolo, '2026-04-02');
eq(det.url_votacao, 'https://elegis.al.ap.leg.br/portal/proposicao/106555/votacao');
eq(det.veto, { id: 'ap-106746', identificacao: 'Veto nº 0026/26-GEA' });
eq(det.movimentacao[0], { data: '2026-04-13', descricao: 'Proposição Vetada Totalmente: Veto nº 0026/26-GEA' }, 'só a movimentação da proposição, não a do veto');
ok(det.url_pdf.startsWith('https://elegis.al.ap.leg.br/storage/proposicoes/'));
eq(votadoEmSessao(det.movimentacao), [{ data: '2026-04-02', hora: '17:30' }]);
const simples = interpretarDetalheAP(ler('ficha-simples.html'), HOJE, 111290);
eq(simples.url_votacao, null, 'sem botão de votação');
eq(simples.veto, null);
eq(simples.movimentacao.length, 5);
const proj = { ...p0, id: 'ap-106555', id_oficial: 106555, numero: '0009-GEA', identificacao: 'Projeto de Lei Ordinária nº 0009/26-GEA', data_apresentacao: '2026-04-02', url: 'https://elegis.al.ap.leg.br/portal/proposicao/106555' };
const aplicado = aplicarDetalheAP(proj, det, HOJE);
eq(aplicado.situacao.ultima_tramitacao, { data: '2026-04-13', descricao: 'Proposição Vetada Totalmente: Veto nº 0026/26-GEA', local: null });
eq(aplicado.situacao.etapa, null, 'situação não é deduzida');
ok(!aplicado.lacunas.some((l) => /^Andamento: ficha/.test(l)));

// ---------------------------------------------------------------- sessões e votação
const sessoes = interpretarSessoesCsv(ler('sessoes.csv'), HOJE);
eq(sessoes.length, 5);
eq(sessoes[4], { data: '2026-04-02', hora: '17:30', titulo: '7ª Sessão Extraordinária' });
eq(dataDaSessao('7ª Sessão Extraordinária', sessoes, [{ data: '2026-04-02', hora: '17:30' }], '2026-04-02'), { data: '2026-04-02', hora: '17:30' });
eq(dataDaSessao('7ª Sessão Extraordinária', sessoes, [{ data: '2026-04-03', hora: '10:00' }], null), null, 'movimentação diferente → sem data');
eq(dataDaSessao('7ª Sessão Extraordinária', [...sessoes, { data: '2026-12-01', hora: '09:00', titulo: '7ª Sessão Extraordinária' }], [], null), null, 'nome ambíguo → sem data');
const pag = lerPaginaVotacao(ler('votacao.html'));
eq(pag.blocos.length, 1);
eq(pag.blocos[0].sessao, '7ª Sessão Extraordinária');
eq(pag.blocos[0].votos.length, 17);
eq(pag.blocos[0].totais, { sim: 17, nao: 0, abstencao: 0, 'Sem voto': 0 });
const r = votacaoAP(pag.blocos[0], 0, 1, aplicado, det, sessoes, HOJE, porNome);
ok(!r.erro, r.erro);
const v = r.votacao;
eq([v.id, v.data, v.hora, v.tipo, v.orgao, v.resultado], ['ap-106555-v', '2026-04-02', '17:30', 'nominal', 'Plenário', null]);
eq(v.sessao, { titulo: '7ª Sessão Extraordinária', tipo: 'Sessão Extraordinária', numero: 7 });
eq(v.votos[0], { parlamentar_id: 'ap-75', nome: 'Alliny Serrão', partido: null, uf: 'AP', voto: 'Sim', voto_texto_oficial: 'FAVORÁVEL' });
eq(v.placar, { sim: 17, nao: 0, abstencao: 0, 'Sem voto': 0, total: 17 });
eq(v.votos.filter((x) => x.parlamentar_id).length, 2, 'só nomes idênticos aos da lista de deputados (amostra com 3)');
conferirPrivacidade(v); n++;
// conferência: total da página diferente do número de nomes → não grava
const errado = votacaoAP({ ...pag.blocos[0], totais: { ...pag.blocos[0].totais, sim: 18 } }, 0, 1, aplicado, det, sessoes, HOJE, porNome);
ok(/diferente do número de nomes/.test(errado.erro));
ok(/não reconhecido/.test(votacaoAP({ ...pag.blocos[0], votos: [{ nome: 'X', voto_texto_oficial: 'PRESENTE' }] }, 0, 1, aplicado, det, sessoes, HOJE).erro));
ok(/título/.test(lerPaginaVotacao('<section class="app"><h1>Outra</h1></section>').erro));

// ---------------------------------------------------------------- legislação
const leg = interpretarLegislacaoAP(ler('legislacao.html'), HOJE);
eq(leg.total, 70);
eq(leg.itens.length, 2);
const l0 = leg.itens[0];
eq([l0.id, l0.tipo, l0.numero, l0.ano, l0.data_assinatura, l0.data_publicacao], ['lei-3530-2026', 'Lei', 3530, 2026, '2026-09-21', '2026-09-21']);
eq(l0.diario_oficial, { numero: '8745', data: '2026-09-21' });
eq(l0.projeto, { sigla: 'PLO', numero: '0005-PGJ', ano: 2026, url: 'https://elegis.al.ap.leg.br/portal/proposicao/110964' });
eq(l0.projeto_origem_texto, 'Projeto de Lei Ordinária nº 0005/26-PGJ');
eq(l0.url, 'https://elegis.al.ap.leg.br/portal/proposicao/110964/texto-integral');
eq(l0.casa, 'alap');
conferirPrivacidade(leg); n++;
// Variações reais da lista de leis complementares de 2026: "nº nº" repetido e linha sem data.
const lc = ler('legislacao.html').replace('Lei Ordinária nº 3530, de 21/09/2026', 'Lei Complementar nº nº 0189, de 31/08/2026').replace('Lei Ordinária nº 3529, de 21/09/2026', 'Lei Complementar nº 0186');
const legLc = interpretarLegislacaoAP(lc, HOJE, 2026);
eq(legLc.itens.map((x) => [x.id, x.data_assinatura]), [['lc-189-2026', '2026-08-31'], ['lc-186-2026', null]]);
ok(legLc.itens[1].lacunas.some((l) => /Data da norma/.test(l)));

console.log(`ok — ${n} verificações (AP)`);
