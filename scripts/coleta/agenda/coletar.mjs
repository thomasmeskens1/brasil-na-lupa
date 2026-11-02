#!/usr/bin/env node
// Coletor de AGENDA E PAUTA do Plenário da Câmara dos Deputados e do Senado Federal
// (inclui as sessões do Congresso Nacional publicadas pelo Senado).
//
// Gera:
//   dados/agenda/sessoes.json              sessões dos últimos 60 dias e dos próximos 30 dias
//   dados/agenda/pautas/<casa>-<data>.json pauta oficial de cada dia de sessão, com o desfecho de cada item
//   dados/agenda/meta.json                 data da coleta, fontes, contagens e observações
//
// Uso: node scripts/coleta/agenda/coletar.mjs [--hoje=AAAA-MM-DD] [--dias-antes=60] [--dias-depois=30]
// Rode depois dos coletores da Câmara e do Senado: o número de votações por dia é cruzado com
// dados/camara/votacoes e dados/senado/votacoes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estatisticas, gravarSeMudou, lerJson, hojeISO, somarDias, contagemGravacao } from './lib.mjs';
import { coletarCamara, API as API_CAMARA } from './camara.mjs';
import { coletarSenado, API as API_SENADO } from './senado.mjs';
import { REGRAS_DESFECHO } from './desfecho.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SAIDA = path.join(RAIZ, 'dados/agenda');
const PAUTAS = path.join(SAIDA, 'pautas');

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const hoje = /^\d{4}-\d{2}-\d{2}$/.test(args.hoje || '') ? args.hoje : hojeISO();
const diasAntes = Math.min(Math.max(Number(args['dias-antes'] ?? 60) || 60, 1), 365);
const diasDepois = Math.min(Math.max(Number(args['dias-depois'] ?? 30) || 30, 1), 120);
const inicio = somarDias(hoje, -diasAntes);
const fim = somarDias(hoje, diasDepois);
const agora = new Date().toISOString();
const acessado_em = hojeISO();

/** Lê os arquivos de votação já coletados (só os campos usados no cruzamento). */
function lerVotacoesLocais() {
  const camaraPorDia = {}, senadoPorDia = {}, camaraPorEvento = new Map(), senadoPorSessaoMateria = new Map();
  const ler = (dir, fn) => {
    const d = path.join(RAIZ, dir);
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d)) if (f.endsWith('.json')) { const j = lerJson(path.join(d, f)); if (j) fn(j); }
  };
  ler('dados/camara/votacoes', (v) => {
    if (v.orgao_sigla !== 'PLEN' || !v.data) return;
    camaraPorDia[v.data] = (camaraPorDia[v.data] || 0) + 1;
    const ev = /evento-legislativo\/(\d+)/.exec(v.url || '')?.[1];
    if (ev) camaraPorEvento.set(ev, [...(camaraPorEvento.get(ev) || []), v.id]);
  });
  ler('dados/senado/votacoes', (v) => {
    if (!v.data) return;
    senadoPorDia[v.data] = (senadoPorDia[v.data] || 0) + 1;
    const k = `${v.sessao?.codigo}|${v.proposicao?.codigo_materia}`;
    senadoPorSessaoMateria.set(k, [...(senadoPorSessaoMateria.get(k) || []), String(v.id)].sort());
  });
  return { camaraPorDia, senadoPorDia, camaraPorEvento, senadoPorSessaoMateria };
}

const ordemSessao = (a, b) => (a.data || '').localeCompare(b.data || '') || (a.hora || '').localeCompare(b.hora || '')
  || a.casa.localeCompare(b.casa) || a.codigo_oficial.localeCompare(b.codigo_oficial, 'pt', { numeric: true });

async function main() {
  console.log(`Agenda do Plenário: ${inicio} a ${fim} (referência ${hoje})`);
  const locais = lerVotacoesLocais();
  const anterior = lerJson(path.join(SAIDA, 'sessoes.json'));
  const falhas = [];

  const [cam, sen] = await Promise.allSettled([
    coletarCamara(inicio, fim, acessado_em),
    coletarSenado(inicio, fim, acessado_em, locais.senadoPorSessaoMateria),
  ]);

  let sessoes = [];
  const pautas = new Map();
  const casasMantidas = [];
  for (const [nome, r, casas] of [['Câmara', cam, ['camara']], ['Senado', sen, ['senado', 'congresso']]]) {
    if (r.status === 'fulfilled') {
      sessoes.push(...r.value.sessoes);
      for (const [k, v] of r.value.pautas) pautas.set(k, v);
      falhas.push(...r.value.falhas.map((f) => `${nome}: ${f}`));
    } else {
      // Fonte fora do ar: mantém as sessões já publicadas dessa casa, sem apagar nada.
      falhas.push(`${nome}: coleta não concluída (${r.reason?.message || r.reason}); mantidas as sessões da coleta anterior`);
      casasMantidas.push(...casas);
      sessoes.push(...(anterior?.sessoes || []).filter((s) => casas.includes(s.casa)));
    }
  }

  // Cruzamento com as votações já coletadas, pelo dia.
  const porDia = { camara: locais.camaraPorDia, senado: locais.senadoPorDia };
  // Até onde vai cada acervo: a data do coletor da casa (meta.json) ou a última votação gravada.
  const acervoAte = {};
  for (const c of ['camara', 'senado']) {
    const m = lerJson(path.join(RAIZ, `dados/${c}/meta.json`));
    const ult = Object.keys(porDia[c]).sort().pop() || null;
    acervoAte[c] = m?.periodo?.fim || ult;
  }
  for (const s of sessoes) {
    if (casasMantidas.includes(s.casa)) continue;
    const mapa = porDia[s.casa];
    const origem = `dados/${s.casa}/votacoes (Plenário, mesmo dia, todas as sessões do dia)`;
    if (!mapa) s.votacoes_registradas_no_dia = { quantidade: null, origem: 'votações de sessões do Congresso Nacional não fazem parte deste cruzamento' };
    else if (s.data > hoje) s.votacoes_registradas_no_dia = { quantidade: null, origem, motivo: 'dia ainda não ocorrido' };
    else if (!acervoAte[s.casa] || s.data > acervoAte[s.casa]) s.votacoes_registradas_no_dia = { quantidade: null, origem, motivo: `acervo de votações coletado até ${acervoAte[s.casa] || 'data não informada'}` };
    else s.votacoes_registradas_no_dia = { quantidade: mapa[s.data] || 0, origem };
    if (s.casa === 'camara' && s.votacoes_do_evento) {
      s.votacoes_do_evento.no_acervo_do_site = (locais.camaraPorEvento.get(s.codigo_oficial) || []).length;
    }
  }
  sessoes.sort(ordemSessao);

  // Pautas: um arquivo por casa e por dia, com todas as sessões daquele dia.
  const grupos = new Map();
  for (const s of sessoes) {
    const k = `${s.casa}-${s.data}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(s);
  }
  let itensTotal = 0;
  const desfechos = {};
  for (const [k, ss] of grupos) {
    const arquivo = path.join(PAUTAS, `${k}.json`);
    const velho = lerJson(arquivo);
    const blocos = ss.map((s) => {
      let itens = pautas.has(s.id) ? pautas.get(s.id) : undefined;
      let observacao = null;
      if (itens === undefined || itens === null) {
        const antigo = velho?.sessoes?.find((b) => b.sessao_id === s.id);
        if (antigo) { itens = antigo.itens; observacao = 'pauta mantida da coleta anterior (a fonte não respondeu nesta coleta)'; }
        else itens = itens === null ? null : [];
      }
      if (Array.isArray(itens) && !itens.length) {
        observacao = observacao || (s.situacao === 'agendada'
          ? 'pauta ainda não publicada pela fonte oficial (ou sessão sem itens de pauta)'
          : 'a fonte oficial não traz itens de pauta para esta sessão');
      }
      for (const it of itens || []) { itensTotal++; desfechos[it.desfecho] = (desfechos[it.desfecho] || 0) + 1; }
      s.pauta = { arquivo: `pautas/${k}.json`, itens: itens ? itens.length : null };
      return {
        sessao_id: s.id, codigo_oficial: s.codigo_oficial, hora: s.hora, tipo: s.tipo, tipo_oficial: s.tipo_oficial,
        situacao: s.situacao, situacao_oficial: s.situacao_oficial, link_oficial: s.link_oficial,
        observacao, itens: itens ?? null,
      };
    });
    const [casa] = k.split('-');
    gravarSeMudou(arquivo, {
      casa, data: ss[0].data, atualizado_em: agora,
      aviso: 'Agenda e pauta conforme publicadas pela casa legislativa; a fonte é atualizada com atraso de minutos e não é tempo real.',
      sessoes: blocos,
    });
  }

  const porCasa = {};
  for (const s of sessoes) {
    porCasa[s.casa] ??= { sessoes: 0, por_situacao: {}, por_tipo: {} };
    const c = porCasa[s.casa];
    c.sessoes++;
    c.por_situacao[s.situacao] = (c.por_situacao[s.situacao] || 0) + 1;
    c.por_tipo[s.tipo] = (c.por_tipo[s.tipo] || 0) + 1;
  }

  gravarSeMudou(path.join(SAIDA, 'sessoes.json'), {
    atualizado_em: agora,
    periodo: { inicio, fim, referencia: hoje },
    aviso: 'Agenda conforme publicada pela Câmara dos Deputados e pelo Senado Federal; as fontes são atualizadas com atraso de minutos e não são tempo real.',
    sessoes,
  });

  const meta = {
    atualizado_em: agora,
    verificado_em: agora,
    periodo: { inicio, fim, referencia: hoje, regra: `últimos ${diasAntes} dias e próximos ${diasDepois} dias` },
    tempo_real: false,
    aviso: 'Não é tempo real: a agenda, a pauta e o resultado vêm dos serviços de dados abertos das casas, que se atualizam com atraso de minutos; a coleta é diária.',
    contagens: { por_casa: porCasa, sessoes: sessoes.length, arquivos_de_pauta: grupos.size, itens_de_pauta: itensTotal, itens_por_desfecho: desfechos },
    regras: {
      situacao: 'Categoria tirada do texto oficial da situação: "Encerrada" → encerrada; "Agendada"/"Convocada" → agendada; "Em Andamento" → em andamento; "Cancelada" → cancelada; "Sessão não realizada" → não realizada; outro texto → não informado. O texto oficial fica em "situacao_oficial".',
      tipo: 'Categoria tirada do tipo oficial (Câmara: "descricaoTipo" e "descricao"; Senado: "TipoSessao" e o indicador "deliberativo" do encontro). Sessões solenes e especiais são não deliberativas; sessões com Casa "CN" são sessões do Congresso Nacional. O texto oficial fica em "tipo_oficial".',
      desfecho: REGRAS_DESFECHO,
      votacoes_no_dia: 'Número de arquivos em dados/camara/votacoes (só Plenário) e dados/senado/votacoes com a mesma data da sessão. A Câmara inclui votações simbólicas e nominais; o Senado inclui só votações nominais e secretas, que são as que a fonte de votações publica.',
    },
    fontes: [
      { titulo: 'Câmara dos Deputados: eventos do Plenário (órgão 180)', url: `${API_CAMARA}/eventos?idOrgao=180`, orgao: 'Câmara dos Deputados', acessado_em },
      { titulo: 'Câmara dos Deputados: pauta do evento', url: `${API_CAMARA}/eventos/{id}/pauta`, orgao: 'Câmara dos Deputados', acessado_em },
      { titulo: 'Câmara dos Deputados: votações do evento', url: `${API_CAMARA}/eventos/{id}/votacoes`, orgao: 'Câmara dos Deputados', acessado_em },
      { titulo: 'Senado Federal: agenda do mês nos Plenários do Senado e do Congresso', url: `${API_SENADO}/plenario/agenda/mes/{AAAAMMDD}`, orgao: 'Senado Federal', acessado_em },
      { titulo: 'Senado Federal: detalhes e pauta do encontro do Plenário', url: `${API_SENADO}/plenario/encontro/{codigo}/pauta`, orgao: 'Senado Federal', acessado_em },
      { titulo: 'Senado Federal: resultado do mês das sessões plenárias', url: `${API_SENADO}/plenario/resultado/mes/{AAAAMMDD}`, orgao: 'Senado Federal', acessado_em },
    ],
    observacoes: [
      'Sessões do Congresso Nacional vêm da agenda publicada pelo Senado Federal (Casa "CN") e ficam com casa "congresso".',
      'O link oficial da sessão é a página da casa (Câmara: evento legislativo; Senado: pauta da sessão plenária). O vídeo é o link informado pela própria fonte (Câmara: "urlRegistro"; Senado: "linkVideo" do encontro).',
      'Relator: Câmara, campo "relator" da pauta; Senado, nome citado no texto do parecer que acompanha o item ("Relator: Senador …"). Sem isso, "Informação não disponível em fonte oficial".',
      'Arquivos de pauta de dias que saíram da janela não são apagados; sessoes.json lista só a janela atual.',
      'Câmara: a hora vem de "dataHoraInicio" da lista de eventos do Plenário. O detalhe do evento (/eventos/{id}) às vezes traz outro horário (ex.: evento 83066: 15:12 na lista, 10:00 no detalhe); a fonte não explica a diferença e o coletor não escolhe entre os dois além de usar a lista.',
      'Senado: a página oficial da sessão mostra no resultado só os itens apreciados; itens "Não apreciado" constam da pauta dos dados abertos, mas podem não aparecer na página.',
      ...(casasMantidas.length ? [`Coleta incompleta: mantidas as sessões anteriores de ${casasMantidas.join(', ')}.`] : []),
    ],
    falhas,
    execucao: { requisicoes: estatisticas.requisicoes, retentativas: estatisticas.retentativas },
  };
  gravarSeMudou(path.join(SAIDA, 'meta.json'), meta, { forcar: true });

  console.log(`Sessões: ${sessoes.length} (${Object.entries(porCasa).map(([c, v]) => `${c} ${v.sessoes}`).join(', ')})`);
  console.log(`Arquivos de pauta: ${grupos.size}; itens: ${itensTotal}; desfechos: ${JSON.stringify(desfechos)}`);
  console.log(`Requisições: ${estatisticas.requisicoes} (retentativas ${estatisticas.retentativas}); gravados ${contagemGravacao.gravados}, inalterados ${contagemGravacao.inalterados}`);
  if (falhas.length) { console.warn(`Falhas (${falhas.length}):\n  ${falhas.join('\n  ')}`); }
  if (casasMantidas.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
