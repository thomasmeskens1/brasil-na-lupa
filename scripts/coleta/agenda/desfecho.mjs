// Regras para o desfecho de cada item da pauta. O desfecho só recebe uma categoria
// (aprovado, rejeitado, não votado, retirado, adiado) quando o texto oficial diz isso com
// essas palavras; em qualquer outro caso fica "não informado". O texto oficial é sempre
// guardado ao lado, para o leitor conferir.

export const NAO_INFORMADO = 'não informado';

export const REGRAS_DESFECHO = {
  camara: [
    'Fonte: campo "situacaoItem" da pauta do evento (API de Dados Abertos da Câmara), texto oficial guardado em "desfecho_texto_oficial".',
    'O texto é dividido em frases; vale a última frase que começa com uma destas expressões:',
    '"Matéria não apreciada" → não votado; "Retirado(a) de pauta" ou "Retirado(a) de ofício" → retirado;',
    '"Adiado(a)" → adiado; "Aprovado(a)" → aprovado; "Rejeitado(a)" seguido de "o Projeto", "a Proposta", "a Medida Provisória", "a Matéria" ou "o Projeto de Lei de Conversão" → rejeitado.',
    'Frases sobre destaques, emendas avulsas, pareceres preliminares e requerimentos acessórios não contam; quando o próprio item da pauta é um requerimento, as frases sobre o requerimento contam.',
    'Sem frase desse tipo, ou sessão ainda não realizada: "não informado".',
  ],
  senado: [
    'Fonte: "descricaoDeliberacao" e "textoResultado" do resultado do mês das sessões plenárias (Dados Abertos do Senado) e os indicadores "retirado"/"adiado" da pauta do encontro.',
    '"Retirado" → retirado; "Não apreciado" → não votado;',
    'nos demais casos, a primeira frase depois de "Resultado da matéria:" que começa com "Aprovado(a)" → aprovado, "Rejeitado(a)" → rejeitado, "Retirado(a)" → retirado, "Adiado(a)" → adiado.',
    'Item ausente do resultado do mês: vale a decisão registrada na pauta do encontro ("txtDecisao"), com a mesma regra de palavras (ex.: "Requerimento aprovado." → aprovado), ignorando decisões sobre requerimentos quando o item não é um requerimento.',
    'Resultado só de requerimento acessório (ex.: urgência) não é desfecho da matéria: fica "não informado", com o texto oficial.',
    'Sem resultado na fonte, ou sessão ainda não realizada: "não informado".',
  ],
};

/** Divide o texto em frases (ponto seguido de espaço e letra maiúscula). */
function frases(texto) {
  return String(texto || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.;])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const ACESSORIO = /\b(DTQ|Destaques?|Emendas?(?! (Aglutinativa|Substitutiva) Global)|Parecer|Mantid[oa]|Pedido de vista)\b/i;
const REQUERIMENTO = /\bRequerimentos?\b/i;
const OBJETO_PRINCIPAL_REJEICAO =
  /^Rejeitad[oa]s?(,[^,]{0,40},)? (o Projeto de Lei de Conversão|o Projeto|a Proposta|a Medida Provisória|a Matéria|o Requerimento|os Requerimentos)\b/i;

/**
 * Câmara: desfecho a partir do "situacaoItem" da pauta do evento.
 * itemERequerimento: o documento em pauta é um requerimento (então frases sobre ele contam).
 */
export function desfechoCamara(texto, { itemERequerimento = false, sessaoRealizada = true } = {}) {
  const oficial = texto ? String(texto).replace(/\s+/g, ' ').trim() : null;
  if (!sessaoRealizada || !oficial) return { desfecho: NAO_INFORMADO, desfecho_texto_oficial: oficial };
  let achado = null;
  for (const f of frases(oficial)) {
    const inicio = f.slice(0, 110);
    let cat = null;
    if (/^Matéria não apreciada/i.test(f)) cat = 'não votado';
    else if (/^Retirad[oa]s? de (pauta|ofício)/i.test(f)) cat = 'retirado';
    else if (/^(Aprovad|Rejeitad|Adiad|Retirad)[oa]s?\b/i.test(f)) {
      if (ACESSORIO.test(inicio)) continue;
      if (!itemERequerimento && REQUERIMENTO.test(inicio)) continue;
      if (/^Aprovad/i.test(f)) cat = 'aprovado';
      else if (/^Adiad/i.test(f)) cat = 'adiado';
      else if (/^Rejeitad/i.test(f)) cat = OBJETO_PRINCIPAL_REJEICAO.test(f) ? 'rejeitado' : null;
      else if (/^Retirad/i.test(f)) cat = itemERequerimento && REQUERIMENTO.test(inicio) ? 'retirado' : null;
    }
    if (cat) achado = cat;
  }
  return { desfecho: achado || NAO_INFORMADO, desfecho_texto_oficial: oficial };
}

/**
 * Senado: desfecho a partir do resultado oficial do item (resultado/mes) e dos indicadores da pauta.
 * resultado: { descricaoDeliberacao, indicadorDeliberacao, textoResultado } ou null.
 */
export function desfechoSenado(resultado, { retirado = false, adiado = false, sessaoRealizada = true, decisoesPauta = [], itemERequerimento = false } = {}) {
  const texto = resultado ? String(resultado.textoResultado || '').replace(/\s+/g, ' ').trim() : '';
  const deliberacao = resultado ? (resultado.descricaoDeliberacao || '').trim() : '';
  const oficial = [deliberacao, texto].filter(Boolean).join(' — ') || null;
  if (!sessaoRealizada) return { desfecho: NAO_INFORMADO, desfecho_texto_oficial: oficial };
  if (resultado) {
    if (/^Retirad/i.test(deliberacao)) return { desfecho: 'retirado', desfecho_texto_oficial: oficial };
    if (/^Não apreciad/i.test(deliberacao)) return { desfecho: 'não votado', desfecho_texto_oficial: oficial };
    const m = /Resultado da matéria:\s*([^.]*)/i.exec(texto);
    if (m) {
      const f = m[1].trim();
      if (/^Aprovad[oa]s?\b/i.test(f)) return { desfecho: 'aprovado', desfecho_texto_oficial: oficial };
      if (/^Rejeitad[oa]s?\b/i.test(f)) return { desfecho: 'rejeitado', desfecho_texto_oficial: oficial };
      if (/^Retirad[oa]s?\b/i.test(f)) return { desfecho: 'retirado', desfecho_texto_oficial: oficial };
      if (/^Adiad[oa]s?\b/i.test(f)) return { desfecho: 'adiado', desfecho_texto_oficial: oficial };
    }
    return { desfecho: NAO_INFORMADO, desfecho_texto_oficial: oficial };
  }
  return desfechoPelaPauta(decisoesPauta, { retirado, adiado, itemERequerimento });
}

const CATEGORIA_VERBO = { aprovad: 'aprovado', rejeitad: 'rejeitado', retirad: 'retirado', adiad: 'adiado' };
const VERBO_INICIAL = /^(?:\p{L}+ )?(aprovad|rejeitad|retirad|adiad)[oa]s?(?![\p{L}])/iu;

function desfechoPelaPauta(decisoesPauta, { retirado, adiado, itemERequerimento }) {
  const decisoes = decisoesPauta.map((d) => String(d || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (decisoes.length) {
    const oficialPauta = decisoes.join(' — ');
    let cat = null;
    for (const d of decisoes) {
      if (!itemERequerimento && REQUERIMENTO.test(d)) continue;
      const w = VERBO_INICIAL.exec(d.split(/(?<=\.)\s/)[0]);
      if (w) cat = CATEGORIA_VERBO[w[1].toLowerCase()];
    }
    if (cat) return { desfecho: cat, desfecho_texto_oficial: oficialPauta };
    if (!retirado && !adiado) return { desfecho: NAO_INFORMADO, desfecho_texto_oficial: oficialPauta };
  }
  if (retirado) return { desfecho: 'retirado', desfecho_texto_oficial: 'Item marcado como retirado na pauta oficial do encontro.' };
  if (adiado) return { desfecho: 'adiado', desfecho_texto_oficial: 'Item marcado como adiado na pauta oficial do encontro.' };
  return { desfecho: NAO_INFORMADO, desfecho_texto_oficial: null };
}
