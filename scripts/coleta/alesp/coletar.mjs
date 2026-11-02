#!/usr/bin/env node
/**
 * Coletor do Estado de São Paulo (Fase 4): ALESP e Governo do Estado (DOE-SP).
 *
 * USO
 *   node scripts/coleta/alesp/coletar.mjs                 # incremental: últimos 7 dias
 *   node scripts/coleta/alesp/coletar.mjs --desde 2026-10-01
 *   node scripts/coleta/alesp/coletar.mjs --completo      # tudo desde 2025-01-01
 *   node scripts/coleta/alesp/coletar.mjs --completo --etapas doe   # só algumas etapas (parlamentares,plenario,proposicoes,comissoes,doe)
 *   node scripts/coleta/alesp/teste-referencia.mjs        # teste do extrator (PL 1.055/2025)
 *
 * SAÍDAS (cada pasta tem meta.json)
 *   dados/alesp/parlamentares.json                 deputados estaduais em exercício (sem CPF, sem telefone)
 *   dados/alesp/votacoes/<id>.json + indice-<ano>.json
 *       Plenário: votações nominais (id = nome do PDF oficial). Votos individuais lidos do PDF
 *       "Relatório de Verificação de Votação" por coordenadas; só são publicados se a contagem conferir
 *       com o rodapé oficial e cada nome tiver a mesma cor de impressão do seu voto. Caso contrário:
 *       placar oficial + lacuna + link para o PDF.
 *       Comissões: votos nominais da API (id = idReuniaoItemDeliberacao), texto do voto sem conversão.
 *   dados/alesp/proposicoes/indice-<ano>.json      PL, PLC, PEC, PDL e PR por ano de apresentação
 *   dados/governo-sp/normas/indice-<ano>.json      leis, leis complementares, decretos e vetos (DOE-SP)
 *
 * FONTES
 *   ALESP: https://legis-api-portal-prd.al.sp.gov.br (OpenAPI pública em /v3/api-docs)
 *   DOE-SP: https://do-api-web-search.doe.sp.gov.br (API do portal doe.sp.gov.br, sem documentação pública)
 *
 * DEPENDÊNCIA EXTERNA: Python 3 com pdfplumber (requirements.txt), usado só para ler os PDFs do Plenário.
 *   python -m venv scripts/coleta/alesp/.venv
 *   scripts/coleta/alesp/.venv/bin/pip install -r scripts/coleta/alesp/requirements.txt   (Windows: .venv\Scripts\pip)
 *   O coletor procura o Python em ALESP_PYTHON, depois no .venv acima, depois python3/python.
 *   O extrator roda sempre com "python -I" num diretório temporário vazio: o PDF é dado não confiável.
 *   Sem pdfplumber, o coletor NÃO reprocessa votações de Plenário (mantém os arquivos existentes).
 *
 * MODO INCREMENTAL: lê as tramitações publicadas dia a dia (/notificacao/tramitacoes/{data}) desde --desde
 *   e só atualiza a situação e as votações em comissão dos processos que tramitaram; proposições novas
 *   entram sempre. Votações de Plenário com data >= --desde (ou sem arquivo) são reprocessadas.
 *   DOE: janela de --desde menos 3 dias (retificações).
 * LIMITES: no máximo 2 requisições simultâneas; até 5 tentativas; User-Agent identificável.
 * GRAVAÇÃO: atômica; arquivo sem mudança de conteúdo não é regravado.
 * Rotina diária sugerida: 07h00 de Brasília (dumps e DOE saem de madrugada).
 * Código de saída: 0 = ok; 1 = alguma etapa falhou (as demais etapas são gravadas normalmente).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  obter, paraCada, lerJson, gravarSeMudou, hojeISO, somarDias, diasEntre, normalizarNome,
  estatisticas, contagemGravacao,
} from './lib.mjs';
import { API, coletarPlenario, acharPython } from './plenario.mjs';
import { coletarComissoesDoProcesso } from './comissoes.mjs';
import { listarProposicoes, autoresEmLote, situacaoDoProcesso, montarProposicao, processosComTramitacao } from './proposicoes.mjs';
import { SECOES, listarSecao, montarNorma, DOE } from './doe.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const DIR = path.join(RAIZ, 'dados', 'alesp');
const DIR_VOT = path.join(DIR, 'votacoes');
const DIR_PROP = path.join(DIR, 'proposicoes');
const DIR_NORMAS = path.join(RAIZ, 'dados', 'governo-sp', 'normas');
const ORGAO = 'Assembleia Legislativa do Estado de São Paulo (ALESP)';
const INICIO_COBERTURA = '2025-01-01';

// ---------- argumentos ----------
const args = process.argv.slice(2);
const hoje = hojeISO();
const anoAtual = Number(hoje.slice(0, 4));
const completo = args.includes('--completo');
let desde = somarDias(hoje, -7);
const iDesde = args.indexOf('--desde');
if (iDesde >= 0) {
  desde = args[iDesde + 1] || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || Number.isNaN(Date.parse(desde))) {
    console.error('Uso: --desde AAAA-MM-DD'); process.exit(1);
  }
}
if (completo || desde < INICIO_COBERTURA) desde = INICIO_COBERTURA;
// --etapas parlamentares,plenario,proposicoes,comissoes,doe (padrão: todas)
const iEt = args.indexOf('--etapas');
const ETAPAS = new Set(iEt >= 0 ? String(args[iEt + 1] || '').split(',') : ['parlamentares', 'plenario', 'proposicoes', 'comissoes', 'doe']);
const roda = (e) => ETAPAS.has(e);
// Plenário e proposições: sempre todos os anos da cobertura (listas baratas; o trabalho pesado é seletivo).
const anos = [];
for (let a = Number(INICIO_COBERTURA.slice(0, 4)); a <= anoAtual; a++) anos.push(a);
const inicio = Date.now();
const log = (...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(1)}s]`, ...m);
const falhas = [];
async function etapa(nome, fn) {
  try { return await fn(); } catch (e) { falhas.push(`${nome}: ${e.message}`); log(`FALHA em ${nome}: ${e.message}`); return null; }
}
const fonte = (titulo, url, orgao = ORGAO) => ({ titulo, url, orgao, acessado_em: hoje });

// ---------- 1. parlamentares ----------
const URL_PARL = `${API}/parlamentar-portal/todos`;
const todosParl = await etapa('parlamentares', () => obter(URL_PARL)); // também usado para ligar nomes
const mapaNomes = new Map();
{
  const vistos = new Map();
  for (const p of todosParl || []) {
    const k = normalizarNome(p.txNomeParlamentar);
    vistos.set(k, (vistos.get(k) || 0) + 1);
    mapaNomes.set(k, String(p.nuMatricula));
  }
  for (const [k, n] of vistos) if (n > 1) mapaNomes.delete(k); // nome ambíguo: sem ligação
}
let parlEmExercicio = 0;
if (todosParl && roda('parlamentares')) {
  await etapa('parlamentares (gravação)', async () => {
    const antigo = lerJson(path.join(DIR, 'parlamentares.json'));
    const fotosAntigas = new Map((antigo?.itens || []).map((p) => [p.id, p.foto]));
    const ativos = todosParl.filter((p) => p.isEmExercicio === true);
    const itens = await paraCada(ativos, async (p) => {
      const id = String(p.nuMatricula);
      // Foto: arquivo do repositório oficial; publicada só se o endereço responder com imagem.
      let foto = null;
      const m = /^\/biografia\/fotos\/([^/]+\.(jpe?g|png))$/i.exec(p.txFoto || '');
      if (m) {
        const url = `https://www.al.sp.gov.br/repositorio/deputadoPortal/fotos/${encodeURIComponent(m[1]).replace(/%3D/g, '=')}`;
        if (fotosAntigas.get(id) === url) foto = url;
        else {
          const b = await obter(url, { tipo: 'bin', opcional: true }).catch(() => null);
          if (b && ((b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50))) foto = url;
        }
      }
      return {
        id, nome: p.txNomeParlamentar, nome_civil: null, partido: p.txPartido || null, uf: 'SP', em_exercicio: true,
        foto, url_oficial: `https://www.al.sp.gov.br/deputado/?matricula=${id}`, email: p.txEmail || null,
      };
    });
    itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    parlEmExercicio = itens.length;
    gravarSeMudou(path.join(DIR, 'parlamentares.json'), {
      atualizado_em: hoje,
      fonte: fonte('Deputados estaduais — Portal Legislativo da ALESP', URL_PARL),
      itens,
    });
  });
}

// ---------- 2. Plenário ----------
let extratorOk = true;
try {
  execFileSync(acharPython(), ['-I', '-c', 'import pdfplumber'], { stdio: 'ignore', timeout: 60000, windowsHide: true });
} catch {
  extratorOk = false;
  falhas.push('plenário: Python com pdfplumber indisponível; votações de Plenário não reprocessadas (ver requirements.txt)');
  log('AVISO: pdfplumber indisponível; Plenário mantido como está.');
}
const contPlen = { votacoes: 0, com_votos: 0, sem_votos: 0, votos: 0 };
if (extratorOk && roda('plenario')) {
  for (const ano of anos) {
    const regs = await etapa(`plenário ${ano}`, () => coletarPlenario(ano, { hoje, desde, completo, dirVot: DIR_VOT, mapaNomes, log }));
    for (const r of regs || []) gravarSeMudou(path.join(DIR_VOT, `${r.id}.json`), r);
  }
}

// ---------- 3. tramitações do período (processos que se moveram) ----------
const tramitados = new Map();
if (roda('proposicoes') || roda('comissoes')) await etapa('tramitações', async () => {
  const dias = diasEntre(desde, hoje);
  log(`Tramitações: ${dias.length} dia(s) desde ${desde}`);
  await paraCada(dias, async (d) => {
    const m = await processosComTramitacao(d);
    for (const [id, c] of m) tramitados.set(id, c);
  });
  log(`  ${tramitados.size} proposição(ões) com tramitação no período`);
});
const tramitacoesOk = !falhas.some((f) => f.startsWith('tramitações'));

// ---------- 4. Proposições ----------
const indicesProp = new Map(); // ano → itens
const contProp = {};
for (const ano of roda('proposicoes') || roda('comissoes') ? anos : []) {
  await etapa(`proposições ${ano}`, async () => {
    const arq = path.join(DIR_PROP, `indice-${ano}.json`);
    const antigos = new Map((lerJson(arq)?.itens || []).map((p) => [p.id, p]));
    const lista = await listarProposicoes(ano);
    const ids = lista.map((p) => String(p.idProcesso));
    const autores = await autoresEmLote(ids);
    let atualizadas = 0;
    const itens = await paraCada(lista, async (p) => {
      const id = String(p.idProcesso);
      const ant = antigos.get(id);
      const precisa = completo || !ant || !ant.situacao || tramitados.has(id) || !tramitacoesOk;
      let sit = null;
      if (precisa) {
        sit = await situacaoDoProcesso(id).catch(() => null);
        if (sit) atualizadas++;
      } else {
        sit = { situacao: ant.situacao, tem_votacao_comissao: ant.tem_votacao_comissao, tem_votacao_plenario: ant.tem_votacao_plenario };
      }
      const item = montarProposicao(p, autores.get(id), sit, hoje);
      if (!precisa && ant?.situacao_coletada_em) item.situacao_coletada_em = ant.situacao_coletada_em;
      return item;
    });
    itens.sort((a, b) => (a.sigla || '').localeCompare(b.sigla || '') || (b.numero ?? 0) - (a.numero ?? 0));
    indicesProp.set(ano, itens);
    const porSigla = {};
    for (const i of itens) porSigla[i.sigla] = (porSigla[i.sigla] || 0) + 1;
    contProp[ano] = { total: itens.length, por_sigla: porSigla, situacao_atualizada_nesta_execucao: atualizadas };
    gravarSeMudou(arq, {
      atualizado_em: hoje,
      fonte: fonte(`Proposições de ${ano} (PL, PLC, PEC, PDL, PR) — Portal Legislativo da ALESP`,
        `${API}/processo?ano=${ano}&listaIdTipoProcesso=1&listaIdTipoProcesso=2&listaIdTipoProcesso=3&listaIdTipoProcesso=4&listaIdTipoProcesso=5`),
      itens,
    });
    log(`Proposições ${ano}: ${itens.length} (situação consultada em ${atualizadas})`);
  });
}

// ---------- 5. Comissões ----------
const contCom = { processos_consultados: 0, votacoes_gravadas: 0, fora_do_periodo: 0, sem_data: 0 };
if (roda('comissoes')) await etapa('comissões', async () => {
  const alvos = new Map();
  const deIndice = (p) => ({ id: p.id, sigla: p.sigla, numero: p.numero, ano: p.ano, ementa: p.ementa, tipo: null });
  for (const itens of indicesProp.values()) {
    for (const p of itens) {
      if (p.tem_votacao_comissao === false) continue;
      if (completo || tramitados.has(p.id)) alvos.set(p.id, deIndice(p));
    }
  }
  // Processos de anos anteriores (ou fora dos índices) que tramitaram no período.
  for (const [id, c] of tramitados) if (!alvos.has(id) && !(c.ano >= anos[0])) alvos.set(id, c); // ano < 2025 ou desconhecido
  log(`Comissões: consultando ${alvos.size} processo(s)`);
  await paraCada([...alvos.values()], async (proc) => {
    const regs = await coletarComissoesDoProcesso(proc, { hoje, mapaNomes });
    contCom.processos_consultados++;
    for (const r of regs) {
      if (!r.data) { contCom.sem_data++; continue; }
      if (r.data < INICIO_COBERTURA) { contCom.fora_do_periodo++; continue; }
      gravarSeMudou(path.join(DIR_VOT, `${r.id}.json`), r);
      contCom.votacoes_gravadas++;
    }
  });
});

// ---------- 6. índices de votações (a partir de todos os detalhes gravados) ----------
const contVot = {};
await etapa('índices de votações', async () => {
  if (!fs.existsSync(DIR_VOT)) return;
  const porAno = new Map();
  for (const f of fs.readdirSync(DIR_VOT)) {
    if (!f.endsWith('.json') || f.startsWith('indice-') || f === 'meta.json') continue;
    const v = lerJson(path.join(DIR_VOT, f));
    if (!v?.data) continue;
    const ano = Number(v.data.slice(0, 4));
    if (!porAno.has(ano)) porAno.set(ano, []);
    porAno.get(ano).push({
      id: v.id, data: v.data, hora: v.hora, orgao: v.orgao, orgao_sigla: v.orgao_sigla, orgao_nome: v.orgao_nome,
      proposicao: v.proposicao ? { id: v.proposicao.id, sigla: v.proposicao.sigla, numero: v.proposicao.numero, ano: v.proposicao.ano } : null,
      descricao: v.descricao, resultado: v.resultado, tipo: v.tipo, placar: v.placar,
      votos_publicados: v.votos.length, url: v.url, tem_lacunas: (v.lacunas || []).length > 0,
    });
  }
  for (const [ano, itens] of porAno) {
    itens.sort((a, b) => b.data.localeCompare(a.data) || String(b.hora || '').localeCompare(String(a.hora || '')) || a.id.localeCompare(b.id));
    const plen = itens.filter((i) => i.orgao === 'Plenário');
    contVot[ano] = {
      votacoes: itens.length, plenario: plen.length,
      plenario_com_votos_individuais: plen.filter((i) => i.votos_publicados > 0).length,
      plenario_sem_votos_individuais: plen.filter((i) => i.votos_publicados === 0).length,
      comissoes: itens.length - plen.length,
      votos: itens.reduce((s, i) => s + i.votos_publicados, 0),
    };
    gravarSeMudou(path.join(DIR_VOT, `indice-${ano}.json`), { atualizado_em: hoje, itens });
  }
  for (const c of Object.values(contVot)) {
    contPlen.votacoes += c.plenario; contPlen.com_votos += c.plenario_com_votos_individuais;
    contPlen.sem_votos += c.plenario_sem_votos_individuais;
  }
  for (const itens of porAno.values()) for (const i of itens) if (i.orgao === 'Plenário') contPlen.votos += i.votos_publicados;
});

// ---------- 7. DOE-SP: normas e vetos ----------
const contNormas = {};
if (roda('doe')) await etapa('DOE-SP', async () => {
  const de = completo ? INICIO_COBERTURA : (somarDias(desde, -3) < INICIO_COBERTURA ? INICIO_COBERTURA : somarDias(desde, -3));
  const anosDoe = [];
  for (let a = Number(de.slice(0, 4)); a <= anoAtual; a++) anosDoe.push(a);
  const indices = new Map(anosDoe.map((a) => [a, new Map((lerJson(path.join(DIR_NORMAS, `indice-${a}.json`))?.itens || []).map((i) => [i.id, i]))]));
  const cacheIds = new Map();
  let novos = 0;
  for (const secao of SECOES) {
    const lista = await listarSecao(secao, de, hoje);
    log(`DOE ${secao.nome}: ${lista.length} publicação(ões) desde ${de}`);
    await paraCada(lista, async (it) => {
      const ano = Number(String(it.date).slice(0, 4));
      if (!indices.has(ano)) return;
      const idx = indices.get(ano);
      if (idx.has(it.id) && !completo) return;
      idx.set(it.id, await montarNorma(secao, it, hoje, cacheIds));
      novos++;
    });
  }
  for (const [ano, idx] of indices) {
    const itens = [...idx.values()].sort((a, b) => (b.data_publicacao || '').localeCompare(a.data_publicacao || '')
      || a.tipo.localeCompare(b.tipo) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
    const porTipo = {};
    for (const i of itens) porTipo[i.tipo + (i.retificacao ? ' (retificação)' : '')] = (porTipo[i.tipo + (i.retificacao ? ' (retificação)' : '')] || 0) + 1;
    contNormas[ano] = { total: itens.length, por_tipo: porTipo, sem_ementa: itens.filter((i) => !i.tipo.startsWith('Veto') && !i.retificacao && !i.ementa).length };
    gravarSeMudou(path.join(DIR_NORMAS, `indice-${ano}.json`), {
      atualizado_em: hoje,
      fonte: fonte(`Diário Oficial do Estado de São Paulo — Executivo, Atos Normativos (${ano})`, 'https://doe.sp.gov.br/',
        'Diário Oficial do Estado de São Paulo (Imprensa Oficial / Governo do Estado)'),
      itens,
    });
  }
  log(`DOE: ${novos} publicação(ões) lidas na íntegra`);
});

// ---------- 8. meta.json ----------
const agora = new Date().toISOString();
const baseMeta = { atualizado_em: agora, ultima_execucao: agora, periodo: { inicio: desde, fim: hoje }, modo: completo ? 'completo' : 'incremental' };
const obsFalhas = falhas.length ? [`Falhas nesta execução: ${falhas.join(' | ')}`] : [];
roda('parlamentares') && gravarSeMudou(path.join(DIR, 'meta.json'), {
  ...baseMeta,
  contagens: { parlamentares_em_exercicio: parlEmExercicio || (lerJson(path.join(DIR, 'parlamentares.json'))?.itens || []).length },
  fontes: [fonte('Portal Legislativo da ALESP — API (OpenAPI pública)', `${API}/v3/api-docs`)],
  observacoes: [
    'Deputados em exercício segundo o campo isEmExercicio da ALESP. Sem CPF, telefone, sala, aniversário ou biografia.',
    'Foto: arquivo do repositório oficial da ALESP, publicado só quando o endereço responde com imagem; senão null.',
    'nome_civil: não informado pela fonte (null).',
    ...obsFalhas,
  ],
});
fs.existsSync(DIR_VOT) && gravarSeMudou(path.join(DIR_VOT, 'meta.json'), {
  ...baseMeta,
  contagens: { por_ano: contVot, plenario: contPlen, ...(roda('comissoes') ? { comissoes_nesta_execucao: contCom } : {}) },
  fontes: [
    fonte('Votações nominais em Plenário — lista anual', `${API}/votacao/{ano}`),
    fonte('Votações nominais em comissões', `${API}/processo/votacaoComissao/{idProcesso}`),
  ],
  observacoes: [
    'Plenário: só há voto individual quando houve verificação de votação; o registro oficial é o PDF "Relatório de Verificação de Votação". Votações simbólicas não têm voto individual e não aparecem aqui.',
    'Plenário: leitura do PDF por coordenadas (o voto fica cerca de 0,75 ponto abaixo da linha do nome; partidos longos invadem a coluna do voto). Votos individuais só são publicados quando a contagem confere com o rodapé (Votos Sim, Votos Não, Abstenção, Em Branco, Presidente, Total) e cada nome tem a mesma cor de impressão do seu voto; caso contrário, placar oficial + lacuna + link.',
    'Plenário: "---" é reproduzido como consta do relatório (sem legenda oficial). O campo marcador_relatorio reproduz a letra impressa antes do nome (ex.: L, P, G), cuja legenda não consta do relatório; "P" coincide com o campo "Presidente" do rodapé.',
    'Plenário: placar.obstrucao é a contagem dos registros "Obstrução" lidos do relatório (o rodapé não traz esse total); placar.outros = "Em Branco".',
    'Plenário: o relatório da eleição da Mesa (formato de votos por candidato) não é lido automaticamente.',
    'Comissões: o voto é o texto oficial (ex.: "Favorável ao voto do relator", "Com o Voto em Separado", "Não registrou voto"), sem conversão para sim/não; placar null.',
    'Comissões: id = idReuniaoItemDeliberacao da ALESP; período a partir de 2025-01-01. Partido na data do voto não informado pela fonte.',
    'Ligação nome → parlamentar_id só por nome idêntico (sem acento/maiúsculas) na lista oficial; caso contrário null.',
    ...obsFalhas,
  ],
});
roda('proposicoes') && fs.existsSync(DIR_PROP) && gravarSeMudou(path.join(DIR_PROP, 'meta.json'), {
  ...baseMeta,
  contagens: { por_ano: contProp, processos_com_tramitacao_no_periodo: tramitados.size },
  fontes: [fonte('Proposições — Portal Legislativo da ALESP', `${API}/processo`),
    fonte('Tramitações publicadas por dia', `${API}/notificacao/tramitacoes/{data}`)],
  observacoes: [
    'Tipos: PL (Projeto de Lei), PLC (Projeto de Lei Complementar), PEC (Proposta de Emenda à Constituição), PDL (Projeto de Decreto Legislativo), PR (Projeto de Resolução). Ano = ano de apresentação.',
    'Situação: etapa e regime informados pela ALESP e a última tramitação (texto oficial). O campo situacao_coletada_em indica quando a situação foi consultada.',
    'O arquivo legado proposituras.xml da ALESP parou em 2026-07-28; por isso a fonte é a API do portal.',
    ...obsFalhas,
  ],
});
roda('doe') && fs.existsSync(DIR_NORMAS) && gravarSeMudou(path.join(DIR_NORMAS, 'meta.json'), {
  ...baseMeta,
  contagens: { por_ano: contNormas },
  fontes: [fonte('Diário Oficial do Estado de São Paulo — busca por seção', `${DOE}/v2/advanced-search/publications`,
    'Diário Oficial do Estado de São Paulo (Imprensa Oficial / Governo do Estado)')],
  observacoes: [
    'Seções do caderno Executivo > Atos Normativos: Leis Complementares, Leis, Decretos, Veto Total a Projeto de Lei, Veto Parcial a Projeto de Lei. Ano do índice = ano de publicação no DOE.',
    'Ementa: trecho literal entre o título e "O GOVERNADOR DO ESTADO..."; quando não identificada, fica null com lacuna.',
    'Vetos: razoes_veto traz o texto integral da mensagem publicada; o projeto vetado é ligado à ALESP pelo número (rota id-por-tipo-numero-ano).',
    'Retificações aparecem como itens próprios (retificacao: true), com o texto publicado.',
    'Leis: projeto_origem_texto reproduz a linha literal "(Projeto de lei n.º …, de …, do(s) Deputado(s) …)" publicada no DOE; projeto_origem traz sigla, número e ano lidos dessa linha.',
    'A API do DOE não tem documentação pública e pode mudar sem aviso.',
    ...obsFalhas,
  ],
});

log(`Fim. Requisições: ${estatisticas.requisicoes} (retentativas ${estatisticas.retentativas}), `
  + `${(estatisticas.bytes / 1e6).toFixed(1)} MB. Arquivos gravados: ${contagemGravacao.gravados}, inalterados: ${contagemGravacao.inalterados}.`);
if (falhas.length) { console.error('Falhas:\n- ' + falhas.join('\n- ')); process.exit(1); }
