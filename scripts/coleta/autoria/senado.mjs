// Autoria aprovada — Senado Federal.
// Fonte: API de dados abertos do Senado (processo legislativo). Para cada senador em exercício
// (lista oficial já coletada em dados/senado/parlamentares.json), as matérias de sua autoria
// apresentadas desde o início da legislatura atual; ficam as que têm situação atual
// "Transformada em norma jurídica" (com ou sem veto) e norma gerada registrada no processo.
import path from 'node:path';
import {
  obter, paraCada, gravarAtomico, lerJson, hojeISO, robotsCarregados, estat,
  SAIDA, RAIZ, INICIO_LEGISLATURA, LEGISLATURA,
} from './lib.mjs';
import { contarListaSenado, montarApresentadas } from './apresentadas.mjs';

export const BASE = 'https://legis.senado.leg.br/dadosabertos';
export const urlLista = (cod, inicio = INICIO_LEGISLATURA) =>
  `${BASE}/processo?codigoParlamentarAutor=${encodeURIComponent(cod)}&dataInicioApresentacao=${inicio}`;
export const urlProcesso = (id) => `${BASE}/processo/${encodeURIComponent(id)}`;
export const SITUACAO_NORMA = /^transformada em norma jur[ií]dica/i;

/** Da lista de processos de um autor, os que viraram norma (situação atual oficial), no período. */
export function transformadasDaLista(lista, inicio = INICIO_LEGISLATURA) {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((x) => SITUACAO_NORMA.test(String(x?.situacaoAtual ?? '').trim()))
    .filter((x) => String(x?.dataApresentacao ?? '') >= inicio)
    .map((x) => String(x.id))
    .filter((id) => /^\d+$/.test(id));
}

/** Resume o processo: identificação, ementa, situação, norma gerada e autores senadores (código → ordem). */
export function resumirProcesso(p) {
  if (!p || !p.id) return null;
  const autoria = p.documento?.autoria ?? p.autoriaIniciativa ?? [];
  const autores = {};
  for (const a of autoria) {
    if (!a || a.codigoParlamentar == null) continue;
    if (!/SENADOR/i.test(String(a.siglaTipo ?? a.siglaCargo ?? ''))) continue;
    const cod = String(a.codigoParlamentar);
    const ordem = Number(a.ordem);
    autores[cod] = Number.isFinite(ordem) && ordem > 0 ? ordem : null;
  }
  const n = p.normaGerada;
  return {
    identificacao: p.identificacao ?? null,
    sigla: p.sigla ?? null,
    tipo: p.descricaoSigla ?? p.documento?.tipo ?? null,
    numero: Number(p.numero) || null,
    ano: Number(p.ano) || null,
    ementa: (p.conteudo?.ementa ?? '').replace(/\s+/g, ' ').trim() || null,
    data_apresentacao: p.documento?.dataApresentacao ?? p.dataInicioEfetivo ?? null,
    situacao: p.situacaoAtual ?? null,
    data_situacao: p.dataSituacaoAtual ?? null,
    url: p.codigoMateria ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${p.codigoMateria}` : urlProcesso(p.id),
    norma: n && (n.descricao || n.numero)
      ? { descricao: n.descricao ?? null, tipo: n.tipo ?? null, data_assinatura: n.dataAssinatura ?? null, publicacao: n.veiculoPublicacao ? String(n.veiculoPublicacao).replace(/\s+/g, ' ').trim() : null }
      : null,
    autores,
  };
}

export function montar({ consultados, porSenador, processos, fontes, hoje = hojeISO(), robots = {}, inicio = INICIO_LEGISLATURA }) {
  const autores = {};
  const usados = new Set();
  for (const cod of [...porSenador.keys()].sort((a, b) => Number(a) - Number(b))) {
    const lista = porSenador.get(cod)
      .filter((id) => processos.get(id)?.norma) // só com norma gerada registrada
      .map((id) => [id, processos.get(id).autores[cod] ?? null]);
    lista.sort(([a], [b]) => String(processos.get(a).data_apresentacao).localeCompare(String(processos.get(b).data_apresentacao)) || Number(a) - Number(b));
    if (!lista.length) continue;
    autores[cod] = lista;
    for (const [id] of lista) usados.add(id);
  }
  const proposicoes = {};
  for (const id of [...usados].sort((a, b) => Number(a) - Number(b))) {
    const { autores: _a, ...resto } = processos.get(id);
    proposicoes[id] = resto;
  }
  return {
    atualizado_em: hoje,
    casa: 'senado',
    legislatura: LEGISLATURA,
    periodo: { inicio, fim: hoje },
    criterio:
      'Matérias de autoria de cada senador em exercício, apresentadas desde o início da legislatura atual, cuja situação atual na API de dados abertos do Senado Federal é "Transformada em norma jurídica" (com ou sem veto parcial) e que têm a norma gerada registrada no processo. Autoria segundo o processo: todos os senadores autores, com a ordem oficial (1 = primeiro autor).',
    fontes,
    robots_txt: robots,
    consultados: [...consultados].sort((a, b) => Number(a) - Number(b)),
    totais: { senadores_consultados: consultados.size, proposicoes_transformadas_em_norma: usados.size, senadores_autores: Object.keys(autores).length },
    proposicoes,
    autores,
  };
}

export async function coletarSenado({ hoje = hojeISO() } = {}) {
  const parl = lerJson(path.join(RAIZ, 'dados', 'senado', 'parlamentares.json'));
  const senadores = (parl?.itens ?? []).map((s) => String(s.id)).filter((id) => /^\d+$/.test(id));
  if (!senadores.length) throw new Error('lista de senadores em exercício ausente (dados/senado/parlamentares.json)');

  const consultados = new Set();
  const porSenador = new Map();
  const apresentadas = {};
  await paraCada(senadores, async (cod) => {
    try {
      const r = await obter(urlLista(cod));
      porSenador.set(cod, transformadasDaLista(r.dados));
      apresentadas[cod] = contarListaSenado(r.dados);
      consultados.add(cod);
    } catch (e) {
      console.warn(`[autoria/senado] senador ${cod}: ${e.message}`);
    }
  });
  const ids = [...new Set([...porSenador.values()].flat())].sort((a, b) => Number(a) - Number(b));
  const processos = new Map();
  await paraCada(ids, async (id) => {
    try {
      const r = await obter(urlProcesso(id));
      const p = resumirProcesso(r.dados);
      if (p) processos.set(id, p);
    } catch (e) {
      console.warn(`[autoria/senado] processo ${id}: ${e.message}`);
    }
  });
  // Senador cuja matéria não pôde ser conferida fica fora de "consultados" (o site mostra a lacuna).
  for (const [cod, lista] of porSenador) if (lista.some((id) => !processos.has(id))) { consultados.delete(cod); porSenador.delete(cod); }

  const fontes = [
    { titulo: 'Processos legislativos por autor — API de dados abertos do Senado Federal', url: `${BASE}/processo?codigoParlamentarAutor={código}&dataInicioApresentacao=${INICIO_LEGISLATURA}`, orgao: 'Senado Federal', acessado_em: hoje },
    { titulo: 'Detalhe do processo (autoria e norma gerada) — API de dados abertos do Senado Federal', url: `${BASE}/processo/{id}`, orgao: 'Senado Federal', acessado_em: hoje },
    { titulo: 'Senadores em exercício — Dados Abertos do Senado Federal', url: parl?.fonte?.url ?? `${BASE}/senador/lista/atual`, orgao: 'Senado Federal', acessado_em: parl?.fonte?.acessado_em ?? hoje },
  ];
  const saida = montar({ consultados, porSenador, processos, fontes, hoje, robots: robotsCarregados() });
  const dir = path.join(SAIDA, 'senado');
  const mudou = gravarAtomico(path.join(dir, 'aprovadas.json'), saida);
  const listaOk = Object.fromEntries(Object.keys(apresentadas).sort((a, b) => Number(a) - Number(b)).map((k) => [k, apresentadas[k]]));
  gravarAtomico(path.join(dir, 'apresentadas.json'), montarApresentadas({ casa: 'senado', contagem: listaOk, fontes: fontes.slice(0, 1).concat(fontes.slice(2)), hoje, consultados: Object.keys(listaOk) }));
  gravarAtomico(path.join(dir, 'meta.json'), {
    atualizado_em: hoje,
    ultima_execucao: new Date().toISOString(),
    resultado: mudou ? 'atualizado' : 'sem mudança no resultado',
    totais: saida.totais,
    requisicoes: estat.requisicoes,
    falhas: estat.falhas.slice(0, 50),
  });
  console.log(`[autoria/senado] ${saida.totais.senadores_consultados}/${senadores.length} senadores consultados; ${saida.totais.proposicoes_transformadas_em_norma} matérias transformadas em norma.`);
  return saida;
}
