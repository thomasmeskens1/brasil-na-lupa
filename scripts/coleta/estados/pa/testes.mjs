#!/usr/bin/env node
// Testes offline do coletor do Pará (ALEPA e Banco de Leis). Amostras reduzidas de respostas reais de 04/11/2026
// (estrutura preservada, listas encurtadas). Rodar: node scripts/coleta/estados/pa/testes.mjs
import assert from 'node:assert/strict';
import { chaveNome, conferirPrivacidade } from '../abertos/base.mjs';
import {
  ClientePA, USER_AGENT_PA, decodificar, identificacaoPA, interpretarDeputadosPA, interpretarListaProposicoesPA,
  interpretarDetalheProposicaoPA, aplicarDetalhePA, interpretarListaVotacoesPA, interpretarVotacaoPA, interpretarNormaPA,
  prefixosIniciais, filhos, dividirJanela, janelasMensais, dataBRdeISO,
} from './alepa.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const HOJE = '2026-11-04';
const pagina = (main, extra = '') => `<html><head><title>ALEPA</title></head><body><nav><span class="dx-vam">Deputados</span></nav><main style="width: 100%;">${main}</main>${extra}</body></html>`;

// ---------------------------------------------------------------- cliente: robots.txt (404) antes de tudo, User-Agent exigido
{
  const pedidos = [];
  let relogio = 0;
  const fetchImpl = async (url, o = {}) => {
    pedidos.push({ url, ua: o.headers?.['User-Agent'], corpo: o.body, tipo: o.headers?.['Content-Type'] });
    if (url.endsWith('/robots.txt')) return { status: 404, ok: false, headers: { get: () => 'text/html' }, text: async () => '<html>404 - File or directory not found.</html>' };
    return { status: 200, ok: true, headers: { get: () => 'text/html; charset=utf-8' }, text: async () => '<main>ok</main>' };
  };
  const c = new ClientePA({ prazoMs: 1e12, fetchImpl, agora: () => relogio, dormirImpl: async (ms) => { relogio += ms; } });
  eq(await c.formulario('https://www.alepa.pa.gov.br/Legislativo/VotacoesNominais', { Ano: '2026', Mes: '10', Mes_VI: '10' }), '<main>ok</main>');
  eq(pedidos[0].url, 'https://www.alepa.pa.gov.br/robots.txt', 'robots.txt primeiro');
  ok(pedidos.every((p) => p.ua === USER_AGENT_PA), 'User-Agent do Brasil na Lupa em todas as requisições');
  eq(USER_AGENT_PA, 'BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)');
  eq(pedidos[1].corpo, 'Ano=2026&Mes=10&Mes_VI=10');
  eq(pedidos[1].tipo, 'application/x-www-form-urlencoded');
  ok(relogio >= 2000, 'intervalo mínimo de 2 s entre requisições ao mesmo host');
  ok(/nenhuma restrição/.test(c.resumoRobots()['www.alepa.pa.gov.br'].observacao));
}

// ---------------------------------------------------------------- textos
eq(decodificar('ANDR&#201;IA XAR&#195;O &amp; N &#186; 11'), 'ANDRÉIA XARÃO & N º 11');
eq(identificacaoPA('PROJETO DE LEI ORDINÁRIA Nº 686/2026, DE 27/10/2026'), { tipoFonte: 'PROJETO DE LEI ORDINÁRIA', numero: 686, ano: 2026, data: '27/10/2026' });
eq(identificacaoPA('PROJETO DE LEI COMPLEMENTAR N º 11/2026'), { tipoFonte: 'PROJETO DE LEI COMPLEMENTAR', numero: 11, ano: 2026, data: null });

// ---------------------------------------------------------------- deputados
const DEP = pagina(`<h1 class="title">Deputados da 61º legislatura </h1>
<script>ASPx.createControl(MVCxClientCardView,'cardView','',{'stateObject':{'keys':['1024','1049','1036'],'callbackState':'x'}});</script>
<div class='card-wrapper-deputado'><div class='card-container'><div class='skeleton-container'><div class='skeleton-image'></div><img class='deputado-image' src='https://alepa.quartertec.com.br\\Content\\Portal\\PerfilAgentePolitico\\DEPUTADO_Adriano Coelho.png?timestamp=639114605658288646' /></div></div><div class='card-info'><span>Deputado</span><span>Adriano Coelho</span><p>MDB</p></div></div>
<div class='card-wrapper-deputado'><div class='card-container'><div class='skeleton-container'><div class='skeleton-image'></div><img class='deputado-image' src='https://alepa.quartertec.com.br\\Content\\Portal\\PerfilAgentePolitico\\DEPUTADO_Angelo Ferrari.png?timestamp=1' /></div></div><div class='card-info'><span>Deputado</span><span>Ângelo Ferrari</span><p>UB</p></div></div>
<div class='card-wrapper-deputado'><div class='card-container'><div class='skeleton-container'><div class='skeleton-image'></div><img class='deputado-image' src='https://alepa.quartertec.com.br\\Content\\Portal\\PerfilAgentePolitico\\DEPUTADO_Aveilton.png?timestamp=2' /></div></div><div class='card-info'><span>Deputado</span><span>Aveilton</span><p>PSD</p></div></div>`);
const deps = interpretarDeputadosPA(DEP, HOJE);
eq(deps.itens.length, 3);
eq(deps.itens[0], {
  id: 'pa-1024', id_oficial: 1024, uf: 'PA', casa: 'alepa', nome: 'Adriano Coelho', tratamento: 'Deputado', partido: 'MDB', cargo_na_casa: null, em_exercicio: null,
  foto: 'https://alepa.quartertec.com.br/Content/Portal/PerfilAgentePolitico/DEPUTADO_Adriano%20Coelho.png', email: null,
  url_oficial: 'https://www.alepa.pa.gov.br/Institucional/Deputado/1024',
  lacunas: ['Lista da página "Deputados da 61ª legislatura" da ALEPA; o período de mandato e a situação de exercício não vêm nessa página.'],
}, 'id oficial vem da ordem das chaves do componente');
eq(deps.itens.map((d) => d.id), ['pa-1024', 'pa-1049', 'pa-1036']);
conferirPrivacidade(deps); n++;
const porNome = new Map(deps.itens.map((d) => [chaveNome(d.nome), d.id]));

// ---------------------------------------------------------------- lista de proposições
const card = (id, autor, ident, ementa, tipo = 'PROJETO%20DE%20LEI%20ORDIN%C3%81RIA') => `<div class="dxbplc"><div onclick='onCardClick("/Legislativo/DetalhesProposicao?IdProposicao=${id}&tipo=${tipo}&situacao=0&decisao=-1&veto=-1")' class='card-proposicao'><h3 style="font-weight: 700; font-size: 1.25rem">${autor}</h3><span>${ident}</span><p>${ementa}</p></div></div>`;
const LISTA = pagina(`<p style='font-size: 1rem;'><b>Erro ao carregar os dados legislativos.</b></p>
${card(16406, 'DEP. ÂNGELO FERRARI', 'PROJETO DE LEI ORDINÁRIA Nº 686/2026, DE 27/10/2026', 'Declara e reconhece como de Utilidade Pública para o Estado do Pará, o Instituto São Francisco de Assis - ISFA localizado no Município de Belém/PA.')}
${card(16390, 'PODER EXECUTIVO', 'PROJETO DE LEI ORDINÁRIA Nº 680/2026, DE 20/10/2026', 'Autoriza o Poder Executivo a doar imóvel ao Município.')}
${card(16407, 'DEP. TORRINHO TORRES', 'INDICAÇÃO Nº 96/2026, DE 28/10/2026', 'Requer à Governadora.', 'INDICA%C3%87%C3%83O')}
<script>ASPx.createControl(MVCxClientCardView,'cardViewProposicoes','',{'stateObject':{'keys':['16406','16390']},'pageRowCount':10,'pageIndex':0,'pageCount':1});</script>`);
{
  const r = interpretarListaProposicoesPA(LISTA, HOJE, porNome);
  eq(r.paginas, 1);
  eq(r.itens.length, 2, 'indicação fica de fora');
  eq(r.vazia, false);
  const p = r.itens[0];
  eq([p.id, p.sigla, p.tipo, p.numero, p.ano, p.identificacao, p.data_apresentacao], ['pa-16406', 'PL', 'Projeto de Lei', 686, 2026, 'PL 686/2026', '2026-10-27']);
  eq(p.autores, [{ nome: 'DEP. ÂNGELO FERRARI', tipo: 'DEPUTADO', parlamentar_id: 'pa-1049' }], 'autor ligado pelo nome idêntico');
  eq(p.url_pdf, 'https://downloads.alepa.pa.gov.br/Projeto/16406.PDF');
  eq(r.itens[1].autores, [{ nome: 'PODER EXECUTIVO', tipo: null, parlamentar_id: null }]);
  conferirPrivacidade(r.itens); n++;
  const varias = interpretarListaProposicoesPA(LISTA.replace("'pageCount':1", "'pageCount':3"), HOJE);
  eq(varias.paginas, 3, 'mais de uma página: a janela será dividida');
  const vazia = interpretarListaProposicoesPA(pagina(`<div id="cardViewProposicoes_DXEmptyCard" class="dxcvEmptyCard_Office365">Não foi encontrada nenhuma proposição</div><script>{'pageCount':0}</script>`), HOJE);
  eq([vazia.itens.length, vazia.vazia, vazia.paginas], [0, true, 0]);
  assert.throws(() => interpretarListaProposicoesPA('<html><head><title>Ops... - ALEPA</title></head><main>Não foi possível carregar a página no momento.</main></html>', HOJE), /erro do portal/); n++;
  assert.throws(() => interpretarListaProposicoesPA(pagina('<p>outra coisa</p>'), HOJE), /sem cartões/); n++;
}

// ---------------------------------------------------------------- detalhe da proposição
const DETALHE = pagina(`<h3 class="sub-title">PROJETO DE LEI COMPLEMENTAR Nº 11/2026</h3>
<img src="/Content/Images/chevron-down.svg" alt="" /><span class="dxnb-ghtext dx-vam">REFER&#202;NCIAS</span></div>
<img src="/Content/Images/chevron-right.svg" alt="" /><span class="dxnb-ghtext dx-vam">REFER&#202;NCIAS</span></div><ul class="dxnb-content items-container dxnb-left">
<li class="dxnb-tmpl dxnb-last"><div class='items-container'><p>Tipo de Proposição: PROJETO DE LEI COMPLEMENTAR</p><p>Número: 11</p><p>Origem: EXTERNA</p><p>Entrada: PROTOCOLO</p><p>Data da Entrada: 06/10/2026</p><p>Autor: MINISTÉRIO PÚBLICO DO ESTADO</p><p>Ementa: Altera dispositivo da Lei Complementar Estadual nº 057, de 6 de julho de 2006.</p><p>Regime: MATÉRIA EM REGIME NORMAL</p><p>Situação: AGUARDAR SANÇÃO OU VETO</p></div></li></ul>
<span class="dxnb-ghtext dx-vam">VOTA&#199;&#195;O NO PLEN&#193;RIO</span></div>
<span class="dxnb-ghtext dx-vam">VOTA&#199;&#195;O NO PLEN&#193;RIO</span></div><ul><li class="dxnb-tmpl dxnb-last"><div class='items-container'><div style='padding: 0; margin: 0; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid grey'><a href = "/Legislativo/DetalhesVotacaoNominal?IdProposicao=16368&IdVotacao=8877" target = "_blank" class= "download-button" ><span> Download </span ></a><p>Turno: 1º TURNO: (VOTAÇÃO NOMINAL)</p><p>Data: 03/11/2026</p><p>Resultado: APROVADA</p></div><div style='padding: 0; margin: 0; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid grey'><p>Turno: REDAÇÃO FINAL</p><p>Data: 03/11/2026</p><p>Resultado: APROVADA</p></div></div></li></ul>
<span class="dxnb-ghtext dx-vam">ANEXOS</span></div>`);
{
  const d = interpretarDetalheProposicaoPA(DETALHE, HOJE);
  eq([d.situacao, d.regime, d.data_entrada, d.origem], ['AGUARDAR SANÇÃO OU VETO', 'MATÉRIA EM REGIME NORMAL', '2026-10-06', 'EXTERNA']);
  eq(d.turnos, [
    { turno: '1º TURNO: (VOTAÇÃO NOMINAL)', data: '2026-11-03', resultado: 'APROVADA', id_votacao: 8877 },
    { turno: 'REDAÇÃO FINAL', data: '2026-11-03', resultado: 'APROVADA', id_votacao: null },
  ]);
  const base = interpretarListaProposicoesPA(LISTA, HOJE).itens[0];
  const a = aplicarDetalhePA(base, d, HOJE);
  eq(a.situacao.texto, 'AGUARDAR SANÇÃO OU VETO');
  eq(a.situacao.ultima_tramitacao.data, '2026-11-03');
  ok(!a.lacunas.some((l) => /^Situação: detalhe/.test(l)), 'lacuna do detalhe removida');
  eq(a.detalhe_coletado_em, HOJE);
  eq(interpretarDetalheProposicaoPA(pagina('<p>Ops</p>'), HOJE), null);
}

// ---------------------------------------------------------------- votações nominais
const LISTA_VN = pagina(`<div class='pauta-container'> <div class='pauta-item'><a class='pauta-item-title' href='/Legislativo/DetalhesVotacaoNominal?IdProposicao=16368&IdVotacao=8877'>03/11/2026 - PROJETO DE LEI COMPLEMENTAR N º 11/2026 - 1º TURNO</a><div class='pauta-item-buttons'><a class='download-button' href='/Legislativo/DetalhesVotacaoNominal?IdProposicao=16368&IdVotacao=8877&type=PDF'>PDF</a></div></div></div>
<script>{'pageCount':1}</script>`);
eq(interpretarListaVotacoesPA(LISTA_VN, HOJE), { itens: [{ id_proposicao: 16368, id_votacao: 8877, data: '2026-11-03', titulo: '03/11/2026 - PROJETO DE LEI COMPLEMENTAR N º 11/2026 - 1º TURNO' }], paginas: 1 });
assert.throws(() => interpretarListaVotacoesPA(pagina('<p>Erro ao carregar os dados, tente novamente mais tarde.</p>'), HOJE), /Erro ao carregar/); n++;

const item = (s) => `<div class="voto-item">\n                        ${s}\n                    </div>`;
const secao = (titulo, pares, qtd) => `<div class="section-title">${titulo}</div>\n            <div class="votos-lista">${pares.map(([a, b]) => item(a) + item(b)).join('')}\n            </div>\n            <p class="quantidade">Quantidade: ${qtd ?? pares.length}</p>`;
const votacaoHtml = ({ sim = [['ANA CUNHA', 'MDB'], ['&#194;NGELO FERRARI', 'FE UNI&#195;O PP'], ['AVEILTON SOUZA', 'PSD']], qtdSim, votacao = 'VOTAÇÃO NOMINAL' } = {}) => pagina(`<div class="titulo-geral">VOTAÇÃO NOMINAL</div>
<table class="table-header">
<tr><td><strong>Tipo:</strong> SESS&#195;O ORDIN&#193;RIA</td><td><strong>Número:</strong> 30</td></tr>
<tr><td><strong>Projeto:</strong> PROJETO DE LEI COMPLEMENTAR N &#186; 11/2026</td><td><strong>Data:</strong> 03/11/2026</td></tr>
<tr><td><strong>Autor:</strong> MINIST&#201;RIO P&#218;BLICO DO ESTADO</td><td><strong>Votação:</strong> ${votacao}</td></tr>
<tr><td><strong>Turno:</strong> 1&#186; TURNO</td><td><strong>Resultado:</strong> APROVADA</td></tr>
</table>
<div class="section-title-header"><span>Nome</span><span>Partido</span></div>
${secao('SIM', sim, qtdSim)}
${secao('N&#195;O', [])}
${secao('ABSTEN&#199;&#195;O', [])}
${secao('N&#195;O VOTARAM', [['ADRIANO COELHO', 'MDB']])}`);
{
  const projetos = new Map([['pa-16368', { ementa: 'Altera dispositivo da Lei Complementar Estadual nº 057.' }]]);
  const { votacao: v, erro } = interpretarVotacaoPA(votacaoHtml(), { id_proposicao: 16368, id_votacao: 8877 }, HOJE, porNome, projetos);
  eq(erro, undefined);
  eq([v.id, v.data, v.orgao, v.tipo, v.resultado, v.resultado_texto_oficial, v.etapa], ['pa-8877', '2026-11-03', 'Plenário', 'nominal', 'aprovada', 'APROVADA', '1º TURNO']);
  eq(v.sessao, { titulo: '30ª Sessão ordinária', tipo: 'SESSÃO ORDINÁRIA', numero: 30 });
  eq(v.proposicao, { id: 'pa-16368', sigla: 'PLC', tipo: 'Projeto de Lei Complementar', numero: 11, ano: 2026, ementa: 'Altera dispositivo da Lei Complementar Estadual nº 057.', url: 'https://www.alepa.pa.gov.br/Legislativo/DetalhesProposicao?IdProposicao=16368' });
  eq(v.placar, { sim: 3, nao: 0, abstencao: 0, 'Não votaram': 1, total: 4 });
  eq(v.votos.map((x) => [x.nome, x.partido, x.voto, x.parlamentar_id]), [
    ['ANA CUNHA', 'MDB', 'Sim', null], ['ÂNGELO FERRARI', 'FE UNIÃO PP', 'Sim', 'pa-1049'], ['AVEILTON SOUZA', 'PSD', 'Sim', null], ['ADRIANO COELHO', 'MDB', 'Não votou', 'pa-1024'],
  ], 'partido como impresso na votação; ligação só por nome idêntico ("Aveilton" ≠ "AVEILTON SOUZA")');
  ok(v.lacunas.some((l) => /grafia idêntica/.test(l)));
  conferirPrivacidade(v); n++;
  // Conferência: quantidade diferente do número de nomes, nome sem partido, forma não nominal → nada é gravado.
  ok(/quantidade 4/.test(interpretarVotacaoPA(votacaoHtml({ qtdSim: 4 }), { id_proposicao: 1, id_votacao: 2 }, HOJE).erro), 'quantidade não confere');
  ok(/sem partido/.test(interpretarVotacaoPA(votacaoHtml({ sim: [['ANA CUNHA', 'MDB'], ['X', '']] }).replace(/<div class="voto-item">\s*\n\s*<\/div>/, ''), { id_proposicao: 1, id_votacao: 2 }, HOJE).erro), 'célula faltando');
  ok(/repetido/.test(interpretarVotacaoPA(votacaoHtml({ sim: [['ADRIANO COELHO', 'MDB']] }), { id_proposicao: 1, id_votacao: 2 }, HOJE).erro), 'deputado em duas listas');
  ok(/não é nominal/.test(interpretarVotacaoPA(votacaoHtml({ votacao: 'SIMBÓLICA' }), { id_proposicao: 1, id_votacao: 2 }, HOJE).erro));
  ok(interpretarVotacaoPA(pagina('<p>nada</p>'), { id_proposicao: 1, id_votacao: 2 }, HOJE).erro);
}

// ---------------------------------------------------------------- Banco de Leis
{
  const lei = interpretarNormaPA({ id: 32532, numero: '11666', ano: '2026', tipo: 'Lei Ordinária', ementa: 'Dispõe sobre as diretrizes para a elaboração e a execução da Lei Orçamentária Anual de 2027.', arquivo: 'lei_20260805105738_151029fb.pdf', link_pdf: 'https://bancodeleis.alepa.pa.gov.br/arquivos/lei_20260805105738_151029fb.pdf' }, HOJE);
  eq([lei.id, lei.tipo, lei.numero, lei.ano, lei.nome_oficial, lei.casa, lei.data_assinatura, lei.data_publicacao], ['lei-11666-2026', 'Lei', 11666, 2026, 'Lei nº 11.666/2026', 'alepa', null, null], 'datas não vêm da API: nada deduzido do nome do arquivo');
  eq(lei.url, 'https://bancodeleis.alepa.pa.gov.br/arquivos/lei_20260805105738_151029fb.pdf');
  ok(lei.lacunas.some((l) => /não informadas pela API/.test(l)));
  const dec = interpretarNormaPA({ id: 1, numero: '5679', ano: '2026', tipo: 'Decreto Estadual', ementa: 'Nomeia.', link_pdf: 'https://bancodeleis.alepa.pa.gov.br/arquivos/x.pdf' }, HOJE);
  eq([dec.id, dec.tipo], ['dec-5679-2026', 'Decreto']);
  const res = interpretarNormaPA({ id: 7, numero: '00', ano: '2026', tipo: 'Resoluções', ementa: 'Resolução.', link_pdf: 'https://outro.host/x.pdf' }, HOJE);
  eq([res.id, res.numero, res.url], ['res-id7-2026', null, null], 'número "00" e PDF fora do Banco de Leis não são usados');
  eq(interpretarNormaPA({ id: 9, numero: '1', ano: '2026', tipo: 'Portaria' }, HOJE), null);
  eq(prefixosIniciais(11666).slice(0, 3), ['116', '115', '114']);
  eq(prefixosIniciais(5679).slice(0, 2), ['56', '55']);
  eq(prefixosIniciais(38), ['3', '2', '1']);
  eq(filhos('56').length, 10);
  eq(filhos('56')[9], '569');
}

// ---------------------------------------------------------------- janelas de datas
eq(dividirJanela('2026-10-01', '2026-10-31', 4), [['2026-10-01', '2026-10-08'], ['2026-10-09', '2026-10-16'], ['2026-10-17', '2026-10-23'], ['2026-10-24', '2026-10-31']]);
eq(dividirJanela('2026-10-01', '2026-10-02', 5), [['2026-10-01', '2026-10-01'], ['2026-10-02', '2026-10-02']], 'nunca menor que um dia');
{
  const partes = dividirJanela('2026-02-01', '2026-02-28', 7);
  eq(partes[0][0], '2026-02-01'); eq(partes[6][1], '2026-02-28');
  for (let i = 1; i < partes.length; i++) ok(Date.parse(partes[i][0]) - Date.parse(partes[i - 1][1]) === 86400000, 'janelas contíguas, sem buraco nem sobreposição');
}
eq(janelasMensais(2026, HOJE).length, 11);
eq(janelasMensais(2026, HOJE)[10], ['2026-11-01', '2026-11-30']);
eq(janelasMensais(2026, HOJE)[1], ['2026-02-01', '2026-02-28']);
eq(dataBRdeISO('2026-10-01'), '01/10/2026');

console.log(`PA: ${n} verificações ok`);
