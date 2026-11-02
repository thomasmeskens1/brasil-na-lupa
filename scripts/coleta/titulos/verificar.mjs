#!/usr/bin/env node
// Verificador dos títulos simples (roda ao fim do gerar.mjs e, no futuro, no build):
// todo número/data do título existe no dado oficial do item; verbo da lista fechada; nenhuma palavra
// proibida; "placar"/contagem de votos só em votação nominal; tamanho; nenhum nome de pessoa; mesma
// frase quando se troca partido/autor/governo (simetria). Item reprovado → título oficial.
//
// Uso: node scripts/coleta/titulos/verificar.mjs [--secoes camara,stj] [--corrigir]
//   sem --corrigir: só relata e sai com código 1 se houver reprovação.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAIDA, lerJson, gravarSeMudou } from './lib.mjs';
import { SECOES, carregarSecao, nomesGlobais, perturbar } from './itens.mjs';
import { verificarTitulo, verificacaoOficial } from './regras.mjs';
import { VERBOS_EMENTA } from './texto.mjs';
import { TEMAS } from './temas.mjs';
import { carregarVetos } from './conteudo.mjs';
import { sufixoPlacar } from './modelos-votacoes.mjs';

const ORIGENS = new Set(['apelido-oficial', 'explicacao-oficial', 'agencia-camara', 'agencia-senado', 'modelo', 'oficial']);

/** Contexto de verificação de um candidato c = { titulo, origem, _extra? } para o item it. */
export function contextoVerificacao(it, c) {
  const ctx = {
    universo: it.universo, nominal: it.nominal, nomes: [...it.nomes, ...nomesGlobais()],
    verbosExtras: ['mp', 'norma'].includes(it.tipo) || /^agencia-/.test(c.origem) ? VERBOS_EMENTA : [],
    textos: [...(it.textos || []), ...(c._extra?.apelido ? [c._extra.apelido] : [])],
    ementa: it.textos?.[0] || '',
    placarObrigatorio: it.tipo === 'votacao' && sufixoPlacar(it.raw) !== '',
    exigirSiglaExtensa: ['tese', 'julgamento'].includes(it.tipo),
  };
  if (c._extra && ['modelo', 'apelido-oficial', 'explicacao-oficial'].includes(c.origem)) {
    const p = it.construir(perturbar(it.raw), c._extra);
    ctx.titulo_perturbado = p.titulo ?? null;
  }
  return ctx;
}

export function verificarTudo({ secoes = SECOES, corrigir = false, silencioso = false } = {}) {
  const resumo = { verificados: 0, reprovados: 0, corrigidos: 0, sem_dado_de_origem: 0 };
  const reprovados = [];
  const vetos = carregarVetos();
  for (const secao of secoes) {
    const arq = path.join(SAIDA, `${secao}.json`);
    const doc = lerJson(arq);
    if (!doc?.itens) continue;
    const porId = new Map(carregarSecao(secao).map((i) => [i.id, i]));
    let mudou = false;
    for (const [id, t] of Object.entries(doc.itens)) {
      resumo.verificados++;
      const it = porId.get(id);
      if (!it) { resumo.sem_dado_de_origem++; reprovados.push({ secao, id, motivos: ['item sem dado de origem em dados/'] }); continue; }
      const motivos = [];
      if (!ORIGENS.has(t.origem)) motivos.push(`origem desconhecida: ${t.origem}`);
      if (!TEMAS.includes(t.tema)) motivos.push(`tema fora da tabela: ${t.tema}`);
      if (!t.fonte) motivos.push('sem fonte');
      if (t.origem === 'oficial' && t.titulo !== it.oficial.titulo) motivos.push('título "oficial" diferente do texto oficial');
      if (/^agencia-/.test(t.origem) && !t.fonte_data) motivos.push('manchete sem data da notícia');
      const vetado = vetos.get(`${secao}|${id}`);
      if (vetado && t.origem !== 'oficial') motivos.push(`vetado pelos analistas: ${vetado.join(', ')}`);
      if (vetado && t.origem === 'oficial' && !Array.isArray(t.verificacao?.veto_vies)) motivos.push('veto dos analistas não registrado em verificacao.veto_vies');
      // para a simetria, só os modelos que dependem apenas de dados/ podem ser refeitos sem rede
      const etapa = (/; (segue para (o Senado|a Câmara)|vai à (sanção|promulgação))(?= \(|$)/u.exec(t.titulo) || [])[1];
      const c = { titulo: t.titulo, origem: t.origem, ...(t.origem === 'modelo' || (t.origem === 'apelido-oficial' && ['mp', 'norma'].includes(it.tipo)) ? { _extra: etapa ? { etapa } : {} } : {}) };
      const v = t.origem === 'oficial'
        ? { motivos: [] }
        : verificarTitulo(t.titulo, t.origem, contextoVerificacao(it, c));
      motivos.push(...v.motivos);
      if (!motivos.length) continue;
      resumo.reprovados++;
      reprovados.push({ secao, id, titulo: t.titulo, origem: t.origem, motivos });
      if (corrigir) {
        doc.itens[id] = { ...t, titulo: it.oficial.titulo, origem: 'oficial', fonte: it.oficial.fonte || t.fonte, verificacao: { ...verificacaoOficial(), veto_vies: vetado || null, reprovado_na_verificacao: motivos } };
        delete doc.itens[id].fonte_data; delete doc.itens[id].credito;
        resumo.corrigidos++; mudou = true;
      }
    }
    if (mudou) gravarSeMudou(arq, doc);
  }
  if (!silencioso) {
    for (const r of reprovados.slice(0, 200)) console.log(`[${r.secao}] ${r.id} (${r.origem}): ${r.motivos.join('; ')}${r.titulo ? `\n    "${r.titulo}"` : ''}`);
    console.log(JSON.stringify(resumo));
  }
  return { resumo, reprovados };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--secoes');
  const secoes = i >= 0 ? args[i + 1].split(',') : SECOES;
  const { resumo } = verificarTudo({ secoes, corrigir: args.includes('--corrigir') });
  process.exit(resumo.reprovados - resumo.corrigidos > 0 ? 1 : 0);
}
