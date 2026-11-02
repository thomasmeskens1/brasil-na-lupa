#!/usr/bin/env node
// Gera dados/titulos/<secao>.json (títulos em linguagem simples + tema), dados/titulos/temas.json
// (tabela pública de correspondência) e dados/titulos/amostra-revisao.json (amostra para os três
// analistas). Ordem de prioridade do contrato: apelido/explicação oficial → manchete da agência →
// modelo → título oficial sem alteração. Todo candidato passa pelo verificador; reprovado, cai para
// o próximo e, no fim, para o título oficial. Ao terminar, roda verificar.mjs sobre a saída.
//
// Uso: node scripts/coleta/titulos/gerar.mjs [--secoes camara,senado] [--sem-rede] [--sem-agencias]
//        [--max-paginas-senado 150]
import path from 'node:path';
import fs from 'node:fs';
import { SAIDA, CACHE, lerJson, gravarSeMudou, hojeISO, dataBR, estatisticas, contagemGravacao } from './lib.mjs';
import { SECOES, carregarSecao } from './itens.mjs';
import { verificarTitulo, verificacaoOficial } from './regras.mjs';
import { classificar, tabelaPublica } from './temas.mjs';
import { camaraProposicao, camaraIdPorIdentificacao, noticiasAgenciaCamara, senadoProcesso, noticiasAgenciaSenado } from './fontes.mjs';
import { mancheteVotacao, mancheteMp, mancheteNorma } from './manchetes.mjs';
import { escolherAmostra } from './amostra.mjs';
import { verificarTudo, contextoVerificacao } from './verificar.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const SEM_REDE = Boolean(opt('sem-rede', false));
const SEM_AGENCIAS = Boolean(opt('sem-agencias', false));
const MAX_SENADO = Number(opt('max-paginas-senado', 150));
const secoes = String(opt('secoes', SECOES.join(','))).split(',').filter((s) => SECOES.includes(s));
const rede = { semRede: SEM_REDE };

const CREDITO = { 'agencia-camara': 'Agência Câmara de Notícias (órgão de comunicação da Câmara dos Deputados)', 'agencia-senado': 'Agência Senado (órgão de comunicação do Senado Federal)' };

async function emLotes(lista, fn) {
  // o limite de 2 requisições simultâneas está em lib.obter(); aqui só evitamos milhares de promessas pendentes
  const out = new Map();
  for (let i = 0; i < lista.length; i += 20) {
    const lote = lista.slice(i, i + 20);
    const r = await Promise.all(lote.map((x) => fn(x).catch(() => null)));
    lote.forEach((x, j) => out.set(x, r[j]));
  }
  return out;
}

async function enriquecer(itens) {
  const camIds = new Set(), camBusca = new Map(), senProc = new Set();
  for (const it of itens) {
    const c = it.consultas;
    if (c.camaraId) camIds.add(String(c.camaraId));
    if (c.camaraBusca) camBusca.set(`${c.camaraBusca.sigla} ${c.camaraBusca.numero}/${c.camaraBusca.ano}`, c.camaraBusca);
    if (c.senadoProcesso) senProc.add(String(c.senadoProcesso));
  }
  console.log(`  consultas: ${camIds.size} proposições da Câmara, ${camBusca.size} buscas de projeto de lei, ${senProc.size} processos do Senado`);
  const buscaIds = await emLotes([...camBusca.keys()], (k) => { const b = camBusca.get(k); return camaraIdPorIdentificacao(b.sigla, b.numero, b.ano, rede); });
  for (const it of itens) if (it.consultas.camaraBusca) {
    const b = it.consultas.camaraBusca; const id = buscaIds.get(`${b.sigla} ${b.numero}/${b.ano}`);
    if (id) { it.consultas.camaraId = id; camIds.add(id); }
  }
  const cam = await emLotes([...camIds], (id) => camaraProposicao(id, rede));
  const sen = await emLotes([...senProc], (id) => senadoProcesso(id, rede));

  // Notícias: só onde a manchete pode ser usada (votação do texto em Plenário, MP, lei).
  const precisaNoticia = (it) => !SEM_AGENCIAS && (it.perfil?.principal || it.perfil?.mp || (it.perfil?.norma && it.raw?.tipo !== 'Decreto'));
  const camNot = await emLotes([...new Set(itens.filter((it) => precisaNoticia(it) && it.consultas.camaraId).map((it) => String(it.consultas.camaraId)))], (id) => noticiasAgenciaCamara(id, rede));
  // Agência Senado: páginas do www25 têm Crawl-delay de 10 s → orçamento por execução, itens mais recentes primeiro.
  const pedidosSen = [];
  for (const it of [...itens].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))) {
    if (!precisaNoticia(it) || it.secao === 'camara') continue;
    const mat = it.consultas.senadoMateria || (it.consultas.senadoProcesso && sen.get(String(it.consultas.senadoProcesso))?.codigoMateria);
    if (mat) pedidosSen.push({ it, mat: String(mat) });
  }
  const senNot = new Map();
  let paginasNovas = 0;
  for (const { it, mat } of pedidosSen) {
    if (senNot.has(mat)) continue;
    const url = it.consultas.mpCongresso ? `https://www.congressonacional.leg.br/materias/medidas-provisorias/-/mpv/${mat}` : null;
    const valido = await noticiasAgenciaSenado(mat, { url, apenasCacheValido: true });
    if (valido) { senNot.set(mat, valido); continue; }
    if (SEM_REDE || (!url && paginasNovas >= MAX_SENADO)) {
      // não consultada nesta execução: usa cache vencido, se houver; senão fica marcada como não consultada
      const velho = await noticiasAgenciaSenado(mat, { url, semRede: true });
      senNot.set(mat, velho && velho.noticias.length ? velho : null);
      continue;
    }
    if (!url) paginasNovas++;
    senNot.set(mat, await noticiasAgenciaSenado(mat, { ...rede, url }));
  }
  return { cam, sen, camNot, senNot };
}

function rotulosExternos(it, fx) {
  const r = [];
  const c = fx.cam.get(String(it.consultas.camaraId));
  if (c) {
    for (const t of c.temas) r.push({ fonte: 'camara-tema', valor: t });
    if (c.keywords) r.push({ fonte: 'camara-palavra-chave', valor: c.keywords });
  }
  const s = fx.sen.get(String(it.consultas.senadoProcesso));
  if (s) for (const cl of s.classificacoes) r.push({ fonte: 'senado-classificacao', valor: cl });
  return r;
}

function candidatos(it, fx, mpsPorCamara, mpsPorSenado, anterior) {
  const lista = [];
  const extra = {};
  const s = fx.sen.get(String(it.consultas.senadoProcesso));
  if (it.tipo === 'votacao') {
    const mp = mpsPorCamara.get(String(it.consultas.mpCamara)) || mpsPorSenado.get(String(it.consultas.mpSenado));
    if (mp?.apelido_senado) { extra.apelido = mp.apelido_senado; extra.fonteApelido = mp.links?.senado; }
    else if (s?.apelido) { extra.apelido = s.apelido; extra.fonteApelido = s.url; }
    else if (s?.explicacao) { extra.explicacao = s.explicacao; extra.fonteApelido = s.url; }
    if (extra.apelido || extra.explicacao) { const a = it.construir(it.raw, extra); lista.push({ ...a, origem: a.origem || (extra.apelido ? 'apelido-oficial' : 'explicacao-oficial'), _extra: extra }); }
  } else if (it.tipo === 'mp' || it.tipo === 'norma') {
    const m = it.construir(it.raw, {});
    if (m.origem === 'apelido-oficial') lista.push({ ...m, _extra: {} });
  }
  // manchetes
  const camN = fx.camNot.get(String(it.consultas.camaraId))?.noticias || [];
  const mat = it.consultas.senadoMateria || s?.codigoMateria;
  const senR = mat ? fx.senNot.get(String(mat)) : undefined;
  const senN = senR?.noticias || [];
  const escolher = (ns) => it.tipo === 'votacao' ? mancheteVotacao(it.perfil, it.secao, ns)
    : it.tipo === 'mp' ? mancheteMp(it.perfil.data, ns) : it.tipo === 'norma' ? mancheteNorma(it.perfil.data, ns) : null;
  const agencias = [];
  const mc = it.secao !== 'senado' ? escolher(camN) : null;
  if (mc) agencias.push({ titulo: mc.titulo, origem: 'agencia-camara', fonte: mc.noticia.url, fonte_data: mc.noticia.data });
  const ms = it.secao !== 'camara' ? escolher(senN) : null;
  if (ms) agencias.push({ titulo: ms.titulo, origem: 'agencia-senado', fonte: ms.noticia.url, fonte_data: ms.noticia.data });
  agencias.sort((a, b) => b.fonte_data.localeCompare(a.fonte_data)); // a mais recente primeiro
  lista.push(...agencias);
  // memória: manchete escolhida numa execução anterior, quando a página da agência não foi consultada agora
  if (!agencias.length && senR === null && anterior && /^agencia-/.test(anterior.origem)) {
    lista.push({ titulo: anterior.titulo, origem: anterior.origem, fonte: anterior.fonte, fonte_data: anterior.fonte_data });
  }
  const modelo = it.construir(it.raw, {});
  if (modelo.titulo && modelo.origem === 'modelo') lista.push({ ...modelo, _extra: {} });
  else if (modelo.erro) lista.push({ erro: modelo.erro, origem: 'modelo' });
  return lista;
}

async function main() {
  const t0 = Date.now();
  fs.mkdirSync(SAIDA, { recursive: true });
  const relatorio = { gerado_em: new Date().toISOString(), secoes: {}, reprovacoes: [], exemplos: [] };
  const todos = [];
  const mps = carregarSecao('executivo').filter((i) => i.tipo === 'mp').map((i) => i.raw);
  const mpsPorCamara = new Map(mps.filter((m) => m.ids_oficiais?.camara_proposicao).map((m) => [String(m.ids_oficiais.camara_proposicao), m]));
  const mpsPorSenado = new Map(mps.filter((m) => m.ids_oficiais?.senado_processo).map((m) => [String(m.ids_oficiais.senado_processo), m]));

  for (const secao of secoes) {
    const t1 = Date.now();
    const itens = carregarSecao(secao);
    console.log(`${secao}: ${itens.length} itens`);
    const fx = await enriquecer(itens);
    const arq = path.join(SAIDA, `${secao}.json`);
    const anteriores = lerJson(arq)?.itens || {};
    const saida = {};
    const cobertura = {};
    for (const it of itens) {
      let escolhido = null;
      for (const c of candidatos(it, fx, mpsPorCamara, mpsPorSenado, anteriores[it.id])) {
        if (c.erro) { relatorio.reprovacoes.push({ secao, id: it.id, origem: c.origem, motivos: [c.erro], tipo: 'sem-modelo' }); continue; }
        const v = verificarTitulo(c.titulo, c.origem, contextoVerificacao(it, c));
        if (v.aprovado) { escolhido = { ...c, verificacao: v.verificacao }; break; }
        relatorio.reprovacoes.push({ secao, id: it.id, origem: c.origem, titulo: c.titulo, motivos: v.motivos, tipo: 'verificador' });
      }
      if (!escolhido) {
        escolhido = { titulo: it.oficial.titulo, origem: 'oficial', fonte: it.oficial.fonte, verificacao: verificacaoOficial() };
      }
      const { tema } = classificar([...it.rotulos, ...rotulosExternos(it, fx)]);
      const reg = {
        titulo: escolhido.titulo, subtitulo: it.subtitulo, origem: escolhido.origem, fonte: escolhido.fonte || it.oficial.fonte || null,
        ...(escolhido.fonte_data ? { fonte_data: escolhido.fonte_data, credito: `Manchete da ${CREDITO[escolhido.origem]}, ${dataBR(escolhido.fonte_data)}` } : {}),
        tema, verificacao: escolhido.verificacao,
      };
      saida[it.id] = reg;
      cobertura[reg.origem] = (cobertura[reg.origem] || 0) + 1;
      todos.push({ it, reg });
    }
    const ordenado = Object.fromEntries(Object.keys(saida).sort().map((k) => [k, saida[k]]));
    gravarSeMudou(arq, { atualizado_em: hojeISO(), itens: ordenado });
    relatorio.secoes[secao] = { itens: itens.length, cobertura, segundos: Math.round((Date.now() - t1) / 1000) };
    console.log(`  cobertura: ${JSON.stringify(cobertura)} (${Math.round((Date.now() - t1) / 1000)} s)`);
  }

  gravarSeMudou(path.join(SAIDA, 'temas.json'), { atualizado_em: hojeISO(), ...tabelaPublica() });
  if (secoes.length === SECOES.length) {
    gravarSeMudou(path.join(SAIDA, 'amostra-revisao.json'), { atualizado_em: hojeISO(), ...escolherAmostra(todos) });
  }
  const ver = verificarTudo({ secoes, corrigir: true, silencioso: true });
  relatorio.verificacao_final = ver.resumo;
  relatorio.rede = { ...estatisticas, falhas: estatisticas.falhas.slice(0, 50) };
  relatorio.gravacao = contagemGravacao;
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(path.join(CACHE, 'relatorio.json'), JSON.stringify(relatorio, null, 2));
  const porMotivo = {};
  for (const r of relatorio.reprovacoes) { const k = `${r.origem}: ${r.motivos[0].replace(/:.*$/, '')}`; porMotivo[k] = (porMotivo[k] || 0) + 1; }
  console.log('reprovações por motivo:', JSON.stringify(porMotivo, null, 1));
  console.log(`verificação final: ${JSON.stringify(ver.resumo)}`);
  console.log(`rede: ${estatisticas.requisicoes} requisições, ${estatisticas.cache} do cache, ${estatisticas.bloqueadas_robots} bloqueadas pelo robots.txt, ${estatisticas.falhas.length} falhas`);
  console.log(`arquivos: ${contagemGravacao.gravados} gravados, ${contagemGravacao.inalterados} sem mudança; ${Math.round((Date.now() - t0) / 1000)} s`);
}

main().catch((e) => { console.error(e); process.exit(1); });
