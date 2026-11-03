#!/usr/bin/env node
/**
 * Coletor da Assembleia Legislativa de Minas Gerais (ALMG): deputados, proposições, votações nominais
 * de Plenário (atas do Diário do Legislativo), votos de comissões (quando a API os traz) e normas.
 *
 * USO
 *   node scripts/coleta/estados/mg/coletar.mjs                     # incremental (ano atual e anterior)
 *   node scripts/coleta/estados/mg/coletar.mjs --anos 2026
 *   node scripts/coleta/estados/mg/coletar.mjs --etapas parlamentares,proposicoes,plenario,comissoes,normas
 *   COLETA_ORCAMENTO_MIN=20 (padrão). O que faltar (edições do Diário ainda não lidas) fica no cursor.
 *   node scripts/coleta/estados/mg/testes.mjs                      # testes offline
 *
 * SAÍDAS (dados/estados/mg/): meta.json, parlamentares.json, proposicoes/indice-<ano>.json,
 *   votacoes/<id>.json (+ indice-<ano>.json), normas/indice-<ano>.json.
 *
 * FONTES E REGRAS DE ACESSO
 *   API: https://dadosabertos.almg.gov.br/api/v2 (CC BY-SA 4.0). robots.txt: proíbe p=, tp=, ord=,
 *     ordenacao= (paginação/ordenação) e tudo fora de /documentacao/, /api/ajuda/ e /api/v2/. Por isso:
 *     (a) nenhuma pesquisa é paginada: janelas de datas divididas ao meio até caberem na 1ª página;
 *     (b) os CSV anuais (dadosabertos.almg.gov.br/arquivo/...) NÃO são baixados: o caminho /arquivo/
 *         está fora do que o robots.txt libera.
 *   Votos de Plenário: PDF do Diário do Legislativo (mediaserver.almg.gov.br/acervo/, liberado no
 *     robots.txt), texto lido com pdfplumber via "python -I" em pasta temporária vazia; atas
 *     interpretadas por diario.mjs com conferência de nomes (lista oficial da API) e totais (texto da ata).
 *
 * DEPENDÊNCIA: Python 3 + pdfplumber (requirements.txt). Procura COLETA_PYTHON, .venv desta pasta,
 *   .venv da ALESP, python do sistema. Sem pdfplumber, a etapa de Plenário é pulada (registrado no meta).
 * Código de saída: 0 = ok; 1 = alguma etapa falhou.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  obter, podeAcessar, lerJson, gravarSeMudou, contagemGravacao, hojeISO, somarDias, normalizarNome,
  estatisticas, robotsRelatorio, restanteMs, log, definirIntervalo, manterDataColeta, acharPython, extrairTextoPdf,
} from '../rs/lib.mjs';
import {
  API, ORGAO, PORTAL, deputados, TIPOS_PROP, totalProposicoes, lerPropJanela, montarProposicao, porJanelas, meses,
  lerReunioesJanela, urlDetalheReuniao, lerDiariosJanela, resultadosComissao, urlResultadosComissao,
  TIPOS_NORMA, lerNormasJanela, totalNormas, montarNorma, completarPorNumero, lerPropNumero, lerNormaNumero,
} from './almg.mjs';
import { limparTexto, separarAtas, lerVotacoesDaAta, VERSAO_PARSER } from './diario.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const DIR = path.join(RAIZ, 'dados', 'estados', 'mg');
const DIR_PROP = path.join(DIR, 'proposicoes');
const DIR_VOT = path.join(DIR, 'votacoes');
const DIR_NORMAS = path.join(DIR, 'normas');
const EXTRATOR = path.join(AQUI, 'extrair_texto_pdf.py');

const args = process.argv.slice(2);
const hoje = hojeISO();
const anoAtual = Number(hoje.slice(0, 4));
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? String(args[i + 1] || '') : null; };
const ANOS = (arg('--anos') || `${anoAtual},${anoAtual - 1}`).split(',').map(Number).filter(Boolean).sort((a, b) => b - a);
const ETAPAS = new Set((arg('--etapas') || 'parlamentares,proposicoes,plenario,comissoes,normas').split(','));
const roda = (e) => ETAPAS.has(e);
// 20ª legislatura: 01/02/2023 a 31/01/2027 (a 21ª começa em 01/02/2027).
const LEGISLATURA = hoje >= '2027-02-01' ? 21 : 20;
const MAX_COMISSOES = 30;
const ORC_MIN = Number(process.env.COLETA_ORCAMENTO_MIN || 20);
definirIntervalo('dadosabertos.almg.gov.br', 400);
definirIntervalo('mediaserver.almg.gov.br', 1500);

const falhas = [];
async function etapa(nome, fn) {
  try { return await fn(); } catch (e) { falhas.push(`${nome}: ${e.message}`); log(`FALHA em ${nome}: ${e.message}`); return null; }
}
const fonte = (titulo, url, orgao = ORGAO) => ({ titulo, url, orgao, acessado_em: hoje });
const metaAntiga = lerJson(path.join(DIR, 'meta.json')) || {};
const cursorAntigo = metaAntiga.cursor || {};
const lacunasCobertura = [];

// ---------- 0. robots.txt ----------
for (const u of ['https://dadosabertos.almg.gov.br', 'https://mediaserver.almg.gov.br']) await podeAcessar(u + '/');
for (const [o, r] of Object.entries(robotsRelatorio)) log(`robots ${o}: ${r.situacao}`);

// ---------- 1. deputados ----------
const mapaDeputados = new Map(); // nome normalizado → { id, nome }
let parlamentares = [];
await etapa('parlamentares', async () => {
  const { em, outros } = await deputados(LEGISLATURA);
  if (!em.length) throw new Error('lista de deputados em exercício vazia');
  const vistos = new Map();
  const add = (d, emExercicio, situacao) => {
    const id = String(d.id);
    if (vistos.has(id)) return;
    vistos.set(id, true);
    parlamentares.push({
      id, uf: 'MG', casa: 'almg', nome: d.nome, nome_civil: null, partido: d.partido || null,
      em_exercicio: emExercicio, situacao_legislatura: situacao, foto: null,
      url_oficial: `${API}/deputados/${id}?formato=json`, email: null,
    });
  };
  for (const d of em) add(d, true, 'em_exercicio');
  for (const d of outros) add(d, false, d.situacao);
  parlamentares.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const cont = new Map();
  for (const p of parlamentares) { const k = normalizarNome(p.nome); cont.set(k, (cont.get(k) || 0) + 1); }
  for (const p of parlamentares) if (cont.get(normalizarNome(p.nome)) === 1) mapaDeputados.set(normalizarNome(p.nome), { id: p.id, nome: p.nome });
  if (roda('parlamentares')) {
    gravarSeMudou(path.join(DIR, 'parlamentares.json'), {
      atualizado_em: hoje, uf: 'MG', casa: 'almg', legislatura: LEGISLATURA,
      fonte: fonte('Deputados estaduais — API de dados abertos da ALMG', `${API}/deputados/em_exercicio?formato=json`),
      itens: parlamentares,
    });
  }
  log(`Deputados: ${em.length} em exercício, ${parlamentares.length} na legislatura`);
});

// ---------- 2. proposições ----------
const indices = new Map();
const carregarIndice = (ano) => {
  if (!indices.has(ano)) indices.set(ano, new Map((lerJson(path.join(DIR_PROP, `indice-${ano}.json`))?.itens || []).map((i) => [i.id, i])));
  return indices.get(ano);
};
const contProp = {};
if (roda('proposicoes')) {
  for (const ano of ANOS) {
    const idx = carregarIndice(ano);
    for (const tipo of TIPOS_PROP) {
      await etapa(`proposições ${tipo} ${ano}`, async () => {
        const total = await totalProposicoes(tipo, ano);
        const fimJanela = `${Math.min(ano + 1, anoAtual)}-12-31` < hoje ? `${Math.min(ano + 1, anoAtual)}-12-31` : hoje;
        const acc = { itens: [], incompletas: [], consultas: 0 };
        for (const [i, f] of meses(`${ano}-01-01`, fimJanela)) await porJanelas(lerPropJanela(tipo, ano), i, f, acc);
        const vistos = new Set();
        const integrar = (it, via) => {
          const p = montarProposicao(it, hoje);
          if (vistos.has(p.id) || p.ano !== ano) return;
          vistos.add(p.id);
          idx.set(p.id, manterDataColeta({ ...p, obtida_por: via, votacoes: idx.get(p.id)?.votacoes || [] }, idx.get(p.id)));
        };
        for (const it of acc.itens) integrar(it, 'janela-de-datas');
        // Dias com mais de 20: completa pelo número (consulta num=N, sem paginação).
        const conhecidos = new Set([...idx.values()].filter((p) => p.sigla === tipo).map((p) => p.numero));
        if (acc.incompletas.length && total != null && total > conhecidos.size) {
          const c = await completarPorNumero(lerPropNumero(tipo, ano), conhecidos, total - conhecidos.size, { podeContinuar: () => restanteMs() > (ano === anoAtual ? 6 : Math.max(6, ORC_MIN * 0.6)) * 60000 });
          for (const it of c.itens) integrar(it, 'numero');
          acc.consultas += c.consultas;
        }
        const noIndice = [...idx.values()].filter((p) => p.sigla === tipo).length;
        const naoAlcancadas = total != null ? total - noIndice : null;
        if (naoAlcancadas > 0) {
          lacunasCobertura.push({ tipo, ano, total_fonte: total, no_indice: noIndice, dias_com_mais_de_20: acc.incompletas });
        }
        contProp[`${tipo}-${ano}`] = { total_fonte: total, atualizadas_nesta_execucao: vistos.size, no_indice: noIndice, consultas: acc.consultas };
        log(`Proposições ${tipo} ${ano}: ${vistos.size} atualizadas, ${noIndice} no índice, fonte informa ${total} (${acc.consultas} consultas)`);
      });
    }
  }
}

// ---------- 3. Plenário: reuniões (horário) e atas do Diário do Legislativo ----------
const contPlen = { edicoes_lidas: 0, votacoes_publicadas: 0, votacoes_recusadas: 0, edicoes_pendentes: 0 };
const processados = { ...(cursorAntigo.diarios_processados || {}) };
// Edições com votações recusadas por versão anterior do parser voltam para a fila.
for (const [id, p] of Object.entries(processados)) if (p.recusadas > 0 && (p.versao_parser || 1) < VERSAO_PARSER) delete processados[id];
const recusadasTodas = [...(cursorAntigo.votacoes_nao_publicadas || [])].filter((r) => processados[r.edicao]);
const propsComVotoNominal = new Map();
let pythonOk = false;
if (roda('plenario')) {
  const python = acharPython(AQUI);
  try { execFileSync(python, ['-I', '-c', 'import pdfplumber'], { stdio: 'ignore', timeout: 60000, windowsHide: true }); pythonOk = true; } catch { /* sem pdfplumber */ }
  if (!pythonOk) falhas.push('plenário: Python com pdfplumber indisponível (ver requirements.txt); atas não lidas');
  const reunioes = new Map(); // data → [{hora, numero, tipo}]
  await etapa('reuniões de Plenário', async () => {
    const ini = `${Math.min(...ANOS)}-01-01`;
    const acc = { itens: [], incompletas: [], consultas: 0 };
    for (const [i, f] of meses(ini, hoje)) await porJanelas(lerReunioesJanela(), i, f, acc);
    for (const r of acc.itens) {
      if (!reunioes.has(r.dia)) reunioes.set(r.dia, []);
      reunioes.get(r.dia).push({ hora: r.hora, numero: r.numero ?? null, tipo: r.tipoReuniao?.nome || null, id: r.idReuniao });
    }
    log(`Reuniões de Plenário: ${acc.itens.length}`);
  });
  const edicoes = [];
  await etapa('edições do Diário', async () => {
    const ini = `${Math.min(...ANOS)}-01-01`;
    const acc = { itens: [], incompletas: [], consultas: 0 };
    // Janelas de 10 dias (um mês costuma ter mais de 20 edições com votação nominal).
    for (let d = ini; d <= hoje; d = somarDias(d, 10)) {
      const f = somarDias(d, 9) < hoje ? somarDias(d, 9) : hoje;
      await porJanelas(lerDiariosJanela(), d, f, acc);
    }
    if (acc.incompletas.length) lacunasCobertura.push({ diario_legislativo: acc.incompletas });
    for (const e of acc.itens) if (!edicoes.some((x) => x.id === e.id)) edicoes.push(e);
    edicoes.sort((a, b) => String(b.metadados?.data).localeCompare(String(a.metadados?.data)) || b.id - a.id);
    log(`Edições do Diário com listas nominais: ${edicoes.length}`);
  });
  const horaDe = (ata) => {
    const rs = (reunioes.get(ata.data) || []).filter((r) => {
      const t = String(r.tipo || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return t.startsWith(ata.tipo.slice(0, 6)) && (ata.numero == null || r.numero == null || Number(r.numero) === ata.numero);
    });
    return rs.length === 1 ? rs[0].hora : null;
  };
  const pendentesEd = edicoes.filter((e) => !processados[e.id]);
  for (const ed of pythonOk ? pendentesEd : []) {
    if (restanteMs() < 150000) break;
    await etapa(`Diário ${ed.metadados?.data} (${ed.id})`, async () => {
      const pdf = await obter(ed.url, { tipo: 'bin', timeoutMs: 60000, maxTentativas: 2 });
      const sha = crypto.createHash('sha256').update(pdf).digest('hex');
      const ext = extrairTextoPdf(pdf, { script: EXTRATOR, python: acharPython(AQUI) });
      if (!ext.ok) throw new Error(ext.problemas.join('; '));
      const atas = separarAtas(limparTexto(ext.paginas));
      let pub = 0, rec = 0;
      for (const ata of atas) {
        const { aceitas, recusadas } = lerVotacoesDaAta(ata, mapaDeputados);
        const tipoAbrev = { ORDINARIA: 'ord', EXTRAORDINARIA: 'ext', ESPECIAL: 'esp', SOLENE: 'sol', PREPARATORIA: 'prep' }[ata.tipo] || 'reu';
        const base = `mg-plen-${ata.data}-${tipoAbrev}${ata.numero ?? 'sn'}`;
        const hora = horaDe(ata);
        for (const v of aceitas) {
          const pr = v.proposicao;
          const id = `${base}-${String(v.ordem).padStart(2, '0')}`;
          const propId = `mg-${pr.sigla}-${pr.numero}-${pr.ano}`;
          const reg = {
            id, uf: 'MG', casa: 'almg',
            data: ata.data, hora: null, hora_inicio_reuniao: hora,
            orgao: 'Plenário', orgao_sigla: 'PLEN', orgao_nome: 'Plenário da Assembleia Legislativa do Estado de Minas Gerais',
            sessao: { titulo: ata.cabecalho, numero: ata.numero, tipo: ata.tipo },
            proposicao: { id: propId, sigla: pr.sigla, tipo: pr.tipo, numero: pr.numero, ano: pr.ano, url: `${PORTAL}/projetos-de-lei/${pr.sigla}/${pr.numero}/${pr.ano}/` },
            descricao: v.objeto ? `Em votação: ${v.objeto}` : null,
            turno: v.turno,
            descricao_materia: v.materia_texto,
            proposicao_identificada_por: v.proposicao_identificada_por === 'materia-em-discussao' ? 'Matéria em discussão anunciada antes na ata (votação de emenda, substitutivo ou destaque)' : 'Trecho da própria votação na ata',
            descricao_abertura: v.orientacao_registro,
            resultado: v.resultado,
            resultado_texto_oficial: v.resultado_texto_oficial,
            proclamacao_texto_oficial: v.proclamacao_texto,
            tipo: 'nominal',
            placar: v.placar,
            placar_origem: 'totais-oficiais',
            conferencia_placar: `Totais proclamados na ata (${Object.entries(v.totais_proclamados).map(([k, n]) => `"${k}": ${n}`).join(', ')}) conferem com o número de nomes de cada lista "Registraram"; todos os ${v.votos.length} nomes conferem com a lista oficial de deputados da API da ALMG.`,
            orientacoes: [],
            votos: v.votos,
            ordem_na_ata: v.ordem,
            url: ed.url,
            fonte: { titulo: `Diário do Legislativo de ${ed.metadados?.data?.split('-').reverse().join('/')} — ${ata.cabecalho}`, url: ed.url, orgao: ORGAO, acessado_em: hoje },
            fonte_resultado: hora ? { titulo: 'Resultado da reunião de Plenário — API da ALMG', url: urlDetalheReuniao(ata.data, hora), orgao: ORGAO, acessado_em: hoje } : null,
            pdf_sha256: sha,
            lacunas: v.turno ? [] : ['Turno não identificado no trecho da ata desta votação.'],
            _observacao_partido: 'partido: o informado entre parênteses na ata (partido na data da votação).',
            _observacao_hora: 'hora null: a ata não registra o horário de cada votação; hora_inicio_reuniao vem da API (pesquisa de reuniões).',
          };
          gravarSeMudou(path.join(DIR_VOT, `${id}.json`), reg);
          propsComVotoNominal.set(propId, pr);
          pub++;
        }
        for (const r of recusadas) {
          rec++;
          recusadasTodas.push({ edicao: ed.id, data_edicao: ed.metadados?.data, ata: ata.cabecalho.slice(0, 120), ordem_na_ata: r.ordem, proposicao: r.proposicao ? `${r.proposicao.sigla} ${r.proposicao.numero}/${r.proposicao.ano}` : null, motivo: r.motivo, url: ed.url });
        }
      }
      processados[ed.id] = { data: ed.metadados?.data, atas_plenario: atas.length, publicadas: pub, recusadas: rec, sha256: sha, lido_em: hoje, versao_parser: VERSAO_PARSER };
      contPlen.edicoes_lidas++; contPlen.votacoes_publicadas += pub; contPlen.votacoes_recusadas += rec;
      log(`  Diário ${ed.metadados?.data}: ${atas.length} ata(s) de Plenário, ${pub} votação(ões) publicadas, ${rec} recusadas`);
    });
  }
  contPlen.edicoes_pendentes = edicoes.filter((e) => !processados[e.id]).length;
}

// ---------- 3b. proposições votadas de anos fora do período (detalhe pela API, uma consulta cada) ----------
if (roda('proposicoes') || roda('plenario')) {
  const conhecidas = new Set();
  for (const ano of new Set([...ANOS, ...[...propsComVotoNominal.values()].map((p) => p.ano)])) for (const id of carregarIndice(ano).keys()) conhecidas.add(id);
  for (const [propId, pr] of propsComVotoNominal) {
    if (conhecidas.has(propId) || restanteMs() < 90000) continue;
    await etapa(`detalhe ${propId}`, async () => {
      const r = await obter(`${API}/proposicoes/${pr.sigla}/${pr.numero}/${pr.ano}?formato=json`, { opcional: true });
      const it = r?.resultado?.listaItem?.[0];
      if (it) { const p = montarProposicao(it, hoje); carregarIndice(p.ano).set(p.id, manterDataColeta({ ...p, votacoes: [] }, carregarIndice(p.ano).get(p.id))); }
    });
  }
}

// ---------- 4. comissões (só proposições com votação nominal nesta execução) ----------
const contCom = { proposicoes_consultadas: 0, reunioes: 0, votacoes_com_voto_individual: 0 };
if (roda('comissoes')) {
  for (const [propId, pr] of [...propsComVotoNominal].slice(0, MAX_COMISSOES)) {
    if (restanteMs() < 90000) break;
    await etapa(`comissões ${propId}`, async () => {
      const r = await resultadosComissao(pr.sigla, pr.numero, pr.ano);
      contCom.proposicoes_consultadas++;
      for (const reu of r?.list || []) {
        contCom.reunioes++;
        // O esquema oficial (EsquemaVotacaoComissao) prevê votacoes[].deputado + tipoVoto; publica só se vier.
        for (const item of reu.proposicoes || []) {
          const votacoes = Array.isArray(item.votacoes) ? item.votacoes : [];
          const votos = votacoes.filter((x) => x?.deputado?.nome && x.tipoVoto).map((x) => ({
            parlamentar_id: x.deputado.id != null ? String(x.deputado.id) : null, nome: x.deputado.nome,
            partido: x.deputado.partidoVotacao?.sigla || null, uf: 'MG', voto: x.tipoVoto,
          }));
          if (!votos.length || item.siglaTipoProposicao?.replace(/\.$/, '') !== pr.sigla || Number(item.numeroProposicao) !== pr.numero) continue;
          const id = `mg-com-${reu.comissao?.id}-${reu.data}-${reu.hora?.replace(':', '')}-${pr.sigla}-${pr.numero}-${pr.ano}`;
          gravarSeMudou(path.join(DIR_VOT, `${id}.json`), {
            id, uf: 'MG', casa: 'almg', data: reu.data, hora: null, hora_inicio_reuniao: reu.hora || null,
            orgao: 'Comissão', orgao_sigla: null, orgao_nome: reu.comissao?.nome || null,
            proposicao: { id: propId, sigla: pr.sigla, numero: pr.numero, ano: pr.ano, url: `${PORTAL}/projetos-de-lei/${pr.sigla}/${pr.numero}/${pr.ano}/` },
            descricao: item.apreciacaoProposicaoReuniao?.descricao || null, resultado: null, resultado_texto_oficial: null,
            tipo: 'nominal', placar: null, placar_origem: null, conferencia_placar: 'Votos individuais da API; sem totais oficiais para conferir.',
            votos, url: urlResultadosComissao(pr.sigla, pr.numero, pr.ano),
            fonte: fonte('Resultados de reuniões de comissão — API da ALMG', urlResultadosComissao(pr.sigla, pr.numero, pr.ano)),
            lacunas: ['Resultado da votação em comissão não informado neste registro da API.'],
          });
          contCom.votacoes_com_voto_individual++;
        }
      }
    });
  }
}

// ---------- 5. normas ----------
const contNormas = {};
if (roda('normas')) {
  for (const ano of ANOS) {
    const arq = path.join(DIR_NORMAS, `indice-${ano}.json`);
    const idx = new Map((lerJson(arq)?.itens || []).map((n) => [n.id, n]));
    for (const tipo of TIPOS_NORMA) {
      await etapa(`normas ${tipo.sigla} ${ano}`, async () => {
        const total = await totalNormas(tipo.sigla, ano);
        const acc = { itens: [], incompletas: [], consultas: 0 };
        const fim = `${ano}-12-31` < hoje ? `${ano}-12-31` : hoje;
        for (const [i, f] of meses(`${ano}-01-01`, fim)) await porJanelas(lerNormasJanela(tipo.sigla, ano), i, f, acc);
        const vistos = new Set();
        const integrar = (it) => {
          const n = montarNorma(tipo, it, hoje);
          if (vistos.has(n.id) || n.ano !== ano) return;
          vistos.add(n.id);
          n.projeto_origem = idx.get(n.id)?.projeto_origem || [];
          idx.set(n.id, manterDataColeta(n, idx.get(n.id)));
        };
        for (const it of acc.itens) integrar(it);
        const conhecidos = new Set([...idx.values()].filter((n) => n.tipo === tipo.tipo).map((n) => n.numero));
        if (acc.incompletas.length && total != null && total > conhecidos.size) {
          const c = await completarPorNumero(lerNormaNumero(tipo.sigla, ano), conhecidos, total - conhecidos.size, { podeContinuar: () => restanteMs() > 90000 });
          for (const it of c.itens) integrar(it);
        }
        const noIndice = [...idx.values()].filter((n) => n.tipo === tipo.tipo).length;
        if (total != null && total > noIndice) lacunasCobertura.push({ norma: tipo.sigla, ano, total_fonte: total, no_indice: noIndice, dias_com_mais_de_20: acc.incompletas });
        log(`Normas ${tipo.sigla} ${ano}: ${noIndice} no índice, fonte informa ${total}`);
      });
    }
    // Liga norma ↔ proposição pelo registro literal "Transformado(a) em Lei nº …" da tramitação.
    for (const a of ANOS) carregarIndice(a);
    for (const ip of indices.values()) for (const p of ip.values()) {
      if (!p.norma_gerada) continue;
      const t = TIPOS_NORMA.find((x) => x.tipo === p.norma_gerada.tipo);
      if (!t) continue;
      for (const n of idx.values()) {
        if (n.tipo === t.tipo && n.numero === p.norma_gerada.numero && (p.norma_gerada.ano == null || p.norma_gerada.ano === n.ano)) {
          const o = { identificacao: `${p.sigla} ${p.numero}/${p.ano}`, proposicao_id: p.id, url: p.url, registro_tramitacao: p.norma_gerada.texto_oficial };
          if (!n.projeto_origem.some((x) => x.proposicao_id === p.id)) n.projeto_origem = [...n.projeto_origem, o];
          p.norma = { id: n.id, nome_oficial: n.nome_oficial, url: n.links.almg };
        }
      }
    }
    const itens = [...idx.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || b.numero - a.numero);
    for (const n of itens) if (!n.projeto_origem.length && n.tipo !== 'Decreto' && !n.lacunas.some((l) => l.startsWith('Proposição de origem'))) n.lacunas.push('Proposição de origem não identificada: a API não liga a norma ao projeto; a ligação só é feita quando a tramitação do projeto registra "Transformado em … nº".');
    const porTipo = {};
    for (const n of itens) porTipo[n.tipo] = (porTipo[n.tipo] || 0) + 1;
    contNormas[ano] = { total: itens.length, por_tipo: porTipo, com_projeto_origem: itens.filter((n) => n.projeto_origem.length).length };
    if (itens.length) gravarSeMudou(arq, {
      atualizado_em: hoje, uf: 'MG', casa: 'almg', ano,
      abrangencia: 'Leis, leis complementares, emendas à Constituição e decretos do Estado de Minas Gerais (Legislação Mineira, ALMG)',
      fontes: [fonte('Legislação Mineira — API de dados abertos da ALMG', `${API}/legislacao/mineira/pesquisa/direcionada`)],
      itens,
    });
  }
}

// ---------- 6. índices de proposições e votações ----------
const contVot = {};
await etapa('índices', async () => {
  const votacoesPorProp = new Map();
  const porAno = new Map();
  if (fs.existsSync(DIR_VOT)) for (const f of fs.readdirSync(DIR_VOT)) {
    if (!f.endsWith('.json') || f.startsWith('indice-')) continue;
    const v = lerJson(path.join(DIR_VOT, f));
    if (!v?.data) continue;
    if (!votacoesPorProp.has(v.proposicao.id)) votacoesPorProp.set(v.proposicao.id, []);
    votacoesPorProp.get(v.proposicao.id).push(v.id);
    const ano = Number(v.data.slice(0, 4));
    if (!porAno.has(ano)) porAno.set(ano, []);
    porAno.get(ano).push({
      id: v.id, data: v.data, orgao: v.orgao, tipo: v.tipo, turno: v.turno ?? null,
      proposicao: { id: v.proposicao.id, sigla: v.proposicao.sigla, numero: v.proposicao.numero, ano: v.proposicao.ano },
      descricao: v.descricao, resultado: v.resultado, placar: v.placar, votos_publicados: v.votos.length, url: v.url,
    });
  }
  for (const [ano, itens] of porAno) {
    itens.sort((a, b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id));
    contVot[ano] = { votacoes: itens.length, votos: itens.reduce((s, i) => s + i.votos_publicados, 0) };
    gravarSeMudou(path.join(DIR_VOT, `indice-${ano}.json`), { atualizado_em: hoje, uf: 'MG', casa: 'almg', ano, itens });
  }
  for (const [ano, idx] of indices) {
    if (!idx.size) continue;
    for (const [id, p] of idx) idx.set(id, { ...p, votacoes: (votacoesPorProp.get(id) || []).sort() });
    const itens = [...idx.values()].sort((a, b) => a.sigla.localeCompare(b.sigla) || b.numero - a.numero);
    gravarSeMudou(path.join(DIR_PROP, `indice-${ano}.json`), {
      atualizado_em: hoje, uf: 'MG', casa: 'almg', ano,
      fonte: fonte(`Proposições de ${ano} (PL, PLC, PEC, PRE, VET) — API de dados abertos da ALMG`, `${API}/proposicoes/pesquisa/direcionada?ano=${ano}&formato=json`),
      itens,
    });
  }
});

// ---------- 7. meta.json ----------
const agora = new Date().toISOString();
gravarSeMudou(path.join(DIR, 'meta.json'), {
  atualizado_em: agora, ultima_execucao: agora, uf: 'MG', casa: 'almg',
  periodo: { anos: ANOS }, modo: 'incremental',
  contagens: {
    parlamentares: parlamentares.length || metaAntiga.contagens?.parlamentares || null,
    proposicoes: Object.keys(contProp).length ? contProp : metaAntiga.contagens?.proposicoes,
    plenario_nesta_execucao: contPlen,
    comissoes_nesta_execucao: contCom,
    votacoes_por_ano: contVot,
    normas_por_ano: Object.keys(contNormas).length ? contNormas : metaAntiga.contagens?.normas_por_ano,
    requisicoes: estatisticas.requisicoes, retentativas: estatisticas.retentativas,
  },
  cursor: {
    diarios_processados: processados,
    edicoes_pendentes: roda('plenario') ? contPlen.edicoes_pendentes : cursorAntigo.edicoes_pendentes ?? null,
    votacoes_nao_publicadas: recusadasTodas.slice(-500),
    criterio: 'Edições do Diário do Legislativo com a expressão "Registraram" são lidas uma vez (mais recentes primeiro); as já lidas ficam em diarios_processados.',
  },
  lacunas_cobertura: lacunasCobertura,
  robots: robotsRelatorio,
  fontes: [
    fonte('API de dados abertos da ALMG (especificação OpenAPI)', 'https://dadosabertos.almg.gov.br/api/ajuda/swagger/endpoints/lastest'),
    fonte('Diário do Legislativo — pesquisa de edições', `${API}/diario_legislativo/pesquisa`),
    fonte('Legislação Mineira', `${API}/legislacao/mineira/pesquisa/direcionada`),
  ],
  observacoes: [
    'robots.txt da API: paginação (p=, tp=) e ordenação (ord=, ordenacao=) proibidas; pesquisas feitas em janelas de datas divididas até caberem na 1ª página. Dias com mais de 20 resultados ficam em lacunas_cobertura.',
    'CSV anuais de proposições: o endereço de download (/arquivo/...) não está entre os caminhos liberados pelo robots.txt (Disallow: /, Allow só /documentacao/, /api/ajuda/, /api/v2/); por isso não são usados.',
    'Votos de Plenário: lidos das atas no Diário do Legislativo ("Registraram “sim”: Nome (Partido)…"). Uma votação só é publicada se cada lista tiver exatamente o total proclamado na ata, todos os nomes conferirem com a lista oficial de deputados e a lista for atribuível a uma única votação eletrônica. As recusadas ficam em cursor.votacoes_nao_publicadas com o motivo.',
    'O sentido de "sim" e "não" é reproduzido como na ata; em vetos, a frase oficial que explica o registro ("… registrarão “sim” e os que desejarem rejeitá-lo registrarão “não”") fica em descricao_abertura quando consta da ata.',
    'Votos de comissões: a API prevê votos por deputado (tipoVoto), mas nos testes (PL 4.172/2025, VET 36/2026, PEC 45/2017) as reuniões vieram sem esse campo; só se publica quando a API traz o voto individual.',
    'Normas: ligação norma ↔ proposição apenas pelo registro literal da tramitação ("Transformado em Lei nº …").',
    'Ementas e autores: nomes de particulares substituídos por "[nome de particular omitido]" por regra conservadora (diretriz 12). Sem CPF, RG, e-mail ou telefone.',
    ...(falhas.length ? [`Falhas nesta execução: ${falhas.slice(0, 30).join(' | ')}`] : []),
  ],
});

log(`Fim. Requisições: ${estatisticas.requisicoes} (retentativas ${estatisticas.retentativas}), ${(estatisticas.bytes / 1e6).toFixed(1)} MB. `
  + `Plenário: ${contPlen.edicoes_lidas} edições lidas, ${contPlen.votacoes_publicadas} votações publicadas, ${contPlen.votacoes_recusadas} recusadas, ${contPlen.edicoes_pendentes} edições pendentes. `
  + `Arquivos gravados: ${contagemGravacao.gravados}, inalterados: ${contagemGravacao.inalterados}.`);
if (falhas.length) { console.error('Falhas:\n- ' + falhas.slice(0, 50).join('\n- ')); process.exit(1); }
