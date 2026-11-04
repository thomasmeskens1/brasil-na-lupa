#!/usr/bin/env node
/**
 * Registro dos municípios e das Câmaras Municipais com SAPL 3 (Interlegis). Node 20+, sem dependências.
 *
 * USO
 *   node scripts/coleta/municipios/registro.mjs                         # atualiza listas + verifica a próxima amostra
 *   node scripts/coleta/municipios/registro.mjs --amostra capitais,sp   # grupos da amostra (padrão: capitais,sp)
 *   node scripts/coleta/municipios/registro.mjs --max 40                # hosts verificados nesta execução (padrão 40)
 *   node scripts/coleta/municipios/registro.mjs --sem-verificar         # só as listas oficiais
 *   COLETA_ORCAMENTO_MIN=20 (padrão) — nenhuma requisição começa depois disso
 *
 * FONTES OFICIAIS
 *   1. Siconfi/Tesouro Nacional — /ords/siconfi/tt/entes: os 5.570 municípios (código IBGE, nome, UF, capital, população)
 *      → dados/municipios/entes.json
 *   2. Interlegis/Senado (SIGI) — /api/servicos/?tipo_servico=SAPL: Casas Legislativas com SAPL instalado
 *      → dados/municipios/registro.json (só Câmaras Municipais; ligadas ao município pelo nome e UF)
 *   3. Verificação de uma amostra (nunca o país inteiro numa execução): em cada host, robots.txt primeiro;
 *      depois, respeitando o Crawl-delay desde a 1ª requisição, três consultas de 1 registro à API
 *      (votoparlamentar, materialegislativa, normajuridica) para saber se a API responde e o total publicado.
 *      Hosts diferentes rodam em paralelo (no máximo 12 ao mesmo tempo), cada um com seu relógio.
 *
 * Sem e-mail, telefone ou endereço das Casas no registro (não são necessários ao site).
 */
import path from 'node:path';
import { ClienteEducado, permitido, DIR_MUNICIPIOS, gravarSeMudou, hojeISO, lerJson, slugCidade, chaveNome } from './lib.mjs';

const SICONFI = 'https://apidatalake.tesouro.gov.br';
const SIGI = 'https://sigi.interlegis.leg.br';
const PARALELO = 12;

export const CONSULTAS = {
  votoparlamentar: '/api/sessao/votoparlamentar/?page=1&page_size=1',
  materialegislativa: '/api/materia/materialegislativa/?page=1&page_size=1',
  normajuridica: '/api/norma/normajuridica/?page=1&page_size=1',
};

/** Linhas compactas dos entes municipais do Siconfi. */
export function entesMunicipais(itens) {
  const lista = (itens || []).filter((e) => e.esfera === 'M' && Number.isFinite(e.cod_ibge) && e.ente && e.uf);
  const usados = new Map();
  const out = lista.map((e) => {
    const uf = String(e.uf).toLowerCase();
    let slug = slugCidade(e.ente);
    const k = `${uf}/${slug}`;
    usados.set(k, (usados.get(k) || 0) + 1);
    return { cod_ibge: e.cod_ibge, nome: e.ente, uf, slug, capital: String(e.capital).trim() === '1', populacao: Number.isFinite(e.populacao) ? e.populacao : null, exercicio_populacao: e.exercicio ?? null };
  });
  // Nome repetido na mesma UF (não esperado): o endereço ganha o código IBGE, sem deduzir nada.
  for (const e of out) if (usados.get(`${e.uf}/${e.slug}`) > 1) e.slug = `${e.slug}-${e.cod_ibge}`;
  out.sort((a, b) => a.uf.localeCompare(b.uf) || a.nome.localeCompare(b.nome, 'pt-BR'));
  return out;
}

/** Host do SAPL a partir da URL informada pelo Interlegis (só https://sapl.<...>.leg.br ou outro host válido). */
export function hostDaUrl(url) {
  try {
    const u = new URL(String(url).trim());
    if (!/^https?:$/.test(u.protocol) || !/^[a-z0-9.-]+$/i.test(u.hostname)) return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Liga cada serviço SAPL do Interlegis a um município (nome + UF idênticos, sem acento/hífen). */
export function montarRegistro(servicos, entes, anterior = {}) {
  const porChave = new Map(entes.map((e) => [`${e.uf}|${chaveNome(e.nome)}`, e]));
  const antes = new Map((anterior.camaras || []).map((c) => [c.host, c]));
  const camaras = [];
  const sem_municipio = [];
  const vistos = new Set();
  for (const s of servicos) {
    const c = s.casa_legislativa || {};
    if (c.tipo_orgao_sigla !== 'CM') continue; // só Câmaras Municipais
    const host = hostDaUrl(s.url);
    if (!host || vistos.has(host)) continue;
    vistos.add(host);
    const uf = String(c.uf || '').toLowerCase();
    const e = porChave.get(`${uf}|${chaveNome(c.municipio)}`);
    if (!e) { sem_municipio.push({ casa: c.nome || null, municipio: c.municipio || null, uf: uf.toUpperCase(), host }); continue; }
    const velho = antes.get(host);
    camaras.push({
      cod_ibge: e.cod_ibge, municipio: e.nome, uf: e.uf, slug: e.slug,
      casa: c.nome || null, host, url: `https://${host}/`,
      hospedagem_interlegis: typeof s.hospedagem_interlegis === 'boolean' ? s.hospedagem_interlegis : null,
      data_ativacao: s.data_ativacao || null,
      verificacao: velho?.verificacao || null,
    });
  }
  camaras.sort((a, b) => a.uf.localeCompare(b.uf) || a.municipio.localeCompare(b.municipio, 'pt-BR') || a.host.localeCompare(b.host));
  return { camaras, sem_municipio };
}

/** Próximos hosts da amostra: nunca verificados primeiro, depois os mais antigos (> 30 dias). */
export function escolherAmostra(camaras, entes, grupos, max, hoje) {
  const capitais = new Set(entes.filter((e) => e.capital).map((e) => e.cod_ibge));
  const noGrupo = (c) => grupos.some((g) => (g === 'capitais' ? capitais.has(c.cod_ibge) : g === 'todas' ? true : c.uf === g));
  const limite = new Date(`${hoje}T12:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() - 30);
  const vencida = (c) => !c.verificacao || String(c.verificacao.em || '') < limite.toISOString().slice(0, 10);
  return camaras.filter((c) => noGrupo(c) && vencida(c))
    .sort((a, b) => Number(Boolean(a.verificacao)) - Number(Boolean(b.verificacao))
      || Number(capitais.has(b.cod_ibge)) - Number(capitais.has(a.cod_ibge))
      || String(a.verificacao?.em || '').localeCompare(String(b.verificacao?.em || ''))
      || a.municipio.localeCompare(b.municipio, 'pt-BR'))
    .slice(0, max);
}

/** Verifica um host: robots.txt e três consultas mínimas à API, no intervalo do host. */
export async function verificarHost(c, { prazoMs, hoje, fetchImpl, dormirImpl, agora, log = () => {} }) {
  const cli = new ClienteEducado(`https://${c.host}`, { intervaloMs: 61000, prazoMs, fetchImpl, dormirImpl, agora, log });
  const v = { em: hoje, robots: null, api_permitida: null, api_responde: null, totais: {}, votos_nominais_publicados: null, erros: [] };
  try {
    v.robots = await cli.lerRobots();
  } catch (e) {
    v.erros.push(`robots.txt: ${e.message}`);
    return v;
  }
  v.api_permitida = Object.values(CONSULTAS).every((q) => permitido(cli.regras, q));
  if (!v.api_permitida) return v;
  for (const [nome, q] of Object.entries(CONSULTAS)) {
    if (!cli.cabe(90000)) { v.erros.push(`${nome}: orçamento acabou antes da consulta`); break; }
    try {
      const d = await cli.json(q);
      const total = d?.pagination?.total_entries;
      if (d && (Array.isArray(d.results) || Number.isFinite(total))) {
        v.api_responde = true;
        v.totais[nome] = Number.isFinite(total) ? total : null;
      } else if (v.api_responde == null) v.api_responde = false;
    } catch (e) {
      v.erros.push(`${nome}: ${e.message}`);
      if (v.api_responde == null && /JSON/.test(e.message)) v.api_responde = false;
    }
  }
  if (Number.isFinite(v.totais.votoparlamentar)) v.votos_nominais_publicados = v.totais.votoparlamentar > 0;
  log(`${c.host}: robots ${v.robots?.status}, API ${v.api_responde ? 'responde' : 'não respondeu'}; ${JSON.stringify(v.totais)}`);
  return v;
}

async function lerSigi(log, prazoMs) {
  const cli = new ClienteEducado(SIGI, { intervaloMs: 3000, prazoMs, log });
  await cli.lerRobots();
  const lista = [];
  let total = null;
  for (let p = 1; p <= 20; p++) {
    const d = await cli.json(`/api/servicos/?tipo_servico=SAPL&page=${p}&page_size=500`);
    lista.push(...(d?.results || []));
    total = d?.count ?? total;
    if (!d?.next) break;
  }
  log(`Interlegis: ${lista.length} serviços SAPL (total informado ${total})`);
  return { lista, total, robots: cli.robots };
}

async function lerEntes(log, prazoMs) {
  const cli = new ClienteEducado(SICONFI, { intervaloMs: 1500, prazoMs, log });
  await cli.lerRobots();
  const d = await cli.json('/ords/siconfi/tt/entes');
  if (d?.hasMore) throw new Error('lista de entes paginada: ajustar o coletor');
  log(`Siconfi: ${d?.items?.length ?? 0} entes`);
  return { itens: d?.items || [], robots: cli.robots };
}

async function main() {
  const args = process.argv.slice(2);
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const grupos = (val('--amostra') || 'capitais,sp').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  const max = Math.max(0, Number(val('--max') ?? 40));
  const semVerificar = args.includes('--sem-verificar');
  const orcamentoMin = Number(process.env.COLETA_ORCAMENTO_MIN || 20);
  const inicio = Date.now();
  const prazoMs = inicio + orcamentoMin * 60000;
  const log = (...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(0)}s]`, ...m);
  const hoje = hojeISO();

  const arqEntes = path.join(DIR_MUNICIPIOS, 'entes.json');
  const arqReg = path.join(DIR_MUNICIPIOS, 'registro.json');
  const anterior = lerJson(arqReg) || {};

  const en = await lerEntes(log, prazoMs);
  const entes = entesMunicipais(en.itens);
  if (entes.length < 5000) throw new Error(`lista de municípios incompleta (${entes.length}); nada gravado`);
  gravarSeMudou(arqEntes, {
    atualizado_em: hoje,
    fonte: { titulo: 'Entes da Federação — API de dados abertos do Siconfi', url: `${SICONFI}/ords/siconfi/tt/entes`, orgao: 'Tesouro Nacional', acessado_em: hoje },
    robots: { [new URL(SICONFI).host]: en.robots },
    observacao: 'Municípios cadastrados no Siconfi (Sistema de Informações Contábeis e Fiscais do Setor Público Brasileiro). População: a informada pelo Siconfi para o exercício indicado.',
    campos: ['cod_ibge', 'nome', 'uf', 'slug', 'capital', 'populacao'],
    itens: entes.map((e) => [e.cod_ibge, e.nome, e.uf, e.slug, e.capital ? 1 : 0, e.populacao]),
    exercicio_populacao: entes[0]?.exercicio_populacao ?? null,
  });

  const sg = await lerSigi(log, prazoMs);
  const { camaras, sem_municipio } = montarRegistro(sg.lista, entes, anterior);
  const reg = {
    atualizado_em: hoje,
    fontes: [
      { titulo: 'Serviços prestados pelo Interlegis às Casas Legislativas (SAPL) — API de dados abertos do SIGI', url: `${SIGI}/api/servicos/?tipo_servico=SAPL`, orgao: 'Senado Federal — Secretaria Especial do Interlegis', acessado_em: hoje },
      { titulo: 'Entes da Federação — API de dados abertos do Siconfi', url: `${SICONFI}/ords/siconfi/tt/entes`, orgao: 'Tesouro Nacional', acessado_em: hoje },
    ],
    robots: { [new URL(SIGI).host]: sg.robots },
    total_servicos_sapl_informado: sg.total,
    criterio: 'Câmaras Municipais com o serviço SAPL registrado pelo Interlegis, ligadas ao município do Siconfi pelo nome e pela UF (sem acento e sem hífen). Casas sem município correspondente ficam em "sem_municipio", sem correção manual.',
    verificacao_criterio: 'Verificação por amostra: robots.txt lido antes de qualquer outra requisição; a seguir, uma consulta de 1 registro a cada rota (votos por parlamentar, matérias e normas), respeitando o Crawl-delay. "api_responde" só é verdadeiro quando a resposta é o JSON da API do SAPL.',
    camaras,
    sem_municipio,
  };

  if (!semVerificar && max > 0) {
    const amostra = escolherAmostra(camaras, entes, grupos, max, hoje);
    log(`verificando ${amostra.length} hosts (grupos: ${grupos.join(', ')})`);
    const fila = [...amostra];
    const trabalhar = async () => {
      while (fila.length) {
        const c = fila.shift();
        c.verificacao = await verificarHost(c, { prazoMs, hoje, log });
        gravarSeMudou(arqReg, reg);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALELO, fila.length) }, trabalhar));
  }
  const verif = camaras.filter((c) => c.verificacao);
  reg.resumo = {
    camaras_com_sapl: camaras.length,
    verificadas: verif.length,
    api_responde: verif.filter((c) => c.verificacao.api_responde).length,
    com_votos_nominais: verif.filter((c) => c.verificacao.votos_nominais_publicados).length,
  };
  gravarSeMudou(arqReg, reg);
  log(`registro: ${JSON.stringify(reg.resumo)}; sem município correspondente: ${sem_municipio.length}`);
}

if (process.argv[1] && /registro.mjs$/.test(process.argv[1])) {
  main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
}
