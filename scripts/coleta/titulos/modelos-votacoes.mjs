// Votações (Câmara, Senado, ALESP): título oficial (descrição oficial do resultado), subtítulo com o
// nome oficial por extenso e etiqueta montada só com campos estruturados (resultado e placar).
// Nada aqui reescreve ementa ou descrição: a revisão de precisão (dados/titulos/revisao/*-2.json)
// mostrou que reescrever texto livre muda alcance, nomes e objeto.
import { limpar, nomeOficial, NOME_EXTENSO } from './texto.mjs';
import { quorum } from './conteudo.mjs';
import { dataBR } from './lib.mjs';

const milhar = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Quórum qualificado que vale para a votação (lei complementar e emenda à Constituição), ou null. */
export function quorumAplicavel(v) {
  return quorum(v.casa, v.proposicao?.sigla);
}

/** Resultado oficial, só quando o campo e a descrição oficial não divergem. */
export function resultadoOficial(v) {
  const d = limpar(v.descricao || '').replace(/^\(/, '');
  const daDescricao = /^aprovad/i.test(d) ? 'aprovada' : /^rejeitad/i.test(d) ? 'rejeitada' : null;
  if (v.resultado && daDescricao && v.resultado !== daDescricao) return null;
  const r = v.resultado || null;
  return r === 'aprovada' || r === 'rejeitada' ? r : null;
}

/**
 * Etiqueta da votação: "Aprovado 312 × 140" (nominal), "Rejeitado 252 × 176 (mínimo 257 Sim)"
 * (rejeição com mais Sim que Não por quórum qualificado), "Aprovado em votação simbólica".
 * Placar que contradiz o resultado sem quórum que o explique: só o resultado, sem números.
 */
export function etiquetaVotacao(v) {
  const r = resultadoOficial(v);
  if (!r) return null;
  const palavra = r === 'aprovada' ? 'Aprovado' : 'Rejeitado';
  if (v.tipo === 'simbolica') return `${palavra} em votação simbólica`;
  if (v.tipo === 'secreta') return `${palavra} em votação secreta`;
  if (v.tipo !== 'nominal') return palavra;
  const sim = v.placar?.sim, nao = v.placar?.nao;
  if (!Number.isFinite(sim) || !Number.isFinite(nao)) return palavra;
  const numeros = `${milhar(sim)} × ${milhar(nao)}`;
  if (r === 'aprovada' && sim >= nao) return `${palavra} ${numeros}`;
  if (r === 'rejeitada' && sim <= nao) return `${palavra} ${numeros}`;
  if (r === 'rejeitada') {
    const q = quorumAplicavel(v);
    if (q && sim < q) return `${palavra} ${numeros} (mínimo ${q} Sim)`;
  }
  return palavra;
}

/** Nome oficial por extenso da proposição ("Projeto de Lei 5815/2025"), ou null. */
function nomeDaProposicao(v) {
  const p = v.proposicao || {};
  const conhecida = p.sigla && (NOME_EXTENSO[p.sigla] || (v.casa === 'alesp' && p.sigla === 'PLC'));
  return conhecida && p.numero ? nomeOficial(p.sigla, p.numero, p.ano, v.casa) : (p.titulo || p.identificacao || null);
}

/** Descrição oficial do resultado da votação, sem os parênteses externos. */
function descricaoOficial(v) {
  return limpar(v.descricao || '').replace(/^\((.*)\)\.?$/, '$1');
}

const MAX_EMENTA = 170;

/**
 * Começo literal da ementa, para caber no título: até MAX_EMENTA caracteres, cortado numa vírgula
 * (se houver uma depois do 80º caractere) ou entre palavras, com reticências. Nada é reescrito.
 */
export function ementaCurta(ementa) {
  const t = limpar(ementa || '');
  if (t.length <= MAX_EMENTA) return t;
  const corte = t.slice(0, MAX_EMENTA);
  const virgula = corte.lastIndexOf(', ');
  const fim = virgula >= 80 ? virgula : corte.lastIndexOf(' ');
  return `${corte.slice(0, fim > 0 ? fim : MAX_EMENTA).replace(/[\s,;:–-]+$/, '')}…`;
}

/** O título usa a ementa (nome da proposição + o que ela propõe)? */
function tituloPelaEmenta(v) {
  return Boolean(nomeDaProposicao(v) && limpar(v.proposicao?.ementa || ''));
}

/**
 * Subtítulo: a descrição oficial do resultado (quando o título traz a ementa, ela diz qual etapa foi
 * votada: urgência, redação final, o projeto em si), o órgão, a forma e a data.
 */
export function subtituloVotacao(v) {
  const forma = { nominal: 'votação nominal', simbolica: 'votação simbólica', secreta: 'votação secreta' }[v.tipo] || null;
  const orgao = v.orgao_nome && !/^plen/i.test(v.orgao_nome) ? v.orgao_nome : (v.casa === 'camara' ? 'Plenário da Câmara dos Deputados' : v.casa === 'senado' ? 'Plenário do Senado Federal' : 'Plenário da Assembleia Legislativa do Estado de São Paulo');
  const primeiro = tituloPelaEmenta(v) ? descricaoOficial(v) || null : nomeDaProposicao(v);
  return [primeiro, orgao, forma, dataBR(v.data)].filter(Boolean).join(' · ');
}

/**
 * Título oficial: o nome da proposição e o começo literal da ementa ("Projeto de Lei 5815/2025:
 * Institui e cria o Programa Nacional…"), para dizer do que trata o que foi votado. Sem ementa, a
 * descrição oficial do resultado.
 */
export function oficialVotacao(v) {
  const fonte = v.fonte?.url || v.url || null;
  if (tituloPelaEmenta(v)) return { titulo: `${nomeDaProposicao(v)}: ${ementaCurta(v.proposicao.ementa)}`, fonte };
  const titulo = descricaoOficial(v) || limpar(v.proposicao?.ementa || '') || 'Votação';
  return { titulo, fonte };
}
