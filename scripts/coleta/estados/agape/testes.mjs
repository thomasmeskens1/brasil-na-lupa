// Testes offline do coletor Ágape (sem rede). Uso: node scripts/coleta/estados/agape/testes.mjs
// Dados de teste sintéticos, no formato da API do SPL (sem nome nem documento de pessoa real).
import assert from 'node:assert/strict';
import { interpretarRobots, permitido, ClienteHost, Bloqueado, SemTempo } from './http.mjs';
import { extrairDeliberacoes, normasCitadas, datasNoTexto, placarDoTexto, LACUNA_VOTO_INDIVIDUAL, VOTO_INDISPONIVEL } from './deliberacoes.mjs';
import { dataHora, urlArquivo, normParlamentar, indiceParlamentares, normProposicao, autorPublico, NOME_OMITIDO } from './normalizar.mjs';
import { interpretarListaAlese, juntarNormasSE, normLegison, normasDaTramitacao, prefixoNorma } from './normas.mjs';
import { montarVotacao, proposicaoPublicada, idVotacao } from './montar.mjs';
import { CASAS, LACUNA_SITUACAO_ALBA, TIPOS_LEGISON } from './casas.mjs';

let ok = 0;
const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

// ------------------------------------------------------------ robots.txt (RFC 9309)
teste('robots: "User-agent: *" seguido de linha em branco e outro agente forma um grupo só', () => {
  const r = interpretarRobots('User-agent: *\n\nUser-agent: SemrushBot\nDisallow: /\n\nUser-agent: YandexBot\nDisallow: /admin/\nAllow: /core/*.css$\n');
  assert.deepEqual(r.disallow, ['/']);
  assert.equal(permitido(r, '/documentos?categoria[0]=7'), false);
});
teste('robots: Allow / libera tudo; regra mais longa vence', () => {
  assert.equal(permitido(interpretarRobots('User-agent: *\nAllow: /\n'), '/api/publico/proposicao/?ano=2026'), true);
  const r = interpretarRobots('User-agent: *\nDisallow: /admin/\nDisallow: /search/\nAllow: /search/ok$\n');
  assert.equal(permitido(r, '/admin/x'), false);
  assert.equal(permitido(r, '/search/ok'), true);
  assert.equal(permitido(r, '/documentos/lei-1'), true);
});
teste('robots: grupo específico do nosso agente prevalece sobre "*"', () => {
  const r = interpretarRobots('User-agent: *\nDisallow: /\n\nUser-agent: brasil-na-lupa-coletor\nAllow: /\n');
  assert.equal(r.grupo, 'especifico');
  assert.equal(permitido(r, '/qualquer'), true);
});

// ------------------------------------------------------------ cliente HTTP
function falsoFetch(respostas, chamadas) {
  return async (url, op) => {
    chamadas.push({ url, metodo: op.method, ua: op.headers['User-Agent'] });
    const r = respostas.shift();
    if (!r) throw new Error('sem resposta preparada');
    return { status: r.status, text: async () => r.corpo ?? '', headers: { get: () => null, getSetCookie: () => r.cookies || [] } };
  };
}
teste('cliente: robots.txt é a primeira requisição; caminho proibido nunca é pedido', async () => {
  const chamadas = [];
  const c = new ClienteHost('exemplo.gov.br', { fetchImpl: falsoFetch([{ status: 200, corpo: 'User-agent: *\nDisallow: /privado\n' }], chamadas), dormir: async () => {}, pausaMs: 0 });
  await assert.rejects(() => c.json('/api/x'), /ainda não lido/);
  assert.equal(chamadas.length, 0);
  await c.lerRobots();
  assert.match(chamadas[0].url, /\/robots\.txt$/);
  assert.match(chamadas[0].ua, /Brasil na Lupa/);
  await assert.rejects(() => c.json('/privado/1'), Bloqueado);
  assert.equal(chamadas.length, 1);
});
teste('cliente: retenta 500, devolve JSON; 404 vira null; 403 interrompe sem contorno', async () => {
  const chamadas = [];
  const c = new ClienteHost('exemplo.gov.br', {
    fetchImpl: falsoFetch([{ status: 404 }, { status: 500 }, { status: 200, corpo: '{"total":1}' }, { status: 404 }, { status: 403 }], chamadas),
    dormir: async () => {}, pausaMs: 0,
  });
  const rob = await c.lerRobots();
  assert.equal(rob.raiz_permitida, true);
  assert.deepEqual((await c.json('/api/a')).json, { total: 1 });
  assert.equal(await c.json('/api/b'), null);
  await assert.rejects(() => c.json('/api/c'), Bloqueado);
  await assert.rejects(() => c.json('/api/d'), Bloqueado);
  assert.equal(chamadas.length, 5);
});
teste('cliente: nenhuma requisição começa depois do prazo', async () => {
  const chamadas = [];
  const c = new ClienteHost('exemplo.gov.br', { prazoMs: 0, fetchImpl: falsoFetch([], chamadas), dormir: async () => {}, pausaMs: 0 });
  await assert.rejects(() => c.lerRobots(), SemTempo);
  assert.equal(chamadas.length, 0);
});

// ------------------------------------------------------------ normalização
teste('datas e URLs: domínio duplicado da Alese corrigido; host estranho recusado', () => {
  assert.deepEqual(dataHora('03/09/2026 09:58:42'), { data: '2026-09-03', hora: '09:58' });
  assert.deepEqual(dataHora('31/02/2026'), { data: null, hora: null });
  assert.equal(dataHora('2026-10-07T00:00:00').data, '2026-10-07');
  const h = 'aleselegis.al.se.leg.br';
  assert.equal(urlArquivo(`https://${h}/https://${h}/Arquivo/Documents/PL/1-x(1).pdf`, h), `https://${h}/Arquivo/Documents/PL/1-x(1).pdf`);
  assert.equal(urlArquivo('/Arquivo/a.pdf', h), `https://${h}/Arquivo/a.pdf`);
  assert.equal(urlArquivo('https://outro.com/a.pdf', h), null);
  assert.equal(urlArquivo('', h), null);
});

const SE = CASAS.se, BA = CASAS.ba;
const PARL_SE = [{
  parlamentarID: 900, parlamentarRazaoSocial: 'Deputada Exemplo', parlamentarNome: 'Deputada Exemplo', partidoSigla: 'AAA', partidoNome: 'Partido A',
  parlamentarFoto: 'https://aleselegis.al.se.leg.br/Arquivo/images/pessoas/X.jpg', parlamentarLegislatura: '20', parlamentarMesaCargo: 'não participa',
  parlamentarSituacao: 'Ativo', parlamentarPerfil: '<p>Aniversário: 01/01</p>', parlamentarTelefone: '(79) 0000-0000', parlamentarGabinete: 'Sala 1',
  parlamentarEmail: 'dep.exemplo@al.se.leg.br', autorID: 777,
}, {
  parlamentarID: 901, parlamentarRazaoSocial: 'Outro Exemplo', parlamentarNome: 'Outro', partidoSigla: 'BBB', parlamentarSituacao: 'Deputados que não encerraram o mandato',
  parlamentarEmail: 'pessoal@provedor.com', parlamentarLegislatura: '20',
}];
teste('parlamentar: sem perfil, telefone ou gabinete; e-mail só institucional; em exercício = "Ativo"', () => {
  const [a, b] = PARL_SE.map((p) => normParlamentar(p, SE));
  const s = JSON.stringify([a, b]);
  assert.doesNotMatch(s, /Anivers|0000-0000|Sala 1|provedor/);
  assert.equal(a.email, 'dep.exemplo@al.se.leg.br');
  assert.equal(b.email, null);
  assert.equal(a.em_exercicio, true);
  assert.equal(b.em_exercicio, false);
  assert.equal(a.autor_id, '777');
});

const ctxSE = { cfg: SE, idx: indiceParlamentares(PARL_SE.map((p) => normParlamentar(p, SE))), regras: () => [], hoje: '2026-11-03', lacunaSituacao: LACUNA_SITUACAO_ALBA };
const PROP_SE = {
  id: 5001, processo: '10', ano: '2026', sigla: 'PL', tipo: 'Projeto de Lei', tipoId: '5', numero: '187',
  assunto: 'Institui a Semana Estadual de Exemplo, e dá providências correlatas.', data: '03/09/2026 09:58:42', situacao: 'Aprovado',
  arquivo: 'https://aleselegis.al.se.leg.br/https://aleselegis.al.se.leg.br/Arquivo/Documents/PL/5001.pdf',
  AutorRequerenteDados: { pessoaId: 1, autorId: 777, cpf_cnpj: '12345678901', telefone: '79999990000', email: 'x@y.com', nomeRazao: 'Deputada Exemplo', setor: 'Gabinete da Deputada Exemplo', endereco: 'Rua Tal, 1', cidade: 'Aracaju' },
  CoAutores: null,
  Tramitacoes: [
    { id: 3, fase: 'Proposição Arquivada', setor: 'Arquivo', acao: '', complemento: '', dataRecebimento: '11/09/2026 12:22:30', arquivo: '' },
    { id: 2, fase: 'Aguardar andamento', setor: 'SGM/COGEPLEG - Coordenadoria-Geral de Processo Legislativo', acao: 'Para o Arquivo', complemento: 'Proposição aprovada em 10/09/2026.\r\n\r\nArquive-se.\r\n', dataAcaoSaida: '10/09/2026 12:59:49', arquivo: 'https://aleselegis.al.se.leg.br/Arquivo/Documents/PL/2.pdf' },
    { id: 1, fase: 'Proposição Protocolada', setor: 'SGM', acao: 'Protocolar proposição', complemento: 'Proposição Protocolada.', dataAcaoSaida: '03/09/2026 09:58:43' },
  ],
};
teste('proposição SE: sem CPF/telefone/endereço do autor; autor reconhecido; URL corrigida; deliberação lida', () => {
  const p = normProposicao(PROP_SE, ctxSE);
  const s = JSON.stringify(p);
  assert.doesNotMatch(s, /12345678901|79999990000|Rua Tal|x@y\.com|cpf/i);
  assert.deepEqual(p.autores, [{ nome: 'Deputada Exemplo', parlamentar_id: '900', papel: 'autor' }]);
  assert.equal(p.url_texto, 'https://aleselegis.al.se.leg.br/Arquivo/Documents/PL/5001.pdf');
  assert.equal(p.identificacao, 'PL 187/2026');
  assert.equal(p.tramitacao.length, 3);
  assert.equal(p.deliberacoes.length, 1);
  const d = p.deliberacoes[0];
  assert.equal(d.data, '2026-09-10');
  assert.equal(d.resultado, 'aprovada');
  assert.equal(d.tipo, null); // forma de votação não informada: não se deduz
  assert.equal(d.orgao, null); // setor administrativo: órgão não informado
  assert.ok(!p.lacunas.includes(LACUNA_SITUACAO_ALBA));
});

teste('votação: voto individual sempre "Informação não disponível em fonte oficial", sem placar inventado', () => {
  const p = normProposicao(PROP_SE, ctxSE);
  const v = montarVotacao(p, p.deliberacoes[0], SE);
  assert.equal(v.id, 'se-5001-2');
  assert.deepEqual(v.votos, []);
  assert.equal(v.voto_individual, VOTO_INDISPONIVEL);
  assert.equal(v.placar, null);
  assert.ok(v.lacunas.includes(LACUNA_VOTO_INDIVIDUAL));
  assert.ok(v.lacunas.some((l) => /Forma de votação/.test(l)));
  assert.equal(v.uf, 'SE');
  assert.equal(v.casa, 'alese');
  assert.equal(proposicaoPublicada(p).deliberacoes[0].votacao_ref, idVotacao(p, p.deliberacoes[0]));
});

const ctxBA = { cfg: BA, idx: indiceParlamentares([normParlamentar({ parlamentarID: 1010, parlamentarRazaoSocial: 'FULANO EXEMPLO DE TAL', parlamentarNome: 'Fulano Exemplo', parlamentarSituacao: 'Ativo' }, BA)]), regras: () => [], hoje: '2026-11-03', lacunaSituacao: LACUNA_SITUACAO_ALBA };
const tramBA = (id, setor, complemento, data) => ({ id, fase: 'Andamento Processual (Projeto de Lei Ordinária)', setor, acao: 'Encaminhado ao Setor', complemento, dataAcaoSaida: data, arquivo: `https://albalegis.nopapercloud.com.br/Arquivo/Documents/PL/${id}.pdf` });
const PROP_BA = {
  id: 17000, ano: '2026', sigla: 'PL', tipo: 'PROJETO DE LEI', tipoId: '1', numero: '26000', assunto: 'Institui o Selo Exemplo no âmbito do Estado da Bahia.',
  data: '22/04/2026 16:22:17', situacao: 'TRAMITANDO', arquivo: 'https://albalegis.nopapercloud.com.br/Arquivo/Documents/PL/17000.pdf',
  AutorRequerenteDados: { nomeRazao: 'FULANO EXEMPLO DE TAL', setor: 'GAB DEP FULANO EXEMPLO', cidade: '', uf: '' },
  Tramitacoes: [
    tramBA(10, 'COMISSÃO DE CONSTITUIÇÃO E JUSTIÇA', 'Parecer do Relator FAVORÁVEL.\r\nParecer APROVADO por UNANIMIDADE.', '20/05/2026 10:00:00'),
    tramBA(11, 'COMISSÃO DIRETORA', 'PARECER: PELA APROVAÇÃO', '21/05/2026 10:00:00'),
    tramBA(12, 'PLENÁRIO', 'Incluído na Ordem do Dia por ex-ofício\r\n\r\nParecer verbal favorável pelas Comissões Conjuntas, relatado pelo Deputado Fulano Exemplo\r\n\r\nAprovado em 1ª e 2ª discussão em 16/06/2026, com os votos contrários da Bancada da Minoria\r\n', '17/06/2026 17:59:02'),
    tramBA(13, 'DEPARTAMENTO DE ATOS OFICIAIS', 'Registre-se que a Proposição foi aprovada no dia 16/06/2026 em 1ª e 2ª discussões.', '18/06/2026 10:00:00'),
    tramBA(14, 'DEPARTAMENTO DE ATOS OFICIAIS', 'Em tempo: Desconsiderar o despacho que registrou a aprovação em discussão única.', '18/06/2026 11:00:00'),
    tramBA(15, 'COORDENAÇÃO DE EXPEDIENTE', 'Expedido autógrafo ao Governador por meio do Of. nº 1143/2026, em 17/06/2026.\r\n', '18/06/2026 14:44:07'),
    tramBA(16, 'COORDENAÇÃO DE EXPEDIENTE', 'Promulgada a Lei nº 15.900, em 1º de julho de 2026.', '02/07/2026 10:00:00'),
    tramBA(17, 'DEPARTAMENTO DE ATOS OFICIAIS', 'Publicada a Lei nº 15.900, de 1º/07/2026, no Diário Oficial Eletrônico do Legislativo nº 2.457, de 02/07/2026.', '03/07/2026 10:00:00'),
  ],
};
teste('proposição BA: situação literal com lacuna; parecer "pela aprovação" não é deliberação; registros repetidos unidos', () => {
  const p = normProposicao(PROP_BA, ctxBA);
  assert.equal(p.situacao_fonte, 'TRAMITANDO');
  assert.ok(p.lacunas.includes(LACUNA_SITUACAO_ALBA));
  assert.deepEqual(p.autores.map((a) => a.parlamentar_id), ['1010']);
  const ds = p.deliberacoes;
  assert.equal(ds.length, 2, JSON.stringify(ds, null, 1));
  const [ccj, plen] = ds;
  assert.equal(ccj.objeto, 'parecer');
  assert.equal(ccj.tipo, 'unanimidade-registrada');
  assert.equal(ccj.orgao, 'COMISSÃO DE CONSTITUIÇÃO E JUSTIÇA');
  assert.equal(ccj.data, null);
  assert.equal(plen.orgao, 'Plenário');
  assert.equal(plen.data, '2026-06-16');
  assert.equal(plen.etapa, '1ª e 2ª discussão');
  assert.equal(plen.tipo, null);
  assert.equal(plen.placar, null);
  assert.deepEqual(plen.outros_registros, [13]);
  assert.equal(p.correcoes.length, 1);
  const v = montarVotacao(p, plen, BA);
  assert.ok(v.lacunas.some((l) => /bancada/.test(l)));
  assert.ok(v.lacunas.some((l) => /correção de despacho/.test(l)));
  assert.deepEqual(v.votos, []);
  const vccj = montarVotacao(p, ccj, BA);
  assert.equal(vccj.placar, null); // unanimidade não vira número de votos
  assert.ok(vccj.lacunas.some((l) => /unanimidade/.test(l)));
});
teste('normas citadas na tramitação (BA): número, ano e eventos literais; lei citada sem evento não entra', () => {
  const p = normProposicao(PROP_BA, ctxBA);
  assert.equal(p.normas_citadas.length, 1);
  const n = p.normas_citadas[0];
  assert.equal(n.id, 'lei-15900-2026');
  assert.deepEqual(n.eventos.map((e) => [e.evento, e.data]), [['promulgada', '2026-07-01'], ['publicada', '2026-07-01']]);
  assert.deepEqual(normasCitadas([{ id: 1, complemento: 'Nos termos do artigo 2º da Lei Estadual nº 6.670, de 21 de julho de 1994, fica revalidado.' }]), []);
  const idx = normasDaTramitacao([p], BA, { hoje: '2026-11-03', motivo: 'teste' });
  assert.equal(idx[0].projeto_origem[0].id, 'ba-17000');
  assert.equal(idx[0].ementa, null);
  assert.equal(idx[0].data, '2026-07-01');
});
teste('tipos não normativos (requerimento) guardam só a última tramitação; autor particular omitido', () => {
  const p = normProposicao({ ...PROP_BA, id: 17001, sigla: 'UP', tipo: 'UTILIDADE PÚBLICA', AutorRequerenteDados: { nomeRazao: 'PRESIDENTE DA ENTIDADE ****', setor: '' } }, ctxBA);
  assert.equal(p.tramitacao, undefined);
  assert.ok(p.ultima_tramitacao);
  assert.equal(p.autores[0].nome, NOME_OMITIDO);
  assert.equal(autorPublico({ nomeRazao: 'PODER EXECUTIVO', setor: '' }, ctxBA.idx).nome, 'PODER EXECUTIVO');
  assert.equal(autorPublico({ nomeRazao: 'SICRANO DE TAL', setor: 'GAB DEP SICRANO' }, ctxBA.idx).parlamentar_id, null);
  assert.equal(autorPublico({ nomeRazao: 'Beltrano Particular', setor: '' }, ctxBA.idx).nome, NOME_OMITIDO);
});
teste('privacidade: honraria a pessoa não sai com o nome em claro', () => {
  const p = normProposicao({ ...PROP_SE, id: 5002, sigla: 'REQV', tipo: 'Requerimento de Voto', assunto: 'Requer Voto de Congratulações ao Senhor José Pereira Exemplo pelo aniversário.' }, ctxSE);
  assert.doesNotMatch(p.ementa, /José Pereira/);
  assert.match(p.ementa, /\[(nome de particular omitido|trecho em dúvida [0-9a-f]{16})\]/);
});

// ------------------------------------------------------------ textos de deliberação
teste('deliberação: placar só com números literais; votação nominal registrada', () => {
  assert.deepEqual(placarDoTexto('aprovado por 32 votos favoráveis e 7 contrários'), { sim: 32, nao: 7, abstencao: null, obstrucao: null, outros: null });
  assert.equal(placarDoTexto('aprovado por unanimidade'), null);
  const { deliberacoes } = extrairDeliberacoes([{ id: 1, data: '2025-12-11', setor: 'PLENÁRIO', complemento: 'Em votação nominal no painel eletrônico, o projeto foi aprovado por 32 votos favoráveis e 7 contrários em 11/12/2025.' }]);
  assert.equal(deliberacoes[0].tipo, 'nominal');
  assert.equal(deliberacoes[0].placar.sim, 32);
});
teste('deliberação: exclusões (urgência, condicional, aguardando) e rejeição', () => {
  const t = (c) => extrairDeliberacoes([{ id: 1, data: '2026-01-01', setor: 'PLENÁRIO', complemento: c }]).deliberacoes;
  assert.equal(t('Aprovado Requerimento de Urgência em Plenário.').length, 0);
  assert.equal(t('Caso aprovado, encaminhe-se à sanção.').length, 0);
  assert.equal(t('Aguardando ser aprovado.').length, 0);
  assert.equal(t('Parecer pela aprovação do projeto.').length, 0);
  assert.equal(extrairDeliberacoes([{ id: 2, setor: 'COMISSÃO DIRETORA', complemento: 'Aprovado pela Mesa Diretora.' }]).deliberacoes[0].orgao, 'Mesa Diretora');
  const r = t('Rejeitado em discussão única em 05/05/2026.');
  assert.equal(r[0].resultado, 'rejeitada');
  assert.equal(r[0].etapa, 'discussão única');
  assert.deepEqual(datasNoTexto('Aprovado em 1ª e 2ª discussão em 16.06.2026').map((d) => d.iso), ['2026-06-16']);
  assert.deepEqual(datasNoTexto('(Aprovado em 13 de Outubro de 2026)').map((d) => d.iso), ['2026-10-13']);
});

// ------------------------------------------------------------ normas SE
const HTML_ALESE = `<span>Localizada(s) 2 ato(s) normativo(s)</span>
<div class="kt-widget5__item d-block d-md-flex flex-wrap">
 <div class="kt-widget5__section Em vigor">
  <a href="norma.aspx?id=12629&ano=2026" class="kt-widget5__title">
      Lei Ordinária
      n° 10.055/2026
  </a><br />
  <a href="norma.aspx?id=12629&ano=2026" class="kt-widget5__desc">Denomina “Adutora Exemplo”, a adutora localizada no Município Exemplo.</a>
  <div class="kt-widget5__info"><span>Data:</span>
   <span class="kt-font-info">28/09/2026</span>
   <span>Situação:</span>
   <span class="kt-font-info">Em vigor</span>
  </div>
  <div class="kt-widget5__info"><span>Autor(es) da Norma:</span>
   <span class="kt-font-info"><a href='../legislacao/consulta-legislacao.aspx?autor=1' target='_blank'>Deputada Exemplo</a>, <a href='x'>Outro</a></span>
  </div>
 </div>
 <a href='/Arquivo/Documents/legislacao/html/L100552026.html' target='_blank' class='btn'><i class='fas'></i> TEXTO COMPLETO</a>
 <a href='/spl/processo.aspx?id=115619' class='btn btn-sm'  target='_blank'><i class='fas fa-lg fa-link'></i> Projeto de Lei 181/2026</a>
</div>
<div class="kt-widget5__item d-block">
 <a href="norma.aspx?id=12700&ano=2026" class="kt-widget5__title">Resolução n° 5/2026</a>
 <a href="norma.aspx?id=12700&ano=2026" class="kt-widget5__desc">Altera o Regimento Interno.</a>
</div>
<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="abc&amp;def" />
<input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="xyz" />
<a id="ContentPlaceHolder1_lbNext" class="btn" href="javascript:__doPostBack(&#39;ctl00$ContentPlaceHolder1$lbNext&#39;,&#39;&#39;)">Próxima</a>`;
teste('legislação da Alese: norma, projeto de origem e postback da próxima página', () => {
  const r = interpretarListaAlese(HTML_ALESE, 'aleselegis.al.se.leg.br');
  assert.equal(r.total, 2);
  assert.equal(r.itens.length, 2);
  const [l, res] = r.itens;
  assert.equal(l.id, 'lei-10055-2026');
  assert.equal(l.data, '2026-09-28');
  assert.equal(l.situacao, 'Em vigor');
  assert.deepEqual(l.autores, ['Deputada Exemplo', 'Outro']);
  assert.deepEqual(l.projeto_origem, { id_oficial: 115619, identificacao: 'Projeto de Lei 181/2026', url: 'https://aleselegis.al.se.leg.br/spl/processo.aspx?id=115619' });
  assert.equal(l.url_texto, 'https://aleselegis.al.se.leg.br/Arquivo/Documents/legislacao/html/L100552026.html');
  assert.equal(res.id, 'res-5-2026');
  assert.equal(r.proximo, 'ctl00$ContentPlaceHolder1$lbNext');
  assert.equal(r.campos.__VIEWSTATE, 'abc&def');
  assert.equal(interpretarListaAlese(HTML_ALESE.replace('class="btn" href="javascript', 'class="aspNetDisabled btn" href="javascript'), 'h').proximo, null);
});
teste('LegisOn + Alese: lei ganha projeto de origem; resolução só da Alese entra com lacuna', () => {
  const tipo = TIPOS_LEGISON.find((t) => t.prefixo === 'lei');
  const lg = normLegison({ id: 43005, summary: 'Denomina “Adutora Exemplo”.', number: '10055', actType: 'Lei Ordinária', publicationDate: '2026-09-29T00:00:00', actDate: '2026-09-28T00:00:00' }, tipo, { portal: 'https://legislacao.se.gov.br', host: 'api.legislacao.se.gov.br', hoje: '2026-11-03' });
  assert.equal(lg.id, 'lei-10055-2026');
  assert.equal(lg.url, 'https://legislacao.se.gov.br/lei-ordinaria/10055');
  const dec = normLegison({ id: 1, summary: 'Altera o Regulamento do ICMS.', number: '1588', actDate: '2026-10-28T00:00:00' }, TIPOS_LEGISON.find((t) => t.prefixo === 'dec'), { portal: 'p', host: 'h', hoje: 'x' });
  assert.equal(dec.caminho, 'governador');
  const juntas = juntarNormasSE([lg], interpretarListaAlese(HTML_ALESE, 'aleselegis.al.se.leg.br').itens, { uf: 'SE', hoje: '2026-11-03' });
  const lei = juntas.find((n) => n.id === 'lei-10055-2026');
  assert.equal(lei.projeto_origem.id, 'se-115619');
  const res = juntas.find((n) => n.id === 'res-5-2026');
  assert.ok(res.lacunas.length);
  assert.equal(prefixoNorma('Lei Complementar'), 'lc');
});

// ------------------------------------------------------------ execução
for (const [nome, fn] of testes) {
  try { await fn(); ok++; console.log(`ok  ${nome}`); } catch (e) { console.error(`FALHOU  ${nome}\n${e.stack}`); process.exitCode = 1; }
}
console.log(`\n${ok}/${testes.length} testes passaram`);
