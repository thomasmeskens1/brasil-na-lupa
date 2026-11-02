// Regras de conteúdo vindas da revisão de viés (dados/titulos/revisao/*.json, campo "padroes"):
// todo termo de conteúdo de uma manchete precisa existir no texto oficial do item; comparativos e
// promessas de efeito só passam se literais na ementa; escopo (quem e o quê) não pode mudar; siglas de
// teses precisam estar por extenso.
import path from 'node:path';
import { DADOS, lerJson } from './lib.mjs';

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Palavras gramaticais e do molde fixo (quem decidiu, tipo de proposição, verbo do resultado, etapa).
const VAZIAS = new Set(`a o as os e ou de da do das dos em no na nos nas num numa ao aos à às para pra por pelo pela pelos pelas com sem que se
sobre entre ate até um uma uns umas seu sua seus suas sua este esta esse essa isso como quando onde qual quais ja já nao não tambem também
camara câmara senado deputados deputadas senadores senadoras plenario plenário congresso comissao comissão assembleia
aprova aprovam aprovada aprovado rejeita rejeitam rejeitada rejeitado conclui concluem votacao votação
projeto projetos proposta propostas pec mp mps medida medidas provisoria provisória lei leis nova novo novas novos complementar
sancionada sancionado promulgada promulgado publicada publicado texto base texto-base principal turno turnos dois 1º 2º primeiro segundo
segue seguem vai vao vão volta sancao sanção analise análise agora`.split(/\s+/).map(semAcento));

/** Radical simples (normalização sem acento, sem sufixos comuns, até 5 letras) para comparar termos. */
export function radical(palavra) {
  let w = semAcento(palavra).replace(/[^a-z0-9-]/g, '');
  if (/^\d/.test(w)) return w;
  for (const suf of ['coes', 'cao', 'mente', 'idades', 'idade', 'ivas', 'ivos', 'iva', 'ivo', 'ados', 'adas', 'ado', 'ada', 'idos', 'idas', 'ido', 'ida',
    'ores', 'oras', 'ora', 'or', 'ais', 'eis', 'ar', 'er', 'ir', 'am', 'em', 'as', 'es', 'os', 's', 'a', 'e', 'o']) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) { w = w.slice(0, -suf.length); break; }
  }
  return w.slice(0, 5);
}
const termos = (t) => semAcento(t).split(/[^a-z0-9º-]+/).filter(Boolean);

/** Termos de conteúdo do título que não aparecem (por radical) em nenhum texto oficial do item. */
export function termosAusentes(titulo, textosOficiais) {
  const oficiais = new Set();
  for (const t of textosOficiais) for (const w of termos(t)) oficiais.add(radical(w));
  return termos(titulo).filter((w) => !VAZIAS.has(w) && !/^\d/.test(w) && w.length > 1).filter((w) => !oficiais.has(radical(w)));
}

/** Comparativos, intensificadores e promessas de efeito: só passam se literais (radical) no texto oficial. */
const ALERTA = /(^|[^\p{L}])(mais|menos|r[íi]gid\p{L}*|endurec\p{L}*|facilit\p{L}*|ampli\p{L}*|socorr\p{L}*|flexibiliz\p{L}*|refor[çc]\p{L}*|fortalec\p{L}*|simplific\p{L}*|agiliz\p{L}*|desburocratiz\p{L}*|melhor\p{L}*|pior\p{L}*|barate\p{L}*|encarec\p{L}*|acelera\p{L}*|turbin\p{L}*|destrav\p{L}*|alivi\p{L}*|protege\p{L}*|combate\p{L}*)(?![\p{L}])/giu;
export function alertasNaoLiterais(titulo, textosOficiais) {
  const oficial = semAcento(textosOficiais.join(' '));
  const achados = [];
  for (const m of String(titulo).matchAll(ALERTA)) {
    const w = semAcento(m[2]);
    const lit = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(oficial);
    if (!lit) achados.push(m[2]);
  }
  return achados;
}

/** Marcadores de escopo: se a ementa restringe (federal, da União, municipal…), o título tem de manter. */
const ESCOPO = [
  ['federal', /\b(federa(l|is)|da uniao|administracao publica federal)\b/],
  ['estadual', /\b(estadua(l|is)|do estado)\b/],
  ['municipal', /\b(municipa(l|is)|do municipio)\b/],
];
export function escopoPerdido(titulo, ementa) {
  const t = semAcento(titulo), e = semAcento(ementa);
  return ESCOPO.filter(([, re]) => re.test(e) && !re.test(t)).map(([n]) => n);
}

/** Siglas aceitas sem extenso no título: as do glossário oficial do site e as de nome popular. */
let SIGLAS = null;
function siglasAceitas() {
  if (SIGLAS) return SIGLAS;
  SIGLAS = new Set(['STF', 'STJ', 'TCU', 'ICMS', 'IBS', 'CBS', 'INSS', 'SUS', 'FGTS', 'CONFAZ', 'ALESP', 'IPI', 'IPVA', 'IPTU', 'ISS', 'II', 'III', 'IV', 'VI']);
  for (const g of lerJson(path.join(DADOS, 'icms/glossario.json'))?.itens || []) if (g.sigla) SIGLAS.add(g.sigla);
  return SIGLAS;
}
/** Siglas do título sem forma extensa no próprio título ("Nome (SIGLA)" ou "Nome - SIGLA"). */
export function siglasSemExtenso(titulo) {
  const s = String(titulo);
  return [...new Set((s.match(/\b\p{Lu}{2,}[\p{Lu}\d-]*\b/gu) || []))]
    .filter((x) => !siglasAceitas().has(x))
    .filter((x) => !new RegExp(`(\\(|[-–]\\s)${x.replace(/[-]/g, '\\-')}\\b`).test(s));
}

/** Quórum de aprovação por espécie e Casa (Constituição: art. 69 lei complementar; art. 60, § 2º emenda). */
export function quorum(casa, sigla) {
  const q = { camara: { PLP: 257, PEC: 308 }, senado: { PLP: 41, PEC: 49 } };
  return q[casa]?.[sigla] ?? null;
}

/** Vetos dos analistas: Map "secao|id" → [vieses]. Lê dados/titulos/revisao/*.json (somente leitura). */
export function carregarVetos() {
  const vetos = new Map();
  for (const vies of ['esquerda', 'centro', 'direita']) {
    const j = lerJson(path.join(DADOS, 'titulos', 'revisao', `${vies}.json`));
    for (const x of j?.itens || []) {
      if (x.decisao !== 'vetar' && x.veto !== true) continue;
      const k = `${x.secao}|${x.id}`;
      if (!vetos.has(k)) vetos.set(k, []);
      vetos.get(k).push(j.vies || vies);
    }
  }
  return vetos;
}
