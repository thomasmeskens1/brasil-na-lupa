// Fontes oficiais do STJ usadas pelo coletor (ver docs/pesquisa/fontes-stj.md):
// Portal de Dados Abertos (CKAN) — precedentes qualificados, espelhos de acórdãos, íntegras, pautas —
// e a página "Ministros em atividade". Não usa scon.stj.jus.br nem a consulta processual (bloqueiam robôs).
import { obter, obterRecurso, lerZip, htmlParaTexto, normalizarEspacos, dataISO } from './lib.mjs';

export const CKAN = 'https://dadosabertos.web.stj.jus.br';
export const PAGINA_MINISTROS = 'https://www.stj.jus.br/web/verMinistrosSTJ?parametro=1';

/** Conjunto de espelhos de acórdãos por sigla de órgão julgador do Temas.csv. */
export const ESPELHOS_POR_ORGAO = {
  CE: 'espelhos-de-acordaos-corte-especial',
  S1: 'espelhos-de-acordaos-primeira-secao',
  S2: 'espelhos-de-acordaos-segunda-secao',
  S3: 'espelhos-de-acordaos-terceira-secao',
};
export const PACOTE_TEMAS = 'precedentes-qualificados';
export const PACOTE_INTEGRAS = 'integras-de-decisoes-terminativas-e-acordaos-do-diario-da-justica';
export const PACOTE_PAUTAS = 'pautas-futuras';

export async function pacote(id) {
  const r = await obter(`${CKAN}/api/3/action/package_show?id=${encodeURIComponent(id)}`);
  if (!r?.success) throw new Error(`CKAN: package_show ${id} sem sucesso`);
  return r.result;
}
export const urlPacote = (id) => `${CKAN}/dataset/${id}`;

/** Recursos mensais de espelho: Map 'AAAAMM' → recurso (arquivo 'AAAAMMDD.json'). */
export function mesesDeEspelho(pkg) {
  const m = new Map();
  for (const r of pkg.resources) {
    const x = String(r.name).match(/^(\d{6})\d{2}\.json$/i);
    if (x) m.set(x[1], r);
  }
  return m;
}

/** Baixa os meses pedidos de um conjunto de espelhos e indexa por numeroRegistro. */
export async function indexarEspelhos(pkg, meses, dirCache, indice) {
  const recursos = mesesDeEspelho(pkg);
  const lidos = [];
  await Promise.all([...meses].sort().map(async (mes) => {
    const rec = recursos.get(mes);
    if (!rec) return;
    const lista = await obterRecurso(rec, dirCache, { tipo: 'json' });
    lidos.push(mes);
    for (const e of Array.isArray(lista) ? lista : []) {
      if (!e?.numeroRegistro) continue;
      const k = String(e.numeroRegistro).trim();
      if (!indice.has(k)) indice.set(k, []);
      const ja = indice.get(k);
      if (ja.some((x) => x.registro.id === e.id)) continue; // mesmo acórdão repetido entre arquivos
      ja.push({ registro: e, arquivo: rec.name, url: rec.url, conjunto: pkg.name });
    }
  }));
  return lidos.sort();
}

/** Íntegras: Map 'AAAAMMDD' → { metadados: recurso[], textos: recurso[] } (há nomes repetidos no portal). */
export function diasDeIntegras(pkg) {
  const m = new Map();
  const pegar = (d) => { if (!m.has(d)) m.set(d, { metadados: [], textos: [] }); return m.get(d); };
  for (const r of pkg.resources) {
    let x = String(r.name).match(/^metadados(\d{8})$/i);
    if (x) { pegar(x[1]).metadados.push(r); continue; }
    x = String(r.name).match(/^(\d{8})\.zip$/i);
    if (x) pegar(x[1]).textos.push(r);
  }
  return m;
}

/**
 * Procura acórdãos (tipoDocumento "ACÓRDÃO") de um conjunto de números de registro na íntegra de um dia.
 * Devolve [{ meta, texto_dispositivo, url_metadados, url_textos }]. O texto guardado é só o parágrafo
 * entre "ACÓRDÃO" e "EMENTA" (dispositivo com a votação), que não traz nomes de partes.
 */
export async function buscarIntegras(dia, recursosDia, registros, dirCache) {
  const achados = [];
  for (const rm of recursosDia.metadados) {
    const meta = await obterRecurso(rm, dirCache, { tipo: 'json' });
    for (const d of Array.isArray(meta) ? meta : []) {
      if (registros.has(String(d.numeroRegistro).trim()) && /AC[ÓO]RD[ÃA]O/i.test(d.tipoDocumento || '')) {
        if (!achados.some((a) => a.meta.SeqDocumento === d.SeqDocumento)) achados.push({ meta: d, url_metadados: rm.url });
      }
    }
  }
  if (!achados.length) return [];
  for (const rz of recursosDia.textos) {
    const zip = lerZip(await obterRecurso(rz, dirCache, { tipo: 'buffer' }));
    for (const a of achados) {
      if (a.texto_dispositivo) continue;
      const buf = zip.get(`${a.meta.SeqDocumento}.txt`);
      if (!buf) continue;
      const bruto = buf.toString('utf8').replace(/\r/g, '');
      const m = bruto.match(/^\s*AC[ÓO]RD[ÃA]O\s*<br>([\s\S]*?)<br>\s*EMENTA\b/i);
      a.texto_dispositivo = m ? m[1].replace(/<br>/gi, '\n').trim() : null;
      a.url_textos = rz.url;
    }
  }
  return achados;
}

/** Pautas futuras: só campos processuais; partes, CNPJ e advogados são descartados (diretriz 12). */
export async function lerPautas(pkg, dirCache) {
  const recs = pkg.resources.filter((r) => /^pautas_futuras_\d{8}\.json\.gz$/i.test(r.name)).sort((a, b) => a.name.localeCompare(b.name));
  const rec = recs.at(-1);
  if (!rec) return { arquivo: null, porRegistro: new Map() };
  const lista = JSON.parse(await obterRecurso(rec, dirCache, { tipo: 'text' }));
  const porRegistro = new Map();
  for (const p of Array.isArray(lista) ? lista : []) {
    if (String(p.segredoDeJustica ?? p.segredoJustica ?? '').toUpperCase().startsWith('S')) continue;
    const k = String(p.numeroRegistro ?? '').trim();
    if (!k) continue;
    const item = {
      processo: p.processo ?? null,
      numero_registro: k,
      data_sessao: dataISO(p['dataSessão'] ?? p.dataSessao),
      data_publicacao_pauta: dataISO(p.dataPublicacaoPauta),
      orgao_julgador_sigla: p.orgaoJulgador ?? null,
      tipo_peticao: p.tipoPeticao ?? null,
      relator: p.Relator ?? null,
    };
    if (!porRegistro.has(k)) porRegistro.set(k, []);
    porRegistro.get(k).push(item);
  }
  return { arquivo: rec, porRegistro };
}

/**
 * Página "Ministros em atividade" (HTML, ISO-8859-1). Guarda: código de matrícula, nome, partes do nome
 * em negrito na página, cargo de direção (texto após " - "). A UF de naturalidade não é guardada
 * (dado pessoal, não do exercício da função — diretriz 12).
 */
export async function lerMinistros(htmlLocal = null) {
  const html = htmlLocal ?? await obter(PAGINA_MINISTROS, { tipo: 'latin1', timeoutMs: 60000 });
  if (/Request Rejected|The requested URL was rejected/i.test(html)) {
    throw new Error('a página de ministros recusou a requisição automática ("Request Rejected"); não contornado');
  }
  const versao = (htmlParaTexto(html).match(/Vers[ãa]o\s+[\d.]+[\s|]*de\s+(\d{2}\/\d{2}\/\d{4}(?: \d{2}:\d{2})?)/) || [])[1] ?? null;
  const itens = [];
  const re = /<span class="clsMinistrosNome"><a href="(verCurriculoMinistro\?parametro=1&(?:amp;)?cod_matriculamin=(\d+))">([\s\S]*?)<\/a><\/span>/g;
  for (const m of html.matchAll(re)) {
    const interno = m[3];
    const texto = normalizarEspacos(htmlParaTexto(interno).replace(/\n/g, ' '));
    const [nome, ...resto] = texto.split(/\s+-\s+/);
    const destaque = normalizarEspacos([...interno.matchAll(/<b>([\s\S]*?)<\/b>/g)].map((b) => htmlParaTexto(b[1])).join(' '));
    itens.push({
      id: m[2],
      nome: nome.trim(),
      nome_destaque: destaque || null,
      cargo: resto.length ? resto.join(' - ').trim() : null,
      em_exercicio: true,
      orgao_julgador: null,
      url_oficial: `https://www.stj.jus.br/web/${m[1].replace('&amp;', '&')}`,
    });
  }
  if (!itens.length) throw new Error('nenhum ministro reconhecido na página (layout mudou?)');
  return { versao, itens };
}
