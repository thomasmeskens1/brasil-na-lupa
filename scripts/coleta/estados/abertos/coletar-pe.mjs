// Execução da coleta de Pernambuco (ALEPE): rede + gravação. A interpretação fica em pe.mjs.
import path from 'node:path';
import { lerJson, fonte, VOTO_INDISPONIVEL } from './base.mjs';
import {
  CASA_PE, TIPOS_NORMA_PE, interpretarParlamentaresPE, interpretarListaPE, interpretarDetalhePE, aplicarDetalhePE,
  votacoesDoProjetoPE, interpretarListaNormasPE, ligarNormasPE,
} from './pe.mjs';
import { lerIndices, gravar, gravarIndices, gravarVotacoes, porDataDesc } from './saida.mjs';

const DIAS_REVISITA = 7;
const CONCLUSIVO = /SANCIONAD|PROMULGAD|ARQUIVAD|VETAD|REJEITAD|PREJUDICAD|RETIRAD/i;

export async function coletarPE({ cliente, dir, hoje, anos, inicioExec, log }) {
  const C = CASA_PE;
  const falhas = [];
  const tentar = async (rotulo, fn) => { try { return await fn(); } catch (e) { falhas.push(`${rotulo}: ${e.message}`); log(`FALHA ${rotulo}: ${e.message}`); return null; } };

  // 1) Deputados
  let parl = lerJson(path.join(dir, 'parlamentares.json'));
  const lista = await tentar('parlamentares', () => cliente.json(`${C.api}/parlamentares/?formato=json`));
  if (lista) { parl = interpretarParlamentaresPE(lista, hoje); gravar(path.join(dir, 'parlamentares.json'), parl); log(`deputados: ${parl.itens.length}`); }

  // 2) Projetos: lista do ano (completa numa requisição) mesclada com o que já foi detalhado antes
  const antigos = lerIndices(dir, 'proposicoes');
  const projetos = new Map(antigos);
  for (const ano of anos) {
    const xml = await tentar(`projetos ${ano}`, () => cliente.texto(`${C.api}/proposicoes/projetos/?ano=${ano}`, { aceitar: 'application/xml,text/xml' }));
    if (!xml) continue;
    const itens = interpretarListaPE(xml, hoje, parl?.itens || []);
    for (const it of itens) {
      const ant = projetos.get(it.id);
      projetos.set(it.id, ant ? { ...ant, ...it, situacao: ant.situacao, situacao_coletada_em: ant.situacao_coletada_em, discussoes: ant.discussoes, lei_gerada: ant.lei_gerada, justificativa_oficial: ant.justificativa_oficial } : it);
    }
    log(`projetos ${ano}: ${itens.length} na lista`);
  }

  // 3) Detalhes (histórico, discussões, autógrafo): primeiro os nunca detalhados (mais novos antes), depois revisita
  const max = Number(process.env.PE_MAX_DETALHES || 40);
  const limiteRev = new Date(Date.parse(hoje) - DIAS_REVISITA * 86400000).toISOString().slice(0, 10);
  const todos = [...projetos.values()].filter((p) => anos.includes(p.ano));
  const nunca = todos.filter((p) => !p.situacao_coletada_em).sort(porDataDesc('data_publicacao'));
  const revisitar = todos.filter((p) => p.situacao_coletada_em && p.situacao_coletada_em < limiteRev && !CONCLUSIVO.test(p.situacao?.etapa || ''))
    .sort((a, b) => a.situacao_coletada_em.localeCompare(b.situacao_coletada_em));
  let detalhados = 0;
  for (const p of [...nunca, ...revisitar].slice(0, max)) {
    if (!cliente.cabe()) { log('orçamento acabou durante os detalhes; o resto fica para a próxima execução'); break; }
    const xml = await tentar(`detalhe ${p.id}`, () => cliente.texto(p.fonte_dados, { aceitar: 'application/xml,text/xml' }));
    const det = xml ? interpretarDetalhePE(xml, hoje) : null;
    if (det) { projetos.set(p.id, aplicarDetalhePE(p, det, hoje)); detalhados++; }
  }
  log(`detalhes: ${detalhados} (faltam ${Math.max(0, nunca.length - detalhados)} nunca detalhados)`);

  // 4) Normas do ano corrente (listas do legis.alepe; uma requisição por tipo)
  const normas = lerIndices(dir, 'normas');
  for (const t of Object.keys(TIPOS_NORMA_PE)) {
    const html = await tentar(`normas tipo ${t}`, () => cliente.texto(`${C.legis}/lista.aspx?tiponorma=${t}`, { aceitar: 'text/html' }));
    if (!html) continue;
    const itens = interpretarListaNormasPE(html, Number(t), hoje);
    // As listas de LC e EC trazem todos os anos: só entram os anos coletados (história parcial confundiria o leitor).
    for (const n of itens) if (anos.includes(n.ano)) normas.set(n.id, n); // a ligação com o projeto é refeita abaixo
    log(`normas (${TIPOS_NORMA_PE[t].tipo}): ${itens.length} na lista, ${itens.filter((n) => anos.includes(n.ano)).length} dos anos coletados`);
  }
  const listaProj = [...projetos.values()];
  const listaNormas = [...normas.values()];
  ligarNormasPE(listaNormas, listaProj);

  // 5) Votações (resultado por discussão em Plenário)
  const votacoes = listaProj.flatMap((p) => votacoesDoProjetoPE(p, hoje));

  // 6) Gravação
  const contProj = gravarIndices(dir, 'proposicoes', listaProj, (p) => p.ano, (ano) => ({
    atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano,
    fonte: fonte(`Projetos de ${ano} — Dados Abertos da ALEPE`, `${C.api}/proposicoes/projetos/?ano=${ano}`, C.nome, hoje),
  }), porDataDesc('data_publicacao'));
  const contNormas = gravarIndices(dir, 'normas', listaNormas, (n) => n.ano, (ano) => ({
    atualizado_em: hoje, uf: C.uf, ano: Number(ano) || ano,
    abrangencia: 'Leis ordinárias, leis complementares, emendas constitucionais e decretos do Poder Executivo de Pernambuco (lista do ano corrente do sistema de legislação da ALEPE)',
    fontes: Object.entries(TIPOS_NORMA_PE).map(([t, d]) => fonte(`Legislação Estadual — ${d.tipo} (ALEPE)`, `${C.legis}/lista.aspx?tiponorma=${t}`, C.nome, hoje)),
  }), porDataDesc('data_publicacao'));
  const contVot = gravarVotacoes(dir, votacoes, (ano) => ({ atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano }));

  const meta = {
    atualizado_em: new Date().toISOString(), ultima_execucao: inicioExec, uf: C.uf, casa: C.casa, orgao: C.nome,
    periodo: { anos, fim: hoje }, modo: 'incremental',
    fontes: [
      fonte('Dados Abertos da ALEPE — parlamentares e proposições (API pública)', `${C.api}/parlamentares/?formato=json`, C.nome, hoje),
      fonte('Sistema de Legislação Estadual da ALEPE', C.legis, C.nome, hoje),
    ],
    robots: cliente.resumoRobots(),
    execucao: { requisicoes: cliente.requisicoes, falhas: [...falhas, ...cliente.falhas].slice(0, 50) },
    contagens: {
      parlamentares: parl?.itens?.length ?? 0, proposicoes_por_ano: contProj, normas_por_ano: contNormas, votacoes_por_ano: contVot,
      detalhados_nesta_execucao: detalhados, sem_detalhe: listaProj.filter((p) => !p.situacao_coletada_em).length,
    },
    observacoes: [
      'Fonte: API pública de dados abertos da ALEPE (parlamentares em JSON; projetos em XML, endpoint público usado pelo site de proposições e não listado na documentação) e listas do sistema de legislação estadual da ALEPE (HTML). Nenhum dos hosts publica robots.txt (HTTP 404); intervalo mínimo de 2 s por host.',
      'Proposições: só projetos (PLO, PLC, PEC, PR, LOA, LDO, PPA); indicações e requerimentos não são coletados. A sigla é a usada pela ALEPE para o tipo informado na fonte. O detalhe (histórico, resultado de cada discussão, autógrafo e número da lei) é lido aos poucos, no máximo PE_MAX_DETALHES por execução.',
      `Votações: a fonte registra só o resultado de cada discussão em Plenário (ex.: "APROVADA EM PRIMEIRA DISCUSSÃO"), com a data. Não informa a forma da votação nem o voto de cada deputado: tipo null e voto individual "${VOTO_INDISPONIVEL}". Nada é deduzido de "aprovada".`,
      'Ligação projeto → lei: só quando o autógrafo do projeto cita o número da lei e o tipo bate (PLO → Lei, PLC → Lei Complementar, PEC → Emenda Constitucional).',
      'Deputados: a API traz só nome e partido (sem identificador oficial, mandato ou foto); o identificador é derivado do nome. Autor externo passa pelo mascaramento de nomes de particulares (diretriz 12).',
      'Normas: só as publicadas nos anos coletados (as listas de leis complementares e emendas constitucionais trazem todos os anos; as de leis e decretos, o ano corrente), com nome oficial, data de publicação no Diário Oficial e ementa; a data de assinatura vem do autógrafo do projeto quando houver ligação.',
    ],
  };
  gravar(path.join(dir, 'meta.json'), meta);
  return { uf: C.uf, ok: Boolean(lista || projetos.size), resumo: meta.contagens };
}
