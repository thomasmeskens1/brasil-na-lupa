#!/usr/bin/env node
/**
 * Testes offline dos coletores de municípios (sem rede: servidores simulados e relógio falso).
 *   node scripts/coleta/municipios/testes.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { slugCidade, chaveNome, ClienteEducado, USER_AGENT, gravarCompacto } from './lib.mjs';
import { entesMunicipais, hostDaUrl, montarRegistro, escolherAmostra, verificarHost } from './registro.mjs';
import { campoColuna, lerAnexo01, lerAnexo02, relatoriosAlvo, precisa, ordenarEntes, coletar } from './siconfi.mjs';
import { cfgCamara, ajustarTexto } from './sapl.mjs';
import { Armazem } from '../estados/sapl/armazem.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const erros = [];
let n = 0;
const ok = (cond, msg) => { n++; if (!cond) erros.push(msg); };

/** Relógio falso + fetch simulado que registra (url, instante, User-Agent). */
function simulado(rotas) {
  let t = Date.parse('2026-11-03T12:00:00Z');
  const chamadas = [];
  return {
    chamadas,
    agora: () => t,
    dormir: async (ms) => { t += ms; },
    fetch: async (url, op) => {
      chamadas.push({ url: String(url), em: t, ua: op?.headers?.['User-Agent'] });
      const u = new URL(url);
      const r = rotas(u);
      t += 200;
      return { status: r.status ?? 200, text: async () => (typeof r.corpo === 'string' ? r.corpo : JSON.stringify(r.corpo)) };
    },
  };
}

// ------------------------------------------------------------------ nomes e endereços
ok(slugCidade('São José dos Campos') === 'sao-jose-dos-campos', 'slug com acento');
ok(slugCidade("Pau D'Arco") === 'pau-darco', 'slug com apóstrofo');
ok(slugCidade('Embu-Guaçu') === 'embu-guacu', 'slug com hífen e cedilha');
ok(chaveNome("Olho-d'Água do Borges") === chaveNome("Olho d'Água do Borges"), 'chave ignora hífen');
ok(hostDaUrl('https://sapl.atibaia.sp.leg.br/') === 'sapl.atibaia.sp.leg.br', 'host da URL');
ok(hostDaUrl('javascript:alert(1)') === null, 'URL inválida recusada');
ok(USER_AGENT.includes('Brasil na Lupa'), 'User-Agent identifica o projeto');

// ------------------------------------------------------------------ entes e registro
{
  const entes = entesMunicipais([
    { cod_ibge: 3504107, ente: 'Atibaia', capital: '0  ', uf: 'SP', esfera: 'M', populacao: 1 },
    { cod_ibge: 3550308, ente: 'São Paulo', capital: '1  ', uf: 'SP', esfera: 'M', populacao: 2 },
    { cod_ibge: 35, ente: 'São Paulo', capital: '0', uf: 'SP', esfera: 'E' },
    { cod_ibge: 9999991, ente: 'Igual', capital: '0', uf: 'MG', esfera: 'M' },
    { cod_ibge: 9999992, ente: 'Igual', capital: '0', uf: 'MG', esfera: 'M' },
  ]);
  ok(entes.length === 4, 'só esfera municipal');
  ok(entes.find((e) => e.cod_ibge === 3550308)?.capital === true, 'capital lida do campo oficial');
  ok(entes.filter((e) => e.uf === 'mg').every((e) => /-\d{7}$/.test(e.slug)), 'nome repetido na UF ganha o código IBGE');
  const servicos = [
    { casa_legislativa: { tipo_orgao_sigla: 'CM', municipio: 'Atibaia', uf: 'SP', nome: 'Câmara Municipal de Atibaia', email: 'x@y', telefone: '1' }, url: 'https://sapl.atibaia.sp.leg.br/', hospedagem_interlegis: true, data_ativacao: '2020-01-01' },
    { casa_legislativa: { tipo_orgao_sigla: 'AL', municipio: 'São Paulo', uf: 'SP', nome: 'Assembleia' }, url: 'https://sapl.al.sp.leg.br/' },
    { casa_legislativa: { tipo_orgao_sigla: 'CM', municipio: 'Inexistente', uf: 'SP', nome: 'CM X' }, url: 'https://sapl.x.sp.leg.br/' },
  ];
  const r = montarRegistro(servicos, entes);
  ok(r.camaras.length === 1 && r.camaras[0].cod_ibge === 3504107, 'registro liga Câmara ao município');
  ok(!('email' in r.camaras[0]) && !JSON.stringify(r).includes('x@y'), 'registro sem e-mail ou telefone');
  ok(r.sem_municipio.length === 1, 'casa sem município fica separada, sem correção');
  const am = escolherAmostra(r.camaras, entes, ['sp'], 10, '2026-11-03');
  ok(am.length === 1, 'amostra por UF');
  r.camaras[0].verificacao = { em: '2026-11-01' };
  ok(escolherAmostra(r.camaras, entes, ['sp'], 10, '2026-11-03').length === 0, 'verificada há menos de 30 dias não volta à amostra');
}

// ------------------------------------------------------------------ verificação de host (robots primeiro, Crawl-delay)
{
  const s = simulado((u) => {
    if (u.pathname === '/robots.txt') return { corpo: 'User-agent: *\nCrawl-delay: 60\nDisallow: /materia/docacessorio/\n' };
    if (u.pathname.startsWith('/api/sessao/votoparlamentar/')) return { corpo: { pagination: { total_entries: 7 }, results: [{}] } };
    return { corpo: { pagination: { total_entries: 3 }, results: [] } };
  });
  const v = await verificarHost({ host: 'sapl.teste.sp.leg.br' }, { prazoMs: Infinity, hoje: '2026-11-03', fetchImpl: s.fetch, dormirImpl: s.dormir, agora: s.agora });
  ok(s.chamadas[0].url.endsWith('/robots.txt'), 'robots.txt é a 1ª requisição');
  ok(s.chamadas.every((c, i) => i === 0 || c.em - s.chamadas[i - 1].em >= 61000), 'intervalo ≥ 61 s desde a 1ª requisição');
  ok(s.chamadas.every((c) => c.ua === USER_AGENT), 'User-Agent do projeto em todas');
  ok(v.api_responde === true && v.totais.votoparlamentar === 7 && v.votos_nominais_publicados === true, 'totais lidos da API');
  const s2 = simulado((u) => (u.pathname === '/robots.txt' ? { corpo: 'User-agent: *\nDisallow: /api/\n' } : { corpo: {} }));
  const v2 = await verificarHost({ host: 'sapl.fechado.leg.br' }, { prazoMs: Infinity, hoje: '2026-11-03', fetchImpl: s2.fetch, dormirImpl: s2.dormir, agora: s2.agora });
  ok(v2.api_permitida === false && s2.chamadas.length === 1, 'robots que proíbe /api/: nenhuma consulta à API');
}

// ------------------------------------------------------------------ Siconfi
{
  ok(campoColuna('PREVISÃO ATUALIZADA (a)') === 'prevista', 'coluna prevista');
  ok(campoColuna('Até o Bimestre (c)') === 'realizada', 'coluna realizada');
  ok(campoColuna('DESPESAS LIQUIDADAS ATÉ O BIMESTRE (h)') === 'liquidada', 'coluna liquidada');
  ok(campoColuna('DESPESAS LIQUIDADAS NO BIMESTRE') === null, 'coluna do bimestre isolado ignorada');
  const a1 = lerAnexo01([
    { cod_conta: 'TotalReceitas', conta: 'TOTAL DAS RECEITAS (V)', coluna: 'PREVISÃO ATUALIZADA (a)', valor: 10 },
    { cod_conta: 'TotalReceitas', conta: 'TOTAL DAS RECEITAS (V)', coluna: 'Até o Bimestre (c)', valor: 9 },
    { cod_conta: 'TotalDespesas', conta: 'TOTAL DAS DESPESAS', coluna: 'DESPESAS PAGAS ATÉ O BIMESTRE (j)', valor: 7 },
    { cod_conta: 'Taxas', conta: 'Taxas', coluna: 'Até o Bimestre (c)', valor: 1 },
  ]);
  ok(a1.receitas.TotalReceitas[0] === 10 && a1.receitas.TotalReceitas[1] === 9, 'Anexo 01: receita prevista e realizada');
  ok(a1.despesas.TotalDespesas[3] === 7 && a1.despesas.TotalDespesas[0] === null, 'Anexo 01: coluna ausente fica null (nada deduzido)');
  ok(!a1.receitas.Taxas, 'Anexo 01: linhas fora da lista não entram');
  const a2 = lerAnexo02([
    { rotulo: 'Total das Despesas Exceto Intra-Orçamentárias', conta: 'Saúde', coluna: 'DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)', valor: 5 },
    { rotulo: 'Total das Despesas Exceto Intra-Orçamentárias', conta: 'Atenção Básica', coluna: 'DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)', valor: 4 },
    { rotulo: 'Total das Despesas Intra-Orçamentárias', conta: 'Saúde', coluna: 'DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)', valor: 1 },
  ]);
  ok(a2.length === 1 && a2[0][0] === 'Saúde' && a2[0][2] === 5, 'Anexo 02: só funções da lista oficial, sem intra');
  const alvos = relatoriosAlvo('2026-11-03').map((r) => `${r.ano}-b${r.periodo}`).join(',');
  ok(alvos === '2025-b6,2026-b4', `relatórios-alvo em 03/11/2026 (${alvos})`);
  ok(relatoriosAlvo('2026-02-10').length === 1, 'em fevereiro só o ano anterior');
  ok(precisa(null, '2026-11-03') && !precisa({ consultado_em: '2026-11-01' }, '2026-11-03'), 'consultado com dados não volta');
  ok(precisa({ sem_dados: true, consultado_em: '2026-10-01' }, '2026-11-03') && !precisa({ sem_dados: true, consultado_em: '2026-11-01' }, '2026-11-03'), 'sem dados volta depois de 15 dias');
  ok(ordenarEntes([{ cod_ibge: 2, capital: 0, populacao: 9 }, { cod_ibge: 1, capital: 1, populacao: 1 }])[0].cod_ibge === 1, 'capitais primeiro');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mun-siconfi-'));
  const s = simulado((u) => {
    if (u.pathname === '/robots.txt') return { status: 404, corpo: '<html>404</html>' };
    const ibge = u.searchParams.get('id_ente');
    if (ibge === '2') return { corpo: { items: [], hasMore: false } };
    if (u.searchParams.get('no_anexo') === 'RREO-Anexo 01') return { corpo: { items: [{ instituicao: 'Prefeitura X', populacao: 5, cod_conta: 'TotalReceitas', conta: 'TOTAL', coluna: 'Até o Bimestre (c)', valor: 3 }], hasMore: false } };
    return { corpo: { items: [{ rotulo: 'Total das Despesas Exceto Intra-Orçamentárias', conta: 'Educação', coluna: 'DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)', valor: 2 }], hasMore: false } };
  });
  const r = await coletar({ entes: [{ cod_ibge: 1, uf: 'sp', nome: 'A', capital: 1, populacao: 1 }, { cod_ibge: 2, uf: 'sp', nome: 'B', capital: 0, populacao: 1 }], hoje: '2026-02-10', prazoMs: Infinity, intervaloMs: 1500, log: () => {}, fetchImpl: s.fetch, dormirImpl: s.dormir, agora: s.agora, dir });
  ok(s.chamadas[0].url.endsWith('/robots.txt'), 'Siconfi: robots.txt primeiro');
  ok(s.chamadas.every((c, i) => i === 0 || c.em - s.chamadas[i - 1].em >= 1500), 'Siconfi: intervalo mínimo respeitado');
  ok(r.feitos === 2 && s.chamadas.length === 4, 'Siconfi: município sem relatório não pede o Anexo 02');
  const arq = JSON.parse(fs.readFileSync(path.join(dir, '2025-b6', 'sp.json'), 'utf8'));
  ok(arq.itens['1'].receitas.TotalReceitas[1] === 3 && arq.itens['1'].funcoes[0][0] === 'Educação', 'Siconfi: arquivo por UF gravado');
  ok(arq.itens['2'].sem_dados === true, 'Siconfi: ausência registrada como "sem dados"');
  const s3 = simulado(() => ({ corpo: {} }));
  await coletar({ entes: [{ cod_ibge: 1, uf: 'sp', nome: 'A', capital: 1, populacao: 1 }, { cod_ibge: 2, uf: 'sp', nome: 'B', capital: 0, populacao: 1 }], hoje: '2026-02-10', prazoMs: Infinity, intervaloMs: 1500, log: () => {}, fetchImpl: s3.fetch, dormirImpl: s3.dormir, agora: s3.agora, dir });
  ok(s3.chamadas.length === 1, 'Siconfi: incremental (2ª execução não repete municípios já consultados)');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ------------------------------------------------------------------ gravação compacta
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mun-grav-'));
  const f = path.join(dir, 'a.json');
  ok(gravarCompacto(f, { a: 1, itens: { 1: { x: 1 } } }) === true, 'grava arquivo novo');
  ok(gravarCompacto(f, { a: 1, itens: { 1: { x: 1 } } }) === false, 'não regrava sem mudança');
  ok(JSON.parse(fs.readFileSync(f, 'utf8')).itens['1'].x === 1, 'JSON compacto válido');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ------------------------------------------------------------------ SAPL municipal (reaproveita o coletor estadual)
{
  const c = { uf: 'sp', slug: 'teste', municipio: 'Teste', casa: 'Câmara Municipal de Teste', host: 'sapl.teste.sp.leg.br' };
  const cfg = cfgCamara(c);
  ok(cfg.uf === 'SP' && cfg.dominios_email[0] === 'teste.sp.leg.br', 'configuração no formato do coletor estadual');
  ok(cfg.dir.endsWith(path.join('dados', 'municipios', 'sp', 'teste')), 'grava em dados/municipios/<uf>/<cidade>');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mun-sapl-'));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ cursor: { fluxos: {}, tabelas_em: {}, ultima_requisicao: '2026-11-03T10:00:00Z', pendencias_inexistentes: [] } }));
  const arm = new Armazem(RAIZ, { ...cfg, dir }, '2026-11-03');
  ok(arm.dir === dir && arm.cursor.ultima_requisicao === '2026-11-03T10:00:00Z', 'Armazém lê o cursor da pasta do município (intervalo vale entre execuções)');
  arm.gravar({ meta: { uf: 'SP' } });
  ok(fs.existsSync(path.join(dir, 'tabelas.json')) && !fs.existsSync(path.join(RAIZ, 'dados', 'estados', 'sp', 'tabelas.json.tmp')), 'Armazém grava só na pasta do município');
  fs.rmSync(dir, { recursive: true, force: true });
  ok(ajustarTexto('sem registro de voto por deputado no SAPL') === 'sem registro de voto por vereador no SAPL', 'texto padrão ajustado para vereador');
}

// ------------------------------------------------------------------ gerador do site (fixture mínima)
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mun-gerar-'));
  const dados = path.join(tmp, 'dados');
  const cid = path.join(dados, 'sp', 'teste');
  fs.mkdirSync(path.join(cid, 'votacoes'), { recursive: true });
  fs.writeFileSync(path.join(dados, 'entes.json'), JSON.stringify({ itens: [[1, 'Teste', 'sp', 'teste', 0, 10], [2, 'Vazio', 'sp', 'vazio', 0, 5]] }));
  fs.writeFileSync(path.join(cid, 'meta.json'), JSON.stringify({ orgao: 'Câmara Municipal de Teste', host: 'sapl.teste.sp.leg.br', fontes: [] }));
  fs.writeFileSync(path.join(cid, 'votacoes', 'sp-1.json'), JSON.stringify({ id: 'sp-1', tipo: 'simbolica', votos: [{ parlamentar_id: 9, nome: 'X', voto: 'Sim' }], lacunas: [] }));
  fs.writeFileSync(path.join(cid, 'votacoes', 'sp-2.json'), JSON.stringify({ id: 'sp-2', tipo: 'nominal', votos: [{ parlamentar_id: 9, nome: 'X', voto: 'Sim' }], lacunas: [] }));
  execFileSync(process.execPath, [path.join(RAIZ, 'web', 'scripts', 'gerar-municipios.mjs'), '--dados', dados, '--content', path.join(tmp, 'content'), '--public', path.join(tmp, 'public')], { stdio: 'pipe' });
  const ind = JSON.parse(fs.readFileSync(path.join(tmp, 'content', '_gerado', 'municipios', 'indice.json'), 'utf8'));
  ok(ind.presentes.length === 1 && ind.presentes[0].slug === 'teste', 'gerador: só entra município com fonte coletada');
  const v1 = JSON.parse(fs.readFileSync(path.join(tmp, 'content', '_gerado', 'municipios', 'sp', 'teste', 'v', 'sp-1.json'), 'utf8'));
  const v2 = JSON.parse(fs.readFileSync(path.join(tmp, 'content', '_gerado', 'municipios', 'sp', 'teste', 'v', 'sp-2.json'), 'utf8'));
  ok(v1.votos.length === 0 && v2.votos.length === 1, 'gerador: voto individual só em votação nominal');
  const lista = JSON.parse(fs.readFileSync(path.join(tmp, 'public', 'lista.json'), 'utf8'));
  ok(lista.m.length === 2 && lista.m.find((x) => x[1] === 'vazio')[3] === 0, 'gerador: município sem dados fica na lista como "em breve"');
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (erros.length) {
  console.error(`${erros.length} de ${n} verificações falharam:\n- ${erros.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok: ${n} verificações`);
