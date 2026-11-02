// Extração de texto de PDF sem dependências (Node: zlib nativo).
// Cobre o que os PDFs de exposição de motivos do Planalto usam (Word → PDF):
// fluxos FlateDecode, fluxos de objetos (ObjStm), fontes WinAnsi e fontes Type0 com ToUnicode.
// Espaços entre palavras são decididos pela posição dos glifos (larguras da fonte).
// Não faz OCR: PDF escaneado devolve texto vazio, e o chamador registra a lacuna.
import zlib from 'node:zlib';

const WIN = { 0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ', 0xa0: ' ', 0xad: '' };
const winAnsi = (b) => WIN[b] ?? String.fromCharCode(b);

function inflar(buf) {
  try { return zlib.inflateSync(buf); } catch { /* segue */ }
  try { return zlib.inflateSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH }); } catch { return null; }
}

/** Lê todos os objetos "n 0 obj … endobj" (inclusive os de ObjStm). Retorna Map num → { dict, stream }. */
function lerObjetos(buf) {
  const s = buf.toString('latin1');
  const objs = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(s))) {
    const ini = m.index + m[0].length;
    const fim = s.indexOf('endobj', ini);
    if (fim < 0) break;
    let corpo = s.slice(ini, fim);
    let stream = null;
    const si = corpo.search(/stream\r?\n/);
    if (si >= 0) {
      const dict = corpo.slice(0, si);
      const inicioDados = ini + si + corpo.slice(si).match(/stream\r?\n/)[0].length;
      const fimDados = s.lastIndexOf('endstream', fim);
      let dados = buf.subarray(inicioDados, fimDados);
      if (/\/FlateDecode/.test(dict)) dados = inflar(dados) || Buffer.alloc(0);
      else if (/\/Filter/.test(dict)) dados = Buffer.alloc(0); // filtro não suportado (ex.: imagem)
      stream = dados;
      corpo = dict;
    }
    objs.set(Number(m[1]), { dict: corpo, stream });
    re.lastIndex = fim;
  }
  for (const o of [...objs.values()]) { // objetos comprimidos em ObjStm
    if (!o.stream || !/\/Type\s*\/ObjStm/.test(o.dict)) continue;
    const n = Number((o.dict.match(/\/N\s+(\d+)/) || [])[1]);
    const first = Number((o.dict.match(/\/First\s+(\d+)/) || [])[1]);
    const txt = o.stream.toString('latin1');
    const cab = txt.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++) {
      const num = cab[2 * i], off = cab[2 * i + 1];
      const prox = i + 1 < n ? cab[2 * i + 3] : txt.length - first;
      if (!objs.has(num)) objs.set(num, { dict: txt.slice(first + off, first + prox), stream: null });
    }
  }
  return objs;
}

const ref = (txt, chave) => { const m = txt.match(new RegExp('/' + chave + '\\s+(\\d+)\\s+0\\s+R')); return m ? Number(m[1]) : null; };

/** Dicionário "<< … >>" de uma chave (inline) ou do objeto referenciado. */
function dictDe(objs, txt, chave) {
  const r = ref(txt, chave);
  if (r != null) return objs.get(r)?.dict || '';
  const i = txt.search(new RegExp('/' + chave + '\\s*<<'));
  if (i < 0) return '';
  const p = txt.indexOf('<<', i);
  let nivel = 0, j = p;
  for (; j < txt.length; j++) {
    if (txt.startsWith('<<', j)) { nivel++; j++; } else if (txt.startsWith('>>', j)) { nivel--; j++; if (!nivel) break; }
  }
  return txt.slice(p, j + 1);
}

/** Array inline "[ … ]" ou o conteúdo do objeto referenciado ("12 0 R"). */
function arrayOuRef(objs, txt) {
  const m = txt.match(/^\s*(\d+)\s+0\s+R/);
  return m ? objs.get(Number(m[1]))?.dict || '' : txt;
}

function lerCMap(texto) {
  const mapa = new Map();
  let bytes = 1;
  const hex = (h) => parseInt(h, 16);
  const uni = (h) => { let r = ''; for (let i = 0; i + 4 <= h.length; i += 4) r += String.fromCharCode(hex(h.slice(i, i + 4))); return r; };
  const cs = texto.match(/begincodespacerange\s*<([0-9a-fA-F]+)>/);
  if (cs) bytes = cs[1].length / 2;
  for (const b of texto.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) mapa.set(hex(m[1]), uni(m[2]));
  }
  for (const b of texto.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(\[[^\]]*\]|<[0-9a-fA-F]+>)/g)) {
      const a = hex(m[1]), z = hex(m[2]);
      if (m[3].startsWith('[')) {
        const lista = [...m[3].matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => uni(x[1]));
        for (let c = a; c <= z; c++) mapa.set(c, lista[c - a] ?? '');
      } else {
        const base = hex(m[3].slice(1, -1));
        for (let c = a; c <= z; c++) mapa.set(c, String.fromCharCode(base + c - a));
      }
    }
  }
  return { mapa, bytes };
}

function fonte(objs, num) {
  const d = objs.get(num)?.dict || '';
  const tu = ref(d, 'ToUnicode');
  const cmap = tu != null && objs.get(tu)?.stream ? lerCMap(objs.get(tu).stream.toString('latin1')) : null;
  const type0 = /\/Subtype\s*\/Type0/.test(d);
  const larguras = new Map();
  let padrao = type0 ? 1000 : 500;
  if (type0) {
    const desc = arrayOuRef(objs, d.match(/\/DescendantFonts\s*(\[[^\]]*\]|\d+\s+0\s+R)/)?.[1] || '');
    const r = desc.match(/(\d+)\s+0\s+R/);
    const cid = r ? objs.get(Number(r[1]))?.dict || '' : desc;
    const dw = cid.match(/\/DW\s+(\d+)/);
    if (dw) padrao = Number(dw[1]);
    const wi = cid.search(/\/W\s*[[\d]/);
    if (wi >= 0) {
      let w = cid.slice(wi + 2).trim();
      if (/^\d+\s+0\s+R/.test(w)) w = arrayOuRef(objs, w);
      const toks = w.slice(w.indexOf('[') + 1).match(/\[|\]|-?[\d.]+/g) || [];
      let i = 0;
      while (i < toks.length && toks[i] !== ']') {
        const c = Number(toks[i]);
        if (toks[i + 1] === '[') {
          let k = i + 2, j = 0;
          while (k < toks.length && toks[k] !== ']') larguras.set(c + j++, Number(toks[k++]));
          i = k + 1;
        } else {
          const c2 = Number(toks[i + 1]), lw = Number(toks[i + 2]);
          for (let x = c; x <= c2 && x - c < 70000; x++) larguras.set(x, lw);
          i += 3;
        }
      }
    }
  } else {
    const fc = Number(d.match(/\/FirstChar\s+(\d+)/)?.[1] ?? 0);
    const w = arrayOuRef(objs, d.match(/\/Widths\s*(\[[^\]]*\]|\d+\s+0\s+R)/)?.[1] || '');
    (w.match(/-?[\d.]+/g) || []).forEach((x, i) => larguras.set(fc + i, Number(x)));
  }
  // Fonte simples usa sempre 1 byte por código, mesmo quando o ToUnicode declara faixa de 2 bytes.
  return { cmap, bytes: type0 ? (cmap ? cmap.bytes : 2) : 1, larguras, padrao };
}

function decodificar(bytes, f) {
  let r = '', w = 0;
  const n = f?.bytes || 1;
  for (let i = 0; i + n <= bytes.length; i += n) {
    const c = n === 2 ? (bytes[i] << 8) | bytes[i + 1] : bytes[i];
    if (f?.cmap?.mapa.has(c)) r += f.cmap.mapa.get(c);
    else r += n === 1 ? winAnsi(c) : '';
    w += f?.larguras?.get(c) ?? f?.padrao ?? 500;
  }
  return [r, w];
}

function lerStringLiteral(s, i) { // s[i] === '('
  const out = [];
  let nivel = 1; i++;
  const esc = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
  while (i < s.length && nivel) {
    const c = s[i];
    if (c === '\\') {
      const d = s[i + 1];
      if (d in esc) { out.push(esc[d]); i += 2; }
      else if (/[0-7]/.test(d)) { const o = s.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)[0]; out.push(parseInt(o, 8) & 255); i += 1 + o.length; }
      else if (d === '\r' || d === '\n') i += d === '\r' && s[i + 2] === '\n' ? 3 : 2;
      else i += 2;
      continue;
    }
    if (c === '(') nivel++;
    if (c === ')') { nivel--; if (!nivel) { i++; break; } }
    out.push(c.charCodeAt(0) & 255); i++;
  }
  return [Buffer.from(out), i];
}

const BRANCO = new Set([' ', '\n', '\r', '\t', '\f', '\u0000']);

/** Interpreta o fluxo de conteúdo de uma página e devolve linhas de texto. */
function textoDaPagina(conteudo, fontes) {
  const s = conteudo.toString('latin1');
  const linhas = [];
  let atual = '', f = null, tam = 10, esc = 1, pilha = [];
  let x = 0, y = null, lx = 0, ly = 0, tc = 0, tw = 0, lead = 0, x0 = 0;
  const quebra = () => { if (atual.trim()) linhas.push({ x: Math.round(x0), texto: atual.replace(/\s+/g, ' ').trim() }); atual = ''; };
  const ir = (nx, ny) => {
    const ef = tam * esc;
    if (y != null && Math.abs(ny - y) > ef * 0.5) quebra();
    else if (atual && !/\s$/.test(atual) && nx - x > ef * 0.2) atual += ' ';
    x = nx; y = ny;
  };
  const mostrar = (b) => {
    const [t, w] = decodificar(b, f);
    if (!atual.trim() && t.trim()) x0 = x;
    atual += t;
    const espacos = (t.match(/ /g) || []).length;
    x += (w / 1000 * tam + tc * t.length + tw * espacos) * esc;
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (BRANCO.has(c)) { i++; continue; }
    if (c === '%') { while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++; continue; }
    if (c === '(') { const [b, j] = lerStringLiteral(s, i); pilha.push({ str: b }); i = j; continue; }
    if (c === '<' && s[i + 1] !== '<') {
      const j = s.indexOf('>', i);
      const h = s.slice(i + 1, j).replace(/\s/g, '');
      pilha.push({ str: Buffer.from(h.length % 2 ? h + '0' : h, 'hex') }); i = j + 1; continue;
    }
    if (c === '[') { pilha.push({ abre: true }); i++; continue; }
    if (c === ']') { const arr = []; while (pilha.length && !pilha[pilha.length - 1].abre) arr.unshift(pilha.pop()); pilha.pop(); pilha.push({ arr }); i++; continue; }
    if (c === '<' || c === '>') { i += 2; continue; }
    if (c === '/') { const m = s.slice(i, i + 128).match(/^\/[^\s/<>[\]()%{}]*/)[0]; pilha.push({ nome: m.slice(1) }); i += m.length; continue; }
    const m = s.slice(i, i + 40).match(/^[^\s/<>[\]()%{}]+/);
    if (!m) { i++; continue; }
    const tok = m[0]; i += tok.length;
    if (/^[-+.\d]+$/.test(tok)) { pilha.push({ num: Number(tok) }); continue; }
    const nums = pilha.filter((p) => 'num' in p).map((p) => p.num);
    const strs = pilha.filter((p) => p.str);
    switch (tok) {
      case 'BT': lx = 0; ly = y ?? 0; break; // x continua do bloco anterior (Word abre um BT por trecho)
      case 'Tf': { const nome = pilha.find((p) => 'nome' in p)?.nome; f = fontes[nome] || null; if (nums.length) tam = nums[nums.length - 1]; break; }
      case 'Tc': tc = nums[0] ?? 0; break;
      case 'Tw': tw = nums[0] ?? 0; break;
      case 'TL': lead = nums[0] ?? 0; break;
      case 'Td': case 'TD':
        if (nums.length >= 2) { if (tok === 'TD') lead = -nums[1]; lx += nums[0] * esc; ly += nums[1] * esc; ir(lx, ly); }
        break;
      case 'Tm': if (nums.length >= 6) { esc = Math.abs(nums[0]) || 1; lx = nums[4]; ly = nums[5]; ir(lx, ly); } break;
      case 'T*': ly -= lead * esc; ir(lx, ly); break;
      case 'Tj': if (strs.length) mostrar(strs[strs.length - 1].str); break;
      case "'": case '"': ly -= lead * esc; ir(lx, ly); if (strs.length) mostrar(strs[strs.length - 1].str); break;
      case 'TJ': {
        const a = pilha.find((p) => p.arr)?.arr || [];
        for (const e of a) {
          if (e.str) mostrar(e.str);
          else if ('num' in e) {
            const d = -e.num / 1000 * tam * esc;
            if (d > tam * esc * 0.2 && atual && !/\s$/.test(atual)) atual += ' ';
            x += d;
          }
        }
        break;
      }
      default: break;
    }
    pilha = [];
  }
  quebra();
  return linhas;
}

/** Texto do PDF, uma linha por linha visual, páginas em ordem. */
export function extrairTextoPdf(buf) {
  return extrairLinhasPdf(buf).map((l) => l.texto).join('\n');
}

/** Linhas visuais { x (início horizontal), texto }, páginas em ordem. */
export function extrairLinhasPdf(buf) {
  if (!buf || buf.subarray(0, 5).toString('latin1') !== '%PDF-') return [];
  const objs = lerObjetos(buf);
  const paginas = [];
  const visitar = (num, prof = 0) => {
    const o = objs.get(num);
    if (!o || prof > 50) return;
    if (/\/Type\s*\/Pages\b/.test(o.dict)) {
      const kids = (o.dict.match(/\/Kids\s*\[([^\]]*)\]/) || [])[1] || '';
      for (const k of kids.matchAll(/(\d+)\s+0\s+R/g)) visitar(Number(k[1]), prof + 1);
    } else if (/\/Type\s*\/Page\b/.test(o.dict)) paginas.push(num);
  };
  const raiz = [...objs.values()].find((o) => /\/Type\s*\/Catalog/.test(o.dict));
  if (raiz) visitar(ref(raiz.dict, 'Pages'));
  if (!paginas.length) for (const [n, o] of objs) if (/\/Type\s*\/Page\b/.test(o.dict)) paginas.push(n);
  const saida = [];
  for (const p of paginas) {
    const d = objs.get(p).dict;
    const fdict = dictDe(objs, dictDe(objs, d, 'Resources'), 'Font');
    const fontes = {};
    for (const m of fdict.matchAll(/\/([^\s/<>]+)\s+(\d+)\s+0\s+R/g)) fontes[m[1]] = fonte(objs, Number(m[2]));
    let conts = [];
    const arr = d.match(/\/Contents\s*\[([^\]]*)\]/);
    if (arr) conts = [...arr[1].matchAll(/(\d+)\s+0\s+R/g)].map((x) => Number(x[1]));
    else { const r = ref(d, 'Contents'); if (r != null) conts = [r]; }
    const partes = [];
    for (const c of conts) { partes.push(objs.get(c)?.stream || Buffer.alloc(0)); partes.push(Buffer.from('\n')); }
    saida.push(...textoDaPagina(Buffer.concat(partes), fontes));
  }
  return saida;
}

/**
 * Separa os parágrafos da exposição de motivos, sem resumir. O cabeçalho vai até o vocativo
 * ("Senhor Presidente da República,"). Se o documento numera os parágrafos ("1.", "2." ou "1", "2"
 * em sequência), usa a numeração oficial (numerado_na_fonte = true); senão, separa pelo recuo
 * da primeira linha e numera na ordem de leitura (numerado_na_fonte = false).
 * linhas: [{ x, texto }]. Retorna { cabecalho: string[], paragrafos: [{ numero, texto }], numerado_na_fonte }.
 */
export function paragrafos(linhas) {
  linhas = linhas.filter((l) => l.texto.trim());
  const iv = linhas.findIndex((l) => /^(Excelent[íi]ssim[oa] )?Senhor(a)? Presidente da Rep[úu]blica,?$/i.test(l.texto));
  const cabecalho = linhas.slice(0, iv + 1).map((l) => l.texto);
  const corpo = linhas.slice(iv + 1);
  const numerados = [];
  let atual = null, esperado = 1;
  for (const l of corpo) {
    const m = l.texto.match(/^(\d{1,3})\s?\.?()$/) || l.texto.match(/^(\d{1,3})(?:\s?\.\s*|\s+)(\S.*)$/);
    if (m && Number(m[1]) === esperado) { atual = { numero: esperado, texto: m[2] }; numerados.push(atual); esperado++; continue; }
    if (atual) atual.texto += ' ' + l.texto;
  }
  // Ligaduras tipográficas (ﬁ, ﬂ…) viram as letras que representam; o texto não muda.
  const LIG = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' };
  const limpar = (ps) => ps.map((p) => ({ numero: p.numero, texto: p.texto.replace(/[ﬀ-ﬆ]/g, (c) => LIG[c] || c).replace(/\s+/g, ' ').trim().replace(/^\.\s*/, '') }));
  if (numerados.length >= 2) return { cabecalho, paragrafos: limpar(numerados), numerado_na_fonte: true };
  // Sem numeração: recuo da primeira linha em relação à margem mais comum.
  const freq = new Map();
  for (const l of corpo) freq.set(l.x, (freq.get(l.x) || 0) + 1);
  const margem = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const ps = [];
  if (iv < 0) return { cabecalho, paragrafos: [], numerado_na_fonte: false };
  for (const l of corpo) {
    if (!ps.length || l.x > margem + 10) ps.push({ numero: ps.length + 1, texto: l.texto });
    else ps[ps.length - 1].texto += ' ' + l.texto;
  }
  return { cabecalho, paragrafos: ps.length >= 2 ? limpar(ps) : [], numerado_na_fonte: false };
}
