#!/usr/bin/env node
// Testes do coletor do TCE-RS (sem rede): node scripts/coleta/tribunais-contas/tce-rs/testes.mjs
// Usa trechos reais das fontes (decisões de 2025, documento da jurisprudência, linha da página do Governador)
// e confere, se existirem, os arquivos gerados em dados/tribunais-contas/tce-rs/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lerRobots, caminhoPermitido, pareceBloqueio, dataISO, chaveNome, semHtml, SAIDA } from './lib.mjs';
import { pareceresDaDecisao, normalizarDecisao, normalizarJuris, indexarJuris, docDaSessao, lerPaginaGovernador } from './fontes.mjs';
import { carregarMunicipiosRS, municipioDoOrgao, itensMunicipais, montarArquivoMunicipio, itemGovernador } from './itens.mjs';

let ok = 0;
function teste(nome, f) {
  try { f(); ok++; } catch (e) { console.error(`FALHOU: ${nome}\n${e.stack}`); process.exitCode = 1; }
}

const DEC_CAPIVARI = {
  ANO_SESSAO: 2025, DATA_SESSAO: '01/04/2025', TIPO_SESSAO: 'Ordinária', ORGAO_JULGADOR: 'Primeira Câmara', NUMERO_SESSAO: 10,
  NR_PROCESSO: 1980200235, TIPO_PROCESSO: 'Contas Anuais', COD_ORGAO: 83300, NOME_ORGAO: 'PM DE CAPIVARI DO SUL', MAGISTRADO: 'Heloisa Tripoli Goulart Piccinini',
  DECISAO: '\nAdvertência/Alerta/Cientificação/Recom/Determinação\n<b> LEANDRO MONTEIRO DOS SANTOS: \n\n- Parecer Favorável com Ressalva(s)\n\n\n<b> SANDRA MARA SILVA CARDOSO: \n\n- Parecer Favorável\n\n',
};
const DEC_ESTANCIA = '\nAdvertência/Alerta/Cientificação/Recom/Determinação\n<b> AIRTON LUIZ HAAG: \n\n- Parecer Favorável\n\n\n<b> DIEGO WILLIAN FRANCISCO: \n\n- Multa\n\n\n- Parecer Favorável com Ressalva(s)\n\n';
const JURIS_CAPIVARI = {
  orgao: 'EXECUTIVO MUNICIPAL DE CAPIVARI DO SUL', cd_orgao: 83300, nr_processo: 1980200235, nm_magistrado: 'Heloisa Tripoli Goulart Piccinini',
  nm_orgao_julgador: 'PRIMEIRA CÂMARA', publicacao_dt_publicacao: '2025-05-26T00:00:00.000Z', dt_sessao: '2025-04-01T00:00:00.000Z',
  nr_processo_fmt: '000198-0200/23-5', texto: 'Parecer Favorável', ds_tp_processo: 'CONTAS ANUAIS', dt_inicio_exercicio: '2023', relatorio: 'texto longo que não é guardado',
  link_visualizador_decisao: 'https://portal.tce.rs.gov.br/app/visdoc-angular/anonimo/open/PRE/1150774#id_arquivo=6581097',
  link_visualizador_relatorio_voto: 'https://portal.tce.rs.gov.br/app/visdoc-angular/anonimo/open/PRE/1150774#id_arquivo=6484259',
};
const LINHA_GOV = '<div class="processo-seletivo__interna__content__item-archives__line"> <div class="processo-seletivo__interna__content__item-archives__line-item__small col-ano"> <span class="info">2024</span> </div> <div class="processo-seletivo__interna__content__item-archives__line-item col-conselheiro"> <span class="info">Eduardo Leite</span> </div> <div class="processo-seletivo__interna__content__item-archives__line-item col-processo"> <a href="https://tcers.tc.br/consultas/processo_detalhe/?processo=0012340200247" target="_blank" style="align-items: center;display: inline-flex;"> <span class="primary">001234-0200/24-7</span> </a> </div> <div class="processo-seletivo__interna__content__item-archives__line-item col-arquivos"> <span style="display: inline-flex;"> <a href="https://tcers.tc.br/repo/parecer_previo/pp_2024.pdf" target="_blank"><span class="primary">Relat&oacute;rio e Parecer pr&eacute;vio</span></a> </span> </div> <div class="processo-seletivo__interna__content__item-archives__line-item col-julgamento"> <a href="https://ww3.al.rs.gov.br/institucional/ApreciacaoContas.aspx"><span class="primary">Julgamento AL-RS</span></a> </div> </div>'
  + '<div class="processo-seletivo__interna__content__item-archives__line"> <div class="processo-seletivo__interna__content__item-archives__line-item__small col-ano"> <span class="info">2025</span> </div> <div class="processo-seletivo__interna__content__item-archives__line-item col-conselheiro"> <span class="info">Eduardo Leite</span> </div> <div class="processo-seletivo__interna__content__item-archives__line-item col-processo"> <a href="https://tcers.tc.br/consultas/processo_detalhe/?processo=0012370200253"> <span class="primary">001237-0200/25-3</span> </a> </div> <div class="processo-seletivo__interna__content__item-archives__line-item col-arquivos"> <span><span class="info">Em elaboração</span></span> <span><span class="info">Em elaboração</span></span> </div> </div>';

teste('robots.txt do portal de dados abertos', () => {
  const r = lerRobots('User-agent: *\nDisallow: /dataset/rate/\nDisallow: /revision/\nDisallow: /dataset/*/history\nDisallow: /api/\nCrawl-Delay: 10\n');
  assert.equal(r.crawlDelayS, 10);
  assert.equal(caminhoPermitido(r, '/dados/decisoes/2025.json'), true);
  assert.equal(caminhoPermitido(r, '/api/3/action/package_list'), false);
  assert.equal(caminhoPermitido(r, '/dataset/decisoes-2025/history'), false);
  assert.equal(caminhoPermitido(r, '/dataset/decisoes-2025'), true);
  const t = lerRobots('User-agent: *\nContent-Signal: search=yes,ai-train=no,use=reference\nAllow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nDisallow: /wp-admin/\n');
  assert.equal(caminhoPermitido(t, '/parecer-previo/'), true);
  assert.equal(caminhoPermitido(lerRobots('User-agent: *\nDisallow: /aplicprod/\n'), '/aplicprod/f?p=1'), false);
  assert.equal(caminhoPermitido(lerRobots('User-agent: *\nDisallow: /\n'), '/qualquer'), false);
});

teste('bloqueio anti-bot é reconhecido', () => {
  assert.equal(pareceBloqueio('text/html', '<title>Just a moment...</title><div id="cf-chl-widget">'), true);
  assert.equal(pareceBloqueio('application/json', '{"captcha":1}'), false);
  assert.equal(pareceBloqueio('text/html', '<div class="processo-seletivo">'), false);
});

teste('datas, nomes e HTML', () => {
  assert.equal(dataISO('01/04/2025'), '2025-04-01');
  assert.equal(dataISO('2025-05-26T00:00:00.000Z'), '2025-05-26');
  assert.equal(dataISO('x'), null);
  assert.equal(chaveNome("Sant'Ana do Livramento"), 'SANT ANA DO LIVRAMENTO');
  assert.equal(semHtml('Relat&oacute;rio e Parecer pr&eacute;vio'), 'Relatório e Parecer prévio');
  assert.equal(semHtml('<font color="red">ERRATA</font>'), 'ERRATA');
});

teste('parecer por responsável no campo DECISAO', () => {
  const p = pareceresDaDecisao(DEC_CAPIVARI.DECISAO);
  assert.deepEqual(p.pareceres.map((x) => [x.nome, x.parecer]), [['LEANDRO MONTEIRO DOS SANTOS', 'Parecer Favorável com Ressalva(s)'], ['SANDRA MARA SILVA CARDOSO', 'Parecer Favorável']]);
  const e = pareceresDaDecisao(DEC_ESTANCIA);
  assert.equal(e.pareceres[1].parecer, 'Parecer Favorável com Ressalva(s)');
  assert.deepEqual(e.pareceres[1].outras, ['Multa']);
  assert.equal(pareceresDaDecisao('\nPedido de Vista\n\nRenato Luís Bordin de Azeredo').pareceres.length, 0);
  assert.equal(pareceresDaDecisao('\nAcolhe Parecer da Consultoria Técnica\nResponde à Consulta').pareceres.length, 0);
  assert.equal(pareceresDaDecisao('<b> FULANO: \n\n- Parecer Desfavorável\n\n').pareceres[0].parecer, 'Parecer Desfavorável');
  assert.equal(pareceresDaDecisao('<font color="red">ERRATA</font>\n\n<b> X: \n- Conhece\n- Não Provimento').errata, true);
});

teste('jurisprudência: só campos curtos e exercício de 4 dígitos', () => {
  const j = normalizarJuris(JURIS_CAPIVARI);
  assert.equal(j.exercicio, '2023');
  assert.equal(j.processo_formatado, '000198-0200/23-5');
  assert.equal(j.data_sessao, '2025-04-01');
  assert.equal(j.relatorio, undefined);
  assert.equal(normalizarJuris({ ...JURIS_CAPIVARI, dt_inicio_exercicio: null }).exercicio, null);
  assert.equal(normalizarJuris({ ...JURIS_CAPIVARI, link_visualizador_decisao: 'http://outro.site/x' }).link_decisao, null);
  const idx = indexarJuris([j]);
  assert.deepEqual([...idx.get('1980200235').exercicios], ['2023']);
  assert.equal(docDaSessao(idx.get('1980200235'), '2025-04-01'), j);
  assert.equal(docDaSessao(idx.get('1980200235'), '2024-01-01'), null);
});

teste('página do Governador', () => {
  const l = lerPaginaGovernador(LINHA_GOV);
  assert.equal(l.length, 2);
  assert.deepEqual([l[0].exercicio, l[0].governador_literal, l[0].processo_formatado, l[0].nr_processo], ['2024', 'Eduardo Leite', '001234-0200/24-7', '12340200247']);
  assert.equal(l[0].arquivos[0].titulo, 'Relatório e Parecer prévio');
  assert.equal(l[1].situacao_literal, 'Em elaboração');
});

const { porNome } = carregarMunicipiosRS();

teste('municípios: só igualdade exata com a lista oficial', () => {
  assert.equal(municipioDoOrgao('PM DE CAPIVARI DO SUL', porNome).codigo_ibge.length, 7);
  assert.equal(municipioDoOrgao('EXECUTIVO MUNICIPAL DE ESTÂNCIA VELHA', porNome).nome, 'Estância Velha');
  assert.equal(municipioDoOrgao('PM DE SANTANA DO LIVRAMENTO', porNome), null); // oficial: Sant'Ana do Livramento
  assert.equal(municipioDoOrgao('CM DE CAPIVARI DO SUL', porNome), null);
});

teste('itens municipais e arquivo do município', () => {
  const mun = municipioDoOrgao('PM DE CAPIVARI DO SUL', porNome);
  const dec = normalizarDecisao(DEC_CAPIVARI);
  const itens = itensMunicipais(mun, '2023', dec, normalizarJuris(JURIS_CAPIVARI), { titulo: 'Decisões 2025', url: 'https://dados.tce.rs.gov.br/dados/decisoes/2025.json' });
  assert.equal(itens.length, 2);
  assert.equal(itens[0].parecer.conclusao, 'Parecer Favorável com Ressalva(s)');
  assert.equal(itens[0].parecer.conclusao_literal, 'LEANDRO MONTEIRO DOS SANTOS: Parecer Favorável com Ressalva(s)');
  assert.equal(itens[0].parecer.exercicio, '2023');
  assert.equal(itens[0].processo.numero, '000198-0200/23-5');
  assert.equal(itens[0].relator, 'Heloisa Tripoli Goulart Piccinini');
  assert.equal(itens[0].data_julgamento, '2025-04-01');
  assert.notEqual(itens[0].id, itens[1].id);
  const antigo = { itens: [{ ...itens[0], id: 'velho', ano_sessao: 2019, parecer: { ...itens[0].parecer, exercicio: '2017' } }, { ...itens[1], id: 'some', ano_sessao: 2025 }] };
  const arq = montarArquivoMunicipio(mun, antigo, itens, new Set([2025]));
  assert.deepEqual(arq.itens.map((i) => i.id).includes('velho'), true);
  assert.deepEqual(arq.itens.map((i) => i.id).includes('some'), false);
  assert.equal(arq.contagens.exercicios, 2);
  assert.equal(arq.municipio.codigo_ibge, mun.codigo_ibge);
});

teste('item do Governador', () => {
  const [linha, pendente] = lerPaginaGovernador(LINHA_GOV);
  const dec = normalizarDecisao({ ...DEC_CAPIVARI, NR_PROCESSO: 12340200247, NOME_ORGAO: 'GG - GABINETE DO GOVERNADOR', ORGAO_JULGADOR: 'Tribunal Pleno', DECISAO: '<b> EDUARDO FIGUEIREDO CAVALHEIRO LEITE: \n\n- Parecer Favorável com Ressalva(s)\n' });
  const fp = { titulo: 'Página', url: 'https://tcers.tc.br/parecer-previo/' };
  const it = itemGovernador(linha, dec, null, { titulo: 'Decisões 2025', url: 'u' }, fp);
  assert.equal(it.parecer.conclusao, 'Parecer Favorável com Ressalva(s)');
  assert.equal(it.processo.numero, '001234-0200/24-7');
  assert.equal(it.documentos[0].url, 'https://tcers.tc.br/repo/parecer_previo/pp_2024.pdf');
  const div = itemGovernador(linha, { ...dec, decisao: '<b> A: \n- Parecer Favorável\n<b> B: \n- Parecer Desfavorável\n' }, null, null, fp);
  assert.equal(div.parecer.conclusao, null);
  assert.equal(div.parecer.conclusao_literal, 'A: Parecer Favorável; B: Parecer Desfavorável');
  const p = itemGovernador(pendente, null, null, null, fp);
  assert.equal(p.parecer.conclusao, null);
  assert.match(p.lacunas[0], /Em elaboração/);
});

teste('arquivos gerados (se existirem)', () => {
  const dir = path.join(SAIDA, 'contas-prefeitos');
  if (!fs.existsSync(dir)) return;
  const ids = new Set();
  for (const n of fs.readdirSync(dir)) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
    assert.equal(`${d.municipio.id}.json`, n);
    assert.match(d.municipio.codigo_ibge, /^43\d{5}$/);
    for (const it of d.itens) {
      assert.match(it.parecer.exercicio, /^\d{4}$/, `${n}: exercício`);
      assert.ok(!ids.has(it.id), `id repetido ${it.id}`);
      ids.add(it.id);
      if (it.parecer.conclusao) assert.match(it.parecer.conclusao, /^Parecer (Prévio )?(Favorável|Desfavorável)/i);
      assert.ok(it.fontes.length >= 1);
    }
  }
  const gov = path.join(SAIDA, 'contas-governador');
  if (fs.existsSync(gov)) for (const n of fs.readdirSync(gov)) {
    const d = JSON.parse(fs.readFileSync(path.join(gov, n), 'utf8'));
    assert.equal(`${d.parecer.exercicio}.json`, n);
  }
});

console.log(`${ok} testes passaram`);
