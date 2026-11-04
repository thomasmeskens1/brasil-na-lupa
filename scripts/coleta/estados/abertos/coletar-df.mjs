// Execução da coleta do Distrito Federal (CLDF, API pública do PLe): rede + gravação. Interpretação em df.mjs.
import path from 'node:path';
import { lerJson, fonte, chaveNome, VOTO_INDISPONIVEL } from './base.mjs';
import { CASA_DF, interpretarAutoresDF, interpretarProposicaoDF, interpretarNormaListaDF, aplicarDetalheNormaDF } from './df.mjs';
import { lerIndices, gravar, gravarIndices, porDataDesc } from './saida.mjs';

const TAM_PROP = 100;
const TAM_NORMA = 100;

export async function coletarDF({ cliente, dir, hoje, anos, inicioExec, log }) {
  const C = CASA_DF;
  const falhas = [];
  const tentar = async (rotulo, fn) => { try { return await fn(); } catch (e) { falhas.push(`${rotulo}: ${e.message}`); log(`FALHA ${rotulo}: ${e.message}`); return null; } };
  const maxPag = Number(process.env.DF_MAX_PAGINAS || 40);

  // 1) Deputados (autores parlamentares ativos)
  let parl = lerJson(path.join(dir, 'parlamentares.json'));
  const autores = await tentar('autores', () => cliente.json(`${C.api}/autor/listar`));
  if (autores) { parl = interpretarAutoresDF(autores, hoje); gravar(path.join(dir, 'parlamentares.json'), parl); log(`deputados (autores ativos): ${parl.itens.length}`); }
  const porNome = new Map((parl?.itens || []).map((p) => [chaveNome(p.nome), p.id]));

  // 2) Proposições do ano (todas as espécies), da leitura mais recente para a mais antiga
  const props = lerIndices(dir, 'proposicoes');
  const totais = {};
  for (const ano of anos) {
    for (let pag = 0; pag < maxPag; pag++) {
      if (!cliente.cabe()) break;
      const d = await tentar(`proposições ${ano} p.${pag}`, () => cliente.json(`${C.api}/proposicao/filter?page=${pag}&size=${TAM_PROP}&sort=dataLeitura,DESC`, { metodo: 'POST', corpo: { ano: String(ano), ementa: true } }));
      if (!d) break;
      for (const r of d.content || []) { const it = interpretarProposicaoDF(r, hoje, porNome); if (it) props.set(it.id, it); }
      totais[ano] = d.totalElements ?? null;
      if (d.last || !(d.content || []).length) break;
    }
    log(`proposições ${ano}: ${[...props.values()].filter((p) => p.ano === ano).length} de ${totais[ano] ?? '?'} na fonte`);
  }

  // 3) Normas do ano (leis, leis complementares, decretos, emendas à Lei Orgânica…)
  const normas = lerIndices(dir, 'normas');
  const totaisN = {};
  for (const ano of anos) {
    for (let pag = 0; pag < maxPag; pag++) {
      if (!cliente.cabe()) break;
      const d = await tentar(`normas ${ano} p.${pag}`, () => cliente.json(`${C.api}/norma/buscar?page=${pag}&size=${TAM_NORMA}`, { metodo: 'POST', corpo: { operadorLogico: 'AND', ano: String(ano) } }));
      if (!d) break;
      for (const r of d.content || []) {
        const it = interpretarNormaListaDF(r, hoje);
        if (!it) continue;
        const ant = normas.get(it.id);
        normas.set(it.id, ant?.detalhe_coletado && ant.id_oficial === it.id_oficial ? { ...ant, ementa: it.ementa, fonte: it.fonte } : it);
      }
      totaisN[ano] = d.totalElements ?? null;
      if (d.last || !(d.content || []).length) break;
    }
    log(`normas ${ano}: ${[...normas.values()].filter((n) => n.ano === ano).length} de ${totaisN[ano] ?? '?'} na fonte`);
  }

  // 4) Detalhe das normas (DODF e proposição de origem): leis primeiro, mais recentes antes
  const max = Number(process.env.DF_MAX_DETALHES || 40);
  const peso = (n) => (/^Lei/.test(n.tipo || '') ? 0 : 1);
  const fila = [...normas.values()].filter((n) => !n.detalhe_coletado)
    .sort((a, b) => peso(a) - peso(b) || String(b.data_assinatura || '').localeCompare(String(a.data_assinatura || '')));
  let detalhados = 0;
  for (const n of fila.slice(0, max)) {
    if (!cliente.cabe()) break;
    const d = await tentar(`norma ${n.id_oficial}`, () => cliente.json(`${C.api}/norma/${n.id_oficial}`));
    if (d) { normas.set(n.id, aplicarDetalheNormaDF(n, d, hoje)); detalhados++; }
  }
  log(`detalhes de normas: ${detalhados} (faltam ${Math.max(0, fila.length - detalhados)})`);

  // 5) Ligação norma → proposição (pelo id oficial da proposição de origem)
  for (const n of normas.values()) {
    const p = n.projeto_origem ? props.get(n.projeto_origem.id) : null;
    if (p) p.situacao = { ...p.situacao, url_norma: n.url, norma: n.nome_oficial };
  }

  // 6) Gravação
  const listaP = [...props.values()];
  const listaN = [...normas.values()];
  const contP = gravarIndices(dir, 'proposicoes', listaP, (p) => p.ano, (ano) => ({
    atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano,
    fonte: fonte(`Proposições de ${ano} — API pública do PLe/CLDF`, `${C.api}/proposicao/filter`, C.nome, hoje),
  }), porDataDesc('data_leitura'));
  const contN = gravarIndices(dir, 'normas', listaN, (n) => n.ano, (ano) => ({
    atualizado_em: hoje, uf: C.uf, ano: Number(ano) || ano,
    abrangencia: 'Normas do Distrito Federal cadastradas na API pública de Normas do PLe (leis distritais, leis complementares, decretos do Governador e demais atos)',
    fontes: [fonte('API pública de Normas — PLe/CLDF', `${C.api}/norma/buscar`, C.nome, hoje)],
  }), porDataDesc('data_assinatura'));

  const meta = {
    atualizado_em: new Date().toISOString(), ultima_execucao: inicioExec, uf: C.uf, casa: C.casa, orgao: C.nome,
    periodo: { anos, fim: hoje }, modo: 'incremental',
    fontes: [
      fonte('API pública do Processo Legislativo Eletrônico (PLe) da CLDF', C.api, C.nome, hoje),
      fonte('Documentação da API (Portal de Dados Abertos da CLDF)', 'https://dados.cl.df.gov.br/dataset/proposicoes', C.nome, hoje),
    ],
    robots: cliente.resumoRobots(),
    execucao: { requisicoes: cliente.requisicoes, falhas: [...falhas, ...cliente.falhas].slice(0, 50) },
    contagens: {
      parlamentares: parl?.itens?.length ?? 0, proposicoes_por_ano: contP, proposicoes_na_fonte: totais,
      normas_por_ano: contN, normas_na_fonte: totaisN, normas_detalhadas_nesta_execucao: detalhados,
      normas_sem_detalhe: listaN.filter((n) => !n.detalhe_coletado).length,
    },
    observacoes: [
      'Fonte: API pública documentada do PLe da CLDF ("Autenticação: não requerida"; "Estrutura pode evoluir sem aviso prévio"). O host não publica robots.txt (devolve a página do sistema); intervalo mínimo de 2 s. A API de dados do portal dados.cl.df.gov.br (/api/) é proibida pelo robots.txt e não é usada.',
      `Votações: a API pública não traz votações nem votos. As votações da CLDF ficam nas atas das sessões (PDF); a maioria é simbólica. Voto individual: "${VOTO_INDISPONIVEL}" até haver registro nominal em formato aberto (pedido pela LAI em docs/pesquisa/pedidos-lai/df.md).`,
      'Proposições: todas as espécies do ano (projetos, indicações, requerimentos, moções…), com a etapa informada pela fonte. A data exibida é a de leitura em Plenário; a data de apresentação não vem na lista.',
      'Deputados: autores do tipo PARLAMENTAR com situação ATIVO no cadastro do PLe; o partido não vem preenchido nessa fonte. E-mail só do domínio cl.df.gov.br. O histórico das proposições (com login e IP de servidores) não é gravado.',
      'Normas: lista do ano na API de Normas; o detalhe (publicação no DODF e proposição de origem) é lido aos poucos, leis primeiro, no máximo DF_MAX_DETALHES por execução.',
    ],
  };
  gravar(path.join(dir, 'meta.json'), meta);
  return { uf: C.uf, ok: Boolean(autores || props.size), resumo: meta.contagens };
}
