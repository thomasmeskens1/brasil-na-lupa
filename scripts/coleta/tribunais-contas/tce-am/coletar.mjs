#!/usr/bin/env node
/**
 * Coletor do Tribunal de Contas do Estado do Amazonas (TCE-AM) — Brasil na Lupa.
 *
 * Fonte: API JSON do Banco de Jurisprudência (jurisprudencia-api.tce.am.gov.br), a mesma usada pelo site
 * oficial jurisprudencia.tce.am.gov.br. A API não é documentada oficialmente (parâmetros lidos do código
 * público do site) e pode mudar sem aviso.
 *
 * Gera, em dados/tribunais-contas/tce-am/:
 *   contas-governador/<exercicio>.json  parecer prévio sobre as contas do Governador
 *   contas-prefeitos/<municipio>.json   pareceres prévios sobre as contas dos Prefeitos, um item por parecer
 *   meta.json                           execução, contagens por ano, fontes, restrições e lacunas
 *
 * Uso (Node 20+):
 *   node scripts/coleta/tribunais-contas/tce-am/coletar.mjs               rotina diária (decisórios do ano atual e do anterior)
 *   node scripts/coleta/tribunais-contas/tce-am/coletar.mjs --desde 2015  decisórios de 2015 em diante
 *   node scripts/coleta/tribunais-contas/tce-am/coletar.mjs --completo    carga completa, por ano do processo desde 2000
 *   node scripts/coleta/tribunais-contas/tce-am/coletar.mjs --completo --desde 2023   refaz os anos do processo de 2023 em diante
 *   COLETA_ORCAMENTO_MIN=20 node …/coletar.mjs                            para limpo ao fim do orçamento (minutos)
 *
 * Consulta: filtrada por natureza "Prestação de Contas Anual" e pela palavra "PREVIO" no conteúdo, uma por
 * ano do decisório (rotina diária; se passar de 4 MB, refeita por trimestre e mês da sessão) ou por ano do
 * processo (--completo, que alcança também os registros migrados sem metadados). Uma requisição por vez, pausa de 1,2 s, robots.txt lido antes. Os PDFs só
 * são linkados. Gravação atômica; arquivo sem mudança de conteúdo não é regravado.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  obterJson, gravarSeMudou, lerJson, contagemGravacao, estatisticas, robots, hojeISO, fonte, SAIDA, HOST_API,
  semTempo, decorridoS, orcamentoMs,
} from './lib.mjs';
import {
  urlApi, montarItem, carregarMunicipiosAM, fecharItensMunicipio, arquivoMunicipio, escolherGovernador, NATUREZA, SITE_JURIS,
} from './montar.mjs';

const ANO_INICIAL_COMPLETO = 2000; // ano do processo; antes de 2010 a API não devolveu nada no teste de 05/11/2026
const LIMITE_PROCESSO = 6 * 1024 * 1024; // consulta por ano do processo não tem como ser dividida por data

function argumentos(argv) {
  const a = { desde: null, completo: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--completo') a.completo = true;
    else if (argv[i] === '--desde') a.desde = Number(argv[++i]);
    else if (argv[i].startsWith('--desde=')) a.desde = Number(argv[i].slice(8));
    else if (argv[i] === '--ajuda' || argv[i] === '-h') { console.log('Uso: coletar.mjs [--desde AAAA] [--completo]'); process.exit(0); }
    else throw new Error(`argumento desconhecido: ${argv[i]}`);
  }
  if (a.desde !== null && !(Number.isInteger(a.desde) && a.desde >= 1990 && a.desde <= 2100)) throw new Error('--desde precisa de um ano (AAAA)');
  return a;
}

const pad = (n) => String(n).padStart(2, '0');
const ultimoDia = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();
function janelasMensais(ano, mIni, mFim) {
  const r = [];
  for (let m = mIni; m <= mFim; m++) r.push({ ini: `${ano}${pad(m)}01`, fim: `${ano}${pad(m)}${ultimoDia(ano, m)}` });
  return r;
}

/**
 * Registros de um ano. modo 'decisorio': ano do decisório (rotina diária; divide por trimestre e mês da sessão
 * se a resposta for grande). modo 'processo': ano do processo (carga completa; alcança também os registros
 * migrados sem metadados, que não têm ano do decisório nem data de sessão).
 */
async function buscarAno(ano, modo) {
  if (modo === 'processo') {
    const r = await obterJson(urlApi({ strConteudo: 'PREVIO', strAnoProcesso: String(ano), strNatureza: NATUREZA }), { limite: LIMITE_PROCESSO });
    if (r.cortado) throw new Error(`resposta acima de ${LIMITE_PROCESSO / 1048576} MB para o ano do processo ${ano}; ano não coletado`);
    return { registros: r.dados, dividido: false };
  }
  const consulta = (ini, fim) => urlApi({
    strConteudo: 'PREVIO', strAnoDecisorio: String(ano), strNatureza: NATUREZA,
    ...(ini ? { strDataSessaoInicio: ini, strDataSessaoFim: fim } : {}),
  });
  const r = await obterJson(consulta());
  if (!r.cortado) return { registros: r.dados, dividido: false };
  const registros = [];
  for (const [mi, mf] of [[1, 3], [4, 6], [7, 9], [10, 12]]) {
    const ini = `${ano}${pad(mi)}01`, fim = `${ano}${pad(mf)}${ultimoDia(ano, mf)}`;
    const t = await obterJson(consulta(ini, fim));
    if (!t.cortado) { registros.push(...t.dados); continue; }
    for (const j of janelasMensais(ano, mi, mf)) {
      const u = await obterJson(consulta(j.ini, j.fim));
      if (u.cortado) throw new Error(`resposta acima do limite mesmo para o mês ${j.ini.slice(0, 6)}; ano ${ano} não coletado`);
      registros.push(...u.dados);
    }
  }
  return { registros, dividido: true };
}

/** Itens já gravados (para a rotina incremental não perder os anos que não consulta). */
function carregarExistentes() {
  const reg = new Map();
  const dirP = path.join(SAIDA, 'contas-prefeitos');
  for (const n of fs.existsSync(dirP) ? fs.readdirSync(dirP).filter((f) => f.endsWith('.json')) : []) {
    const d = lerJson(path.join(dirP, n));
    for (const it of d?.itens ?? []) if (it.decisorio?.numero) reg.set(it.decisorio.numero, { tipo: 'prefeitura', mun: d.municipio, item: it });
  }
  const dirG = path.join(SAIDA, 'contas-governador');
  for (const n of fs.existsSync(dirG) ? fs.readdirSync(dirG).filter((f) => /^\d{4}\.json$/.test(f)) : []) {
    const it = lerJson(path.join(dirG, n));
    if (it?.decisorio?.numero) reg.set(it.decisorio.numero, { tipo: 'governador', item: it });
  }
  return reg;
}

const anoDoNumero = (numero) => Number(String(numero).split('/')[1]);
const anoDoProcesso = (item) => Number(String(item.processo?.numero ?? '').split('/')[1]);

/** O registro consultado agora substitui o antigo? (a rotina por ano do decisório não alcança os registros sem metadados) */
function cobre(modo, ano, item) {
  if (modo === 'processo') return anoDoProcesso(item) === ano;
  return anoDoNumero(item.decisorio.numero) === ano && !item.registro_sem_metadados;
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const anoAtual = Number(hojeISO().slice(0, 4));
  const modo = args.completo ? 'processo' : 'decisorio';
  // --completo --desde AAAA: refaz só os anos do processo a partir de AAAA (ex.: um ano que falhou).
  const desde = args.desde ?? (args.completo ? ANO_INICIAL_COMPLETO : anoAtual - 1);
  const municipios = carregarMunicipiosAM();
  const registro = carregarExistentes();
  const metaAntiga = lerJson(path.join(SAIDA, 'meta.json'));
  const chaveContagem = modo === 'processo' ? 'por_ano_do_processo' : 'por_ano_do_decisorio';
  const contagensAntigas = metaAntiga?.contagens ?? {};
  const porAno = { ...(contagensAntigas[chaveContagem] ?? {}) };
  const naoCasados = new Map(Object.entries(metaAntiga?.orgaos_nao_identificados ?? {}));
  const anosAtualizados = [];
  let interrompido = null;
  let bloqueio = null;

  for (let ano = desde; ano <= anoAtual; ano++) {
    if (semTempo(90000)) { interrompido = `orçamento de tempo (${orcamentoMs() / 60000} min) atingido antes do ano ${ano}`; break; }
    let res;
    try {
      res = await buscarAno(ano, modo);
    } catch (e) {
      console.error(`ano ${ano}: ${e.message}`);
      if (e.bloqueio || /robots/.test(e.message)) { bloqueio = e.message; break; }
      porAno[ano] = { ...(porAno[ano] ?? {}), erro: e.message };
      continue;
    }
    const c = { registros: res.registros.length, pareceres_previos: 0, sem_metadados: 0, governador: 0, prefeituras: 0, prefeituras_identificadas: 0, sem_conclusao: 0, descartados: {} };
    const novos = new Map();
    for (const x of res.registros) {
      if (modo === 'decisorio' && String(x.anoDecisorio) !== String(ano)) continue;
      if (modo === 'processo' && String(x.anoProcesso) !== String(ano)) continue;
      const m = montarItem(x);
      if (m.tipo === 'descartado') {
        const chave = m.motivo.replace(/\s*\(.*$/, '').replace(/^órgão .*/, 'outros órgãos').slice(0, 60);
        c.descartados[chave] = (c.descartados[chave] || 0) + 1;
        continue;
      }
      const k = m.item.decisorio.numero;
      // Mesmo parecer duas vezes (registro novo e migrado): fica o que tem metadados.
      if (novos.has(k) && (m.item.registro_sem_metadados || !novos.get(k).item.registro_sem_metadados)) { c.descartados.duplicado = (c.descartados.duplicado || 0) + 1; continue; }
      c.pareceres_previos++;
      if (m.item.registro_sem_metadados) c.sem_metadados++;
      if (!m.item.parecer.conclusao) c.sem_conclusao++;
      if (m.tipo === 'governador') { c.governador++; novos.set(k, { tipo: 'governador', item: m.item }); continue; }
      c.prefeituras++;
      const mun = municipios.get(m.municipio_normalizado);
      if (!mun) { naoCasados.set(x.orgao, k); continue; }
      c.prefeituras_identificadas++;
      novos.set(k, { tipo: 'prefeitura', mun: { id: mun.id, nome: mun.nome, uf: 'AM', codigo_ibge: mun.codigo_ibge }, item: m.item });
    }
    if (res.dividido) c.consulta_dividida_por_data = true;
    for (const [k, v] of [...registro]) if (cobre(modo, ano, v.item)) registro.delete(k);
    for (const [k, n] of novos) {
      const antigo = registro.get(k);
      if (antigo && n.item.registro_sem_metadados && !antigo.item.registro_sem_metadados) continue;
      registro.set(k, n);
    }
    porAno[ano] = c;
    anosAtualizados.push(ano);
    console.log(`ano ${ano} (${modo}): ${c.registros} registros, ${c.pareceres_previos} pareceres (sem metadados ${c.sem_metadados}; governador ${c.governador}, prefeituras ${c.prefeituras_identificadas}/${c.prefeituras})`);
  }

  // ---- Governador: um arquivo por exercício
  const gov = new Map();
  for (const r of registro.values()) if (r.tipo === 'governador') gov.set(r.item.parecer.exercicio, [...(gov.get(r.item.parecer.exercicio) ?? []), r.item]);
  const resumoGov = [];
  for (const [ex, itens] of [...gov].sort()) {
    const it = escolherGovernador(itens);
    gravarSeMudou(path.join(SAIDA, 'contas-governador', `${ex}.json`), it);
    resumoGov.push({ exercicio: Number(ex), parecer: it.decisorio.numero, data_julgamento: it.data_julgamento, conclusao: it.parecer.conclusao, com_ressalvas: it.parecer.com_ressalvas, relator: it.relator, ressalvas: it.parecer.ressalvas.length, lacunas: it.lacunas.length });
  }

  // ---- Prefeitos: um arquivo por município
  const fonteBase = fonte('Banco de Jurisprudência do TCE-AM (API JSON usada pelo site oficial; não documentada oficialmente)', SITE_JURIS, { observacao: `Consulta: ${urlApi({ strConteudo: 'PREVIO', strAnoDecisorio: 'AAAA', strNatureza: NATUREZA })}` });
  const porMun = new Map();
  for (const r of registro.values()) if (r.tipo === 'prefeitura') {
    const atual = porMun.get(r.mun.id) ?? { mun: r.mun, itens: [] };
    atual.itens.push(r.item);
    porMun.set(r.mun.id, atual);
  }
  const resumoMun = [];
  for (const { mun, itens } of [...porMun.values()].sort((a, b) => a.mun.id.localeCompare(b.mun.id))) {
    const arq = arquivoMunicipio(mun, fecharItensMunicipio(mun, itens), fonteBase);
    gravarSeMudou(path.join(SAIDA, 'contas-prefeitos', `${mun.id}.json`), arq);
    resumoMun.push({ municipio: mun.id, ...arq.contagens });
  }

  // ---- meta
  const meta = {
    atualizado_em: new Date().toISOString(),
    ultima_execucao: new Date().toISOString(),
    tribunal: 'tce-am',
    modo: `${args.completo ? 'completo' : 'incremental'}${args.desde ? ` desde ${args.desde}` : ''}`,
    consulta_desta_execucao: modo === 'processo' ? 'por ano do processo' : 'por ano do decisório',
    anos_consultados_nesta_execucao: anosAtualizados,
    interrompido,
    bloqueio,
    contagens: {
      ...contagensAntigas,
      exercicios_governador: resumoGov.length,
      municipios_com_parecer: resumoMun.length,
      pareceres_prefeitos: resumoMun.reduce((s, m) => s + m.pareceres, 0),
      pareceres_prefeitos_sem_conclusao_identificada: resumoMun.reduce((s, m) => s + m.sem_fonte_aberta, 0),
      pareceres_sem_metadados_na_api: [...registro.values()].filter((r) => r.item.registro_sem_metadados).length,
      [chaveContagem]: Object.fromEntries(Object.entries(porAno).sort()),
    },
    contas_governador: resumoGov,
    municipios: resumoMun,
    orgaos_nao_identificados: Object.fromEntries([...naoCasados].sort()),
    fontes: [
      fonte('Banco de Jurisprudência do TCE-AM (site oficial)', SITE_JURIS),
      fonte('API JSON do Banco de Jurisprudência — consulta por campos (não documentada oficialmente)', `https://${HOST_API}/decisorios/byManyFields`),
    ],
    robots_e_restricoes: [
      `robots.txt de ${HOST_API} lido antes de cada execução: ${robots[HOST_API]?.observacao ?? 'não consultado nesta execução'}.`,
      'Único host consultado: jurisprudencia-api.tce.am.gov.br. Os PDFs (jurisprudencia-fs.tce.am.gov.br) só são linkados, nunca baixados.',
      'Sem CAPTCHA, login ou token na API. Resposta não-JSON, 401 ou 403 interrompem a coleta (não se contorna bloqueio).',
      'Consultas sempre filtradas por ano do decisório, natureza e palavra do conteúdo; uma consulta sem filtro devolve dezenas de MB e nunca é feita.',
      'User-Agent: BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br); uma requisição por vez, pausa de 1,2 s.',
    ],
    observacoes: [
      'A API não é documentada oficialmente: os parâmetros vêm do código público do site jurisprudencia.tce.am.gov.br e podem mudar sem aviso. Antes de uso amplo, convém confirmar com o TCE-AM que o uso automatizado é aceito.',
      'Só entram decisórios do tipo "Parecer Prévio" e da natureza "Prestação de Contas Anual" cujo órgão é "Governo do Estado do Amazonas" ou "Prefeitura Municipal de …". Pareceres prévios de outras naturezas (ex.: "Fiscalização de Atos de Gestão") e acórdãos de recurso não entram.',
      'A consulta usa a palavra "PREVIO" no conteúdo; um parecer cujo texto integral não a contenha (ex.: texto vazio na API) não é alcançado.',
      'Conclusão: só as fórmulas escritas no texto ("recomendando … a aprovação", "a desaprovação", "com ressalvas"); o trecho literal fica em conclusao_literal. Sem fórmula reconhecida: conclusão null e lacuna.',
      'O texto integral (campo "conteudo") vem sem acentos; os trechos literais são reproduzidos como na fonte. O texto integral não é republicado: só link do PDF e trechos curtos (no Governador, também as ressalvas e determinações numeradas).',
      'Registros migrados sem metadados (sobretudo de processos até 2016): tipoDecisorio, ano do decisório e data da sessão vêm vazios; o número, o colegiado e, quando escrita, a data da sessão são lidos do texto integral. Eles só são alcançados pela carga completa (--completo, por ano do processo); a rotina diária consulta por ano do decisório.',
      'Cobertura: a API não devolveu processos anteriores a 2001; nos exercícios antigos há poucos pareceres publicados. Exercício ausente não quer dizer que as contas não foram julgadas.',
    ],
    estatisticas_http: { ...estatisticas, falhas: estatisticas.falhas.slice(0, 20) },
    duracao_s: decorridoS(),
  };
  gravarSeMudou(path.join(SAIDA, 'meta.json'), meta);

  console.log(JSON.stringify({ anos: anosAtualizados, interrompido, bloqueio, governador: resumoGov.length, municipios: resumoMun.length, pareceres_prefeitos: meta.contagens.pareceres_prefeitos, gravados: contagemGravacao.gravados.length, inalterados: contagemGravacao.inalterados.length, http: { requisicoes: estatisticas.requisicoes, bytes: estatisticas.bytes, cortes: estatisticas.cortes } }, null, 2));
  if (bloqueio) process.exitCode = 1;
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
