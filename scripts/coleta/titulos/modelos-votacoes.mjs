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

export function subtituloVotacao(v) {
  const p = v.proposicao || {};
  const conhecida = p.sigla && (NOME_EXTENSO[p.sigla] || (v.casa === 'alesp' && p.sigla === 'PLC'));
  const nome = conhecida && p.numero ? nomeOficial(p.sigla, p.numero, p.ano, v.casa) : (p.titulo || p.identificacao || null);
  const forma = { nominal: 'votação nominal', simbolica: 'votação simbólica', secreta: 'votação secreta' }[v.tipo] || null;
  const orgao = v.orgao_nome && !/^plen/i.test(v.orgao_nome) ? v.orgao_nome : (v.casa === 'camara' ? 'Plenário da Câmara dos Deputados' : v.casa === 'senado' ? 'Plenário do Senado Federal' : 'Plenário da Assembleia Legislativa do Estado de São Paulo');
  return [nome, orgao, forma, dataBR(v.data)].filter(Boolean).join(' · ');
}

/** Título oficial sem alteração: a descrição oficial do resultado (ou a ementa, se faltar). */
export function oficialVotacao(v) {
  const d = limpar(v.descricao || '').replace(/^\((.*)\)\.?$/, '$1');
  const titulo = d || limpar(v.proposicao?.ementa || '') || 'Votação';
  return { titulo, fonte: v.fonte?.url || v.url || null };
}
