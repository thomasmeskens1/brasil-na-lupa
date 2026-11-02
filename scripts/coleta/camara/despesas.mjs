/**
 * Cota para o Exercício da Atividade Parlamentar (CEAP) → dados/camara/despesas/<ano>/
 *   <id-deputado>.json   totais por mês e por tipo de despesa (com contagem de documentos), total da página
 *                        oficial e diferença; sem a lista de documentos (que fica na página oficial da cota,
 *                        link em url_documentos), para não inflar o histórico do git
 *   resumo.json          totais por deputado (e por liderança, que não é deputado)
 *   pagina-oficial.json  cache dos totais por tipo publicados na página oficial de consulta da cota
 *
 * FONTE PRINCIPAL: https://www.camara.leg.br/cotas/Ano-<ano>.csv.zip (um CSV dentro do ZIP; UTF-8 com BOM,
 * separador ';'). Lido só com Node (lerZip + inflateRaw). Baixado só se ETag/Last-Modified mudarem.
 *
 * PRIVACIDADE (diretriz 12): a coluna "cpf" (do parlamentar) nunca é lida. Como só totais são gravados,
 * nenhum dado de fornecedor (nome, CNPJ/CPF), passageiro ou trecho é guardado; os CPFs de fornecedor
 * pessoa física (11 dígitos) são apenas contados em resumo.json.
 *
 * CONFERÊNCIA COM A PÁGINA OFICIAL: a página /cota-parlamentar/sumarizado (permitida pelo robots.txt)
 * traz o total por tipo de despesa de cada deputado no ano. Ela é consultada uma vez por semana (ou com
 * --completo / --forcar-download / --cota-oficial) e o resultado fica em pagina-oficial.json. Em 2026 o
 * arquivo em massa não traz os lançamentos "PASSAGEM AÉREA - SIGEPA" (desde ago/2025), que a página
 * oficial soma; a diferença é registrada por deputado, sem estimativa.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  obter, obterArquivo, paraCada, percorrerCsv, lerJson, lerZip, gravarSeMudou, somarDias,
} from './lib.mjs';

const DIAS_PAGINA_OFICIAL = 7;

export const DEFINICOES_DESPESAS = {
  total_liquido: 'Soma de "vlrLiquido" (valor líquido do documento, já descontada a glosa) dos documentos do arquivo oficial, em reais. Valores negativos são compensações registradas pela própria fonte (ex.: bilhete cancelado).',
  mes: 'Mês de competência informado pela fonte (coluna "numMes"), que pode diferir do mês de emissão do documento.',
  tipo: 'Tipo de despesa como consta na fonte (coluna "txtDescricao").',
  documentos: 'Quantidade de lançamentos (linhas) do arquivo oficial no mês ou no tipo.',
  url_documentos: 'Página oficial de consulta da cota do deputado no ano, onde estão os documentos individuais (fornecedor, valor, nota fiscal).',
  diferenca_para_arquivo: 'total_pagina_oficial menos total_liquido do arquivo; null quando são iguais.',
  total_pagina_oficial: 'Total do ano exibido na página oficial de consulta da cota (/cota-parlamentar/sumarizado) na data da consulta.',
};

const reais = (centavos) => Math.round(centavos) / 100;
const centavos = (s) => { const n = Number(s); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
const cmpPt = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' });
const brParaCentavos = (s) => {
  const t = s.replace(/\s/g, '');
  const neg = t.includes('-');
  const n = Number(t.replace(/[^\d,]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) * (neg ? -1 : 1) : null;
};
const decodificar = (s) => s.replace(/&amp;/g, '&').replace(/&ccedil;/g, 'ç').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).trim();

/** Totais por tipo da página oficial de um deputado. null se a página não tiver a tabela. */
async function paginaOficial(nuDeputadoId, ano) {
  const url = `https://www.camara.leg.br/cota-parlamentar/sumarizado?nuDeputadoId=${nuDeputadoId}&dataInicio=1/${ano}&dataFim=12/${ano}` +
    '&despesa=&nomeHospede=&nomePassageiro=&nomeFornecedor=&cnpjFornecedor=&numDocumento=&sguf=&filtroNivel1=1&filtroNivel2=2&filtroNivel3=3';
  const html = await obter(url, { tipo: 'text', opcional: true });
  if (!html) return null;
  const total = /id="totalFinalSumarizado">\s*([^<]+)</.exec(html);
  const por_tipo = [];
  for (const m of html.matchAll(/id="linkSumarizado(\d+)"[\s\S]*?>\s*([^<]+?)\s*<\/a>[\s\S]*?id="sumarizado\1">\s*([^<]+)</g)) {
    por_tipo.push({ tipo: decodificar(m[2]), total: reais(brParaCentavos(m[3])) });
  }
  return { total: total ? reais(brParaCentavos(total[1])) : null, por_tipo };
}

export async function coletarDespesas({ ano, hoje, dirBase, arquivosMeta, forcar, completo, cotaOficial, log, fonte }) {
  const url = `https://www.camara.leg.br/cotas/Ano-${ano}.csv.zip`;
  const dir = path.join(dirBase, String(ano));
  const arqResumo = path.join(dir, 'resumo.json');
  const arqOficial = path.join(dir, 'pagina-oficial.json');
  const antigoResumo = lerJson(arqResumo);
  let oficial = lerJson(arqOficial);
  const oficialVencida = !oficial || oficial.consultado_em <= somarDias(hoje, -DIAS_PAGINA_OFICIAL);
  const atualizarOficial = cotaOficial || completo || forcar || oficialVencida;

  const r = await obterArquivo(url, { anterior: forcar || !antigoResumo ? null : arquivosMeta[url] });
  const novos = r.naoMudou ? {} : { [url]: { etag: r.etag, last_modified: r.last_modified, sha256: r.sha256, baixado_em: hoje } };
  const semMudanca = r.naoMudou || (antigoResumo && arquivosMeta[url]?.sha256 === r.sha256);
  if (semMudanca && !atualizarOficial) {
    log(`despesas ${ano}: arquivo sem mudança; nada a fazer`);
    return { pulado: true, arquivos: novos, resumo: antigoResumo?.totais || null, carteiras: null, urls: [url] };
  }
  let zipBuf = r.buf;
  if (!zipBuf) zipBuf = (await obterArquivo(url)).buf; // 304, mas a página oficial precisa ser remontada

  const entradas = lerZip(zipBuf).filter((e) => /\.csv$/i.test(e.nome));
  if (entradas.length !== 1) throw new Error(`CEAP ${ano}: esperado 1 CSV no ZIP, veio ${entradas.length}`);
  const deps = new Map(); // ideCadastro -> { ...dados, docs }
  const liderancas = new Map();
  const carteiras = new Map();
  let linhas = 0, cpfsDescartados = 0, semUrl = 0;
  percorrerCsv(entradas[0].dados.toString('utf8').replace(/^﻿/, ''), (c, i) => {
    linhas++;
    const id = c[i.ideCadastro];
    const digitos = c[i.txtCNPJCPF].replace(/\D/g, '');
    if (digitos.length === 11) cpfsDescartados++;
    // Só o necessário para os totais; a lista de documentos não é gravada.
    const doc = { mes: Number(c[i.numMes]) || null, tipo: c[i.txtDescricao], c: centavos(c[i.vlrLiquido]) };
    if (!c[i.urlDocumento]) semUrl++;
    if (!id) { // lideranças e outros lançamentos sem deputado
      const nome = c[i.txNomeParlamentar];
      const l = liderancas.get(nome) || { nome, documentos: 0, c: 0 };
      l.documentos++; l.c += centavos(c[i.vlrLiquido]); liderancas.set(nome, l);
      return;
    }
    if (c[i.nuCarteiraParlamentar]) carteiras.set(c[i.nuCarteiraParlamentar], id);
    if (!deps.has(id)) deps.set(id, { id, nuDeputadoId: c[i.nuDeputadoId], docs: [] });
    const d = deps.get(id);
    d.nome = c[i.txNomeParlamentar]; d.partido = c[i.sgPartido] || null; d.uf = c[i.sgUF] || null;
    d.docs.push(doc);
  });
  log(`despesas ${ano}: ${linhas} lançamentos, ${deps.size} deputados, ${liderancas.size} lideranças; ${cpfsDescartados} CPF(s) de fornecedor descartado(s)`);

  if (atualizarOficial) {
    log(`despesas ${ano}: consultando a página oficial da cota de ${deps.size} deputados…`);
    const itens = {};
    await paraCada([...deps.values()], async (d) => {
      if (!d.nuDeputadoId) return;
      try { itens[d.id] = await paginaOficial(d.nuDeputadoId, ano); } catch { itens[d.id] = null; }
    });
    oficial = { consultado_em: hoje, ano, itens: Object.fromEntries(Object.keys(itens).sort().map((k) => [k, itens[k]])) };
    gravarSeMudou(arqOficial, {
      ...oficial,
      _descricao: 'Cache do coletor: total por tipo de despesa exibido na página oficial de consulta da cota, por id do deputado.',
      fonte: fonte(`Consulta à Cota Parlamentar ${ano} (página oficial)`, `https://www.camara.leg.br/cota-parlamentar/sumarizado?nuDeputadoId={id}&dataInicio=1/${ano}&dataFim=12/${ano}`),
    });
  }

  const fonteArq = fonte(`Cota para o Exercício da Atividade Parlamentar ${ano} — Câmara dos Deputados`, url);
  const itensResumo = [];
  let totalGeral = 0, docsGeral = 0, comDiferenca = 0;
  for (const d of deps.values()) {
    const porMes = new Map(), porTipo = new Map();
    let tot = 0;
    for (const x of d.docs) {
      const c = x.c;
      tot += c;
      const m = porMes.get(x.mes) || { mes: x.mes, documentos: 0, c: 0 }; m.documentos++; m.c += c; porMes.set(x.mes, m);
      const t = porTipo.get(x.tipo) || { tipo: x.tipo, documentos: 0, c: 0 }; t.documentos++; t.c += c; porTipo.set(x.tipo, t);
    }
    const of = oficial?.itens?.[d.id] || null;
    const lacunas = [];
    let diferenca = null;
    if (of && of.total != null && Math.round(of.total * 100) !== tot) {
      comDiferenca++;
      diferenca = reais(Math.round(of.total * 100) - tot);
      const tiposDif = of.por_tipo.filter((t) => Math.round(t.total * 100) !== (porTipo.get(t.tipo)?.c || 0))
        .map((t) => `${t.tipo} (página R$ ${t.total.toFixed(2)}; arquivo R$ ${reais(porTipo.get(t.tipo)?.c || 0).toFixed(2)})`);
      lacunas.push(`O total da página oficial (R$ ${of.total.toFixed(2)}) difere do total dos documentos do arquivo em massa (R$ ${reais(tot).toFixed(2)}).` +
        (tiposDif.length ? ` Tipos com diferença: ${tiposDif.join('; ')}. Os documentos desses lançamentos não constam do arquivo.` : ''));
    }
    const arq = path.join(dir, `${d.id}.json`);
    gravarSeMudou(arq, {
      atualizado_em: hoje, ano, parlamentar_id: d.id, nome_na_fonte: d.nome, partido_na_fonte: d.partido, uf_na_fonte: d.uf,
      total_liquido: reais(tot), documentos_qtd: d.docs.length, total_pagina_oficial: of?.total ?? null,
      // Sem data de consulta aqui (fica em pagina-oficial.json e resumo.json): a revisão semanal só
      // regrava o arquivo do deputado se algum valor mudou.
      pagina_oficial: of ? {
        total: of.total, diferenca_para_arquivo: diferenca,
        por_tipo: of.por_tipo.slice().sort((a, b) => cmpPt(a.tipo, b.tipo)),
      } : null,
      por_mes: [...porMes.values()].sort((a, b) => a.mes - b.mes).map((m) => ({ mes: m.mes, documentos: m.documentos, total_liquido: reais(m.c) })),
      por_tipo: [...porTipo.values()].sort((a, b) => b.c - a.c || cmpPt(a.tipo, b.tipo)).map((t) => ({ tipo: t.tipo, documentos: t.documentos, total_liquido: reais(t.c) })),
      fonte: fonteArq,
      url_oficial: `https://www.camara.leg.br/deputados/${d.id}`,
      url_documentos: `https://www.camara.leg.br/cota-parlamentar/consulta-cota-parlamentar?ideDeputado=${d.id}&dataInicio=01${ano}&dataFim=12${ano}`,
      lacunas,
    });
    totalGeral += tot; docsGeral += d.docs.length;
    itensResumo.push({
      parlamentar_id: d.id, nome_na_fonte: d.nome, partido_na_fonte: d.partido, uf_na_fonte: d.uf,
      documentos: d.docs.length, total_liquido: reais(tot), total_pagina_oficial: of?.total ?? null,
    });
  }
  // Remove arquivos de deputados que deixaram de constar do arquivo do ano.
  for (const f of fs.readdirSync(dir)) {
    const m = /^(d+).json$/.exec(f);
    if (m && !deps.has(m[1])) fs.unlinkSync(path.join(dir, f));
  }
  itensResumo.sort((a, b) => cmpPt(a.nome_na_fonte, b.nome_na_fonte) || cmpPt(a.parlamentar_id, b.parlamentar_id));
  const totais = {
    deputados: deps.size, documentos: docsGeral, total_liquido: reais(totalGeral), lancamentos_no_arquivo: linhas,
    lancamentos_de_liderancas: [...liderancas.values()].reduce((s, l) => s + l.documentos, 0),
    cpf_de_fornecedor_descartados: cpfsDescartados, documentos_sem_link: semUrl,
    deputados_com_total_diferente_da_pagina_oficial: oficial ? comDiferenca : null,
  };
  const lacunasResumo = [
    'Os valores vêm do arquivo em massa da CEAP. Quando a página oficial da cota mostra outro total, a diferença fica em "total_pagina_oficial" e nas lacunas do arquivo do deputado, sem estimativa.',
    'CPF do parlamentar e CPF de fornecedor pessoa física não são guardados (diretriz 12); o nome do fornecedor é mantido como consta.',
  ];
  if (oficial && comDiferenca) lacunasResumo.push(`${comDiferenca} deputado(s) com total do arquivo diferente da página oficial (consultada em ${oficial.consultado_em}).`);
  gravarSeMudou(arqResumo, {
    atualizado_em: hoje, ano, casa: 'camara', totais, definicoes: DEFINICOES_DESPESAS,
    fonte: fonteArq, pagina_oficial_consultada_em: oficial?.consultado_em || null, lacunas: lacunasResumo,
    itens: itensResumo,
    liderancas: [...liderancas.values()].sort((a, b) => cmpPt(a.nome, b.nome)).map((l) => ({ nome: l.nome, documentos: l.documentos, total_liquido: reais(l.c) })),
  });
  return { pulado: false, arquivos: novos, resumo: totais, carteiras, urls: [url] };
}
