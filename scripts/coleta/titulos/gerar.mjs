#!/usr/bin/env node
// Gera dados/titulos/<secao>.json e dados/titulos/temas.json (tabela pública de correspondência).
//
// Estratégia aprovada (depois da 2ª revisão de precisão, dados/titulos/revisao/*-2.json):
//   - o título é o OFICIAL (texto do órgão sem alteração) em quase todos os itens, com uma etiqueta curta
//     montada só de campos estruturados ("Aprovado 312 × 140", "Veto mantido", "Lei publicada");
//   - título de origem "estruturado" só onde há dado verificável, por modelo fixo a partir dos campos:
//     crédito com valor (MP, lei, decreto), mudança de ICMS antes → depois, parecer de contas do TCE-SP;
//   - nenhuma ementa é reescrita, nenhuma manchete de agência é usada; item vetado por analista → oficial.
// Ao terminar, roda verificar.mjs sobre a saída (reprovado → oficial).
//
// A rede só é usada para o TEMA (temas da Câmara, classificações do Senado, temas e indexação da ALESP,
// árvore de assuntos do CNJ). Com --sem-rede, sem cache,
// mantém o tema já gravado do item.
//
// Uso: node scripts/coleta/titulos/gerar.mjs [--secoes camara,senado] [--sem-rede]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SAIDA, CACHE, lerJson, gravarSeMudou, hojeISO, estatisticas, contagemGravacao } from './lib.mjs';
import { SECOES, carregarSecao } from './itens.mjs';
import { verificarTitulo, verificarEtiqueta } from './regras.mjs';
import { classificar, tabelaPublica } from './temas.mjs';
import { camaraProposicao, camaraIdPorIdentificacao, senadoProcesso, senadoNorma, alespProposicao, alespNorma, alespTemasDoAno, tpuAssuntos } from './fontes.mjs';
import { carregarVetos } from './conteudo.mjs';
import { verificarTudo, contextoVerificacao, contextoEtiqueta, registroOficial } from './verificar.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const SEM_REDE = Boolean(opt('sem-rede', false));
const secoes = String(opt('secoes', SECOES.join(','))).split(',').filter((s) => SECOES.includes(s));
const rede = { semRede: SEM_REDE };

async function emLotes(lista, fn) {
  // o limite de 2 requisições simultâneas está em lib.obter(); aqui só evitamos milhares de promessas pendentes
  const out = new Map();
  for (let i = 0; i < lista.length; i += 20) {
    const lote = lista.slice(i, i + 20);
    const r = await Promise.all(lote.map((x) => fn(x).catch(() => null)));
    lote.forEach((x, j) => out.set(x, r[j]));
  }
  return out;
}

/** Classificações oficiais externas (só para o tema). */
async function enriquecer(itens) {
  const camIds = new Set(), camBusca = new Map(), senProc = new Set(), senNorma = new Set(), alespProc = new Set(), anosSp = new Set();
  let tpu = false;
  for (const it of itens) {
    const c = it.consultas;
    if (c.camaraId) camIds.add(String(c.camaraId));
    if (c.camaraBusca) camBusca.set(`${c.camaraBusca.sigla} ${c.camaraBusca.numero}/${c.camaraBusca.ano}`, c.camaraBusca);
    if (c.senadoProcesso) senProc.add(String(c.senadoProcesso));
    if (c.senadoNorma) senNorma.add(String(c.senadoNorma));
    if (c.alespProcesso) alespProc.add(String(c.alespProcesso));
    if (c.normaSp) anosSp.add(c.normaSp.split('|')[2]);
    if (c.tpu?.length) tpu = true;
  }
  console.log(`  consultas: ${camIds.size} proposições da Câmara, ${camBusca.size} buscas de projeto de lei, ${senProc.size} processos do Senado, ${senNorma.size} normas no Senado, ${alespProc.size} proposições da ALESP, ${anosSp.size} anos do Banco de Legislação da ALESP${tpu ? ', árvore de assuntos do CNJ' : ''}`);
  const buscaIds = await emLotes([...camBusca.keys()], (k) => { const b = camBusca.get(k); return camaraIdPorIdentificacao(b.sigla, b.numero, b.ano, rede); });
  for (const it of itens) if (it.consultas.camaraBusca) {
    const b = it.consultas.camaraBusca; const id = buscaIds.get(`${b.sigla} ${b.numero}/${b.ano}`);
    if (id) { it.consultas.camaraId = id; camIds.add(id); }
  }
  const cam = await emLotes([...camIds], (id) => camaraProposicao(id, rede));
  const sen = await emLotes([...senProc], (id) => senadoProcesso(id, rede));
  const senN = await emLotes([...senNorma], (id) => senadoNorma(id, rede));
  const alesp = await emLotes([...alespProc], (id) => alespProposicao(id, rede));
  const idsNorma = [...new Set([...alesp.values()].map((p) => p?.idNorma).filter(Boolean))];
  const alespN = await emLotes(idsNorma, (id) => alespNorma(id, rede));
  const sp = new Map();
  for (const ano of anosSp) for (const [k, v] of await alespTemasDoAno(ano, rede)) sp.set(k, v);
  return { cam, sen, senN, alesp, alespN, sp, tpu: tpu ? await tpuAssuntos(rede) : new Map() };
}

/** Nomes dos níveis acima de um assunto na árvore oficial do CNJ (do mais próximo ao ramo do direito). */
function ancestrais(tpu, codigo) {
  const out = [];
  let a = tpu.get(String(codigo));
  for (let i = 0; a?.pai && i < 12; i++) { a = tpu.get(a.pai); if (a) out.push(a.nome); }
  return out;
}

/** { principais, reserva }: rótulos oficiais vindos das fontes externas. */
function rotulosExternos(it, fx) {
  const r = [], reserva = [];
  const c = fx.cam.get(String(it.consultas.camaraId));
  if (c) {
    for (const t of c.temas) r.push({ fonte: 'camara-tema', valor: t });
    if (c.keywords) r.push({ fonte: 'camara-palavra-chave', valor: c.keywords });
  }
  const s = fx.sen.get(String(it.consultas.senadoProcesso));
  if (s) for (const cl of s.classificacoes) r.push({ fonte: 'senado-classificacao', valor: cl });
  if (s?.tipoConteudo) r.push({ fonte: 'senado-tipo-conteudo', valor: s.tipoConteudo });
  const sn = fx.senN.get(String(it.consultas.senadoNorma));
  if (sn) for (const cl of sn.classificacoes) reserva.push({ fonte: 'senado-classificacao', valor: cl });
  const p = fx.alesp.get(String(it.consultas.alespProcesso));
  if (p) {
    for (const t of fx.alespN.get(p.idNorma)?.temas || []) r.push({ fonte: 'alesp-tema', valor: t });
    for (const t of p.indexadores) reserva.push({ fonte: 'alesp-indexador', valor: t });
  }
  for (const t of (it.consultas.normaSp && fx.sp.get(it.consultas.normaSp)) || []) r.push({ fonte: 'alesp-tema', valor: t });
  for (const cod of it.consultas.tpu || []) for (const nome of ancestrais(fx.tpu, cod)) reserva.push({ fonte: 'assunto-judicial', valor: nome });
  return { principais: r, reserva };
}
const temConsultaExterna = (it) => Boolean(it.consultas.camaraId || it.consultas.camaraBusca || it.consultas.senadoProcesso);

/** Registro de um item: estruturado (aprovado pelo verificador e sem veto) ou oficial; etiqueta verificada. */
export function registroDoItem(it, { vetado = null, tema, relatorio = null } = {}) {
  const base = { subtitulo: it.subtitulo, tema };
  let reg = null;
  const c = it.construir(it.raw);
  if (c?.erro && relatorio) relatorio.sem_modelo.push({ secao: it.secao, id: it.id, motivo: c.erro });
  if (c?.titulo && !vetado) {
    const v = verificarTitulo(c.titulo, 'estruturado', contextoVerificacao(it, c));
    if (v.aprovado) {
      reg = { titulo: c.titulo, ...base, origem: 'estruturado', modelo: c.modelo, fonte: c.fonte || it.oficial.fonte || null, verificacao: { ...v.verificacao, aprovado_pelo_verificador: true } };
    } else if (relatorio) relatorio.reprovacoes.push({ secao: it.secao, id: it.id, titulo: c.titulo, motivos: v.motivos });
  }
  if (!reg) reg = registroOficial(it, { ...base }, { veto_vies: vetado || null });
  const e = it.etiquetar(it.raw);
  if (e && verificarEtiqueta(e, contextoEtiqueta(it)).aprovado) reg.etiqueta = e;
  // ordem fixa das chaves (diff legível)
  const { titulo, subtitulo, etiqueta, origem, modelo, fonte, verificacao } = reg;
  return { titulo, subtitulo, ...(etiqueta ? { etiqueta } : {}), origem, ...(modelo ? { modelo } : {}), fonte: fonte || null, tema, verificacao };
}

async function main() {
  const t0 = Date.now();
  fs.mkdirSync(SAIDA, { recursive: true });
  const relatorio = { gerado_em: new Date().toISOString(), secoes: {}, reprovacoes: [], sem_modelo: [] };
  const vetos = carregarVetos();
  relatorio.vetos_aplicados = 0;

  for (const secao of secoes) {
    const t1 = Date.now();
    const itens = carregarSecao(secao);
    console.log(`${secao}: ${itens.length} itens`);
    const fx = await enriquecer(itens);
    const arq = path.join(SAIDA, `${secao}.json`);
    const anteriores = lerJson(arq)?.itens || {};
    const saida = {};
    const cobertura = {};
    let etiquetas = 0;
    for (const it of itens) {
      const vetado = vetos.get(`${secao}|${it.id}`) || null;
      if (vetado) relatorio.vetos_aplicados++;
      const externos = rotulosExternos(it, fx);
      // sem resposta da fonte externa (sem rede e sem cache), o tema já gravado é mantido
      const tema = !externos.principais.length && !externos.reserva.length && temConsultaExterna(it) && anteriores[it.id]?.tema
        ? anteriores[it.id].tema
        : classificar([...it.rotulos, ...externos.principais], externos.reserva).tema;
      const reg = registroDoItem(it, { vetado, tema, relatorio });
      saida[it.id] = reg;
      cobertura[reg.origem] = (cobertura[reg.origem] || 0) + 1;
      if (reg.etiqueta) etiquetas++;
    }
    const ordenado = Object.fromEntries(Object.keys(saida).sort().map((k) => [k, saida[k]]));
    gravarSeMudou(arq, { atualizado_em: hojeISO(), itens: ordenado });
    relatorio.secoes[secao] = { itens: itens.length, cobertura, etiquetas, segundos: Math.round((Date.now() - t1) / 1000) };
    console.log(`  cobertura: ${JSON.stringify(cobertura)}; etiquetas: ${etiquetas} (${Math.round((Date.now() - t1) / 1000)} s)`);
  }

  gravarSeMudou(path.join(SAIDA, 'temas.json'), { atualizado_em: hojeISO(), ...tabelaPublica() });
  const ver = verificarTudo({ secoes, corrigir: true, silencioso: true });
  relatorio.verificacao_final = ver.resumo;
  relatorio.rede = { ...estatisticas, falhas: estatisticas.falhas.slice(0, 50) };
  relatorio.gravacao = contagemGravacao;
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(path.join(CACHE, 'relatorio.json'), JSON.stringify(relatorio, null, 2));
  const porMotivo = {};
  for (const r of relatorio.sem_modelo) porMotivo[r.motivo] = (porMotivo[r.motivo] || 0) + 1;
  for (const r of relatorio.reprovacoes) { const k = `verificador: ${r.motivos[0].replace(/:.*$/, '')}`; porMotivo[k] = (porMotivo[k] || 0) + 1; }
  console.log('sem título estruturado, por motivo:', JSON.stringify(porMotivo, null, 1));
  console.log(`verificação final: ${JSON.stringify(ver.resumo)}`);
  console.log(`rede: ${estatisticas.requisicoes} requisições, ${estatisticas.cache} do cache, ${estatisticas.falhas.length} falhas`);
  console.log(`arquivos: ${contagemGravacao.gravados} gravados, ${contagemGravacao.inalterados} sem mudança; ${Math.round((Date.now() - t0) / 1000)} s`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
