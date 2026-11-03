// Apoio do verificador: siglas por extenso, quórum qualificado e vetos dos analistas de viés
// (dados/titulos/revisao/*.json, duas rodadas; pasta somente leitura). As regras de manchete de agência
// (termos ausentes, comparativos, escopo) saíram junto com as manchetes: o título agora é o oficial ou um
// modelo fixo de campos estruturados.
import path from 'node:path';
import { DADOS, lerJson } from './lib.mjs';

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

/**
 * Vetos dos analistas: Map "secao|id" → [vieses]. Lê as duas rodadas (revisao/<vies>.json e
 * revisao/<vies>-2.json). Item vetado em qualquer rodada fica com o título oficial.
 */
export function carregarVetos() {
  const vetos = new Map();
  for (const vies of ['esquerda', 'centro', 'direita']) {
    for (const arq of [`${vies}.json`, `${vies}-2.json`]) {
      const j = lerJson(path.join(DADOS, 'titulos', 'revisao', arq));
      for (const x of j?.itens || []) {
        if (x.decisao !== 'vetar' && x.veto !== true) continue;
        const k = `${x.secao}|${x.id}`;
        if (!vetos.has(k)) vetos.set(k, []);
        const v = j.vies || vies;
        if (!vetos.get(k).includes(v)) vetos.get(k).push(v);
      }
    }
  }
  return vetos;
}
