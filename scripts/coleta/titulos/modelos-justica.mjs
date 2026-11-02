// Modelos de título para STJ e STF: a tese (ou a questão) é usada literalmente; o único
// encurtamento permitido é o corte em fronteira de oração, sem descartar ressalvas e exceções.
import { limpar, cortarEmOracao, SUBORDINADA_INICIAL } from './texto.mjs';
import { LIMITE_DURO } from './regras.mjs';
import { siglasSemExtenso } from './conteudo.mjs';

const tirarPonto = (s) => limpar(s).replace(/[.;]\s*$/, '');

/** Texto literal que cabe em max, ou prefixo cortado em fronteira de oração; null se não houver. */
function literal(texto, max) {
  const t = tirarPonto(texto || '');
  if (!t) return null;
  if (t.length <= max) return t;
  if (SUBORDINADA_INICIAL.test(t)) return null; // prefixo de oração subordinada não é oração completa
  return cortarEmOracao(t, max, { estrito: true, minimo: 25 });
}

// Artefatos de numeração de tópicos ("… do MCI 1", "1. Reconhecimento…") saem; sigla sem extenso reprova.
const semNumeracao = (s) => s && limpar(s).replace(/^(\d+|[IVX]+)[.)–-]\s+/u, '').replace(/\s+(\d+|[IVX]+)[.)]?$/u, '').trim();
function comPrefixo(prefixo, texto) {
  const corpo = semNumeracao(literal(semNumeracao(texto), LIMITE_DURO - prefixo.length));
  if (!corpo || siglasSemExtenso(corpo).length) return null;
  return `${prefixo}${corpo}`;
}

export function modeloTemaStj(t) {
  const fonte = t.url_oficial || t.fontes?.[0]?.url;
  const sit = String(t.situacao || '');
  if (/^Cancelado/i.test(sit)) {
    const x = comPrefixo('STJ cancela tema repetitivo sobre a questão: ', t.questao);
    return x ? { titulo: x, origem: 'modelo', fonte } : { erro: 'questão longa demais para corte em fronteira de oração' };
  }
  if (t.tese) {
    const x = comPrefixo('STJ fixa tese: ', t.tese) || comPrefixo('STJ fixa tese sobre a questão: ', t.questao);
    return x ? { titulo: x, origem: 'modelo', fonte } : { erro: 'tese e questão longas demais para corte em fronteira de oração' };
  }
  const x = comPrefixo('STJ analisa a questão: ', t.questao);
  return x ? { titulo: x, origem: 'modelo', fonte } : { erro: 'questão longa demais para corte em fronteira de oração' };
}

export function modeloTemaStf(t) {
  const fonte = t.url || t.fontes?.[0]?.url;
  const rg = String(t.situacao?.repercussao_geral || '');
  if (t.tese) {
    const x = comPrefixo('STF fixa tese: ', t.tese) || comPrefixo('STF fixa tese sobre o tema: ', t.titulo);
    return x ? { titulo: x, origem: 'modelo', fonte } : { erro: 'tese e título do tema longos demais para corte em fronteira de oração' };
  }
  if (/^Não há repercussão geral/i.test(rg)) {
    const x = comPrefixo('STF nega repercussão geral ao tema: ', t.titulo);
    return x ? { titulo: x, origem: 'modelo', fonte } : { erro: 'título do tema longo demais' };
  }
  if (/^Há repercussão geral/i.test(rg)) {
    const x = comPrefixo('STF analisa o tema: ', t.titulo);
    return x ? { titulo: x, origem: 'modelo', fonte } : { erro: 'título do tema longo demais' };
  }
  return { erro: 'situação do tema não informada' };
}

export function modeloSumulaVinculante(s) {
  const x = comPrefixo('STF fixa súmula vinculante: ', s.texto);
  return x ? { titulo: x, origem: 'modelo', fonte: s.url || null } : { erro: 'texto da súmula longo demais para corte em fronteira de oração' };
}

/** Julgamento do STF: tese do precedente ou a parte dispositiva da certidão, a partir de "O Tribunal". */
export function modeloJulgamentoStf(j) {
  const fonte = j.certidao_fonte?.url || j.processo?.url;
  if (j.precedente?.tese) {
    const x = comPrefixo('STF fixa tese: ', j.precedente.tese);
    if (x) return { titulo: x, origem: 'modelo', fonte: j.precedente.tese_fonte?.url || fonte };
  }
  const cert = limpar(j.certidao_literal || '').replace(/^Decisão:\s*/i, '');
  const m = /^(O Tribunal|O Plenário|A Turma|A Primeira Turma|A Segunda Turma)\b/iu.exec(cert);
  if (!m) return { erro: 'certidão sem parte dispositiva reconhecível' };
  const resto = tirarPonto(cert.replace(m[1], '').replace(/^[,\s]+/, ''));
  const corpo = resto.length <= LIMITE_DURO - 5 ? resto : cortarEmOracao(resto, LIMITE_DURO - 5, { minimo: 25 });
  if (!corpo) return { erro: 'certidão longa demais para corte em fronteira de oração' };
  // "julgou procedente o pedido" sozinho esconde o conteúdo: exige o que foi declarado/decidido
  if (!/(inconstitucional|constitucional|interpreta|tese|declar|suspen|modula)/iu.test(corpo)) return { erro: 'parte dispositiva sem o conteúdo da decisão' };
  if (siglasSemExtenso(corpo).length) return { erro: 'sigla sem nome por extenso' };
  return { titulo: `STF ${corpo}`.replace(/^STF por /, 'STF, por '), origem: 'modelo', fonte };
}
