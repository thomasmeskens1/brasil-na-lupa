// Privacidade (diretriz 12): nenhum CPF, RG ou outro documento pessoal é gravado, e nomes de particulares
// (partes, interessados, advogados) não são republicados.
//
// A API de acórdãos do TCU não traz partes, interessados nem responsáveis (esses campos só existem no
// arquivo anual em sites.tcu.gov.br, que não é acessado). O único texto livre gravado é o "sumario".
// Conferência de 02/11/2026 (32.554 acórdãos de 2025-2026): em cerca de uma dezena de casos o campo
// "sumario" da fonte NÃO traz o resumo, e sim a lista de partes ou de representantes, com nome e CPF
// mascarado (ex.: "Fulano (XXX.123.456-XX)") ou nome e inscrição na OAB. Nesses casos o sumário inteiro
// é omitido e o item recebe um aviso; o link oficial continua no item.
// Em qualquer outro sumário, CPF/RG com número (completo ou mascarado) é trocado por "[documento pessoal omitido]".
//
// Agentes públicos (ministros relatores) aparecem só pelo nome, como a API traz, no papel de relator.

export const OMITIDO_DOC = '[documento pessoal omitido]';
export const AVISO_SUMARIO_OMITIDO =
  'Sumário omitido: neste acórdão o campo de sumário da fonte traz nomes e documentos de partes ou de advogados ([nome de particular omitido]), e não o resumo da decisão. Consulte o documento oficial pelo link.';

const NAO_LETRA_ANTES = '(?<![A-Za-zÀ-ÿ0-9])';
const NAO_LETRA_DEPOIS = '(?![A-Za-zÀ-ÿ0-9])';
const CPF_MASCARA = `[\\dXx*]{3}\\.[\\dXx*]{3}\\.[\\dXx*]{3}-[\\dXx*]{2}`;

// Marcadores de lista de partes/representantes no lugar do sumário.
const MARCADORES_PARTES = [
  new RegExp(`\\(\\s*${CPF_MASCARA}\\s*\\)`), // "Nome (XXX.123.456-XX)"
  /\(\s*(?:\d[\d.]*\s*\/\s*OAB-[A-Z]{2}|OAB-[A-Z]{2}\s*\d[\d.]*)\s*\)/, // "(30.648/OAB-DF)" ou "(OAB-CE 20814)"
  /^\s*(?:Representa[çc][ãa]o legal|Recorrentes?|Respons[áa]ve(?:l|is)|Interessad[oa]s?|Embargantes?|Agravantes?|Requerentes?|Advogad[oa]s?)\s*:/i,
];

const DOCUMENTOS = [
  new RegExp(`${NAO_LETRA_ANTES}${CPF_MASCARA}${NAO_LETRA_DEPOIS}`, 'g'),
  new RegExp(`${NAO_LETRA_ANTES}CPF\\s*(?:n[ºo°.]*\\s*)?:?\\s*\\d[\\d.\\-]{10,13}${NAO_LETRA_DEPOIS}`, 'gi'),
  new RegExp(`${NAO_LETRA_ANTES}RG\\s*(?:n[ºo°.]*\\s*)?:?\\s*\\d[\\d.\\-]{4,13}${NAO_LETRA_DEPOIS}`, 'gi'),
];

export const alteracoes = { sumarios_omitidos: [], sumarios_com_documento_omitido: 0 };

/** Sumário da fonte → { texto, aviso }. texto null quando o campo traz lista de partes (particulares). */
export function tratarSumario(s, key) {
  if (s == null) return { texto: null, aviso: null };
  const original = String(s);
  if (MARCADORES_PARTES.some((re) => re.test(original))) {
    alteracoes.sumarios_omitidos.push(key);
    return { texto: null, aviso: AVISO_SUMARIO_OMITIDO };
  }
  let t = original;
  for (const re of DOCUMENTOS) t = t.replace(re, OMITIDO_DOC);
  if (t !== original) alteracoes.sumarios_com_documento_omitido++;
  return { texto: t, aviso: null };
}
