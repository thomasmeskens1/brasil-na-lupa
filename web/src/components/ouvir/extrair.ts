/**
 * Extrai do conteúdo principal os blocos de leitura em voz alta, na ordem do documento:
 * títulos (com o nível), parágrafos, itens de lista, pares "termo: definição" (dl), linhas de
 * tabela ("Partido: MDB; Estado: AP") e o texto alternativo das imagens.
 *
 * Pula o que não é conteúdo para quem ouve: elementos escondidos (hidden, display:none, details
 * fechado), aria-hidden, figurinhas e ícones, menus (nav), formulários de busca, botões e campos
 * (exceto o termo do glossário, que faz parte da frase), texto só para leitor de tela (.sr-only)
 * e o que tiver data-nao-ler. O texto vem de textContent (sem a caixa alta aplicada pelo CSS).
 */

export interface BlocoLeitura {
  el: HTMLElement;
  /** Texto bruto (sem normalização para a fala). */
  texto: string;
  /** Nível do título (1–6), se for título. */
  titulo?: number;
}

const PULAR = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "canvas",
  "iframe",
  "button:not(.termo-botao)",
  "input",
  "select",
  "textarea",
  "label",
  "nav",
  "[role='navigation']",
  "[role='search']",
  "[aria-hidden='true']",
  "[hidden]",
  "[popover]",
  "dialog:not([open])",
  "[data-nao-ler]",
  ".sr-only:not([data-ler])",
  ".abertura",
].join(",");

const TITULOS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);
const FOLHAS = new Set(["P", "LI", "DT", "DD", "SUMMARY", "BLOCKQUOTE", "FIGCAPTION", "PRE", "CAPTION", "ADDRESS", "LEGEND"]);
const INLINE = new Set([
  "A", "ABBR", "B", "BDI", "BDO", "BR", "CITE", "CODE", "DATA", "DFN", "EM", "I", "KBD", "MARK", "Q", "S", "SAMP",
  "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TIME", "U", "VAR", "WBR", "DEL", "INS", "BUTTON", "IMG", "OUTPUT",
]);

function visivel(el: Element): boolean {
  const e = el as HTMLElement & { checkVisibility?: (o?: object) => boolean };
  if (typeof e.checkVisibility === "function") return e.checkVisibility({ visibilityProperty: true });
  return e.offsetParent !== null || getComputedStyle(e).position === "fixed";
}

function limpo(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

/** Texto de um trecho inline (respeita as regras de pular, lê alt e abbr). */
function textoInline(el: Element, abbrDitas: Set<string>): string {
  let r = "";
  for (const n of el.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) r += n.textContent ?? "";
    else if (n.nodeType === Node.ELEMENT_NODE) {
      const c = n as HTMLElement;
      if (c.matches(PULAR)) continue;
      if (c.tagName === "BR") r += " ";
      else if (c.tagName === "IMG") {
        const alt = c.getAttribute("alt");
        if (alt) r += ` ${alt} `;
      } else if (c.getAttribute("role") === "img") {
        const l = c.getAttribute("aria-label");
        if (l) r += ` ${l} `;
      } else if (c.tagName === "ABBR" && c.title) {
        const s = limpo(c.textContent ?? "");
        // Primeira vez: o nome por extenso; depois, a sigla.
        if (!abbrDitas.has(s)) {
          abbrDitas.add(s);
          r += c.title;
        } else r += s;
      } else {
        const sep = separador(c);
        r += sep + textoInline(c, abbrDitas) + sep;
      }
    }
  }
  return r;
}

/** Elementos que não são inline na tela (selos, flex, blocos) viram palavras separadas na fala. */
function separador(el: Element): string {
  const d = getComputedStyle(el).display;
  return d === "inline" || d === "contents" ? "" : " ";
}

/** Linha de tabela como "Cabeçalho: valor; …" (cabeçalho de linha sem rótulo). */
function textoLinha(tr: HTMLTableRowElement, cabecalhos: string[], abbr: Set<string>): string {
  const partes: string[] = [];
  [...tr.cells].forEach((c, i) => {
    if (c.matches(PULAR)) return;
    const v = limpo(textoInline(c, abbr));
    if (!v) return;
    const rotulo = c.tagName === "TH" ? "" : c.getAttribute("data-rotulo") || cabecalhos[i] || "";
    partes.push(rotulo && rotulo !== v ? `${rotulo}: ${v}` : v);
  });
  return partes.join("; ");
}

export function extrairBlocos(raiz: HTMLElement): BlocoLeitura[] {
  const blocos: BlocoLeitura[] = [];
  const abbr = new Set<string>();
  let atual: { el: HTMLElement; partes: string[]; titulo?: number } | null = null;

  const fechar = () => {
    if (atual) {
      const t = limpo(atual.partes.join(""));
      if (t) blocos.push({ el: atual.el, texto: t, titulo: atual.titulo });
    }
    atual = null;
  };
  const anexar = (el: HTMLElement, t: string) => {
    if (!atual) atual = { el, partes: [] };
    atual.partes.push(t);
  };

  function tabela(t: HTMLTableElement) {
    fechar();
    const cap = t.caption && !t.caption.matches(PULAR) ? limpo(textoInline(t.caption, abbr)) : "";
    if (cap) blocos.push({ el: t.caption as HTMLElement, texto: `Tabela: ${cap}.` });
    const cab = t.tHead?.rows[0] ? [...t.tHead.rows[0].cells].map((c) => limpo(c.textContent ?? "")) : [];
    for (const corpo of t.tBodies) {
      for (const tr of corpo.rows) {
        if (tr.matches(PULAR) || !visivel(tr)) continue;
        const txt = textoLinha(tr, cab, abbr);
        if (txt) blocos.push({ el: tr, texto: txt });
      }
    }
  }

  function lista(dl: HTMLElement) {
    fechar();
    const pares: string[] = [];
    let termo = "";
    const visitar = (el: Element) => {
      for (const c of el.children) {
        if (c.matches(PULAR)) continue;
        if (c.tagName === "DT") termo = limpo(textoInline(c, abbr)).replace(/:$/, "");
        else if (c.tagName === "DD") {
          const v = limpo(textoInline(c, abbr));
          if (v) pares.push(termo ? `${termo}: ${v}` : v);
          termo = "";
        } else if (c.tagName === "DIV") visitar(c);
      }
    };
    visitar(dl);
    if (pares.length) blocos.push({ el: dl, texto: `${pares.join(", ")}.` });
  }

  function percorrer(el: HTMLElement, bloco: HTMLElement) {
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) {
        const t = n.textContent ?? "";
        if (t.trim()) anexar(bloco, t);
        else if (atual) atual.partes.push(" ");
        continue;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const c = n as HTMLElement;
      if (c.matches(PULAR) || !visivel(c)) continue;
      const tag = c.tagName;
      if (tag === "TABLE") {
        tabela(c as HTMLTableElement);
      } else if (tag === "DL") {
        lista(c);
      } else if (TITULOS.has(tag)) {
        fechar();
        const t = limpo(textoInline(c, abbr));
        if (t) blocos.push({ el: c, texto: t, titulo: Number(tag[1]) });
      } else if (c.getAttribute("role") === "heading") {
        fechar();
        const t = limpo(textoInline(c, abbr));
        if (t) blocos.push({ el: c, texto: t, titulo: Number(c.getAttribute("aria-level") ?? 2) });
      } else if (INLINE.has(tag) && c.getAttribute("role") !== "img") {
        const sep = separador(c);
        if (sep) anexar(bloco, sep);
        if (tag === "IMG" || tag === "ABBR" || tag === "BR") anexar(bloco, textoInline({ childNodes: [c] } as unknown as Element, abbr));
        else percorrer(c, bloco);
        if (sep && atual) atual.partes.push(sep);
      } else if (c.getAttribute("role") === "img") {
        const l = c.getAttribute("aria-label");
        if (l) anexar(bloco, ` ${l} `);
      } else if (FOLHAS.has(tag)) {
        fechar();
        percorrer(c, c);
        fechar();
      } else {
        // Contêiner (div, section, ul…): o texto solto dentro dele vira bloco próprio.
        fechar();
        percorrer(c, c);
        fechar();
      }
    }
  }

  percorrer(raiz, raiz);
  fechar();
  return blocos;
}
