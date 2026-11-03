#!/usr/bin/env node
/**
 * Coletor da Assembleia Legislativa do Espírito Santo (ALES) — Brasil na Lupa.
 *
 * USO
 *   node scripts/coleta/estados/es/coletar.mjs                 # incremental, prioriza o ano corrente
 *   node scripts/coleta/estados/es/coletar.mjs --completo      # reprocessa tudo desde 2023
 *   node scripts/coleta/estados/es/coletar.mjs --anos 2026
 *   node scripts/coleta/estados/es/coletar.mjs --etapas parlamentares,votacoes,proposicoes,normas
 *   COLETA_ORCAMENTO_MIN=20 (padrão) limita o tempo; o que faltar fica no cursor de meta.json.
 *   node scripts/coleta/estados/es/testes.mjs                  # testes offline
 *
 * SAÍDAS (dados/estados/es/)
 *   meta.json, parlamentares.json, proposicoes/indice-<ano>.json, votacoes/<id>.json (+ índice anual),
 *   normas/indice-<ano>.json (leis ordinárias, complementares e emendas constitucionais).
 *
 * VOTOS: só há voto individual quando a ALES publica o "Boletim de Votação Nominal" (tipo RVP), PDF do painel.
 *   O PDF é lido por scripts/coleta/estados/es/extrair_boletim_pdf.py (pdfplumber), sempre com "python -I"
 *   numa pasta temporária vazia (o PDF é dado não confiável). O boletim só é publicado quando as linhas
 *   conferem com os totais impressos nele; senão, não é gravado e o motivo vai para meta.json.
 *   Demais votações da ALES são simbólicas e não têm boletim (não aparecem aqui).
 * DEPENDÊNCIA: Python 3 + pdfplumber (scripts/coleta/alesp/requirements.txt). O Python é procurado em
 *   ES_PYTHON, ALESP_PYTHON, scripts/coleta/estados/es/.venv, scripts/coleta/alesp/.venv, python3/python.
 *   Sem pdfplumber, os boletins não são processados (os arquivos existentes são mantidos).
 * PRIVACIDADE: a API de proposições traz CPF, e-mail e telefone de quem protocolou (AutorRequerenteDados):
 *   esses campos nunca são lidos para gravação. E-mail de deputado só o institucional (@al.es.gov.br).
 * Decretos do Governador: só no DIO-ES (PDF diário, sem API de atos) — fora desta versão.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buscar, robotsDe, resumoRobots, emLotes, criarOrcamento, gravar, lerJson, hojeISO, estatisticas, contagemGravacao,
  gravarIndicesVotacoes, dataBR,
} from '../rn/base.mjs';
import {
  HOST, API, ORGAO, UF, CASA, SIGLAS_INDICE, TIPOS_NORMA, montarParlamentar, montarProposicao, montarNorma,
  indiceDeNomes, lerBoletim, lerTitulo, montarVotacaoBoletim,
} from './ales.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const DIR = path.join(RAIZ, 'dados', 'estados', 'es');
const DIR_VOT = path.join(DIR, 'votacoes');
const DIR_PROP = path.join(DIR, 'proposicoes');
const DIR_NORMAS = path.join(DIR, 'normas');
const EXTRATOR = path.join(AQUI, 'extrair_boletim_pdf.py');
const INICIO_ANO = 2023; // 20ª legislatura (2023–2027)
const REGRAS = lerJson(path.join(DIR, 'revisao', 'mascaras.json'))?.regras || [];

const args = process.argv.slice(2);
const hoje = hojeISO();
const anoAtual = Number(hoje.slice(0, 4));
const completo = args.includes('--completo');
const iAnos = args.indexOf('--anos');
const anos = iAnos >= 0
  ? String(args[iAnos + 1] || '').split(',').map(Number).filter((a) => a >= 2019 && a <= anoAtual).sort((a, b) => b - a)
  : Array.from({ length: anoAtual - INICIO_ANO + 1 }, (_, i) => anoAtual - i);
const iEt = args.indexOf('--etapas');
const ETAPAS = new Set(iEt >= 0 ? String(args[iEt + 1] || '').split(',') : ['parlamentares', 'votacoes', 'proposicoes', 'normas']);
const orc = criarOrcamento();
const log = (...m) => console.log(`[${orc.decorrido().toFixed(1)}s]`, ...m);
const falhas = [];
const pendencias = [];
async function etapa(nome, fn) {
  try { return await fn(); } catch (e) { falhas.push(`${nome}: ${e.message}`); log(`FALHA em ${nome}: ${e.message}`); return null; }
}
const fonte = (titulo, url) => ({ titulo, url, orgao: ORGAO, acessado_em: hoje });
const metaAntiga = lerJson(path.join(DIR, 'meta.json')) || {};
const cursor = { proposicoes_listadas_em: {}, normas_listadas_em: {}, boletins_nao_publicados: {}, ...(metaAntiga.cursor || {}) };
const semanal = (ano, quando) => !completo && ano < anoAtual && quando && quando >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
log(`ALES: anos ${anos.join(', ')}; orçamento ${orc.minutos} min${completo ? '; modo completo' : ''}`);

/** Lista paginada da API (formato { total, Data[], Paginacao }). Página com erro é refeita em páginas menores. */
async function listar(base, { qtd = 100, campo = 'Data' } = {}) {
  const itens = [];
  const problemas = [];
  for (let pag = 1; pag < 2000; pag++) {
    let j;
    try { j = await buscar(`${base}&pag=${pag}&qtd=${qtd}`); } catch (e) { j = { erro: true, mensagem: e.message }; }
    if (j?.erro || !Array.isArray(j?.[campo])) {
      // Ex.: {"erro":true,"mensagem":"Nullable object must have a value."} — refaz o trecho de 10 em 10.
      const sub = 10, k = qtd / sub;
      let algum = false;
      for (let s = 1; s <= k; s++) {
        const p = (pag - 1) * k + s;
        let js;
        try { js = await buscar(`${base}&pag=${p}&qtd=${sub}`); } catch (e) { js = { erro: true, mensagem: e.message }; }
        if (Array.isArray(js?.[campo])) { itens.push(...js[campo]); algum = algum || js[campo].length > 0; }
        else problemas.push(`${base}&pag=${p}&qtd=${sub}: ${js?.mensagem || 'resposta inválida'}`);
      }
      if (!algum) break;
      continue;
    }
    itens.push(...j[campo]);
    if (j[campo].length < qtd || !j?.Paginacao?.proxima) break;
  }
  return { itens, problemas };
}

// ---------- 0. robots.txt ----------
const robots = await robotsDe(HOST);
log(`robots.txt ${HOST}: ${robots.observacao}`);

// ---------- 1. parlamentares ----------
let parlamentares = lerJson(path.join(DIR, 'parlamentares.json'))?.itens || [];
const cont = {};
if (ETAPAS.has('parlamentares') || !parlamentares.length) await etapa('parlamentares', async () => {
  const url = `${API}/parlamentar/?pag=1&qtd=100`;
  const j = await buscar(url, { timeoutMs: 120000 });
  const lista = Array.isArray(j?.parlamentares) ? j.parlamentares : [];
  if (j?.paginacao?.proxima) pendencias.push('parlamentares: a fonte indicou mais de uma página');
  parlamentares = lista.map(montarParlamentar).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  cont.parlamentares = { total: parlamentares.length, em_exercicio: parlamentares.filter((p) => p.em_exercicio).length };
  gravar(path.join(DIR, 'parlamentares.json'), {
    atualizado_em: hoje, uf: UF, casa: CASA,
    fonte: fonte('Deputados da 20ª legislatura — dados abertos da ALES', url),
    itens: parlamentares,
  });
  log(`Parlamentares: ${parlamentares.length}`);
});
const nomes = indiceDeNomes(parlamentares);

// ---------- 2. boletins de votação nominal ----------
function acharPython() {
  if (process.env.ES_PYTHON) return process.env.ES_PYTHON;
  if (process.env.ALESP_PYTHON) return process.env.ALESP_PYTHON;
  for (const d of [path.join(AQUI, '.venv'), path.join(RAIZ, 'scripts', 'coleta', 'alesp', '.venv')]) {
    for (const c of [path.join(d, 'Scripts', 'python.exe'), path.join(d, 'bin', 'python')]) if (fs.existsSync(c)) return c;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}
function extrairLinhas(buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ales-rvp-'));
  const arq = path.join(dir, 'boletim.pdf');
  try {
    fs.writeFileSync(arq, buf);
    const out = execFileSync(acharPython(), ['-I', EXTRATOR, arq], { cwd: dir, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120000, windowsHide: true });
    return JSON.parse(out);
  } catch (e) {
    return { ok: false, linhas: [], erro: `extrator falhou: ${String(e.message).slice(0, 200)}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const contVot = { boletins_na_fonte: 0, no_periodo: 0, processados: 0, publicados: 0, nao_publicados: 0, ja_gravados: 0 };
if (ETAPAS.has('votacoes')) await etapa('boletins', async () => {
  try {
    execFileSync(acharPython(), ['-I', '-c', 'import pdfplumber'], { stdio: 'ignore', timeout: 60000, windowsHide: true });
  } catch {
    throw new Error('Python com pdfplumber indisponível; boletins não processados (ver scripts/coleta/alesp/requirements.txt)');
  }
  const { itens, problemas } = await listar(`${API}/proposicao/?sigla=RVP`, { qtd: 50 });
  for (const p of problemas) pendencias.push(`lista de boletins: ${p}`);
  contVot.boletins_na_fonte = itens.length;
  const alvos = itens.filter((x) => x.sigla === 'RVP' && anos.includes(Number(dataBR(x.data).data?.slice(0, 4))))
    .sort((a, b) => String(dataBR(b.data).data).localeCompare(String(dataBR(a.data).data)));
  contVot.no_periodo = alvos.length;
  log(`Boletins: ${itens.length} na fonte; ${alvos.length} em ${anos.join('/')}`);
  const cacheProp = new Map();
  let semTempo = 0;
  await emLotes(alvos, async (item) => {
    const arq = path.join(DIR_VOT, `es-rvp-${item.id}.json`);
    if (fs.existsSync(arq) && !completo) { contVot.ja_gravados++; return; }
    if (!orc.resta()) { semTempo++; return; }
    if (!/^https:\/\/www3\.al\.es\.gov\.br\//.test(item.arquivo || '')) {
      cursor.boletins_nao_publicados[item.id] = { url: item.arquivo || null, motivo: 'boletim sem PDF no domínio oficial', em: hoje };
      contVot.nao_publicados++; return;
    }
    const buf = await buscar(item.arquivo, { tipo: 'bin', timeoutMs: 120000 });
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const ext = extrairLinhas(buf);
    contVot.processados++;
    const lido = ext.ok ? lerBoletim(ext.linhas) : { ok: false, problemas: [ext.erro || 'leitura do PDF falhou'] };
    if (!lido.ok) {
      cursor.boletins_nao_publicados[item.id] = { url: item.arquivo, sha256, motivo: lido.problemas.slice(0, 5).join('; '), em: hoje };
      contVot.nao_publicados++;
      log(`  boletim ${item.id} NÃO publicado: ${lido.problemas.slice(0, 2).join('; ')}`);
      return;
    }
    // Proposição votada: busca por sigla/número/ano do título; liga só se houver exatamente uma.
    const tit = lerTitulo(lido.cabecalho.titulo);
    let pid = null;
    if (tit.sigla && tit.numero && tit.ano) {
      const k = `${tit.sigla}-${tit.numero}-${tit.ano}`;
      if (!cacheProp.has(k)) {
        const r = await buscar(`${API}/proposicao/?sigla=${tit.sigla}&numero=${tit.numero}&ano=${tit.ano}&pag=1&qtd=5`).catch(() => null);
        const ok = (Array.isArray(r?.Data) ? r.Data : []).filter((x) => x.sigla === tit.sigla && Number(x.numero) === tit.numero && Number(x.ano) === tit.ano);
        cacheProp.set(k, ok.length === 1 ? ok[0].id : null);
      }
      pid = cacheProp.get(k);
    }
    const reg = montarVotacaoBoletim(item, lido, { hoje, sha256, indiceNomes: nomes, proposicaoId: pid, regras: REGRAS });
    gravar(arq, reg);
    delete cursor.boletins_nao_publicados[item.id];
    contVot.publicados++;
  });
  if (semTempo) pendencias.push(`boletins: ${semTempo} ficaram para a próxima execução (orçamento de tempo)`);
  log(`Boletins: ${contVot.publicados} publicado(s), ${contVot.nao_publicados} não publicado(s), ${contVot.ja_gravados} já gravado(s)`);
});

// ---------- 3. proposições ----------
const contProp = {};
if (ETAPAS.has('proposicoes')) for (const ano of anos) {
  if (!orc.resta()) { pendencias.push(`proposições ${ano}: não listadas (orçamento de tempo)`); continue; }
  if (semanal(ano, cursor.proposicoes_listadas_em[ano])) { log(`Proposições ${ano}: listadas em ${cursor.proposicoes_listadas_em[ano]}; atualização semanal`); continue; }
  await etapa(`proposições ${ano}`, async () => {
    // Uma listagem por sigla (a lista geral do ano tem milhares de requerimentos e indicações e
    // leva mais de 10 minutos). Sigla sem tempo para listar mantém os itens do índice anterior.
    const arq = path.join(DIR_PROP, `indice-${ano}.json`);
    const antigos = lerJson(arq)?.itens || [];
    const porSiglaFonte = {};
    const novos = new Map();
    const atualizadas = new Set();
    let problemasAno = 0;
    for (const sigla of SIGLAS_INDICE) {
      if (!orc.resta()) { pendencias.push(`proposições ${ano} ${sigla}: não listadas (orçamento de tempo); mantidos os itens anteriores`); continue; }
      const { itens: brutos, problemas } = await listar(`${API}/proposicao/?sigla=${sigla}&ano=${ano}`, { qtd: 100 });
      for (const p of problemas) pendencias.push(`proposições ${ano}: ${p}`);
      problemasAno += problemas.length;
      porSiglaFonte[sigla] = brutos.length;
      // O filtro da fonte é conferido em cada registro (sigla e ano).
      for (const p of brutos) if (p.sigla === sigla && Number(p.ano) === ano && !novos.has(p.id)) novos.set(p.id, montarProposicao(p, { hoje, indiceNomes: nomes, regras: REGRAS }));
      if (!problemas.length) atualizadas.add(sigla);
    }
    for (const a of antigos) if (!atualizadas.has(a.sigla) && !novos.has(a.id_oficial)) novos.set(a.id_oficial, a);
    const itens = [...novos.values()]
      .sort((a, b) => String(a.sigla).localeCompare(String(b.sigla)) || (b.numero ?? 0) - (a.numero ?? 0));
    contProp[ano] = { no_indice: itens.length, por_sigla_na_fonte: porSiglaFonte, paginas_com_erro: problemasAno };
    gravar(arq, {
      atualizado_em: hoje, uf: UF, casa: CASA, ano,
      fonte: fonte(`Proposições de ${ano} — dados abertos da ALES`, `${API}/proposicao/?ano=${ano}`),
      itens,
    });
    if (atualizadas.size === SIGLAS_INDICE.size) cursor.proposicoes_listadas_em[ano] = hoje;
    log(`Proposições ${ano}: ${itens.length} no índice (${atualizadas.size}/${SIGLAS_INDICE.size} siglas atualizadas)`);
  });
}

// ---------- 4. normas ----------
const contNormas = {};
if (ETAPAS.has('normas')) for (const ano of anos) {
  if (!orc.resta()) { pendencias.push(`normas ${ano}: não listadas (orçamento de tempo)`); continue; }
  if (semanal(ano, cursor.normas_listadas_em[ano])) continue;
  await etapa(`normas ${ano}`, async () => {
    const itens = [];
    for (const t of TIPOS_NORMA) {
      const { itens: brutos, problemas } = await listar(`${API}/legislacao?ano=${ano}&tipo=${t.tipoId}`, { qtd: 100 });
      for (const p of problemas) pendencias.push(`normas ${ano}: ${p}`);
      // O filtro da fonte já foi visto ignorando parâmetros: confere tipo e ano de cada registro.
      for (const x of brutos) if (String(x.tipoId) === String(t.tipoId) && Number(x.ano) === ano) itens.push(montarNorma(x, t, { hoje, regras: REGRAS }));
    }
    itens.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || a.id.localeCompare(b.id));
    const porTipo = {};
    for (const i of itens) porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1;
    contNormas[ano] = { total: itens.length, por_tipo: porTipo };
    gravar(path.join(DIR_NORMAS, `indice-${ano}.json`), {
      atualizado_em: hoje, uf: UF, ano, abrangencia: 'Leis ordinárias, leis complementares e emendas à Constituição do Estado do Espírito Santo',
      fontes: TIPOS_NORMA.map((t) => fonte(`${t.nome} — legislação da ALES`, `${API}/legislacao?tipo=${t.tipoId}&ano=${ano}`)),
      itens,
    });
    cursor.normas_listadas_em[ano] = hoje;
    log(`Normas ${ano}: ${itens.length}`);
  });
}

// ---------- 5. índices e meta ----------
let contIndices = {};
await etapa('índices de votações', async () => { contIndices = gravarIndicesVotacoes(DIR_VOT, { uf: UF, casa: CASA, hoje }); });
const agora = new Date().toISOString();
gravar(path.join(DIR, 'meta.json'), {
  atualizado_em: agora,
  ultima_execucao: agora,
  uf: UF,
  casa: CASA,
  periodo: { anos, inicio_cobertura: `${INICIO_ANO}-01-01`, fim: hoje },
  modo: completo ? 'completo' : 'incremental',
  duracao_s: Math.round(orc.decorrido()),
  orcamento_min: orc.minutos,
  contagens: {
    parlamentares: cont.parlamentares ?? metaAntiga.contagens?.parlamentares ?? null,
    votacoes_por_ano: contIndices,
    ...(ETAPAS.has('votacoes') ? { boletins_nesta_execucao: contVot } : {}),
    proposicoes_nesta_execucao: contProp,
    normas_nesta_execucao: contNormas,
    requisicoes: estatisticas.requisicoes,
  },
  fontes: [
    fonte('Dados abertos da ALES — catálogo', 'https://www3.al.es.gov.br/dados-abertos.aspx'),
    fonte('API pública de proposições', `${API}/proposicao/`),
    fonte('API pública de legislação', `${API}/legislacao`),
  ],
  robots: resumoRobots(),
  observacoes: [
    'Voto individual: só nos Boletins de Votação Nominal (RVP) publicados pela ALES. A maior parte das votações da Casa é simbólica e não tem registro nominal; elas não aparecem em votacoes/.',
    'Boletim publicado só quando as linhas (deputado, partido, voto) conferem com os totais impressos no próprio boletim (Sim, Não, Abstenção) e o modo é "Nominal"; os demais ficam em cursor.boletins_nao_publicados com o motivo.',
    'Voto reproduzido como no boletim ("Sim", "Não", "Abstenção", "Ausente", "Não votou", "Licenciado"), inclusive "Ausente" com horário. Nome e partido como impressos (abreviados); parlamentar_id só com correspondência única na lista oficial (expansões fixas: DEL = Delegado, ENG = Engenheiro).',
    'Resultado: "aprovada"/"rejeitada" só quando o boletim diz isso; outros textos (ex.: "MANTIDO O VETO") ficam em resultado_texto_oficial, com resultado null.',
    'Proposição votada: lida do título do boletim e ligada à API só quando a busca por sigla, número e ano devolve exatamente uma proposição.',
    'A API de proposições traz CPF, e-mail e telefone de quem protocolou (AutorRequerenteDados): não são gravados. Autor mantido só quando é órgão/cargo público ou deputado da lista oficial; senão, nome omitido.',
    'A lista de proposições/boletins às vezes responde erro numa página ("Nullable object must have a value."); o trecho é refeito de 10 em 10 e o que continuar com erro é registrado nas pendências.',
    'Índice de proposições: PL, PLC, PEC, PDL, PR, MV (veto) e MGE (mensagem do Governo do Estado), listados por sigla; ementa = campo "assunto" da fonte, com nomes de particulares mascarados.',
    'Normas: leis ordinárias (tipo 3), complementares (4) e emendas à Constituição Estadual (2) da API de legislação. A API não traz os decretos do Governador (só os da própria Assembleia); decretos do Executivo exigem o DIO-ES em PDF e ficam para depois.',
    'A rota de detalhe de sessão (/api/publico/spl/sessoes/?id=) respondeu HTTP 500 na pesquisa; sessões não são coletadas.',
    ...(pendencias.length ? [`Pendências desta execução: ${pendencias.join(' | ')}`] : []),
    ...(falhas.length ? [`Falhas nesta execução: ${falhas.join(' | ')}`] : []),
  ],
  cursor,
});
log(`Fim. Requisições: ${estatisticas.requisicoes} (retentativas ${estatisticas.retentativas}), ${(estatisticas.bytes / 1e6).toFixed(1)} MB. `
  + `Arquivos gravados: ${contagemGravacao.gravados}, inalterados: ${contagemGravacao.inalterados}.`);
if (falhas.length) { console.error('Falhas:\n- ' + falhas.join('\n- ')); process.exit(1); }
