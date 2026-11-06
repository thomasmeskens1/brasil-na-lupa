// HTML do SEI → texto simples, com uma linha por parágrafo. Só remove marcação; não altera palavras.

const ENTIDADES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', ordf: 'ª', deg: '°', sect: '§',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', bull: '•', middot: '·',
  laquo: '«', raquo: '»', copy: '©', reg: '®', sup1: '¹', sup2: '²', sup3: '³', frac12: '½', shy: '', zwnj: '', zwj: '',
};
// Letras acentuadas: &aacute; &Ccedil; &atilde; &ocirc; &uuml; …
const DIACRITICOS = { acute: '́', grave: '̀', circ: '̂', tilde: '̃', uml: '̈', cedil: '̧', ring: '̊' };

function entidade(nome) {
  if (nome in ENTIDADES) return ENTIDADES[nome];
  const m = nome.match(/^([A-Za-z])(acute|grave|circ|tilde|uml|cedil|ring)$/);
  if (m) return (m[1] + DIACRITICOS[m[2]]).normalize('NFC');
  return null;
}

export function decodificarEntidades(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (todo, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      // 128–159 em documentos ISO-8859-1 são caracteres do Windows-1252 (– — “ ”).
      if (n >= 128 && n <= 159) return new TextDecoder('windows-1252').decode(Uint8Array.of(n));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : todo;
    }
    const v = entidade(e);
    return v == null ? todo : v;
  });
}

/** Texto do documento: parágrafos em linhas, espaços simples, sem linhas vazias. */
export function htmlParaTexto(html) {
  let s = String(html);
  s = s.replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<img\b[^>]*>/gi, ' ');
  // Imagem cortada no limite de leitura (sem o ">" final).
  s = s.replace(/<img\b[^>]*$/i, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(br|hr)\b[^>]*>/gi, '\n');
  s = s.replace(/<\/(p|div|tr|li|h[1-6]|table|title)\s*>/gi, '\n');
  s = s.replace(/<\/t[dh]\s*>/gi, ' ');
  s = s.replace(/<[^>]*>/g, ' ');
  // Caracteres de controle C1 vindos do ISO-8859-1 (0x80–0x9F) são, na prática, Windows-1252.
  s = s.replace(/[\u0080-\u009F]/g, (c) => new TextDecoder('windows-1252').decode(Uint8Array.of(c.charCodeAt(0))));
  s = decodificarEntidades(s);
  return s
    .split('\n')
    .map((l) => l.replace(/[\s ​]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}
