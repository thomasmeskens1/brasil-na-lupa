// Regras do verificador de títulos (lista versionada no repositório).
import { numerosDe } from './texto.mjs';

/** Verbos de decisão (lista fechada) — usados pelos modelos e aceitos nas manchetes. */
export const VERBOS_DECISAO = [
  'aprova', 'rejeita', 'mantém', 'derruba', 'adia', 'retira', 'muda', 'encerra', 'vota', 'edita', 'veta',
  'sanciona', 'promulga', 'decide', 'fixa tese', 'analisa', 'cancela', 'nega', 'reconhece', 'julga', 'emite parecer',
  'passa de', 'prorroga', 'isenta', 'autoriza', 'aprovam', 'rejeitam', 'mantêm', 'derrubam', 'conclui', 'concluem',
  'aprovada', 'aprovado', 'rejeitada', 'rejeitado', 'sancionada', 'sancionado', 'promulgada', 'promulgado',
  'mantido', 'mantida', 'derrubado', 'derrubada', 'vetado', 'vetada', 'vetados', 'editada', 'publicada', 'publicado',
  'julgou', 'negou', 'deu', 'referendou', 'homologou', 'conheceu', 'acolheu', 'rejeitou', 'declarou',
];

export const PALAVRAS_PROIBIDAS = [
  'vitória', 'vitorioso', 'vitoriosa', 'derrota', 'derrotado', 'derrotada', 'vencedor', 'vencedora', 'perdedor',
  'perdedora', 'goleada', 'virada', 'polêmico', 'polêmica', 'polêmicos', 'polêmicas', 'absurdo', 'absurda',
  'histórico', 'histórica', 'trator', 'manobra', 'rasteira', 'pacote', 'farra', 'bomba', 'taxação', 'finalmente',
  'às pressas', 'silenciosamente', 'abusivo', 'abusiva', 'escândalo', 'golpe', 'empate técnico', 'torcida',
  'artilheiro', 'ranking', 'cartão vermelho', 'governo sofre', 'oposição impõe', 'time do governo', 'time da oposição',
  'a favor do país', 'contra o país', 'a favor do povo', 'contra o povo', 'contra o trabalhador', 'a favor do trabalhador',
  'esmaga', 'humilha', 'racha', 'enterra', 'surpreende', 'arrasa', 'catastrófico', 'vergonha', 'heroico',
];

/** Siglas aceitas em caixa alta (não são nomes de pessoas). */
const SIGLAS = new Set(['ICMS', 'IPVA', 'IPTU', 'IBS', 'CBS', 'STF', 'STJ', 'TCU', 'SUS', 'INSS', 'CONFAZ', 'ALESP', 'PEC',
  'MP', 'CPI', 'CPMI', 'FGTS', 'IPI', 'IOF', 'ISS', 'PIS', 'COFINS', 'ANTT', 'ANA', 'CNMP', 'CNJ', 'OAB', 'MEI', 'BNDES',
  'PIB', 'LDO', 'LOA', 'PPA', 'GLP', 'CLT', 'ECA', 'BPC', 'SP', 'DF', 'TSE', 'MPU', 'CAE', 'CCJ', 'CMO', 'ARSESP', 'IRPF',
  'ABIN', 'PF', 'PRF', 'CEF', 'FIES', 'ENEM', 'PRONAMPE', 'PNAE', 'IPCA', 'CADÚNICO', 'TSEE', 'CDE', 'CCEE', 'IA', 'UF',
  'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XII', 'TCE', 'RS', 'RJ', 'MG', 'BA', 'PR', 'SC', 'GO', 'CE', 'PE', 'AM', 'PA']);

/** Título oficial sem alteração: é o próprio texto do órgão, então não há o que conferir além da igualdade. */
export const verificacaoOficial = () => ({ numeros_e_datas_conferidos: true, verbo_permitido: true, palavras_proibidas: [], veto_vies: null, texto_oficial_literal: true });

export const LIMITE_DURO = 120; // título de página (doc. de engajamento, 3.1)
export const LIMITE_CARTAO = 90;

const CACHE_NOMES = new Map();
const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const CACHE_RE = new Map();
function contemPalavra(titulo, termo) {
  let re = CACHE_RE.get(termo);
  if (re) return re.test(titulo);
  re = new RegExp(`(^|[^\\p{L}])${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'iu');
  CACHE_RE.set(termo, re);
  return re.test(titulo);
}

/**
 * Verifica um título candidato.
 * ctx: { universo: Set (números/datas oficiais do item), nominal: bool, nomes: string[] (nomes de pessoas
 *        ligados ao item ou conhecidos), titulo_perturbado?: string (mesmo modelo com partido/autor/governo
 *        trocados), exigirVerbo?: bool }
 * Retorna { aprovado, verificacao, motivos[] }.
 */
export function verificarTitulo(titulo, origem, ctx) {
  const motivos = [];
  const t = String(titulo || '');
  if (!t) motivos.push('título vazio');

  // 1. números e datas: todos têm de existir no dado oficial do item
  const faltando = [...numerosDe(t)].filter((n) => !ctx.universo.has(n));
  const numerosOk = faltando.length === 0;
  if (!numerosOk) motivos.push(`número/data ausente do dado oficial: ${faltando.join(', ')}`);

  // 2. verbo da lista fechada (títulos oficiais literais estão dispensados)
  let verboOk = true;
  if (origem !== 'oficial' && ctx.exigirVerbo !== false) {
    verboOk = VERBOS_DECISAO.some((v) => contemPalavra(t, v)) || (ctx.verbosExtras || []).some((v) => contemPalavra(t, v));
    if (!verboOk) motivos.push('sem verbo da lista fechada');
  }

  // 3. palavras proibidas, pontuação de opinião e caixa alta
  // termos jurídicos literais que contêm palavra da lista ("patrimônio histórico", "prática abusiva" do Código de Defesa do Consumidor)
  const tSemTermos = t.replace(/patrim[ôo]nio hist[óo]rico|hist[óo]rico-cultural|pr[áa]tica abusiva/giu, ' ');
  const proibidas = PALAVRAS_PROIBIDAS.filter((p) => contemPalavra(tSemTermos, p));
  if (/[!?]/.test(t)) proibidas.push('pontuação ! ou ?');
  if (/\p{Extended_Pictographic}/u.test(t)) proibidas.push('emoji');
  if (contemPalavra(t, 'placar') && !ctx.nominal) proibidas.push('"placar" sem votação nominal');
  if (/\(\d[\d.]* Sim, \d[\d.]* Não\)/.test(t) && !ctx.nominal) proibidas.push('contagem de votos sem votação nominal');
  if (origem !== 'oficial') {
    const caixaAlta = (t.match(/\b\p{Lu}{2,}\b/gu) || []).filter((w) => !SIGLAS.has(w) && w.length > 3);
    if (caixaAlta.length >= 2) proibidas.push('texto em caixa alta');
  }
  if (proibidas.length) motivos.push(`palavras/forma proibidas: ${proibidas.join(', ')}`);

  // 4. tamanho
  if (t.length > LIMITE_DURO) motivos.push(`mais de ${LIMITE_DURO} caracteres (${t.length})`);

  // 5. nomes de pessoas (particulares; e políticos em decisão coletiva) e identificadores técnicos
  if (origem !== 'oficial') {
    const st = ` ${semAcento(t).replace(/[^\p{L}\d]+/gu, ' ')} `;
    const nome = (ctx.nomes || []).find((n) => {
      if (!n || n.indexOf(' ') < 0) return false;
      let k = CACHE_NOMES.get(n);
      if (k === undefined) { k = ` ${semAcento(n).replace(/[^\p{L}\d]+/gu, ' ').trim()} `; CACHE_NOMES.set(n, k); }
      return k.length > 4 && st.includes(k);
    });
    if (nome) motivos.push(`nome de pessoa no título: ${nome}`);
    if (/(^|[^\p{L}])([Ss]enhora?|[Ss]ra?\.|[Dd]ep\.|[Dd]eputad[oa]|[Ss]enador[a]?|[Vv]ereador[a]?|[Mm]inistr[oa]|[Cc]onselheir[oa]|[Rr]elator[a]?|[Pp]refeit[oa]|[Gg]overnador[a]?)\s+(?!(Bom|Jesus|Deus|Comunitári[oa]|Tutelar|Federal|Estadual|Municipal|Nacional|Geral|Distrital|Substitut[oa])(?![\p{L}]))\p{Lu}\p{Ll}+/u.test(t)) motivos.push('tratamento seguido de nome de pessoa');
    if (/\p{Lu}{3,}\s+(D[EAO]S?\s+)?\p{Lu}{3,}/u.test(t.replace(/\b(ICMS|CONFAZ|ALESP|CADÚNICO|COFINS)\b/g, ''))) motivos.push('possível nome em caixa alta');
  }
  if (/[_`{}<>]|\bnull\b|\bundefined\b/.test(t)) motivos.push('identificador técnico no título');

  // 6. simetria: mesmo modelo, com partido/autor/governo trocados, dá a mesma frase
  let veto = null;
  if (ctx.titulo_perturbado !== undefined && ctx.titulo_perturbado !== t) {
    motivos.push('assimetria: o título muda quando se troca partido/autor/governo');
    veto = 'simetria';
  }

  return {
    aprovado: motivos.length === 0,
    motivos,
    verificacao: {
      numeros_e_datas_conferidos: numerosOk,
      verbo_permitido: verboOk,
      palavras_proibidas: proibidas,
      veto_vies: null,
      ...(veto ? { simetria: false } : {}),
    },
  };
}
