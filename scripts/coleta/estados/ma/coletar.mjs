#!/usr/bin/env node
/**
 * Coletor da Assembleia Legislativa do Maranhão (ALEMA), API pública do ALEMALEGIS. Node 20+, sem dependências.
 *
 * USO
 *   node scripts/coleta/estados/ma/coletar.mjs                     # ano corrente
 *   node scripts/coleta/estados/ma/coletar.mjs --anos 2025,2026
 *   COLETA_ORCAMENTO_MIN=15 (padrão)  MA_MAX_DETALHES=80 (normas)  MA_MAX_TRAMITACOES=40 (projetos)
 *   node scripts/coleta/estados/ma/testes.mjs                      # testes offline
 *
 * SAÍDA (dados/estados/ma/, contrato de dados/esquema.json + "uf" e "casa", como PE e DF):
 *   meta.json, parlamentares.json, proposicoes/indice-<ano>.json, normas/indice-<ano>.json.
 *   Sem votacoes/: o Plenário vota de forma simbólica e a API não publica votos (a rota existe e vem vazia).
 *
 * INCREMENTAL: os próprios arquivos guardam o estado. O detalhe das normas (publicação e projeto de origem) e a
 * tramitação dos projetos são lidos aos poucos (limites acima); o que falta fica para as próximas execuções e
 * aparece em meta.json (contagens.normas_sem_detalhe, contagens.tramitacoes_pendentes).
 *
 * REGRAS: robots.txt antes de qualquer requisição (o host não publica: devolve a página do sistema); intervalo
 * mínimo de 2 s; User-Agent que cita o Brasil na Lupa; nenhuma rota com CPF/RG é chamada; nomes de particulares
 * mascarados; nada deduzido. Código de saída: 0 = ok; 1 = falha total.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Cliente, hojeISO, lerJson, fonte, chaveNome, VOTO_INDISPONIVEL } from '../abertos/base.mjs';
import { lerIndices, gravar, gravarIndices, porDataDesc } from '../abertos/saida.mjs';
import {
  CASA_MA, interpretarDeputadosMA, interpretarMateriaMA, interpretarTramitacaoMA, marcaAndamento,
  interpretarNormaListaMA, aplicarDetalheNormaMA, resumirSessoesMA,
} from './alema.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const DIR = path.join(RAIZ, 'dados', 'estados', 'ma');
const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const hoje = hojeISO();
const anos = (val('--anos') || hoje.slice(0, 4)).split(',').map(Number).filter((a) => a >= 2000 && a <= Number(hoje.slice(0, 4)));
if (!anos.length) { console.error('Uso: --anos AAAA[,AAAA]'); process.exit(1); }
const orcamentoMin = Number(process.env.COLETA_ORCAMENTO_MIN || 15);
const MAX_DET = Number(process.env.MA_MAX_DETALHES || 80);
const MAX_TRAM = Number(process.env.MA_MAX_TRAMITACOES || 40);
const TAM = 250;
const MAX_PAG = 40;
// Espécies com tramitação lida em detalhe (projetos e atos que viram norma); indicações, requerimentos e moções não.
const PROJETOS = new Set(['PLO', 'PLC', 'PEC', 'PRE', 'PDL', 'MPV', 'PLCON', 'VETT', 'VETP', 'MSG', 'EMD']);

const inicio = Date.now();
const log = (...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(0)}s] [MA]`, ...m);
const cliente = new Cliente({ prazoMs: inicio + orcamentoMin * 60000, log });
const C = CASA_MA;
const falhas = [];
const tentar = async (rotulo, fn) => { try { return await fn(); } catch (e) { falhas.push(`${rotulo}: ${e.message}`); log(`FALHA ${rotulo}: ${e.message}`); return null; } };
fs.mkdirSync(DIR, { recursive: true });
log(`ALEMA: anos ${anos.join(', ')}; orçamento ${orcamentoMin} min`);

// 1) Deputados: composição da 20ª legislatura + cadastro geral (partido e atividade), cruzados pelo id oficial
let parl = lerJson(path.join(DIR, 'parlamentares.json'));
const composicao = await tentar('composição da legislatura', () => cliente.json(`${C.api}/parliamentary/filter/legislature/${C.legislatura}`));
const cadastro = composicao ? await tentar('cadastro de parlamentares', () => cliente.json(`${C.api}/parliamentary?page=0&size=500&sort=id,asc`)) : null;
if (Array.isArray(composicao) && composicao.length && cadastro?.content) {
  parl = interpretarDeputadosMA(composicao, cadastro.content, hoje);
  gravar(path.join(DIR, 'parlamentares.json'), parl);
  log(`deputados da ${C.legislatura}ª legislatura: ${parl.itens.length}`);
}
const porNome = new Map((parl?.itens || []).map((p) => [chaveNome(p.nome), p.id]));

// 2) Matérias do ano (todas as espécies), da mais nova para a mais antiga
const props = lerIndices(DIR, 'proposicoes');
const totais = {};
for (const ano of anos) {
  for (let pag = 0; pag < MAX_PAG; pag++) {
    if (!cliente.cabe()) break;
    const d = await tentar(`matérias ${ano} p.${pag}`, () => cliente.json(`${C.api}/legislative-matter/filter/access?page=${pag}&size=${TAM}&sort=id,desc&year=${ano}`));
    if (!d) break;
    for (const r of d.content || []) {
      const it = interpretarMateriaMA(r, hoje, porNome);
      if (!it || it.ano !== ano) continue;
      const ant = props.get(it.id);
      // A tramitação já lida é mantida (com a marca antiga: se a matéria andou, ela volta para a fila de leitura).
      if (ant?.tramitacao) { it.tramitacao = ant.tramitacao; it.tramitacao_marca = ant.tramitacao_marca; it.tramitacao_coletada_em = ant.tramitacao_coletada_em; }
      props.set(it.id, it);
    }
    totais[ano] = d.totalElements ?? null;
    if (pag + 1 >= (d.totalPages ?? 0) || !(d.content || []).length) break;
  }
  log(`matérias ${ano}: ${[...props.values()].filter((p) => p.ano === ano).length} de ${totais[ano] ?? '?'} na fonte`);
}

// 3) Tramitação dos projetos que andaram (ou nunca lidos), mais recentes primeiro
const filaT = [...props.values()].filter((p) => PROJETOS.has(p.sigla) && p.tramitacao_marca !== marcaAndamento(p))
  .sort((a, b) => String(b.situacao?.ultima_tramitacao?.data || '').localeCompare(String(a.situacao?.ultima_tramitacao?.data || '')) || b.id_oficial - a.id_oficial);
let tramLidas = 0;
for (const p of filaT.slice(0, MAX_TRAM)) {
  if (!cliente.cabe()) break;
  const d = await tentar(`tramitação ${p.id_oficial}`, () => cliente.json(`${C.api}/processing/filter/legislative-matter/${p.id_oficial}`));
  if (!Array.isArray(d)) continue;
  props.set(p.id, { ...p, tramitacao: interpretarTramitacaoMA(d, p.id_oficial, hoje), tramitacao_marca: marcaAndamento(p), tramitacao_coletada_em: hoje });
  tramLidas++;
}
log(`tramitações lidas: ${tramLidas} (faltam ${Math.max(0, filaT.length - tramLidas)})`);

// 4) Normas do ano (leis, leis complementares, resoluções legislativas)
const normas = lerIndices(DIR, 'normas');
const totaisN = {};
for (const ano of anos) {
  for (let pag = 0; pag < MAX_PAG; pag++) {
    if (!cliente.cabe()) break;
    const d = await tentar(`normas ${ano} p.${pag}`, () => cliente.json(`${C.api}/legal-norm/filter?page=${pag}&size=${TAM}&sort=id,desc&year=${ano}`));
    if (!d) break;
    for (const r of d.content || []) {
      const it = interpretarNormaListaMA(r, hoje);
      if (!it || it.ano !== ano) continue;
      const ant = normas.get(it.id);
      normas.set(it.id, ant?.detalhe_coletado ? { ...ant, ementa: it.ementa, tipo: it.tipo, data_assinatura: it.data_assinatura, fonte: it.fonte } : it);
    }
    totaisN[ano] = d.totalElements ?? null;
    if (pag + 1 >= (d.totalPages ?? 0) || !(d.content || []).length) break;
  }
  log(`normas ${ano}: ${[...normas.values()].filter((n) => n.ano === ano).length} de ${totaisN[ano] ?? '?'} na fonte`);
}

// 5) Detalhe das normas: leis primeiro, mais recentes antes
const peso = (n) => (/^Lei/.test(n.tipo || '') ? 0 : 1);
const filaN = [...normas.values()].filter((n) => !n.detalhe_coletado)
  .sort((a, b) => peso(a) - peso(b) || String(b.data_assinatura || '').localeCompare(String(a.data_assinatura || '')) || b.id_oficial - a.id_oficial);
let detalhados = 0;
for (const n of filaN.slice(0, MAX_DET)) {
  if (!cliente.cabe()) break;
  const d = await tentar(`norma ${n.id_oficial}`, () => cliente.json(`${C.api}/legal-norm/${n.id_oficial}`));
  if (d) { normas.set(n.id, aplicarDetalheNormaMA(n, d, hoje)); detalhados++; }
}
log(`detalhes de normas: ${detalhados} (faltam ${Math.max(0, filaN.length - detalhados)})`);

// 6) Ligação norma → proposição (id oficial da matéria de origem, quando a matéria não trouxe a norma na lista)
for (const n of normas.values()) {
  const p = n.projeto_origem ? props.get(n.projeto_origem.id) : null;
  if (p && !p.situacao?.url_norma) p.situacao = { ...p.situacao, url_norma: n.url, norma: n.nome_oficial };
}

// 7) Sessões e votos: só conferência (a API não publica votos hoje; nada é gravado como votação)
const sessoes = cliente.cabe() ? await tentar('sessões plenárias', () => cliente.json(`${C.api}/plenary-session`)) : null;
const votosPorSessao = new Map();
for (const s of (Array.isArray(sessoes) ? sessoes : []).slice(0, 30)) {
  if (!cliente.cabe() || !Number.isFinite(s?.id)) break;
  const v = await tentar(`votos da sessão ${s.id}`, () => cliente.json(`${C.api}/votes/plenary-session/${s.id}`));
  if (v != null) votosPorSessao.set(s.id, v);
}
const resumoSessoes = resumirSessoesMA(sessoes, votosPorSessao, hoje);
const votosPublicados = resumoSessoes.reduce((s, x) => s + (x.votos_publicados || 0), 0);
if (votosPublicados) log(`ATENÇÃO: a API passou a publicar ${votosPublicados} registro(s) de voto; o coletor precisa ser estendido para gravá-los.`);

// 8) Gravação
const listaP = [...props.values()];
const listaN = [...normas.values()];
const contP = gravarIndices(DIR, 'proposicoes', listaP, (p) => p.ano, (ano) => ({
  atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano,
  fonte: fonte(`Matérias legislativas de ${ano} — API pública do ALEMALEGIS`, `${C.api}/legislative-matter/filter/access?year=${ano}&sort=id,desc`, C.nome, hoje),
}), porDataDesc('data_apresentacao'));
const contN = gravarIndices(DIR, 'normas', listaN, (n) => n.ano, (ano) => ({
  atualizado_em: hoje, uf: C.uf, ano: Number(ano) || ano,
  abrangencia: 'Normas estaduais cadastradas no ALEMALEGIS (leis, leis complementares e resoluções legislativas). Decretos do Governador não estão nessa base.',
  fontes: [fonte('Normas jurídicas — API pública do ALEMALEGIS', `${C.api}/legal-norm/filter?year=${ano}&sort=id,desc`, C.nome, hoje)],
}), porDataDesc('data_assinatura'));

const meta = {
  atualizado_em: new Date().toISOString(), ultima_execucao: new Date(inicio).toISOString(), uf: C.uf, casa: C.casa, orgao: C.nome,
  periodo: { anos, fim: hoje }, modo: 'incremental',
  fontes: [
    fonte('API pública do sistema legislativo ALEMALEGIS', C.api, C.nome, hoje),
    fonte('ALEMALEGIS: consulta pública de matérias', `${C.web}/legislative-matter/research`, C.nome, hoje),
    fonte('Diário da Assembleia (transcrição das sessões, PDF)', 'https://www.al.ma.leg.br/sitealema/diarios/', C.nome, hoje),
  ],
  robots: cliente.resumoRobots(),
  execucao: { requisicoes: cliente.requisicoes, falhas: [...falhas, ...cliente.falhas].slice(0, 50) },
  contagens: {
    parlamentares: parl?.itens?.length ?? 0, proposicoes_por_ano: contP, proposicoes_na_fonte: totais,
    tramitacoes_lidas_nesta_execucao: tramLidas,
    tramitacoes_pendentes: listaP.filter((p) => PROJETOS.has(p.sigla) && p.tramitacao_marca !== marcaAndamento(p)).length,
    normas_por_ano: contN, normas_na_fonte: totaisN, normas_detalhadas_nesta_execucao: detalhados,
    normas_sem_detalhe: listaN.filter((n) => !n.detalhe_coletado).length,
    sessoes_cadastradas: resumoSessoes.length, votos_publicados_na_api: votosPublicados,
  },
  sessoes_plenarias: resumoSessoes,
  observacoes: [
    'Fonte: API pública do ALEMALEGIS (sistema legislativo da ALEMA, sem autenticação e sem documentação publicada; rotas mapeadas a partir do código do próprio site, que pode mudar sem aviso). O host não publica robots.txt (o endereço devolve a página do sistema); intervalo mínimo de 2 s.',
    `Votações: o Plenário da ALEMA vota de forma simbólica ("Os Deputados e as Deputadas que aprovam permaneçam como estão"), registrada no Diário da Assembleia (PDF). A API tem a rota de votos, mas ela vem vazia; o resultado aparece só como situação da matéria (por exemplo "Proposição aprovada"). Voto de cada deputado: "${VOTO_INDISPONIVEL}".`,
    `Deputados: composição da ${C.legislatura}ª legislatura (2023–2026) pela rota própria da API; partido e atividade ("Ativo na Casa") vêm do cadastro geral, cruzado pelo id oficial. O campo de legislatura do cadastro não serve para filtrar (cada deputado fica ligado à legislatura do primeiro mandato no sistema).`,
    'Proposições: todas as espécies do ano (projetos, indicações, requerimentos, moções, mensagens, medidas provisórias, vetos), com a situação, a unidade atual e a última ação informadas pela fonte. A tramitação completa dos projetos é lida aos poucos (MA_MAX_TRAMITACOES por execução). Anexos (cartão CNPJ, estatutos, declarações) não são gravados.',
    'Normas: leis, leis complementares e resoluções legislativas cadastradas no ALEMALEGIS; o detalhe (data de publicação e projeto de origem) é lido aos poucos, leis primeiro. Decretos e medidas provisórias do Governador saem no Diário Oficial do Estado e ainda não são coletados.',
  ],
};
gravar(path.join(DIR, 'meta.json'), meta);
log(`ok — ${JSON.stringify(meta.contagens)}`);
process.exit(parl?.itens?.length || props.size ? 0 : 1);
