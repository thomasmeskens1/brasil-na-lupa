#!/usr/bin/env node
/**
 * Coletor do Tribunal de Contas do Estado do Paraná (TCE-PR) — Brasil na Lupa.
 *
 * Gera, em dados/tribunais-contas/tce-pr/:
 *   contas-prefeitos/<municipio>.json   pareceres prévios sobre as contas dos Prefeitos (um item por ato)
 *   contas-governador/<exercicio>.json  parecer prévio sobre as contas do Governador
 *   meta.json                           execução, contagens, fontes, restrições e lacunas
 *
 * Fonte: arquivos anuais "AAAA_acordaos_base_de_dados.csv" do portal de dados abertos (Viajuris), lidos em
 * streaming (nada é salvo em disco), e a deliberação no fim do PDF de cada parecer (pdfplumber, opcional).
 *
 * Uso (Node 20.3+):
 *   node scripts/coleta/tribunais-contas/tce-pr/coletar.mjs               rotina diária (arquivos do ano atual e do anterior)
 *   node scripts/coleta/tribunais-contas/tce-pr/coletar.mjs --desde 2019  arquivos de 2019 até o ano atual
 *   node scripts/coleta/tribunais-contas/tce-pr/coletar.mjs --sem-pdf     só o CSV
 * Ambiente: COLETA_ORCAMENTO_MIN (padrão 20) limita o tempo total: o coletor para limpo e grava o que tiver;
 *   a leitura de PDFs pendentes continua na execução seguinte. TCEPR_MAX_PDFS limita os PDFs por execução.
 *   TCEPR_PYTHON: Python com pdfplumber (sem ele, os PDFs não são lidos e isso fica registrado).
 *
 * Acesso: só viajuris.tce.pr.gov.br; robots.txt lido antes de tudo e respeitado; uma requisição por vez,
 * pausa ≥ 1 s; User-Agent "BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)". Desafio anti-bot,
 * CAPTCHA ou login interrompem a coleta (nunca são contornados).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  SAIDA, HOST, carregarRobots, abrir, lerEmStreaming, lerBinario, sha256, gravarSeMudou, contagemGravacao, estatisticas,
  lerJson, hojeISO, fonte, temPdfplumber, textoFinalDoPdf, acharPython,
} from './lib.mjs';
import { criarLeitorCsv, CLASSE_PREFEITO, CLASSE_GOVERNADOR, TIPOS_PARECER, lerDeliberacao, secoesDeliberacao } from './extrair.mjs';
import { URL_BASE_DADOS, urlCsv, montarItem, montarRelacionado, consolidar, VERSAO_LEITURA } from './itens.mjs';
import { carregarMunicipiosPR, casarMunicipio, mesclar, mesclarRelacionados, montarArquivoMunicipio } from './municipios.mjs';

const ANO_INICIAL = 2019;
const inicio = Date.now();
const ORCAMENTO_MS = Math.max(1, Number(process.env.COLETA_ORCAMENTO_MIN || 20)) * 60000;
const prazo = inicio + ORCAMENTO_MS - 45000; // margem para gravar
const restante = () => prazo - Date.now();
const MAX_PDFS = Number(process.env.TCEPR_MAX_PDFS || Infinity);

function argumentos(argv) {
  const a = { desde: null, semPdf: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sem-pdf') a.semPdf = true;
    else if (argv[i] === '--completo') a.desde = ANO_INICIAL;
    else if (argv[i] === '--desde') a.desde = Number(argv[++i]);
    else if (argv[i].startsWith('--desde=')) a.desde = Number(argv[i].slice(8));
    else if (argv[i] === '--ajuda' || argv[i] === '-h') { console.log('Uso: coletar.mjs [--desde AAAA | --completo] [--sem-pdf]'); process.exit(0); }
    else throw new Error(`argumento desconhecido: ${argv[i]}`);
  }
  if (a.desde !== null && !(Number.isInteger(a.desde) && a.desde >= 1998 && a.desde <= 2100)) throw new Error('--desde precisa de um ano (AAAA) a partir de 1998');
  return a;
}

/** Datas de atualização dos arquivos na página "Base de Dados" (opcional). */
async function datasDosArquivos() {
  try {
    const res = await abrir(URL_BASE_DADOS, { esperado: /text\/html/i, timeoutMs: 60000 });
    const html = (await res.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    return Object.fromEntries([...html.matchAll(/(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}) (\d{4})_acordaos_base_de_dados\.csv/g)].map((m) => [m[2], m[1]]));
  } catch (e) {
    console.error(`página Base de Dados: ${e.message}`);
    if (e.bloqueio) throw e;
    return {};
  }
}

/** Lê um arquivo anual em streaming e devolve só as linhas das classes de interesse. */
async function lerAno(ano) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), Math.max(1000, restante()));
  const linhas = { prefeito: [], governador: [] };
  let total = 0;
  try {
    const res = await abrir(urlCsv(ano), { sinal: ctl.signal, esperado: /octet-stream|csv|text\/plain/i });
    const leitor = criarLeitorCsv((r) => {
      total++;
      if (r.DsClasseProcessual === CLASSE_PREFEITO) linhas.prefeito.push(r);
      else if (r.DsClasseProcessual === CLASSE_GOVERNADOR) linhas.governador.push(r);
    });
    const { sha256: hash, bytes } = await lerEmStreaming(res, (txt) => leitor.empurrar(txt));
    leitor.fim();
    return { ano, ...linhas, total, sha256: hash, bytes };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const anoAtual = Number(hojeISO().slice(0, 4));
  const desde = args.desde ?? anoAtual - 1;
  const metaAntiga = lerJson(path.join(SAIDA, 'meta.json')) || {};

  const robots = await carregarRobots();
  const { lista: municipios, porNome, fonte: fonteEntes } = carregarMunicipiosPR();
  const datas = await datasDosArquivos();

  // ---- CSV anuais (do mais recente para o mais antigo)
  const anos = [];
  for (let a = anoAtual; a >= desde; a--) anos.push(a);
  const lidos = [];
  const anosIncompletos = [];
  for (const ano of anos) {
    if (restante() < 60000) { anosIncompletos.push({ ano, motivo: 'orçamento de tempo esgotado antes do download' }); continue; }
    try {
      const r = await lerAno(ano);
      lidos.push(r);
      console.error(`CSV ${ano}: ${r.total} atos, ${r.prefeito.length} de prefeitos, ${r.governador.length} do governador`);
    } catch (e) {
      if (e.bloqueio) throw e;
      anosIncompletos.push({ ano, motivo: e.name === 'AbortError' ? 'orçamento de tempo esgotado durante o download' : e.message });
      console.error(`CSV ${ano}: ${e.message}`);
    }
  }
  const anosProcessados = new Set(lidos.map((l) => l.ano));
  const fontesCsv = new Map((metaAntiga.fontes || []).filter((f) => f.ano).map((f) => [f.ano, f]));
  for (const l of lidos) {
    fontesCsv.set(l.ano, { ...fonte(`Acórdãos ${l.ano} — base de dados aberta do TCE-PR (arquivo CSV anual)`, urlCsv(l.ano)), ano: l.ano, pagina: URL_BASE_DADOS, sha256: l.sha256, atualizado_na_fonte: datas[l.ano] || null });
  }
  const listaFontes = [...fontesCsv.values()].sort((a, b) => b.ano - a.ano);

  // ---- Prefeitos: agrupa por município
  const novosPorMun = new Map();
  const relPorMun = new Map();
  const naoCasadas = new Map();
  let ignoradosTipo = 0;
  for (const l of lidos) {
    const fCsv = fontesCsv.get(l.ano);
    const { ano: _a, pagina: _p, ...fItem } = fCsv;
    for (const r of l.prefeito) {
      const mun = casarMunicipio(r.DsEntidade, porNome);
      if (!mun) { naoCasadas.set(r.DsEntidade, (naoCasadas.get(r.DsEntidade) || 0) + 1); continue; }
      if (TIPOS_PARECER.has(r.DsTipoAto)) {
        const it = montarItem(r, { contasDe: `Prefeito de ${mun.nome}`, tituloContas: `contas do Prefeito de ${mun.nome}`, fonteCsv: fItem, anoCsv: l.ano });
        if (!novosPorMun.has(mun.id)) novosPorMun.set(mun.id, []);
        novosPorMun.get(mun.id).push(it);
      } else if (r.DsTipoAto === 'Acordão' || r.DsTipoAto === 'Acórdão') {
        if (!relPorMun.has(mun.id)) relPorMun.set(mun.id, []);
        relPorMun.get(mun.id).push(montarRelacionado(r, l.ano));
      } else ignoradosTipo++;
    }
  }
  const estado = new Map(); // id → { mun, todos, relacionados }
  for (const mun of municipios) {
    const antigo = lerJson(path.join(SAIDA, 'contas-prefeitos', `${mun.id}.json`));
    const antigos = [...(antigo?.itens || []), ...(antigo?.itens_sem_exercicio || [])];
    estado.set(mun.id, {
      mun,
      todos: mesclar(antigos, novosPorMun.get(mun.id) || [], anosProcessados),
      relacionados: mesclarRelacionados(antigo?.acordaos_relacionados, relPorMun.get(mun.id) || [], anosProcessados),
    });
  }

  // ---- Governador: um arquivo por exercício (o exercício vem do CSV ou da deliberação do PDF)
  const dirGov = path.join(SAIDA, 'contas-governador');
  const govAntigos = [
    ...(fs.existsSync(dirGov) ? fs.readdirSync(dirGov).filter((n) => /^\d{4}\.json$/.test(n)) : [])
      .flatMap((n) => { const d = lerJson(path.join(dirGov, n)); return d ? [d, ...(d.outros_atos_do_exercicio || [])] : []; }),
    ...(metaAntiga.governador_sem_exercicio_na_fonte || []).filter((i) => i && i.parecer),
  ].map(({ outros_atos_do_exercicio: _o, determinacoes_e_recomendacoes: _d, documentos: _x, certidao_literal: _c, ...i }) => i);
  const govNovos = [];
  for (const l of lidos) {
    const { ano: _a, pagina: _p, ...fItem } = fontesCsv.get(l.ano);
    for (const r of l.governador) {
      if (TIPOS_PARECER.has(r.DsTipoAto)) govNovos.push(montarItem(r, { contasDe: 'Governador do Estado do Paraná', tituloContas: 'contas do Governador do Estado do Paraná', fonteCsv: fItem, anoCsv: l.ano }));
    }
  }
  const govTodos = mesclar(govAntigos, govNovos, anosProcessados);
  let govSemEx = [];

  const gravarGovernador = () => {
    const porEx = new Map();
    for (const it of govTodos) {
      consolidar(it, { casaPolitica: 'Assembleia Legislativa do Paraná' });
      if (!it.parecer.exercicio) continue;
      if (!porEx.has(it.parecer.exercicio)) porEx.set(it.parecer.exercicio, []);
      porEx.get(it.parecer.exercicio).push(it);
    }
    govSemEx = govTodos.filter((i) => !i.parecer.exercicio);
    for (const [ex, lista] of porEx) {
      lista.sort((a, b) => (a.data_julgamento || '').localeCompare(b.data_julgamento || ''));
      const [principal, ...outros] = lista.map((i) => structuredClone(i));
      const lido = principal.leitura_pdf?.situacao === 'lido';
      const secoes = lido ? secoesDeliberacao(principal.leitura_pdf.deliberacao) : [];
      const ressalvas = secoes.filter((s) => /^RESSALVA/.test(s.grupo)).map((s) => `${s.numero}. ${s.texto}`);
      const outrasSecoes = secoes.filter((s) => !/^RESSALVA/.test(s.grupo));
      if (ressalvas.length) {
        principal.parecer.ressalvas = ressalvas;
        principal.parecer.ressalvas_fonte = { documento: principal.ato.titulo_oficial, url: principal.parecer.documento.url };
        principal.lacunas = principal.lacunas.filter((l) => !/^Ressalvas, determinações/.test(l));
      }
      gravarSeMudou(path.join(SAIDA, 'contas-governador', `${ex}.json`), {
        ...principal,
        determinacoes_e_recomendacoes: outrasSecoes.length
          ? { documento: principal.ato.titulo_oficial, url: principal.parecer.documento.url, itens: outrasSecoes.map((s) => ({ numero: s.numero, texto: s.texto, grupo: s.grupo })) }
          : null,
        documentos: principal.parecer.documento ? [principal.parecer.documento] : [],
        certidao_literal: principal.leitura_pdf?.situacao === 'lido' ? principal.leitura_pdf.deliberacao : null,
        atualizado_em: new Date().toISOString(),
        outros_atos_do_exercicio: outros,
      });
    }
  };
  const gravarMunicipios = () => {
    for (const { mun, todos, relacionados } of estado.values()) {
      gravarSeMudou(path.join(SAIDA, 'contas-prefeitos', `${mun.id}.json`), montarArquivoMunicipio(mun, todos, relacionados, listaFontes));
    }
  };

  // ---- PDFs: deliberação literal (governador primeiro, depois os pareceres mais recentes)
  const pdf = { disponivel: !args.semPdf && temPdfplumber(), lidos: 0, sem_deliberacao: 0, ilegiveis: 0, erros: 0, pendentes: 0, parou_por: null };
  const fila = [...govTodos, ...[...estado.values()].flatMap((e) => e.todos).sort((a, b) => (b.data_julgamento || '').localeCompare(a.data_julgamento || ''))]
    .filter((i) => i.parecer.documento && (!i.leitura_pdf || i.leitura_pdf.situacao === 'erro'));
  let interrompido = false;
  const aoSinal = () => { interrompido = true; };
  process.on('SIGTERM', aoSinal);
  process.on('SIGINT', aoSinal);
  if (pdf.disponivel) {
    let n = 0;
    for (const it of fila) {
      if (interrompido) { pdf.parou_por = 'sinal de interrupção'; break; }
      if (restante() < 30000) { pdf.parou_por = 'orçamento de tempo'; break; }
      if (n >= MAX_PDFS) { pdf.parou_por = 'TCEPR_MAX_PDFS'; break; }
      n++;
      try {
        const res = await abrir(it.parecer.documento.url, { esperado: /pdf|octet-stream/i, timeoutMs: Math.min(300000, Math.max(5000, restante())) });
        const buf = await lerBinario(res, 150e6);
        const gov = it.parecer.contas_de.startsWith('Governador');
        const t = textoFinalDoPdf(buf, gov ? 30 : 8);
        const d = t.legivel ? lerDeliberacao(t.texto, gov ? 20000 : 800) : null;
        it.leitura_pdf = {
          situacao: !t.legivel ? 'ilegivel' : d && d.item_parecer ? 'lido' : 'sem_deliberacao',
          versao: VERSAO_LEITURA, lido_em: hojeISO(), sha256: sha256(buf), paginas_lidas: t.paginas_lidas, total_paginas: t.total_paginas,
          ...(d ? { deliberacao: d.deliberacao, votacao: d.votacao, item_parecer: d.item_parecer, conclusao: d.conclusao, exercicio: d.exercicio } : {}),
        };
        if (it.leitura_pdf.situacao === 'lido') pdf.lidos++; else if (t.legivel) pdf.sem_deliberacao++; else pdf.ilegiveis++;
      } catch (e) {
        if (e.bloqueio) { pdf.parou_por = e.message; break; }
        it.leitura_pdf = { situacao: 'erro', lido_em: hojeISO(), erro: String(e.message).slice(0, 200) };
        pdf.erros++;
      }
      if (n % 40 === 0) { gravarMunicipios(); gravarGovernador(); console.error(`PDFs: ${n} de ${fila.length}`); }
    }
    pdf.pendentes = fila.filter((i) => !i.leitura_pdf || i.leitura_pdf.situacao === 'erro').length;
  } else {
    pdf.pendentes = fila.length;
    pdf.parou_por = args.semPdf ? '--sem-pdf' : `pdfplumber indisponível no Python (${acharPython()})`;
  }

  gravarGovernador();
  gravarMunicipios();

  // ---- meta
  const todos = [...estado.values()].flatMap((e) => e.todos);
  const exGov = fs.existsSync(path.join(SAIDA, 'contas-governador')) ? fs.readdirSync(path.join(SAIDA, 'contas-governador')).filter((n) => /^\d{4}\.json$/.test(n)).map((n) => n.slice(0, 4)).sort() : [];
  const meta = {
    atualizado_em: new Date().toISOString(),
    ultima_execucao: new Date().toISOString(),
    tribunal: 'tce-pr',
    arquivos_lidos_nesta_execucao: [...anosProcessados].sort(),
    arquivos_incompletos: anosIncompletos,
    contagens: {
      municipios: municipios.length,
      municipios_com_parecer: [...estado.values()].filter((e) => e.todos.length).length,
      pareceres_prefeitos: todos.length,
      pareceres_com_conclusao_literal: todos.filter((i) => i.parecer.conclusao).length,
      pareceres_sem_exercicio_na_fonte: todos.filter((i) => !i.parecer.exercicio).length,
      pdfs_lidos_total: todos.filter((i) => i.leitura_pdf?.situacao === 'lido').length,
      exercicios_governador: exGov,
      atos_por_arquivo: Object.fromEntries(lidos.map((l) => [l.ano, { atos: l.total, prefeitos: l.prefeito.length, governador: l.governador.length }])),
    },
    leitura_pdf_nesta_execucao: pdf,
    entidades_nao_casadas: Object.fromEntries([...naoCasadas].sort()),
    governador_sem_exercicio_na_fonte: govSemEx,
    fontes: [
      { ...fonte('Base de Dados — Dados Abertos do TCE-PR (lista dos arquivos anuais de acórdãos)', URL_BASE_DADOS) },
      ...listaFontes,
      { ...fonte('Regras de utilização dos dados abertos do TCE-PR', 'https://servicos.tce.pr.gov.br/servicos/arquivos/dadosabertos/dados_abertos_tcepr_regras_de_utilizacao.pdf'), observacao: 'Não acessado pelo coletor; lido na pesquisa de 04/11/2026: uso livre "para qualquer finalidade ou atividade, no limite das restrições legais"' },
      { ...fonteEntes, observacao: 'Lista oficial dos 399 municípios do Paraná usada para casar a entidade do CSV' },
    ],
    robots_e_restricoes: [
      `${HOST}/robots.txt (HTTP ${robots.status}) lido no início de cada execução: ${robots.disallow.length ? `Disallow ${robots.disallow.join(', ')}` : 'nenhum caminho proibido ("Disallow:" vazio)'}${robots.crawlDelayS ? `; Crawl-delay ${robots.crawlDelayS} s` : ''}.`,
      'Só o host viajuris.tce.pr.gov.br é acessado (página Base de Dados, arquivos CSV anuais e PDFs em /Arquivos/), uma requisição por vez, com pausa mínima de 1 s. Sem CAPTCHA, login ou token nesses endereços.',
      'Os CSV são lidos em streaming e não são guardados. Dos PDFs só se guarda o trecho literal da deliberação (até 800 caracteres; nas contas do Governador, a deliberação inteira até 20.000 caracteres).',
      'Não são republicados os campos de interessados (DsInteressado) e advogados (NmAdvogados), que trazem nomes de particulares.',
    ],
    observacoes: [
      'Contas dos Prefeitos: atos "Parecer Prévio" e "Acórdão de Parecer Prévio" da classe "PRESTAÇÃO DE CONTAS DO PREFEITO MUNICIPAL". Acórdãos da mesma classe (recursos, erro material) ficam em "acordaos_relacionados" do município.',
      'Contas do Governador: atos da classe "PRESTAÇÃO DE CONTAS DO GOVERNADOR DO ESTADO" no mesmo conjunto de dados (Tribunal Pleno).',
      'A conclusão é o texto literal ("Emitir Parecer Prévio pela …") da deliberação no PDF ou, na falta, a frase do resumo do conjunto de dados que a declara; não é deduzida dos termos de indexação.',
      `Rotina diária: relê os arquivos do ano atual e do anterior; histórico desde ${ANO_INICIAL} com --desde ${ANO_INICIAL}. Os itens dos demais anos são mantidos dos arquivos já gravados.`,
    ],
    lacunas: [
      'Julgamento das contas pelas Câmaras Municipais e pela Assembleia Legislativa do Paraná não coletado.',
      'O arquivo CSV do ano corrente pode estar defasado em relação ao rótulo de atualização da página (em 05/11/2026 o de 2026 constava como atualizado em 05/06/2026).',
      ...(pdf.pendentes ? [`${pdf.pendentes} PDF(s) de pareceres ainda não lidos; a leitura continua nas próximas execuções.`] : []),
    ],
    estatisticas_http: { ...estatisticas, falhas: estatisticas.falhas.slice(0, 20) },
    duracao_s: Math.round((Date.now() - inicio) / 1000),
  };
  gravarSeMudou(path.join(SAIDA, 'meta.json'), meta);
  console.log(JSON.stringify({ anos: meta.arquivos_lidos_nesta_execucao, incompletos: anosIncompletos, contagens: { ...meta.contagens, atos_por_arquivo: undefined }, pdf, nao_casadas: meta.entidades_nao_casadas, gravados: contagemGravacao.gravados.length, inalterados: contagemGravacao.inalterados.length, ignorados_tipo: ignoradosTipo, http: { requisicoes: estatisticas.requisicoes, bytes: estatisticas.bytes } }, null, 2));
  if (anosIncompletos.some((a) => !/orçamento/.test(a.motivo))) process.exitCode = 1;
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
