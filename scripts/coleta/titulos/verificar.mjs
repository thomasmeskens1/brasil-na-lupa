#!/usr/bin/env node
// Verificador dos títulos (roda ao fim do gerar.mjs e pode rodar sozinho):
//   - origem "oficial": o título é exatamente o texto oficial do item;
//   - origem "estruturado": o título é exatamente o que o modelo fixo dá a partir dos campos do item
//     (refeito aqui), com modelo conhecido, trechos copiados literais, números/datas no dado oficial,
//     verbo da lista fechada, sem palavra proibida, sem nome de pessoa e simétrico (trocar partido/autor/
//     governo não muda a frase); item vetado por analista nunca é "estruturado";
//   - etiqueta: igual à montada pelos campos, curta, números no dado oficial.
// Aprovado → verificacao.aprovado_pelo_verificador = true. Reprovado com --corrigir → título oficial
// (etiqueta reprovada → sem etiqueta).
//
// Uso: node scripts/coleta/titulos/verificar.mjs [--secoes camara,stj] [--corrigir]
//   sem --corrigir: só relata e sai com código 1 se houver reprovação.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAIDA, lerJson, gravarSeMudou } from './lib.mjs';
import { SECOES, carregarSecao, nomesGlobais, perturbar } from './itens.mjs';
import { verificarTitulo, verificarEtiqueta, verificacaoOficial, ORIGENS } from './regras.mjs';
import { VERBOS_EMENTA } from './texto.mjs';
import { TEMAS } from './temas.mjs';
import { carregarVetos } from './conteudo.mjs';

/** Contexto de verificação de um candidato estruturado c = { titulo, modelo, literais } para o item it. */
export function contextoVerificacao(it, c) {
  const refeito = it.construir(it.raw);
  const perturbado = it.construir(perturbar(it.raw));
  return {
    universo: it.universo, nominal: it.nominal, nomes: [...it.nomes, ...nomesGlobais()],
    verbosExtras: ['mp', 'norma'].includes(it.tipo) ? VERBOS_EMENTA : [],
    textos: it.textos?.length ? it.textos : [it.oficial.titulo],
    modelo: c.modelo, literais: c.literais || [],
    titulo_refeito: refeito?.titulo ?? null,
    titulo_perturbado: perturbado?.titulo ?? null,
    exigirSiglaExtensa: ['tese', 'julgamento'].includes(it.tipo),
  };
}

export const contextoEtiqueta = (it) => ({ universo: it.universo, refeita: it.etiquetar(it.raw) ?? null });

/** Registro "oficial" de um item (título literal do órgão). */
export function registroOficial(it, t, extra = {}) {
  return {
    ...t, titulo: it.oficial.titulo, origem: 'oficial', fonte: it.oficial.fonte || t.fonte || null,
    verificacao: { ...verificacaoOficial(), aprovado_pelo_verificador: true, ...extra },
  };
}

export function verificarTudo({ secoes = SECOES, corrigir = false, silencioso = false } = {}) {
  const resumo = { verificados: 0, reprovados: 0, corrigidos: 0, sem_dado_de_origem: 0, estruturados: 0, etiquetas: 0 };
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
      if (!ORIGENS.includes(t.origem)) motivos.push(`origem desconhecida: ${t.origem}`);
      if (!TEMAS.includes(t.tema)) motivos.push(`tema fora da tabela: ${t.tema}`);
      if (!t.fonte) motivos.push('sem fonte');
      if (t.origem === 'oficial' && t.titulo !== it.oficial.titulo) motivos.push('título "oficial" diferente do texto oficial');
      const vetado = vetos.get(`${secao}|${id}`);
      if (vetado && t.origem !== 'oficial') motivos.push(`vetado pelos analistas: ${vetado.join(', ')}`);
      if (vetado && t.origem === 'oficial' && !Array.isArray(t.verificacao?.veto_vies)) motivos.push('veto dos analistas não registrado em verificacao.veto_vies');
      if (t.origem === 'estruturado') {
        const v = verificarTitulo(t.titulo, t.origem, contextoVerificacao(it, t));
        motivos.push(...v.motivos);
      }
      if (t.verificacao?.aprovado_pelo_verificador !== true && !motivos.length) motivos.push('sem marca de aprovação do verificador');
      const ve = t.etiqueta ? verificarEtiqueta(t.etiqueta, contextoEtiqueta(it)) : { aprovado: true, motivos: [] };
      if (!ve.aprovado) {
        reprovados.push({ secao, id, titulo: t.etiqueta, origem: 'etiqueta', motivos: ve.motivos });
        if (corrigir) { delete doc.itens[id].etiqueta; mudou = true; } else resumo.reprovados++;
      }
      if (!motivos.length) {
        if (t.origem === 'estruturado') resumo.estruturados++;
        if (doc.itens[id].etiqueta) resumo.etiquetas++;
        continue;
      }
      resumo.reprovados++;
      reprovados.push({ secao, id, titulo: t.titulo, origem: t.origem, motivos });
      if (corrigir) {
        doc.itens[id] = registroOficial(it, doc.itens[id], { veto_vies: vetado || null, reprovado_na_verificacao: motivos });
        delete doc.itens[id].modelo;
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
