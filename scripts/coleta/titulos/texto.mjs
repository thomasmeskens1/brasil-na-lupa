// Recortes literais de textos oficiais. Nada aqui reescreve o sentido: só (1) troca a inicial
// maiúscula do verbo da ementa por minúscula, (2) remove fórmulas finais vazias ("e dá outras
// providências") e (3) corta o texto numa fronteira de oração, sempre do início para o fim.

export const limpar = (s) => String(s ?? '').replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();

/** Nome por extenso das siglas de proposição (diretriz 9). */
export const NOME_EXTENSO = {
  PL: 'Projeto de Lei', PLP: 'Projeto de Lei Complementar', PEC: 'Proposta de Emenda à Constituição',
  MPV: 'Medida Provisória', PDL: 'Projeto de Decreto Legislativo', PDC: 'Projeto de Decreto Legislativo',
  PRC: 'Projeto de Resolução', PR: 'Projeto de Resolução', REQ: 'Requerimento', RQS: 'Requerimento',
  MSC: 'Mensagem', MSF: 'Mensagem', OFS: 'Ofício', PLV: 'Projeto de Lei de Conversão',
  PLN: 'Projeto de Lei do Congresso Nacional', REC: 'Recurso', REP: 'Representação',
  REL: 'Relatório', OBJ: 'Objeto', SAP: 'Sugestão',
};
/** Nome comum usado no título (com gênero, para os artigos). */
const NOME_CURTO = {
  PL: ['projeto', 'm'], PLN: ['projeto', 'm'], PLV: ['projeto de lei de conversão', 'm'],
  PLP: ['projeto', 'm'], PEC: ['proposta', 'f'],
  MPV: ['medida provisória', 'f'], PDL: ['projeto', 'm'], PDC: ['projeto', 'm'],
  PRC: ['projeto', 'm'], PR: ['projeto', 'm'], REQ: ['requerimento', 'm'], RQS: ['requerimento', 'm'],
  MSC: ['mensagem', 'f'], MSF: ['mensagem', 'f'], OFS: ['ofício', 'm'], REC: ['recurso', 'm'],
};
export function nomeCurto(sigla, casa) {
  if (casa === 'alesp' && sigla === 'PLC') return { nome: 'projeto', g: 'm' };
  const [nome, g] = NOME_CURTO[sigla] || ['proposição', 'f'];
  return { nome, g };
}
export function nomeOficial(sigla, numero, ano, casa) {
  let n = NOME_EXTENSO[sigla] || sigla;
  if (casa === 'alesp' && sigla === 'PLC') n = 'Projeto de Lei Complementar';
  if (!n) return null;
  return `${n} ${numero}/${ano}`;
}
export const art = { de: { m: 'do', f: 'da' }, a: { m: 'ao', f: 'à' }, o: { m: 'o', f: 'a' } };

/** Verbos que abrem ementas (forma literal da 3ª pessoa). Lista fechada, vinda das próprias ementas. */
export const VERBOS_EMENTA = [
  'dispõe', 'altera', 'institui', 'declara', 'autoriza', 'denomina', 'estabelece', 'aprova', 'acrescenta', 'cria',
  'regulamenta', 'abre', 'torna', 'classifica', 'homologa', 'inclui', 'renova', 'proíbe', 'promulga', 'transfere',
  'reconhece', 'revoga', 'obriga', 'assegura', 'introduz', 'determina', 'susta', 'veda', 'concede', 'nomeia',
  'garante', 'fixa', 'isenta', 'disciplina', 'aumenta', 'amplia', 'oficializa', 'confere', 'transforma', 'prorroga',
  'ratifica', 'modifica', 'reestrutura', 'outorga', 'inscreve', 'tipifica', 'define', 'acresce', 'atualiza', 'delega',
  'eleva', 'distribui', 'remaneja', 'permite', 'insere', 'majora', 'regula', 'referenda', 'limita', 'estende',
  'revaloriza', 'extingue', 'reorganiza', 'reduz', 'promove', 'desobriga', 'retira', 'aperfeiçoa', 'escolhe',
  'considera', 'restringe', 'dispensa', 'substitui', 'suprime', 'trata', 'viabiliza', 'estima', 'reclassifica',
  'reabre', 'unifica', 'regulariza', 'vincula', 'incentiva', 'suspende', 'decreta', 'reserva', 'moderniza',
  'reavalia', 'integra', 'convoca', 'incorpora', 'destina', 'qualifica', 'dá', 'orça', 'requer', 'solicita', 'submete', 'encaminha',
];
const FIM_PALAVRA = '(?![\\p{L}])'; // \b do JavaScript não reconhece letras acentuadas ("dá")
const RE_E_VERBO = new RegExp(` e (?=(${VERBOS_EMENTA.join('|')})${FIM_PALAVRA})`, 'iu');
const RE_VERBO_INICIAL = new RegExp(`^(${VERBOS_EMENTA.join('|')})${FIM_PALAVRA}`, 'iu');
const VERBOS_ALTERACAO = /^(altera|acrescenta|acresce|modifica|insere|inclui|revoga)\b/iu;

/** Remove fórmulas finais sem conteúdo e o ponto final. */
export function semFormulaFinal(s) {
  return limpar(s)
    .replace(/\.?\s*\((de )?autoria[^)]*\)\.?$/iu, '')
    .replace(/[,;]?\s*e d[áa] outras provid[êe]ncias\.?$/iu, '')
    .replace(/[,;]?\s*e d[áa] provid[êe]ncias correlatas\.?$/iu, '')
    .replace(/[,;]?\s*e d[áa] (outras )?provid[êe]ncias\.?$/iu, '')
    .replace(/[,;]?\s*para os fins que especifica\.?$/iu, '')
    .replace(/[.;,]\s*$/, '')
    .trim();
}

// Conectores que abrem nova oração depois de vírgula. Cortar antes deles mantém a oração principal.
const CONECTORES_CORTE = [
  'para', 'que', 'a fim de', 'e', 'bem como', 'nos termos', 'com', 'destinad[ao]s?', 'visando', 'mediante',
  'conforme', 'de modo', 'de forma', 'no âmbito', 'em razão', 'na forma', 'por meio', 'com vistas', 'observad[ao]s?', 'na vaga', 'em vaga', 'decorrente', 'a partir de', 'em substituição', 'para (o )?mandato', 'com mandato', 'cumulativamente',
];
const RE_CONECTOR = new RegExp(`^(${CONECTORES_CORTE.join('|')})${FIM_PALAVRA}`, 'iu');
// Conectores de exceção/condição: o que vem depois deles não pode ser descartado (mudaria o sentido).
const RESSALVAS = /^(salvo|exceto|desde que|ressalvad|a menos que|se |quando |caso |sem prejuízo|ainda que|mesmo que|não se aplica|contudo|todavia|porém|mas |apenas|somente|unicamente|inclusive|excluíd|vedad|sendo vedad|sob pena|independentemente|ou |nem )/iu;
// Começos de oração subordinada: um prefixo que começa assim não é oração completa.
export const SUBORDINADA_INICIAL = /^(desde que|se |quando |caso |nos casos|na hipótese|em se tratando|ainda que|embora|para fins|para efeito|a partir d|até |nas ações|nos processos|uma vez|havendo|tratando-se|sendo |no caso|nas hipóteses|para os fins|à luz|considerando|ressalvad)/iu;

/**
 * Pontos de corte (índices) em fronteira de oração: ";", ". " e vírgula seguida de conector.
 * estrito=true (teses e questões): só ";" e ". " (fim de período), e nunca antes de ressalva.
 */
function pontosDeCorte(s, estrito) {
  const pontos = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== ';' && c !== ',' && c !== '.') continue;
    if (c === '.' && !(s[i + 1] === ' ' && /\p{Lu}/u.test(s[i + 2] || ''))) continue; // "nº 9.605" e "art. 5º" não cortam
    if (c === '.' && /\b(art|arts|inc|n|nº|al|p|§|Lei|Dec|cf)$/iu.test(s.slice(Math.max(0, i - 5), i))) continue;
    if (c === '.' && /(^|[^\p{L}])\p{Lu}\p{Ll}{0,3}$/u.test(s.slice(Math.max(0, i - 6), i))) continue; // "Rod.", "Dr.", "Av.", iniciais
    if (c === '.' && /(^|[^\p{L}])(\p{Lu}|Dr|Dra|Drs|Prof|Profa|Sr|Sra|Srs|Pe|Gal|Cel|Ten|Cap|Maj|Sgt|Eng|Sto|Sta|St|Av|Jd|Pq|Vl|Ltda|S\.A|Cia|Ind|Com)$/u.test(s.slice(Math.max(0, i - 6), i))) continue; // abreviações e iniciais
    const resto = s.slice(i + 1).trimStart();
    if (estrito) {
      if (RESSALVAS.test(resto)) continue;
      if (c === ',') continue; // teses e questões: só fim de período (". ") ou ponto e vírgula
    } else if (c === ',') {
      if (!RE_CONECTOR.test(resto)) continue;
      if (RESSALVAS.test(resto)) continue;
    } else if (RESSALVAS.test(resto)) continue;
    pontos.push(i);
  }
  // " e " + verbo de ementa também separa orações ("Institui X e altera Y"); " e, cumulativamente," idem.
  if (!estrito) {
    for (const m of s.matchAll(/ e, /g)) pontos.push(m.index);
    const re = new RegExp(RE_E_VERBO.source, 'giu');
    let m; while ((m = re.exec(s))) pontos.push(m.index);
  }
  return [...new Set(pontos)].sort((a, b) => a - b);
}

/** Maior prefixo de s, terminado em fronteira de oração, com até max caracteres. null se não houver. */
export function cortarEmOracao(s, max, { estrito = false, minimo = 12 } = {}) {
  s = limpar(s).replace(/[.;,]\s*$/, '');
  if (s.length <= max) return s;
  let melhor = null;
  for (const p of pontosDeCorte(s, estrito)) {
    const pre = s.slice(0, p).trim().replace(/[,;:]$/, '');
    if (pre.length > max) break;
    if (pre.length >= Math.max(minimo, 30) && pre.split(' ').length >= 5 && !/(^|[^\p{L}])(de|da|do|das|dos|a|o|e|em|no|na|nº|n\.º|ao|à|com|para|por|que|sobre)$/iu.test(pre)) melhor = pre;
  }
  return melhor;
}

// Verbo inicial em minúscula (inclusive quando a fonte o escreve todo em caixa alta: "NOMEIA").
const minuscula = (s) => s.replace(/^(\p{Lu}+)(?![\p{Ll}])/u, (w) => w.toLocaleLowerCase('pt-BR')).replace(/^\p{Lu}/u, (c) => c.toLocaleLowerCase('pt-BR'));

/**
 * Trecho literal da ementa para compor "<sujeito> <trecho>": começa no verbo da ementa, em minúscula.
 * Se a ementa só altera uma norma e diz "para X", o trecho vira "altera lei para X" (substituição fixa
 * da referência numérica pela palavra "lei"/"leis"/"a Constituição", documentada na Metodologia).
 * Retorna { texto, completo } ou null.
 */
export function trechoDaEmenta(ementa, max) {
  const e = semFormulaFinal(ementa);
  if (!e || !RE_VERBO_INICIAL.test(e)) return null;
  const inteiro = minuscula(e);
  const m = VERBOS_ALTERACAO.exec(e);
  if (m) {
    // Regra da revisão de viés: nunca "altera a Lei nº X" sozinho — só com a oração de finalidade.
    const idx = e.search(/,?\s+(para|a fim de)\s+(?!o\s+exercício)/iu);
    if (idx < 0) return null;
    if (inteiro.length <= max) return { texto: inteiro, completo: true };
    const ref = e.slice(0, idx);
    const alvo = /Constitui[çc][ãa]o/iu.test(ref) ? 'a Constituição'
      : /\bLeis\b|Leis n|e a Lei|, a Lei/iu.test(ref) ? 'leis'
        : /\bLei\b|Decreto-Lei|C[óo]digo/iu.test(ref) ? 'lei'
          : /\bDecreto\b/iu.test(ref) ? 'decreto' : /Regimento/iu.test(ref) ? 'o Regimento Interno' : null;
    if (!alvo) return null;
    const verbo = minuscula(m[1]);
    const para = e.slice(idx).replace(/^,?\s+/, '');
    const corpo = cortarEmOracao(para, max - verbo.length - alvo.length - 2, { minimo: 8 });
    return corpo ? { texto: `${verbo} ${alvo} ${corpo}`, completo: corpo === limpar(para), substituicao: true } : null;
  }
  if (inteiro.length <= max) return { texto: inteiro, completo: true };
  const cortado = cortarEmOracao(inteiro, max);
  return cortado ? { texto: cortado, completo: false } : null;
}

/**
 * Crédito orçamentário (regra da revisão de viés): verbo "abre" + valor oficial + destinatário.
 * Só recompõe peças literais da ementa ("crédito extraordinário", "R$ …", "em favor do …").
 */
export function trechoCredito(ementa, max) {
  const e = semFormulaFinal(ementa);
  const t = /^(?:abre|dispõe sobre a abertura de)\s+(?:um\s+|aos?\s+[^,]{0,60}?\s+)?(crédito\s+(?:adicional\s+)?(?:extraordinário|suplementar|especial))/iu.exec(e);
  if (!t) return null;
  const valor = /R\$\s?[\d.]+,\d{2}/u.exec(e);
  if (!valor) return null;
  const base = `abre ${t[1].toLocaleLowerCase('pt-BR')} de ${valor[0].replace(/R\$\s?/, 'R$ ')}`;
  const favor = /\b(em favor d[oae]s?\s[^,;(]+?|ao Orçamento [^,;(]+?)(?=,|;|\(|\s+no valor|\s+para|$)/iu.exec(e);
  if (favor && base.length + favor[1].length + 1 <= max) return `${base} ${favor[1]}`;
  return base.length <= max ? base : null;
}

/** "para exercer o cargo…" / "para compor…" das mensagens de indicação de autoridade (sem o nome). */
export function trechoIndicacao(ementa, max) {
  const e = semFormulaFinal(ementa);
  const m = /\bpara (exercer o cargo|o cargo|compor|integrar|ocupar|exercer a função|exercer as funções)\b/iu.exec(e);
  if (!m) return null;
  const t = e.slice(m.index);
  return cortarEmOracao(t, max, { minimo: 10 });
}

/** Tokens numéricos normalizados de um texto ("15.322" → "15322"; "1,47"; datas dd/mm/aaaa → ISO). */
export function numerosDe(texto) {
  const s = String(texto ?? '');
  const out = new Set();
  for (const m of s.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) out.add(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  const semDatas = s.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, ' ');
  for (const m of semDatas.matchAll(/\d[\d.]*(,\d+)?/g)) {
    let n = m[0].replace(/\.$/, '');
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(n)) n = n.replace(/\./g, '');
    out.add(n);
    if (n.includes('/')) for (const p of n.split('/')) out.add(p);
  }
  for (const m of semDatas.matchAll(/(\d+)\/(\d+)/g)) { out.add(m[1]); out.add(m[2]); }
  return out;
}
/** Universo de números de um item oficial: todos os textos e números + formatos de data. */
export function universoNumerico(valores) {
  const u = new Set();
  const ord = { primeiro: '1', segundo: '2', terceiro: '3', 'único': '1' };
  const visitar = (v) => {
    if (v == null) return;
    if (typeof v === 'number') { u.add(String(v)); u.add(String(v).replace('.', ',')); return; }
    if (typeof v === 'string') {
      for (const n of numerosDe(v)) u.add(n);
      for (const m of v.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) {
        u.add(`${m[1]}-${m[2]}-${m[3]}`); u.add(m[1]); u.add(String(Number(m[3]))); u.add(m[3]); u.add(String(Number(m[2])));
      }
      for (const m of v.matchAll(/(\d+)\s*º/g)) u.add(m[1]);
      for (const [p, n] of Object.entries(ord)) if (new RegExp(`\\b${p}\\b`, 'iu').test(v)) u.add(n);
      return;
    }
    if (Array.isArray(v)) { v.forEach(visitar); return; }
    if (typeof v === 'object') Object.values(v).forEach(visitar);
  };
  visitar(valores);
  return u;
}
