// Leitura da ata da Sessão Especial dentro do PDF do Relatório Analítico e Parecer Prévio (RAPP) do TCDF.
// Funções puras sobre o texto extraído do PDF (pdftotext, páginas separadas por \f). Só trechos literais:
// a proclamação da decisão, o texto da decisão, a frase "é de PARECER que", ressalvas e determinações.
// Nada é deduzido: se um trecho não é achado, o campo fica null e o coletor registra a lacuna.

export const VERSAO_LEITURA = 2;

const MESES = { janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

/** "dd/mm/aaaa" ou "dd.mm.aaaa" → "aaaa-mm-dd" (null se não for data válida). */
export function dataBr(s) {
  const m = String(s || '').match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (!m) return null;
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Linhas de cabeçalho/rodapé repetidas em toda página (assinatura digital, número de página, carimbo da secretaria). */
const RUIDO = [
  /assinado digitalmente|autenticidade|assinado eletronicamente/i,
  /^\s*e-*D+O+C+\b/i,
  /^\s*(ee--|DD[oO]{2})/,
  /^\s*\d{1,4}\s*$/,
  /^\s*Proc(esso)?\.?\s*:?\s*(n[º°o]\s*)?[\d.\-/ ]+(-e)?\s*$/i,
  /^\s*TCDF\s*-\s*ATA DA SESS[ÃA]O/i,
  /^\s*Sess[ãa]o Especial N[º°o]\s*\d+,\s*de\s*[\d/.]+\s*$/i,
  /TCDF\/Secretaria das Sess[õo]es|^\s*Folha:|^\s*Rubrica:|^\s*Processo:\s*$/i,
  /^\s*TRIBUNAL DE CONTAS DO DISTRITO FEDERAL\s*$/,
  /^\s*SECRETARIA DAS SESS[ÕO]ES\s*$/,
  /^\s*PRESID[ÊE]NCIA\s*$/,
];

/** Remove cabeçalhos e rodapés e junta o texto em uma linha (espaços simples). */
export function limpar(texto) {
  return String(texto || '')
    .split(/\r?\n|\f/)
    .filter((l) => !RUIDO.some((re) => re.test(l)))
    .join(' ')
    .replace(/(\w)- (\w)/g, (m, a, b) => (/[a-záéíóúâêôãõç]/.test(a) && /[a-záéíóúâêôãõç]/.test(b) ? a + b : m))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Proporção de letras: PDFs digitalizados sem camada de texto dão quase nada. */
export function textoLegivel(texto) {
  const letras = (String(texto).match(/[A-Za-zÀ-ÿ]/g) || []).length;
  return letras > 5000;
}

// Proclamação final: "... proclamou/proclamo, de acordo com os artigos ..., a DECISÃO [, por unanimidade,] consubstanciada
// (no Parecer Prévio | na aprovação do Parecer Prévio) sobre as Contas do Governo do Distrito Federal, correspondentes ao exercício de AAAA".
const RE_PROCLAMACAO = /proclam(?:ou|o)\b[\s\S]{0,400}?\bDECIS[ÃA]O\b([\s\S]{0,60}?)consubstanciada\s+(?:no|na\s+aprova[çc][ãa]o\s+do)\s+Parecer\s+Pr[ée]vio\s+sobre\s+as\s+Contas\s+do\s+Governo\s+do\s+Distrito\s+Federal,?\s+(?:correspondentes|relativas|referentes)\s+ao\s+exerc[íi]cio\s+de\s+(\d{4})/gi;

/** Última proclamação da decisão no texto limpo: { inicio, fim, exercicio, trecho }. */
export function acharProclamacao(t) {
  let ultima = null;
  for (const m of t.matchAll(RE_PROCLAMACAO)) ultima = m;
  if (!ultima) return null;
  // Início da frase ("Continuando, o Senhor Presidente proclamou ...", "..., proclamo ...").
  const antes = t.slice(Math.max(0, ultima.index - 600), ultima.index);
  const corte = Math.max(antes.lastIndexOf('. '), antes.lastIndexOf('” '), antes.lastIndexOf('" '), antes.lastIndexOf('! '));
  const inicioFrase = corte >= 0 ? ultima.index - antes.length + corte + 2 : ultima.index;
  const fim = ultima.index + ultima[0].length;
  return { inicio: inicioFrase, fim, exercicio: ultima[2], trecho: t.slice(inicioFrase, fim).trim() };
}

/** Frase "Colhidos os votos ..." imediatamente anterior à proclamação (literal) ou null. */
export function frasesDosVotos(t, proc) {
  const janela = t.slice(Math.max(0, proc.inicio - 1500), proc.fim);
  const i = janela.lastIndexOf('Colhidos os votos');
  if (i < 0) return null;
  const frase = janela.slice(i);
  const j = frase.search(/,?\s*(?:o|a)\s+Senhora?\s+Presidente\s+proclamou|,?\s*proclamo\b|\.\s+(?:Continuando|Prosseguindo)/i);
  return (j > 0 ? frase.slice(0, j) : frase).replace(/[,\s]+$/, '').trim();
}

/** Texto da decisão depois de "nos seguintes termos:" (até a aspa de fechamento ou o próximo ato da sessão). */
export function textoDecisao(t, proc) {
  const depois = t.slice(proc.fim, proc.fim + 400);
  const m = depois.match(/^,?\s*nos\s+seguintes\s+termos:\s*/i);
  if (!m) return null;
  const ini = proc.fim + m[0].length;
  const resto = t.slice(ini, ini + 20000);
  const fimAspa = resto.slice(1).search(/[”"]\s+(?=[A-ZÀ-Ú])/);
  const fimAto = resto.search(/\s(?:A seguir|Finalmente|Em seguida|Prosseguindo|Às \d{1,2}h|Ato contínuo),/);
  const cands = [fimAspa >= 0 ? fimAspa + 2 : -1, fimAto].filter((x) => x > 0);
  const fim = cands.length ? Math.min(...cands) : -1;
  if (fim < 0) return null; // sem fim reconhecível: não arrisca cortar no lugar errado
  return resto.slice(0, fim).replace(/^[“"]\s*/, '').replace(/\s*[”"]\s*$/, '').trim();
}

/** "é de PARECER que: ..." ou "emitir PARECER no sentido de que ..." dentro da decisão, até "RESSALVAS" (literal). */
export function fraseParecer(decisao) {
  if (!decisao) return null;
  const m = decisao.match(/(?:é\s+de\s+PARECER\s+que:?|emitir\s+PARECER\s+no\s+sentido\s+de\s+que)\s*/i);
  if (!m) return null;
  const resto = decisao.slice(m.index);
  const fim = resto.search(ROTULO);
  return (fim > 0 ? resto.slice(0, fim) : resto).replace(/[:;,\s]+$/, '').trim();
}

// Rótulo em caixa alta que abre uma lista ("RESSALVAS:", "RESSALVAS a)", "DETERMINAÇÃO: ...").
// Também "I - Ressalvas:", "II - Determinações:" (parecer de 2020).
const ROTULOS = {
  ressalvas: ['RESSALVAS?', 'Ressalvas?'],
  determinacoes: ['DETERMINA[ÇC](?:[ÃA]O|[ÕO]ES)', 'Determina[çc](?:[ãa]o|[õo]es)'],
  recomendacoes: ['RECOMENDA[ÇC](?:[ÃA]O|[ÕO]ES)', 'Recomenda[çc](?:[ãa]o|[õo]es)'],
  alertas: ['ALERTAS?', 'Alertas?'],
};
const reRotulo = ([caixaAlta, titulo]) => `(?:${caixaAlta}|[IVX]{1,4}\\s*-\\s*${titulo})(?:\\s*:|\\s+(?=[a-z]\\)\\s))`;
const ROTULO = new RegExp(`\\s(?:${Object.values(ROTULOS).map(reRotulo).join('|')})`);

/** Bloco literal entre um rótulo ("RESSALVAS:", "I - Ressalvas:") e o próximo rótulo. */
function bloco(decisao, rotulo) {
  const m = decisao?.match(new RegExp(`\\s${reRotulo(ROTULOS[rotulo])}\\s*`));
  if (!m) return null;
  const resto = decisao.slice(m.index + m[0].length);
  const fim = resto.search(ROTULO);
  return (fim >= 0 ? resto.slice(0, fim) : resto).replace(/[”"]\s*$/, '').trim();
}

/** Divide um bloco nos itens de letra ("a) quanto à ...; b) ...") mantendo o texto literal de cada um. */
export function itensDeLetra(b) {
  if (!b) return [];
  const partes = b.split(/(?:^|(?<=[;:.]\s))(?=[a-z]\)\s)/).map((s) => s.trim().replace(/[;\s]+$/, '')).filter(Boolean);
  return partes.length ? partes : [b];
}

/** Votação literal ("por unanimidade", "por maioria") na decisão ou, na falta, na frase dos votos. */
export function votacao(decisao, votos, proclamacao) {
  for (const s of [decisao, votos, proclamacao]) {
    const m = String(s || '').match(/\bpor\s+(unanimidade|maioria(?:\s+absoluta)?)\b/i);
    if (m) return m[0].toLowerCase();
  }
  return null;
}

/** Cabeçalho da ata mais próximo antes da proclamação: "ATA DA SESSÃO ESPECIAL Nº 543, DE 22/11/2022". */
export function sessaoDaAta(bruto, decisao) {
  const s = String(bruto || '');
  // Só cabeçalhos em caixa alta: citações de atas anteriores ("Ata da Sessão Especial nº 506, de 03.07.2008") não contam.
  // Vale o cabeçalho (ou a abertura da ata) mais próximo antes da proclamação.
  const cands = [];
  for (const m of s.matchAll(/ATA\s+DA\s+SESS[ÃA]O\s+ESPECIAL\s+N[º°o]\s*(\d+)\s*,?\s*DE\s+(\d{1,2}[./]\d{1,2}[./]\d{4})/g)) {
    if (dataBr(m[2])) cands.push({ i: m.index, numero: m[1], data: dataBr(m[2]), literal: m[0].replace(/\s+/g, ' ') });
  }
  // Abertura da ata: "ATA DA SESSÃO ESPECIAL Nº 543 Aos 22 dias de novembro de 2022".
  for (const m of s.matchAll(/ATA\s+DA\s+SESS[ÃA]O\s+ESPECIAL\s+N[º°o]\s*(\d+)\s+Aos\s+(\d{1,2})\s+dias\s+(?:do\s+m[êe]s\s+)?de\s+([a-zç]+)\s+de\s+(\d{4})/g)) {
    const n = MESES[m[3]];
    if (n && Number(m[2]) >= 1 && Number(m[2]) <= 31) cands.push({ i: m.index, numero: m[1], data: `${m[4]}-${String(n).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`, literal: m[0].replace(/\s+/g, ' ') });
  }
  const perto = cands.sort((a, b) => a.i - b.i).at(-1);
  if (perto) return { numero: perto.numero, data: perto.data, literal: perto.literal };
  // Decisões recentes trazem "apresentados na Sessão Especial nº 550, realizada em 26/11/2025".
  const m = String(decisao || '').match(/Sess[ãa]o\s+Especial\s+n[º°o]\s*(\d+),?\s+realizada\s+em\s+(\d{1,2}[./]\d{1,2}[./]\d{4})/i);
  if (m && dataBr(m[2])) return { numero: m[1], data: dataBr(m[2]), literal: m[0] };
  return null;
}

/** Número do processo citado na decisão ("Processo nº 00600-00000689/2024-80-e") ou no carimbo das páginas da ata. */
export function processo(bruto, decisao) {
  // Carimbo das páginas da ata ("e-DOC 87FFDC08 Proc 00600-00000689/2024-80-e"): o último antes da proclamação.
  const p = [...String(bruto || '').matchAll(/\bProc\.?\s+(\d[\d.\-/]{4,30}\d)-e\b/g)].at(-1);
  if (p) return p[1];
  const d = String(decisao || '').match(/Processo\s+(?:TCDF\s+)?n[º°o]\s*(\d[\d.\-/]{4,30}\d)(?:-?e)?\b/i);
  return d ? d[1] : null;
}

/**
 * Ato formal da decisão na ata, quando publicado no PDF:
 * "Sessão Especial Nº 550, de 26/11/2025 PROCESSO Nº ... RELATOR(A) : ... EMENTA : ... DECISÃO Nº 1/2025".
 */
export function atoDecisao(bruto, exercicio) {
  const s = String(bruto || '').replace(/\s+/g, ' ');
  const re = /Sess[ãa]o Especial N[º°o]\s*(\d+),\s*de\s*(\d{1,2}[./]\d{1,2}[./]\d{4})\s+(?:[^]{0,200}?\s)?PROCESSO\s+N[º°o]\s*(\d[\d.\-/]{4,30}\d)(?:-e)?\s+RELATORA?(?:\(A\))?\s*:\s*(.{3,120}?)\s+EMENTA\s*:\s*(.{10,600}?)\s+DECIS[ÃA]O\s+N[º°o]\s*(\d{1,5}\/\d{4})/gi;
  const atos = [...s.matchAll(re)].filter((m) => new RegExp(`exerc[íi]cio\\s+de\\s+${exercicio}\\b`, 'i').test(m[5]));
  const m = atos.at(-1);
  if (!m) return null;
  return { sessao: m[1], data: dataBr(m[2]), processo: m[3], relator_literal: m[4].trim(), ementa: m[5].trim(), numero: m[6] };
}

/** Nomes literais em "sob responsabilidade do Exmo. Sr. Fulano," (chefes do Executivo citados no parecer). */
export function responsaveis(parecer) {
  return [...new Set([...String(parecer || '').matchAll(/sob\s+(?:a\s+)?responsabilidade\s+d[oa]\s+Exm[oa]\.?\s+Sr[a]?\.?\s+([^,;]+?)\s*(?:,|;|$)/gi)].map((m) => m[1].trim()))];
}

/**
 * Conclusão curta, só com palavra da fonte: "aprovação" quando a frase literal diz que as contas "estão tecnicamente
 * aptas a receber aprovação" (e não "não estão"). Qualquer outra redação: null (vale o texto literal).
 */
export function conclusaoCurta(frase) {
  const s = String(frase || '');
  if (!s || /n[ãa]o\s+est[ãa]o\s+tecnicamente/i.test(s)) return { conclusao: null, com_ressalvas: null };
  if (!/est[ãa]o\s+tecnicamente\s+aptas?\s+(?:a|para)\s+receber\s+aprova[çc][ãa]o/i.test(s)) return { conclusao: null, com_ressalvas: null };
  return { conclusao: 'aprovação', com_ressalvas: /\bressalvas?\b/i.test(s) };
}

/** Leitura completa: devolve null se a proclamação da decisão não for achada. */
export function lerAta(bruto) {
  const t = limpar(bruto);
  const proc = acharProclamacao(t);
  if (!proc) return null;
  const votos = frasesDosVotos(t, proc);
  const decisao = textoDecisao(t, proc);
  const parecer = fraseParecer(decisao);
  const fraseConclusao = parecer ?? (votos && /tecnicamente\s+aptas|parecer\s+favor[áa]vel/i.test(votos) ? votos : null);
  const brutoAte = String(bruto).slice(0, Math.max(0, posicaoBruta(bruto)));
  const iVotos = votos ? proc.trecho.indexOf('Colhidos os votos') : -1;
  return {
    exercicio: proc.exercicio,
    proclamacao: iVotos > 0 ? proc.trecho.slice(iVotos) : proc.trecho,
    ato: atoDecisao(bruto, proc.exercicio),
    votos,
    decisao,
    parecer,
    conclusao_literal: fraseConclusao,
    conclusao_fonte: parecer ? 'decisao' : fraseConclusao ? 'votos' : null,
    ...conclusaoCurta(fraseConclusao),
    ressalvas: itensDeLetra(bloco(decisao, 'ressalvas')),
    determinacoes: itensDeLetra(bloco(decisao, 'determinacoes')),
    recomendacoes: itensDeLetra(bloco(decisao, 'recomendacoes')),
    votacao: votacao(decisao, votos, proc.trecho),
    sessao: sessaoDaAta(brutoAte || bruto, decisao),
    processo: processo(brutoAte || bruto, decisao),
    responsaveis: responsaveis(parecer),
  };
}

/** Posição aproximada (no texto bruto) da proclamação: só para limitar a busca do cabeçalho da ata. */
function posicaoBruta(bruto) {
  const m = [...String(bruto).matchAll(/consubstanciada\s+(?:no|na\s+aprova[çc][ãa]o\s+do)\s+Parecer\s+Pr[ée]vio\s+sobre\s+as\s+Contas\s+do\s+Governo/gi)].at(-1);
  return m ? m.index + 2000 : String(bruto).length;
}
