#!/usr/bin/env node
/**
 * Coletor de Goiás (GO), só o Poder Executivo: leis, leis complementares, decretos numerados, emendas
 * constitucionais e mensagens de veto (com as razões em texto integral), pela API aberta da Casa Civil
 * (legisla.casacivil.go.gov.br/api). Node 20+, sem dependências.
 *
 * A Assembleia Legislativa (ALEGO) NÃO é acessada: o sistema legislativo ALEGO Digital declara
 * "User-agent: * / Disallow: /" no robots.txt (levantamento de 02/11/2026, docs/pesquisa/estados/go.md).
 * Deputados, projetos e votações ficam como indisponíveis, com o motivo gravado em meta.json; os dados
 * foram pedidos pela LAI (docs/pesquisa/pedidos-lai/go.md).
 *
 * USO
 *   node scripts/coleta/estados/go/coletar.mjs                 # ano corrente
 *   node scripts/coleta/estados/go/coletar.mjs --anos 2025,2026
 *   COLETA_ORCAMENTO_MIN=15 (padrão)  GO_MAX_VETOS=80 (detalhes de veto por execução)  GO_MAX_PAGINAS=30
 *   node scripts/coleta/estados/go/testes.mjs                  # testes offline
 *
 * SAÍDA (dados/estados/go/): meta.json e normas/indice-<ano>.json (mesmo contrato das normas de PE e DF).
 *
 * REGRAS: robots.txt do host antes de qualquer outra requisição (o host devolve a página do sistema, sem
 * restrição declarada); intervalo mínimo de 2 s; User-Agent que cita o Brasil na Lupa; nomes de particulares
 * mascarados; nada deduzido. Arquivo sem mudança não é regravado. Código de saída: 0 = ok; 1 = falhou.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Cliente, hojeISO, fonte, lerJson } from '../abertos/base.mjs';
import { lerIndices, gravar, gravarIndices, porDataDesc } from '../abertos/saida.mjs';
import { CASA_CIVIL as C, TIPOS_GO, interpretarLegislacaoGO, interpretarVetoListaGO, aplicarDetalheVetoGO } from './casacivil.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const hoje = hojeISO();
const anos = (val('--anos') || hoje.slice(0, 4)).split(',').map(Number).filter((a) => a >= 1990 && a <= Number(hoje.slice(0, 4)));
if (!anos.length) { console.error('Uso: --anos AAAA[,AAAA]'); process.exit(1); }
const inicio = Date.now();
const prazoMs = inicio + Number(process.env.COLETA_ORCAMENTO_MIN || 15) * 60000;
const log = (...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(0)}s] [GO]`, ...m);
const TAM = 100; // a API limita a 100 itens por página
const maxPag = Number(process.env.GO_MAX_PAGINAS || 30);
const maxVetos = Number(process.env.GO_MAX_VETOS || 80);

/** Texto (e fonte) da indisponibilidade da Assembleia, mostrado pelo site. Nada aqui vem da ALEGO. */
export const ASSEMBLEIA_INDISPONIVEL = {
  motivo:
    'O sistema legislativo da Assembleia Legislativa do Estado de Goiás (ALEGO Digital), onde ficam os projetos, as sessões e as votações, proíbe a coleta automática no seu arquivo robots.txt ("Disallow: /"). Por isso, deputados, projetos e votações da Assembleia não são coletados.',
  pedido_lai:
    'Foi preparado um pedido pela Lei de Acesso à Informação (LAI) à Assembleia, pedindo as votações com o voto de cada deputado e os projetos em formato aberto, e uma forma autorizada de acesso automatizado. Enquanto não houver resposta, esses dados ficam indisponíveis aqui.',
  fonte: { titulo: 'robots.txt do sistema ALEGO Digital (consulta legislativa)', url: 'https://alegodigital.al.go.leg.br/robots.txt', orgao: 'Assembleia Legislativa do Estado de Goiás (ALEGO)', acessado_em: '2026-11-02' },
};

async function main() {
  const dir = path.join(RAIZ, 'dados', 'estados', 'go');
  fs.mkdirSync(dir, { recursive: true });
  const cliente = new Cliente({ prazoMs, log });
  const falhas = [];
  const tentar = async (rotulo, fn) => { try { return await fn(); } catch (e) { falhas.push(`${rotulo}: ${e.message}`); log(`FALHA ${rotulo}: ${e.message}`); return null; } };
  log(`anos ${anos.join(', ')}`);

  const normas = lerIndices(dir, 'normas');
  // Totais da fonte: os desta execução substituem os anteriores; os que falharem agora ficam como estavam.
  const naFonte = { ...(lerJson(path.join(dir, 'meta.json'))?.contagens?.na_fonte || {}) };
  let respostas = 0;

  // 1) Leis, leis complementares, decretos numerados e emendas constitucionais do ano
  for (const ano of anos) {
    for (const [idTipo, [, tipo]] of Object.entries(TIPOS_GO)) {
      for (let pag = 1; pag <= maxPag; pag++) {
        if (!cliente.cabe()) break;
        const url = (tam, p) => `${C.api}/v1/pesquisa/legislacoes?tipo_legislacao=${idTipo}&ano=${ano}&qtd_por_pagina=${tam}&page=${p}`;
        let d = await tentar(`${tipo} ${ano} p.${pag}`, () => cliente.json(url(TAM, pag)));
        if (!d) {
          // A API às vezes estoura o tempo (HTTP 504) nas últimas páginas de 100; a mesma faixa em duas páginas de 50 responde.
          const metade = TAM / 2;
          const a = await tentar(`${tipo} ${ano} p.${2 * pag - 1} (50)`, () => cliente.json(url(metade, 2 * pag - 1)));
          const b = a && (a.resultados?.length ?? 0) === metade ? await tentar(`${tipo} ${ano} p.${2 * pag} (50)`, () => cliente.json(url(metade, 2 * pag))) : null;
          // Sem a segunda metade, a lista fica curta e o laço para (a próxima execução completa).
          if (a) d = { total_resultados: a.total_resultados, resultados: [...(a.resultados || []), ...(b?.resultados || [])] };
        }
        if (!d) break;
        respostas++;
        const lista = Array.isArray(d.resultados) ? d.resultados : [];
        for (const r of lista) {
          if (Number(r.ano) !== ano) continue;
          const it = interpretarLegislacaoGO(r, hoje);
          if (it) normas.set(it.id, it);
        }
        naFonte[`${ano}|${tipo}`] = d.total_resultados ?? null;
        if (lista.length < TAM || pag * TAM >= (d.total_resultados ?? 0)) break;
      }
      log(`${tipo} ${ano}: ${[...normas.values()].filter((n) => n.ano === ano && n.tipo === tipo).length} de ${naFonte[`${ano}|${tipo}`] ?? '?'} na fonte`);
    }
  }

  // 2) Mensagens de veto do ano (lista); o detalhe com as razões é lido depois, só para as que faltam
  for (const ano of anos) {
    for (let pag = 1; pag <= maxPag; pag++) {
      if (!cliente.cabe()) break;
      const d = await tentar(`vetos ${ano} p.${pag}`, () => cliente.json(`${C.api}/v1/pesquisa/mensagens_veto?ano=${ano}&qtd_por_pagina=${TAM}&page=${pag}`));
      if (!d) break;
      respostas++;
      const lista = Array.isArray(d.resultados) ? d.resultados : [];
      for (const r of lista) {
        if (Number(r.ano) !== ano) continue;
        const it = interpretarVetoListaGO(r, hoje);
        if (!it) continue;
        const ant = normas.get(it.id);
        normas.set(it.id, ant?.detalhe_coletado ? { ...it, titulo: ant.titulo, razoes_veto: ant.razoes_veto, detalhe_coletado: true, lacunas: ant.lacunas, fonte: ant.fonte } : it);
      }
      naFonte[`${ano}|Vetos`] = d.total_resultados ?? null;
      if (lista.length < TAM || pag * TAM >= (d.total_resultados ?? 0)) break;
    }
    log(`vetos ${ano}: ${[...normas.values()].filter((n) => n.ano === ano && /^Veto/.test(n.tipo)).length} de ${naFonte[`${ano}|Vetos`] ?? '?'} na fonte`);
  }

  // 3) Razões dos vetos (texto integral), mais recentes primeiro
  const fila = [...normas.values()].filter((n) => /^Veto/.test(n.tipo) && !n.detalhe_coletado)
    .sort((a, b) => String(b.data_assinatura || '').localeCompare(String(a.data_assinatura || '')));
  let detalhados = 0;
  for (const v of fila.slice(0, maxVetos)) {
    if (!cliente.cabe()) break;
    const d = await tentar(`veto ${v.id_oficial}`, () => cliente.json(`${C.api}/v1/pesquisa/mensagens_veto/${v.id_oficial}`));
    if (d) { normas.set(v.id, aplicarDetalheVetoGO(v, d, hoje)); detalhados++; }
  }
  log(`razões de veto lidas: ${detalhados} (faltam ${Math.max(0, fila.length - detalhados)})`);

  // 4) Gravação (só se a fonte respondeu)
  if (!respostas) { log('nenhuma resposta da API: nada gravado'); return false; }
  const lista = [...normas.values()];
  const cont = gravarIndices(dir, 'normas', lista, (n) => n.ano, (ano) => ({
    atualizado_em: hoje, uf: C.uf, ano: Number(ano) || ano,
    abrangencia: 'Atos do Estado de Goiás cadastrados pela Casa Civil: leis ordinárias, leis complementares, decretos numerados, emendas constitucionais e mensagens de veto do governador',
    fontes: [
      fonte('Legislação do Estado de Goiás — Casa Civil (pesquisa de legislação)', `${C.site}/pesquisa_legislacao`, C.nome, hoje),
      fonte('Mensagens de veto — Casa Civil de Goiás', `${C.site}/pesquisa_mensagem_veto`, C.nome, hoje),
    ],
  }), porDataDesc('data_assinatura'));

  const meta = {
    atualizado_em: new Date().toISOString(), ultima_execucao: new Date(inicio).toISOString(), uf: C.uf, casa: C.casa,
    orgao: C.nome, periodo: { anos, fim: hoje }, modo: 'incremental',
    fontes: [
      fonte('Legislação do Estado de Goiás — Casa Civil', `${C.site}/pesquisa_legislacao`, C.nome, hoje),
      fonte('Mensagens de veto — Casa Civil de Goiás', `${C.site}/pesquisa_mensagem_veto`, C.nome, hoje),
    ],
    assembleia_indisponivel: ASSEMBLEIA_INDISPONIVEL,
    robots: cliente.resumoRobots(),
    execucao: { requisicoes: cliente.requisicoes, falhas: [...falhas, ...cliente.falhas].slice(0, 50) },
    contagens: {
      normas_por_ano: cont,
      na_fonte: naFonte,
      vetos_com_razoes: lista.filter((n) => /^Veto/.test(n.tipo) && n.razoes_veto).length,
      vetos_sem_razoes: lista.filter((n) => /^Veto/.test(n.tipo) && !n.razoes_veto).length,
      razoes_lidas_nesta_execucao: detalhados,
    },
    observacoes: [
      'Fonte: API JSON aberta usada pelo próprio site da Casa Civil de Goiás (sem documentação pública; o formato pode mudar). O host não publica robots.txt (devolve a página do sistema); intervalo mínimo de 2 s.',
      'Assembleia Legislativa (ALEGO): não acessada. O sistema ALEGO Digital proíbe a coleta automática no robots.txt ("Disallow: /"). Deputados, projetos e votações: "Informação não disponível em fonte oficial" até haver acesso autorizado ou resposta ao pedido pela LAI (docs/pesquisa/pedidos-lai/go.md).',
      'Leis: a autoria é a registrada pela Casa Civil ("Governador do Estado de Goiás" ou o nome dos deputados). O link leva à edição do Diário Oficial informada pela Casa Civil; quando ela ainda não informou o link, leva à página da norma no site da Casa Civil.',
      'Vetos: a Casa Civil publica a mensagem de veto à Assembleia com as razões em texto integral; a data é a da mensagem (a data de publicação no Diário Oficial não vem na API).',
    ],
  };
  gravar(path.join(dir, 'meta.json'), meta);
  log(`gravado: ${JSON.stringify(meta.contagens)}`);
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((ok) => process.exit(ok ? 0 : 1), (e) => { log(`FALHA: ${e.stack || e.message}`); process.exit(1); });
}
