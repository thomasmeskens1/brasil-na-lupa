// Leitura do texto de um Parecer Prévio do TCE-RR (documento do SEI convertido em texto por html.mjs).
// Só copia o que está escrito: campos numerados do cabeçalho (processo, assunto, órgão, responsável, relator),
// a ementa, o dispositivo, a data ou o período da sessão e as anotações do topo do documento. Nada é deduzido;
// o que não for reconhecido fica null e vira lacuna.
import { dataBR } from './lib.mjs';

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "11 de fevereiro de 2026" → "2026-02-11" (null se não for uma data única e válida). */
export function dataPorExtenso(s) {
  const m = semAcento(s).toLowerCase().match(/^\s*(\d{1,2})(?:º|o)?\s+de\s+([a-z]+)\s+de\s+(\d{4})\s*\.?\s*$/);
  if (!m) return dataBR(String(s).trim().match(/^\d{1,2}[./]\d{1,2}[./]\d{4}\.?$/) ? s : '');
  const mes = MESES.indexOf(m[2]);
  return mes < 0 ? null : dataBR(`${m[1]}/${mes + 1}/${m[3]}`);
}

// Rótulo de campo numerado ("3. ÓRGÃO:", "4. RESPONSÁVE L :", "2 . ASSUNTO :") sem espaços nem acentos.
// Nos pareceres dos anos 1990 os rótulos vêm sem número ("Natureza:", "Unidade:"); aí só rótulos conhecidos valem.
const CAMPO = /^(?:(\d{1,2})\s*\.?\s*)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ()/-]{1,60}?)\s*:\s*(.*)$/;
// "1. PROCESSO SEI Nº 004128/2019", "1. P ROCESSO Nº 004066 /20 1 7", "1. Processo - TCE/RR N o 0169/99", "TCE - Proc. nº 0182/94".
const PROCESSO = /^(?:\d{1,2}\s*\.\s*)?(?:TCE\s*[-–/]?\s*(?:RR\s*)?[-–]?\s*)?P\s?ROC(?:ESSOS?|\.)(?![a-z])[^\d\n]{0,40}?(\d[\d./-]*(?:\s+\/?\s*[\d/]+)*\d)/i;
const numeroProcesso = (m) => m[1].replace(/\s+/g, '');
const TITULO_PARECER = /^\d{1,2}\s*\.\s*PARECER\s+PR[ÉE]VIO\s*(?:N[º°o]\.?\s*[\d/.-]+[^:]*)?:?\s*(.*)$/i;
const FIM_DISPOSITIVO = /^(?:\d{1,2}\s*\.\s*)?(?:DATA|PER[IÍ]ODO)\s+DAS?\s+SESS(?:[ÃA]O|[ÕO]ES)|^(?:\d{1,2}\s*\.\s*)?(?:PRESENTES|QU[OÓ]RUM|CONSELHEIROS PRESENTES)\b|^(?:Sala|Plen[áa]rio) das Sess[õo]es/i;

const INICIO_DISPOSITIVO = /^(?:\d{1,2}\s*\.\s*)?(?:VISTOS\b|ACORDAM\b|Os Conselheiros\b|O Plen[áa]rio\b|O Colegiado\b|O Tribunal de Contas\b|A (?:\d[ªa]\s*|Primeira |Segunda )?C[âa]mara(?: Especial)?\b)/i;
const chaveCampo =(r) => semAcento(r).toUpperCase().replace(/[^A-Z]/g, '');

function rotuloConhecido(ch) {
  if (/^(ASSUNTO|OBJETO|NATUREZA|CLASSE)/.test(ch)) return 'assunto';
  if (/^(ORGAO|ENTIDADE|ENTE|UNIDADE|JURISDICIONADO)/.test(ch)) return 'orgao';
  if (/^(RESPONSAVEL|RESPONSAVEIS|INTERESSADO)/.test(ch) && !/LEGA/.test(ch)) return 'responsavel';
  if (/^(RELATOR|RELATORA|CONSELHEIRORELATOR|CONSELHEIRARELATORA)/.test(ch)) return 'relator';
  if (/^(REVISOR|REVISORA)/.test(ch)) return 'revisor';
  return null;
}

/** Remove do nome do relator a referência à resolução de convocação ("- Resolução nº 004/2024…", "(Res. …)"). */
export function limparRelator(v) {
  return String(v || '').replace(/\s*[-–(]\s*(?:Res\.|Resolu[çc][ãa]o)[\s\S]*$/i, '').replace(/[\s.;]+$/, '').trim() || null;
}

/**
 * Divide o texto do documento. Retorna os campos literais; null quando ausentes.
 * O parecer vem primeiro no documento; voto e relatório vêm depois do fim do dispositivo e não são lidos.
 */
export function lerParecer(texto) {
  const linhas = String(texto || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const r = {
    numero: null, processo: null, assunto: null, orgao: null, responsavel: null, relator: null, revisor: null,
    publicacao_literal: [], anotacoes_literal: [], ementa: null, dispositivo: [], sessao_literal: null, data_sessao: null,
  };
  let i = 0;
  for (; i < Math.min(linhas.length, 12); i++) {
    const m = linhas[i].match(/^(?:Parecer Pr[ée]vio\s*(?:n[º°o.]*\s*)?)+(\d{1,4}\s*\/\s*\d{4}.*)$/i);
    if (m) { r.numero = m[1].trim(); i++; break; }
  }
  if (!r.numero) return r;
  // Topo: "Processo nº 005763/2019" (autos do SEI que reúnem os pareceres do colegiado), dados de publicação
  // e anotações posteriores do tribunal ("DELIBERAÇÃO REFORMADA…", "A CÂMARA MUNICIPAL … APROVOU…").
  let primeiroCampo = -1;
  for (let j = i; j < Math.min(linhas.length, i + 40); j++) {
    if (PROCESSO.test(linhas[j]) && /^(?:\d|TCE)/.test(linhas[j])) { primeiroCampo = j; break; }
    if (CAMPO.test(linhas[j]) && rotuloConhecido(chaveCampo(linhas[j].match(CAMPO)[2]))) { primeiroCampo = j; break; }
  }
  if (primeiroCampo < 0) return r;
  let viuProcesso = false;
  for (let j = i; j < primeiroCampo; j++) {
    let l = linhas[j];
    // A primeira linha "Processo nº …" são os autos do SEI que reúnem os pareceres; uma segunda é o processo julgado.
    if (/^Processo\b/i.test(l)) {
      const p = viuProcesso ? l.match(/(\d[\d./-]*\d)/) : null;
      if (p && !r.processo) r.processo = p[1];
      viuProcesso = true;
      continue;
    }
    // Repetição do cabeçalho original dentro do documento ("TRIBUNAL DE CONTAS…", "PARECER PRÉVIO Nº 001/97-…").
    if (/^TRIBUNAL DE CONTAS\b|^PARECER PR[ÉE]VIO\s+N/i.test(l)) continue;
    // Anotação quebrada em linhas: "(NÃO ACATADO PELA CÂMARA …" + "DECRETO LEGISLATIVO Nº …)"; "PUBLICADO NO DIÁRIO OFICIAL DO" + "ESTADO Nº …".
    while (j + 1 < primeiroCampo && ((/^\(/.test(l) && !/\)/.test(l)) || /\b(?:DO|DE|DA)$/.test(l))) l = `${l} ${linhas[++j]}`;
    if (/^(Boletim Interno|DETCERR|D\.?O\.?E\.?\b|Publicad[oa]|Publica[çc][ãa]o|Disponibiliza[çc][ãa]o|Di[áa]rio Oficial|Republica|Circulou|Com circula)/i.test(l)) r.publicacao_literal.push(l);
    else r.anotacoes_literal.push(l);
  }
  // Campos numerados até o título "N. PARECER PRÉVIO".
  let j = primeiroCampo;
  let ultimoCampo = null;
  const ementa = [];
  for (; j < linhas.length; j++) {
    const l = linhas[j];
    const t = l.match(TITULO_PARECER);
    if (t && !/^\d{1,2}\s*\.\s*PARECER\s+PR[ÉE]VIO\s+(PEL|PARA|DE|N[ºO]\s)/i.test(l.replace(/:.*/, ''))) {
      if (t[1]) r.dispositivo.push(t[1]);
      j++;
      break;
    }
    // Sem o título "PARECER PRÉVIO", o dispositivo começa em "VISTOS…", "ACORDAM…", "Os Conselheiros…".
    if (INICIO_DISPOSITIVO.test(l) && (ementa.length || ultimoCampo)) break;
    const p = l.match(PROCESSO);
    if (p && !r.processo && /^\d|^P\s?ROC|^TCE/i.test(l)) { r.processo = numeroProcesso(p); ultimoCampo = 'processo'; continue; }
    const c = l.match(CAMPO);
    // Sem número, só rótulo conhecido é campo ("EMENTA: …" e outras linhas com dois-pontos seguem como texto).
    if (c && (c[1] || rotuloConhecido(chaveCampo(c[2])))) {
      const k = rotuloConhecido(chaveCampo(c[2]));
      if (k && !r[k]) r[k] = c[3].trim() || null;
      ultimoCampo = k ?? 'outro';
      continue;
    }
    // Linhas soltas antes da ementa (ex.: lista de advogados) pertencem ao campo anterior e não são copiadas.
    if (ultimoCampo && !ementa.length && !/[.;]\s*$/.test(l) && l.length < 120 && !/PARECER|CONTAS/i.test(l)) continue;
    ementa.push(l);
  }
  r.ementa = ementa.length ? ementa.join(' ') : null;
  for (; j < linhas.length && j < primeiroCampo + 400; j++) {
    const l = linhas[j];
    if (FIM_DISPOSITIVO.test(l)) {
      const s = l.match(/(?:DATA|PER[IÍ]ODO)\s+DAS?\s+SESS(?:[ÃA]O|[ÕO]ES)\s*:?\s*(.*)$/i);
      if (s && s[1]) {
        r.sessao_literal = s[1].replace(/[.;]\s*$/, '').trim();
        // "19 de abril de 2000 - Ordinária": o tipo da sessão depois do travessão não faz parte da data.
        r.data_sessao = dataPorExtenso(r.sessao_literal.replace(/\s+[-–]\s+\D+$/, ''));
      }
      break;
    }
    r.dispositivo.push(l);
  }
  if (r.relator) r.relator = limparRelator(r.relator);
  if (r.revisor) r.revisor = limparRelator(r.revisor);
  return r;
}
