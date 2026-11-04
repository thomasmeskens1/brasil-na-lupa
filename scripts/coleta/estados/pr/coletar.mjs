#!/usr/bin/env node
/**
 * Coletor do Paraná (Assembleia Legislativa, ALEP), Brasil na Lupa. Node 20+, sem dependências.
 *
 * USO
 *   node scripts/coleta/estados/pr/coletar.mjs                  # ano corrente
 *   node scripts/coleta/estados/pr/coletar.mjs --anos 2025,2026
 *   COLETA_ORCAMENTO_MIN=15 (padrão)  PR_MAX_DETALHES=150  PR_MAX_NORMAS=100
 *   node scripts/coleta/estados/pr/testes.mjs                   # testes offline
 *
 * SAÍDA (dados/estados/pr/, mesmo contrato de PE e DF):
 *   meta.json, parlamentares.json, proposicoes/indice-<ano>.json, normas/indice-<ano>.json,
 *   votacoes/<id>.json + votacoes/indice-<ano>.json (resultado de cada turno na Ordem do Dia, sem voto individual).
 *
 * COLETA INCREMENTAL: a lista do ano vem inteira numa requisição; o detalhe de cada projeto e de cada norma é lido
 * aos poucos (os nunca lidos primeiro, mais novos antes; depois revisita os projetos em tramitação há mais de 7 dias).
 * O cursor são os próprios arquivos (campo detalhe_coletado_em / detalhe_coletado). Orçamento de tempo: nenhuma
 * requisição começa depois do prazo.
 *
 * REGRAS: robots.txt de cada host antes de qualquer outra requisição (o da API, por http://); intervalo mínimo por
 * host; User-Agent que cita o Brasil na Lupa; o "Controle de Votações" (caminho /api/ proibido e reCAPTCHA) nunca é
 * acessado; nomes de particulares mascarados; nada deduzido. Código de saída: 0 = ok; 1 = falhou por inteiro.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lerJson, hojeISO, fonte, VOTO_INDISPONIVEL, chaveNome, conferirPrivacidade } from '../abertos/base.mjs';
import { lerIndices, gravar, gravarIndices, gravarVotacoes, porDataDesc } from '../abertos/saida.mjs';
import {
  CASA_PR, LAI_PR, TIPOS_NORMA, ClienteHttp, interpretarDeputadosPR, interpretarProposicaoPR, interpretarDetalhePR,
  aplicarDetalhePR, votacoesDoProjetoPR, interpretarNormaPR, aplicarDetalheNormaPR, ligarPR,
} from './alep.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const DIR = path.join(RAIZ, 'dados', 'estados', 'pr');
const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const hoje = hojeISO();
const anos = (val('--anos') || hoje.slice(0, 4)).split(',').map(Number).filter((a) => a >= 1990 && a <= Number(hoje.slice(0, 4)));
if (!anos.length) { console.error('Uso: --anos AAAA[,AAAA]'); process.exit(1); }
const inicio = Date.now();
const prazoMs = inicio + Number(process.env.COLETA_ORCAMENTO_MIN || 15) * 60000;
const MAX_DET = Number(process.env.PR_MAX_DETALHES || 150);
const MAX_NORMAS = Number(process.env.PR_MAX_NORMAS || 100);
const DIAS_REVISITA = 7;
const log = (...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(0)}s] [PR]`, ...m);
const C = CASA_PR;
const cliente = new ClienteHttp({ prazoMs, log, hostsSoHttp: [new URL(C.api).host] });
const falhas = [];
const tentar = async (rotulo, fn) => { try { return await fn(); } catch (e) { falhas.push(`${rotulo}: ${e.message}`); log(`FALHA ${rotulo}: ${e.message}`); return null; } };
fs.mkdirSync(DIR, { recursive: true });
/** Item que não passa na conferência de privacidade não é gravado (fica anotado nas falhas). */
const seguros = (lista) => lista.filter((it) => {
  try { conferirPrivacidade(it); return true; } catch (e) { falhas.push(`${it.id}: não gravado (${e.message})`); return false; }
});
const gravarProjetos = (lista) => gravarIndices(DIR, 'proposicoes', seguros(lista), (p) => p.ano, (ano) => ({
  atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano,
  fonte: fonte(`Proposições de ${ano} — API pública de dados abertos da ALEP`, `${C.api}/proposicao/filtrar`, C.nome, hoje),
}), porDataDesc('data_apresentacao'));
const gravarNormas = (lista) => gravarIndices(DIR, 'normas', seguros(lista), (n) => n.ano, (ano) => ({
  atualizado_em: hoje, uf: C.uf, ano: Number(ano) || ano,
  abrangencia: 'Leis, leis complementares, resoluções, decretos legislativos e emendas constitucionais do Paraná cadastrados na API pública de normas legais da ALEP (sem os decretos do Governador, publicados só no Diário Oficial do Estado)',
  fontes: [fonte('API pública de dados abertos da ALEP — normas legais', `${C.api}/norma-legal/filtrar`, C.nome, hoje)],
}), porDataDesc('data_publicacao'));
const CHECKPOINT = 100; // grava o progresso a cada N detalhes (uma queda não perde a execução inteira)
log(`anos ${anos.join(', ')}; orçamento ${process.env.COLETA_ORCAMENTO_MIN || 15} min; detalhes ${MAX_DET}; normas ${MAX_NORMAS}`);

// 1) Deputados (página HTML permitida pelo robots.txt; uma requisição)
let parl = lerJson(path.join(DIR, 'parlamentares.json'));
const html = await tentar('deputados', () => cliente.texto(`${C.portal}/deputados/conheca`, { aceitar: 'text/html' }));
if (html) {
  const novo = interpretarDeputadosPR(html, hoje);
  if (novo.itens.length >= 40) { parl = novo; gravar(path.join(DIR, 'parlamentares.json'), parl); log(`deputados: ${parl.itens.length}`); }
  else falhas.push(`deputados: a página trouxe só ${novo.itens.length} cartões; lista anterior mantida`);
}
const porNome = new Map((parl?.itens || []).map((p) => [chaveNome(p.nome), p.id]));

// 2) Projetos do ano (lista completa numa requisição), mesclados com o detalhe já lido
const projetos = lerIndices(DIR, 'proposicoes');
const totais = {};
for (const ano of anos) {
  const d = await tentar(`proposições ${ano}`, () => cliente.json(`${C.api}/proposicao/filtrar`, { metodo: 'POST', corpo: { ano } }));
  if (!d?.lista) continue;
  totais[ano] = d.totalRegistrosSemLimitador ?? d.lista.length;
  let n = 0;
  for (const r of d.lista) {
    const it = interpretarProposicaoPR(r, hoje, porNome);
    if (!it) continue;
    n++;
    const ant = projetos.get(it.id);
    projetos.set(it.id, ant?.detalhe_coletado_em ? {
      ...it, situacao: { ...ant.situacao, texto: it.situacao.texto, etapa: it.situacao.etapa, local_atual: it.situacao.local_atual },
      detalhe_coletado_em: ant.detalhe_coletado_em, deliberacoes_plenario: ant.deliberacoes_plenario, normas_geradas: ant.normas_geradas,
    } : it);
  }
  log(`proposições ${ano}: ${d.lista.length} na fonte (todos os tipos), ${n} projetos e vetos`);
}

// 3) Detalhe dos projetos: nunca lidos (mais novos antes), depois revisita dos que seguem tramitando
const limiteRev = new Date(Date.parse(hoje) - DIAS_REVISITA * 86400000).toISOString().slice(0, 10);
const doAno = [...projetos.values()].filter((p) => anos.includes(p.ano));
const nunca = doAno.filter((p) => !p.detalhe_coletado_em).sort(porDataDesc('data_apresentacao'));
const revisitar = doAno.filter((p) => p.detalhe_coletado_em && p.detalhe_coletado_em < limiteRev && p.situacao?.etapa !== 'ARQUIVADA')
  .sort((a, b) => a.detalhe_coletado_em.localeCompare(b.detalhe_coletado_em));
let detalhados = 0;
for (const p of [...nunca, ...revisitar].slice(0, MAX_DET)) {
  if (!cliente.cabe()) { log('orçamento acabou durante os detalhes de projetos; o resto fica para a próxima execução'); break; }
  const d = await tentar(`projeto ${p.id_oficial}`, () => cliente.json(`${C.api}/proposicao/${p.id_oficial}`));
  const det = d?.valor ? interpretarDetalhePR(d.valor, hoje) : null;
  if (det) { projetos.set(p.id, aplicarDetalhePR(p, det, hoje)); detalhados++; }
  if (det && detalhados % CHECKPOINT === 0) gravarProjetos([...projetos.values()]);
}
log(`detalhes de projetos: ${detalhados} (faltam ${Math.max(0, nunca.length - detalhados)} nunca lidos)`);

// 4) Normas do ano (lista completa) e detalhe aos poucos: leis primeiro, mais recentes antes
const normas = lerIndices(DIR, 'normas');
const totaisN = {};
for (const ano of anos) {
  const d = await tentar(`normas ${ano}`, () => cliente.json(`${C.api}/norma-legal/filtrar`, { metodo: 'POST', corpo: { ano } }));
  if (!d?.lista) continue;
  totaisN[ano] = d.totalRegistrosSemLimitador ?? d.lista.length;
  let n = 0;
  for (const r of d.lista) {
    const it = interpretarNormaPR(r, hoje);
    if (!it) continue;
    n++;
    const ant = normas.get(it.id);
    normas.set(it.id, ant?.detalhe_coletado && ant.id_oficial === it.id_oficial
      ? { ...it, detalhe_coletado: true, movimentacoes: ant.movimentacoes, projeto_origem: ant.projeto_origem, projetos_origem: ant.projetos_origem, lacunas: ant.lacunas }
      : it);
  }
  log(`normas ${ano}: ${d.lista.length} na fonte, ${n} leis, leis complementares, resoluções, decretos legislativos e emendas constitucionais`);
}
const peso = (n) => (n.tipo === 'Lei' || n.tipo === 'Lei Complementar' ? 0 : 1);
const filaN = [...normas.values()].filter((n) => !n.detalhe_coletado)
  .sort((a, b) => peso(a) - peso(b) || String(b.data_assinatura || '').localeCompare(String(a.data_assinatura || '')));
let normasDet = 0;
for (const n of filaN.slice(0, MAX_NORMAS)) {
  if (!cliente.cabe()) { log('orçamento acabou durante os detalhes de normas'); break; }
  const d = await tentar(`norma ${n.id_oficial}`, () => cliente.json(`${C.api}/norma-legal/${n.id_oficial}`));
  if (d?.valor) { normas.set(n.id, aplicarDetalheNormaPR(n, d.valor, hoje)); normasDet++; }
  if (d?.valor && normasDet % CHECKPOINT === 0) gravarNormas([...normas.values()]);
}
log(`detalhes de normas: ${normasDet} (faltam ${Math.max(0, filaN.length - normasDet)})`);

// 5) Ligações e votações
const listaP = [...projetos.values()];
const listaN = [...normas.values()];
ligarPR(listaN, listaP);
const votacoes = listaP.flatMap((p) => votacoesDoProjetoPR(p, hoje));

// 6) Gravação
const contP = gravarProjetos(listaP);
const contN = gravarNormas(listaN);
const contV = gravarVotacoes(DIR, seguros(votacoes), (ano) => ({ atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano }));

const meta = {
  atualizado_em: new Date().toISOString(), ultima_execucao: new Date(inicio).toISOString(), uf: C.uf, casa: C.casa, orgao: C.nome,
  periodo: { anos, fim: hoje }, modo: 'incremental',
  fontes: [
    fonte('API pública de dados abertos da ALEP (proposições, trâmites e normas legais)', `${C.api}/proposicao/campos`, C.nome, hoje),
    fonte('Documentação da API (Portal da Transparência da ALEP)', C.doc, C.nome, hoje),
    fonte('Conheça os deputados — portal da ALEP', `${C.portal}/deputados/conheca`, C.nome, hoje),
  ],
  robots: cliente.resumoRobots(),
  execucao: { requisicoes: cliente.requisicoes, falhas: [...new Set([...falhas, ...cliente.falhas])].slice(0, 50) },
  contagens: {
    parlamentares: parl?.itens?.length ?? 0, proposicoes_por_ano: contP, proposicoes_na_fonte_todos_os_tipos: totais,
    normas_por_ano: contN, normas_na_fonte_todos_os_tipos: totaisN, votacoes_por_ano: contV,
    projetos_detalhados_nesta_execucao: detalhados, projetos_sem_detalhe: listaP.filter((p) => !p.detalhe_coletado_em).length,
    normas_detalhadas_nesta_execucao: normasDet, normas_sem_detalhe: listaN.filter((n) => !n.detalhe_coletado).length,
  },
  observacoes: [
    'Fonte: API pública de dados abertos da ALEP, documentada no Portal da Transparência. A API só responde em http:// (sem criptografia); o robots.txt do host (lido por http://) bloqueia só áreas de sistema, não /api/public. Intervalo mínimo de 2 s entre requisições.',
    `Votações: a API registra só o resultado de cada turno na Ordem do Dia (ex.: "1º TURNO - APROVADO"), com a data. Não informa a forma da votação, o placar nem o voto de cada deputado: tipo null e voto individual "${VOTO_INDISPONIVEL}". Nada é deduzido de "aprovado".`,
    `O "Controle de Votações" do Portal da Transparência (${C.votacoes}) busca os dados num caminho proibido a robôs pelo robots.txt (/api/) e exige reCAPTCHA: não é acessado. O pedido pela Lei de Acesso à Informação (LAI) para publicar votos e presença na API pública está redigido em ${LAI_PR} (ainda não enviado).`,
    'Proposições: só projetos (de lei, de lei complementar, de decreto legislativo, de resolução), propostas de emenda à Constituição e vetos; requerimentos, indicações e emendas de Plenário não são coletados. Sigla oficial da ALEP (PRO = Projeto de Lei). A data de apresentação é a data de recebimento registrada pela ALEP. O detalhe (trâmites e normas geradas) é lido aos poucos, no máximo PR_MAX_DETALHES por execução.',
    'Deputados: página "Conheça os deputados" do portal da ALEP (nome, partido e cargo na Mesa como publicados). O autor de um projeto só é ligado ao deputado quando o nome é idêntico ao da página.',
    `Normas: ${Object.values(TIPOS_NORMA).map((t) => t.tipo.toLowerCase()).join(', ')} da API de normas legais (atos, ofícios, portarias e designações da administração da Casa ficam de fora). A API informa o número e a data do Diário Oficial e se a norma foi sancionada ou promulgada; a proposição de origem vem do detalhe da norma, lido aos poucos (PR_MAX_NORMAS por execução). Os decretos do Governador não estão nessa API (são publicados no Diário Oficial do Estado) e não são coletados.`,
  ],
};
gravar(path.join(DIR, 'meta.json'), meta);
const ok = Boolean(parl?.itens?.length || projetos.size || normas.size);
log(`${ok ? 'ok' : 'falhou'} — ${JSON.stringify(meta.contagens)}`);
process.exit(ok ? 0 : 1);
