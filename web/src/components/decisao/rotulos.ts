/**
 * Rótulos e funções puras do Cartão de Decisão (seguras no navegador e no servidor).
 *
 * Uso:
 *   resolverTitulo({ tituloOficial: "PLP 108/2024", simples: titulos.itens[id], subtituloOficial })
 *   placarOficial({ sim: 330, nao: 104, outros: 1 })  // → [{rotulo:"Sim",valor:330}, …]
 *   formatarData("2025-12-15")                         // → "15/12/2025"
 */
import type {
  ArquivoDestaques,
  Caminho,
  DadoChave,
  Destaque,
  FormaDecisao,
  ItemPlacar,
  OrigemTitulo,
  TituloSimples,
} from "./tipos";

export const NAO_DISPONIVEL = "Informação não disponível em fonte oficial";

/** Nome curto (selo) e nome por extenso (diretriz 9) de cada caminho conhecido. */
export const CAMINHOS: Record<string, { curto: string; extenso: string }> = {
  camara: { curto: "Câmara", extenso: "Câmara dos Deputados" },
  senado: { curto: "Senado", extenso: "Senado Federal" },
  congresso: { curto: "Congresso", extenso: "Congresso Nacional" },
  presidencia: { curto: "Presidência", extenso: "Presidência da República" },
  confaz: { curto: "CONFAZ", extenso: "Conselho Nacional de Política Fazendária (CONFAZ)" },
  alesp: { curto: "ALESP", extenso: "Assembleia Legislativa do Estado de São Paulo (ALESP)" },
  "governador-sp": { curto: "Governo de SP", extenso: "Governador do Estado de São Paulo" },
  stf: { curto: "STF", extenso: "Supremo Tribunal Federal (STF)" },
  stj: { curto: "STJ", extenso: "Superior Tribunal de Justiça (STJ)" },
  tcu: { curto: "TCU", extenso: "Tribunal de Contas da União (TCU)" },
  "tce-sp": { curto: "TCE-SP", extenso: "Tribunal de Contas do Estado de São Paulo (TCE-SP)" },
  "camara-atibaia": { curto: "Câmara de Atibaia", extenso: "Câmara Municipal de Atibaia" },
  "prefeitura-atibaia": { curto: "Prefeitura de Atibaia", extenso: "Prefeitura de Atibaia" },
};

export function rotuloCaminho(c: Caminho, extenso = false): string {
  const r = CAMINHOS[c];
  return r ? (extenso ? r.extenso : r.curto) : c;
}

/** Forma da decisão em texto (diretriz 5). */
export const FORMAS: Record<FormaDecisao, string> = {
  "votacao-nominal": "votação nominal",
  "votacao-simbolica": "votação simbólica, sem voto individual registrado",
  "votacao-secreta": "votação secreta, sem voto individual divulgado",
  colegiado: "decisão de órgão colegiado, sem votação de parlamentares",
  "ato-individual": "ato individual, sem votação",
  julgamento: "julgamento",
};

/** Origem do título simples, em texto (vazio quando é o próprio título oficial). */
export const ORIGENS: Record<OrigemTitulo, string> = {
  estruturado: "montado só com campos estruturados do documento oficial, por modelo fixo",
  "apelido-oficial": "apelido oficial da proposição",
  "explicacao-oficial": "explicação oficial da ementa",
  "agencia-camara": "Agência Câmara de Notícias",
  "agencia-senado": "Agência Senado",
  modelo: "montado só com campos do documento oficial",
  oficial: "",
};

/** Data AAAA-MM-DD (ou ISO com hora) → DD/MM/AAAA. Outro formato volta como veio. */
export function formatarData(v: string | null | undefined): string {
  if (!v) return NAO_DISPONIVEL;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

export function formatarNumero(n: number): string {
  return n.toLocaleString("pt-BR");
}

/**
 * Regra dos títulos (substitui a antiga chave geral): só aparece no lugar do oficial o título de
 * origem "estruturado" (modelo fixo montado de campos estruturados) que o verificador aprovou
 * (verificacao.aprovado_pelo_verificador === true), com números conferidos, sem palavra proibida e
 * sem veto de analista. Qualquer outra origem — inclusive as antigas reescritas de ementa e
 * manchetes — nunca aparece: vale o título oficial.
 */
export function tituloAprovado(s: TituloSimples | null | undefined): s is TituloSimples {
  if (!s || typeof s.titulo !== "string" || !s.titulo.trim()) return false;
  if (s.origem !== "estruturado") return false;
  const v = s.verificacao;
  if (!v || v.aprovado_pelo_verificador !== true) return false;
  if (v.numeros_e_datas_conferidos === false || v.verbo_permitido === false) return false;
  if (Array.isArray(v.palavras_proibidas) && v.palavras_proibidas.length > 0) return false;
  if (v.veto_vies !== null && v.veto_vies !== undefined && v.veto_vies !== false) return false;
  return true;
}

/** Etiqueta curta e segura vinda do arquivo de títulos (montada só de campos estruturados e verificada). */
export function etiquetaDe(s: TituloSimples | null | undefined): string | null {
  const e = typeof s?.etiqueta === "string" ? s.etiqueta.trim() : "";
  if (!e || e.length > LIMITE_ETIQUETA) return null;
  if (s?.verificacao && s.verificacao.aprovado_pelo_verificador === false) return null;
  return e;
}

export const LIMITE_ETIQUETA = 60;

/**
 * Etiqueta a partir do dado-chave, quando o arquivo de títulos não traz uma: só do que já é campo
 * estruturado (placar nominal e resultado do órgão, votação simbólica, antes → depois).
 * Mesmo formato para qualquer desfecho (diretriz 11): "Aprovado 312 × 140" / "Rejeitado 140 × 312".
 */
export function etiquetaDoDado(d: DadoChave | null | undefined): string | null {
  if (!d) return null;
  const palavra = (r?: string | null) =>
    !r ? null : /^aprovad/i.test(r.trim()) ? "Aprovado" : /^rejeitad/i.test(r.trim()) ? "Rejeitado" : null;
  switch (d.tipo) {
    case "placar": {
      const p = palavra(d.resultado);
      if (!p) return null;
      const sim = d.itens.find((i) => i.rotulo === "Sim")?.valor;
      const nao = d.itens.find((i) => i.rotulo === "Não")?.valor;
      if (typeof sim !== "number" || typeof nao !== "number") return p;
      // placar que contradiz o resultado (ex.: quórum qualificado) fica só com o resultado
      if ((p === "Aprovado" && sim < nao) || (p === "Rejeitado" && sim > nao)) return p;
      return `${p} ${formatarNumero(sim)} × ${formatarNumero(nao)}`;
    }
    case "simbolica": {
      const p = palavra(d.resultado);
      return p ? `${p} em votação simbólica` : null;
    }
    case "mudanca": {
      if (!d.antes || !d.depois) return null;
      const base = `De ${d.antes} para ${d.depois}${d.unidade ? ` ${d.unidade}` : ""}`;
      return base.length <= LIMITE_ETIQUETA ? base : null;
    }
    default:
      return null;
  }
}

/**
 * Corta texto longo em fim de palavra (nunca no meio), sem pontuação pendurada no fim.
 * { curto, cortado } — com cortado = true a interface mostra "…" e "ler tudo".
 */
export function cortarEmPalavra(texto: string, limite: number): { curto: string; cortado: boolean } {
  const t = texto.trim();
  if (!limite || t.length <= limite) return { curto: t, cortado: false };
  const corte = t.slice(0, limite + 1);
  const ultimoEspaco = corte.lastIndexOf(" ");
  const base = ultimoEspaco > limite * 0.6 ? corte.slice(0, ultimoEspaco) : t.slice(0, limite);
  return { curto: base.replace(/[\s,;:–—-]+$/u, ""), cortado: true };
}

export interface TituloResolvido {
  /** Texto do h1/h3. */
  titulo: string;
  /** Nome oficial por extenso (não repete o título). */
  subtitulo: string | null;
  tema: string | null;
  /** true quando o título é o simples (aprovado). */
  simples: boolean;
  /** Origem legível do título simples ("" quando é o oficial). */
  origem: string;
  /** Link da origem do título simples, quando houver. */
  fonteTitulo: { url: string; titulo?: string | null } | null;
  /** Etiqueta estruturada do arquivo de títulos (vale também com o título oficial). */
  etiqueta: string | null;
}

/** Escolhe o título simples aprovado ou cai no oficial. */
export function resolverTitulo(p: {
  tituloOficial: string;
  simples?: TituloSimples | null;
  subtituloOficial?: string | null;
  tema?: string | null;
}): TituloResolvido {
  const ok = tituloAprovado(p.simples);
  const s = ok ? p.simples! : null;
  const titulo = (s?.titulo ?? p.tituloOficial).trim();
  let subtitulo = (s?.subtitulo ?? p.subtituloOficial ?? "").trim() || null;
  // Com o título simples, o nome oficial é obrigatório logo abaixo (engajamento, seção 3.2).
  if (s && !subtitulo && p.tituloOficial.trim() !== titulo) subtitulo = p.tituloOficial.trim();
  if (subtitulo === titulo) subtitulo = null;
  const origemChave = (s?.origem ?? "oficial") as OrigemTitulo;
  const origem = s ? (ORIGENS[origemChave] ?? "") : "";
  const f = s?.fonte;
  const fonteTitulo = !f ? null : typeof f === "string" ? { url: f } : f.url ? f : null;
  return {
    titulo,
    subtitulo,
    tema: (p.tema ?? s?.tema ?? p.simples?.tema ?? null) || null,
    simples: !!s,
    origem,
    fonteTitulo: fonteTitulo && /^https?:\/\//.test(fonteTitulo.url) ? fonteTitulo : null,
    etiqueta: etiquetaDe(p.simples),
  };
}

/**
 * Mantida por compatibilidade (módulos de features/ ainda a consultam para carregar os arquivos de
 * títulos). A decisão de mostrar ou não um título deixou de ser uma chave única: é a regra de
 * tituloAprovado() — só "estruturado" aprovado pelo verificador; o resto, título oficial.
 */
export const TITULOS_SIMPLES_ATIVOS = true;

/** Busca o registro de um item num arquivo dados/titulos/<secao>.json (tema, etiqueta e título). */
export function tituloSimplesDe(
  arquivo: { itens?: Record<string, TituloSimples> } | null | undefined,
  id: string,
): TituloSimples | null {
  return arquivo?.itens?.[id] ?? null;
}

/** Destaques da página inicial (dados/titulos/destaques.json): só os aprovados por pessoa, completos. */
export function destaquesAprovados(arquivo: ArquivoDestaques | null | undefined): Destaque[] {
  return (arquivo?.itens ?? []).filter(
    (d) =>
      d?.status === "aprovado" &&
      typeof d.titulo === "string" &&
      d.titulo.trim() !== "" &&
      typeof d.texto === "string" &&
      d.texto.trim() !== "" &&
      typeof d.item_id === "string" &&
      !!d.fonte &&
      /^https?:\/\//.test(d.fonte.url) &&
      Array.isArray(d.apoio) &&
      d.apoio.length > 0,
  );
}

/** Ordem fixa e igual para todos (diretriz 6). */
const ORDEM_PLACAR: [string, string][] = [
  ["sim", "Sim"],
  ["nao", "Não"],
  ["abstencao", "Abstenção"],
  ["obstrucao", "Obstrução"],
  ["outros", "Outros"],
];

/**
 * Monta o placar completo na ordem oficial fixa, com todas as opções que a fonte informa
 * (zeros incluídos). Chaves extras (ex.: { "Art. 17": 1 }) vão no fim, como vieram.
 */
export function placarOficial(p: Record<string, number | null | undefined>): ItemPlacar[] {
  const usados = new Set<string>();
  const itens: ItemPlacar[] = [];
  for (const [k, r] of ORDEM_PLACAR) {
    if (typeof p[k] === "number") {
      itens.push({ rotulo: r, valor: p[k] as number });
      usados.add(k);
    }
  }
  for (const [k, v] of Object.entries(p)) {
    if (!usados.has(k) && typeof v === "number" && k !== "total") itens.push({ rotulo: k, valor: v });
  }
  return itens;
}

/** Placar em uma linha de texto: "Sim 330, Não 104, Outros 1". */
export function placarEmTexto(itens: ItemPlacar[]): string {
  return itens.map((i) => `${i.rotulo} ${formatarNumero(i.valor)}`).join(", ");
}

/** Dado-chave em uma frase curta (texto de compartilhamento, alt de imagem). */
export function dadoEmTexto(d: DadoChave | null | undefined): string {
  if (!d) return "";
  switch (d.tipo) {
    case "mudanca": {
      const u = d.unidade ? ` ${d.unidade}` : "";
      const item = d.item ? `${d.item}: ` : "";
      const vig = d.vigencia ? ` a partir de ${formatarData(d.vigencia)}` : "";
      return `${item}antes ${d.antes ?? NAO_DISPONIVEL}; depois ${d.depois ?? NAO_DISPONIVEL}${u}${vig}.`;
    }
    case "placar":
      return `Placar oficial: ${placarEmTexto(d.itens)}${d.resultado ? `. Resultado: ${d.resultado}` : ""}.`;
    case "simbolica":
      return `Votação simbólica, sem voto individual registrado${d.resultado ? `. Resultado: ${d.resultado}` : ""}.`;
    case "sem-votacao":
      return `Decisão sem votação: ${d.caminho}.`;
    case "contagem":
      return `${d.legenda ? `${d.legenda}: ` : ""}${placarEmTexto(d.itens)}.`;
    case "texto":
      return `${d.rotulo ? `${d.rotulo}: ` : ""}${d.texto}`;
  }
}
