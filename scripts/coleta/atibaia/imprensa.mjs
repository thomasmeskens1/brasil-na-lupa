// Imprensa Oficial Eletrônica (IOE) da Estância de Atibaia: calendário de edições,
// download dos PDFs e extração do texto (via extrair_pdf.py, com Python isolado -I).
// Os PDFs são dados não confiáveis: ficam numa pasta temporária própria e vazia,
// são lidos só como texto/coordenadas e apagados logo após a extração.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { obter, mesDoNome, dataISO } from './lib.mjs';

export const BASE_IOE = 'https://prefeitura.atibaia.sp.gov.br/imprensa/';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const EXTRATOR = path.join(AQUI, 'extrair_pdf.py');
/** Versão do extrator (igual a VERSAO em extrair_pdf.py); edições lidas por versão anterior são relidas. */
export const VERSAO_EXTRATOR = 2;

/**
 * Lê o calendário oficial do ano (index.php?ano=AAAA) e devolve as edições:
 * [{ edicao: '3041B', numero_base: 3041, sufixo: 'B', data: 'AAAA-MM-DD', url }]
 * A data vem do dia do calendário em que o link aparece.
 */
export function lerCalendario(html, ano) {
  const edicoes = [];
  // Percorre, na ordem do documento, os marcadores de mês, de dia e de link.
  const re = /class="month-year">([^<]+)<|<div class="day_num"><span>(\d{1,2})<\/span>|href='(pdf\/\d{4}\/[^']+\.pdf)'/g;
  let mes = null, dia = null, m;
  while ((m = re.exec(html))) {
    if (m[1]) { mes = mesDoNome(m[1].replace(/&ccedil;/g, 'ç').trim()); dia = null; }
    else if (m[2]) dia = Number(m[2]);
    else if (m[3]) {
      const arq = m[3].split('/').pop();
      const q = arq.match(/^(\d+)([A-Z]?)(?:_([0-9a-f]{32}))?\.pdf$/);
      if (!q || !mes || !dia) continue;
      edicoes.push({
        edicao: q[1] + q[2],
        numero_base: Number(q[1]),
        sufixo: q[2] || null,
        data: dataISO(ano, mes, dia),
        url: BASE_IOE + m[3],
      });
    }
  }
  // Mesma edição listada duas vezes: mantém a primeira ocorrência.
  const vistos = new Set();
  return edicoes.filter((e) => (vistos.has(e.edicao) ? false : vistos.add(e.edicao)))
    .sort((a, b) => a.data.localeCompare(b.data) || a.numero_base - b.numero_base || (a.sufixo || '').localeCompare(b.sufixo || ''));
}

export async function listarEdicoes(ano) {
  const url = `${BASE_IOE}index.php?ano=${ano}`;
  const html = await obter(url, { tipo: 'latin1' });
  if (!/month-year/.test(html)) throw new Error(`Calendário de ${ano} sem o formato esperado (${url})`);
  return { url, edicoes: lerCalendario(html, ano) };
}

function rodarExtrator(pdf) {
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  return new Promise((resolve, reject) => {
    execFile(python, ['-I', EXTRATOR, pdf], {
      cwd: AQUI, maxBuffer: 256 * 1024 * 1024, timeout: 15 * 60 * 1000, encoding: 'buffer', windowsHide: true,
    }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`extrator falhou: ${err.message} ${String(stderr).slice(0, 400)}`));
      try { resolve(JSON.parse(stdout.toString('utf8'))); } catch (e) { reject(new Error(`saída inválida do extrator: ${e.message}`)); }
    });
  });
}

let pastaTemp = null;
function temp() {
  if (!pastaTemp) pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'brasil-na-lupa-ioe-'));
  return pastaTemp;
}
export function limparTemp() {
  if (pastaTemp) { fs.rmSync(pastaTemp, { recursive: true, force: true }); pastaTemp = null; }
}

/** Baixa o PDF da edição, extrai o texto das páginas candidatas e apaga o PDF. */
export async function baixarEExtrair(ed) {
  const buf = await obter(ed.url, { tipo: 'buffer', timeoutMs: 240000 });
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error(`não é PDF: ${ed.url}`);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const arq = path.join(temp(), `${ed.edicao}-${process.pid}.pdf`);
  fs.writeFileSync(arq, buf);
  try {
    const r = await rodarExtrator(arq);
    return { sha256, bytes: buf.length, ...r };
  } finally {
    fs.rmSync(arq, { force: true });
  }
}
