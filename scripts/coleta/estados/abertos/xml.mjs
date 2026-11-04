// Leitor de XML mínimo (sem dependências) para as respostas da API de dados abertos da ALEPE.
// Monta uma árvore { tag, attrs, filhos, texto }. Trata CDATA, comentários, declaração, entidades
// numéricas e as cinco nomeadas do XML. Não valida o documento: só o necessário para ler a fonte.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function decodificar(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

export function lerXml(texto) {
  const raiz = { tag: '#raiz', attrs: {}, filhos: [], texto: '' };
  const pilha = [raiz];
  const s = String(texto);
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    const topo = pilha[pilha.length - 1];
    if (lt < 0) { topo.texto += decodificar(s.slice(i)); break; }
    if (lt > i) topo.texto += decodificar(s.slice(i, lt));
    if (s.startsWith('<![CDATA[', lt)) {
      const fim = s.indexOf(']]>', lt);
      topo.texto += s.slice(lt + 9, fim < 0 ? s.length : fim);
      i = fim < 0 ? s.length : fim + 3; continue;
    }
    if (s.startsWith('<!--', lt)) { const fim = s.indexOf('-->', lt); i = fim < 0 ? s.length : fim + 3; continue; }
    if (s[lt + 1] === '?' || s[lt + 1] === '!') { const fim = s.indexOf('>', lt); i = fim < 0 ? s.length : fim + 1; continue; }
    // Fim da tag, ignorando ">" dentro de valores de atributo entre aspas.
    let j = lt + 1, aspa = null;
    for (; j < s.length; j++) {
      const c = s[j];
      if (aspa) { if (c === aspa) aspa = null; } else if (c === '"' || c === "'") aspa = c; else if (c === '>') break;
    }
    const corpo = s.slice(lt + 1, j);
    i = j + 1;
    if (corpo[0] === '/') {
      const nome = corpo.slice(1).trim();
      for (let k = pilha.length - 1; k > 0; k--) if (pilha[k].tag === nome) { pilha.length = k; break; }
      continue;
    }
    const auto = corpo.endsWith('/');
    const m = /^([^\s/>]+)([\s\S]*?)\/?$/.exec(corpo);
    if (!m) continue;
    const no = { tag: m[1], attrs: {}, filhos: [], texto: '' };
    for (const a of m[2].matchAll(/([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) no.attrs[a[1]] = decodificar(a[3] ?? a[4] ?? '');
    topo.filhos.push(no);
    if (!auto) pilha.push(no);
  }
  return raiz.filhos.find((f) => f.tag) || raiz;
}

/** Primeiro filho com a tag (ou caminho "a/b/c"). */
export function filho(no, caminho) {
  let atual = no;
  for (const t of caminho.split('/')) { atual = atual?.filhos.find((f) => f.tag === t); if (!atual) return null; }
  return atual;
}
export const filhos = (no, tag) => (no?.filhos || []).filter((f) => f.tag === tag);
export const textoDe = (no, caminho) => {
  const n = caminho ? filho(no, caminho) : no;
  const t = n?.texto?.replace(/\s+/g, ' ').trim();
  return t || null;
};
