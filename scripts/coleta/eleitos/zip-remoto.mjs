// Leitura de ZIP remoto por pedaços (cabeçalho HTTP Range): baixa só o diretório central e as
// entradas pedidas, descomprimindo cada uma em fluxo (streaming), sem guardar o arquivo inteiro.
// Os CSV do Tribunal Superior Eleitoral (TSE) vêm em ISO-8859-1, separados por ';', linhas CRLF.
import zlib from 'node:zlib';
import { Readable } from 'node:stream';

export const USER_AGENT =
  'voto-em-quem-coletor/1.0 (coleta automatica de dados abertos para site neutro de acompanhamento politico; Node.js)';

export const estatisticas = { requisicoes: 0, bytes_baixados: 0, retentativas: 0 };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch com até 5 tentativas e espera crescente (respeita Retry-After). */
async function buscar(url, opcoes = {}, tentativas = 5) {
  for (let t = 1; ; t++) {
    estatisticas.requisicoes++;
    try {
      const res = await fetch(url, {
        ...opcoes,
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...(opcoes.headers || {}) },
        signal: AbortSignal.timeout(opcoes.timeoutMs || 300000),
        redirect: 'follow',
      });
      if (res.ok || res.status === 206 || res.status === 304) return res;
      if (![408, 429, 500, 502, 503, 504].includes(res.status) || t >= tentativas) {
        throw Object.assign(new Error(`HTTP ${res.status} em ${url}`), { definitivo: true });
      }
      const ra = Number(res.headers.get('retry-after'));
      estatisticas.retentativas++;
      await dormir(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) * 1000 : 2000 * 2 ** (t - 1));
    } catch (e) {
      if (e.definitivo || t >= tentativas) throw e;
      estatisticas.retentativas++;
      await dormir(2000 * 2 ** (t - 1));
    }
  }
}

async function faixa(url, ini, fim) {
  const res = await buscar(url, { headers: { Range: `bytes=${ini}-${fim}` } });
  if (res.status !== 206) throw new Error(`O servidor não atendeu o pedido parcial (HTTP ${res.status}) em ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  estatisticas.bytes_baixados += buf.length;
  return buf;
}

/** HEAD: { tamanho, etag, last_modified }. */
export async function cabecalho(url) {
  const res = await buscar(url, { method: 'HEAD' });
  return {
    tamanho: Number(res.headers.get('content-length')) || null,
    etag: res.headers.get('etag') || null,
    last_modified: res.headers.get('last-modified') || null,
  };
}

/** Lê o diretório central de um ZIP remoto: [{ nome, metodo, comprimido, tamanho, local }]. */
export async function listarZip(url, tamanho) {
  const ini = Math.max(0, tamanho - 65600);
  const cauda = await faixa(url, ini, tamanho - 1);
  let eocd = -1;
  for (let i = cauda.length - 22; i >= 0; i--) if (cauda.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error(`ZIP inválido (sem fim do diretório central): ${url}`);
  const total = cauda.readUInt16LE(eocd + 10);
  const cdTam = cauda.readUInt32LE(eocd + 12);
  const cdOff = cauda.readUInt32LE(eocd + 16);
  if (cdOff === 0xffffffff || total === 0xffff) throw new Error(`ZIP64 não suportado: ${url}`);
  const cd = cdOff >= ini ? cauda.subarray(cdOff - ini, cdOff - ini + cdTam) : await faixa(url, cdOff, cdOff + cdTam - 1);
  const entradas = [];
  let p = 0;
  for (let n = 0; n < total; n++) {
    if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error(`ZIP inválido (diretório central): ${url}`);
    const lNome = cd.readUInt16LE(p + 28), lExtra = cd.readUInt16LE(p + 30), lCom = cd.readUInt16LE(p + 32);
    entradas.push({
      nome: cd.toString('latin1', p + 46, p + 46 + lNome),
      metodo: cd.readUInt16LE(p + 10),
      comprimido: cd.readUInt32LE(p + 20),
      tamanho: cd.readUInt32LE(p + 24),
      local: cd.readUInt32LE(p + 42),
    });
    p += 46 + lNome + lExtra + lCom;
  }
  return entradas;
}

/** Fluxo (Readable) com o conteúdo descomprimido de uma entrada do ZIP remoto. */
async function fluxoEntrada(url, entrada) {
  const cab = await faixa(url, entrada.local, entrada.local + 29);
  if (cab.readUInt32LE(0) !== 0x04034b50) throw new Error(`ZIP inválido (cabeçalho local de ${entrada.nome})`);
  const ini = entrada.local + 30 + cab.readUInt16LE(26) + cab.readUInt16LE(28);
  if (entrada.comprimido === 0) return Readable.from([]);
  const res = await buscar(url, { headers: { Range: `bytes=${ini}-${ini + entrada.comprimido - 1}` } });
  if (res.status !== 206) throw new Error(`O servidor não atendeu o pedido parcial (HTTP ${res.status}) em ${url}`);
  const bruto = Readable.fromWeb(res.body);
  bruto.on('data', (c) => { estatisticas.bytes_baixados += c.length; });
  if (entrada.metodo === 0) return bruto;
  if (entrada.metodo !== 8) throw new Error(`ZIP: método ${entrada.metodo} não suportado (${entrada.nome})`);
  const inflar = zlib.createInflateRaw();
  bruto.on('error', (e) => inflar.destroy(e));
  return bruto.pipe(inflar);
}

/** Divide uma linha CSV do TSE (';', campos com ou sem aspas, "" = aspas literais). */
export function dividirLinha(l) {
  const out = [];
  let i = 0;
  const n = l.length;
  while (i <= n) {
    if (l.charCodeAt(i) === 34) {
      let j = i + 1, s = '';
      for (;;) {
        const q = l.indexOf('"', j);
        if (q < 0) { s += l.slice(j); i = n + 1; break; }
        if (l.charCodeAt(q + 1) === 34) { s += l.slice(j, q + 1); j = q + 2; continue; }
        s += l.slice(j, q); i = q + 2; break;
      }
      out.push(s);
    } else {
      let q = l.indexOf(';', i);
      if (q < 0) q = n;
      out.push(l.slice(i, q));
      i = q + 1;
    }
  }
  return out;
}

/**
 * Percorre em fluxo o CSV de uma entrada do ZIP remoto. fn(campos, indice) para cada linha de dados;
 * filtro(linhaBruta) opcional descarta linhas antes da divisão em campos (economiza tempo).
 * Retorna o número de linhas de dados lidas.
 */
export async function percorrerCsvRemoto(url, entrada, fn, filtro = null) {
  const fluxo = await fluxoEntrada(url, entrada);
  let resto = '', indice = null, linhas = 0, pendente = '';
  const tratar = (linha) => {
    if (pendente) { linha = pendente + '\r\n' + linha; pendente = ''; }
    // Campo entre aspas que contém quebra de linha: junta com a próxima.
    let aspas = 0;
    for (let k = linha.indexOf('"'); k >= 0; k = linha.indexOf('"', k + 1)) aspas++;
    if (aspas % 2) { pendente = linha; return; }
    if (!linha) return;
    if (!indice) {
      indice = Object.fromEntries(dividirLinha(linha.replace(/^﻿|^ï»¿/, '')).map((k, i) => [k, i]));
      return;
    }
    linhas++;
    if (filtro && !filtro(linha)) return;
    fn(dividirLinha(linha), indice);
  };
  for await (const pedaco of fluxo) {
    const texto = resto + pedaco.toString('latin1');
    const partes = texto.split('\r\n');
    resto = partes.pop();
    for (const l of partes) tratar(l);
  }
  if (resto) tratar(resto);
  if (pendente) throw new Error(`CSV com aspas não fechadas em ${entrada.nome}`);
  return linhas;
}
