// Extração literal do texto integral (campo "conteudo") dos pareceres prévios do TCE-AM.
// Funções puras (sem rede), testadas em testes.mjs. Nada é deduzido: só fórmulas escritas no texto
// oficial são reconhecidas; o que não casar fica null e vira lacuna.
import { normalizar } from './lib.mjs';

/** Linha curta (1 a 3 caracteres): pedaço da tarja vertical "Este documento foi assinado digitalmente…". */
const curta = (l) => { const t = l.trim(); return t.length >= 1 && t.length <= 3; };

/**
 * Limpa o texto: remove a tarja vertical de assinatura (sequências de linhas curtas) e os cabeçalhos
 * repetidos de página ("Estado do Amazonas … Pag. N"), e junta os espaços. O texto em si não é alterado.
 */
export function limparConteudo(conteudo) {
  const linhas = String(conteudo || '').split(/\r?\n/);
  const manter = new Array(linhas.length).fill(true);
  let i = 0;
  while (i < linhas.length) {
    if (!curta(linhas[i])) { i++; continue; }
    let j = i, n = 0, fim = i;
    while (j < linhas.length && (curta(linhas[j]) || !linhas[j].trim())) { if (curta(linhas[j])) { n++; fim = j; } j++; }
    if (n >= 8) for (let k = i; k <= fim; k++) manter[k] = false;
    i = fim + 1;
  }
  let t = linhas.filter((_, k) => manter[k]).join('\n');
  t = t.replace(/Estado do Amazonas\s+TRIBUNAL DE CONTAS[\s\S]{0,700}?Pag\.\s*\d+/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

/** "PARECER PREVIO Nº 23/2024 – TCE – TRIBUNAL PLENO" (primeira ocorrência, no cabeçalho). */
export function numeroLiteral(conteudo) {
  const m = String(conteudo || '').replace(/\s+/g, ' ').match(/PARECER PREVIO N[º°o.]*\s*\d+\s*\/\s*\d{4}\s*[–-]+\s*TCE\s*[–-]+\s*(?:TRIBUNAL PLENO|PRIMEIRA CAMARA|SEGUNDA CAMARA|\d+[ªº]?\s*CAMARA)/);
  return m ? m[0].trim() : null;
}

/** Número e ano do parecer escritos no cabeçalho do texto ("Nº 009/2013" → { numero: '9', ano: '2013' }). */
export function numeroDoTexto(conteudo) {
  const m = String(conteudo || '').replace(/\s+/g, ' ').match(/PARECER PREVIO N[º°o.]*\s*(\d{1,4})\s*\/\s*(\d{4})\b/);
  return m ? { numero: String(Number(m[1])), ano: m[2] } : null;
}

/** Exercício das contas: item "Exercicio: AAAA" do cabeçalho; senão a ementa; senão o campo objeto da API. */
export function extrairExercicio(texto, objeto) {
  const cab = texto.match(/\bExercicio\s*:\s*(\d{4})\b/i);
  const em = texto.match(/\bExercicio de\s*(\d{4})\b/i);
  const ob = String(objeto || '').match(/EXERC[IÍ]CIO(?:\s+FINANCEIRO)?(?:\s+DE)?\s*(\d{4})/i);
  const valor = (cab && cab[1]) || (em && em[1]) || (ob && ob[1]) || null;
  const origem = cab ? 'cabeçalho do parecer ("Exercicio:")' : em ? 'ementa do parecer' : ob ? 'campo "objeto" da API' : null;
  const divergente = cab && ob && cab[1] !== ob[1] ? `O cabeçalho do parecer indica o exercício ${cab[1]} e o campo "objeto" da API indica ${ob[1]}; foi usado o do cabeçalho` : null;
  return { exercicio: valor, origem, divergente };
}

/** "Wilson Miranda Lima (Governador)" — item "Responsavel:" do cabeçalho, literal. */
export function extrairResponsavel(texto) {
  const m = texto.match(/\bResponsave(?:l|is)\s*:\s*(.{3,300}?)\.?\s+\d{1,2}\s*-\s+[A-Z]/);
  return m ? m[1].trim() : null;
}

/** "Conselheiro Mario Manoel Coelho de Mello" — item "Relator:" do cabeçalho, literal. */
export function extrairRelatorTexto(texto) {
  const m = texto.match(/\bRelator(?:a)?\s*:\s*(.{3,120}?)\.?\s+(?:\d{1,2}\s*-\s+[A-Z]|EMENTA)/);
  return m ? m[1].trim().replace(/[.;,]+$/, '') : null;
}

const TITULOS = /^(CONSELHEIR[OA](?:-SUBSTITUT[OA])?|AUDITOR[A]?|AUDITOR[A]?-RELATOR[A]?|CONSELHEIR[OA] CONVOCAD[OA]|EXCELENTISSIM[OA] SENHOR[A]?)\s+/;

/** Os dois registros do relator nomeiam a mesma pessoa? Exige que todas as palavras do nome da API estejam no texto. */
export function relatoresCompativeis(api, texto) {
  if (!api || !texto) return false;
  const t = new Set(normalizar(texto).replace(TITULOS, '').split(/[^A-Z]+/));
  return normalizar(api).split(/[^A-Z]+/).filter(Boolean).every((p) => t.has(p));
}

/** Fórmula de conclusão escrita na frase (palavras exatas, sem acento no texto da API). Uma só, ou null. */
function classificar(frase) {
  if (!frase) return null;
  const n = normalizar(frase).toLowerCase();
  const palavras = new Set(n.split(/[^a-z]+/));
  const naoAprov = /\bnao aprovacao\b/.test(n);
  const res = [];
  // Substantivo ("a aprovacao") ou verbo ("recomendando … APROVAR COM RESSALVAS").
  const tem = (...ws) => ws.some((w) => palavras.has(w));
  if (tem('desaprovacao', 'desaprovar', 'desaprove')) res.push('pela desaprovação');
  if (naoAprov) res.push('pela não aprovação');
  if (tem('reprovacao', 'reprovar', 'reprove')) res.push('pela reprovação');
  if (tem('rejeicao', 'rejeitar', 'rejeite')) res.push('pela rejeição');
  if (tem('aprovacao', 'aprovar', 'aprove') && !naoAprov) res.push('pela aprovação');
  if (res.length !== 1) return null; // nenhuma ou mais de uma fórmula: não se escolhe
  return { conclusao: res[0], com_ressalvas: /\bcom ressalvas?\b/.test(n) };
}

/**
 * Fim da frase dispositiva: ";", ponto seguido de sigla/maiúsculas, novo item ("10.2", "10.1.1") ou novo
 * item do cabeçalho ("11- Ata"). "art. 71" e "Sr. Fulano" não encerram a frase. Sem fim, corta em 700 caracteres
 * na última palavra inteira (o trecho continua literal).
 */
function cortarFrase(s) {
  const fim = s.slice(1).search(/;|\.\s+(?:[A-Z]{2}|\d{1,2}\.\d)|\s\d{1,2}(?:\.\d{1,2}){1,3}\.?\s|\.?\s+\d{1,2}\s*-\s+[A-Z]/);
  let t = fim >= 0 ? s.slice(0, fim + 1) : s.length < 720 ? s : s.slice(0, 700).replace(/\s+\S*$/, '') + ' […]';
  t = t.trim().replace(/[.,:]$/, '');
  return t;
}

/**
 * Conclusão do parecer: frase operativa ("Emite Parecer Previo recomendando … a aprovacao …") e a
 * ementa ("Emissao de Parecer Previo recomendando a aprovacao com ressalvas das contas anuais").
 * Se as duas existirem e divergirem, conclusão null + lacuna.
 */
export function extrairConclusao(texto) {
  const ini = texto.search(/\b(?:Emit(?:e|ir)|EMIT(?:E|IR))\s+(?:o\s+)?(?:Parecer Previo|PARECER PREVIO)\b/);
  const operativa = ini >= 0 ? cortarFrase(texto.slice(ini, ini + 720)) : null;
  const em = texto.match(/\bEmissao de Parecer Previo\b.{0,300}?(?=\.\s|\.?$)/i);
  const ementa = em ? em[0].trim() : null;
  const cOp = classificar(operativa);
  const cEm = classificar(ementa);
  let lacuna = null;
  let c = cOp ?? cEm;
  if (cOp && cEm && (cOp.conclusao !== cEm.conclusao || cOp.com_ressalvas !== cEm.com_ressalvas)) {
    // A ementa costuma ser mais curta ("aprovacao com ressalvas"), a operativa às vezes diz "com ressalvas e recomendacoes".
    if (cOp.conclusao === cEm.conclusao) c = { conclusao: cOp.conclusao, com_ressalvas: cOp.com_ressalvas || cEm.com_ressalvas };
    else { c = null; lacuna = 'A ementa e a parte dispositiva do parecer trazem fórmulas de conclusão diferentes; conclusão não registrada (ver o texto integral)'; }
  }
  if (!c && !lacuna) lacuna = 'Conclusão do parecer não identificada no texto pelas fórmulas reconhecidas ("recomendando a aprovação/desaprovação"); ver o texto integral';
  return {
    conclusao: c ? c.conclusao : null,
    com_ressalvas: c ? c.com_ressalvas : null,
    conclusao_literal: operativa ?? ementa,
    ementa_literal: ementa,
    unanimidade_literal: (texto.match(/acolhido,?\s+(?:a|por)\s+unanimidade[^:]{0,160}/i) || [null])[0],
    lacuna,
  };
}

/**
 * Itens numerados da parte dispositiva (ex.: "10.2. Registrar as seguintes ressalvas…", "10.2.1. …").
 * Duas seções: a do parecer ("N- PARECER PREVIO:") e a do acórdão que é parte integrante do parecer
 * ("N- ACORDAO:"), cada uma até o item seguinte do cabeçalho ("11- Ata:") ou o fim do texto.
 * Retorna [{ numero, texto, nivel, secao: 'parecer' | 'acordao' }].
 */
export function itensDispositivos(texto) {
  const itens = [];
  for (const [secao, reIni] of [['parecer', /\b(\d{1,2})\s*-\s*PARECER PREVIO\s*:/], ['acordao', /\b(\d{1,2})\s*-\s*ACORDAO\s*:/]]) {
    const ini = texto.match(reIni);
    if (!ini) continue;
    const sec = ini[1];
    let corpo = texto.slice(ini.index + ini[0].length);
    const fim = corpo.search(/\s\d{1,2}\s*-\s*Ata\s*:|\b\d{1,2}\s*-\s*(?:PARECER PREVIO|ACORDAO)\s*:/);
    if (fim >= 0) corpo = corpo.slice(0, fim);
    // Item começa com maiúscula; ou com minúscula logo depois de ":" ou ";" (ex.: "vindouro: 10.2.1 que seja…").
    // Citações no meio da frase ("o item 10.2.1 desta decisão") não abrem item.
    const n = `${sec}\\.\\d{1,2}(?:\\.\\d{1,2}){0,2}`;
    const re = new RegExp(`(?:^|\\s)(${n})\\.?\\s+(?=[A-Z“"(])|(?<=[:;]\\s*)(${n})\\.?\\s+(?=[a-z])`, 'g');
    const marcas = [...corpo.matchAll(re)];
    marcas.forEach((m, k) => {
      const num = m[1] ?? m[2];
      const de = m.index + m[0].length;
      const ate = k + 1 < marcas.length ? marcas[k + 1].index : corpo.length;
      const t = corpo.slice(de, ate).trim();
      if (t) itens.push({ numero: num, texto: t, nivel: num.split('.').length - 1, secao });
    });
  }
  return itens;
}

const EMITE = /\bEmit(?:e|ir)\s+(?:o\s+)?Parecer Previo/i;

/**
 * Ressalvas (subitens do bloco cujo título fala em "ressalvas") e demais determinações/recomendações,
 * na ordem publicada. Os títulos de bloco entram como itens (grupo null) e dão o grupo dos subitens.
 */
export function ressalvasEDeterminacoes(itens) {
  const ressalvas = [];
  const determinacoes = [];
  let grupo = null;
  let ehRessalva = false;
  let tituloRessalvas = null;
  for (const it of itens) {
    if (it.nivel === 1) {
      grupo = it.texto;
      ehRessalva = /\bressalvas?\b/i.test(it.texto) && !EMITE.test(it.texto);
      if (ehRessalva && !tituloRessalvas) tituloRessalvas = it.texto;
      if (!ehRessalva && !EMITE.test(it.texto)) determinacoes.push({ numero: it.numero, texto: it.texto, grupo: null });
      continue;
    }
    if (ehRessalva) ressalvas.push(it.texto);
    else determinacoes.push({ numero: it.numero, texto: it.texto, grupo: grupo && grupo.length <= 200 ? grupo : null });
  }
  return { ressalvas, determinacoes, tituloRessalvas, temAcordao: itens.some((i) => i.secao === 'acordao') };
}

/** "20221206" → "2022-12-06" (null se inválida). */
export function dataSessaoISO(s) {
  const m = String(s || '').match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.getUTCMonth() + 1 !== Number(m[2]) ? null : `${m[1]}-${m[2]}-${m[3]}`;
}

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

/** Item "Data da Sessao: 6 de Dezembro de 2022" do texto → { iso, literal } (null se não houver). */
export function dataSessaoDoTexto(texto) {
  const m = String(texto || '').match(/\bData da Sess[aã]o\s*:\s*((\d{1,2})[º°]?\s+de\s+([A-Za-zç]+)\s+de\s+(\d{4}))/i);
  if (!m) return null;
  const mes = MESES.indexOf(normalizar(m[3]));
  if (mes < 0) return null;
  const iso = dataSessaoISO(`${m[4]}${String(mes + 1).padStart(2, '0')}${m[2].padStart(2, '0')}`);
  return iso ? { iso, literal: m[1] } : null;
}

/** Quem são as contas: governador, prefeitura (com o nome do município como está na API) ou outro órgão. */
export function classificarOrgao(orgao) {
  const n = normalizar(orgao);
  if (n === 'GOVERNO DO ESTADO DO AMAZONAS') return { tipo: 'governador' };
  const m = n.match(/^PREFEITURA MUNICIPAL DE (.+?)(?:\s+[-–]\s+.*)?$/);
  if (m) return { tipo: 'prefeitura', municipio_normalizado: m[1].trim() };
  return { tipo: 'outro' };
}
