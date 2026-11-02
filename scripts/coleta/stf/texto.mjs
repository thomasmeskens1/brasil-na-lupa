// Leitura do texto oficial da decisão (campo "acordao_ata" do acórdão publicado).
// Tudo o que sai daqui é COPIADO do texto: resultado só quando aparecem as palavras "por unanimidade" ou
// "por maioria"; nomes de vencidos, ausentes e impedidos só como escritos após "Ministro(s)/Ministra(s)".
// Nada é calculado (ex.: nunca "11 − vencidos") e nada é completado por dedução.
import { normalizarEspacos, dataISO } from './lib.mjs';

/** Último parágrafo de decisão do texto da ata (o julgamento final). */
export function paragrafoFinal(ata) {
  if (!ata) return null;
  const pars = String(ata).split(/\r?\n/).map(normalizarEspacos).filter(Boolean);
  const candidatos = pars.filter((p) => /^Decisão:|por unanimidade|por maioria|^O Tribunal|^A Turma/i.test(p));
  return candidatos.length ? candidatos[candidatos.length - 1] : (pars.length ? pars.join(' ') : null);
}

/** Ambiente e datas da sessão, como escritos no fim do texto da decisão. */
export function sessaoDoTexto(texto) {
  if (!texto) return { ambiente: null, inicio: null, fim: null, trecho: null };
  const v = texto.match(/Sess[aã]o Virtual(?: Extraordin[aá]ria)? de (\d{1,2}\.\d{1,2}\.\d{4})(?: \([^)]*\))? a (\d{1,2}\.\d{1,2}\.\d{4})(?: \([^)]*\))?/i);
  if (v) return { ambiente: 'virtual', inicio: dataISO(v[1]), fim: dataISO(v[2]), trecho: v[0] };
  const p = texto.match(/(Plen[aá]rio|(?:Primeira|Segunda) Turma),\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
  if (p) return { ambiente: 'presencial', inicio: dataISO(p[2]), fim: dataISO(p[2]), trecho: p[0] };
  return { ambiente: null, inicio: null, fim: null, trecho: null };
}

const ABREV = new Set(['min', 'art', 'arts', 'n', 'nº', 'inc', 'dr', 'dra', 'sr', 'sra', 'fl', 'fls', 'p', 'al', 'rel', 'proc', 'c', 'cc', 'exmo', 'exma', 'ed', 'agr', 'rg', 'ss']);
/** Posições de início das frases (". " seguido de maiúscula, exceto após abreviação). */
function iniciosDeFrase(t) {
  const ini = [0];
  const citacoes = [...t.matchAll(/“[^”]*”/g)].map((m) => [m.index, m.index + m[0].length]);
  for (const m of t.matchAll(/([\p{L}\dº]+)?\.\s+(?=[“"(]?[A-ZÀ-Ý])/gu)) {
    const palavra = (m[1] || '').toLowerCase();
    if (ABREV.has(palavra)) continue;
    if (citacoes.some(([a, b]) => m.index > a && m.index < b)) continue; // ponto dentro de texto citado
    ini.push(m.index + m[0].length);
  }
  return ini;
}
const inicioDaFrase = (ini, pos) => ini.filter((x) => x <= pos).pop() ?? 0;
const fimDaFrase = (t, ini, pos) => { const p = ini.find((x) => x > pos); return p === undefined ? t.length : p; };
/** Remove trechos entre aspas (texto de tese citado) antes de procurar palavras-chave. */
const semCitacoes = (s) => s.replace(/“[^”]*”/g, '“…”').replace(/"[^"]*"/g, '"…"');

const PAPEIS = new Set(['Relator', 'Relatora', 'Presidente', 'Revisor', 'Revisora', 'Redator', 'Redatora']);
const CONECTORES = new Set(['de', 'da', 'do', 'dos', 'das', "d'"]);
/** Nomes escritos logo após "Ministro(s)/Ministra(s)" a partir de pos, até o fim do trecho. */
function nomesApos(trecho) {
  const nomes = [], papeis = [];
  for (const m of trecho.matchAll(/\bMinistr[oa]s?\s+/g)) {
    let resto = trecho.slice(m.index + m[0].length);
    for (;;) {
      const tokens = [];
      let r = resto;
      for (;;) {
        const tk = r.match(/^([\p{Lu}][\p{L}'’-]*|de|da|do|dos|das)(?=[\s,.;:)]|$)/u);
        if (!tk) break;
        if (!tokens.length && CONECTORES.has(tk[1])) break;
        tokens.push(tk[1]);
        r = r.slice(tk[0].length);
        const esp = r.match(/^ (?=[\p{Lu}]|de |da |do |dos |das )/u);
        if (!esp) break;
        r = r.slice(1);
      }
      while (tokens.length && CONECTORES.has(tokens[tokens.length - 1])) tokens.pop();
      if (!tokens.length) break;
      const nome = tokens.join(' ');
      if (PAPEIS.has(nome)) papeis.push(nome); else nomes.push(nome);
      resto = r.replace(/^\s*\([^)]*\)/, '');
      const sep = resto.match(/^(,\s+e\s+|\s+e\s+|,\s+)(?=[\p{Lu}])/u);
      if (!sep) break;
      resto = resto.slice(sep[0].length);
    }
  }
  return { nomes, papeis };
}

/** Trechos (até o fim da frase) que começam por um padrão, e os nomes de ministros neles. */
function clausulas(t, ini, re) {
  const out = [];
  for (const m of t.matchAll(re)) {
    const fim = fimDaFrase(t, ini, m.index);
    const trecho = normalizarEspacos(t.slice(m.index, fim));
    const { nomes, papeis } = nomesApos(trecho);
    out.push({ trecho, nomes, papeis });
  }
  return out;
}

/** Partes nomeadas no próprio trecho. "embargos" prevalece (é o objeto do julgamento); várias partes → null. */
function parteDoTrecho(frase) {
  const s = semCitacoes(frase);
  if (/embargos|declaratórios/i.test(s)) return { parte: 'embargos', citadas: ['embargos'] };
  const c = [];
  if (/modul|efeitos prospectivos|efeitos ex nunc|efeitos tempor/i.test(s)) c.push('modulação');
  if (/reafirmou|julgou|julgar|provimento|procedente|improcedente|declarou|declarar|referendou/i.test(s)) c.push('mérito');
  if (/existência de repercussão geral|repercussão geral da questão|inexistência de repercussão geral|constitucional a questão/i.test(s)) c.push('preliminar');
  if (!c.includes('mérito') && /\btese\b/i.test(s)) c.push('tese');
  return { parte: c.length === 1 ? c[0] : null, citadas: c };
}

/**
 * Partes da decisão: um item para cada "por unanimidade"/"por maioria" do texto, com o trecho literal,
 * a parte (palavra-chave no próprio trecho; null quando o trecho não diz) e os vencidos escritos no trecho.
 */
export function partesDaDecisao(texto) {
  if (!texto) return [];
  const t = normalizarEspacos(texto);
  const ini = iniciosDeFrase(t);
  const ocorr = [...t.matchAll(/por (unanimidade|maioria)/gi)];
  const bordas = ocorr.map((m, k) => {
    const s = inicioDaFrase(ini, m.index);
    return k > 0 && s <= ocorr[k - 1].index ? m.index : s;
  });
  return ocorr.map((m, k) => {
    const a = bordas[k], b = k + 1 < bordas.length ? bordas[k + 1] : t.length;
    const segmento = t.slice(a, b).trim();
    const frase = t.slice(a, fimDaFrase(t, ini, m.index));
    const iniSeg = iniciosDeFrase(segmento);
    const venc = clausulas(segmento, iniSeg, /(?:parcialmente\s+)?vencid[oa]s?\b/gi);
    const pt = parteDoTrecho(frase);
    return {
      parte: pt.parte,
      partes_citadas: pt.citadas.length > 1 ? pt.citadas : undefined,
      resultado: m[1].toLowerCase(),
      trecho: segmento,
      vencidos: [...new Set(venc.flatMap((v) => v.nomes))],
      vencidos_trechos: venc.map((v) => v.trecho),
      vencidos_so_cargo: venc.flatMap((v) => v.papeis),
    };
  });
}

/** Ausentes, impedidos, suspeitos e presidência, como escritos no texto. */
export function participacao(texto) {
  const t = normalizarEspacos(texto || '');
  const ini = iniciosDeFrase(t);
  const pega = (re) => { const c = clausulas(t, ini, re); return { nomes: [...new Set(c.flatMap((x) => x.nomes))], trechos: c.map((x) => x.trecho) }; };
  const pres = t.match(/Presidência d[oa] Ministr[oa] ([\p{Lu}][\p{L}' -]+?)(?=[.,;(]|$)/u);
  return {
    ausentes: pega(/\bAusentes?\b|\bausentes?,/g),
    impedidos: pega(/\bImpedid[oa]s?\b|\bimpedid[oa]s?\s+(?:o|a|os|as)\s+Ministr/g),
    suspeitos: pega(/\bSuspeit[oa]s?\b|\bsuspeição\b|\bSuspeição\b/g),
    nao_participaram: pega(/\bNão (?:participou|participaram|votou|votaram|se manifest(?:ou|aram))\b/g),
    presidente: pres ? normalizarEspacos(pres[1]) : null,
  };
}

/** Trecho literal "Redigirá o acórdão…" ou "(Redator para o acórdão)", quando houver. */
export function redatorNoTexto(texto) {
  const t = normalizarEspacos(texto || '');
  const a = t.match(/Ministr[oa] ([\p{Lu}][\p{L}' ]+?) \(Redator(?:a)? (?:para|do) o acórdão[^)]*\)/u);
  if (a) return a[1];
  const b = t.match(/Redigirá o acórdão (?:o|a) Ministr[oa] ([\p{Lu}][\p{L}' ]+?)(?=[.,;(]|$)/u);
  if (b && !PAPEIS.has(b[1])) return b[1];
  return null;
}
