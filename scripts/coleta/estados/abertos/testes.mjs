#!/usr/bin/env node
// Testes offline do coletor de fontes abertas (PE e DF). Amostras reduzidas a partir de respostas reais
// de 03/11/2026 (estrutura preservada; dados pessoais trocados por valores fictícios).
import assert from 'node:assert/strict';
import { interpretarRobots, permitido, Cliente, dataISO, conferirPrivacidade, emailInstitucional, slug } from './base.mjs';
import { lerXml, filho, textoDe } from './xml.mjs';
import {
  interpretarParlamentaresPE, interpretarListaPE, interpretarDetalhePE, aplicarDetalhePE, votacoesDoProjetoPE,
  interpretarListaNormasPE, ligarNormasPE,
} from './pe.mjs';
import { interpretarAutoresDF, interpretarProposicaoDF, interpretarNormaListaDF, aplicarDetalheNormaDF, separarSigla } from './df.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const HOJE = '2026-11-03';

// ---------------------------------------------------------------- base
{
  const r = interpretarRobots('User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nCrawl-Delay: 10\nDisallow: /api/\nDisallow: /dataset/*/history\n');
  eq(r.crawl_delay_s, 10, 'crawl-delay do grupo *');
  ok(!permitido(r, '/api/3/action/package_list'), '/api/ proibido');
  ok(permitido(r, '/dataset/proposicoes'), '/dataset liberado');
  ok(!permitido(r, '/dataset/x/history'), 'curinga');
  const nosso = interpretarRobots('User-agent: brasilnalupa\nDisallow: /\nUser-agent: *\nDisallow:\n');
  ok(!permitido(nosso, '/qualquer'), 'grupo com o nosso agente vale');
  eq(dataISO('26/05/2026', HOJE), '2026-05-26');
  eq(dataISO('2026-10-20T00:00:00', HOJE), '2026-10-20');
  eq(dataISO('31/02/2026', HOJE), null, 'data impossível');
  eq(dataISO('01/01/2027', HOJE), null, 'data futura');
  eq(emailInstitucional('dep.fulano@cl.df.gov.br', ['cl.df.gov.br']), 'dep.fulano@cl.df.gov.br');
  eq(emailInstitucional('pessoal@gmail.com', ['cl.df.gov.br']), null, 'e-mail pessoal descartado');
  eq(slug('Álvaro Porto'), 'alvaro-porto');
  assert.throws(() => conferirPrivacidade({ a: [{ ipUsuario: '1.2.3.4' }] }), /chave proibida/); n++;
  assert.throws(() => conferirPrivacidade({ t: 'portador do 123.456.789-01' }), /documento pessoal/); n++;
  conferirPrivacidade({ ementa: 'Dispõe sobre o CPF na nota fiscal', valor: 'R$ 45.152.324,00' }); n++;
}

// Cliente: robots.txt é a 1ª requisição ao host; intervalo respeitado; caminho proibido nunca é pedido.
{
  const pedidos = [];
  let relogio = 0;
  const fetchImpl = async (url) => {
    pedidos.push({ url, t: relogio });
    if (url.endsWith('/robots.txt')) return { status: 200, ok: true, headers: { get: () => 'text/plain' }, text: async () => 'User-agent: *\nCrawl-delay: 5\nDisallow: /privado/\n' };
    return { status: 200, ok: true, headers: { get: () => 'application/json' }, text: async () => '{"ok":true}' };
  };
  const c = new Cliente({ prazoMs: 1e12, fetchImpl, agora: () => relogio, dormirImpl: async (ms) => { relogio += ms; } });
  const d = await c.json('https://exemplo.gov.br/api/x');
  eq(d, { ok: true });
  await c.json('https://exemplo.gov.br/api/y');
  ok(pedidos[0].url.endsWith('/robots.txt'), 'robots primeiro');
  ok(pedidos[2].t - pedidos[1].t >= 6000, 'Crawl-delay 5 → 6 s entre requisições');
  await assert.rejects(() => c.json('https://exemplo.gov.br/privado/z'), /robots/); n++;
  eq(pedidos.length, 3, 'caminho proibido não gerou requisição');
}

// ---------------------------------------------------------------- xml
{
  const r = lerXml('<?xml version="1.0"?><a x="1 &amp; 2"><b>texto &lt;ok&gt;</b><c><![CDATA[<p>bruto</p>]]></c><d/></a>');
  eq(r.attrs.x, '1 & 2');
  eq(textoDe(r, 'b'), 'texto <ok>');
  eq(textoDe(r, 'c'), '<p>bruto</p>');
  ok(filho(r, 'd'), 'tag autofechada');
}

// ---------------------------------------------------------------- PE
const PARL_PE = [{ nomeParlamentar: 'João Paulo do PT', partido: 'PT' }, { nomeParlamentar: 'Junior Matuto', partido: 'PSB' }];
const LISTA_PE = `<?xml version='1.0' encoding='utf-8'?>
<projetos>
  <projeto docid="16052" numero="3692" ano="2026" legislatura="VIGÉSIMA " tipo="PROJETO DE LEI ORDINÁRIA" subtipo="" ementa="Altera a Lei nº 19.129, de 23 de dezembro de 2025, que autoriza o Poder Executivo a contratar operação de crédito." dataPublicacao="03/01/2026"><autores><autor nome="RAQUEL TEIXEIRA LYRA LUCENA" tipo="EXTERNO"/></autores></projeto>
  <projeto docid="16370" numero="33" ano="2026" legislatura="VIGÉSIMA " tipo="PROPOSTA DE EMENDA A CONSTITUIÇÃO" subtipo="" ementa="Altera a Constituição do Estado de Pernambuco." dataPublicacao="31/03/2026"><autores><autor nome="João Paulo do PT" tipo="DEPUTADO"/></autores></projeto>
</projetos>`;
const DET_PE = `<?xml version='1.0' encoding='utf-8'?>
<projeto ano="2026" legislatura="VIGÉSIMA " numero="3692" tipo="PROJETO DE LEI ORDINÁRIA">
  <autores><autor nome="RAQUEL TEIXEIRA LYRA LUCENA" tipo="EXTERNO"/></autores>
  <ementa>Altera a Lei nº 19.129.</ementa><justificativa>MENSAGEM Nº 72/2025 ...</justificativa>
  <regimeTramitacao>Urgência</regimeTramitacao>
  <historico><evento data="02/01/2026"><acao>ASSINADO</acao></evento><evento data="16/07/2026"><acao>AUTÓGRAFO SANCIONADO</acao></evento></historico>
  <resultadoFinal>AUTÓGRAFO SANCIONADO</resultadoFinal>
  <historicoResultado><discussao data="26/05/2026"><resultado>APROVADA EM PRIMEIRA DISCUSSÃO</resultado></discussao><discussao data="27/05/2026"><resultado>APROVADA EM SEGUNDA DISCUSSÃO</resultado></discussao><discussao data="20/05/2026"><resultado>ADIADA</resultado></discussao></historicoResultado>
  <autografo><lei>19246</lei><resultado>SANCAO</resultado><datas><data tipo="envioExecutivo">28/05/2026</data><data tipo="assinatura">04/06/2026</data></datas></autografo>
  <lotacaoAtual>SECRETARIA GERAL DA MESA DIRETORA (SEGMD)</lotacaoAtual>
</projeto>`;
const NORMAS_PE = `<table><tr><th>Norma</th></tr>
<tr> <td class="td-nome-norma col-md-3"> <span class="nome-norma"><a href='texto.aspx?id=88200&tipo='''>Lei Ordinária n° 19.246</a></span> <span class="publicacao">Publicada no DOE 05/06/2026</span> </td> <td class="ementa-norma col-md-7"> <div class="fLeft"> Altera a Lei nº 19.129, de 23 de dezembro de 2025. </div> </td> </tr>
<tr> <td class="td-nome-norma col-md-3"> <span class="nome-norma"><a href='texto.aspx?id=10727&tipo='''>Estatuto dos Servidores</a></span> </td> </tr>
</table>`;
{
  const parl = interpretarParlamentaresPE(PARL_PE, HOJE);
  eq(parl.itens.length, 2);
  eq(parl.itens[0].id, 'joao-paulo-do-pt');
  eq(parl.itens[0].em_exercicio, null, 'situação de exercício não é deduzida');
  const lista = interpretarListaPE(LISTA_PE, HOJE, parl.itens);
  eq(lista.length, 2);
  const plo = lista[0];
  eq([plo.id, plo.sigla, plo.numero, plo.ano, plo.identificacao, plo.data_publicacao], ['pe-16052', 'PLO', 3692, 2026, 'PLO 3692/2026', '2026-01-03']);
  eq(lista[1].autores[0], { nome: 'João Paulo do PT', tipo: 'DEPUTADO', parlamentar_id: 'joao-paulo-do-pt' }, 'autor deputado ligado pelo nome exato');
  const det = interpretarDetalhePE(DET_PE, HOJE);
  eq(det.discussoes.length, 3);
  eq(det.lei.numero, 19246);
  const comDet = aplicarDetalhePE(plo, det, HOJE);
  eq(comDet.situacao.etapa, 'AUTÓGRAFO SANCIONADO');
  eq(comDet.situacao.ultima_tramitacao, { data: '2026-07-16', descricao: 'AUTÓGRAFO SANCIONADO' });
  const vot = votacoesDoProjetoPE(comDet, HOJE);
  eq(vot.length, 2, '"ADIADA" não vira votação');
  eq([vot[0].tipo, vot[0].votos.length, vot[0].orgao, vot[0].resultado_texto_oficial], [null, 0, 'Plenário', 'APROVADA EM PRIMEIRA DISCUSSÃO']);
  ok(vot[0].lacunas.some((l) => l.includes('Informação não disponível em fonte oficial')), 'voto individual indisponível');
  const normas = interpretarListaNormasPE(NORMAS_PE, 1, HOJE);
  eq(normas.length, 1, 'linha que não é Lei Ordinária fica de fora');
  eq([normas[0].id, normas[0].numero, normas[0].data_publicacao], ['lei-19246-2026', 19246, '2026-06-05']);
  ligarNormasPE(normas, [comDet]);
  eq(normas[0].projeto_origem.identificacao, 'PLO 3692/2026', 'lei ligada ao projeto pelo autógrafo');
  eq(normas[0].data_assinatura, '2026-06-04');
  eq(comDet.situacao.url_norma, normas[0].url);
  conferirPrivacidade([parl, lista, comDet, vot, normas]); n++;
}

// ---------------------------------------------------------------- DF
const AUTORES_DF = [
  { id: 59, nome: 'Deputado Pastor Daniel de Castro', situacao: 'ATIVO', tipoAutor: 'PARLAMENTAR', urlImagem: 'https://www.cl.df.gov.br/documents/x.jpg', email: 'dep.exemplo@cl.df.gov.br', partidoPoliticoSigla: null, usuarioLogin: null, matricula: null },
  { id: 20, nome: 'Deputado Fulano', situacao: 'ATIVO', tipoAutor: 'PARLAMENTAR', urlImagem: null, email: 'contato@exemplo.com.br', partidoPoliticoSigla: null },
  { id: 3, nome: 'Deputado Antigo', situacao: 'INATIVO', tipoAutor: 'PARLAMENTAR' },
  { id: 8, nome: 'Comissão de Constituição e Justiça', situacao: 'ATIVO', tipoAutor: 'UNIDADE_INTERNA' },
];
const PROP_DF = { id: 159515, tipoProposicao: 'Projeto de Lei', ementa: 'Dispõe sobre o direito de pais à informação prévia.', siglaNumeroAno: 'PL 2519/2026', dataLeitura: '2026-11-03', autoria: 'Deputado Pastor Daniel de Castro', etapa: 'Apresentação', regiaoAdministrativaNome: '#DISTRITO FEDERAL (INTEIRO)#', temaNome: '#Primeira Infância#' };
const NORMA_LISTA_DF = { id: 41840, tipoNorma: 'Lei', autores: 'Poder Executivo', ementa: 'Abre crédito adicional à Lei Orçamentária Anual do Distrito Federal no valor de R$ 53.148.236,00.', ano: 2026, dataAssinatura: '2026-10-20', siglaNumeroAno: 'Lei 7945/2026' };
const NORMA_DET_DF = {
  id: 41840, tipoNorma: { id: 1, nomeTipoNorma: 'Lei' }, normaOrigem: { id: 1, sigla: 'CLDF' },
  proposicaoNorma: { id: 159323, numeroDefinitivo: '2492/2026', tipoProposicao: { sigla: 'PL', nome: 'Projeto de Lei' } },
  normaFontes: [
    { publicacaoDiario: { dataPublicacao: '2026-10-21T00:00:00', nomeCompleto: 'DODF, 119, de 21 de outubro de 2026', urlPublicacao: 'https://dodf.df.gov.br/dodf/jornal/visualizar-pdf?pasta=b' }, tipoPublicacao: { nome: 'Republicação' } },
    { publicacaoDiario: { dataPublicacao: '2026-10-20T00:00:00', nomeCompleto: 'DODF, 118-A, de 20 de outubro de 2026 - Edição Extra', urlPublicacao: 'https://dodf.df.gov.br/dodf/jornal/visualizar-pdf?pasta=a' }, tipoPublicacao: { nome: 'Publicação' } },
  ],
  normaTemas: [{ tema: { nome: 'Tributos / Orçamento' } }],
  anexo: { usuarioUpload: null },
};
{
  const parl = interpretarAutoresDF(AUTORES_DF, HOJE);
  eq(parl.itens.map((p) => p.id), ['20', '59'], 'só parlamentares ATIVO, ordem alfabética');
  eq(parl.itens[1].email, 'dep.exemplo@cl.df.gov.br');
  eq(parl.itens[0].email, null, 'e-mail fora do domínio institucional descartado');
  eq(parl.itens[0].partido, null, 'partido ausente fica null');
  eq(separarSigla('PL 2519/2026'), { sigla: 'PL', numero: 2519, ano: 2026 });
  const porNome = new Map(parl.itens.map((p) => [p.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(), p.id]));
  const p = interpretarProposicaoDF(PROP_DF, HOJE, porNome);
  eq([p.id, p.sigla, p.numero, p.ano, p.data_leitura, p.data_apresentacao, p.situacao.etapa], ['df-159515', 'PL', 2519, 2026, '2026-11-03', null, 'Apresentação']);
  eq(p.autores, [{ nome: 'Deputado Pastor Daniel de Castro', parlamentar_id: '59' }]);
  eq([p.tema, p.regiao_administrativa], ['Primeira Infância', 'DISTRITO FEDERAL (INTEIRO)']);
  eq(p.url, 'https://ple.cl.df.gov.br/#/proposicao/159515/consultar');
  const nl = interpretarNormaListaDF(NORMA_LISTA_DF, HOJE);
  eq([nl.id, nl.numero, nl.data_assinatura, nl.detalhe_coletado], ['lei-7945-2026', 7945, '2026-10-20', false]);
  const nd = aplicarDetalheNormaDF(nl, NORMA_DET_DF, HOJE);
  eq([nd.data_publicacao, nd.publicacao], ['2026-10-20', 'DODF, 118-A, de 20 de outubro de 2026 - Edição Extra'], 'publicação original, não a republicação');
  eq(nd.projeto_origem, { id: 'df-159323', identificacao: 'PL 2492/2026', sigla: 'PL', numero: 2492, ano: 2026, url: 'https://ple.cl.df.gov.br/#/proposicao/159323/consultar' });
  eq(nd.url, 'https://dodf.df.gov.br/dodf/jornal/visualizar-pdf?pasta=a');
  ok(!nd.lacunas.some((l) => /detalhe da norma ainda não coletado/.test(l)), 'lacuna resolvida');
  eq(aplicarDetalheNormaDF(nl, { ...NORMA_DET_DF, id: 1 }, HOJE), nl, 'detalhe de outra norma é ignorado');
  conferirPrivacidade([parl, p, nd]); n++;
}

console.log(`OK: ${n} conferências.`);
