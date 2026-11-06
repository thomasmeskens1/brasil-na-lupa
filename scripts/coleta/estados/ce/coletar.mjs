#!/usr/bin/env node
/**
 * Coletor do Ceará (Assembleia Legislativa, ALECE, e Diário Oficial do Estado), Brasil na Lupa. Node 20+.
 *
 * USO
 *   node scripts/coleta/estados/ce/coletar.mjs                  # ano corrente
 *   node scripts/coleta/estados/ce/coletar.mjs --anos 2025,2026
 *   COLETA_ORCAMENTO_MIN=15 (padrão)  CE_MAX_FICHAS=60  CE_MAX_VOTACOES=61  CE_MAX_EDICOES=20  CE_REVISAR=1 (relê as votações em revisão)
 *   node scripts/coleta/estados/ce/testes.mjs                   # testes offline
 *
 * DEPENDÊNCIA: Python 3 + pdfplumber (requirements.txt), para ler os PDFs (relatórios de votação e Diário Oficial).
 *   Procura CE_PYTHON, ALESP_PYTHON, .venv desta pasta, .venv da ALESP, python do sistema. Sem ele, as etapas de PDF
 *   são puladas (registrado no meta.json). Cada PDF é gravado numa pasta temporária vazia e lido com "python -I".
 *
 * SAÍDA (dados/estados/ce/, mesmo contrato de PA, PE, DF, MA e PR):
 *   meta.json, parlamentares.json, proposicoes/indice-<ano>.json, normas/indice-<ano>.json,
 *   votacoes/<id>.json + votacoes/indice-<ano>.json, revisao-votacoes.json (votações NÃO publicadas, para revisão humana).
 *
 * REGRAS: robots.txt de cada host antes de qualquer outra requisição (www.al.ce.gov.br e transparencia.al.ce.gov.br
 * publicam e são obedecidos; www2.al.ce.gov.br e imagens.seplag.ce.gov.br não publicam: HTTP 404); intervalo mínimo
 * de 2 s por host; www.ce.gov.br nunca é acessado (robots.txt 403 = bloqueio total); nada de OCR; nenhum CAPTCHA ou
 * bloqueio é contornado; nada deduzido. Votação só é publicada quando a leitura do PDF confere com a apuração do PDF.
 * Código de saída: 0 = ok; 1 = falhou por inteiro.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { lerJson, hojeISO, fonte, chaveNome, conferirPrivacidade, textoPublico } from '../abertos/base.mjs';
import { lerIndices, gravar, gravarIndices, gravarVotacoes, porDataDesc } from '../abertos/saida.mjs';
import { CASA_CE, TABELAS, ClienteCE, interpretarDeputadosCE, interpretarBuscaCE, interpretarFichaCE, aplicarFichaCE, interpretarIndiceVotacoesCE, urlBusca, corpoBusca } from './alece.mjs';
import { lerRelatorioCE, identificarMateriaCE, montarVotacaoCE } from './votacao.mjs';
import { HOST_DOE, ORGAO_DOE, urlCaderno, lerCapaDOE, atosDoCaderno, diasDesc } from './diario.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const DIR = path.join(RAIZ, 'dados', 'estados', 'ce');
const EXTRATOR = path.join(AQUI, 'extrair_pdf.py');
const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const hoje = hojeISO();
const anos = (val('--anos') || hoje.slice(0, 4)).split(',').map(Number).filter((a) => a >= 2023 && a <= Number(hoje.slice(0, 4)));
if (!anos.length) { console.error('Uso: --anos AAAA[,AAAA] (31ª legislatura: 2023 em diante)'); process.exit(1); }
const inicio = Date.now();
const env = (k, d) => Number(process.env[k] || d);
const orcamentoMin = env('COLETA_ORCAMENTO_MIN', 15);
const MAX_FICHAS = env('CE_MAX_FICHAS', 60);
const MAX_VOT = env('CE_MAX_VOTACOES', 61);
const MAX_EDICOES = env('CE_MAX_EDICOES', 20);
const REVISAR = process.env.CE_REVISAR === '1';
const C = CASA_CE;
const log = (...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(0)}s] [CE]`, ...m);
const cliente = new ClienteCE({ prazoMs: inicio + orcamentoMin * 60000, log });
const falhas = [];
const tentar = async (rotulo, fn) => { try { return await fn(); } catch (e) { falhas.push(`${rotulo}: ${e.message}`); log(`FALHA ${rotulo}: ${e.message}`); return null; } };
fs.mkdirSync(DIR, { recursive: true });
const seguros = (lista) => lista.filter((it) => { try { conferirPrivacidade(it); return true; } catch (e) { falhas.push(`${it.id}: não gravado (${e.message})`); return false; } });
const metaAnt = lerJson(path.join(DIR, 'meta.json')) || {};
const edicoes = { ...(metaAnt.edicoes_doe || {}) };
log(`anos ${anos.join(', ')}; orçamento ${orcamentoMin} min; fichas ${MAX_FICHAS}; votações ${MAX_VOT}; edições do DOE ${MAX_EDICOES}`);

// ---------------------------------------------------------------- leitor de PDF (Python, pasta temporária vazia)
const execFileP = promisify(execFile);
function acharPython() {
  for (const k of ['CE_PYTHON', 'ALESP_PYTHON']) if (process.env[k]) return process.env[k];
  for (const d of [path.join(AQUI, '.venv'), path.join(RAIZ, 'scripts', 'coleta', 'alesp', '.venv')]) {
    for (const c of [path.join(d, 'Scripts', 'python.exe'), path.join(d, 'bin', 'python')]) if (fs.existsSync(c)) return c;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}
const PYTHON = acharPython();
let pythonOk = false;
try { await execFileP(PYTHON, ['-I', '-c', 'import pdfplumber'], { timeout: 60000, windowsHide: true }); pythonOk = true; } catch { falhas.push('Python com pdfplumber indisponível (ver requirements.txt): PDFs não lidos nesta execução'); }
async function lerPdf(buf, modo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-pdf-'));
  try {
    const arq = path.join(dir, 'documento.pdf');
    fs.writeFileSync(arq, buf);
    const { stdout } = await execFileP(PYTHON, ['-I', EXTRATOR, modo, arq], { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180000, windowsHide: true });
    return JSON.parse(stdout);
  } catch (e) {
    return { ok: false, paginas: [], erro: `leitor de PDF falhou: ${String(e.message).slice(0, 200)}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const ehPdf = (b) => b && b.length > 4 && b.subarray(0, 5).toString('latin1') === '%PDF-';

// ---------------------------------------------------------------- Diário Oficial (outro host: roda em paralelo)
const normas = lerIndices(DIR, 'normas');
const contDoe = { lidas: 0, sem_edicao: 0, sem_texto: 0, atos_novos: 0 };
const fluxoDoe = (async () => {
  if (!pythonOk) return;
  const ini = `${Math.min(...anos)}-01-01`;
  const recente = diasDesc(ini, hoje).slice(0, 4);
  const fila = diasDesc(ini, hoje).filter((d) => !edicoes[d] || (edicoes[d].situacao !== 'lida' && recente.includes(d)));
  for (const dia of fila.slice(0, MAX_EDICOES)) {
    if (!cliente.cabe(60000)) break;
    const url = urlCaderno(dia, 1);
    let buf;
    try { buf = await cliente.bytes(url, { aceitar: 'application/pdf' }); } catch (e) { falhas.push(`DOE ${dia}: ${e.message}`); if (e.robots || e.orcamento) break; continue; }
    if (!buf || !ehPdf(buf)) { edicoes[dia] = { situacao: 'sem-edicao', lida_em: hoje }; contDoe.sem_edicao++; continue; }
    const ext = await lerPdf(buf, 'texto');
    const capa = ext.ok ? lerCapaDOE(ext.paginas[0]) : null;
    if (!ext.ok || !ext.paginas.some((p) => p.trim())) { edicoes[dia] = { situacao: 'sem-texto', lida_em: hoje, url, motivo: ext.erro || 'PDF sem camada de texto (não é feito reconhecimento de imagem)' }; contDoe.sem_texto++; continue; }
    if (capa.data !== dia || capa.caderno !== 1) { edicoes[dia] = { situacao: 'capa-divergente', lida_em: hoje, url, motivo: `capa informa ${capa.data ?? '?'} caderno ${capa.caderno ?? '?'}` }; falhas.push(`DOE ${dia}: capa divergente; edição não usada`); continue; }
    const atos = atosDoCaderno(ext.paginas, { edicao: dia, url, hoje });
    for (const a of atos) { if (!normas.has(a.id)) contDoe.atos_novos++; if (!normas.has(a.id) || normas.get(a.id).data_publicacao >= a.data_publicacao) normas.set(a.id, a); }
    edicoes[dia] = { situacao: 'lida', lida_em: hoje, cadernos: capa.total, atos: atos.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
    contDoe.lidas++;
  }
  log(`DOE: ${contDoe.lidas} edição(ões) lida(s), ${contDoe.sem_edicao} dia(s) sem edição, ${contDoe.atos_novos} ato(s) novo(s); ${normas.size} atos gravados`);
})();

// ---------------------------------------------------------------- 1) Deputados
let parl = lerJson(path.join(DIR, 'parlamentares.json'));
const htmlDep = await tentar('deputados', () => cliente.html(`${C.portal}/deputados`));
if (htmlDep) {
  const novo = interpretarDeputadosCE(htmlDep, hoje);
  if (novo.itens.length >= 40) { parl = novo; gravar(path.join(DIR, 'parlamentares.json'), parl); log(`deputados: ${parl.itens.length}`); }
  else falhas.push(`deputados: a página trouxe ${novo.itens.length} cartões; lista anterior mantida`);
}
const porNome = new Map((parl?.itens || []).map((p) => [chaveNome(p.nome), p.id]));

// ---------------------------------------------------------------- 2) Votações nominais: índice CSV + PDFs (outro host: em paralelo)
const votDir = path.join(DIR, 'votacoes');
const votacoes = new Map();
for (const f of fs.existsSync(votDir) ? fs.readdirSync(votDir) : []) {
  if (!/^ce-[A-Za-z0-9]+\.json$/.test(f)) continue;
  const v = lerJson(path.join(votDir, f));
  if (v?.id) votacoes.set(v.id, v);
}
const revisao = new Map(((lerJson(path.join(DIR, 'revisao-votacoes.json')) || {}).itens || []).map((r) => [r.id, r]));
const contVot = { no_indice: 0, lidas_nesta_execucao: 0, publicadas_nesta_execucao: 0, em_revisao_nesta_execucao: 0 };
let indiceVot = [];
const lidos = new Map();
const fluxoVot = (async () => {
  const csv = await tentar('índice de votações nominais', () => cliente.html(`${C.transparencia}/consultas-gerais/votacao-nominal/votacaoNominalcsv`));
  if (!csv) return;
  indiceVot = await tentar('índice de votações nominais', async () => interpretarIndiceVotacoesCE(csv)) || [];
  contVot.no_indice = indiceVot.length;
  if (!pythonOk) return;
  const fila = indiceVot.filter((r) => !votacoes.has(r.id) && (REVISAR || !revisao.has(r.id)));
  for (const ref of fila.slice(0, MAX_VOT)) {
    if (!cliente.cabe(60000)) break;
    const buf = await tentar(`votação ${ref.chave}`, () => cliente.bytes(ref.url, { aceitar: 'application/pdf' }));
    if (!buf) continue;
    contVot.lidas_nesta_execucao++;
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const ext = ehPdf(buf) ? await lerPdf(buf, 'palavras') : { ok: false, erro: 'o endereço não devolveu um PDF' };
    const lido = ext.ok ? lerRelatorioCE(ext.paginas) : { erro: ext.erro };
    if (lido.erro || !/^NOMINAL\b/i.test(lido.cabecalho?.processo || '')) {
      const motivo = lido.erro || `processo de votação "${lido.cabecalho?.processo ?? ''}" não é nominal`;
      revisao.set(ref.id, { id: ref.id, url: ref.url, sessao: ref.sessao, materia: textoPublico(ref.materia).texto, motivo, tipo: lido.sem_texto ? 'lacuna: PDF sem texto' : 'revisão humana', sha256, em: hoje });
      contVot.em_revisao_nesta_execucao++;
      log(`  votação ${ref.chave} NÃO publicada: ${motivo}`);
      continue;
    }
    lidos.set(ref.id, { ref, lido, sha256 });
  }
})();

// ---------------------------------------------------------------- 3) Proposições: busca por ano (tabela × situação)
const projetos = lerIndices(DIR, 'proposicoes');
const contProp = { listas_lidas: 0, listas_com_falha: 0, fichas_lidas: 0 };
for (const ano of anos) for (const tabela of Object.keys(TABELAS)) for (const opcao of ['T', 'D']) {
  if (!cliente.cabe()) break;
  const rot = `proposições ${TABELAS[tabela].sigla} ${ano} ${opcao}`;
  const html = await tentar(rot, () => cliente.html(urlBusca(tabela, opcao), { metodo: 'POST', corpo: corpoBusca(ano) }));
  const r = html ? await tentar(rot, async () => interpretarBuscaCE(html, tabela, opcao, ano, hoje, porNome)) : null;
  if (!r) { contProp.listas_com_falha++; continue; }
  contProp.listas_lidas++;
  for (const it of r.itens) {
    const ant = projetos.get(it.id);
    const mudou = !ant || ant.situacao?.texto_oficial !== it.situacao.texto_oficial;
    projetos.set(it.id, ant?.detalhe_coletado_em ? {
      ...it, data_apresentacao: ant.data_apresentacao, data_leitura_expediente: ant.data_leitura_expediente, url_pdf: ant.url_pdf, tramitacao: ant.tramitacao,
      situacao: { ...it.situacao, ultima_tramitacao: ant.situacao.ultima_tramitacao, url_norma: ant.situacao.url_norma, comissoes: ant.situacao.comissoes, lei_numero: it.situacao.lei_numero ?? ant.situacao.lei_numero },
      detalhe_coletado_em: mudou ? null : ant.detalhe_coletado_em, detalhe_anterior_em: mudou ? ant.detalhe_coletado_em : undefined, lacunas: ant.lacunas,
    } : it);
  }
}
log(`proposições: ${contProp.listas_lidas} lista(s) lida(s); ${projetos.size} projetos`);

// Fichas: as que nunca foram lidas ou mudaram de situação; depois as em tramitação lidas há mais de 14 dias.
const velha = (p) => p.situacao?.texto_oficial?.startsWith('Tramit') && p.detalhe_coletado_em && (Date.parse(hoje) - Date.parse(p.detalhe_coletado_em)) / 86400000 > 14;
const filaF = [...projetos.values()].filter((p) => anos.includes(p.ano) && (!p.detalhe_coletado_em || velha(p)))
  .sort((a, b) => Number(!!a.detalhe_coletado_em) - Number(!!b.detalhe_coletado_em) || b.id_oficial - a.id_oficial);
for (const p of filaF.slice(0, MAX_FICHAS)) {
  if (!cliente.cabe()) break;
  const html = await tentar(`ficha ${p.id}`, () => cliente.html(p.url));
  const f = html ? interpretarFichaCE(html, hoje) : null;
  if (!f) continue;
  const novo = aplicarFichaCE(p, f, hoje);
  delete novo.detalhe_anterior_em;
  projetos.set(p.id, novo);
  contProp.fichas_lidas++;
}
log(`fichas lidas: ${contProp.fichas_lidas} (na fila: ${filaF.length})`);

await Promise.all([fluxoVot, fluxoDoe]);

// ---------------------------------------------------------------- 4) Montagem das votações (com a ligação exata ao projeto)
for (const { ref, lido, sha256 } of lidos.values()) {
  const ident = lido.cabecalho.bloco ? null : identificarMateriaCE(lido.cabecalho.materia);
  let projeto = null;
  if (ident) {
    const cands = [...projetos.values()].filter((p) => p.tabela_oficial === ident.tabela && p.numero === ident.numero && p.ano === ident.ano
      && (!ident.mensagem || String(p.ementa || '').replace(/\./g, '').includes(ident.mensagem)));
    projeto = cands.length === 1 ? cands[0] : null;
  }
  const def = ident ? TABELAS[ident.tabela] : null;
  const v = montarVotacaoCE(ref, lido, { hoje, sha256, porNome, projeto, sigla: def?.sigla ?? null, tipo: def?.tipo ?? null, ident });
  votacoes.set(v.id, v);
  revisao.delete(v.id);
  contVot.publicadas_nesta_execucao++;
}
log(`votações: ${contVot.no_indice} no índice; ${votacoes.size} publicadas; ${revisao.size} em revisão`);

// ---------------------------------------------------------------- 5) Leis ligadas ao projeto pela própria ficha da ALECE (campo "Lei")
const porLei = new Map();
for (const p of projetos.values()) {
  const n = p.situacao?.lei_numero ? Number(String(p.situacao.lei_numero).replace(/\./g, '')) : null;
  if (n) porLei.set(n, porLei.has(n) ? 'repetido' : p);
}
for (const [id, a] of normas) {
  if (a.tipo !== 'Lei' && a.tipo !== 'Lei Complementar') continue;
  const p = porLei.get(a.numero);
  if (!p || p === 'repetido' || (a.tipo === 'Lei Complementar') !== (p.sigla === 'PLC')) continue;
  normas.set(id, {
    ...a, projeto: { sigla: p.sigla, numero: p.numero, ano: p.ano, url: p.url },
    lacunas: a.lacunas.filter((l) => !/^Proposição de origem/.test(l)).concat('Proposição de origem: ficha do projeto na ALECE, que informa o número desta lei.'),
  });
}

// ---------------------------------------------------------------- 6) Gravação
const listaP = [...projetos.values()];
const listaN = [...normas.values()];
const listaV = [...votacoes.values()];
const contP = gravarIndices(DIR, 'proposicoes', seguros(listaP), (p) => p.ano, (ano) => ({
  atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano,
  fonte: fonte(`Proposições de ${ano} — sistema de proposições da ALECE (31ª legislatura)`, `${C.legado}/numero.php?nome=${C.legislatura}&tabela=projeto_lei&opcao=T`, C.nome, hoje),
}), porDataDesc('data_apresentacao'));
const contN = gravarIndices(DIR, 'normas', seguros(listaN), (n) => n.ano, (ano) => ({
  atualizado_em: hoje, uf: C.uf, ano: Number(ano) || ano,
  abrangencia: 'Leis, leis complementares, emendas constitucionais e decretos numerados do Governador publicados no caderno do Poder Executivo do Diário Oficial do Estado do Ceará (PDF), nas edições já lidas.',
  fontes: [fonte('Diário Oficial do Estado do Ceará (PDF por edição)', `${HOST_DOE}/PDF/`, ORGAO_DOE, hoje)],
}), (a, b) => String(b.data_publicacao).localeCompare(String(a.data_publicacao)) || (b.numero || 0) - (a.numero || 0));
const contV = gravarVotacoes(DIR, seguros(listaV), (ano) => ({ atualizado_em: hoje, uf: C.uf, casa: C.casa, ano: Number(ano) || ano }));
const listaRev = [...revisao.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
gravar(path.join(DIR, 'revisao-votacoes.json'), {
  atualizado_em: hoje, uf: C.uf, casa: C.casa,
  explicacao: 'Votações nominais do índice oficial que NÃO foram publicadas no site: a leitura do PDF não conferiu exatamente com a apuração do próprio PDF (ou o PDF não tem texto). Precisam de conferência humana; nada aqui é deduzido.',
  itens: listaRev,
});

const porTipoN = {};
for (const a of listaN) porTipoN[`${a.ano} ${a.tipo}`] = (porTipoN[`${a.ano} ${a.tipo}`] ?? 0) + 1;
const meta = {
  atualizado_em: new Date().toISOString(), ultima_execucao: new Date(inicio).toISOString(), uf: C.uf, casa: C.casa, orgao: C.nome,
  periodo: { anos, fim: hoje }, modo: 'incremental',
  fontes: [
    fonte('Votação nominal — Portal da Transparência da ALECE', `${C.transparencia}/consultas-gerais/votacao-nominal`, C.nome, hoje),
    fonte('Proposições — sistema de proposições da ALECE', `${C.portal}/paginas/proposicoes?menu=96`, C.nome, hoje),
    fonte('Deputados — portal da ALECE', `${C.portal}/deputados`, C.nome, hoje),
    fonte('Diário Oficial do Estado do Ceará (PDF por edição)', `${HOST_DOE}/PDF/`, ORGAO_DOE, hoje),
  ],
  robots: { ...cliente.resumoRobots(), 'www.ce.gov.br': { status: 403, observacao: 'robots.txt respondeu HTTP 403 no levantamento de 2026-11-02: tratado como bloqueio total; o domínio não é acessado' } },
  execucao: { requisicoes: cliente.requisicoes, python: pythonOk, falhas: [...new Set([...falhas, ...cliente.falhas])].slice(0, 60) },
  contagens: {
    parlamentares: parl?.itens?.length ?? 0, proposicoes_por_ano: contP, normas_por_ano: contN, normas_por_tipo: porTipoN, votacoes_por_ano: contV,
    votacoes_no_indice_oficial: contVot.no_indice, votacoes_publicadas: listaV.length, votacoes_em_revisao: listaRev.filter((r) => r.tipo === 'revisão humana').length,
    votacoes_pdf_sem_texto: listaRev.filter((r) => r.tipo !== 'revisão humana').length,
    votacoes_lidas_nesta_execucao: contVot.lidas_nesta_execucao,
    votacoes_ligadas_a_projeto: listaV.filter((v) => v.proposicao?.id).length,
    votos_sem_ligacao_com_deputado: listaV.reduce((s, v) => s + v.votos.filter((x) => !x.parlamentar_id).length, 0),
    proposicoes_sem_ficha: listaP.filter((p) => !p.detalhe_coletado_em).length, fichas_lidas_nesta_execucao: contProp.fichas_lidas,
    listas_de_proposicoes_lidas: contProp.listas_lidas, listas_de_proposicoes_com_falha: contProp.listas_com_falha,
    edicoes_doe_lidas: Object.values(edicoes).filter((e) => e.situacao === 'lida').length, edicoes_doe_lidas_nesta_execucao: contDoe.lidas,
    dias_sem_edicao_doe: Object.values(edicoes).filter((e) => e.situacao === 'sem-edicao').length,
    edicoes_doe_sem_texto: Object.values(edicoes).filter((e) => e.situacao === 'sem-texto').length,
    leis_ligadas_a_projeto: listaN.filter((n) => n.projeto).length,
  },
  observacoes: [
    'Fontes: portal da Assembleia Legislativa do Ceará (deputados), sistema de proposições da ALECE (www2, páginas HTML antigas), Portal da Transparência da ALECE (índice das votações nominais em CSV e um PDF por votação) e Diário Oficial do Estado (PDF por edição em imagens.seplag.ce.gov.br). O portal www.ce.gov.br não é acessado: o robots.txt respondeu HTTP 403. Intervalo mínimo de 2 s entre requisições ao mesmo host.',
    'Votações: a própria ALECE informa que a votação nominal é pouco frequente e que a prática predominante no Plenário é a votação simbólica. Só as votações nominais têm o voto de cada deputado; nas demais, o voto individual não existe na fonte ("Informação não disponível em fonte oficial").',
    'Leitura dos relatórios de votação (PDF): as colunas são localizadas pelas bordas da tabela e pelo cabeçalho; o voto escrito em cada célula precisa ser igual ao título da coluna, e as quantidades de cada coluna precisam ser iguais às da linha "Apuração" do PDF. Se algo não conferir, a votação não é publicada e vai para revisao-votacoes.json, para conferência humana. PDF sem texto não passa por reconhecimento de imagem: fica registrado como lacuna.',
    `"Sem voto registrado": o deputado aparece no relatório sem marcação em nenhuma coluna; o relatório não diz o motivo. "(P)" e "(V)" no PDF indicam voto presencial ou virtual. Partido como impresso no relatório (nos relatórios de 2023 vem com o nome por extenso).`,
    'Deputados: página de deputados da ALECE (em exercício, licenciados e suplentes em exercício). O voto é ligado ao deputado só quando o nome do relatório é idêntico ao da página (sem acentos e maiúsculas); os demais aparecem na votação sem ligação com o perfil.',
    'Proposições: projetos de lei (PL), projetos de lei oriundos de mensagem do Executivo e de outros Poderes (numeração própria da ALECE, aqui "PLM"), projetos de lei complementar, propostas de emenda à Constituição, projetos de decreto legislativo e de resolução da 31ª legislatura, pela busca por ano do sistema da ALECE. Indicações não entram. A ficha com o andamento é lida aos poucos (CE_MAX_FICHAS por execução). Uma votação é ligada ao projeto só quando o relatório traz o tipo, o número e o ano, e há exatamente um projeto com esses dados (e com o mesmo número de mensagem, quando citado).',
    'Normas: leis, leis complementares, emendas constitucionais e decretos numerados do Governador, lidos no caderno do Poder Executivo do Diário Oficial (PDF com texto), das edições mais recentes para as mais antigas (CE_MAX_EDICOES por execução). Um ato só entra quando o cabeçalho ocupa a linha inteira e é seguido da fórmula do Governador; citações a outros atos ficam de fora. Edições extras e outros cadernos não são lidos.',
    'Vetos e razões de veto: publicados no Diário Oficial como mensagens; ainda não separados ("Informação não disponível em fonte oficial" nesta coleta).',
  ],
  edicoes_doe: edicoes,
};
gravar(path.join(DIR, 'meta.json'), meta);
const ok = Boolean(parl?.itens?.length || projetos.size || normas.size || votacoes.size);
log(`${ok ? 'ok' : 'falhou'} — ${JSON.stringify(meta.contagens)}`);
process.exit(ok ? 0 : 1);
