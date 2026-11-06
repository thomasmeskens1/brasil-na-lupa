#!/usr/bin/env node
// Testes offline do coletor do Ceará (ALECE e Diário Oficial). Amostras reduzidas de respostas reais de 06/11/2026
// em fixtures/ (estrutura preservada; os relatórios de votação estão como saem de extrair_pdf.py "palavras").
// Rodar: node scripts/coleta/estados/ce/testes.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chaveNome, conferirPrivacidade } from '../abertos/base.mjs';
import {
  ClienteCE, decodificarMisto, decodificar, dataCurta, interpretarDeputadosCE, interpretarBuscaCE, interpretarFichaCE, aplicarFichaCE,
  interpretarIndiceVotacoesCE, corpoBusca,
} from './alece.mjs';
import { lerRelatorioCE, identificarMateriaCE, montarVotacaoCE, limitesColunas, SEM_VOTO } from './votacao.mjs';
import { lerCapaDOE, atosDoCaderno, urlCaderno, diasDesc } from './diario.mjs';

const FX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fx = (n) => fs.readFileSync(path.join(FX, n));
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const HOJE = '2026-11-06';

// ---------------------------------------------------------------- cliente: robots.txt antes de tudo; 300/404 = não existe
{
  const pedidos = [];
  let relogio = 0;
  const resp = (status, corpo, tipo = 'text/html') => ({ status, ok: status >= 200 && status < 300, headers: { get: () => tipo }, text: async () => corpo, arrayBuffer: async () => new TextEncoder().encode(corpo).buffer });
  const fetchImpl = async (url, o = {}) => {
    pedidos.push({ url, metodo: o.method, corpo: o.body });
    if (url.endsWith('/robots.txt')) return url.includes('www2') ? resp(404, '<html>404</html>') : resp(200, 'User-agent: *\nDisallow: /banco-de-imagens/download/\n', 'text/plain');
    if (url.includes('p03.pdf')) return resp(300, 'multiple');
    if (url === 'https://imagens.seplag.ce.gov.br/PDF/20261030/do20261030p01.pdf') return { ...resp(301, ''), headers: { get: (k) => (k === 'location' ? 'http://imagens.seplag.ce.gov.br/PDF/20260130/do20261030p01.pdf' : 'text/html') } };
    if (url.endsWith('/outro.pdf')) return { ...resp(301, ''), headers: { get: (k) => (k === 'location' ? 'https://imagens.seplag.ce.gov.br/PDF/x/diferente.pdf' : 'text/html') } };
    return resp(200, 'ok');
  };
  const c = new ClienteCE({ prazoMs: 1e12, fetchImpl, agora: () => relogio, dormirImpl: async (ms) => { relogio += ms; } });
  eq((await c.bytes('https://www2.al.ce.gov.br/legislativo/proposicoes/busca.php?x=1', { metodo: 'POST', corpo: corpoBusca(2026) })).toString(), 'ok');
  eq(pedidos[0].url, 'https://www2.al.ce.gov.br/robots.txt', 'robots.txt primeiro');
  eq(pedidos[1].corpo, 'escolha=ano&pesquisa=26&B1=Busca');
  eq(await c.bytes('https://www2.al.ce.gov.br/PDF/do20261028p03.pdf'), null, 'HTTP 300 = caderno inexistente');
  ok(relogio >= 4000, 'intervalo mínimo de 2 s entre requisições ao mesmo host');
  await assert.rejects(() => c.bytes('https://www.al.ce.gov.br/banco-de-imagens/download/1'), /robots/); n++;
  ok(!pedidos.some((p) => p.url.includes('banco-de-imagens')), 'caminho proibido não é pedido');
  eq((await c.bytes('https://imagens.seplag.ce.gov.br/PDF/20261030/do20261030p01.pdf')).toString(), 'ok', 'redirecionamento para o mesmo arquivo');
  ok(pedidos.some((p) => p.url === 'https://imagens.seplag.ce.gov.br/PDF/20260130/do20261030p01.pdf'), 'seguido em https');
  eq(await c.bytes('https://imagens.seplag.ce.gov.br/PDF/outro.pdf'), null, 'redirecionamento para outro arquivo = inexistente');
}

// ---------------------------------------------------------------- textos
eq(decodificarMisto(Buffer.from([0x43, 0x45, 0x41, 0x52, 0xc1])), 'CEARÁ', 'byte Latin-1 isolado');
eq(decodificarMisto(Buffer.concat([Buffer.from('Comissão ', 'utf8'), Buffer.from('Tramitação', 'latin1')])), 'Comissão Tramitação', 'UTF-8 e Latin-1 no mesmo arquivo');
eq(decodificar('REVIS&Atilde;O &ordm; Cear&aacute;'), 'REVISÃO º Ceará');
eq(dataCurta('14.04.26', HOJE), '2026-04-14');
eq(dataCurta('02/02/23', HOJE), '2023-02-02');
eq(dataCurta('31.12.26', HOJE), null, 'data futura descartada');

// ---------------------------------------------------------------- deputados
const deps = interpretarDeputadosCE(fx('deputados.html').toString('utf8'), HOJE);
eq(deps.itens.length, 4);
const romeu = deps.itens.find((d) => d.id === 'ce-romeu-aldigueri');
eq([romeu.nome, romeu.partido, romeu.em_exercicio, romeu.foto, romeu.url_oficial], ['Romeu Aldigueri', 'PSB', true, 'https://www.al.ce.gov.br/image/384612', 'https://www.al.ce.gov.br/deputados/romeu-aldigueri']);
ok(deps.itens.some((d) => d.em_exercicio === false && /Licenciado/.test(d.situacao_cadastro)), 'licenciado marcado');
ok(deps.itens.some((d) => /Suplente em exercício/.test(d.situacao_cadastro) && d.em_exercicio), 'suplente em exercício');
conferirPrivacidade(deps); n++;
const porNome = new Map(deps.itens.map((d) => [chaveNome(d.nome), d.id]));

// ---------------------------------------------------------------- proposições: busca por ano (ISO-8859-1) e ficha
const busca = interpretarBuscaCE(decodificarMisto(fx('busca-mens-2026.html')), 'projeto_mens', 'D', 2026, HOJE, porNome);
eq(busca.itens.length, 3);
const p0 = busca.itens[0];
eq([p0.id, p0.sigla, p0.numero, p0.ano, p0.situacao.texto, p0.situacao.texto_oficial, p0.situacao.lei_numero, p0.autores[0].nome],
  ['ce-mens-459', 'PLM', 44, 2026, 'Deliberado (aprovado)', 'Delib. Aprov.', '19.715', 'DEFENSORIA PÚBLICA']);
ok(/^PROJETO DE LEI ORIUNDO DA MENSAGEM N\.º 01\/2026/.test(p0.ementa), 'ementa decodificada');
eq(interpretarBuscaCE(decodificarMisto(fx('busca-mens-2026.html')), 'projeto_mens', 'D', 2025, HOJE).itens.length, 0, 'só o ano pedido');
assert.throws(() => interpretarBuscaCE('<html>erro</html>', 'projeto_mens', 'D', 2026, HOJE), /sem a tabela/); n++;
eq(interpretarBuscaCE('Visualizando registros <td><b>N° Proj.</b></td></tr></table><font>Encontrados <b>0</b> registros...</font>', 'projeto_emen', 'T', 2026, HOJE).itens, [], 'lista vazia');
const ficha = interpretarFichaCE(decodificarMisto(fx('ficha-mens-459.html')), HOJE);
eq([ficha.numero, ficha.ano, ficha.entrada, ficha.expediente, ficha.lei, ficha.andamento.length], [44, 2026, '2026-04-14', '2026-04-15', '19.715', 6]);
eq(ficha.url_lei, 'https://www2.al.ce.gov.br/legislativo/legislacao5/leis2026/19715.htm');
eq(ficha.andamento[2].descricao, 'Tramitação em Regime de Urgência', 'trecho em Latin-1 dentro de página UTF-8');
const p0d = aplicarFichaCE(p0, ficha, HOJE);
eq([p0d.data_apresentacao, p0d.situacao.ultima_tramitacao.descricao, p0d.situacao.url_norma, p0d.detalhe_coletado_em],
  ['2026-04-14', 'Plenário, favorável / Aprovado', ficha.url_lei, HOJE]);
eq(aplicarFichaCE({ ...p0, numero: 45 }, ficha, HOJE).detalhe_coletado_em, null, 'ficha de outro número não é aplicada');
conferirPrivacidade(p0d); n++;

// ---------------------------------------------------------------- índice das votações (CSV)
const idx = interpretarIndiceVotacoesCE(fx('votacoes.csv').toString('utf8'));
eq(idx.length, 3);
eq([idx[0].id, idx[0].sessao, idx[0].url], ['ce-bfSc588rG0eAQJo6angXCuhZTHE1QhNS83As72Zs', '59.ª SESSÃO ORDINÁRIA', 'https://transparencia.al.ce.gov.br/uploads/votacao_nominal_materia/bfSc588rG0eAQJo6angXCuhZTHE1QhNS83As72Zs.pdf']);
assert.throws(() => interpretarIndiceVotacoesCE('A;B\n1;2'), /cabeçalho/); n++;

// ---------------------------------------------------------------- relatório de votação (PDF) — confere com a apuração
const rel = JSON.parse(fx('relatorio-2026-02-26.json').toString('utf8'));
eq(limitesColunas(rel.paginas[0].bordas_v, rel.paginas[0].largura).length, 7, 'seis colunas pelas bordas da tabela');
const lido = lerRelatorioCE(rel.paginas);
ok(!lido.erro, lido.erro);
eq(lido.apuracao, { SIM: 33, NAO: 5, ABSTENCAO: 0 });
eq(lido.votos.length, 46);
eq([lido.cabecalho.data, lido.cabecalho.hora, lido.cabecalho.processo, lido.cabecalho.resultado], ['26/02/2026', '12:30', 'NOMINAL', 'APROVADO']);
eq(lido.votos[0], { numero: 1, nome: 'ROMEU ALDIGUERI', partido: 'PSB', voto: SEM_VOTO, voto_texto_oficial: null, modalidade: null });
eq(lido.votos.find((v) => v.nome === 'FELIPE MOTA'), { numero: 6, nome: 'FELIPE MOTA', partido: 'UNIÃO', voto: 'Não', voto_texto_oficial: 'NÃO (v)', modalidade: 'virtual' }, 'partido deslocado na linha');
eq(lido.votos.find((v) => v.nome === 'ALYSSON AGUIAR').partido, 'PC do B');
eq(lido.votos.find((v) => v.nome === 'TOMAZ HOLANDA'), { numero: 46, nome: 'TOMAZ HOLANDA', partido: 'AVANTE', voto: 'Sim', voto_texto_oficial: 'SIM (P)', modalidade: 'presencial' }, 'segunda página');
const ident = identificarMateriaCE(lido.cabecalho.materia);
eq(ident, { tabela: 'projeto_mens', numero: 13, ano: 2026, mensagem: '9491' });
const ref = { id: 'ce-DBvX13sVLgARUh7Vb7k5ETBJKX7Sq4qmkPLq0LSO', chave: 'DBvX13sVLgARUh7Vb7k5ETBJKX7Sq4qmkPLq0LSO', sessao: '10.ª SESSÃO ORDINÁRIA', legislatura: '31.ª LEGISLATURA', materia: 'x', url: 'https://transparencia.al.ce.gov.br/uploads/votacao_nominal_materia/DBvX13sVLgARUh7Vb7k5ETBJKX7Sq4qmkPLq0LSO.pdf' };
const v = montarVotacaoCE(ref, lido, { hoje: HOJE, sha256: 'abc', porNome, ident, sigla: 'PLM', tipo: 'Projeto de Lei oriundo de Mensagem' });
eq([v.data, v.hora, v.tipo, v.resultado, v.sessao.titulo], ['2026-02-26', '12:30', 'nominal', 'aprovada', '10.ª Sessão Ordinária']);
eq(v.placar, { sim: 33, nao: 5, abstencao: 0, 'Sem voto registrado': 8, total: 46 });
eq(v.votos.find((x) => x.nome === 'ROMEU ALDIGUERI').parlamentar_id, 'ce-romeu-aldigueri', 'nome idêntico liga ao perfil');
eq(v.votos.find((x) => x.nome === 'DANNIEL OLIVEIRA').parlamentar_id, null, 'sem casamento aproximado');
eq([v.proposicao.sigla, v.proposicao.numero, v.proposicao.id], ['PLM', 13, null]);
conferirPrivacidade(v); n++;

// Divergências do próprio PDF → não publica (revisão humana).
const r2023 = lerRelatorioCE(JSON.parse(fx('relatorio-2023-02-15.json').toString('utf8')).paginas);
eq(r2023.erro, 'linha 9 (Emilia Pessoa) com voto em mais de uma coluna');
const trocado = structuredClone(rel.paginas);
// FELIPE MOTA: "NÃO (v)" movido para a coluna SIM.
for (const w of trocado[0].palavras.filter((x) => (x[3] === 'NÃO' || x[3] === '(v)') && x[2] > 280 && x[2] < 290)) { w[0] -= 56; w[1] -= 56; }
ok(/"NÃO \(v\)" na coluna SIM/.test(lerRelatorioCE(trocado).erro), 'voto escrito diferente do título da coluna');
const semUm = structuredClone(rel.paginas);
semUm[0].palavras = semUm[0].palavras.filter((x) => !(x[3] === 'SIM' && x[2] > 220 && x[2] < 230)).filter((x) => !(x[3] === '(V)' && x[2] > 220 && x[2] < 230));
ok(/coluna SIM: 32 votos lidos, mas a apuração do PDF informa 33/.test(lerRelatorioCE(semUm).erro), 'total diferente da apuração');
const semBordas = structuredClone(rel.paginas);
semBordas[0].bordas_v = [];
ok(/bordas da tabela/.test(lerRelatorioCE(semBordas).erro), 'sem bordas não publica');
eq(lerRelatorioCE([{ largura: 595, bordas_v: [], palavras: [] }]).sem_texto, true, 'PDF sem texto = lacuna (sem OCR)');
const semN = structuredClone(rel.paginas);
semN[0].palavras = semN[0].palavras.filter((x) => x[3] !== 'Nº');
ok(!lerRelatorioCE(semN).erro, 'título "Nº" ausente (relatórios de 2023): colunas pelas bordas');
const semModalidade = structuredClone(rel.paginas);
semModalidade[0].palavras = semModalidade[0].palavras.filter((x) => !(x[3] === '(P)' && x[2] > 235 && x[2] < 245)); // LARISSA GASPAR: "SIM"
const lm = lerRelatorioCE(semModalidade);
eq([lm.erro, lm.votos?.[2].voto, lm.votos?.[2].modalidade], [undefined, 'Sim', null], 'voto sem (P)/(V) na coluna certa');

// Bloco de matérias: lido, mas não ligado a projeto.
const bloco = lerRelatorioCE(JSON.parse(fx('relatorio-bloco-2026-04-23.json').toString('utf8')).paginas);
ok(!bloco.erro && bloco.cabecalho.bloco, 'bloco de matérias');
eq(bloco.cabecalho.resultado, 'APROVADO', 'resultado na linha de baixo');
eq(identificarMateriaCE('Veto Nº.: 01/2023 - Autoria do Poder Executivo'), null);
eq(identificarMateriaCE('367/2024 – PL de Autoria da Deputada Larissa Gaspar - Concede').tabela, 'projeto_lei');
eq(identificarMateriaCE('Projeto de Resolução n.º 08/2026 - Autoria da Mesa Diretora'), { tabela: 'projeto_reso', numero: 8, ano: 2026, mensagem: null });
eq(identificarMateriaCE('05/2026 - PL Complementar oriundo da Mensagem n.º 9.487/26 – Autoria').tabela, 'projeto_compl');

// ---------------------------------------------------------------- Diário Oficial
const doe = JSON.parse(fx('doe-2026-10-28.json').toString('utf8'));
eq(lerCapaDOE(doe.caderno1[0]), { data: '2026-10-28', caderno: 1, total: 2, poder_executivo: true });
const atos = atosDoCaderno(doe.caderno1, { edicao: '2026-10-28', url: urlCaderno('2026-10-28', 1), hoje: HOJE });
eq(atos.map((a) => [a.id, a.tipo, a.numero, a.data_assinatura, a.data_publicacao, a.pagina_pdf]), [
  ['lei-19915-2026', 'Lei', 19915, '2026-10-28', '2026-10-28', 1],
  ['dec-37589-2026', 'Decreto', 37589, '2026-10-28', '2026-10-28', 2],
]);
ok(/^INSTITUI PROGRAMA DE PARCELAMENTO .*ICMS/.test(atos[0].ementa), 'ementa da lei');
eq(atos[1].ementa, 'ABRE AOS ÓRGÃOS E ENTIDADES CRÉDITO SUPLEMENTAR DE R$ 189.864.158,33 PARA REFORÇO DE DOTAÇÕES ORÇAMENTÁRIAS CONSIGNADAS AO VIGENTE ORÇAMENTO.');
eq(atos[0].url, 'https://imagens.seplag.ce.gov.br/PDF/20261028/do20261028p01.pdf');
eq(atosDoCaderno(doe.caderno2, { edicao: '2026-10-28', url: 'x', hoje: HOJE }), [], 'citação a decreto de 2019 dentro de outro ato não vira ato');
eq(atosDoCaderno(['DECRETO Nº37.999, de 30 de outubro de 2026.\nEMENTA\nO GOVERNADOR DO ESTADO DO CEARÁ, no uso'], { edicao: '2026-10-28', url: 'x', hoje: HOJE }), [], 'ato com data posterior à edição');
atos.forEach((a) => conferirPrivacidade(a)); n++;
eq(diasDesc('2026-10-30', '2026-11-01'), ['2026-11-01', '2026-10-31', '2026-10-30']);

console.log(`[CE] testes ok: ${n} verificações.`);
