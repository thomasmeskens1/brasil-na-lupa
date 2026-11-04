/**
 * Normalização de texto para leitura em voz alta em português do Brasil. Funções puras, sem DOM,
 * testadas em tests/ouvir/normalizar.test.mjs (node --test).
 *
 *   paraFala("PL 1234/2025 aprovado por 397 × 3 em 15/12/2025")
 *   // "Projeto de Lei 1234 de 2025 aprovado por 397 a 3 em 15 de dezembro de 2025"
 *   paraFala("ICMS de R$ 1,64 por litro") // "ICMS de um real e sessenta e quatro centavos por litro"
 *
 * Siglas: as de tipo de norma (PL, PLP, PEC…) são expandidas quando vêm com número; as de órgãos
 * (STF, STJ, TCU…) são expandidas na primeira vez que aparecem na leitura (o conjunto `ditas`
 * guarda as já ditas). "Nome por extenso (SIGLA)" não repete a sigla. As duas listas vêm do
 * dicionário único do site (components/glossario/siglas.ts), o mesmo usado na tela.
 */
import { SIGLAS_OFICIAIS } from "../glossario/siglas";

const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d];
  }
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  return r ? `${CENTENAS[c]} e ${ate999(r)}` : CENTENAS[c];
}

const ESCALAS: [number, string, string][] = [
  [1e12, "trilhão", "trilhões"],
  [1e9, "bilhão", "bilhões"],
  [1e6, "milhão", "milhões"],
];

/** Número inteiro por extenso (até centenas de trilhões): 1234 → "mil duzentos e trinta e quatro". */
export function porExtenso(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `menos ${porExtenso(-n)}`;
  n = Math.floor(n);
  if (n < 1000) return ate999(n);
  const partes: string[] = [];
  let resto = n;
  for (const [valor, sing, plur] of ESCALAS) {
    const q = Math.floor(resto / valor);
    if (q) {
      partes.push(`${porExtenso(q)} ${q === 1 ? sing : plur}`);
      resto %= valor;
    }
  }
  const mil = Math.floor(resto / 1000);
  if (mil) partes.push(mil === 1 ? "mil" : `${ate999(mil)} mil`);
  const fim = resto % 1000;
  if (fim) partes.push(ate999(fim));
  // "e" antes do último grupo quando ele é < 100 ou centena redonda ("mil e cem", "dois mil e cinco").
  if (partes.length > 1 && fim && (fim < 100 || fim % 100 === 0)) {
    const ultimo = partes.pop()!;
    return `${partes.join(" ")} e ${ultimo}`;
  }
  return partes.join(" ");
}

/** "1.234,56" → 1234.56; "1234" → 1234. */
function numeroBr(t: string): number {
  return Number(t.replace(/\./g, "").replace(",", "."));
}

/** Valor em reais por extenso: 1.64 → "um real e sessenta e quatro centavos". */
export function reaisPorExtenso(valor: number): string {
  const inteiro = Math.floor(valor + 1e-9);
  const centavos = Math.round((valor - inteiro) * 100);
  const r = inteiro === 0 ? "" : `${porExtenso(inteiro)} ${inteiro === 1 ? "real" : "reais"}`;
  // "um milhão de reais" (escala redonda pede "de").
  const deReais = inteiro >= 1e6 && inteiro % 1e6 === 0 ? r.replace(/ reais$/, " de reais") : r;
  const c = centavos ? `${porExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}` : "";
  if (!deReais && !c) return "zero real";
  return [deReais, c].filter(Boolean).join(" e ");
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const ORD_M = ["", "primeiro", "segundo", "terceiro", "quarto", "quinto", "sexto", "sétimo", "oitavo", "nono", "décimo"];
const ORD_F = ["", "primeira", "segunda", "terceira", "quarta", "quinta", "sexta", "sétima", "oitava", "nona", "décima"];

/** Data por extenso: (15, 12, 2025) → "15 de dezembro de 2025"; dia 1 → "primeiro de …". */
export function dataPorExtenso(dia: number, mes: number, ano?: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = dia === 1 ? "primeiro" : String(dia);
  return `${d} de ${MESES[mes - 1]}${ano ? ` de ${ano}` : ""}`;
}

/** Tipos de norma e proposição: expandidos quando seguidos de número (voz "com-numero" no dicionário). */
export const SIGLAS_NORMA: Record<string, string> = Object.fromEntries(
  SIGLAS_OFICIAIS.filter((s) => s.voz === "com-numero").map((s) => [s.sigla, s.nome]),
);

/** Siglas de órgãos e termos: expandidas na primeira ocorrência da leitura (voz "sempre" no dicionário). */
export const SIGLAS: Record<string, string> = Object.fromEntries(
  SIGLAS_OFICIAIS.filter((s) => s.voz === "sempre").map((s) => [s.sigla, s.nome]),
);

function escaparRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ordinal(n: number, fem: boolean): string {
  const t = fem ? ORD_F : ORD_M;
  return n >= 1 && n <= 10 ? t[n] : String(n);
}

const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?`;
const ESCALA_RE = String.raw`(mil|milh(?:ão|ões)|bilh(?:ão|ões)|trilh(?:ão|ões)|mi|bi|tri)\b`;
const ESCALA_NOME: Record<string, [string, string]> = {
  mil: ["mil", "mil"],
  mi: ["milhão", "milhões"],
  bi: ["bilhão", "bilhões"],
  tri: ["trilhão", "trilhões"],
};

/** "1,2" → "um vírgula dois"; "3" → "três". */
function decimalFalado(t: string): string {
  const [i, d] = t.replace(/\./g, "").split(",");
  const inteiro = porExtenso(Number(i));
  if (!d) return inteiro;
  const dec = /^0/.test(d) ? d.split("").map((c) => UNIDADES[Number(c)]).join(" ") : porExtenso(Number(d));
  return `${inteiro} vírgula ${dec}`;
}

/** Valores em reais: "R$ 1,64" → "um real e sessenta e quatro centavos"; "R$ 2,5 bilhões" → "dois vírgula cinco bilhões de reais". */
export function falarDinheiro(t: string): string {
  const re = new RegExp(String.raw`(-\s?)?R\$\s?(${NUM})(?:\s+${ESCALA_RE})?`, "g");
  return t.replace(re, (_m, menos: string | undefined, num: string, escala: string | undefined) => {
    const prefixo = menos ? "menos " : "";
    if (escala) {
      const chave = escala.replace(/ão$|ões$/, "").replace(/^milh$/, "mi").replace(/^bilh$/, "bi").replace(/^trilh$/, "tri");
      const [sing, plur] = ESCALA_NOME[chave] ?? [escala, escala];
      const valor = numeroBr(num);
      const nome = valor < 2 ? sing : plur;
      return `${prefixo}${decimalFalado(num)} ${nome} de reais`;
    }
    return prefixo + reaisPorExtenso(numeroBr(num));
  });
}

/** Datas: "15/12/2025" e "2025-12-15" → "15 de dezembro de 2025"; "1º/02/2027" → "primeiro de fevereiro de 2027". */
export function falarDatas(t: string): string {
  return t
    .replace(/(?<!\d)(\d{4})-(\d{2})-(\d{2})\b/g, (m, a, me, d) => dataPorExtenso(Number(d), Number(me), Number(a)) ?? m)
    .replace(/(?<!\d)(\d{1,2})[º°]?\/(\d{1,2})\/(\d{4})\b/g, (m, d, me, a) => dataPorExtenso(Number(d), Number(me), Number(a)) ?? m)
    .replace(/(?<!\d)(\d{1,2})[º°]?\/(\d{1,2})\/(\d{2})\b(?!\/)/g, (m, d, me, a) => dataPorExtenso(Number(d), Number(me), 2000 + Number(a)) ?? m)
    .replace(/\b(\d{1,2})h(\d{2})\b/g, (_m, h, mi) => hora(h, mi))
    .replace(/\b(\d{1,2})h\b/g, (_m, h) => hora(h))
    .replace(/(^|[^\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/g, (_m, a, h, mi) => `${a}${hora(h, mi)}`);
}

function hora(h: string, mi?: string): string {
  const H = Number(h);
  const M = Number(mi ?? 0);
  const ph = `${H} ${H === 1 ? "hora" : "horas"}`;
  return M ? `${ph} e ${M} ${M === 1 ? "minuto" : "minutos"}` : ph;
}

/** Normas com número/ano: "PL 1234/2025" → "Projeto de Lei 1234 de 2025"; "Convênio ICMS 127/2026" → "Convênio ICMS 127 de 2026". */
export function falarNormas(t: string): string {
  const siglas = Object.keys(SIGLAS_NORMA).sort((a, b) => b.length - a.length).map(escaparRe).join("|");
  const reSigla = new RegExp(String.raw`\b(${siglas})\s?(?:n[º°.]\s?)?(\d[\d.]*)(?:\/(\d{2,4}))?\b`, "g");
  return t
    .replace(reSigla, (_m, s: string, n: string, a?: string) => `${SIGLAS_NORMA[s]} ${n.replace(/\./g, "")}${a ? ` de ${a}` : ""}`)
    .replace(/\b([A-Z]{2,6})\s?\/\s?(\d{4})\b/g, "$1 de $2")
    .replace(/\b(\d+)\/(\d{4})\b/g, (_m, n, a) => `${n} de ${a}`);
}

/** Abreviações jurídicas e símbolos: "art. 5º, § 2º, inc. III" → "artigo quinto, parágrafo segundo, inciso III". */
export function falarAbreviacoes(t: string): string {
  return t
    .replace(/\b[Aa]rts?\.\s?(\d+)([º°])?/g, (m, n) => `${m.startsWith("arts") || m.startsWith("Arts") ? "artigos" : "artigo"} ${Number(n) <= 9 ? ordinal(Number(n), false) : n}`)
    .replace(/§§\s?/g, "parágrafos ")
    .replace(/§\s?(\d+)[º°]?/g, (_m, n) => `parágrafo ${Number(n) <= 9 ? ordinal(Number(n), false) : n}`)
    .replace(/§\s?/g, "parágrafo ")
    .replace(/\binc\.\s?/gi, "inciso ")
    .replace(/\bal\.\s?/g, "alínea ")
    .replace(/\b[Nn]\.?\s?[º°]\s?(?=\d)/g, "número ")
    .replace(/\b(\d+)ª/g, (_m, n) => ordinal(Number(n), true))
    .replace(/\b(\d+)[º°]/g, (_m, n) => ordinal(Number(n), false))
    .replace(/\bp\.\s?ex\./gi, "por exemplo")
    .replace(/\bex\.:\s?/gi, "por exemplo: ")
    .replace(/\betc\./g, "etcétera");
}

/** Números e símbolos: "397 × 3" → "397 a 3"; "12,5%" → "12 vírgula 5 por cento"; "1.234" → "1234"; "→" → "para". */
export function falarNumeros(t: string): string {
  return t
    .replace(/(\d)\s?[×x]\s?(\d)/g, "$1 a $2")
    .replace(new RegExp(String.raw`(${NUM})\s?%`, "g"), (_m, n: string) => `${decimalFalado(n)} por cento`)
    .replace(/\b\d{1,3}(?:\.\d{3})+(?!\d)/g, (m) => m.replace(/\./g, ""))
    .replace(/\s*(?:→|->)\s*/g, " para ")
    .replace(/\s*[↗↑↓←]\s*/g, " ")
    .replace(/\s+[·•|]\s+/g, ", ")
    .replace(/\s+[–—]\s+/g, ", ")
    .replace(/(\d)\s?[–-]\s?(\d)/g, "$1 a $2");
}

/** Siglas de órgãos: primeira ocorrência por extenso; "Nome (SIGLA)" não repete a sigla. */
export function falarSiglas(t: string, ditas: Set<string> = new Set()): string {
  let r = t;
  for (const [s, nome] of Object.entries(SIGLAS)) {
    // "Supremo Tribunal Federal (STF)": já está por extenso; tira o parêntese.
    const comNome = new RegExp(`${escaparRe(nome)}\\s*\\(${escaparRe(s)}\\)`, "gi");
    if (comNome.test(r)) {
      r = r.replace(comNome, (m) => m.replace(/\s*\([^)]*\)$/, ""));
      ditas.add(s);
    }
    // "(STF)" logo depois de um nome qualquer: some (o nome já foi dito).
    r = r.replace(new RegExp(`(\\p{L}{3,})\\s*\\(${escaparRe(s)}\\)`, "gu"), (m, ant: string) => {
      ditas.add(s);
      return ant;
    });
    const re = new RegExp(`(?<![\\p{L}\\d-])${escaparRe(s)}(?![\\p{L}\\d]|-[A-Z])`, "gu");
    r = r.replace(re, (m) => {
      if (ditas.has(s)) return m;
      ditas.add(s);
      return nome;
    });
  }
  return r;
}

/** Endereços da web viram "endereço do site"; e-mails ficam. */
function falarLinks(t: string): string {
  return t.replace(/\bhttps?:\/\/\S+/g, "endereço do site").replace(/\bwww\.\S+/g, "endereço do site");
}

/**
 * Texto pronto para a voz, na ordem: links, datas, dinheiro, normas, abreviações, números, siglas.
 * `ditas` guarda as siglas já expandidas nesta leitura (passe o mesmo conjunto entre os trechos).
 */
export function paraFala(texto: string, ditas: Set<string> = new Set()): string {
  let t = texto.replace(/\s+/g, " ").trim();
  t = falarLinks(t);
  t = falarDatas(t);
  t = falarDinheiro(t);
  t = falarNormas(t);
  t = falarAbreviacoes(t);
  t = falarNumeros(t);
  t = falarSiglas(t, ditas);
  return t
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/^[\s·•|,;:]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Divide em trechos curtos (fim de frase), porque alguns navegadores cortam falas longas. */
export function dividirEmTrechos(t: string, max = 200): string[] {
  // Fim de frase = pontuação seguida de espaço (não quebra "1.5" nem "R$ 1,64").
  const frases = t.split(/(?<=[.!?;])\s+/).map((f) => `${f} `);
  const r: string[] = [];
  let atual = "";
  const empurrar = (s: string) => {
    if (s.trim()) r.push(s.trim());
  };
  for (const f of frases) {
    if ((atual + f).length > max && atual) {
      empurrar(atual);
      atual = "";
    }
    if (f.length > max) {
      // Frase longa: corta em vírgula ou espaço, nunca no meio da palavra.
      let resto = f;
      while (resto.length > max) {
        let corte = resto.lastIndexOf(", ", max);
        if (corte < max / 2) corte = resto.lastIndexOf(" ", max);
        if (corte <= 0) corte = max;
        empurrar(resto.slice(0, corte + 1));
        resto = resto.slice(corte + 1);
      }
      atual = resto;
    } else atual += f;
  }
  empurrar(atual);
  return r;
}

/** Como o título é anunciado: "Título da página", "Seção" ou "Subtítulo". */
export function anuncioTitulo(nivel: number, texto: string): string {
  const prefixo = nivel <= 1 ? "Título da página" : nivel === 2 ? "Seção" : "Subtítulo";
  const t = texto.replace(/[.:]\s*$/, "");
  return `${prefixo}: ${t}${/[?!]$/.test(t) ? "" : "."}`;
}

/** Pontuação da melhor voz: pt-BR, natural/neural/online, depois as conhecidas de boa qualidade. */
export function pontuarVoz(v: { name: string; lang: string; localService?: boolean; default?: boolean }): number {
  const lang = (v.lang || "").replace("_", "-").toLowerCase();
  if (!lang.startsWith("pt")) return -1;
  let p = lang === "pt-br" ? 100 : 40;
  const n = v.name.toLowerCase();
  if (/natural|neural|online/.test(n)) p += 50;
  if (/premium|enhanced|aprimorad|melhorad/.test(n)) p += 40;
  if (/google/.test(n)) p += 30;
  if (/francisca|thalita|antonio|luciana|felipe|fernanda|vitória|vitoria|daniel/.test(n)) p += 10;
  if (/compact|espeak/.test(n)) p -= 30;
  if (v.default) p += 1;
  return p;
}

/** Escolhe a melhor voz da lista (ou null). */
export function escolherVoz<T extends { name: string; lang: string; localService?: boolean; default?: boolean }>(vozes: readonly T[]): T | null {
  let melhor: T | null = null;
  let pm = -1;
  for (const v of vozes) {
    const p = pontuarVoz(v);
    if (p > pm) {
      pm = p;
      melhor = v;
    }
  }
  return pm >= 0 ? melhor : null;
}
