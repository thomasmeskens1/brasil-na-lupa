#!/usr/bin/env node
/**
 * Coletor do Tribunal de Contas do Estado do Rio Grande do Sul (TCE-RS) — Brasil na Lupa.
 *
 * Gera, em dados/tribunais-contas/tce-rs/:
 *   contas-governador/<exercicio>.json  parecer prévio sobre as contas do Governador (página oficial + decisões)
 *   contas-prefeitos/<municipio>.json   pareceres sobre as contas do Executivo Municipal, um item por responsável
 *   meta.json                           data da execução, contagens, fontes, restrições e lacunas
 *
 * Fontes (ver fontes.mjs): arquivos anuais de decisões do Portal de Dados Abertos (dados.tce.rs.gov.br/dados/),
 * pesquisa de jurisprudência (portal.tce.rs.gov.br, para o exercício e os links) e a página "Parecer Prévio"
 * (tcers.tc.br/parecer-previo/).
 *
 * Uso (Node 20+):
 *   node scripts/coleta/tribunais-contas/tce-rs/coletar.mjs             sessões do ano atual e do anterior
 *   node scripts/coleta/tribunais-contas/tce-rs/coletar.mjs --completo  sessões desde 2011 (primeiro arquivo aberto)
 *   COLETA_ORCAMENTO_MIN=15 node ...                                    para limpo ao fim do orçamento
 *
 * Regras de acesso: robots.txt de cada host lido antes de tudo e respeitado (inacessível = host bloqueado);
 * Crawl-delay de 10 s no portal de dados abertos, 3 s nos demais; uma requisição por vez; User-Agent identificado;
 * nunca usa o /api/ do CKAN; diante de desafio anti-bot, CAPTCHA, login ou 403, para e registra.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SAIDA, HOSTS, carregarRobots, resumoRobots, gravarSeMudou, contagemGravacao, estatisticas, hojeISO, lerJson, restanteMs, fonte } from './lib.mjs';
import { PRIMEIRO_ANO_DECISOES, TIPOS_JURIS, PAGINA_PESQUISA, baixarDecisoes, normalizarDecisao, pareceresDaDecisao, anosDoTipo, baixarJurisAno, indexarJuris, docDaSessao, baixarPaginaGovernador, URL_PAGINA_GOVERNADOR, paginaDecisoes } from './fontes.mjs';
import { carregarMunicipiosRS, municipioDoOrgao, itensMunicipais, montarArquivoMunicipio, itemGovernador } from './itens.mjs';

const MARGEM_MS = 3 * 60000;
const TIPOS_MUNICIPAIS = new Set(['Contas Anuais', 'Contas de Governo', 'Processo de Contas - Executivo']);
const temOrcamento = () => restanteMs() > MARGEM_MS;

function argumentos(argv) {
  const a = { completo: false };
  for (const x of argv) {
    if (x === '--completo') a.completo = true;
    else if (x === '--ajuda' || x === '-h') { console.log('Uso: coletar.mjs [--completo]'); process.exit(0); }
    else throw new Error(`argumento desconhecido: ${x}`);
  }
  return a;
}

/** Decisão mais recente com parecer por responsável, por processo. */
function ultimaComParecer(decs) {
  const porProc = new Map();
  for (const d of decs) {
    if (!pareceresDaDecisao(d.decisao).pareceres.length) continue;
    const lista = porProc.get(d.nr_processo) ?? [];
    lista.push(d);
    porProc.set(d.nr_processo, lista);
  }
  return new Map([...porProc].map(([k, l]) => {
    l.sort((a, b) => (b.data_sessao ?? '').localeCompare(a.data_sessao ?? ''));
    return [k, { dec: l[0], anteriores: l.slice(1).map((x) => x.data_sessao) }];
  }));
}

async function main() {
  const inicio = Date.now();
  const args = argumentos(process.argv.slice(2));
  const anoAtual = Number(hojeISO().slice(0, 4));
  const metaAntiga = lerJson(path.join(SAIDA, 'meta.json'));
  const completo = args.completo || !metaAntiga?.ultima_coleta_completa;
  const anosAlvo = [];
  for (let a = anoAtual; a >= (completo ? PRIMEIRO_ANO_DECISOES : anoAtual - 1); a--) anosAlvo.push(a);
  const erros = [];
  const bloqueios = [];
  let interrompido = false;

  for (const h of Object.keys(HOSTS)) {
    const r = await carregarRobots(h);
    if (r.bloqueado) bloqueios.push(r.bloqueado);
  }
  const bloqueado = (h) => !!resumoRobots()[h]?.bloqueado;

  // ---- Fontes: decisões (dados abertos) e jurisprudência, ano a ano de sessão
  const decisoesPorAno = new Map();
  const fontesDec = new Map();
  const jurisDocs = [];
  const anosProcessados = new Set();
  const semArquivo = [];
  const contagemJuris = {};
  if (!bloqueado('dados.tce.rs.gov.br') && !bloqueado('portal.tce.rs.gov.br')) {
    const totais = {};
    try { for (const t of TIPOS_JURIS) totais[t] = await anosDoTipo(t); } catch (e) { erros.push(`jurisprudência (totais): ${e.message}`); if (e.bloqueio) bloqueios.push(e.message); }
    for (const ano of anosAlvo) {
      if (Object.keys(totais).length < TIPOS_JURIS.length) break;
      if (!temOrcamento()) { interrompido = true; break; }
      try {
        const d = await baixarDecisoes(ano);
        if (!d) { semArquivo.push(ano); continue; }
        const docsAno = [];
        for (const t of TIPOS_JURIS) {
          const esperado = totais[t][String(ano)] ?? 0;
          if (esperado) docsAno.push(...await baixarJurisAno(t, ano, esperado));
          contagemJuris[`${ano}`] = (contagemJuris[`${ano}`] ?? 0) + esperado;
        }
        decisoesPorAno.set(ano, d.registros.map(normalizarDecisao));
        fontesDec.set(ano, d.fonte);
        jurisDocs.push(...docsAno);
        anosProcessados.add(ano);
      } catch (e) {
        erros.push(`sessões de ${ano}: ${e.message}`);
        if (e.bloqueio) { bloqueios.push(e.message); break; }
      }
    }
  }
  const juris = indexarJuris(jurisDocs);
  const todasDecisoes = [...decisoesPorAno.values()].flat();

  // ---- Prefeitos
  const { porNome } = carregarMunicipiosRS();
  const dirPref = path.join(SAIDA, 'contas-prefeitos');
  const novosPorMun = new Map();
  const lacunasMun = { sem_exercicio: {}, exercicio_divergente: [], orgao_divergente: [], nao_casados: {}, exemplos_sem_exercicio: [] };
  const municipais = todasDecisoes.filter((d) => /^PM DE /.test(d.nome_orgao) && TIPOS_MUNICIPAIS.has(d.tipo_processo));
  for (const [nr, { dec, anteriores }] of ultimaComParecer(municipais)) {
    const mun = municipioDoOrgao(dec.nome_orgao, porNome);
    if (!mun) { lacunasMun.nao_casados[dec.nome_orgao] = (lacunasMun.nao_casados[dec.nome_orgao] ?? 0) + 1; continue; }
    const entrada = juris.get(nr);
    const exs = [...(entrada?.exercicios ?? [])];
    if (exs.length !== 1) {
      if (exs.length > 1) lacunasMun.exercicio_divergente.push({ processo: nr, municipio: mun.nome, exercicios: exs });
      else {
        lacunasMun.sem_exercicio[dec.ano_sessao] = (lacunasMun.sem_exercicio[dec.ano_sessao] ?? 0) + 1;
        if (lacunasMun.exemplos_sem_exercicio.length < 30) lacunasMun.exemplos_sem_exercicio.push({ processo: nr, municipio: mun.nome, data_sessao: dec.data_sessao });
      }
      continue;
    }
    const doc = docDaSessao(entrada, dec.data_sessao);
    const orgaoJuris = entrada.docs.map((d) => municipioDoOrgao(d.orgao, porNome)).filter(Boolean);
    if (orgaoJuris.some((m) => m.id !== mun.id)) { lacunasMun.orgao_divergente.push({ processo: nr, municipio: mun.nome }); continue; }
    const itens = itensMunicipais(mun, exs[0], dec, doc, fontesDec.get(dec.ano_sessao));
    if (anteriores.length) for (const it of itens) it.lacunas.unshift(`O processo teve decisão com parecer também em sessão anterior (${anteriores.join(', ')}); mostra-se a mais recente`);
    novosPorMun.set(mun.id, [...(novosPorMun.get(mun.id) ?? []), ...itens]);
  }
  const existentes = (() => { try { return fs.readdirSync(dirPref).filter((n) => /^[a-z0-9-]+\.json$/.test(n)).map((n) => n.slice(0, -5)); } catch { return []; } })();
  const resumoMun = { municipios: 0, pareceres: 0, exercicios: 0, por_resultado: {} };
  const munPorId = new Map([...porNome.values()].map((m) => [m.id, m]));
  for (const id of [...new Set([...novosPorMun.keys(), ...existentes])].sort()) {
    const mun = munPorId.get(id);
    if (!mun) continue;
    const arq = path.join(dirPref, `${id}.json`);
    const d = montarArquivoMunicipio(mun, lerJson(arq), novosPorMun.get(id) ?? [], anosProcessados);
    if (!d.itens.length) continue;
    gravarSeMudou(arq, d, { compacto: true });
    resumoMun.municipios++;
    resumoMun.pareceres += d.itens.length;
    resumoMun.exercicios += d.contagens.exercicios;
    for (const it of d.itens) { const k = it.parecer.conclusao ?? 'sem resumo'; resumoMun.por_resultado[k] = (resumoMun.por_resultado[k] ?? 0) + 1; }
  }

  // ---- Governador
  const resumoGov = [];
  let fontePagina = null;
  let pag = null;
  if (!bloqueado('tcers.tc.br')) {
    try { pag = await baixarPaginaGovernador(); fontePagina = pag.fonte; } catch (e) { erros.push(`Governador (página oficial): ${e.message}`); if (e.bloqueio) bloqueios.push(e.message); }
  }
  // Sem a página oficial: só as decisões do Tribunal Pleno sobre contas do "GG - GABINETE DO GOVERNADOR" com parecer
  // por responsável e exercício na jurisprudência (regra conferida, em 06/11/2026, contra os processos da página).
  const viaDecisoes = !pag;
  if (viaDecisoes) {
    const linhas = [];
    const gg = todasDecisoes.filter((d) => /^(GG - )?GABINETE DO GOVERNADOR$/.test(d.nome_orgao) && d.orgao_julgador === 'Tribunal Pleno' && TIPOS_MUNICIPAIS.has(d.tipo_processo));
    for (const [nr, { dec }] of ultimaComParecer(gg)) {
      const exs = [...(juris.get(nr)?.exercicios ?? [])];
      if (exs.length !== 1) continue;
      const doc = docDaSessao(juris.get(nr), dec.data_sessao);
      linhas.push({ exercicio: exs[0], governador_literal: null, processo_formatado: doc?.processo_formatado ?? juris.get(nr).docs[0]?.processo_formatado ?? null, processo_url: null, nr_processo: nr, arquivos: [], situacao_literal: null });
    }
    const porEx = new Map();
    for (const l of linhas) porEx.set(l.exercicio, porEx.has(l.exercicio) ? null : l); // dois processos no mesmo exercício: não escolhe
    pag = { linhas: [...porEx.values()].filter(Boolean) };
  }
  if (pag) {
    try {
      const decGov = ultimaComParecer(todasDecisoes.filter((d) => pag.linhas.some((l) => l.nr_processo === d.nr_processo)));
      for (const linha of pag.linhas) {
        if (Number(linha.exercicio) >= anoAtual) continue; // exercício em curso
        const arq = path.join(SAIDA, 'contas-governador', `${linha.exercicio}.json`);
        const achado = linha.nr_processo ? decGov.get(linha.nr_processo) : null;
        const antigo = lerJson(arq);
        // Decisão de sessão fora dos anos baixados nesta execução: mantém o que já se sabia.
        if (!achado && antigo?.data_julgamento && !anosProcessados.has(Number(antigo.ano_sessao))) { resumoGov.push({ exercicio: linha.exercicio, mantido: true, conclusao: antigo.parecer?.conclusao_literal }); continue; }
        // Sem a página, um arquivo montado com ela (PDFs, governador) não é substituído por um mais pobre.
        if (viaDecisoes && antigo?.governador_literal) { resumoGov.push({ exercicio: linha.exercicio, mantido: true, conclusao: antigo.parecer?.conclusao_literal }); continue; }
        const doc = achado ? docDaSessao(juris.get(linha.nr_processo), achado.dec.data_sessao) : null;
        const item = itemGovernador(linha, achado?.dec ?? null, doc, achado ? fontesDec.get(achado.dec.ano_sessao) : null, fontePagina);
        if (viaDecisoes) item.lacunas.push('Página oficial "Parecer Prévio" (tcers.tc.br) inacessível ao coletor nesta execução; exercício e processo vêm da pesquisa de jurisprudência, sem os PDFs do parecer');
        gravarSeMudou(arq, item);
        resumoGov.push({ exercicio: linha.exercicio, processo: item.processo.numero, data_julgamento: item.data_julgamento, conclusao: item.parecer.conclusao_literal, relator: item.relator });
      }
    } catch (e) { erros.push(`Governador: ${e.message}`); if (e.bloqueio) bloqueios.push(e.message); }
  }

  // ---- meta
  const anosColetados = new Set([...(metaAntiga?.anos_de_sessao_coletados ?? []), ...anosProcessados]);
  const semExAntigo = metaAntiga?.lacunas_prefeitos?.decisoes_sem_exercicio_por_ano_de_sessao ?? {};
  const semEx = Object.fromEntries(Object.entries({ ...semExAntigo }).filter(([a]) => !anosProcessados.has(Number(a))));
  for (const a of anosProcessados) semEx[a] = lacunasMun.sem_exercicio[a] ?? 0;
  const meta = {
    atualizado_em: new Date().toISOString(),
    ultima_execucao: new Date().toISOString(),
    tribunal: 'tce-rs',
    modo: completo ? 'completo' : 'incremental',
    interrompido_por_orcamento: interrompido,
    anos_de_sessao_processados_nesta_execucao: [...anosProcessados].sort(),
    anos_de_sessao_coletados: [...anosColetados].sort(),
    anos_sem_arquivo_de_decisoes: semArquivo,
    contagens: {
      municipios_com_parecer: resumoMun.municipios,
      pareceres_municipais: resumoMun.pareceres,
      exercicios_municipais: resumoMun.exercicios,
      pareceres_municipais_por_resultado: resumoMun.por_resultado,
      exercicios_governador: resumoGov.length,
      exercicios_governador_com_parecer: resumoGov.filter((r) => r.conclusao).length,
      documentos_jurisprudencia_nesta_execucao: jurisDocs.length,
    },
    lacunas_prefeitos: {
      decisoes_sem_exercicio_por_ano_de_sessao: semEx,
      exemplos_sem_exercicio: lacunasMun.exemplos_sem_exercicio,
      exercicio_divergente_na_jurisprudencia: lacunasMun.exercicio_divergente,
      orgao_divergente_na_jurisprudencia: lacunasMun.orgao_divergente,
      orgaos_nao_casados_com_municipio: lacunasMun.nao_casados,
    },
    contas_governador: resumoGov,
    fontes: [
      ...[...fontesDec.values()],
      fonte('Portal de Dados Abertos do TCE-RS — conjuntos "Decisões" (um por ano)', paginaDecisoes(anoAtual)),
      fonte('Pesquisa de Jurisprudência do TCE-RS (base "Decisões")', PAGINA_PESQUISA),
      ...(fontePagina ? [fontePagina] : [fonte('Contas do Governador — página "Parecer Prévio" do TCE-RS', URL_PAGINA_GOVERNADOR)]),
    ],
    robots: resumoRobots(),
    robots_e_restricoes: [
      'robots.txt de dados.tce.rs.gov.br, portal.tce.rs.gov.br e tcers.tc.br lido no início de cada execução; host com robots inacessível não é consultado.',
      'dados.tce.rs.gov.br: só os arquivos de /dados/ (o /api/ do CKAN é proibido pelo robots.txt e não é usado), com o Crawl-delay de 10 s.',
      'portal.tce.rs.gov.br: só o serviço público de pesquisa de jurisprudência (sem login); /aplicprod/ é proibido pelo robots.txt e não é usado. Pausa de 3 s.',
      'tcers.tc.br: só a página "Parecer Prévio"; os PDFs não são baixados, apenas o link oficial é guardado. Pausa de 3 s.',
      'A lista de contas irregulares do portal de dados abertos traz CPF e não é usada.',
    ],
    observacoes: [
      'Contas dos prefeitos: o parecer de cada responsável é o texto literal do campo "DECISAO" dos arquivos anuais de decisões; o exercício vem do campo "Exercício" da pesquisa de jurisprudência para o mesmo processo. Sem exercício, a decisão não é mostrada e é contada em "lacunas_prefeitos".',
      'Nomes de município casados só por igualdade exata com a lista oficial do Siconfi (sem acentos, maiúsculas e apóstrofo como espaço); grafias diferentes ficam em "orgaos_nao_casados_com_municipio".',
      'Contas do Governador: exercício, governador, processo e PDFs vêm da página oficial; o parecer de cada responsável, da decisão do mesmo processo nos dados abertos (sessões desde 2011).',
      'Julgamento político (Assembleia Legislativa e Câmaras Municipais) ainda não coletado.',
    ],
    bloqueios,
    erros,
    estatisticas_http: { ...estatisticas, falhas: estatisticas.falhas.slice(0, 20) },
    duracao_s: Math.round((Date.now() - inicio) / 1000),
  };
  meta.ultima_coleta_completa = metaAntiga?.ultima_coleta_completa ?? null;
  if (completo && !interrompido && !erros.length && anosProcessados.size + semArquivo.length === anosAlvo.length) meta.ultima_coleta_completa = hojeISO();
  if (bloqueios.length && !anosProcessados.size && !resumoGov.length && metaAntiga) {
    // Nada coletado por bloqueio: registra no meta sem apagar os dados anteriores.
    gravarSeMudou(path.join(SAIDA, 'meta.json'), { ...metaAntiga, ultima_execucao: meta.ultima_execucao, bloqueios, erros, robots: meta.robots });
  } else gravarSeMudou(path.join(SAIDA, 'meta.json'), meta);

  console.log(JSON.stringify({ anos: meta.anos_de_sessao_processados_nesta_execucao, contagens: meta.contagens, sem_exercicio: semEx, nao_casados: lacunasMun.nao_casados, governador: resumoGov.length, interrompido, bloqueios, erros, gravados: contagemGravacao.gravados.length, inalterados: contagemGravacao.inalterados.length, http: { requisicoes: estatisticas.requisicoes, retentativas: estatisticas.retentativas, bytes: estatisticas.bytes } }, null, 2));
  if (erros.some((e) => !e.startsWith('Governador (página oficial)'))) process.exitCode = 1;
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
