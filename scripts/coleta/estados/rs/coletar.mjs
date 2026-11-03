#!/usr/bin/env node
/**
 * Coletor da Assembleia Legislativa do Rio Grande do Sul (ALRS) e das normas estaduais (Sistema LEGIS).
 *
 * USO
 *   node scripts/coleta/estados/rs/coletar.mjs                      # incremental (ano atual e anterior)
 *   node scripts/coleta/estados/rs/coletar.mjs --anos 2026          # só um ano
 *   node scripts/coleta/estados/rs/coletar.mjs --etapas parlamentares,proposicoes,normas
 *   COLETA_ORCAMENTO_MIN=20 (padrão) limita o tempo; o que faltar fica no cursor (meta.json) para a próxima.
 *   node scripts/coleta/estados/rs/testes.mjs                       # testes offline
 *
 * SAÍDAS (dados/estados/rs/)
 *   meta.json                      meta_coleta + cursor + situação do robots.txt de cada host
 *   parlamentares.json             deputados (lista oficial do portal; sem telefone)
 *   proposicoes/indice-<ano>.json  PL, PLC, PEC, PDL, PR e vetos (VT/VP) pelo ano de apresentação. Entram as
 *                                  do período (--anos) e as de até 3 anos antes cuja situação mudou no período
 *                                  (ex.: PL 188/2024 votado em 2026); vetos levam o número/ano do projeto vetado.
 *   votacoes/<id>.json             votações de Plenário e de comissões com voto por deputado e partido
 *   votacoes/indice-<ano>.json     resumo das votações por ano da votação
 *   normas/indice-<ano>.json       leis, leis complementares, emendas constitucionais e decretos (LEGIS)
 *
 * FONTES
 *   ALRS: https://ww4.al.rs.gov.br/legislativo/pesquisa (lista completa embutida) e /proposicao/{SIGLA}/{n}/{ano}
 *         (JSON "drupal-settings-json" com votações: deputado, partido e voto); deputados em
 *         https://ww4.al.rs.gov.br:5000/listarDestaqueDeputados (endereço usado pela página /deputados).
 *   LEGIS: https://ww3.al.rs.gov.br/legis/M010/ (lista por tipo/ano e ficha com proposição de origem e DOE).
 *   DOE-RS (doe-backend.pro.rs.gov.br): o robots.txt responde erro 500; pela RFC 9309 isso é bloqueio
 *         total, então o DOE não é acessado. A publicação no DOE vem da ficha do LEGIS.
 *
 * INCREMENTAL: a busca é lida inteira a cada execução (é uma requisição por tipo/ano, lenta: 10 a 60 s);
 *   só as proposições novas ou cuja situação mudou (data, descrição, linha do tempo ou local) têm a página
 *   relida. Pendências ficam no cursor. Prioridade: ano mais recente, situação mais recente.
 * LIMITES: robots.txt lido antes da 1ª requisição a cada host; 2 requisições simultâneas; 2 s entre
 *   requisições ao portal da ALRS; até 4 tentativas; User-Agent identificável.
 * Código de saída: 0 = ok; 1 = alguma etapa falhou (as demais são gravadas).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  obter, podeAcessar, lerJson, gravarSeMudou, contagemGravacao, hojeISO, normalizarNome, estatisticas,
  robotsRelatorio, restanteMs, log, definirIntervalo, paraCada, manterDataColeta,
} from './lib.mjs';
import { PORTAL, ORGAO, TIPOS_POR_ANO, listar, itemDaBusca, lerProposicao, urlBusca } from './alrs.mjs';
import { TIPOS_NORMA, listarNormas, lerFicha, montarNorma, LEGIS } from './legis.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const DIR = path.join(RAIZ, 'dados', 'estados', 'rs');
const DIR_PROP = path.join(DIR, 'proposicoes');
const DIR_VOT = path.join(DIR, 'votacoes');
const DIR_NORMAS = path.join(DIR, 'normas');
const URL_DEPUTADOS = 'https://ww4.al.rs.gov.br:5000/listarDestaqueDeputados';

const args = process.argv.slice(2);
const hoje = hojeISO();
const anoAtual = Number(hoje.slice(0, 4));
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? String(args[i + 1] || '') : null; };
const ANOS = (arg('--anos') || `${anoAtual},${anoAtual - 1}`).split(',').map(Number).filter(Boolean).sort((a, b) => b - a);
// Anos de apresentação lidos na busca: projetos de anos anteriores votados no período entram pela data da situação.
const ANOS_LISTA = [];
for (let a = Math.max(...ANOS); a >= Math.min(...ANOS) - 3; a--) ANOS_LISTA.push(a);
const noPeriodo = (p) => ANOS.includes(Number(p.anoProposicao)) || ANOS.includes(Number(String(p.dthSituacaoProposicao || '').slice(6, 10)));
const ETAPAS = new Set((arg('--etapas') || 'parlamentares,proposicoes,normas').split(','));
const roda = (e) => ETAPAS.has(e);
const ORC_MIN = Number(process.env.COLETA_ORCAMENTO_MIN || 20);
const RESERVA_NORMAS_MS = Math.max(3 * 60000, ORC_MIN * 60000 * 0.2);
definirIntervalo('ww4.al.rs.gov.br', 2000);
definirIntervalo('ww4.al.rs.gov.br:5000', 2000);
definirIntervalo('ww3.al.rs.gov.br', 1000);

const falhas = [];
async function etapa(nome, fn) {
  try { return await fn(); } catch (e) { falhas.push(`${nome}: ${e.message}`); log(`FALHA em ${nome}: ${e.message}`); return null; }
}
const fonte = (titulo, url, orgao = ORGAO) => ({ titulo, url, orgao, acessado_em: hoje });
const metaAntiga = lerJson(path.join(DIR, 'meta.json')) || {};

// ---------- 0. robots.txt de todos os hosts antes de qualquer outra requisição ----------
for (const u of [PORTAL, 'https://ww4.al.rs.gov.br:5000', LEGIS, 'https://doe-backend.pro.rs.gov.br', 'https://www.diariooficial.rs.gov.br']) {
  await podeAcessar(u + '/');
}
for (const [o, r] of Object.entries(robotsRelatorio)) log(`robots ${o}: ${r.situacao}`);

// ---------- 1. deputados ----------
const mapaDeputados = new Map(); // nome normalizado → idDeputado do portal
let deputados = [];
await etapa('parlamentares', async () => {
  const resp = await obter(URL_DEPUTADOS);
  const lista = Array.isArray(resp) ? resp : resp?.lista;
  if (!Array.isArray(lista) || !lista.length) throw new Error('lista de deputados vazia ou em formato inesperado');
  const cont = new Map();
  for (const d of lista) { const k = normalizarNome(d.nomeDeputado); cont.set(k, (cont.get(k) || 0) + 1); }
  deputados = lista.map((d) => ({
    id: String(d.idDeputado),
    uf: 'RS', casa: 'alrs',
    nome: d.nomeDeputado,
    nome_civil: null,
    partido: d.siglaPartido || null,
    em_exercicio: true,
    foto: /^https:\/\/[a-z0-9.]+\.al\.rs\.gov\.br\//.test(d.fotoGrandeDeputado || '') ? d.fotoGrandeDeputado : null,
    url_oficial: `${PORTAL}/deputados/${d.idDeputado}`,
    email: /@al\.rs\.gov\.br$/i.test(d.emailDeputado || '') ? d.emailDeputado : null,
  })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  for (const d of deputados) if (cont.get(normalizarNome(d.nome)) === 1) mapaDeputados.set(normalizarNome(d.nome), d.id);
  log(`Deputados: ${deputados.length}`);
});

// ---------- 2. listas da busca ----------
const indices = new Map(); // ano → Map(id → item)
const carregarIndice = (ano) => {
  if (!indices.has(ano)) indices.set(ano, new Map((lerJson(path.join(DIR_PROP, `indice-${ano}.json`))?.itens || []).map((i) => [i.id, i])));
  return indices.get(ano);
};
const listasLidas = {};
const pendentes = [];
if (roda('proposicoes')) {
  const integrar = (p) => {
    const novo = itemDaBusca(p);
    const idx = carregarIndice(novo.ano);
    const ant = idx.get(novo.id);
    if (ant && ant.pagina_coletada_em && ant.assinatura_busca === novo.assinatura_busca) {
      // Sem mudança na tramitação: só reaplica a ementa/proponente da busca (regras de privacidade atuais).
      const lac = new Set((ant.lacunas || []).filter((l) => !/diretriz 12/.test(l)));
      for (const l of novo.lacunas) lac.add(l);
      idx.set(novo.id, { ...ant, ementa: novo.ementa, proponente: novo.proponente, lacunas: [...lac] });
      return;
    }
    // Mantém os dados de página já coletados até a releitura.
    idx.set(novo.id, ant ? { ...ant, ...novo, lacunas: ant.lacunas || novo.lacunas, pagina_desatualizada: !!ant.pagina_coletada_em } : novo);
    pendentes.push(novo.id);
  };
  for (const ano of ANOS_LISTA) {
    for (const sigla of TIPOS_POR_ANO) {
      await etapa(`busca ${sigla} ${ano}`, async () => {
        const t = Date.now();
        const lista = (await listar(sigla, ano)).filter(noPeriodo);
        for (const p of lista) integrar(p);
        listasLidas[`${sigla}-${ano}`] = lista.length;
        log(`Busca ${sigla} ${ano}: ${lista.length} no período (${((Date.now() - t) / 1000).toFixed(0)} s)`);
      });
    }
  }
}

// ---------- 3. páginas das proposições (votações) ----------
const idDeId = new Map();
for (const [ano, idx] of indices) for (const id of idx.keys()) idDeId.set(id, ano);
const ordenados = [...new Set(pendentes)].map((id) => indices.get(idDeId.get(id)).get(id))
  .sort((a, b) => b.ano - a.ano || String(b.data_situacao || '').localeCompare(String(a.data_situacao || '')));
const cont = { paginas_lidas: 0, votacoes_gravadas: 0, falhas_pagina: 0 };
const gravarIndicesProp = () => {
  for (const [ano, idx] of indices) {
    if (!idx.size) continue;
    const itens = [...idx.values()].sort((a, b) => a.sigla.localeCompare(b.sigla) || b.numero - a.numero);
    gravarSeMudou(path.join(DIR_PROP, `indice-${ano}.json`), {
      atualizado_em: hoje, uf: 'RS', casa: 'alrs', ano,
      fonte: fonte(`Proposições de ${ano} — busca do portal da ALRS`, urlBusca('PL', ano)),
      itens,
    });
  }
};
if (roda('proposicoes')) {
  log(`Páginas a ler: ${ordenados.length}`);
  for (let i = 0; i < ordenados.length; i += 10) {
    if (restanteMs() < RESERVA_NORMAS_MS) { log('Orçamento: páginas restantes ficam no cursor.'); break; }
    await paraCada(ordenados.slice(i, i + 10), async (item) => {
      try {
        const { prop, votacoes } = await lerProposicao(item, { hoje, mapaDeputados });
        delete prop.pagina_desatualizada;
        for (const v of votacoes) {
          const arq = path.join(DIR_VOT, `${v.id}.json`);
          const antigo = lerJson(arq);
          if (antigo) v.fonte.acessado_em = antigo.fonte?.acessado_em ?? v.fonte.acessado_em;
          gravarSeMudou(arq, v);
          cont.votacoes_gravadas++;
        }
        indices.get(item.ano).set(item.id, prop);
        cont.paginas_lidas++;
      } catch (e) {
        cont.falhas_pagina++;
        if (cont.falhas_pagina <= 20) falhas.push(`página ${item.url}: ${e.message}`);
      }
    });
    if ((i / 10) % 5 === 4) { gravarIndicesProp(); log(`  ${cont.paginas_lidas} páginas lidas`); }
  }
  gravarIndicesProp();
}
const pendentesRestantes = [];
for (const idx of indices.values()) for (const p of idx.values()) if (!p.pagina_coletada_em || p.pagina_desatualizada) pendentesRestantes.push(p.id);

// ---------- 4. normas (LEGIS) ----------
const contNormas = {};
let fichasPendentes = 0;
if (roda('normas')) {
  const idxNormas = new Map();
  const carregarN = (ano) => {
    if (!idxNormas.has(ano)) idxNormas.set(ano, new Map((lerJson(path.join(DIR_NORMAS, `indice-${ano}.json`))?.itens || []).map((i) => [i.id, i])));
    return idxNormas.get(ano);
  };
  for (const ano of ANOS) {
    for (const tipo of TIPOS_NORMA) {
      await etapa(`LEGIS ${tipo.sigla} ${ano}`, async () => {
        const linhas = await listarNormas(tipo, ano);
        const idx = carregarN(ano);
        const porIdFonte = new Map([...idx.values()].map((n) => [n.id_fonte, n]));
        const aLer = [];
        for (const l of linhas) {
          const ant = porIdFonte.get(l.id);
          if (ant?.ficha_lida) continue;
          aLer.push(l);
          if (!ant) { const n = montarNorma(tipo, l, null, { hoje }); idx.set(n.id, n); porIdFonte.set(l.id, n); }
        }
        // Mais recentes primeiro.
        aLer.sort((a, b) => String(b.data).localeCompare(String(a.data)));
        for (let i = 0; i < aLer.length; i += 6) {
          if (restanteMs() < 60000) break;
          await paraCada(aLer.slice(i, i + 6), async (l) => {
            const ficha = await lerFicha(l.id).catch((e) => { falhas.push(`ficha LEGIS ${l.id}: ${e.message}`); return null; });
            if (!ficha) return;
            const antigo = porIdFonte.get(l.id);
            const n = montarNorma(tipo, l, ficha, { hoje });
            if (antigo && antigo.id !== n.id) idx.delete(antigo.id);
            idx.set(n.id, manterDataColeta(n, antigo));
          });
        }
        log(`LEGIS ${tipo.sigla} ${ano}: ${linhas.length} normas`);
      });
    }
  }
  for (const [ano, idx] of idxNormas) {
    const itens = [...idx.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || b.numero - a.numero);
    fichasPendentes += itens.filter((n) => !n.ficha_lida).length;
    const porTipo = {};
    for (const n of itens) porTipo[n.tipo] = (porTipo[n.tipo] || 0) + 1;
    contNormas[ano] = { total: itens.length, por_tipo: porTipo, fichas_pendentes: itens.filter((n) => !n.ficha_lida).length };
    gravarSeMudou(path.join(DIR_NORMAS, `indice-${ano}.json`), {
      atualizado_em: hoje, uf: 'RS', casa: 'alrs', ano,
      abrangencia: 'Leis, leis complementares, emendas constitucionais e decretos do Estado do Rio Grande do Sul (Sistema LEGIS da ALRS)',
      fontes: [fonte('Sistema LEGIS — pesquisa de normas', `${LEGIS}/M0100008.ASP`)],
      itens,
    });
    // Liga norma → proposição nos índices de proposições.
    for (const n of itens) for (const o of n.projeto_origem || []) {
      const anoP = Number(o.identificacao.split('/')[1]);
      const ip = carregarIndice(anoP);
      const p = ip.get(o.proposicao_id);
      if (p) ip.set(p.id, { ...p, norma: { id: n.id, nome_oficial: n.nome_oficial, url: n.links.ficha_legis } });
    }
  }
  if (indices.size) gravarIndicesProp();
}

// ---------- 5. índices de votações e ligação deputado ↔ id do sistema de votação ----------
const contVot = {};
const idsVotacao = new Map(); // nome normalizado → Set(idParlamentar)
await etapa('índices de votações', async () => {
  if (!fs.existsSync(DIR_VOT)) return;
  const porAno = new Map();
  for (const f of fs.readdirSync(DIR_VOT)) {
    if (!f.endsWith('.json') || f.startsWith('indice-')) continue;
    const v = lerJson(path.join(DIR_VOT, f));
    if (!v?.data) continue;
    for (const x of v.votos || []) {
      const k = normalizarNome(x.nome);
      if (!idsVotacao.has(k)) idsVotacao.set(k, new Set());
      const idv = x.parlamentar_id_votacao ?? x.parlamentar_id;
      if (idv) idsVotacao.get(k).add(idv);
    }
    const ano = Number(v.data.slice(0, 4));
    if (!porAno.has(ano)) porAno.set(ano, []);
    porAno.get(ano).push({
      id: v.id, data: v.data, orgao: v.orgao, orgao_sigla: v.orgao_sigla, tipo: v.tipo,
      proposicao: { id: v.proposicao.id, sigla: v.proposicao.sigla, numero: v.proposicao.numero, ano: v.proposicao.ano },
      resultado: v.resultado, resultado_texto_oficial: v.resultado_texto_oficial, placar_oficial: v.placar_oficial,
      votos_publicados: v.votos.length, url: v.url, tem_lacunas: (v.lacunas || []).length > 0,
    });
  }
  for (const [ano, itens] of porAno) {
    itens.sort((a, b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id));
    contVot[ano] = {
      votacoes: itens.length, plenario: itens.filter((i) => i.orgao === 'Plenário').length,
      comissoes: itens.filter((i) => i.orgao !== 'Plenário').length,
      nominais: itens.filter((i) => i.tipo === 'nominal').length,
      votos: itens.reduce((s, i) => s + i.votos_publicados, 0),
    };
    gravarSeMudou(path.join(DIR_VOT, `indice-${ano}.json`), { atualizado_em: hoje, uf: 'RS', casa: 'alrs', ano, itens });
  }
});

if (deputados.length && roda('parlamentares')) {
  for (const d of deputados) {
    const ids = idsVotacao.get(normalizarNome(d.nome));
    d.ids_sistema_votacao = ids && ids.size ? [...ids].sort() : [];
  }
  gravarSeMudou(path.join(DIR, 'parlamentares.json'), {
    atualizado_em: hoje, uf: 'RS', casa: 'alrs',
    fonte: fonte('Deputados estaduais — portal da ALRS', URL_DEPUTADOS),
    itens: deputados,
  });
}

// ---------- 6. meta.json ----------
const agora = new Date().toISOString();
const contProp = {};
for (const [ano, idx] of indices) {
  if (!idx.size) continue;
  const porSigla = {};
  for (const p of idx.values()) porSigla[p.sigla] = (porSigla[p.sigla] || 0) + 1;
  contProp[ano] = { total: idx.size, por_sigla: porSigla, com_pagina_lida: [...idx.values()].filter((p) => p.pagina_coletada_em).length };
}
gravarSeMudou(path.join(DIR, 'meta.json'), {
  atualizado_em: agora,
  ultima_execucao: agora,
  uf: 'RS', casa: 'alrs',
  periodo: { anos: ANOS },
  modo: 'incremental',
  contagens: {
    parlamentares: deputados.length || (lerJson(path.join(DIR, 'parlamentares.json'))?.itens || []).length,
    proposicoes_por_ano: Object.keys(contProp).length ? contProp : metaAntiga.contagens?.proposicoes_por_ano,
    votacoes_por_ano: contVot,
    normas_por_ano: Object.keys(contNormas).length ? contNormas : metaAntiga.contagens?.normas_por_ano,
    nesta_execucao: { ...cont, listas: listasLidas, requisicoes: estatisticas.requisicoes, retentativas: estatisticas.retentativas },
  },
  cursor: {
    proposicoes_pendentes: roda('proposicoes') ? pendentesRestantes.length : metaAntiga.cursor?.proposicoes_pendentes ?? null,
    proposicoes_pendentes_amostra: roda('proposicoes') ? pendentesRestantes.slice(0, 20) : metaAntiga.cursor?.proposicoes_pendentes_amostra ?? [],
    fichas_legis_pendentes: roda('normas') ? fichasPendentes : metaAntiga.cursor?.fichas_legis_pendentes ?? null,
    criterio: 'Página relida quando a proposição é nova ou quando muda a data/descrição da situação, a linha do tempo ou o local na busca. Ficha do LEGIS lida uma vez por norma.',
  },
  robots: robotsRelatorio,
  fontes: [
    fonte('Pesquisa de proposições — portal da ALRS', `${PORTAL}/legislativo/pesquisa`),
    fonte('Página da proposição (votações, comissões, situação) — portal da ALRS', `${PORTAL}/proposicao/{SIGLA}/{numero}/{ano}`),
    fonte('Deputados — portal da ALRS', URL_DEPUTADOS),
    fonte('Sistema LEGIS — legislação estadual', `${LEGIS}/M0100008.ASP`),
  ],
  observacoes: [
    'Votos: reproduzidos como a ALRS registra ("Sim", "Não", "Favorável", "Contrário"…), com o partido informado em cada votação (partido na data do voto), sem conversão nem juízo.',
    'Plenário: placar = totais oficiais da página (resultados); comissões: placar null e placar_oficial com as opções da fonte.',
    'Conferência: a contagem dos votos individuais é comparada, opção por opção, com os totais oficiais da própria página; divergências ficam em lacunas.',
    'Tipo da votação: "nominal" quando há votos individuais; "simbolica" ou "secreta" só quando a fonte usa esses termos; caso contrário null com lacuna.',
    'parlamentar_id dos votos = id do deputado na lista do portal (parlamentares.json), ligado só por nome idêntico (sem acento/maiúsculas); sem correspondência, fica o id do sistema de votação. parlamentar_id_votacao guarda sempre o id do sistema de votação da ALRS.',
    'Texto e justificativa dos projetos: links temporários assinados (expiram em minutos); não são guardados. A fonte citada é a página da proposição.',
    'Vetos (VT/VP) têm o número e o ano do projeto vetado e ficam no índice desse ano.',
    'DOE-RS: doe-backend.pro.rs.gov.br/robots.txt responde HTTP 500; pela RFC 9309 é tratado como bloqueio total e o DOE não é acessado. A publicação vem da ficha do LEGIS (edição, data e página), com link para o DOE.',
    'Ementas e proponentes: nomes de particulares substituídos por "[nome de particular omitido]" quando identificados por regra conservadora (diretriz 12); sem CPF, RG ou telefone.',
    ...(falhas.length ? [`Falhas nesta execução: ${falhas.slice(0, 30).join(' | ')}`] : []),
  ],
});

log(`Fim. Requisições: ${estatisticas.requisicoes} (retentativas ${estatisticas.retentativas}), ${(estatisticas.bytes / 1e6).toFixed(1)} MB. `
  + `Páginas: ${cont.paginas_lidas}, votações: ${cont.votacoes_gravadas}, pendentes: ${pendentesRestantes.length}. `
  + `Arquivos gravados: ${contagemGravacao.gravados}, inalterados: ${contagemGravacao.inalterados}.`);
if (falhas.length) { console.error('Falhas:\n- ' + falhas.slice(0, 50).join('\n- ')); process.exit(1); }
