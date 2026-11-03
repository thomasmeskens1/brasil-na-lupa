// Planejador de uma execução para UM host do SAPL. Cada passo é uma requisição (≥ 61 s entre elas),
// escolhida por prioridade até o orçamento acabar:
//   1. robots.txt (sempre primeiro)            2. tabelas essenciais nunca lidas
//   3. fase "topo" de cada rota (o que é novo) 4. demais tabelas nunca lidas
//   5. dependências por id (até 8 por execução) 6. revisita das matérias/normas alteradas
//   7. uma tabela vencida (> 7 dias)           8. retroação: a rota com a cobertura mais recente anda primeiro
import { ClienteHost } from './http.mjs';
import { Armazem } from './armazem.mjs';
import { estadoVazio, iniciarExecucao, proximaPagina, aplicarPagina, encerrarExecucao, coberto, coberturaDesde } from './fluxos.mjs';
import {
  normParlamentar, emailInstitucional, normMandato, normFiliacao, normMateria, normTramitacao, normSessao,
  normItemPauta, normRegistro, normVoto, normNorma, dataDoRegistro, textoPublico,
} from './normalizar.mjs';

export const ROTAS = {
  registrovotacao: '/api/sessao/registrovotacao/',
  votoparlamentar: '/api/sessao/votoparlamentar/',
  ordemdia: '/api/sessao/ordemdia/',
  expedientemateria: '/api/sessao/expedientemateria/',
  sessaoplenaria: '/api/sessao/sessaoplenaria/',
  materialegislativa: '/api/materia/materialegislativa/',
  normajuridica: '/api/norma/normajuridica/',
  tramitacao: '/api/materia/tramitacao/',
};
const ORDEM = Object.keys(ROTAS);
const GRUPO = { tramitacao: 1 }; // tramitação retroage por último (volume alto, só a última interessa)
const MAX_PENDENCIAS = 8;
const DIAS_TABELA = 7;

function normalizador(rota, o) {
  return {
    materialegislativa: (r) => normMateria(r, o), tramitacao: (r) => normTramitacao(r, o), sessaoplenaria: (r) => normSessao(r, o),
    ordemdia: (r) => normItemPauta(r, 'ordemdia', o), expedientemateria: (r) => normItemPauta(r, 'expedientemateria', o),
    registrovotacao: (r) => normRegistro(r, o), votoparlamentar: (r) => normVoto(r), normajuridica: (r) => normNorma(r, o),
  }[rota];
}

function tabelasDef(cfg, arm) {
  const leg = () => arm.tabelas.legislatura_atual;
  return [
    { nome: 'legislaturas', essencial: true, rota: '/api/parlamentares/legislatura/', map: (r) => ({ id: r.id, numero: r.numero, inicio: r.data_inicio, fim: r.data_fim }) },
    { nome: 'tipos_resultado', essencial: true, rota: '/api/sessao/tiporesultadovotacao/', map: (r) => ({ id: r.id, nome: r.nome, natureza: r.natureza ?? null }) },
    { nome: 'tipos_materia', essencial: true, rota: '/api/materia/tipomaterialegislativa/', map: (r) => ({ id: r.id, sigla: r.sigla, descricao: r.descricao }) },
    { nome: 'mandatos', essencial: true, requer: () => leg(), rota: () => `/api/parlamentares/mandato/?legislatura=${leg().id}`, map: normMandato },
    { nome: 'tipos_norma', rota: '/api/norma/tiponormajuridica/', map: (r) => ({ id: r.id, sigla: r.sigla, descricao: r.descricao }) },
    { nome: 'tipos_sessao', rota: '/api/sessao/tiposessaoplenaria/', map: (r) => ({ id: r.id, nome: r.nome }) },
    { nome: 'partidos', rota: '/api/parlamentares/partido/', map: (r) => ({ id: r.id, sigla: r.sigla, nome: r.nome }) },
    { nome: 'filiacoes', rota: '/api/parlamentares/filiacao/', map: normFiliacao },
    { nome: 'parlamentares', rota: '/api/parlamentares/parlamentar/', map: (r) => parlamentarPublico(r, cfg) },
    { nome: 'status_tramitacao', rota: '/api/materia/statustramitacao/', map: (r) => ({ id: r.id, sigla: r.sigla, descricao: r.descricao }) },
    { nome: 'autores', rota: '/api/base/autor/', map: (r) => ({ id: r.id, nome: r.nome || r.__str__ || null, object_id: r.object_id ?? null }), depois: (lista) => ligarAutores(lista, arm) },
  ];
}

function parlamentarPublico(r, cfg) {
  const p = normParlamentar(r);
  const { email, ...resto } = p;
  return { ...resto, email_institucional: emailInstitucional(email, cfg.dominios_email) };
}

/** Autor ligado a parlamentar só se object_id existir na tabela com o mesmo nome; senão o nome passa pela privacidade. */
function ligarAutores(lista, arm) {
  const parl = new Map((arm.tabelas.parlamentares || []).map((p) => [p.id, p]));
  const sa = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  return lista.map((a) => {
    const p = a.object_id != null ? parl.get(a.object_id) : null;
    if (p && sa(p.nome) === sa(a.nome)) return { id: a.id, nome: a.nome, parlamentar_id: p.id };
    return { id: a.id, nome: textoPublico(a.nome, arm.regras(`autor-${a.id}`)).texto, parlamentar_id: null };
  });
}

const comPagina = (rota, extra) => `${rota}${rota.includes('?') ? '&' : '?'}${extra}`;

export async function executarCasa(cfg, op) {
  const { raiz, hoje, prazoMs, log: logBase = console.log, fetchImpl, dormirImpl, agora } = op;
  const log = (...m) => logBase(`[${cfg.uf}]`, ...m);
  const arm = new Armazem(raiz, cfg, hoje);
  const cur = arm.cursor;
  cur.fluxos ||= {}; cur.tabelas_em ||= {}; cur.pendencias_inexistentes ||= [];
  const ps = cur.page_size_solicitado || op.pageSize;
  cur.page_size_solicitado = ps;
  const cliente = new ClienteHost(cfg.host, { prazoMs, ultimaAnterior: cur.ultima_requisicao, log, fetchImpl, dormirImpl, agora });
  const falhas = [];
  const inicioExec = new Date().toISOString();
  const desde = () => op.desde || arm.tabelas.legislatura_atual?.inicio || null;
  const o = { hoje, regras: arm.regras };
  for (const r of ORDEM) cur.fluxos[r] ||= estadoVazio();
  const exec = Object.fromEntries(ORDEM.map((r) => [r, iniciarExecucao(cur.fluxos[r])]));
  const semProgresso = Object.fromEntries(ORDEM.map((r) => [r, 0]));
  const falhou = new Set();
  let pendFeitas = 0;
  const revisitado = new Set();
  let tabelaVencidaFeita = false;
  const defs = tabelasDef(cfg, arm);

  const gravar = () => {
    cur.ultima_requisicao = cliente.ultimaEm;
    return arm.gravar({ meta: montarMeta() });
  };
  function montarMeta() {
    return {
      atualizado_em: new Date().toISOString(), ultima_execucao: inicioExec, uf: cfg.uf, casa: cfg.casa, orgao: cfg.nome, host: cfg.host,
      periodo: { inicio: desde(), fim: hoje }, modo: 'incremental',
      fontes: [{ titulo: `SAPL — ${cfg.nome} (API REST pública)`, url: `https://${cfg.host}/api/`, orgao: cfg.nome, acessado_em: hoje }],
      robots: { [cfg.host]: cliente.robots },
      execucao: { requisicoes: cliente.requisicoes, falhas: [...falhas, ...cliente.falhas].slice(0, 50) },
      cobertura: Object.fromEntries(ORDEM.map((r) => [r, { desde: coberturaDesde(cur.fluxos[r]), concluida: cur.fluxos[r].concluido }])),
      observacoes: OBSERVACOES,
    };
  }

  // ---------------------------------------------------------- tarefas
  async function tarefaTabela(def) {
    const rota = typeof def.rota === 'function' ? def.rota() : def.rota;
    const lista = [];
    for (let p = 1; ; p++) {
      if (p > 1 && !cliente.cabe()) { log(`tabela ${def.nome}: orçamento acabou na página ${p}; fica para a próxima execução`); return; }
      const d = await cliente.json(comPagina(rota, `page=${p}&page_size=${ps}`));
      for (const r of d?.results || []) lista.push(def.map(r));
      if (!d?.pagination?.next_page) break;
    }
    arm.tabelas[def.nome] = def.depois ? def.depois(lista) : lista;
    cur.tabelas_em[def.nome] = new Date().toISOString();
    if (def.nome === 'legislaturas') {
      arm.tabelas.legislatura_atual = lista.find((l) => l.inicio && l.inicio <= hoje && (!l.fim || l.fim >= hoje)) || null;
    }
    log(`tabela ${def.nome}: ${lista.length} registros`);
  }

  async function tarefaFluxo(rota) {
    const est = cur.fluxos[rota];
    const e = exec[rota];
    const plano = proximaPagina(est, e);
    const p = plano.pagina;
    const d = await cliente.json(`${ROTAS[rota]}?o=-id&page=${p}&page_size=${plano.tamanho || ps}`);
    if (!d) { if (est.faixas.length <= 1) est.concluido = true; e.fase = 'retro'; return; }
    const res = d.results || [];
    const temProxima = d.pagination ? d.pagination.next_page != null : Boolean(d.next);
    const datas = new Map(res.map((r) => [r.id, dataDoRegistro(rota, r, hoje)]));
    const norm = normalizador(rota, o);
    for (const r of res) arm.receber(rota, norm(r));
    const fase = e.fase;
    const { novos, deriva } = aplicarPagina(est, e, p, res, { temProxima, dataDe: (id) => datas.get(id) ?? null, desde: desde(), tamanho: temProxima && !plano.tamanho ? res.length : null, tamanhoPedido: plano.tamanho });
    est.total_fonte = d.pagination?.total_entries ?? est.total_fonte ?? null;
    semProgresso[rota] = novos ? 0 : semProgresso[rota] + 1;
    log(`${rota} p.${p} (${fase}): ${res.length} registros, ${novos} novos${deriva ? ', deriva detectada (recuo)' : ''}; cobertura desde ${coberturaDesde(est) ?? '—'}${est.concluido ? ' (concluída)' : ''}`);
  }

  async function tarefaPendencia(tipo, id) {
    const rota = { materia: ROTAS.materialegislativa, ordemdia: ROTAS.ordemdia, expedientemateria: ROTAS.expedientemateria, sessao: ROTAS.sessaoplenaria, parlamentar: '/api/parlamentares/parlamentar/' }[tipo];
    pendFeitas++;
    const r = await cliente.json(`${rota}${id}/`);
    if (!r) { cur.pendencias_inexistentes.push(`${tipo}-${id}`); log(`dependência ${tipo} ${id}: não existe na fonte (404)`); return; }
    if (tipo === 'parlamentar') arm.tabelas.parlamentares = [...(arm.tabelas.parlamentares || []), parlamentarPublico(r, cfg)];
    else if (tipo === 'materia') arm.receber('materialegislativa', normMateria(r, o));
    else if (tipo === 'sessao') arm.receber('sessaoplenaria', normSessao(r, o));
    else arm.receber(tipo, normItemPauta(r, tipo, o));
    log(`dependência ${tipo} ${id}: coletada`);
  }

  async function tarefaRevisita(rota) {
    revisitado.add(rota);
    const d = await cliente.json(`${ROTAS[rota]}?o=-data_ultima_atualizacao&page=1&page_size=${ps}`);
    const norm = normalizador(rota, o);
    for (const r of d?.results || []) arm.receber(rota, norm(r));
    log(`revisita ${rota} (alteradas recentemente): ${(d?.results || []).length} registros`);
  }

  function pendenciaDaVez() {
    if (pendFeitas >= MAX_PENDENCIAS) return null;
    const pend = arm.pendencias();
    const inex = new Set(cur.pendencias_inexistentes);
    const ok = (k) => !inex.has(k) && !falhou.has(`pend-${k}`);
    for (const id of pend.materias) if (ok(`materia-${id}`) && !coberto(cur.fluxos.materialegislativa, id)) return ['materia', id];
    for (const k of pend.pauta) {
      const [etapa, id] = k.split('-');
      if (ok(`${etapa}-${id}`) && !coberto(cur.fluxos[etapa], Number(id))) return [etapa, Number(id)];
    }
    for (const id of pend.sessoes) if (ok(`sessao-${id}`) && !coberto(cur.fluxos.sessaoplenaria, id)) return ['sessao', id];
    if (arm.tabelas.parlamentares) for (const id of pend.parlamentares) if (ok(`parlamentar-${id}`)) return ['parlamentar', id];
    return null;
  }

  function escolher() {
    const tabelaFaltando = (essencial) => defs.find((d) => (!essencial || d.essencial) && !arm.tabelas[d.nome] && (!d.requer || d.requer()) && !falhou.has(`tab-${d.nome}`));
    let t = tabelaFaltando(true);
    if (t) return [`tab-${t.nome}`, () => tarefaTabela(t)];
    for (const r of ORDEM) {
      const est = cur.fluxos[r];
      if (falhou.has(`fluxo-${r}`)) continue;
      if (exec[r].fase === 'topo' || (!est.faixas.length && !est.concluido && exec[r].paginas === 0)) return [`fluxo-${r}`, () => tarefaFluxo(r)];
    }
    t = tabelaFaltando(false);
    if (t) return [`tab-${t.nome}`, () => tarefaTabela(t)];
    const pd = pendenciaDaVez();
    if (pd) return [`pend-${pd[0]}-${pd[1]}`, () => tarefaPendencia(pd[0], pd[1])];
    for (const r of ['materialegislativa', 'normajuridica']) {
      if (!revisitado.has(r) && cur.fluxos[r].faixas.length && !falhou.has(`rev-${r}`)) return [`rev-${r}`, () => tarefaRevisita(r)];
    }
    if (!tabelaVencidaFeita) {
      const limite = Date.now() - DIAS_TABELA * 86400000;
      const venc = defs.filter((d) => arm.tabelas[d.nome] && Date.parse(cur.tabelas_em[d.nome] || 0) < limite && (!d.requer || d.requer()))
        .sort((a, b) => String(cur.tabelas_em[a.nome] || '').localeCompare(String(cur.tabelas_em[b.nome] || '')))[0];
      if (venc) { tabelaVencidaFeita = true; return [`tab-${venc.nome}`, () => tarefaTabela(venc)]; }
    }
    const cand = ORDEM.filter((r) => !cur.fluxos[r].concluido && !falhou.has(`fluxo-${r}`) && semProgresso[r] < 3 && proximaPagina(cur.fluxos[r], exec[r]) != null)
      .sort((a, b) => (GRUPO[a] || 0) - (GRUPO[b] || 0)
        || String(coberturaDesde(cur.fluxos[b]) ?? '9999').localeCompare(String(coberturaDesde(cur.fluxos[a]) ?? '9999')));
    if (cand.length) return [`fluxo-${cand[0]}`, () => tarefaFluxo(cand[0])];
    return null;
  }

  // ---------------------------------------------------------- laço principal
  let concluido = false;
  try {
    await cliente.lerRobots();
    let passos = 0;
    while (cliente.cabe()) {
      const t = escolher();
      if (!t) { concluido = true; break; }
      const [chave, fn] = t;
      try { await fn(); } catch (err) { falhou.add(chave); falhas.push(`${chave}: ${err.message}`); log(`FALHA ${chave}: ${err.message}`); }
      if (++passos % 3 === 0) gravar();
    }
  } catch (err) {
    falhas.push(`robots.txt: ${err.message}`); log(`FALHA ao ler robots.txt (${err.message}); nenhuma outra requisição feita`);
  }
  for (const r of ORDEM) encerrarExecucao(cur.fluxos[r], exec[r]);
  const contagens = gravar();
  log(`fim: ${cliente.requisicoes} requisições${concluido ? ' (nada mais a fazer)' : ' (orçamento esgotado)'}; ${JSON.stringify(contagens)}`);
  return { uf: cfg.uf, requisicoes: cliente.requisicoes, falhas, contagens, robotsOk: Boolean(cliente.robots) };
}

const OBSERVACOES = [
  'Fonte: API REST pública do SAPL 3 (Interlegis) da Assembleia. robots.txt lido antes de qualquer outra requisição; no máximo 1 requisição a cada 61 s (ou Crawl-delay + 1 s) por host, inclusive entre execuções; /materia/docacessorio/ nunca é acessado; nenhum PDF é baixado.',
  'Carga incremental e retomável: cada rota é lida do registro mais novo para o mais antigo (o=-id); o cursor guarda as faixas de ids já lidas e a cobertura (data mais antiga contígua). Prioridade: o que é novo; depois retroage até o início da legislatura atual.',
  'Tipo de votação vem do item da pauta (Ordem do Dia ou Expediente): 1 Simbólica, 2 Nominal, 3 Secreta. Voto individual só a partir do registro oficial por parlamentar (votoparlamentar), com o rótulo literal da fonte ("Não Votou" não é voto contrário). Nunca deduzido de "unanimidade" nem dos totais.',
  'Votação nominal sem voto por parlamentar na fonte: "Informação não disponível em fonte oficial", só depois que a coleta dos votos já passou da data da votação; antes disso a situação é "em-coleta".',
  'Votação simbólica: placar null e votos vazios; os números lançados no registro ficam em "totais_registrados" e não são votos.',
  'Partido no voto: filiação registrada no SAPL vigente na data da votação; sem filiação registrada ou com mais de uma, null.',
  'Sem CPF, RG, telefone, endereço, data de nascimento, IP ou usuário do sistema; e-mail só do domínio institucional da Casa. Ementas, observações e tramitações passam pelo mascaramento de nomes de particulares (diretriz 12); trechos em dúvida ficam marcados até a curadoria (revisao/mascaras.json).',
  'Datas impossíveis ou posteriores à coleta (ex.: erros de digitação) ficam null, com o valor bruto anotado em lacunas; nada é corrigido.',
];
