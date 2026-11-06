#!/usr/bin/env node
/**
 * Coletor do Tribunal de Contas do Distrito Federal (TCDF): pareceres prévios sobre as contas anuais do Governo do
 * Distrito Federal (o DF não tem municípios).
 *
 * Fonte: site oficial www2.tc.df.gov.br (WordPress). A página "Contas de Governo" (/controle-externo/contas-de-governo/)
 * lista as páginas da categoria 231, uma por exercício ("Contas de Governo 2024 – Relatora ..."), cada uma com o PDF do
 * Relatório Analítico e Parecer Prévio (RAPP). O RAPP traz, no fim, a ata da Sessão Especial em que o Plenário aprecia as
 * contas; dela saem, só por trechos literais, a proclamação da decisão, o texto do parecer, ressalvas, determinações,
 * votação, sessão, data e processo.
 *
 * Regras: robots.txt lido antes de tudo (inacessível = nada é coletado); só o host www2.tc.df.gov.br; uma requisição
 * por vez com pausa mínima de 2 s (ou o Crawl-delay). Os PDFs são baixados numa pasta temporária, lidos com pdftotext
 * e apagados; cada PDF é lido uma vez (sha256 e resultado em leituras-pdf.json) e relido só se o link mudar.
 *
 * Uso: node scripts/coleta/tribunais-contas/tc-df/coletar.mjs [--sem-pdf]
 * Ambiente: COLETA_ORCAMENTO_MIN (orçamento de tempo), TCDF_MAX_PDFS (PDFs por execução, padrão 12),
 *           TCDF_PDFTOTEXT (caminho do pdftotext, padrão "pdftotext").
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  SAIDA, HOST, lerRobots, obterJson, textoDoPdf, temPdftotext, lerJson, gravarSeMudou, contagemGravacao,
  estatisticas, restanteMs, hojeISO, fonte,
} from './lib.mjs';
import { CATEGORIA, exerciciosDosPosts } from './paginas.mjs';
import { VERSAO_LEITURA, lerAta, textoLegivel } from './ata.mjs';
import { montarItem, motivoNaoPublicar, urlPost } from './item.mjs';

const args = { semPdf: process.argv.includes('--sem-pdf') };
const MAX_PDFS = Number(process.env.TCDF_MAX_PDFS) > 0 ? Number(process.env.TCDF_MAX_PDFS) : 12;
const ARQ_LEITURAS = path.join(SAIDA, 'leituras-pdf.json');
const DIR_GOV = path.join(SAIDA, 'contas-governador');
const URL_PAGINA = `https://${HOST}/controle-externo/contas-de-governo/`;
const urlLista = (pagina) => `https://${HOST}/wp-json/wp/v2/posts?categories=${CATEGORIA}&per_page=100&page=${pagina}&orderby=date&order=desc&_fields=id,date,modified,link,title,content`;

async function listarPosts() {
  const posts = [];
  let total = null;
  for (let p = 1; p <= 10; p++) {
    const r = await obterJson(urlLista(p));
    if (!Array.isArray(r.dados)) throw new Error('lista de páginas: resposta inesperada da API do WordPress');
    posts.push(...r.dados);
    total = r.total;
    if (!r.paginas || p >= r.paginas) break;
  }
  if (total !== null && posts.length !== total) throw new Error(`lista de páginas incompleta (${posts.length} de ${total})`);
  return posts;
}

/** Lê um PDF e devolve o registro de leitura (sem lançar: erros viram situacao "erro"). */
async function lerPdf(url) {
  const base = { url, versao: VERSAO_LEITURA, lido_em: hojeISO() };
  try {
    const { texto, sha256, bytes, paginas } = await textoDoPdf(url);
    // Diagnóstico local: TCDF_TEXTO_DIR guarda o texto extraído fora do repositório (para conferir trechos).
    if (process.env.TCDF_TEXTO_DIR) fs.writeFileSync(path.join(process.env.TCDF_TEXTO_DIR, `${path.basename(new URL(url).pathname, '.pdf')}.txt`), texto, 'utf8');
    const meta = { ...base, sha256, bytes, paginas };
    if (!textoLegivel(texto)) return { ...meta, situacao: 'ilegivel' };
    const ata = lerAta(texto);
    return ata ? { ...meta, situacao: 'lido', ata } : { ...meta, situacao: 'sem_proclamacao' };
  } catch (e) {
    if (e.bloqueio) throw e;
    return { ...base, situacao: 'erro', erro: String(e.message).slice(0, 200) };
  }
}

async function main() {
  const inicio = Date.now();
  const anterior = lerJson(path.join(SAIDA, 'meta.json'));
  let robots;
  try {
    robots = await lerRobots();
  } catch (e) {
    // robots.txt inacessível = bloqueio total: nada é baixado; os dados já gravados ficam como estão.
    console.error(`[tc-df] ${e.message}`);
    gravarSeMudou(path.join(SAIDA, 'meta.json'), { ...(anterior ?? { tribunal: 'tc-df' }), ultima_execucao: new Date().toISOString(), bloqueio_ultima_execucao: e.message });
    process.exitCode = 1;
    return;
  }

  const posts = await listarPosts();
  const { porAno, ignorados } = exerciciosDosPosts(posts);
  const leituras = lerJson(ARQ_LEITURAS)?.leituras ?? {};

  // ---- PDFs: só os novos, os de link alterado, os de versão de leitura antiga e os que deram erro
  const pdf = { disponivel: !args.semPdf && temPdftotext(), lidos: 0, ilegiveis: 0, sem_proclamacao: 0, erros: 0, pendentes: 0, parou_por: null };
  const fila = [...porAno.entries()]
    .filter(([, ps]) => ps.length === 1 && ps[0].rapp)
    .map(([ano, [p]]) => ({ ano, url: p.rapp.url }))
    .filter(({ ano, url }) => { const l = leituras[ano]; return !l || l.url !== url || l.versao !== VERSAO_LEITURA || l.situacao === 'erro'; })
    .sort((a, b) => b.ano.localeCompare(a.ano));
  if (pdf.disponivel) {
    let n = 0;
    for (const { ano, url } of fila) {
      if (restanteMs() < 180000) { pdf.parou_por = 'orçamento de tempo'; break; }
      if (n >= MAX_PDFS) { pdf.parou_por = 'TCDF_MAX_PDFS'; break; }
      n++;
      try {
        leituras[ano] = await lerPdf(url);
      } catch (e) { pdf.parou_por = e.message; break; }
      const s = leituras[ano].situacao;
      if (s === 'lido') pdf.lidos++; else if (s === 'ilegivel') pdf.ilegiveis++; else if (s === 'sem_proclamacao') pdf.sem_proclamacao++; else pdf.erros++;
      console.error(`[tc-df] ${ano}: ${s}${leituras[ano].erro ? ` (${leituras[ano].erro})` : ''}`);
      gravarSeMudou(ARQ_LEITURAS, { atualizado_em: new Date().toISOString(), versao_leitura: VERSAO_LEITURA, leituras });
    }
  } else {
    pdf.parou_por = args.semPdf ? '--sem-pdf' : 'pdftotext (poppler-utils) indisponível';
  }
  pdf.pendentes = fila.filter(({ ano, url }) => !leituras[ano] || leituras[ano].url !== url || leituras[ano].situacao === 'erro').length;
  gravarSeMudou(ARQ_LEITURAS, { atualizado_em: new Date().toISOString(), versao_leitura: VERSAO_LEITURA, leituras });

  // ---- Registros por exercício
  const publicados = [];
  const naoPublicados = [];
  for (const [ano, ps] of [...porAno.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    if (ps.length > 1) { naoPublicados.push({ exercicio: ano, motivo: `mais de uma página para o exercício no site (${ps.map((p) => p.url).join(', ')})` }); continue; }
    const p = ps[0];
    const l = leituras[ano] && p.rapp && leituras[ano].url === p.rapp.url ? leituras[ano] : null;
    const motivo = motivoNaoPublicar(p, l);
    if (motivo) { naoPublicados.push({ exercicio: ano, motivo, pagina: p.url }); continue; }
    gravarSeMudou(path.join(DIR_GOV, `${ano}.json`), montarItem(p, l, urlPost(p.id_post)));
    publicados.push(ano);
  }
  // Arquivo de exercício que deixou de ser publicável (página removida, link trocado e ainda não relido) sai do site.
  for (const n of fs.existsSync(DIR_GOV) ? fs.readdirSync(DIR_GOV) : []) {
    if (/^\d{4}\.json$/.test(n) && !publicados.includes(n.slice(0, 4))) fs.rmSync(path.join(DIR_GOV, n));
  }

  const anos = [...porAno.keys()].map(Number);
  const semPagina = [];
  for (let a = Math.min(...anos); a <= Math.max(...anos); a++) if (!porAno.has(String(a))) semPagina.push(a);
  const porMotivo = {};
  for (const x of naoPublicados) {
    const chave = x.motivo.startsWith('PDF não lido') ? 'PDF não lido (erro)' : x.motivo;
    porMotivo[chave] = (porMotivo[chave] ?? 0) + 1;
  }

  const meta = {
    atualizado_em: new Date().toISOString(),
    ultima_execucao: new Date().toISOString(),
    tribunal: 'tc-df',
    periodo: { paginas_de_exercicio: { inicio: Math.min(...anos), fim: Math.max(...anos) }, exercicios_publicados: publicados.length ? { inicio: Number(publicados.at(-1)), fim: Number(publicados[0]) } : null },
    contagens: {
      paginas_na_categoria: posts.length,
      paginas_de_exercicio: [...porAno.values()].flat().length,
      exercicios_publicados: publicados.length,
      exercicios_nao_publicados: naoPublicados.length,
      exercicios_nao_publicados_por_motivo: porMotivo,
      exercicios_sem_pagina: semPagina.length,
      publicados_com_conclusao_literal: publicados.filter((a) => leituras[a]?.ata?.conclusao_literal).length,
    },
    exercicios_publicados: publicados,
    exercicios_nao_publicados: naoPublicados,
    exercicios_sem_pagina: semPagina,
    paginas_ignoradas: ignorados,
    leitura_pdf_nesta_execucao: pdf,
    fontes: [
      fonte('Contas de Governo — página oficial do TCDF', URL_PAGINA),
      fonte(`Páginas da categoria "Contas de Governo" — API do WordPress do site do TCDF`, urlLista(1)),
    ],
    robots_e_restricoes: [
      `${HOST}/robots.txt (HTTP ${robots.status}) lido no início de cada execução: ${robots.regras.length ? `${robots.regras.length} regra(s) para o nosso agente, respeitadas` : 'sem regras (nenhum caminho proibido)'}${robots.crawlDelayS ? `; Crawl-delay ${robots.crawlDelayS} s` : ''}.`,
      `Só o host ${HOST} é acessado (API do WordPress e PDFs em /wp-content/uploads/), uma requisição por vez, com pausa mínima de 2 s. Sem CAPTCHA, login ou chave.`,
      'Os PDFs (de 5 a 75 MB) são baixados numa pasta temporária, lidos e apagados; não ficam no repositório. Cada PDF é lido uma vez e relido só se o link mudar.',
    ],
    observacoes: [
      'O DF não tem municípios: o TCDF emite parecer prévio só sobre as contas anuais do Governo do Distrito Federal, julgadas depois pela Câmara Legislativa do Distrito Federal (CLDF).',
      'Exercício, relator e documentos vêm da página de cada exercício no site do TCDF ("Contas de Governo AAAA – Relator(a) ...").',
      'Conclusão, ressalvas, determinações, votação, sessão, data e processo vêm da ata da Sessão Especial publicada no fim do PDF do Relatório Analítico e Parecer Prévio, sempre como trecho literal. A conclusão curta "aprovação" só aparece quando o texto diz que as contas "estão tecnicamente aptas a receber aprovação".',
      'Só ganha página o exercício cujo PDF traz, em texto legível, a proclamação da decisão para o mesmo exercício e a data da sessão.',
    ],
    lacunas: [
      ...(naoPublicados.length ? [`${naoPublicados.length} exercício(s) com página no site não são exibidos (motivos em exercicios_nao_publicados): ${Object.entries(porMotivo).map(([m, n]) => `${n} — ${m}`).join('; ')}`] : []),
      ...(semPagina.length ? [`Exercício(s) sem página na categoria "Contas de Governo" do site: ${semPagina.join(', ')}`] : []),
      'Julgamento das contas pela Câmara Legislativa do Distrito Federal (CLDF) não coletado.',
      ...(pdf.pendentes ? [`${pdf.pendentes} PDF(s) ainda não lidos; a leitura continua nas próximas execuções.`] : []),
    ],
    estatisticas_http: { ...estatisticas, falhas: estatisticas.falhas.slice(0, 20) },
    duracao_s: Math.round((Date.now() - inicio) / 1000),
  };
  gravarSeMudou(path.join(SAIDA, 'meta.json'), meta);
  console.log(JSON.stringify({ contagens: meta.contagens, publicados, pdf, gravados: contagemGravacao.gravados.length, inalterados: contagemGravacao.inalterados.length, http: { requisicoes: estatisticas.requisicoes, bytes: estatisticas.bytes } }, null, 2));
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
