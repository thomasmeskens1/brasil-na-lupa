// Coletor único do SPL da Ágape para as Assembleias de Sergipe (Alese) e da Bahia (ALBA):
// deputados, proposições com tramitação, deliberações oficiais registradas na tramitação e normas
// (SE: LegisOn/PGE + legislação da Alese; BA: Legisla Bahia se o robots.txt permitir, senão as
// leis citadas na tramitação da ALBA). Carga incremental com orçamento de tempo e cursor em
// dados/estados/<uf>/meta.json, priorizando o ano corrente.
//
// Uso: node scripts/coleta/estados/agape/coletar.mjs [--uf=se,ba] [--anos=2026,2025] [--max-paginas=N] [--sem-normas] [--forcar]
// Ambiente: COLETA_ORCAMENTO_MIN (padrão 20), COLETA_ANO_MINIMO (padrão 2023).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerJson, gravarSeMudou as gravarBruto, hojeISO, contagemGravacao } from '../../alesp/lib.mjs';
import { CASAS, LACUNA_SITUACAO_ALBA, TIPOS_LEGISON } from './casas.mjs';
import { ClienteHost, Bloqueado, SemTempo, USER_AGENT } from './http.mjs';
import { normParlamentar, indiceParlamentares, normProposicao } from './normalizar.mjs';
import { coletarLegison, coletarLegislacaoAlese, juntarNormasSE, normasDaTramitacao } from './normas.mjs';
import { montarParlamentares, montarVotacao, resumoVotacao, proposicaoPublicada, indiceNormas, fonte, anoDe } from './montar.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const gravar = (arq, obj) => gravarBruto(arq, JSON.parse(JSON.stringify(obj)));
const arg = (nome) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1] ?? null;
const lerDir = (dir, re) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => re.test(f)) : []);

const INICIO = Date.now();
const ORCAMENTO_MIN = Number(process.env.COLETA_ORCAMENTO_MIN || 20);
const PRAZO = INICIO + Math.max(1, ORCAMENTO_MIN * 60000 - 60000); // 1 min de folga para gravar
const HOJE = hojeISO();
const ANO_ATUAL = Number(HOJE.slice(0, 4));
const ANO_MINIMO = Number(process.env.COLETA_ANO_MINIMO || 2023);
const ANOS_ARG = arg('anos') ? arg('anos').split(',').map(Number).filter(Boolean) : null;
const MAX_PAGINAS = arg('max-paginas') ? Number(arg('max-paginas')) : Infinity;
const SEM_NORMAS = process.argv.includes('--sem-normas');
const FORCAR = process.argv.includes('--forcar'); // relê anos já completos hoje
const UFS = (arg('uf') || 'se,ba').split(',').map((x) => x.trim().toLowerCase()).filter((x) => CASAS[x]);
const POR_PAGINA = 50;

const diasDesde = (iso) => (iso ? Math.round((Date.parse(`${HOJE}T12:00:00Z`) - Date.parse(`${iso}T12:00:00Z`)) / 86400000) : Infinity);
/** Intervalo de reconferência de um ano já completo: ano corrente diário, anterior semanal, demais mensal. */
const intervaloDias = (ano) => (ano >= ANO_ATUAL ? 1 : ano === ANO_ATUAL - 1 ? 7 : 30);

function anosEmOrdem() {
  if (ANOS_ARG) return [...ANOS_ARG].sort((a, b) => b - a);
  const r = [];
  for (let a = ANO_ATUAL; a >= ANO_MINIMO; a--) r.push(a);
  return r;
}

async function coletarCasa(uf) {
  const cfg = CASAS[uf];
  const log = (m) => console.log(`[${cfg.uf}] ${m}`);
  const dir = path.join(RAIZ, 'dados', 'estados', uf);
  const metaAntigo = lerJson(path.join(dir, 'meta.json')) || {};
  const cursor = metaAntigo.cursor || {};
  cursor.proposicoes ||= {};
  cursor.normas ||= {};
  const mascaras = lerJson(path.join(dir, 'revisao', 'mascaras.json')) || {};
  const regras = (chave) => [...(mascaras['*'] || []), ...(mascaras[chave] || [])];
  const observacoes = [];
  const falhas = [];
  const robots = {};
  const fontes = [];

  // ---------------------------------------------------------------- estado gravado
  const props = new Map();
  for (const f of lerDir(path.join(dir, 'proposicoes'), /^indice-.+\.json$/)) {
    for (const p of lerJson(path.join(dir, 'proposicoes', f))?.itens || []) props.set(p.id_oficial, p);
  }
  const normasAntigas = new Map();
  for (const f of lerDir(path.join(dir, 'normas'), /^indice-.+\.json$/)) {
    for (const n of lerJson(path.join(dir, 'normas', f))?.itens || []) normasAntigas.set(n.id, n);
  }
  let parlamentares = (lerJson(path.join(dir, 'parlamentares.json'))?.itens || []).map((p) => ({ ...p }));

  // ---------------------------------------------------------------- SPL: robots, deputados, proposições
  const spl = new ClienteHost(cfg.host, { prazoMs: PRAZO, log });
  try {
    robots[cfg.host] = await spl.lerRobots();
    if (!robots[cfg.host].raiz_permitida) throw new Bloqueado(`robots.txt de ${cfg.host} não permite a coleta`);

    const novos = [];
    for (let pag = 1; pag <= 20; pag++) {
      const r = await spl.json(`/api/publico/parlamentar/?pag=${pag}&qtd=100`);
      const lista = r?.json?.parlamentares || [];
      novos.push(...lista.map((x) => normParlamentar(x, cfg)));
      const total = Number(r?.json?.total) || 0;
      if (!lista.length || novos.length >= total) break;
    }
    if (novos.length) parlamentares = novos;
    fontes.push(fonte(cfg, `Parlamentares — dados abertos do SPL da ${cfg.sigla}`, '/api/publico/parlamentar/', HOJE));
    log(`${parlamentares.length} parlamentares (${parlamentares.filter((p) => p.em_exercicio).length} em exercício)`);

    const ctx = { cfg, idx: indiceParlamentares(parlamentares), regras, hoje: HOJE, lacunaSituacao: LACUNA_SITUACAO_ALBA };
    fontes.push(fonte(cfg, `Proposições e tramitação — dados abertos do SPL da ${cfg.sigla}`, '/api/publico/proposicao/', HOJE));
    for (const ano of anosEmOrdem()) {
      const c = (cursor.proposicoes[ano] ||= { proxima_pagina: 1, paginas: null, total: null, concluido_em: null });
      const emAndamento = c.proxima_pagina > 1;
      if (!FORCAR && !emAndamento && c.concluido_em && diasDesde(c.concluido_em) < intervaloDias(ano)) continue;
      let lidas = 0;
      while (spl.cabe() && lidas < MAX_PAGINAS) {
        const r = await spl.json(`/api/publico/proposicao/?ano=${ano}&pag=${c.proxima_pagina}&qtd=${POR_PAGINA}`);
        const dados = r?.json?.Data || [];
        for (const x of dados) {
          const p = normProposicao(x, ctx);
          props.set(p.id_oficial, p);
        }
        lidas++;
        c.total = Number(r?.json?.total) || c.total;
        c.paginas = Number(r?.json?.Paginacao?.quantidade) || c.paginas;
        if (!dados.length || (c.paginas && c.proxima_pagina >= c.paginas)) {
          Object.assign(c, { proxima_pagina: 1, concluido_em: HOJE });
          break;
        }
        c.proxima_pagina++;
      }
      log(`proposições ${ano}: ${lidas} página(s) lida(s); ${c.concluido_em === HOJE ? 'ano completo' : `continua na página ${c.proxima_pagina} de ${c.paginas ?? '?'}`}`);
      if (!spl.cabe() || lidas >= MAX_PAGINAS) break;
    }
  } catch (e) {
    if (e instanceof SemTempo) log('orçamento de tempo esgotado; o cursor guarda onde parar');
    else { falhas.push(e.message); log(`interrompido: ${e.message}`); }
  }

  // ---------------------------------------------------------------- normas
  const normasNovas = new Map();
  const anosNormas = new Set();
  const fontesNormas = [];
  let abrangencia;
  if (cfg.normas.legison && !SEM_NORMAS) {
    abrangencia = 'Leis ordinárias, leis complementares, emendas constitucionais e decretos numerados do Estado de Sergipe (LegisOn, da PGE-SE), com o projeto de origem informado pela legislação da Alese; resoluções e decretos legislativos só pela Alese.';
    const L = cfg.normas.legison;
    const lg = new ClienteHost(L.host, { prazoMs: PRAZO, log });
    try {
      robots[L.host] = await lg.lerRobots();
      if (!robots[L.host].raiz_permitida) throw new Bloqueado(`robots.txt de ${L.host} não permite a coleta`);
      for (const ano of anosEmOrdem()) {
        const c = (cursor.normas[ano] ||= { concluido_em: null });
        if (!FORCAR && c.concluido_em && diasDesde(c.concluido_em) < intervaloDias(ano)) continue;
        if (!lg.cabe() || !spl.cabe()) break;
        const legison = [];
        let completo = true;
        for (const t of TIPOS_LEGISON) {
          const r = await coletarLegison(lg, ano, t, { portal: L.portal, host: L.host, hoje: HOJE, regras });
          legison.push(...r.itens);
          completo &&= r.completo;
        }
        let alese = { itens: [], completo: false };
        if (cfg.normas.alese_legislacao && robots[cfg.host]?.raiz_permitida) {
          try { alese = await coletarLegislacaoAlese(spl, ano); } catch (e) { if (e instanceof SemTempo) throw e; falhas.push(`legislação da Alese ${ano}: ${e.message}`); }
        }
        for (const n of juntarNormasSE(legison, alese.itens, { uf: cfg.uf, hoje: HOJE })) normasNovas.set(n.id, n);
        if (completo && alese.completo) { anosNormas.add(String(ano)); c.concluido_em = HOJE; }
        log(`normas ${ano}: ${legison.length} no LegisOn, ${alese.itens.length} na legislação da Alese${completo && alese.completo ? '' : ' (incompleto; continua na próxima execução)'}`);
        if (ANOS_ARG == null && ano < ANO_ATUAL - 1) break; // anos antigos: um por execução
      }
    } catch (e) {
      if (e instanceof SemTempo) log('orçamento de tempo esgotado nas normas');
      else { falhas.push(e.message); log(`normas interrompidas: ${e.message}`); }
    }
    fontesNormas.push(
      { titulo: 'LegisOn — API pública de atos (PGE-SE)', url: `https://${L.host}/api/v1/public/acts`, orgao: L.orgao, acessado_em: HOJE },
      fonte(cfg, 'Legislação — consulta por ano (Alese)', '/legislacao/consulta-legislacao.aspx', HOJE),
    );
  }
  if (cfg.normas.legisla_bahia) {
    const B = cfg.normas.legisla_bahia;
    const lb = new ClienteHost(B.host, { prazoMs: PRAZO, log });
    let motivo = 'Legisla Bahia (Casa Civil) não coletado';
    try {
      robots[B.host] = await lb.lerRobots();
      if (!robots[B.host].raiz_permitida || !lb.permite('/documentos')) {
        motivo = 'Legisla Bahia (Casa Civil) não coletado porque o robots.txt, lido segundo a RFC 9309, coloca "User-agent: *" no mesmo grupo de "Disallow: /"';
        observacoes.push(`${motivo}. As leis listadas vêm da tramitação oficial da ALBA ("Promulgada a Lei nº …", "Publicada a Lei nº …"); ementa e texto ficam como lacuna até o acesso ser permitido ou a curadoria conferir.`);
      } else {
        motivo = 'Legisla Bahia (Casa Civil) permitido pelo robots.txt, mas a leitura das páginas ainda não foi implementada neste coletor';
        observacoes.push(`${motivo}.`);
      }
    } catch (e) {
      if (!(e instanceof SemTempo)) falhas.push(e.message);
    }
    abrangencia = 'Normas citadas na tramitação oficial da ALBA como resultado de cada proposição (promulgação, publicação).';
    for (const n of normasDaTramitacao([...props.values()], cfg, { hoje: HOJE, motivo })) normasNovas.set(n.id, n);
    for (const n of normasNovas.values()) anosNormas.add(String(n.ano));
    fontesNormas.push(fonte(cfg, `Tramitação das proposições — dados abertos do SPL da ${cfg.sigla}`, '/api/publico/proposicao/', HOJE));
  }

  // ---------------------------------------------------------------- gravação
  const contagens = {};
  if (parlamentares.length) {
    gravar(path.join(dir, 'parlamentares.json'), montarParlamentares(parlamentares, cfg, HOJE));
    contagens.parlamentares = parlamentares.length;
    contagens.parlamentares_em_exercicio = parlamentares.filter((p) => p.em_exercicio).length;
  }
  const porAno = new Map();
  for (const p of props.values()) {
    const a = p.ano ? String(p.ano) : 'sem-ano';
    if (!porAno.has(a)) porAno.set(a, []);
    porAno.get(a).push(proposicaoPublicada(p));
  }
  for (const [ano, itens] of porAno) {
    itens.sort((a, b) => b.id_oficial - a.id_oficial);
    gravar(path.join(dir, 'proposicoes', `indice-${ano}.json`), {
      atualizado_em: HOJE, uf: cfg.uf, casa: cfg.casa, ano: Number(ano) || null,
      fonte: fonte(cfg, `Proposições de ${ano} — dados abertos do SPL da ${cfg.sigla}`, `/api/publico/proposicao/?ano=${ano}`, HOJE),
      observacao: 'Tramitação completa só nos tipos que podem virar norma (projetos, PEC, vetos, mensagens); nos demais, a última tramitação. Ementa e textos com as regras de privacidade do projeto.',
      itens,
    });
  }
  contagens.proposicoes = props.size;
  contagens.proposicoes_por_ano = Object.fromEntries([...porAno].map(([a, l]) => [a, l.length]).sort());

  const resumos = new Map();
  const validos = new Set();
  for (const p of props.values()) {
    for (const d of p.deliberacoes || []) {
      const v = montarVotacao(p, d, cfg);
      validos.add(`${v.id}.json`);
      gravar(path.join(dir, 'votacoes', `${v.id}.json`), v);
      const a = anoDe(v.data || v.data_registro);
      if (!resumos.has(a)) resumos.set(a, []);
      resumos.get(a).push(resumoVotacao(v));
    }
  }
  for (const f of lerDir(path.join(dir, 'votacoes'), /^[a-z]{2}-\d+-[\d-]+\.json$/)) {
    if (!validos.has(f)) fs.rmSync(path.join(dir, 'votacoes', f)); // deliberação que não consta mais da tramitação
  }
  for (const [ano, itens] of resumos) {
    itens.sort((a, b) => String(b.data || b.data_registro || '').localeCompare(String(a.data || a.data_registro || '')) || a.id.localeCompare(b.id));
    gravar(path.join(dir, 'votacoes', `indice-${ano}.json`), {
      atualizado_em: HOJE, uf: cfg.uf, casa: cfg.casa,
      observacao: 'Deliberações registradas no texto oficial da tramitação. A Casa não publica o voto de cada deputado: "Informação não disponível em fonte oficial".',
      itens,
    });
  }
  contagens.votacoes = validos.size;

  // Normas: ano coletado por inteiro substitui o gravado; ano parcial soma ao que já existia.
  const normas = new Map(normasAntigas);
  if (cfg.normas.da_tramitacao) for (const [id, n] of normas) if (anosNormas.has(String(n.ano))) normas.delete(id);
  for (const [id, n] of normas) if (cfg.normas.legison && anosNormas.has(String(n.ano)) && !normasNovas.has(id)) normas.delete(id);
  for (const [id, n] of normasNovas) normas.set(id, n);
  const normasPorAno = new Map();
  for (const n of normas.values()) {
    const a = n.ano ? String(n.ano) : 'sem-ano';
    if (!normasPorAno.has(a)) normasPorAno.set(a, []);
    normasPorAno.get(a).push(n);
  }
  for (const [ano, itens] of normasPorAno) {
    gravar(path.join(dir, 'normas', `indice-${ano}.json`), indiceNormas(itens, cfg, ano, HOJE, fontesNormas, abrangencia));
  }
  contagens.normas = normas.size;

  observacoes.push(
    'Voto de cada deputado: a Casa não publica; o site mostra o resultado oficial e "Informação não disponível em fonte oficial" para o voto individual, sem deduzir voto de "unanimidade" ou de notícia.',
    'Deliberação = trecho da tramitação que diz literalmente "aprovado(a)" ou "rejeitado(a)"; parecer "pela aprovação" é opinião e fica só na tramitação.',
    'Autor que não é deputado nem órgão público aparece como "[nome de particular omitido]"; CPF/CNPJ, telefone e endereço do autor nunca são gravados.',
  );
  if (cfg.casa === 'alese') observacoes.push('Endereços de arquivo com domínio duplicado na API da Alese são corrigidos. O "Resumo Gerado com Inteligência Artificial" das páginas da Alese não é usado.');
  if (cfg.casa === 'alba') observacoes.push(LACUNA_SITUACAO_ALBA, 'Detalhe de sessão da API da ALBA (/api/publico/spl/sessoes/?id=) devolveu HTTP 500 na pesquisa; sessões não são coletadas por este coletor.');

  const meta = {
    atualizado_em: new Date().toISOString(),
    ultima_execucao: new Date().toISOString(),
    uf: cfg.uf, casa: cfg.casa, nome: cfg.nome,
    periodo: { anos: Object.keys(contagens.proposicoes_por_ano).filter((a) => /^\d{4}$/.test(a)) },
    modo: 'incremental',
    orcamento_min: ORCAMENTO_MIN,
    user_agent: USER_AGENT,
    contagens,
    fontes: [...fontes, ...fontesNormas],
    robots,
    requisicoes: Object.fromEntries([[cfg.host, spl.estat.requisicoes]]),
    falhas: [...falhas, ...spl.estat.falhas].slice(0, 50),
    observacoes,
    cursor,
  };
  gravar(path.join(dir, 'meta.json'), meta);
  log(`gravado: ${contagens.proposicoes} proposições, ${contagens.votacoes} deliberações, ${contagens.normas} normas`);
  return { uf: cfg.uf, contagens, falhas: meta.falhas };
}

const resultados = await Promise.all(UFS.map((uf) => coletarCasa(uf).catch((e) => ({ uf, erro: e.stack || e.message }))));
console.log(JSON.stringify({ duracao_s: Math.round((Date.now() - INICIO) / 1000), gravacao: contagemGravacao, resultados }, null, 2));
if (resultados.some((r) => r.erro)) process.exitCode = 1;
