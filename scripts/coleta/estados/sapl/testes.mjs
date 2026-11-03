#!/usr/bin/env node
/**
 * Testes offline do coletor SAPL (sem rede): amostras reais pequenas em amostras/sapl-registros.json
 * (respostas da API de AM e RO de 2026-11-02, sem os campos ip/user) e um servidor SAPL simulado
 * com relógio falso para conferir robots.txt primeiro, intervalo de 61 s, cursor e saídas.
 *   node scripts/coleta/estados/sapl/testes.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { interpretarRobots, permitido, ClienteHost } from './http.mjs';
import { estadoVazio, iniciarExecucao, proximaPagina, aplicarPagina, encerrarExecucao, coberturaDesde, bordas } from './fluxos.mjs';
import { validarData, normMateria, normNorma, normRegistro, normParlamentar, emailInstitucional } from './normalizar.mjs';
import { indexarTabelas, montarVotacao, partidoEm } from './montar.mjs';
import { executarCasa } from './tarefas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const AM = JSON.parse(fs.readFileSync(path.join(AQUI, 'amostras', 'sapl-registros.json'), 'utf8'));
const erros = [];
let n = 0;
const ok = (cond, msg) => { n++; if (!cond) erros.push(msg); };
const semRegras = () => [];

// ------------------------------------------------------------------ robots.txt
const ROBOTS = `User-agent: semrushbot\nDisallow: /\n\nUser-agent: *\nCrawl-delay: 60\nDisallow: /materia/docacessorio/pdf/*\nDisallow: /materia/docacessorio/zip/*\n`;
{
  const r = interpretarRobots(ROBOTS);
  ok(r.crawl_delay === 60, 'robots: Crawl-delay 60');
  ok(!permitido(r, '/materia/docacessorio/pdf/12/x.pdf'), 'robots: docacessorio/pdf proibido');
  ok(!permitido(r, '/materia/docacessorio/qualquer'), 'docacessorio sempre proibido (regra do projeto)');
  ok(permitido(r, '/api/sessao/votoparlamentar/?votacao=1'), 'robots: API permitida');
  ok(permitido(interpretarRobots('User-agent: *\nDisallow:\n'), '/api/'), 'Disallow vazio libera tudo');
}

// ------------------------------------------------------------------ datas
{
  const hoje = '2026-11-02';
  ok(validarData('2026-11-25', { hoje, futuroDias: 1 }).data === null, 'data futura (erro de digitação do SAPL-RO) vira null');
  ok(validarData('2208-02-06', { hoje }).invalida === '2208-02-06', 'ano 2208 é inválido');
  ok(validarData('2026-02-30', { hoje }).data === null, '30/02 é inválido');
  ok(validarData('2026-10-28T16:12:55.698749-03:00', { hoje }).data === '2026-10-28', 'ISO com hora');
  const ro = normMateria(AM['ro /api/materia/materialegislativa/'][0], { hoje, regras: semRegras });
  ok(ro.data_apresentacao === null && ro.lacunas.some((l) => l.includes('2026-11-25')), 'matéria RO com data 2026-11-25: null + lacuna com o valor bruto');
}

// ------------------------------------------------------------------ privacidade e campos pessoais
{
  const hoje = '2026-11-02';
  const nr = normNorma(AM['am /api/norma/normajuridica/'][0], { hoje, regras: semRegras });
  ok(!/Gordon|Phillips/.test(nr.ementa) && /\[nome de particular omitido\]|\[trecho em dúvida/.test(nr.ementa), `nome de particular omitido na ementa: ${nr.ementa}`);
  const p = normParlamentar({ id: 5, nome_parlamentar: 'Abdala Fraxe', nome_completo: 'Fulano', cpf: '123.456.789-00', rg: '1', telefone: '9999', data_nascimento: '1970-01-01', email: 'x@gmail.com', ativo: true });
  ok(!('cpf' in p) && !('rg' in p) && !('telefone' in p) && !('data_nascimento' in p), 'parlamentar sem CPF/RG/telefone/nascimento');
  ok(emailInstitucional('x@gmail.com', ['aleam.gov.br']) === null && emailInstitucional('dep@aleam.gov.br', ['aleam.gov.br']) === 'dep@aleam.gov.br', 'e-mail só institucional');
  const reg = normRegistro({ ...AM['am /api/sessao/registrovotacao/'][0], observacao: 'Voto de pesar pela morte do Sr. José da Silva, CPF 123.456.789-00' }, { hoje, regras: semRegras });
  ok(!/123\.456/.test(reg.observacao) && !/José da Silva/.test(reg.observacao), `observação sem CPF e sem particular: ${reg.observacao}`);
}

// ------------------------------------------------------------------ cursor (faixas de ids)
function simularFonte(ids, ps) {
  // lista o=-id paginada
  const lista = () => [...ids].sort((a, b) => b - a);
  return (p, s = ps) => {
    const l = lista();
    const pg = l.slice((p - 1) * s, p * s).map((id) => ({ id }));
    return { res: pg, temProxima: p * s < l.length };
  };
}
function rodar(est, fonte, maxReq, ps) {
  const e = iniciarExecucao(est);
  for (let i = 0; i < maxReq; i++) {
    const plano = proximaPagina(est, e);
    if (plano == null) break;
    const { res, temProxima } = fonte(plano.pagina, plano.tamanho || ps);
    aplicarPagina(est, e, plano.pagina, res, { temProxima, tamanho: temProxima && !plano.tamanho ? res.length : null, tamanhoPedido: plano.tamanho, dataDe: () => null });
    if (e.fase === 'retro' && est.concluido) break;
  }
  encerrarExecucao(est, e);
}
{
  const ids = new Set(Array.from({ length: 23 }, (_, i) => i + 1));
  const est = estadoVazio();
  rodar(est, simularFonte(ids, 5), 2, 5);
  ok(est.faixas.length === 1 && est.faixas[0].hi === 23 && est.faixas[0].lo === 16 && est.faixas[0].n === 8, `2 páginas (a 2ª com âncora): faixa 23..16 (${JSON.stringify(est.faixas)})`);
  for (let i = 24; i <= 31; i++) ids.add(i); // 8 novos
  rodar(est, simularFonte(ids, 5), 1, 5); // orçamento só para 1 página: topo incompleto
  ok(est.faixas.length === 2 && est.faixas[0].hi === 31 && est.faixas[0].lo === 27, `topo incompleto vira faixa separada (${JSON.stringify(est.faixas)})`);
  rodar(est, simularFonte(ids, 5), 20, 5);
  ok(est.faixas.length === 1 && est.faixas[0].hi === 31 && est.faixas[0].lo === 1 && est.faixas[0].n === 31 && est.concluido, `emenda faixas e conclui (${JSON.stringify(est.faixas)})`);
  // Registros apagados acima do cursor: a posição é corrigida e nada é pulado.
  const ids2 = new Set(Array.from({ length: 40 }, (_, i) => i + 1));
  const e2 = estadoVazio();
  rodar(e2, simularFonte(ids2, 5), 2, 5); // 40..31
  ids2.delete(39); ids2.delete(35); ids2.delete(33);
  const vistos = new Set();
  const f2 = simularFonte(ids2, 5);
  rodar(e2, (p, s) => { const r = f2(p, s); r.res.forEach((x) => vistos.add(x.id)); return r; }, 20, 5);
  ok(e2.concluido && [...Array(30).keys()].every((i) => vistos.has(i + 1)), `deriva por exclusão: todos os ids 1..30 lidos (${JSON.stringify(e2.faixas)})`);
  ok(bordas({ faixas: [{ hi: 9, lo: 5 }], concluido: false }).has(5), 'borda inferior marcada enquanto não concluído');
}

// ------------------------------------------------------------------ montagem de votação
const CFG = { uf: 'AM', host: 'sapl.al.am.leg.br', casa: 'aleam', nome: 'Assembleia Legislativa do Estado do Amazonas (ALEAM)', dominios_email: ['aleam.gov.br'] };
{
  const hoje = '2026-11-02';
  const tab = indexarTabelas({
    tipos_resultado: [{ id: 1, nome: 'Aprovado', natureza: 'aprovado' }],
    tipos_materia: [{ id: 1, sigla: 'PL', descricao: 'Projeto de Lei Ordinária' }],
    parlamentares: [{ id: 5, nome: 'Abdala Fraxe' }, { id: 7, nome: 'Adjuto Afonso' }, { id: 9, nome: 'Alessandra Campêlo' }],
    partidos: [{ id: 1, sigla: 'AVANTE' }, { id: 2, sigla: 'UNIÃO' }],
    filiacoes: [{ id: 1, parlamentar_id: 5, partido_id: 1, inicio: '2022-01-01', fim: null }, { id: 2, parlamentar_id: 7, partido_id: 2, inicio: '2026-11-01', fim: null }],
  });
  ok(partidoEm(tab, 5, '2026-10-28') === 'AVANTE' && partidoEm(tab, 7, '2026-10-28') === null, 'partido pela filiação vigente na data (sem filiação → null)');
  const reg = { ...normRegistro(AM['am /api/sessao/registrovotacao/'][0], { hoje, regras: semRegras }), sim: 3 };
  const item = { id: 7177, etapa: 'ordemdia', sessao_id: 2636, materia_id: 154551, numero_ordem: 31, tipo_votacao: 2, resultado: 'Aprovado' };
  const ctx = { cfg: CFG, hoje, tab, materias: new Map([[154551, { id: 154551, tipo_id: 1, numero: 721, ano: 2021, ementa: 'X' }]]), sessoes: new Map([[2636, { id: 2636, nome: '95ª Ordinária', data_inicio: '2026-10-28' }]]), pauta: new Map([['ordemdia-7177', item]]) };
  const votos = AM['am /api/sessao/votoparlamentar/'].map((v) => ({ parlamentar_id: v.parlamentar, voto: v.voto, voto_id: v.id }));
  const v = montarVotacao(ctx, 6872, reg, votos, () => 'coletados');
  ok(v.id === 'am-6872' && v.tipo === 'nominal' && v.resultado === 'aprovada' && v.votos.length === 3 && v.placar.sim === 3, `nominal com votos (${v.tipo}, ${v.resultado}, ${v.votos.length})`);
  ok(/conferem/.test(v.conferencia_placar) && v.data === '2026-10-28' && v.hora === '16:12' && v.uf === 'AM' && v.casa === 'aleam', 'conferência do placar, data, hora, uf e casa');
  const sem = montarVotacao(ctx, 6872, reg, [], () => 'inexistentes-na-fonte');
  ok(sem.votos.length === 0 && sem.lacunas.some((l) => l.includes('Informação não disponível em fonte oficial')), 'nominal sem votoparlamentar → "Informação não disponível em fonte oficial"');
  ctx.pauta.set('ordemdia-7177', { ...item, tipo_votacao: 1 });
  const simb = montarVotacao(ctx, 6872, { ...reg, observacao: 'Aprovado por unanimidade' }, votos, () => 'nao-se-aplica');
  ok(simb.tipo === 'simbolica' && simb.placar === null && simb.votos.length === 0 && simb.totais_registrados?.sim === 3, 'simbólica: placar null, sem votos (nada deduzido da unanimidade)');
  ctx.pauta.set('ordemdia-7177', { ...item, tipo_votacao: 3 });
  const sec = montarVotacao(ctx, 6872, reg, votos, () => 'nao-se-aplica');
  ok(sec.tipo === 'secreta' && sec.votos.length === 0, 'secreta: nunca atribui voto individual');
  ctx.pauta.delete('ordemdia-7177');
  const semTipo = montarVotacao(ctx, 6872, reg, votos, () => 'em-coleta');
  ok(semTipo.tipo === null && semTipo.votos.length === 0 && semTipo.lacunas.some((l) => l.includes('confirmado na pauta')), 'tipo desconhecido: votos guardados, não exibidos');
}

// ------------------------------------------------------------------ integração com SAPL simulado
function servidorFalso() {
  const pag = (lista, url) => {
    const p = Number(url.searchParams.get('page') || 1);
    const ps = Math.min(Number(url.searchParams.get('page_size') || 10), 3); // máximo aceito: 3
    let l = [...lista];
    if (url.searchParams.get('o') === '-id') l.sort((a, b) => b.id - a.id);
    const fatia = l.slice((p - 1) * ps, p * ps);
    if (!fatia.length && p > 1) return null;
    const temProx = p * ps < l.length;
    return { pagination: { total_entries: l.length, next_page: temProx ? p + 1 : null, page: p }, results: fatia };
  };
  const votos = [];
  for (const [i, reg] of [6872, 6871, 6870].entries()) for (const pid of [5, 7, 9]) votos.push({ id: 137522 + i * 10 + pid, voto: 'Sim', data_hora: '2026-10-28T16:12:55-03:00', votacao: reg, parlamentar: pid, ordem: 7177 - i });
  const d = {
    '/api/parlamentares/legislatura/': [{ id: 20, numero: 20, data_inicio: '2023-02-01', data_fim: '2027-01-31' }],
    '/api/sessao/tiporesultadovotacao/': [{ id: 1, nome: 'Aprovado', natureza: 'aprovado' }],
    '/api/materia/tipomaterialegislativa/': [...AM['am /api/materia/tipomaterialegislativa/'], { id: 1, sigla: 'PL', descricao: 'Projeto de Lei Ordinária' }, { id: 3, sigla: 'REQ', descricao: 'Requerimento' }],
    '/api/parlamentares/mandato/': AM['am /api/parlamentares/mandato/'],
    '/api/norma/tiponormajuridica/': [{ id: 1, sigla: 'LO', descricao: 'Lei Ordinária' }],
    '/api/sessao/tiposessaoplenaria/': [{ id: 1, nome: 'Ordinária' }],
    '/api/parlamentares/partido/': [{ id: 1, sigla: 'AVANTE', nome: 'Avante' }],
    '/api/parlamentares/filiacao/': [{ id: 1, parlamentar: 5, partido: 1, data: '2020-01-01', data_desfiliacao: null }],
    '/api/parlamentares/parlamentar/': [5, 7, 9].map((id) => ({ id, nome_parlamentar: `Deputado ${id}`, nome_completo: `Nome ${id}`, ativo: true, cpf: '123.456.789-00', telefone: '(92) 9999-9999', email: `d${id}@gmail.com`, fotografia: null })),
    '/api/materia/statustramitacao/': [{ id: 1, sigla: 'APR', descricao: 'Aprovado' }],
    '/api/base/autor/': [{ id: 170, nome: 'Deputado 5', object_id: 5 }],
    '/api/sessao/registrovotacao/': AM['am /api/sessao/registrovotacao/'].map((r) => ({ ...r, numero_votos_sim: 3 })),
    '/api/sessao/votoparlamentar/': votos,
    '/api/sessao/ordemdia/': AM['am /api/sessao/ordemdia/'],
    '/api/sessao/expedientemateria/': [],
    '/api/sessao/sessaoplenaria/': [{ id: 2636, __str__: '95ª Ordinária da 4ª Sessão Legislativa da 20ª Legislatura', numero: 95, tipo: 1, data_inicio: '2026-10-28', hora_inicio: '13:00' }],
    '/api/materia/materialegislativa/': [...AM['am /api/materia/materialegislativa/']],
    '/api/norma/normajuridica/': AM['am /api/norma/normajuridica/'],
    '/api/materia/tramitacao/': [{ id: 900, materia: 185064, data_tramitacao: '2026-10-29', status: 1, texto: 'Aprovado em discussão única' }],
  };
  const detalhe = { 154551: { id: 154551, numero: 721, ano: 2021, tipo: 1, data_apresentacao: '2021-05-01', ementa: 'Dispõe sobre teste.', autores: [170] } };
  const chamadas = [];
  let t = Date.parse('2026-11-02T12:00:00Z');
  const relogio = { agora: () => t, dormir: async (ms) => { t += ms; } };
  const fetchImpl = async (u) => {
    const url = new URL(u);
    chamadas.push({ t, caminho: url.pathname + url.search });
    t += 400;
    const resp = (status, corpo) => ({ status, text: async () => (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)) });
    if (url.pathname === '/robots.txt') return resp(200, ROBOTS);
    const m = /^(\/api\/.+\/)(\d+)\/$/.exec(url.pathname);
    if (m) {
      if (m[1] === '/api/materia/materialegislativa/' && detalhe[m[2]]) return resp(200, detalhe[m[2]]);
      const r = (d[m[1]] || []).find((x) => String(x.id) === m[2]);
      return r ? resp(200, r) : resp(404, '{}');
    }
    if (!d[url.pathname]) return resp(404, '{}');
    const corpo = pag(d[url.pathname], url);
    return corpo ? resp(200, corpo) : resp(404, '{"detail":"Página inválida."}');
  };
  return { d, chamadas, relogio, fetchImpl, get t() { return t; } };
}

{
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'sapl-teste-'));
  const s = servidorFalso();
  const logs = [];
  const op = (min) => ({ raiz, hoje: '2026-11-02', prazoMs: s.t + min * 60000, pageSize: 1000, log: (...m) => logs.push(m.join(' ')), fetchImpl: s.fetchImpl, dormirImpl: s.relogio.dormir, agora: s.relogio.agora });
  const r1 = await executarCasa(CFG, op(120));
  ok(s.chamadas[0].caminho === '/robots.txt', 'primeira requisição é o robots.txt');
  const intervalos = s.chamadas.slice(1).map((c, i) => c.t - s.chamadas[i].t);
  ok(intervalos.every((x) => x >= 61000), `intervalo mínimo de 61 s entre requisições (menor: ${Math.min(...intervalos) / 1000} s)`);
  ok(!s.chamadas.some((c) => /docacessorio/.test(c.caminho)), 'nunca acessa docacessorio');
  ok(r1.robotsOk && r1.falhas.length === 0, `execução 1 sem falhas: ${r1.falhas.join(' | ')}`);
  const dir = path.join(raiz, 'dados', 'estados', 'am');
  const ler = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const v = ler('votacoes/am-6872.json');
  ok(v.tipo === 'nominal' && v.votos.length === 3 && v.votos_situacao === 'coletados' && v.proposicao?.sigla === 'PL' && v.proposicao.numero === 721, `votação am-6872 completa (${v.votos_situacao}, ${v.proposicao?.sigla})`);
  ok(v.sessao?.nome?.startsWith('95ª Ordinária') && v.fonte.url.startsWith('https://sapl.al.am.leg.br/') && v.fonte.acessado_em === '2026-11-02', 'votação com sessão, fonte oficial e data de coleta');
  const parl = ler('parlamentares.json');
  const txt = JSON.stringify(parl) + fs.readFileSync(path.join(dir, 'tabelas.json'), 'utf8');
  ok(parl.itens.length === 3 && !/123\.456|9999-9999|gmail/.test(txt), 'parlamentares.json e tabelas.json sem CPF, telefone ou e-mail pessoal');
  ok(parl.itens.find((p) => p.id === '5')?.partido === 'AVANTE' && parl.itens.every((p) => p.uf === 'AM' && p.casa === 'aleam'), 'partido atual pela filiação; uf e casa');
  const props = ler('proposicoes/indice-2026.json');
  ok(props.itens.find((p) => p.id_oficial === 185064)?.situacao?.texto === 'Aprovado em discussão única', 'última tramitação na proposição');
  ok(fs.existsSync(path.join(dir, 'proposicoes', 'indice-2021.json')), 'matéria antiga votada buscada como dependência');
  const normas = ler('normas/indice-2026.json');
  ok(normas.itens.some((x) => x.id === 'lei-8563-2026') && !/Gordon/.test(JSON.stringify(normas)), 'normas: id lei-n-ano e particular omitido');
  const meta = ler('meta.json');
  ok(meta.robots['sapl.al.am.leg.br'].crawl_delay_s === 60 && meta.cursor.fluxos.votoparlamentar.faixas.length === 1, 'meta: robots e cursor');
  ok(fs.existsSync(path.join(dir, 'sessoes', 'indice-2026.json')) && fs.existsSync(path.join(dir, 'votacoes', 'indice-2026.json')), 'índices de sessões e votações');

  // Execução 2: um registro novo, nominal sem votos (painel não usado) → "inexistentes-na-fonte".
  s.d['/api/sessao/ordemdia/'].push({ id: 7178, tipo_votacao: 2, sessao_plenaria: 2636, materia: 185064, numero_ordem: 32, data_ordem: '2026-10-30' });
  s.d['/api/sessao/registrovotacao/'].push({ id: 6873, numero_votos_sim: 20, numero_votos_nao: 1, numero_abstencoes: 0, data_hora: '2026-10-30T10:00:00-03:00', tipo_resultado_votacao: 1, materia: 185064, ordem: 7178, expediente: null, observacao: '' });
  const antes = s.chamadas.length;
  const r2 = await executarCasa(CFG, op(15));
  const novas = s.chamadas.slice(antes);
  ok(novas[0].caminho === '/robots.txt' && novas[0].t - s.chamadas[antes - 1].t >= 61000, 'execução 2: robots.txt primeiro, 61 s depois da última requisição da execução anterior');
  ok(r2.requisicoes <= 15, `execução 2 respeita o orçamento (${r2.requisicoes} requisições em 15 min)`);
  const v2 = ler('votacoes/am-6873.json');
  ok(v2.tipo === 'nominal' && v2.votos.length === 0 && v2.votos_situacao === 'inexistentes-na-fonte' && v2.placar.sim === 20, `nominal sem votos na fonte (${v2.votos_situacao})`);
  if (process.env.SAPL_TESTE_DEBUG) console.log(raiz, logs.join('\n')); else fs.rmSync(raiz, { recursive: true, force: true });
}

if (erros.length) { console.error(`FALHOU (${erros.length} de ${n}):\n- ` + erros.join('\n- ')); process.exit(1); }
console.log(`OK: ${n} conferências.`);
