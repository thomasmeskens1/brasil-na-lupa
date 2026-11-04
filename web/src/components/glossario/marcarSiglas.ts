/**
 * Localiza siglas conhecidas num texto oficial sem alterar nada dele (funções puras, sem DOM;
 * testes em tests/glossario/). Base de <TextoComSiglas> e <NomeProprio>.
 *
 *   segmentarSiglas("ADI 1.234/2025 no STF", new Set())
 *   // [{ sigla: ADI, primeira: true }, " 1.234/2025 no ", { sigla: STF, primeira: true }]
 *
 * Regras:
 * - Só siglas do dicionário (siglas.ts), com as maiúsculas e minúsculas exatas ("REsp").
 * - A sigla é uma palavra inteira: não casa dentro de "STFX", "TCU-X", "arquivo.PDF" nem depois de
 *   hífen ("PT-SP"); compostas ("TCE-SP") vencem as curtas ("TCE").
 * - Endereços da web e e-mails ficam intactos (nenhuma sigla dentro de URL é marcada).
 * - Números ("1.234/2025") nunca são cortados: só letras são marcadas.
 * - Siglas ambíguas (`soComNumero`) só quando seguidas de número ("PL 1234/2025").
 * - "Nome por extenso (SIGLA)": a sigla entre parênteses conta como já explicada.
 * - A concatenação dos segmentos é sempre igual ao texto de entrada.
 */
import { SIGLAS_OFICIAIS, type Sigla } from "./siglas";

export type Segmento = string | { sigla: Sigla; texto: string; primeira: boolean; explicadaNoTexto: boolean };

const RE_PROTEGIDO = /\bhttps?:\/\/[^\s<>"]+|\bwww\.[^\s<>"]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\b[\w-]+(?:\.[\w-]+)*\.(?:gov|leg|jus|mp|org|com|net)\.br\b[^\s<>"]*/giu;

function escaparRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let reCache: { lista: readonly Sigla[]; re: RegExp; mapa: Map<string, Sigla> } | null = null;

function regexDe(lista: readonly Sigla[]): { re: RegExp; mapa: Map<string, Sigla> } {
  if (reCache && reCache.lista === lista) return reCache;
  const mapa = new Map(lista.map((s) => [s.sigla, s]));
  const alt = [...mapa.keys()].sort((a, b) => b.length - a.length).map(escaparRe).join("|");
  // Antes: nada de letra, dígito, hífen, ponto, @ ou barra invertida. Depois: nada de letra/dígito
  // nem de "-X"/".X" (continuação da palavra: "ICMS-ST", "STF.jus").
  const re = new RegExp(String.raw`(?<![\p{L}\p{N}_\-.@\\])(${alt})(?![\p{L}\p{N}_]|[-.][\p{L}\p{N}])`, "gu");
  reCache = { lista, re, mapa };
  return reCache;
}

function chave(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** A sigla está entre parênteses logo depois do nome por extenso (ou de um nome qualquer)? */
function explicadaNoTexto(texto: string, ini: number, fim: number, s: Sigla): boolean {
  const antes = texto.slice(0, ini);
  const depois = texto.slice(fim);
  if (/[(]\s*$/.test(antes) && /^\s*[)]/.test(depois)) {
    const anterior = antes.replace(/\s*[(]\s*$/, "");
    // "Nome (SIGLA)": nome por extenso ou palavra qualquer antes do parêntese.
    return chave(anterior).endsWith(chave(s.nome)) || /\p{L}{3,}$/u.test(anterior);
  }
  // "SIGLA (Nome por extenso)" ou "SIGLA – Nome por extenso".
  const m = /^\s*(?:[(]|[–—-]\s|:\s)\s*/.exec(depois);
  if (m) return chave(depois.slice(m[0].length)).startsWith(chave(s.nome));
  return false;
}

/**
 * Divide o texto em trechos e siglas. `vistas` guarda as siglas já explicadas na página: a
 * primeira ocorrência sai com `primeira: true` e entra no conjunto.
 */
export function segmentarSiglas(texto: string, vistas: Set<string> = new Set(), lista: readonly Sigla[] = SIGLAS_OFICIAIS): Segmento[] {
  if (!texto) return [texto];
  const { re, mapa } = regexDe(lista);
  const protegidos: [number, number][] = [];
  for (const m of texto.matchAll(RE_PROTEGIDO)) protegidos.push([m.index, m.index + m[0].length]);
  const dentroDeProtegido = (i: number) => protegidos.some(([a, b]) => i >= a && i < b);

  const r: Segmento[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    const ini = m.index;
    const fim = ini + m[0].length;
    const s = mapa.get(m[1]);
    if (!s || dentroDeProtegido(ini)) continue;
    if (s.soComNumero && !/^\s?(?:n[º°.]\s?)?\d/.test(texto.slice(fim))) continue;
    if (ini > ultimo) r.push(texto.slice(ultimo, ini));
    const explicada = explicadaNoTexto(texto, ini, fim, s);
    const primeira = !vistas.has(s.sigla) && !explicada;
    vistas.add(s.sigla);
    r.push({ sigla: s, texto: m[0], primeira, explicadaNoTexto: explicada });
    ultimo = fim;
  }
  if (ultimo < texto.length) r.push(texto.slice(ultimo));
  return r.length ? r : [texto];
}

const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos", "a", "o", "as", "os", "ao", "aos", "à", "às", "para", "por", "com", "sem", "sobre"]);
const ROMANO = /^(?=[MDCLXVI]+$)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/** O texto está todo (ou quase todo) em maiúsculas? Pede ao menos 4 letras. */
export function emCaixaAlta(texto: string): boolean {
  const letras = texto.match(/\p{L}/gu) ?? [];
  if (letras.length < 4) return false;
  const maiusculas = letras.filter((l) => l !== l.toLowerCase() && l === l.toUpperCase()).length;
  return maiusculas / letras.length >= 0.9;
}

/**
 * "MINISTRO HERMAN BENJAMIN, DA SEGUNDA TURMA DO STJ" → "Ministro Herman Benjamin, da Segunda
 * Turma do STJ". Mantém siglas conhecidas e números romanos; partículas em minúsculas (exceto no
 * começo). Só para o nome lido por leitor de tela: o texto visível não muda.
 */
export function capitalizacaoNormal(texto: string, lista: readonly Sigla[] = SIGLAS_OFICIAIS): string {
  const conhecidas = new Set(lista.filter((s) => !s.soComNumero).map((s) => s.sigla.toUpperCase()));
  let inicio = true;
  return texto.replace(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)?/gu, (p, pos: number) => {
    const antes = texto.slice(0, pos);
    const primeiraDaFrase = inicio || /[.!?:;]\s*$/.test(antes);
    inicio = false;
    const sup = p.toUpperCase();
    // Sigla colada por hífen ("TCE-SP"): o pedaço continua em maiúsculas.
    if (conhecidas.has(sup) || /-$/.test(antes) && conhecidas.has(`${(/([\p{L}]+)-$/u.exec(antes) ?? ["", ""])[1].toUpperCase()}-${sup}`)) return p;
    if (ROMANO.test(sup) && sup.length > 1) return p;
    const min = p.toLocaleLowerCase("pt-BR");
    if (!primeiraDaFrase && PARTICULAS.has(min)) return min;
    return min.charAt(0).toLocaleUpperCase("pt-BR") + min.slice(1);
  });
}
