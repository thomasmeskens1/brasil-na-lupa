/**
 * Presença em Plenário da Câmara dos Deputados → dados/camara/presenca/<ano>.json
 *
 * FONTES (todas oficiais, da Câmara dos Deputados):
 *  1. Arquivo anual eventos-<ano>.csv (dados abertos): quais eventos são "Sessão Deliberativa" encerrada
 *     → quantidade de sessões deliberativas do ano e os dias em que houve sessão.
 *  2. Arquivo anual eventosPresencaDeputados-<ano>.csv (dados abertos): quem teve presença registrada em
 *     cada evento. Só traz presenças — não traz ausências nem justificativas.
 *  3. Serviço de dados abertos SitCamaraWS ListarPresencasDia (um pedido por dia de sessão): para cada
 *     deputado em exercício no dia, a frequência no dia ("Presença", "Ausência", "Ausência justificada")
 *     e a frequência em cada sessão. É a mesma base do "Relatório de presença em plenário" da página do
 *     deputado. A justificativa (texto) NÃO é guardada; só a contagem.
 *  4. SitCamaraWS Deputados.asmx/ObterDeputados + coluna nuCarteiraParlamentar da CEAP: ligam o número de
 *     carteira parlamentar (usado pelo serviço 3) ao id do deputado na API v2.
 *
 * CACHE: dados/camara/presenca/dias-<ano>.json guarda o resultado de cada dia já consultado (só
 * contagens, sem justificativa). Na rotina diária só se consultam dias novos e os dos últimos
 * JANELA_DIAS dias (justificativas podem ser registradas depois); uma vez por semana (ou com
 * --completo / --forcar-download) todos os dias do ano são consultados de novo.
 */
import path from 'node:path';
import fs from 'node:fs';
import {
  obter, obterArquivo, paraCada, percorrerCsv, lerJson, gravarSeMudou, somarDias,
} from './lib.mjs';

const ARQ = 'https://dadosabertos.camara.leg.br/arquivos';
const WS = 'https://www.camara.leg.br/SitCamaraWS';
const JANELA_DIAS = 15;
const DIAS_REVISAO_COMPLETA = 7;

export const DEFINICOES_PRESENCA = {
  sessoes_deliberativas: 'Eventos do tipo "Sessão Deliberativa" com situação "Encerrada" no arquivo oficial de eventos do ano (inclui sessões conjuntas do Congresso Nacional registradas pela Câmara). Corresponde ao "Total de sessões deliberativas com Ordem do Dia iniciada, na Sessão Legislativa" do relatório oficial (Ato da Mesa n. 191 de 2017).',
  dias_com_sessoes_deliberativas: 'Dias distintos com ao menos uma sessão deliberativa (mesmo arquivo). Corresponde ao "Total de dias com sessões deliberativas realizadas no período" do relatório oficial.',
  dias_com_sessao: 'Dias de sessão deliberativa em que o deputado aparece no serviço oficial de frequência (ListarPresencasDia), ou seja, dias em que estava no exercício do mandato. O relatório oficial considera só o "período de exercício no mandato do parlamentar".',
  dias_presenca: 'Dias com frequência no dia registrada como "Presença" pela Câmara. Relatório oficial: "Total de dias com presença nas sessões deliberativas". A ajuda da página oficial diz: "Presenças marcadas em sessões presenciais ou remotas".',
  dias_ausencia_justificada: 'Dias com frequência no dia registrada como "Ausência justificada". Relatório oficial: "Total de dias com ausências justificadas em sessões deliberativas".',
  dias_ausencia_nao_justificada: 'Dias com frequência no dia registrada como "Ausência" (sem justificativa). Relatório oficial: "Total de dias com ausências não justificadas em sessões deliberativas".',
  dias_outra_frequencia: 'Dias com outro valor de frequência no dia, contados por valor literal da fonte (vazio quando não houver).',
  sessoes_registradas: 'Sessões listadas para o deputado no serviço de frequência, somando todos os dias.',
  sessoes_presenca: 'Sessões com frequência "Presença" no serviço de frequência.',
  sessoes_ausencia: 'Sessões com frequência "Ausência" no serviço de frequência (a justificativa, quando há, é registrada por dia, não por sessão).',
  presencas_registradas_dados_abertos: 'Sessões deliberativas (arquivo de eventos) em que o deputado consta no arquivo oficial eventosPresencaDeputados. Esse arquivo só registra presenças.',
};

const isoDeBr = (s) => { const m = /^(\d\d)\/(\d\d)\/(\d{4})/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const brDeIso = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const tag = (xml, nome) => { const m = new RegExp(`<${nome}>([^<]*)</${nome}>`).exec(xml); return m ? m[1].trim() : null; };

/** Lê um dia do serviço ListarPresencasDia → { sessoes, registros: [[carteira, nome, freqDia, nSes, nPres, nAus]] }. */
function lerDia(xml) {
  const registros = [];
  for (const m of xml.matchAll(/<parlamentar>([\s\S]*?)<\/parlamentar>/g)) {
    const b = m[1];
    const freqs = [...b.matchAll(/<frequencia>([^<]*)<\/frequencia>/g)].map((x) => x[1].trim());
    registros.push([
      tag(b, 'carteiraParlamentar'), tag(b, 'nomeParlamentar'), tag(b, 'descricaoFrequenciaDia') || '',
      freqs.length, freqs.filter((f) => f === 'Presença').length, freqs.filter((f) => f === 'Ausência').length,
    ]);
  }
  registros.sort((a, b) => Number(a[0]) - Number(b[0]));
  return { sessoes: Number(tag(xml, 'qtdeSessoesDia')) || 0, registros };
}

export async function coletarPresenca({ ano, hoje, dir, arquivosMeta, forcar, completo, carteirasCeap, log, fonte }) {
  const uEv = `${ARQ}/eventos/csv/eventos-${ano}.csv`;
  const uPres = `${ARQ}/eventosPresencaDeputados/csv/eventosPresencaDeputados-${ano}.csv`;
  const uDep = `${WS}/Deputados.asmx/ObterDeputados`;
  const uDia = `${WS}/sessoesreunioes.asmx/ListarPresencasDia`;
  const arqSaida = path.join(dir, `${ano}.json`);
  const arqCache = path.join(dir, `dias-${ano}.json`);
  const cache = lerJson(arqCache) || { dias: {}, carteiras: {} };
  const revisaoVencida = !cache.revisao_completa_em || cache.revisao_completa_em <= somarDias(hoje, -DIAS_REVISAO_COMPLETA);
  const revisarTudo = completo || forcar || revisaoVencida;

  // Download condicional; sem cache local do conteúdo, o 304 não serve e o arquivo é baixado inteiro.
  const [ev, pres] = await Promise.all([
    obterArquivo(uEv, { anterior: forcar || !cache.sessoes ? null : arquivosMeta[uEv] }),
    obterArquivo(uPres, { anterior: forcar || !cache.presencas_bulk ? null : arquivosMeta[uPres] }),
  ]);
  const novos = {};
  for (const [u, r] of [[uEv, ev], [uPres, pres]]) {
    if (!r.naoMudou) novos[u] = { etag: r.etag, last_modified: r.last_modified, sha256: r.sha256, baixado_em: hoje };
  }
  const igual = (u, r) => r.naoMudou || (arquivosMeta[u]?.sha256 === r.sha256);
  if (igual(uEv, ev) && igual(uPres, pres) && !revisarTudo && fs.existsSync(arqSaida) && cache.sessoes) {
    log(`presença ${ano}: arquivos em massa sem mudança; nada a fazer`);
    return { pulado: true, arquivos: novos, resumo: lerJson(arqSaida)?.totais || null, urls: [uEv, uPres, uDia] };
  }

  // 1) Sessões deliberativas do ano (arquivo de eventos). Com 304, usa a lista guardada no cache.
  let sessoes = cache.sessoes || [];
  if (!ev.naoMudou) {
    sessoes = [];
    percorrerCsv(ev.buf.toString('utf8').replace(/^﻿/, ''), (c, i) => {
      if (c[i.descricaoTipo] === 'Sessão Deliberativa' && /^Encerrada/.test(c[i.situacao])) {
        sessoes.push({ id: c[i.id], data: c[i.dataHoraInicio].slice(0, 10), descricao: c[i.descricao].split('\n')[0].slice(0, 200) });
      }
    });
    sessoes.sort((a, b) => a.data.localeCompare(b.data) || Number(a.id) - Number(b.id));
  }
  const idsSessao = new Set(sessoes.map((s) => s.id));
  const diasSessao = [...new Set(sessoes.map((s) => s.data))].filter((d) => d <= hoje).sort();

  // 2) Presenças registradas no arquivo em massa (só presenças).
  let presencasBulk = cache.presencas_bulk || {};
  let sessoesComLista = cache.sessoes_com_lista ?? null;
  if (!pres.naoMudou) {
    presencasBulk = {};
    const comLista = new Set();
    percorrerCsv(pres.buf.toString('utf8').replace(/^﻿/, ''), (c, i) => {
      if (!idsSessao.has(c[i.idEvento])) return;
      comLista.add(c[i.idEvento]);
      presencasBulk[c[i.idDeputado]] = (presencasBulk[c[i.idDeputado]] || 0) + 1;
    });
    sessoesComLista = comLista.size;
  }

  // 3) Carteira parlamentar → id (ObterDeputados + CEAP do ano + o que já estava no cache).
  const carteiras = { ...cache.carteiras };
  for (const [k, v] of carteirasCeap || []) carteiras[k] = v;
  if (ano === Number(hoje.slice(0, 4))) {
    const xml = await obter(uDep, { tipo: 'text', opcional: true });
    for (const m of (xml || '').matchAll(/<ideCadastro>(\d+)<\/ideCadastro>[\s\S]*?<matricula>(\d+)<\/matricula>/g)) carteiras[m[2]] = m[1];
  }

  // 4) Frequência por dia (serviço oficial), com cache.
  const limiteJanela = somarDias(hoje, -JANELA_DIAS);
  const aConsultar = diasSessao.filter((d) => revisarTudo || !cache.dias[d] || d >= limiteJanela);
  log(`presença ${ano}: ${sessoes.length} sessões deliberativas em ${diasSessao.length} dias; consultando ${aConsultar.length} dia(s) no serviço de frequência…`);
  await paraCada(aConsultar, async (d) => {
    const xml = await obter(`${uDia}?data=${brDeIso(d)}&numMatriculaParlamentar=&siglaPartido=&siglaUF=`, { tipo: 'text', timeoutMs: 180000 });
    const dia = lerDia(xml);
    const dataFonte = isoDeBr(tag(xml, 'data'));
    if (dataFonte && dataFonte !== d) throw new Error(`Serviço de frequência devolveu ${dataFonte} para ${d}`);
    cache.dias[d] = { consultado_em: hoje, ...dia };
  });
  for (const d of Object.keys(cache.dias)) if (!diasSessao.includes(d)) delete cache.dias[d];

  // 5) Totais por deputado.
  const porCarteira = new Map();
  const diasSemRegistro = [];
  for (const d of diasSessao) {
    const dia = cache.dias[d];
    if (!dia?.registros.length) { diasSemRegistro.push(d); continue; }
    for (const [cart, nome, fd, nSes, nPres, nAus] of dia.registros) {
      if (!porCarteira.has(cart)) porCarteira.set(cart, {
        carteira: cart, nome_na_fonte: nome, dias_com_sessao: 0, dias_presenca: 0, dias_ausencia_justificada: 0,
        dias_ausencia_nao_justificada: 0, dias_outra_frequencia: {}, sessoes_registradas: 0, sessoes_presenca: 0, sessoes_ausencia: 0,
        primeiro_dia: d, ultimo_dia: d,
      });
      const p = porCarteira.get(cart);
      p.nome_na_fonte = nome; p.ultimo_dia = d; p.dias_com_sessao++;
      if (fd === 'Presença') p.dias_presenca++;
      else if (fd === 'Ausência justificada') p.dias_ausencia_justificada++;
      else if (fd === 'Ausência') p.dias_ausencia_nao_justificada++;
      else p.dias_outra_frequencia[fd] = (p.dias_outra_frequencia[fd] || 0) + 1;
      p.sessoes_registradas += nSes; p.sessoes_presenca += nPres; p.sessoes_ausencia += nAus;
    }
  }
  const semId = [];
  const itens = [...porCarteira.values()].map((p) => {
    const id = carteiras[p.carteira] || null;
    if (!id) semId.push(`${p.nome_na_fonte} (carteira ${p.carteira})`);
    return {
      parlamentar_id: id, nome_na_fonte: p.nome_na_fonte, carteira_parlamentar: p.carteira,
      dias_com_sessao: p.dias_com_sessao, dias_presenca: p.dias_presenca, dias_ausencia_justificada: p.dias_ausencia_justificada,
      dias_ausencia_nao_justificada: p.dias_ausencia_nao_justificada, dias_outra_frequencia: p.dias_outra_frequencia,
      sessoes_registradas: p.sessoes_registradas, sessoes_presenca: p.sessoes_presenca, sessoes_ausencia: p.sessoes_ausencia,
      presencas_registradas_dados_abertos: id ? presencasBulk[id] || 0 : null,
      periodo_na_fonte: { inicio: p.primeiro_dia, fim: p.ultimo_dia },
    };
  }).sort((a, b) => a.nome_na_fonte.localeCompare(b.nome_na_fonte, 'pt-BR', { sensitivity: 'base' }));

  const lacunas = [
    'As justificativas das ausências não são guardadas (só a contagem por categoria oficial).',
    'O serviço de frequência não lista dias que só tiveram sessão conjunta do Congresso Nacional; o relatório da página do deputado conta esses dias. Por isso "dias_com_sessao" e "dias_presenca" podem ficar abaixo do relatório oficial nesses casos.',
    'O arquivo eventosPresencaDeputados registra só presenças; ausências e justificativas vêm do serviço de frequência.',
  ];
  if (diasSemRegistro.length) lacunas.push(`Dias com sessão deliberativa no arquivo de eventos sem nenhum registro no serviço de frequência: ${diasSemRegistro.join(', ')}.`);
  if (semId.length) lacunas.push(`Sem id na API para: ${semId.join('; ')} (carteira parlamentar não encontrada em ObterDeputados nem na CEAP do ano).`);

  const totais = {
    deputados: itens.length, sessoes_deliberativas: sessoes.length, dias_com_sessoes_deliberativas: diasSessao.length,
    sessoes_com_lista_de_presenca_no_arquivo: sessoesComLista, dias_consultados_no_servico: diasSessao.length - diasSemRegistro.length,
  };
  gravarSeMudou(arqSaida, {
    atualizado_em: hoje, ano, casa: 'camara',
    abrangencia: 'Sessões deliberativas do Plenário da Câmara dos Deputados no ano, por deputado em exercício.',
    totais, definicoes: DEFINICOES_PRESENCA,
    fonte: fonte(`Frequência em Plenário ${ano} — SitCamaraWS ListarPresencasDia (Câmara dos Deputados)`, `${uDia}?data=DD/MM/${ano}`),
    fontes_complementares: [
      fonte(`Eventos ${ano} — Dados Abertos da Câmara dos Deputados`, uEv),
      fonte(`Presença em eventos ${ano} — Dados Abertos da Câmara dos Deputados`, uPres),
      fonte('Deputados em exercício (carteira parlamentar) — SitCamaraWS', uDep),
    ],
    lacunas, itens,
  });
  if (revisarTudo) cache.revisao_completa_em = hoje;
  gravarSeMudou(arqCache, {
    atualizado_em: hoje, ano, revisao_completa_em: cache.revisao_completa_em || null,
    _descricao: 'Cache do coletor: resultado por dia do serviço ListarPresencasDia (registros = [carteira, nome na fonte, frequência no dia, sessões, sessões com presença, sessões com ausência]). Sem justificativas.',
    sessoes, sessoes_com_lista: sessoesComLista, presencas_bulk: presencasBulk, carteiras,
    dias: Object.fromEntries(Object.keys(cache.dias).sort().map((d) => [d, cache.dias[d]])),
  });
  return { pulado: false, arquivos: novos, resumo: totais, urls: [uEv, uPres, uDia, uDep] };
}
