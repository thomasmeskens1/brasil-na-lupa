#!/usr/bin/env node
/**
 * Coletor do Amapá (Assembleia Legislativa, ALAP: eLegis e portal institucional), Brasil na Lupa. Node 20+, sem dependências.
 *
 * USO
 *   node scripts/coleta/estados/ap/coletar.mjs                  # ano corrente
 *   node scripts/coleta/estados/ap/coletar.mjs --anos 2025,2026
 *   COLETA_ORCAMENTO_MIN=15 (padrão)  AP_MAX_DETALHES=80  AP_MAX_VOTACOES=40  AP_MAX_PAGINAS=40
 *   node scripts/coleta/estados/ap/testes.mjs                   # testes offline
 *
 * SAÍDA (dados/estados/ap/, mesmo contrato de PA, PE, DF, MA e PR):
 *   meta.json, parlamentares.json, proposicoes/indice-<ano>.json, normas/indice-<ano>.json,
 *   votacoes/<id>.json + votacoes/indice-<ano>.json (votações do Plenário com o voto de cada deputado).
 *
 * COLETA INCREMENTAL: a lista de proposições (50 por página) é relida a cada execução; a ficha de cada proposição
 * (movimentação e link da votação) é lida aos poucos (AP_MAX_DETALHES por execução: nunca lidas primeiro, PDL por
 * último; as protocoladas nos últimos 180 dias são relidas a cada 7 dias). A página "Votação" é lida quando a ficha
 * tem o link e a movimentação registra uma votação ainda não gravada.
 *
 * REGRAS: robots.txt de cada host antes de qualquer outra requisição (eLegis: tudo liberado; portal: HTTP 403, sem
 * regra declarada pela RFC 9309); intervalo mínimo de 3 s por host; User-Agent do Brasil na Lupa; nenhum CAPTCHA ou
 * bloqueio é contornado; as páginas de perfil dos deputados não são acessadas; nomes de particulares mascarados;
 * nada deduzido. Votação só é gravada quando o número de nomes confere com os totais da página.
 * Código de saída: 0 = ok; 1 = falhou por inteiro.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Cliente, lerJson, hojeISO, fonte, VOTO_INDISPONIVEL, chaveNome, conferirPrivacidade } from '../abertos/base.mjs';
import { lerIndices, gravar, gravarIndices, gravarVotacoes, porDataDesc } from '../abertos/saida.mjs';
import {
  CASA_AP, TIPOS_PROP, TIPOS_NORMA, interpretarDeputadosAP, interpretarListaProposicoesAP, interpretarDetalheAP, aplicarDetalheAP,
  votadoEmSessao, interpretarSessoesCsv, lerPaginaVotacao, votacaoAP, interpretarLegislacaoAP,
} from './alap.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const DIR = path.join(RAIZ, 'dados', 'estados', 'ap');
const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const hoje = hojeISO();
const anos = (val('--anos') || hoje.slice(0, 4)).split(',').map(Number).filter((a) => a >= 2000 && a <= Number(hoje.slice(0, 4)));
if (!anos.length) { console.error('Uso: --anos AAAA[,AAAA]'); process.exit(1); }
const inicio = Date.now();
const env = (k, d) => Number(process.env[k] || d);
const orcamentoMin = env('COLETA_ORCAMENTO_MIN', 15);
const MAX_DET = env('AP_MAX_DETALHES', 80);
const MAX_VOT = env('AP_MAX_VOTACOES', 40);
const MAX_PAG = env('AP_MAX_PAGINAS', 40);
const C = CASA_AP;
const log = (...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(0)}s] [AP]`, ...m);
const cliente = new Cliente({ prazoMs: inicio + orcamentoMin * 60000, log, intervaloPadraoS: 3 });
const falhas = [];
const tentar = async (rotulo, fn) => { try { return await fn(); } catch (e) { falhas.push(`${rotulo}: ${e.message}`); log(`FALHA ${rotulo}: ${e.message}`); return null; } };
const diasAntes = (n) => new Date(Date.parse(`${hoje}T12:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
fs.mkdirSync(DIR, { recursive: true });
const seguros = (lista) => lista.filter((it) => {
  try { conferirPrivacidade(it); return true; } catch (e) { falhas.push(`${it.id}: não gravado (${e.message})`); return false; }
});
log(`anos ${anos.join(', ')}; orçamento ${orcamentoMin} min; detalhes ${MAX_DET}; votações ${MAX_VOT}`);

// ---------------------------------------------------------------- 1) Deputados (portal institucional)
let parl = lerJson(path.join(DIR, 'parlamentares.json'));
const htmlDep = await tentar('deputados', () => cliente.texto(`${C.portal}/pagina.php?pg=exibir_legislatura`, { aceitar: 'text/html' }));
if (htmlDep) {
  const novo = interpretarDeputadosAP(htmlDep, hoje);
  if (novo.itens.length >= 20 && novo.legislatura) { parl = novo; gravar(path.join(DIR, 'parlamentares.json'), parl); log(`deputados: ${parl.itens.length} (${novo.legislatura})`); }
  else falhas.push(`deputados: a página trouxe ${novo.itens.length} deputados (ou sem a legislatura atual); lista anterior mantida`);
}
const porNome = new Map((parl?.itens || []).map((p) => [chaveNome(p.nome), p.id]));

// ---------------------------------------------------------------- 2) Sessões (CSV oficial, para a data das votações)
const sessoes = [];
for (const ano of [...new Set([...anos, Number(hoje.slice(0, 4))])]) {
  const csv = await tentar(`sessões ${ano}`, () => cliente.texto(`${C.elegis}/portal/sessoes-csv?ano=${ano}`, { aceitar: 'text/csv' }));
  if (csv) sessoes.push(...interpretarSessoesCsv(csv, hoje).filter((s) => s.data.startsWith(String(ano))));
}
log(`sessões: ${sessoes.length}`);

// ---------------------------------------------------------------- 3) Lista de proposições
const projetos = lerIndices(DIR, 'proposicoes');
const ORDEM = [1, 2, 4, 9, 6, 10];
const DETALHE = ['situacao', 'tramitacao', 'veto', 'url_pdf', 'url_votacao', 'situacao_coletada_em', 'detalhe_coletado_em', 'lacunas', 'votacoes', 'votacao_lida_em', 'votacoes_registradas'];
const mesclar = (it) => {
  const ant = projetos.get(it.id);
  projetos.set(it.id, ant?.detalhe_coletado_em ? { ...it, ...Object.fromEntries(DETALHE.filter((k) => k in ant).map((k) => [k, ant[k]])) } : it);
};
let paginas = 0;
const totaisLista = {};
for (const ano of anos) for (const t of ORDEM) {
  const def = TIPOS_PROP[t];
  let lidos = 0, total = null;
  for (let pg = 1; paginas < MAX_PAG && cliente.cabe(); pg++) {
    const rot = `proposições ${def.sigla} ${ano} p. ${pg}`;
    const html = await tentar(rot, () => cliente.texto(`${C.elegis}/portal/proposicoes?tipo_proposicao=${t}&ano=${ano}${pg > 1 ? `&page=${pg}` : ''}`, { aceitar: 'text/html' }));
    if (!html) break;
    const r = await tentar(rot, async () => interpretarListaProposicoesAP(html, hoje, porNome));
    if (!r) break;
    paginas++;
    total = r.total;
    const fora = r.itens.filter((x) => x.sigla !== def.sigla);
    if (fora.length) { falhas.push(`${rot}: ${fora.length} linha(s) de outro tipo; página descartada`); break; }
    for (const it of r.itens) mesclar(it);
    lidos += r.itens.length;
    if (!r.proxima || !r.itens.length) break;
  }
  totaisLista[`${ano} ${def.sigla}`] = { informado: total, lidos };
  if (total != null && lidos !== total) falhas.push(`proposições ${def.sigla} ${ano}: a lista informa ${total} e foram lidas ${lidos}`);
}
log(`proposições: ${paginas} página(s); ${projetos.size} gravadas; ${JSON.stringify(totaisLista)}`);

// ---------------------------------------------------------------- 4) Fichas das proposições
const votDir = path.join(DIR, 'votacoes');
const votacoes = new Map();
for (const f of fs.existsSync(votDir) ? fs.readdirSync(votDir) : []) {
  if (!/^ap-.+\.json$/.test(f)) continue;
  const v = lerJson(path.join(votDir, f));
  if (v?.id) votacoes.set(v.id, v);
}
const peso = (p) => ORDEM.indexOf(Object.keys(TIPOS_PROP).map(Number).find((k) => TIPOS_PROP[k].sigla === p.sigla));
const doAno = (p) => anos.includes(p.ano);
const nunca = [...projetos.values()].filter((p) => doAno(p) && !p.detalhe_coletado_em);
const velhas = [...projetos.values()].filter((p) => doAno(p) && p.detalhe_coletado_em && p.detalhe_coletado_em <= diasAntes(7) && (p.data_apresentacao || '') >= diasAntes(180));
const ordenar = (a, b) => peso(a) - peso(b) || String(b.data_apresentacao || '').localeCompare(String(a.data_apresentacao || '')) || b.id_oficial - a.id_oficial;
const filaD = [...nunca.sort(ordenar), ...velhas.sort((a, b) => a.detalhe_coletado_em.localeCompare(b.detalhe_coletado_em))];
const filaV = [];
let detalhados = 0;
for (const p of filaD.slice(0, MAX_DET)) {
  if (!cliente.cabe()) break;
  const html = await tentar(`proposição ${p.id_oficial}`, () => cliente.texto(p.url, { aceitar: 'text/html' }));
  const det = html ? interpretarDetalheAP(html, hoje, p.id_oficial) : null;
  if (!det) { if (html) falhas.push(`proposição ${p.id_oficial}: ficha sem o título esperado`); continue; }
  const novo = aplicarDetalheAP(p, det, hoje);
  projetos.set(p.id, novo);
  detalhados++;
  const nVot = votadoEmSessao(det.movimentacao).length;
  if (det.url_votacao && (!p.votacao_lida_em || (p.votacoes_registradas ?? -1) !== nVot)) filaV.push({ p: novo, det, nVot });
}
// Votações cuja leitura ficou para depois (orçamento) entram na fila pelos projetos já detalhados.
for (const p of projetos.values()) {
  if (doAno(p) && p.url_votacao && !p.votacao_lida_em && !filaV.some((x) => x.p.id === p.id)) {
    filaV.push({ p, det: { movimentacao: p.tramitacao || [] }, nVot: votadoEmSessao(p.tramitacao).length });
  }
}
log(`fichas lidas: ${detalhados} (faltam ${Math.max(0, nunca.length - Math.min(detalhados, nunca.length))} nunca lidas); votações na fila: ${filaV.length}`);

// ---------------------------------------------------------------- 5) Páginas "Votação"
let votLidas = 0;
const naoGravadas = [];
for (const { p, det, nVot } of filaV.slice(0, MAX_VOT)) {
  if (!cliente.cabe()) break;
  const html = await tentar(`votação ${p.id_oficial}`, () => cliente.texto(p.url_votacao, { aceitar: 'text/html' }));
  if (!html) continue;
  const pag = lerPaginaVotacao(html);
  const ids = [];
  const erros = [];
  if (pag.erro) erros.push(pag.erro);
  else pag.blocos.forEach((b, k) => {
    const r = votacaoAP(b, k, pag.blocos.length, p, det, sessoes, hoje, porNome);
    if (r.erro) erros.push(`${b.sessao}: ${r.erro}`);
    else { votacoes.set(r.votacao.id, r.votacao); ids.push(r.votacao.id); }
  });
  for (const e of erros) { naoGravadas.push(`votação ${p.id_oficial}: ${e}`); falhas.push(`votação ${p.id_oficial} não gravada: ${e}`); }
  projetos.set(p.id, { ...projetos.get(p.id), votacoes: ids, votacao_lida_em: hoje, votacoes_registradas: nVot });
  votLidas++;
}
log(`páginas de votação lidas: ${votLidas}; votações gravadas: ${votacoes.size}; não conferidas: ${naoGravadas.length}`);

// ---------------------------------------------------------------- 6) Legislação
const normas = lerIndices(DIR, 'normas');
const totaisN = {};
for (const ano of anos) for (const [t, def] of Object.entries(TIPOS_NORMA)) {
  let lidos = 0, total = null;
  for (let pg = 1; pg <= 60 && cliente.cabe(); pg++) {
    const rot = `legislação ${def.tipo} ${ano} p. ${pg}`;
    const html = await tentar(rot, () => cliente.texto(`${C.elegis}/portal/legislacao?tipo_proposicao_id=${t}&ano=${ano}${pg > 1 ? `&page=${pg}` : ''}`, { aceitar: 'text/html' }));
    if (!html) break;
    const r = await tentar(rot, async () => interpretarLegislacaoAP(html, hoje, ano));
    if (!r) break;
    total = r.total;
    for (const it of r.itens) if (it.tipo === def.tipo && it.ano === ano) { normas.set(it.id, it); lidos++; }
    if (!r.proxima || !r.itens.length) break;
  }
  totaisN[`${ano} ${def.tipo}`] = { informado: total, lidos };
  if (total != null && lidos !== total) falhas.push(`legislação ${def.tipo} ${ano}: a lista informa ${total} e foram lidas ${lidos} do ano`);
}
log(`legislação: ${JSON.stringify(totaisN)}`);

// ---------------------------------------------------------------- 7) Gravação
const listaP = [...projetos.values()];
const listaN = [...normas.values()];
const listaV = [...votacoes.values()].map((v) => {
  const p = projetos.get(v.proposicao?.id);
  return p ? { ...v, proposicao: { ...v.proposicao, ementa: p.ementa ?? v.proposicao.ementa } } : v;
});
const contP = gravarIndices(DIR, 'proposicoes', seguros(listaP), (p) => p.ano, (ano) => ({
  atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano,
  fonte: fonte(`Proposições de ${ano} — eLegis da ALAP`, `${C.elegis}/portal/proposicoes?ano=${ano}`, C.nome, hoje),
}), porDataDesc('data_apresentacao'));
const contN = gravarIndices(DIR, 'normas', seguros(listaN), (n) => n.ano, (ano) => ({
  atualizado_em: hoje, uf: C.uf, ano: Number(ano) || ano,
  abrangencia: 'Leis ordinárias e complementares, emendas constitucionais, resoluções e decretos legislativos da lista "Legislação" do eLegis da ALAP, com o número e a data do Diário Oficial do Estado e o projeto de origem.',
  fontes: [fonte('Legislação — eLegis da ALAP', `${C.elegis}/portal/legislacao?ano=${ano}`, C.nome, hoje)],
}), (a, b) => String(a.tipo).localeCompare(String(b.tipo), 'pt-BR') || (b.numero || 0) - (a.numero || 0) || String(a.id).localeCompare(String(b.id)));
const contV = gravarVotacoes(DIR, seguros(listaV), (ano) => ({ atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano }));

const meta = {
  atualizado_em: new Date().toISOString(), ultima_execucao: new Date(inicio).toISOString(), uf: C.uf, casa: C.casa, orgao: C.nome,
  periodo: { anos, fim: hoje }, modo: 'incremental',
  fontes: [
    fonte('Proposições — eLegis da ALAP', `${C.elegis}/portal/proposicoes`, C.nome, hoje),
    fonte('Sessões — eLegis da ALAP', `${C.elegis}/portal/sessoes`, C.nome, hoje),
    fonte('Legislação — eLegis da ALAP', `${C.elegis}/portal/legislacao`, C.nome, hoje),
    fonte('Deputados — portal da ALAP', `${C.portal}/pagina.php?pg=exibir_legislatura`, C.nome, hoje),
  ],
  robots: cliente.resumoRobots(),
  execucao: { requisicoes: cliente.requisicoes, falhas: [...new Set([...falhas, ...cliente.falhas])].slice(0, 60) },
  contagens: {
    parlamentares: parl?.itens?.length ?? 0, proposicoes_por_ano: contP, normas_por_ano: contN, votacoes_por_ano: contV,
    listas_proposicoes: totaisLista, listas_legislacao: totaisN, sessoes_na_lista_oficial: sessoes.length,
    fichas_lidas_nesta_execucao: detalhados, proposicoes_sem_ficha: listaP.filter((p) => !p.detalhe_coletado_em).length,
    proposicoes_com_pagina_de_votacao: listaP.filter((p) => p.url_votacao).length,
    paginas_de_votacao_lidas_nesta_execucao: votLidas, votacoes_nao_conferidas: naoGravadas.length,
    votacoes_sem_data: listaV.filter((v) => !v.data).length,
    votos_sem_ligacao_com_deputado: listaV.reduce((s, v) => s + v.votos.filter((x) => !x.parlamentar_id).length, 0),
  },
  observacoes: [
    'Fontes: eLegis da Assembleia Legislativa do Amapá (páginas HTML e CSV; robots.txt "User-agent: * / Disallow:", tudo liberado) e portal institucional da ALAP (lista de deputados; o robots.txt responde HTTP 403, sem regra declarada). Intervalo mínimo de 3 s entre requisições ao mesmo host. O próprio eLegis avisa que está em implantação e que as informações podem não aparecer em tempo real.',
    'Deputados: página "Deputados" da legislatura atual (nome parlamentar e partido, como escritos na página). As páginas de perfil não são acessadas. O voto é ligado ao deputado só quando o nome da lista de votação é idêntico ao da página (sem acentos e maiúsculas).',
    'Proposições: projetos de lei ordinária e complementar, propostas de emenda à Constituição, projetos de resolução e de decreto legislativo e vetos do Governador, com data de protocolo, origem e ementa da lista do eLegis. Indicações, moções e requerimentos não são coletados. A ficha de cada proposição (regime, texto original e "Movimentação") é lida aos poucos; a ficha não mostra a situação, e o site mostra o último registro da movimentação.',
    `Votações: quando a ficha tem o botão "Votação", a página traz o nome de cada deputado com o voto (Favorável, Contra, Abstenção, Sem voto) e os totais. A votação só é gravada quando o número de nomes confere com os totais. A página não escreve o resultado nem o partido; a data vem da lista oficial de sessões, só quando o nome da sessão é único e confere com a movimentação. Deputados que não aparecem na lista não têm voto registrado ("${VOTO_INDISPONIVEL}").`,
    'Atas das sessões: trazem em texto corrido o resultado das matérias e os ausentes; não são lidas nesta etapa.',
    'Normas: lista "Legislação" do eLegis (leis, leis complementares, emendas constitucionais, resoluções e decretos legislativos), com número e data do Diário Oficial do Estado, projeto de origem e texto integral.',
    'Decretos do Governador: publicados só no Diário Oficial do Estado (DIOFE, PDF). Não são coletados: o servidor diofe.portal.ap.gov.br não respondeu em 06/11/2026.',
  ],
};
gravar(path.join(DIR, 'meta.json'), meta);
const ok = Boolean(parl?.itens?.length || projetos.size || normas.size);
log(`${ok ? 'ok' : 'falhou'} — ${JSON.stringify(meta.contagens)}`);
process.exit(ok ? 0 : 1);
