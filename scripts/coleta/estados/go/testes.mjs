#!/usr/bin/env node
// Testes offline do coletor de Goiás (Casa Civil). Amostras reduzidas de respostas reais de 04/11/2026
// (scripts/coleta/estados/go/amostras), sem rede.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conferirPrivacidade, LACUNA_PRIVACIDADE } from '../abertos/base.mjs';
import { htmlParaTexto, interpretarLegislacaoGO, interpretarVetoListaGO, aplicarDetalheVetoGO, urlLegislacao } from './casacivil.mjs';
import { ASSEMBLEIA_INDISPONIVEL } from './coletar.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const amostra = (n) => JSON.parse(fs.readFileSync(path.join(AQUI, 'amostras', n), 'utf8'));
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const HOJE = '2026-11-04';

// ---------------------------------------------------------------- HTML → texto
{
  eq(htmlParaTexto('<p class="a">Um &amp; dois</p> <p>três <a href="x">94608989</a>.</p><footer><p>FIM</p></footer>'), 'Um & dois\ntrês 94608989 .\nFIM');
  eq(htmlParaTexto(''), null);
  eq(htmlParaTexto('<script>alert(1)</script><p> </p>'), null, 'script e parágrafo vazio somem');
}

// ---------------------------------------------------------------- leis e decretos
{
  const [lei, lc, dec] = amostra('legislacoes.json').resultados.map((r) => interpretarLegislacaoGO(r, HOJE));
  eq(lei.id, 'lei-24592-2026');
  eq(lei.tipo, 'Lei');
  eq(lei.tipo_oficial, 'Lei Ordinária');
  eq(lei.titulo, 'Lei nº 24.592, de 2026');
  eq(lei.data_assinatura, '2026-11-03');
  eq(lei.data_publicacao, '2026-11-03');
  eq(lei.autoria, 'Deputado Bruno Peixoto, Deputado Rubens Marques');
  eq(lei.url, urlLegislacao(118708), 'sem link do Diário: página da Casa Civil');
  ok(lei.lacunas.some((l) => /Link da edição do Diário Oficial/.test(l)), 'lacuna do link anotada');
  eq(lei.publicacao, [{ data: '2026-11-03', numero: '24.897', suplemento: true, url: null }]);

  eq(lc.id, 'lc-216-2026');
  eq(lc.tipo, 'Lei Complementar');
  eq(lc.url, 'https://diariooficial.abc.go.gov.br/portal/edicoes/download/7419', 'link da edição do Diário Oficial');
  eq(lc.projeto_origem_texto, 'Autoria registrada pela Casa Civil: Governador do Estado de Goiás');
  eq(lc.lacunas, []);

  eq(dec.id, 'dec-11001-2026');
  eq(dec.tipo, 'Decreto');
  eq(dec.numero, '11.001');
  ok(/Designa os membros/.test(dec.ementa), 'ementa oficial');
  eq(interpretarLegislacaoGO({ id: 1, tipo_legislacao: { id: 6, nome: 'Portaria Orçamentária' } }, HOJE), null, 'tipo fora do escopo');
  eq(interpretarLegislacaoGO({ id: 2, ano: 2026, numero: '1', tipo_legislacao: { id: 2 }, data_legislacao: '01/01/2027', diarios: [] }, HOJE).data_assinatura, null, 'data futura descartada');
  for (const x of [lei, lc, dec]) conferirPrivacidade(x);
  n++;
}

// ---------------------------------------------------------------- vetos
{
  const [parcial, total] = amostra('mensagens_veto.json').resultados.map((r) => interpretarVetoListaGO(r, HOJE));
  eq(parcial.id, 'veto-1344');
  eq(parcial.tipo, 'Veto Parcial');
  eq(total.tipo, 'Veto Total', '"Integral" → Veto Total');
  eq(parcial.titulo, 'Ofício Mensagem nº 162/2026 (veto parcial)');
  eq(parcial.data_assinatura, '2026-09-09');
  eq(parcial.data_publicacao, null, 'data de publicação não vem na API: não é deduzida');
  eq(parcial.projeto_origem_texto, 'Autógrafo de Lei nº 405; processo na Assembleia nº 24700/2024; norma relacionada na Casa Civil: Lei Ordinária nº 24.530');
  eq(total.projeto_origem_texto, 'Autógrafo de Lei nº 404; processo na Assembleia nº 2646/2024 e nº 2873/2024');
  eq(parcial.razoes_veto, null);
  ok(parcial.lacunas.some((l) => /ainda não coletado/.test(l)));
  eq(parcial.url, 'https://legisla.casacivil.go.gov.br/pesquisa_mensagem_veto/1344');

  const det = aplicarDetalheVetoGO(parcial, amostra('mensagem_veto_1344.json'), HOJE);
  ok(det.detalhe_coletado);
  ok(/^OFÍCIO MENSAGEM Nº 162\/2026\/CASA CIVIL\n/.test(det.razoes_veto), 'texto começa no expediente');
  ok(/RAZÕES DO VETO\n/.test(det.razoes_veto), 'parágrafos preservados');
  ok(/Governador do Estado$/.test(det.razoes_veto), 'texto termina na assinatura');
  ok(/\nDANIEL VILELA\nGovernador do Estado$/.test(det.razoes_veto), 'assinatura do governador mantida (agente público)');
  ok(/\nDeputado Estadual Bruno Peixoto\n/.test(det.razoes_veto), 'destinatário (presidente da Assembleia) mantido');
  ok(/\nPalácio Maguito Vilela\n/.test(det.razoes_veto), 'nome do prédio mantido');
  ok(!/trecho em dúvida/.test(det.razoes_veto), 'nenhum trecho em dúvida nesta mensagem');
  ok(!/<[a-z]/i.test(det.razoes_veto) && !/infra_hash/.test(det.razoes_veto), 'sem HTML nem endereços');
  eq(det.titulo, 'Ofício Mensagem nº 162/2026 (veto parcial): Veto parcial ao Autógrafo de Lei nº 405, de 2026');
  ok(!det.lacunas.some((l) => /ainda não coletado/.test(l)), 'lacuna das razões resolvida');
  ok(det.lacunas.some((l) => /Data de publicação/.test(l)), 'lacuna da data mantida');
  conferirPrivacidade(det);
  n++;
  // Nome de particular nas razões é mascarado e a lacuna é anotada.
  const comNome = aplicarDetalheVetoGO(parcial, { conteudo: '<p>Pretendeu-se conceder pensão à senhora Maria Aparecida dos Santos Oliveira.</p>' }, HOJE);
  ok(!/Maria Aparecida dos Santos/.test(comNome.razoes_veto ?? ''), 'particular mascarado');
  ok(comNome.lacunas.includes(LACUNA_PRIVACIDADE) || /omitido/.test(comNome.razoes_veto ?? ''), 'mascaramento registrado');
  eq(aplicarDetalheVetoGO(parcial, {}, HOJE).razoes_veto, null, 'sem conteúdo: null');
}

// ---------------------------------------------------------------- Assembleia indisponível
{
  ok(/robots\.txt/.test(ASSEMBLEIA_INDISPONIVEL.motivo) && /Disallow: \//.test(ASSEMBLEIA_INDISPONIVEL.motivo), 'motivo cita o robots.txt');
  ok(/Lei de Acesso à Informação/.test(ASSEMBLEIA_INDISPONIVEL.pedido_lai), 'pedido pela LAI');
  eq(new URL(ASSEMBLEIA_INDISPONIVEL.fonte.url).host, 'alegodigital.al.go.leg.br');
  // O coletor nunca pede nada a host da Assembleia.
  const fonteColetor = fs.readFileSync(path.join(AQUI, 'coletar.mjs'), 'utf8').replace(/ASSEMBLEIA_INDISPONIVEL = \{[\s\S]*?\n\};/, '');
  ok(!/al\.go\.leg\.br/.test(fonteColetor), 'nenhum endereço da ALEGO no código de coleta');
}

console.log(`go/testes: ${n} verificações ok`);
