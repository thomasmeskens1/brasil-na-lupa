#!/usr/bin/env node
// Testes offline do coletor de Santa Catarina (ALESC). Amostras reduzidas de páginas reais de 04/11/2026
// (estrutura preservada) em fixtures/. Rodar: node scripts/coleta/estados/sc/testes.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { permitido, conferirPrivacidade } from '../abertos/base.mjs';
import {
  USER_AGENT_SC, INDISPONIVEL, ClienteSC, interpretarRobotsSC, idSeguro, identificacaoSC, interpretarDeputadosSC,
  tiposPropositura, totalExibindo, interpretarListaProposicoesSC, interpretarTramitacaoSC, aplicarTramitacaoSC, marcaAndamento,
  interpretarSessoesSC, ultimaPagina, interpretarOrdemDoDiaSC, interpretarExtratoSC, votacaoSC, interpretarListaNormasSC,
  interpretarFichaLeiSC, aplicarFichaLeiSC,
} from './alesc.mjs';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const ler = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const HOJE = '2026-11-04';

// ---------------------------------------------------------------- robots.txt (texto real do portal, dois grupos "*")
const ROBOTS_PORTAL = '# START YOAST BLOCK\n# ---------------------------\nUser-agent: *\nDisallow: /?s=\nDisallow: /page/*/?s=\nDisallow: /search/\nDisallow: /wp-json/\nDisallow: /?rest_route=\n\nSitemap: https://www.alesc.sc.gov.br/sitemap_index.xml\n# ---------------------------\n# END YOAST BLOCK\nUser-agent: *\nDisallow: /guia-botanico/\n';
{
  const r = interpretarRobotsSC(ROBOTS_PORTAL);
  ok(!permitido(r, '/wp-json/wp/v2/deputados'), '/wp-json/ proibido');
  ok(!permitido(r, '/guia-botanico/x'), 'regra do segundo grupo "*" somada');
  ok(!permitido(r, '/?s=deputado'), 'busca proibida');
  ok(permitido(r, '/'), 'página inicial liberada');
  ok(permitido(r, '/deputado/alex-brasil/'), 'perfil liberado');
  const proprio = interpretarRobotsSC('User-agent: *\nDisallow: /\n\nUser-agent: BrasilNaLupa\nDisallow: /privado\nCrawl-delay: 5\n');
  ok(permitido(proprio, '/sessoes'), 'grupo do nosso robô vence o "*"');
  eq(proprio.crawl_delay_s, 5);
}

// Cliente: robots.txt antes de tudo; caminho proibido nunca é pedido; User-Agent do projeto; X-Requested-With só no extrato.
{
  const pedidos = [];
  let relogio = 0;
  const fetchImpl = async (url, o) => {
    pedidos.push({ url, ua: o?.headers?.['User-Agent'], xrw: o?.headers?.['X-Requested-With'] ?? null, t: relogio });
    if (url.endsWith('/robots.txt')) {
      if (url.includes('www.alesc')) return { status: 200, ok: true, headers: { get: () => 'text/plain' }, text: async () => ROBOTS_PORTAL };
      return { status: 404, ok: false, headers: { get: () => 'text/html' }, text: async () => '<html>404</html>' };
    }
    return { status: 200, ok: true, headers: { get: () => 'text/html' }, text: async () => '<html>ok</html>' };
  };
  const c = new ClienteSC({ prazoMs: 1e12, fetchImpl, agora: () => relogio, dormirImpl: async (ms) => { relogio += ms; } });
  eq(await c.texto('https://www.alesc.sc.gov.br/'), '<html>ok</html>');
  eq(pedidos[0].url, 'https://www.alesc.sc.gov.br/robots.txt', 'robots primeiro');
  await assert.rejects(() => c.texto('https://www.alesc.sc.gov.br/wp-json/wp/v2/posts'), /robots/); n++;
  await assert.rejects(() => c.texto('https://www.alesc.sc.gov.br/guia-botanico/a'), /robots/); n++;
  eq(pedidos.length, 2, 'caminhos proibidos não geraram requisição');
  await c.texto('https://portalelegis.alesc.sc.gov.br/sessoes-plenarias');
  await c.texto('https://portalelegis.alesc.sc.gov.br/extrato-votacao/zeYY8');
  ok(pedidos.every((p) => p.ua === USER_AGENT_SC), 'User-Agent do projeto em todas as requisições');
  eq(USER_AGENT_SC, 'BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)');
  eq(pedidos.filter((p) => p.xrw).map((p) => p.url), ['https://portalelegis.alesc.sc.gov.br/extrato-votacao/zeYY8'], 'cabeçalho do site só no extrato');
  const el = pedidos.filter((p) => p.url.includes('portalelegis') && !p.url.endsWith('robots.txt'));
  ok(el[1].t - el[0].t >= 2000, 'intervalo mínimo de 2 s no mesmo host');
  eq(c.resumoRobots()['www.alesc.sc.gov.br'].disallow.includes('/guia-botanico/'), true);
  ok(/sem robots\.txt/.test(c.resumoRobots()['portalelegis.alesc.sc.gov.br'].observacao), 'e-Legis sem robots.txt anotado');
}

// ---------------------------------------------------------------- utilitários
eq(idSeguro('NpwW5'), 'npww5-9');
ok(idSeguro('npww5') !== idSeguro('NpwW5'), 'ids que só diferem em maiúsculas não colidem');
eq(idSeguro('../x'), null);
eq(identificacaoSC('PL./0675/2026'), { sigla: 'PL', numero: 675, ano: 2026, identificacao: 'PL 675/2026', identificacao_oficial: 'PL./0675/2026' });
eq(identificacaoSC('MSV/0824/2025').identificacao, 'MSV 824/2025');
eq(identificacaoSC('texto livre').sigla, null);

// ---------------------------------------------------------------- deputados
{
  const d = interpretarDeputadosSC(ler('home.html'), HOJE);
  eq(d.itens.map((x) => [x.id, x.nome, x.partido]), [['alex-brasil', 'Alex Brasil', 'PL'], ['altair-silva', 'Altair Silva', 'PP'], ['ana-campagnolo', 'Ana Campagnolo', 'PL']]);
  ok(d.itens.every((x) => x.foto?.startsWith('https://www.alesc.sc.gov.br/wp-content/uploads/')), 'foto oficial');
  eq(d.itens[0].url_oficial, 'https://www.alesc.sc.gov.br/deputado/alex-brasil/');
  eq(d.itens[0].em_exercicio, null, 'exercício não deduzido');
  conferirPrivacidade(d); n++;
}

// ---------------------------------------------------------------- proposições
{
  const h = ler('proposicoes.html');
  const tipos = tiposPropositura(h);
  eq(tipos.find((t) => t.codigo === 10)?.nome, 'Mensagem de Veto');
  eq(tipos.length, 14);
  eq(totalExibindo(h), 35149);
  const l = interpretarListaProposicoesSC(h, 'Projeto de Lei', HOJE, new Map([['PAULINHA', 'paulinha']]));
  eq(l.length, 2);
  eq(l[0].identificacao, 'PL 675/2026');
  eq(l[0].id_oficial, '5GR8Z');
  eq(l[0].data_apresentacao, '2026-11-04');
  eq(l[0].autores, [{ nome: 'Deputada Paulinha', parlamentar_id: 'paulinha' }]);
  eq(l[0].situacao.texto, 'Lido no Expediente');
  eq(l[0].situacao.lotacao, 'Diretoria Legislativa');
  eq(l[0].url, 'https://portalelegis.alesc.sc.gov.br/proposicoes/5GR8Z/tramitacoes');
  const t = interpretarTramitacaoSC(ler('tramitacao.html'), HOJE);
  eq(t.regime, 'Não aplicável');
  eq(t.itens[0], { data: '2026-03-20', situacao: 'Arquivado', descricao: null, origem: 'Coordenadoria de Documentação', destino: 'Coordenadoria de Documentação', publicacao: null });
  ok(t.itens.some((x) => x.publicacao?.endsWith('diaicp.pdf')), 'link do Diário da Assembleia');
  eq(t.itens.at(-1).descricao, 'Lido na 001ª Sessão Ordinária de 04/02/2025.');
  const p = aplicarTramitacaoSC(l[0], t, HOJE);
  eq(p.tramitacao_marca, marcaAndamento(l[0]));
  eq(p.situacao.ultima_tramitacao, { data: '2026-03-20', descricao: 'Arquivado' });
  conferirPrivacidade(p); n++;
}

// ---------------------------------------------------------------- sessões, Ordem do Dia e extrato
{
  const s = interpretarSessoesSC(ler('sessoes.html'), HOJE);
  eq(s.map((x) => [x.id_oficial, x.titulo, x.data, x.hora, x.situacao]), [['KDxrK', '105ª Sessão Ordinária', '2026-11-05', '09:00', 'Horário regimental'], ['K43gz', '45ª Sessão Extraordinária', '2026-11-04', '16:17', 'Realizada']]);
  eq(ultimaPagina(ler('sessoes.html'), '/sessoes-plenarias?'), 64);
  const od = interpretarOrdemDoDiaSC(ler('ordem-do-dia.html'), HOJE);
  eq(od.sessao, { titulo: '8ª Sessão Extraordinária', tipo: 'Sessão Plenária Extraordinária', data: '2026-03-18', hora_inicio: '16:15', situacao: 'Realizada' });
  eq(od.itens.map((i) => [i.identificacao_oficial, i.resultado_oficial, i.forma_oficial, i.extrato_id_oficial]), [
    ['MSV/0824/2025', 'Aprovado', 'Votação nominal', 'zeYY8'], ['PLC/0002/2026', 'Aprovado', 'Votação nominal', 'zRA0O'], ['PL./0776/2025', 'Aprovado', 'Votação simbólica', null]]);
  eq(od.itens[0].secao, 'Processos » Votação');
  eq(od.itens[0].autoria, ['Governador do Estado']);
  const semForma = interpretarOrdemDoDiaSC(ler('ordem-do-dia.html').replace('<span class="badge text-bg-light">Votação simbólica</span>', ''), HOJE);
  eq(semForma.itens.length, 2, 'item sem forma de votação (comunicado, retirado de pauta) não vira votação');

  const ex = interpretarExtratoSC(ler('extrato.html'));
  eq(ex.identificacao_oficial, 'MSV/0824/2025');
  eq(ex.votos[0], { nome: 'Jessé Lopes', voto: 'Sim' });
  eq(ex.cartoes, 4);
  ok(ex.conferido, 'soma dos votos = número de cartões');
  // Cartão sem voto: conferência falha e nada é gravado
  const quebrado = interpretarExtratoSC(ler('extrato.html').replace('<span class="badge text-bg-success fw-normal">Sim</span>', ''));
  ok(!quebrado.conferido, 'cartão sem voto derruba a conferência');

  const sessao = { ...s[1], id: 'sc-npww5-9', id_oficial: 'NpwW5', titulo: od.sessao.titulo, data: od.sessao.data, tipo: od.sessao.tipo, hora_inicio: '16:15', url: 'https://portalelegis.alesc.sc.gov.br/sessoes-plenarias/NpwW5/ordem-do-dia' };
  const porNome = new Map([['JESSE LOPES', 'jesse-lopes']]);
  const v = votacaoSC(sessao, od.itens[0], ex, { hoje: HOJE, porNome });
  eq(v.id, 'sc-npww5-9-v1');
  eq(v.tipo, 'nominal');
  eq(v.votos_situacao, 'coletados');
  eq(v.votos.length, 4);
  eq(v.votos[0], { parlamentar_id: 'jesse-lopes', nome: 'Jessé Lopes', partido: null, uf: 'SC', voto: 'Sim' });
  eq(v.placar, { sim: 4, nao: 0, abstencao: 0, obstrucao: null, outros: null, total: 4 });
  eq(v.placar_origem, 'contagem-dos-votos');
  ok(v.lacunas.some((l) => l.includes(INDISPONIVEL) && /Partido/.test(l)), 'partido na data: indisponível, não deduzido');
  ok(v.lacunas.some((l) => /veto/i.test(l)), 'sentido do voto em veto não deduzido');
  eq(v.resultado, 'aprovada');
  eq(v.proposicao.identificacao_oficial, 'MSV/0824/2025');
  conferirPrivacidade(v); n++;

  const vq = votacaoSC(sessao, od.itens[0], quebrado, { hoje: HOJE, porNome });
  eq([vq.votos_situacao, vq.votos.length, vq.placar], ['nao-conferido', 0, null]);
  const outro = votacaoSC(sessao, od.itens[0], { ...ex, identificacao_oficial: 'PLC/0002/2026' }, { hoje: HOJE });
  eq(outro.votos_situacao, 'nao-conferido', 'extrato de outra proposição não é gravado');
  const pend = votacaoSC(sessao, od.itens[1], null, { hoje: HOJE });
  eq(pend.votos_situacao, 'em-coleta');
  const simb = votacaoSC(sessao, od.itens[2], null, { hoje: HOJE });
  eq([simb.tipo, simb.votos_situacao, simb.votos, simb.placar], ['simbolica', 'nao-se-aplica', [], null]);
  eq(simb.proposicao.sigla, 'PL');
}

// ---------------------------------------------------------------- Legislação SC
{
  const r = interpretarListaNormasSC(ler('legislacao.html'), 'legislativo', HOJE);
  eq(r.total, 436);
  eq(r.itens.length, 2);
  eq([r.itens[0].tipo, r.itens[0].tipo_oficial, r.itens[0].numero, r.itens[0].ano, r.itens[0].data_assinatura], ['Lei', 'Lei Ordinária', 20079, 2026, '2026-10-27']);
  eq(r.itens[0].url, 'https://leis.alesc.sc.gov.br/ato-normativo/54622');
  eq(r.itens[0].detalhe_coletado, false);
  const dec = interpretarListaNormasSC(ler('legislacao.html').replace(/Lei Ordinária/g, 'Decreto Executivo'), 'executivo', HOJE);
  eq(dec.itens[0].tipo, 'Decreto');
  ok(dec.itens[0].lacunas.some((l) => /Diário Oficial/.test(l)), 'decreto: DOE indisponível anotado');
  eq(interpretarListaNormasSC('<html></html>', 'legislativo', HOJE), null);

  const f = interpretarFichaLeiSC(ler('ficha-lei.html'), HOJE);
  eq(f, { procedencia: 'Dep. Marcos da Rosa', natureza: 'PL./0320/2023', natureza_id_oficial: 'z372r', doe: { numero: '22.869', data: '2026-10-27', url: 'https://portal.doe.sea.sc.gov.br/repositorio/2026/20261027/Jornal/22869.pdf' } });
  const lei = aplicarFichaLeiSC(r.itens[0], f, HOJE);
  eq(lei.data_publicacao, '2026-10-27');
  eq(lei.projeto_origem.identificacao, 'PL 320/2023');
  eq(lei.projeto_origem.id, `sc-${idSeguro('z372r')}`);
  ok(!lei.lacunas.some((l) => /ainda não lida/.test(l)), 'lacuna de ficha pendente removida');
  conferirPrivacidade(lei); n++;
  eq(aplicarFichaLeiSC(r.itens[1], null, HOJE).detalhe_coletado, true);
}

console.log(`SC: ${n} verificações ok`);
