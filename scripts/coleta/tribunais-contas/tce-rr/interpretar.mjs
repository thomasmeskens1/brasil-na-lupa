// Interpretação dos campos literais lidos por extrair.mjs: exercício, ente (Governo do Estado ou município),
// tipo de contas e a fórmula da conclusão. Só fórmulas escritas no texto são reconhecidas; havendo duas
// leituras diferentes (ementa × dispositivo, assunto × ementa), o campo fica null e a divergência vira lacuna.
import { normalizar, dataBR } from './lib.mjs';
import { dataPorExtenso } from './extrair.mjs';

/** Minúsculas sem acento, com o mesmo comprimento do original (para recortar o trecho literal). */
function dobrar(s) {
  return [...String(s)].map((c) => {
    const b = c.normalize('NFD')[0].toLowerCase();
    return b.length === 1 ? b : c;
  }).join('');
}

/* ---------- Exercício ---------- */

const RE_EXERCICIO = /exerc[ií]cios?(?:\s+financeiros?)?(?:\s+(?:de|do ano(?: de)?))?\s*[:-]?\s*((?:19|20)\d{2})\b/gi;

function anosEm(texto) {
  return [...String(texto || '').matchAll(RE_EXERCICIO)].map((m) => Number(m[1]));
}

/**
 * Exercício das contas, pela ordem: assunto ("exercício 2021" ou "Prestação de Contas … – 2004"), órgão
 * ("… – Exercício 2019") e ementa ("EXERCÍCIO DE 2017"). Vale a primeira fonte que traga um único ano; se ela
 * trouxer mais de um ano, o exercício fica null. Ano diferente nas fontes seguintes é registrado como divergência.
 */
export function exercicioDe(p) {
  const doAssunto = anosEm(p.assunto);
  if (!doAssunto.length) {
    const m = String(p.assunto || '').match(/^(?:[IVX]+\s*[-–:]\s*)?(?:Presta[çc][ãa]o|Tomada) de Contas\b[^\d]{0,80}[-–]\s*((?:19|20)\d{2})\s*\.?$/i);
    if (m) doAssunto.push(Number(m[1]));
  }
  const fontes = [['assunto', doAssunto], ['órgão', anosEm(p.orgao)], ['ementa', anosEm(p.ementa)]]
    .map(([k, a]) => [k, [...new Set(a)]])
    .filter(([, a]) => a.length);
  if (!fontes.length) return { exercicio: null, exercicio_fonte: null, divergencia: null };
  const [fonte, anos] = fontes[0];
  if (anos.length > 1) return { exercicio: null, exercicio_fonte: null, divergencia: `${fonte}: ${anos.join(', ')}` };
  const outros = fontes.slice(1).filter(([, a]) => !a.includes(anos[0]));
  return {
    exercicio: anos[0],
    exercicio_fonte: fonte,
    divergencia: outros.length ? outros.map(([k, a]) => `${k}: ${a.join(', ')}`).join('; ') : null,
  };
}

/* ---------- Ente ---------- */

export const ORGAO_GOVERNO = /^governo do estado de roraima$/;

/** Nome do município escrito no campo "Órgão", sem o prefixo institucional; null se não for prefeitura/município. */
export function municipioDoOrgao(orgao) {
  let s = normalizar(orgao).replace(/[.;]+$/, '').trim();
  // Fundos municipais listados junto ("…; Fundo Municipal de Saúde de …", "… e respectivos Fundos") ficam de fora.
  s = s.replace(/\s*[;,]\s*(?:fundo|fmas|fms|fundeb)\b.*$/, '').replace(/\s+e respectivos fundos$/, '');
  s = s.replace(/\s*[-–]\s*exercicio.*$/, '').replace(/\s*(?:\/|[-–])\s*rr$/, '').trim();
  // Chamada de nota de rodapé colada ao nome ("Município de Pacaraima1").
  s = s.replace(/([a-z])\d{1,2}$/, '$1');
  // Sigla da prefeitura depois do nome ("Prefeitura Municipal de Boa Vista – PMBV").
  s = s.replace(/\s*[-–]\s*pm[a-z]{1,4}$/, '');
  // Preposição repetida por erro de digitação ("Prefeitura Municipal de de Mucajaí").
  const m = s.match(/^(?:prefeitura municipal|prefeitura do municipio|prefeitura|municipio)(?:\s+(?:de|do|da))*\s+(.+)$/);
  return m ? m[1].trim() : null;
}

/** { tipo: 'governo-estadual' | 'municipio' | 'outro', municipio?: {id,nome,codigo_ibge} } */
export function enteDe(orgao, porNome) {
  const n = normalizar(orgao).replace(/[.;]+$/, '');
  if (ORGAO_GOVERNO.test(n)) return { tipo: 'governo-estadual' };
  const nome = municipioDoOrgao(orgao);
  if (nome == null) return { tipo: 'outro' };
  const mun = porNome.get(nome) ?? null;
  return mun ? { tipo: 'municipio', municipio: mun } : { tipo: 'municipio-nao-casado', nome_literal: nome };
}

/* ---------- Tipo de contas ---------- */

/** Pelo assunto literal: 'governo', 'gestao', 'governo-e-gestao', 'tomada-de-contas-especial' ou 'prestacao-de-contas'. */
export function tipoContas(assunto) {
  // Prefixo de classe ("IV – Prestação de Contas", "I – Prestação de Contas").
  const a = normalizar(assunto).replace(/gestao fiscal/g, 'gf').replace(/^[ivx]+\s*[-–:]\s*/, '');
  if (/tomada de contas especial/.test(a)) return 'tomada-de-contas-especial';
  if (/^tomada de contas\b/.test(a)) return 'tomada-de-contas';
  const gov = /\bgoverno\b|\bgovernador\b|contas anuais d[oe] prefeito|chefe do poder executivo/.test(a);
  const ges = /\bgestao\b/.test(a);
  if (gov && !ges) return 'governo';
  if (ges && !gov) return 'gestao';
  if (gov && ges) return 'governo-e-gestao';
  if (!gov && !ges && /^prestacao de contas\b/.test(a)) return 'prestacao-de-contas';
  return null;
}

/* ---------- Conclusão ---------- */

const ROTULOS = {
  irregularidade: 'pela irregularidade das contas',
  'regularidade com ressalvas': 'pela regularidade das contas com ressalvas',
  regularidade: 'pela regularidade das contas',
  aprovacao: 'pela aprovação das contas',
  desaprovacao: 'pela desaprovação das contas',
  rejeicao: 'pela rejeição das contas',
  prescricao: 'pelo reconhecimento da prescrição',
};

// Fórmulas da ementa (texto em minúsculas e sem acentos). Cada uma devolve a categoria pelo grupo capturado.
const RES = String.raw`(irregular(?:idades?|es)?|regular(?:idade|es)?(?:,?\s+(?:das\s+contas\s+)?com\s+ressalvas?)?|aprovacao|desaprovacao|rejeicao|prescricao)`;
const FORMULAS_EMENTA = [
  new RegExp(String.raw`parecer(?: previo)?,?\s+(?:deste tribunal,?\s+)?(?:opinando\s+)?pel[ao]\s+(?:julgamento\s+(?:das\s+contas\s+como\s+)?|emissao de parecer previo opinando pela\s+)?` + RES + String.raw`\b`, 'g'),
  new RegExp(String.raw`\b(?:opinando|sugerindo)\s+(?:pel[ao]|o)\s+(?:julgamento\s+(?:das\s+contas\s+como\s+)?)?` + RES + String.raw`\b`, 'g'),
  new RegExp(String.raw`(?:^|\.\s+)pela\s+` + RES + String.raw`\s+das\s+contas\b`, 'g'),
  /\b(regularidade\s+das\s+contas[^;.]{0,120}?\bcom\s+ressalvas?)\b/g,
  /\b(irregularidade|regularidade(?:,? com ressalvas?)?)\s+das\s+contas\b/g,
  /\bcontas\s+(?:julgadas\s+)?(regulares,? com ressalvas?|irregulares|regulares)\b/g,
  /(?:^|\.\s*)(regulares,? com ressalvas?|irregulares|regulares)\s*(?=\.|$)/g,
  /\bparecer(?: previo)?\s+(?:para fins de|pelo|de)\s+(?:re)?(conhecimento d[ao]\s+prescricao)/g,
  /\b(?:reconhecimento|incidencia|ocorrencia)\s+(?:do instituto\s+)?d[ao]\s+(prescricao)\b/g,
  /(?:^|\.\s+)(prescricao)\b/g,
  /\bpela\s+(aprovacao|desaprovacao|rejeicao)\s+das\s+contas\b/g,
];

// Dispositivo: só o primeiro item da decisão ("9.1. Que a Câmara Municipal … julgue IRREGULARES …").
const MARCA_DECISAO = /\b(acordam|e de parecer|sao de parecer|delibera|decidiram|opina|resolvem?)\b/;
const VERBO_DECISAO = /\b(julgue|julguem|julgadas?|julgamento|considere|considerem|consideradas?|sejam|seja|opinando|opinar|parecer|declarando|reconhec\w*|alcancadas|emitir|emita|que a (?:camara|assembleia))\b/;
const ITEM_NUMERADO = /^\d{1,2}\s*\.\s*\d{1,2}\s*\.?\s/;
const PALAVRAS_DECISAO = [
  [/\bprescri(?:cao|ta|tas|cional)\b/, 'prescricao'],
  [/\birregular(?:es|idade)?\b/, 'irregularidade'],
  // "REGULARES COM RESSALVAS", "regularidade das Contas da Prefeitura …, exercício 1994, com ressalvas", "REGULARES, com as seguintes RESSALVAS".
  [/\bregular(?:es|idade)?\b[^;.]{0,120}?\bcom\s+(?:as\s+(?:seguintes\s+)?)?ressalvas?\b/, 'regularidade com ressalvas'],
  [/\bregular(?:es|idade)?\b/, 'regularidade'],
  [/\b(?:desaprovacao|desaprovadas?|contrario a aprovacao)\b/, 'desaprovacao'],
  [/\b(?:rejeicao|rejeitadas?)\b/, 'rejeicao'],
  [/\b(?:aprovacao|aprovadas?|favoravel a aprovacao)\b/, 'aprovacao'],
];

function categoria(g) {
  if (/^irregular/.test(g)) return 'irregularidade';
  if (/^regular\w*(?:,?\s+das\s+contas\b.*)?,?\s+com\s+ressalva/.test(g)) return 'regularidade com ressalvas';
  if (/^regular/.test(g)) return 'regularidade';
  if (/prescri/.test(g)) return 'prescricao';
  if (g === 'aprovacao') return 'aprovacao';
  if (g === 'desaprovacao') return 'desaprovacao';
  if (g === 'rejeicao') return 'rejeicao';
  return null;
}

/** Categorias e trechos literais (a frase onde a fórmula aparece) encontrados na ementa. */
export function formulasEmenta(texto) {
  const orig = String(texto || '');
  const d = dobrar(orig);
  const achados = [];
  for (const re of FORMULAS_EMENTA) {
    re.lastIndex = 0;
    for (const m of d.matchAll(re)) {
      const cat = categoria(m[1]);
      if (!cat) continue;
      const ini = Math.max(d.lastIndexOf('. ', m.index + 1) + 1, 0);
      let fim = d.slice(m.index + m[0].length).search(/\.\s|\.$|;/);
      fim = fim < 0 ? orig.length : m.index + m[0].length + fim;
      const trecho = orig.slice(ini, Math.min(fim, ini + 400)).trim()
        .replace(/\s*[-–(,]?\s*(?:arts?\b|al[íi]neas?\b|incisos?\b|com fundamento\b|com fulcro\b|na forma d[oa]\b).*$/i, '').trim();
      achados.push({ categoria: cat, trecho });
    }
  }
  return achados;
}

/** Primeiro item da decisão no dispositivo (null se não localizado). */
export function primeiroItemDecisao(dispositivo) {
  const l = (dispositivo || []).map((x) => String(x));
  const d = l.map(dobrar);
  const considerando = (x) => /^c ?onsiderando\b/.test(x);
  let i = d.findIndex((x) => !considerando(x) && MARCA_DECISAO.test(x));
  if (i >= 0) {
    // Marca no fim da linha ("… ACORDAM em:", "É de Parecer:") → o item é a linha seguinte que não é considerando.
    const resto = d[i].slice(d[i].search(MARCA_DECISAO)).replace(MARCA_DECISAO, '');
    const titulo = /(?:\bem|\be)\s*[:;,]?\s*$/.test(d[i]) || /^\s*(?:em\b|,?\s*endereca)/.test(resto) || resto.replace(/[^a-z]/g, '').length <= 40;
    if (!titulo) return l[i];
    for (let j = i + 1; j < l.length; j++) {
      if (considerando(d[j])) continue;
      // Item que só anuncia subitens ("… proceda o julgamento com as seguintes imputações:") → junta o primeiro subitem.
      return /:\s*$/.test(l[j]) && j + 1 < l.length ? `${l[j]} ${l[j + 1]}` : l[j];
    }
    return null;
  }
  i = l.findIndex((x) => ITEM_NUMERADO.test(x));
  return i >= 0 ? l[i] : null;
}

/** Categorias do primeiro item da decisão (palavras-chave da conclusão). */
export function categoriasDecisao(item) {
  if (!item) return [];
  const d = dobrar(item);
  // Só vale item que expressa a opinião sobre as contas (verbo de julgamento ou de emissão do parecer).
  if (!VERBO_DECISAO.test(d)) return [];
  const cats = [];
  for (const [re, cat] of PALAVRAS_DECISAO) {
    if (!re.test(d)) continue;
    // "regular com ressalvas" já inclui "regular"; "desaprovação" não conta como "aprovação".
    if (cat === 'regularidade' && cats.includes('regularidade com ressalvas')) continue;
    if (cat === 'aprovacao' && (cats.some((c) => c === 'desaprovacao' || c.startsWith('regularidade')) || /\baprovacao do (?:projeto|presente)\b/.test(d))) continue;
    if ((cat === 'desaprovacao' || cat === 'rejeicao') && cats.includes('irregularidade')) continue;
    cats.push(cat);
  }
  return cats;
}

/**
 * Conclusão do parecer pela ementa e pelo primeiro item da decisão. Retorna { conclusao, conclusao_literal, lacunas }.
 * Vale a categoria única de uma das duas partes, desde que a outra não diga coisa diferente.
 */
export function conclusaoDe(p) {
  const lacunas = [];
  const e = formulasEmenta(p.ementa);
  // "regularidade das contas … com ressalvas" também casa a fórmula curta "regularidade das contas": vale a mais completa.
  const temRessalvas = e.some((a) => a.categoria === 'regularidade com ressalvas');
  const ce = [...new Set(e.map((a) => a.categoria))].filter((c) => !(temRessalvas && c === 'regularidade'));
  if (temRessalvas) e.sort((a, b) => (b.categoria === 'regularidade com ressalvas') - (a.categoria === 'regularidade com ressalvas'));
  const item = primeiroItemDecisao(p.dispositivo);
  const cd = categoriasDecisao(item);
  let cat = null;
  let trecho = null;
  if (ce.length === 1 && (!cd.length || (cd.length === 1 && cd[0] === ce[0]))) { cat = ce[0]; trecho = e[0].trecho; }
  else if (!ce.length && cd.length === 1) { cat = cd[0]; trecho = item.length > 500 ? `${item.slice(0, 500).trim()}…` : item; }
  if (cat) return { conclusao: ROTULOS[cat], conclusao_literal: trecho, categoria: cat, lacunas };
  if (!ce.length && !cd.length) lacunas.push('A conclusão do parecer não foi reconhecida no texto (ementa e decisão); consulte o documento oficial');
  else lacunas.push(`O texto traz mais de uma conclusão possível (${[...new Set([...ce, ...cd])].map((c) => ROTULOS[c]).join('; ')}); a conclusão foi deixada em branco — consulte o documento oficial`);
  return { conclusao: null, conclusao_literal: null, categoria: null, lacunas };
}

/* ---------- Publicação ---------- */

/** Data da publicação no diário (DETCERR ou DOE) escrita no topo do documento. */
export function dataPublicacaoDe(linhas) {
  for (const l of linhas || []) {
    if (!/DETCERR|Di[áa]rio Oficial|\bD\.?O\.?E\b|^Publica/i.test(l) || /^Boletim Interno|^Disponibiliza|^Republica|^Circul/i.test(l)) continue;
    // "DETCERR Nº 1436 Publicação: 10/09/2024 Disponibilização: 09/09/2024": vale a data após "Publicação".
    // Espaços e pontos repetidos dentro da data ("24 /03/2009", "03.10..2008") são só digitação.
    const s = l.replace(/(?:Disponibiliza|Circula)[çc][ãa]o\s*(?:em)?\s*:?\s*\d{1,2}\/\d{1,2}\/\d{4}/gi, '')
      .replace(/(\d)\s*([/.])\.?\s*(?=\d)/g, '$1$2');
    const datas = [...new Set([...s.matchAll(/(?<!\d)(\d{1,2})[/.](\d{1,2})[/.](\d{4}|\d{2})(?!\d)/g)].map((m) => {
      // Ano com dois dígitos ("05/05/16"): os diários vão de 1991 em diante.
      const a = m[3].length === 2 ? (Number(m[3]) >= 90 ? `19${m[3]}` : `20${m[3]}`) : m[3];
      return dataBR(`${m[1]}/${m[2]}/${a}`);
    }).filter(Boolean))];
    if (datas.length === 1) return datas[0];
    // "Publicação: 17 de maio de 2022"
    const ext = s.match(/^Publica[çc][ãa]o\s*:?\s*(\d{1,2}º?\s+de\s+[a-zç]+\s+de\s+\d{4})\s*$/i);
    if (!datas.length && ext) return dataPorExtenso(ext[1]);
    if (datas.length > 1) return null;
  }
  return null;
}

/** Junta tudo o que é interpretado de um parecer (p = lerParecer, porNome = municípios por nome normalizado). */
export function interpretar(p, porNome) {
  const ex = exercicioDe(p);
  const c = conclusaoDe(p);
  let ente = enteDe(p.orgao, porNome);
  let tipo = tipoContas(p.assunto);
  // Cabeçalho com os rótulos trocados ("Assunto: Prefeitura Municipal de …", "Órgão: Prestação de Contas …").
  if (ente.tipo === 'outro' && p.assunto && enteDe(p.assunto, porNome).tipo !== 'outro') {
    ente = enteDe(p.assunto, porNome);
    tipo = tipoContas(p.orgao);
    c.lacunas.push('No cabeçalho do parecer, os campos “Assunto” e “Órgão” aparecem com os conteúdos trocados');
  }
  return {
    ...ex,
    ente,
    tipo_contas: tipo,
    ...c,
    data_publicacao: dataPublicacaoDe([...(p.publicacao_literal || []), ...(p.anotacoes_literal || [])]),
  };
}
