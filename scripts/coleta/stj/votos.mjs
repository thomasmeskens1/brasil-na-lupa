// Leitura do texto oficial do resultado do julgamento (campo "decisao" do espelho do acórdão ou
// parágrafo inicial da íntegra). Só busca expressões literais; nada é inferido.
// O resultado da pré-extração dos votos sai SEMPRE com situacao_conferencia "pendente":
// o site não exibe votos individuais antes da conferência humana (diretriz 5).
import { normalizarEspacos, dataISO } from './lib.mjs';

const TRAT = String.raw`(?:(?:o|a|os|as)\s+)?(?:Exm[oa]s?\.\s+)?Sr[as]*\.\s+Ministr[oa]s?\s+`;
const MAIUSC = 'A-ZÁÉÍÓÚÂÊÔÃÕÇÀÜ';
// Ponto final que não é de abreviatura (Sr., Sra., Srs., Exma., n., art., fls.…).
const FIM_FRASE = String.raw`(?<!\b(?:Sr|Sra|Srs|Sras|Dr|Dra|Drs|Exm[oa]s?|n|nº|art|arts|fls?|inc|al|Min))\.(?:\s+(?=[${MAIUSC}(])|$)`;

/** Frases de sustentação oral (nomeiam advogados): omitidas do texto guardado (diretriz 12). */
const RE_SUSTENTACAO = new RegExp(String.raw`(?:Sustent|Fal|Manifest)(?:ou|aram)(?:-se)?\s+oralmente[\s\S]*?(?:${FIM_FRASE}|$)`, 'g');

/**
 * Prepara o texto oficial: guarda literal, mas omite frases de sustentação oral (nomes de advogados).
 * Retorna { texto, omitidos[] }.
 */
export function prepararTexto(bruto) {
  const omitidos = [];
  const texto = String(bruto ?? '').replace(RE_SUSTENTACAO, () => {
    omitidos.push('Frase sobre sustentação oral omitida: nomeia advogados, que não são agentes públicos (diretriz 12)');
    return '[trecho omitido] ';
  });
  if (/\bDr[as]?\.\s|\bOAB\b/.test(texto)) {
    omitidos.push('O texto pode conter nome de advogado ("Dr."/"OAB"): conferir antes de exibir');
  }
  return { texto, omitidos };
}

/** Fim de trecho: antes de ", nos termos", ", conforme", " e, ", ";" ou fim de sentença. */
function cortar(t, comDoisPontos = true) {
  const re = new RegExp(String.raw`,\s+nos termos|,\s+conforme|\s+e,\s+|;|${FIM_FRASE}${comDoisPontos ? '|:\\s' : ''}`);
  const fim = t.search(re);
  const s = fim >= 0 ? t.slice(0, fim) : t;
  return s.length > 600 ? s.slice(0, 600) + '…' : s;
}

/** Expressões literais "por unanimidade" / "por maioria" e o trecho em que aparecem. */
export function resultadoLiteral(texto) {
  const t = normalizarEspacos(texto);
  const trechos = [];
  for (const m of t.matchAll(/por (unanimidade|maioria)/gi)) {
    trechos.push({ expressao: m[0].toLowerCase(), trecho: cortar(t.slice(m.index)) });
  }
  const tipos = new Set(trechos.map((x) => x.expressao));
  let resultado = null;
  if (tipos.size === 1) resultado = tipos.has('por unanimidade') ? 'unanimidade' : 'maioria';
  else if (tipos.size === 2) resultado = 'unanimidade-e-maioria';
  return { resultado, trechos };
}

/** Separa uma lista de nomes "A, B (voto-vista) e C" a partir do início de s. */
function lerNomes(s) {
  const parens = [];
  let x = s.replace(/\(([^)]*)\)/g, (_, c) => { parens.push(c.trim()); return `§${parens.length - 1}§`; });
  const fim = x.search(/,\s+(?=[a-zà-ú])|\s+(?:votaram|votou|acompanh)|;|\.\s|\.$|:\s/);
  if (fim >= 0) x = x.slice(0, fim);
  const partes = x.split(/,\s*|\s+e\s+/).map((p) => p.trim()).filter(Boolean);
  const nomes = [];
  const falhas = [];
  const reNome = new RegExp(String.raw`^[${MAIUSC}][\p{L}'’-]*(\s+([${MAIUSC}][\p{L}'’.-]*|de|da|do|dos|das|e))*$`, 'u');
  for (const p of partes) {
    const obs = [];
    const nome = p.replace(/\s*§(\d+)§\s*/g, (_, i) => { obs.push(parens[Number(i)]); return ' '; }).trim();
    if (!reNome.test(nome)) { falhas.push(p.replace(/§(\d+)§/g, (_, i) => `(${parens[Number(i)]})`)); continue; }
    nomes.push({ nome, observacao: obs.length ? obs.join('; ') : null });
  }
  return { nomes, falhas };
}

/** Pré-extração dos votos citados no texto. Tudo literal; situação de conferência: pendente. */
export function preExtrairVotos(texto, { relatorCampo = null } = {}) {
  const t = normalizarEspacos(texto);
  const votos = [];
  const ausentes = [];
  const naoReconhecidos = [];
  const add = (lista, extra) => {
    for (const n of lista.nomes) votos.push({ nome: n.nome, ...extra, observacao: n.observacao });
    naoReconhecidos.push(...lista.falhas);
  };

  if (relatorCampo) votos.push({ nome: relatorCampo, voto: 'relator', com: null, observacao: 'nome conforme o campo ministroRelator da fonte' });

  // "Os Srs. Ministros A, B e C votaram com o Sr. Ministro Relator." / "O Sr. Ministro A votou com …"
  const reAcomp = new RegExp(String.raw`(?:^|[\s.)])(?:Os|As|O|A)\s+Sr[as]*\.\s+Ministr[oa]s?\s+(.+?)\s+vot(?:aram|ou)\s+com\s+((?:o\s+Sr\.\s+Ministro|a\s+Sra\.\s+Ministra)\s+[^.;]+)`, 'g');
  for (const m of t.matchAll(reAcomp)) {
    const com = m[2].trim();
    const relator = /^(o Sr\. Ministro Relator|a Sra\. Ministra Relatora)$/.test(com);
    add(lerNomes(m[1] + ' votaram'), { voto: relator ? 'acompanhou-relator' : 'acompanhou', com });
  }

  // "vencido(s) o(s) Sr(s). Ministro(s) …"
  const reVenc = new RegExp(String.raw`vencid[oa]s?,?\s+${TRAT}`, 'gu');
  for (const m of t.matchAll(reVenc)) {
    const antes = t.slice(Math.max(0, m.index - 250), m.index);
    const k = Math.max(antes.lastIndexOf('por maioria'), antes.lastIndexOf('Por maioria'));
    const inicio = k >= 0 ? m.index - (antes.length - k) : m.index;
    add(lerNomes(t.slice(m.index + m[0].length)), { voto: 'vencido', com: null, trecho: cortar(t.slice(inicio), false) });
  }

  // Ausências, impedimentos, suspeições e não participação.
  const reAus = new RegExp(String.raw`(Ausentes?,\s*\p{L}+mente|Não participa(?:ram|ou) do julgamento|Impedid[oa]s?(?:,\s*[^,.]{1,40},)?|Afirm(?:ou|aram) suspeição|Declar(?:ou|aram)-se (?:impedid|suspeit)\p{L}*|Licenciad[oa]s?)\s*,?\s+${TRAT}`, 'gu');
  for (const m of t.matchAll(reAus)) {
    const l = lerNomes(t.slice(m.index + m[0].length));
    for (const n of l.nomes) ausentes.push({ nome: n.nome, motivo_texto: m[1].replace(/,\s*$/, ''), observacao: n.observacao });
    naoReconhecidos.push(...l.falhas);
  }

  const um = (re) => { const m = t.match(re); return m ? m[1].trim() : null; };
  const presidente = um(/Presidiu o julgamento (?:o|a) Sr[a]?\.\s+Ministr[oa]\s+([^.;(]+?)(?=\s*(?:\.|;|\(|$))/);
  const relatorAcordao = um(/Lavrará o acórdão (?:o|a) Sr[a]?\.\s+Ministr[oa]\s+([^.;(]+?)(?=\s*(?:\.|;|\(|$))/);
  const sv = t.match(/Sessão Virtual de (\d{2}\/\d{2}\/\d{4}) a (\d{2}\/\d{2}\/\d{4})/i);

  return {
    situacao_conferencia: 'pendente',
    metodo: 'Busca literal de expressões no texto oficial ("votaram com", "vencido", "Ausente", "Não participou", "Impedido", "Presidiu o julgamento", "Lavrará o acórdão"). Não exibir antes da conferência.',
    relator: relatorCampo,
    relator_acordao: relatorAcordao,
    presidente,
    sessao_virtual: sv ? { inicio: dataISO(sv[1]), fim: dataISO(sv[2]) } : null,
    votos,
    ausentes,
    trechos_nao_reconhecidos: [...new Set(naoReconhecidos)],
  };
}

/**
 * Etapa pela sigla da classe da fonte: ProAfR/ProRQF → afetação; EDcl → embargos; classe simples do próprio
 * processo (ex.: "REsp", sem "no/na") ou igual à do Processos.csv → mérito; demais (AgInt no…, QO no…) → outro.
 */
export function etapaPorClasse(siglaClasse, classeParadigma) {
  const s = String(siglaClasse || '').trim();
  if (/^EDcl\b/.test(s)) return 'embargos';
  if (/^ProAfR\b|^ProRQF\b/.test(s)) return 'afetacao';
  if ((classeParadigma && s === classeParadigma) || (s && !/\sn[oa]s?\s/.test(s))) return 'merito';
  return 'outro';
}
