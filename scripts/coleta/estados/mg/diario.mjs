// Parser das atas de Plenário publicadas no Diário do Legislativo da ALMG (texto corrido do PDF).
// Lê só votações pelo processo nominal ("Procede-se à votação por meio eletrônico" + listas
// "Registraram “sim”: Nome (Partido)…"). Cada votação só é aceita se: (1) cada lista tem exatamente o
// total proclamado na própria ata para aquela opção; (2) todo nome confere com a lista oficial de
// deputados da API; (3) nenhum nome aparece duas vezes; (4) a lista é atribuível a uma única votação
// eletrônica; (5) a proposição e a data da reunião são identificadas. Senão, a votação é recusada com motivo.
import { normalizarNome } from '../rs/lib.mjs';

/** Versão do parser: ao mudar, edições que tiveram votações recusadas são lidas de novo. */
export const VERSAO_PARSER = 3;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const RE_CAB_PAGINA = new RegExp(`^(?:Segunda|Terça|Quarta|Quinta|Sexta)-feira|^(?:Sábado|Domingo),`, 'i');
const RE_DATA_CAB = new RegExp(`^(?:(?:Segunda|Terça|Quarta|Quinta|Sexta)-feira|Sábado|Domingo), \\d{1,2}º? de (?:${MESES.join('|')}) de \\d{4}$`, 'i');
const RE_RODAPE = /^Página \d+ de \d+\s+www\.almg\.gov\.br$/i;
const ASPAS = '[“”"]';

/** Junta as páginas, tirando cabeçalho de data e rodapé de cada página. */
export function limparTexto(paginas) {
  const linhas = [];
  for (const p of paginas) {
    for (const l of String(p || '').split(/\r?\n/)) {
      const t = l.replace(/\s+/g, ' ').trim();
      if (!t || RE_RODAPE.test(t) || (RE_CAB_PAGINA.test(t) && RE_DATA_CAB.test(t))) continue;
      linhas.push(t);
    }
  }
  return linhas;
}

const RE_ATA = /^ATA DA (?:(\d+)ª )?REUNI[ÃA]O (ORDIN[ÁA]RIA|EXTRAORDIN[ÁA]RIA|ESPECIAL|SOLENE|PREPARAT[ÓO]RIA)\b(.*)$/i;

/** Separa as atas; devolve só as de Plenário (o cabeçalho não menciona comissão). */
export function separarAtas(linhas) {
  const atas = [];
  let atual = null;
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const m = RE_ATA.exec(l);
    if (m) {
      // O cabeçalho pode continuar na linha seguinte.
      let cab = l;
      if (!/\d{1,2}\/\d{1,2}\/\d{4}\s*$/.test(cab) && linhas[i + 1] && !RE_ATA.test(linhas[i + 1])) cab += ' ' + linhas[i + 1];
      const plenario = !/COMISS[ÃA]O|CPI|COMIT[ÊE]/i.test(m[3] + ' ' + (cab === l ? '' : linhas[i + 1]));
      // Data com ou sem zero à esquerda (ex.: "EM 12/8/2026"); valida dia e mês.
      const dm = /EM (\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(cab);
      const d = dm && Number(dm[1]) >= 1 && Number(dm[1]) <= 31 && Number(dm[2]) >= 1 && Number(dm[2]) <= 12
        ? [dm[0], dm[1].padStart(2, '0'), dm[2].padStart(2, '0'), dm[3]] : null;
      atual = {
        cabecalho: cab, plenario,
        numero: m[1] ? Number(m[1]) : null,
        tipo: m[2].toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
        data: d ? `${d[3]}-${d[2]}-${d[1]}` : null,
        linhas: [],
      };
      atas.push(atual);
      continue;
    }
    if (atual) atual.linhas.push(l);
  }
  return atas.filter((a) => a.plenario);
}

const TIPOS_PROP = [
  ['Proposta de Emenda à Constituição', 'PEC'], ['Projeto de Lei Complementar', 'PLC'], ['Projeto de Resolução', 'PRE'],
  ['Projeto de Lei', 'PL'], ['Veto', 'VET'], ['Requerimento', 'RQN'],
];
const RE_PROP = new RegExp(`(${TIPOS_PROP.map((t) => t[0]).join('|')}) nº ([\\d.]+)/(\\d{4})`);
export function acharProposicao(texto) {
  const m = RE_PROP.exec(texto || '');
  if (!m) return null;
  return { sigla: TIPOS_PROP.find((t) => t[0] === m[1])[1], tipo: m[1], numero: Number(m[2].replace(/\./g, '')), ano: Number(m[3]) };
}

const RE_LISTA = new RegExp(`^– Registraram ${ASPAS}([^“”"]+)${ASPAS}:?$`);
const RE_NOME = /^(.+?) \(([^()]+)\)$/;
const RE_PROCEDE = /Procede-se à votação por meio eletrônico/;
const RE_MATERIA = /(?:Discussão|Votação),? em (turno único|[12]º turno),? d[oa]s? /;

/** Totais proclamados no trecho (último valor citado para cada opção vale). */
export function totaisProclamados(texto) {
  const t = {};
  for (const m of texto.matchAll(new RegExp(`[Vv]otaram ${ASPAS}([^“”"]+)${ASPAS} (\\d+)`, 'g'))) t[m[1].toLowerCase()] = Number(m[2]);
  if (/[Nn]ão houve voto contrário/.test(texto) && t['não'] == null) t['não'] = 0;
  if (/[Nn]ão houve voto favorável/.test(texto) && t.sim == null) t.sim = 0;
  return t;
}

/**
 * Lê as votações nominais de uma ata. mapaDeputados: nome normalizado → { id, nome }.
 * Devolve { aceitas: [...], recusadas: [{ ordem, motivo, ... }] }.
 */
export function lerVotacoesDaAta(ata, mapaDeputados) {
  const L = ata.linhas;
  // 1. Eventos: votações eletrônicas (procede) e grupos de listas.
  const eventos = [];
  for (let i = 0; i < L.length; i++) {
    if (RE_PROCEDE.test(L[i])) { eventos.push({ tipo: 'procede', i }); continue; }
    const ml = RE_LISTA.exec(L[i]);
    if (ml) {
      const nomes = [];
      let j = i + 1;
      for (; j < L.length; j++) {
        const mn = RE_NOME.exec(L[j]);
        if (!mn || RE_LISTA.test(L[j]) || /^(A|O) president/i.test(L[j])) break;
        nomes.push({ nome: mn[1].trim(), partido: mn[2].trim() });
      }
      const ult = eventos[eventos.length - 1];
      const lista = { opcao: ml[1].trim().toLowerCase(), opcao_texto: ml[1].trim(), nomes, i };
      if (ult?.tipo === 'listas' && ult.fim === i) { ult.listas.push(lista); ult.fim = j; } else eventos.push({ tipo: 'listas', listas: [lista], i, fim: j });
      i = j - 1;
    }
  }
  const aceitas = [], recusadas = [];
  let ordem = 0;
  let procedesSemLista = [];
  let fimAnterior = 0;
  for (let e = 0; e < eventos.length; e++) {
    const ev = eventos[e];
    if (ev.tipo === 'procede') { ordem++; procedesSemLista.push({ ...ev, ordem, desde: fimAnterior }); fimAnterior = ev.i + 1; continue; }
    fimAnterior = ev.fim;
    // ev = grupo de listas
    if (procedesSemLista.length !== 1) {
      const motivo = procedesSemLista.length === 0
        ? 'lista nominal sem votação eletrônica correspondente na ata'
        : `uma única lista nominal para ${procedesSemLista.length} votações eletrônicas seguidas: não é possível atribuí-la a uma delas`;
      for (const p of procedesSemLista.length ? procedesSemLista : [{ ordem: null, i: ev.i }]) recusadas.push({ ordem: p.ordem, linha: p.i, motivo });
      procedesSemLista = [];
      continue;
    }
    const p = procedesSemLista[0];
    procedesSemLista = [];
    const r = montarRegistro(ata, L, p, ev, mapaDeputados, materiaEmDiscussao(L, p.i));
    if (r.motivo) recusadas.push({ ordem: p.ordem, linha: p.i, motivo: r.motivo, proposicao: r.proposicao || null });
    else aceitas.push({ ordem: p.ordem, ...r.registro });
  }
  for (const p of procedesSemLista) recusadas.push({ ordem: p.ordem, linha: p.i, motivo: 'votação eletrônica sem lista nominal publicada na ata' });
  return { aceitas, recusadas };
}

/** Última matéria anunciada ("Discussão/Votação, em … turno, do …") antes da linha i, em toda a ata. */
function materiaEmDiscussao(L, i) {
  for (let k = i - 1; k >= 0; k--) {
    if (!RE_MATERIA.test(L[k])) continue;
    const t = L.slice(k, Math.min(k + 4, i)).join(' ');
    const idx = t.search(RE_MATERIA);
    const prop = acharProposicao(t.slice(idx));
    if (prop) return { texto: t.slice(idx, idx + 600), proposicao: prop };
  }
  return null;
}

function montarRegistro(ata, L, p, grupo, mapaDeputados, emDiscussao) {
  // Trecho anterior: desde o evento anterior (votação ou lista) até esta votação; a matéria é a
  // última menção "Discussão/Votação, em ... turno, do ..." desse trecho.
  const antes = L.slice(p.desde, p.i).join(' ');
  const proclamacao = L.slice(p.i + 1, grupo.i).join(' ');
  const ocorr = [...antes.matchAll(new RegExp(RE_MATERIA.source, 'g'))];
  const materia = ocorr.length ? antes.slice(ocorr[ocorr.length - 1].index) : antes;
  let proposicao = acharProposicao(materia) || acharProposicao(proclamacao);
  let identificacao = 'trecho-da-votacao';
  // Votações de emendas/destaques: a matéria foi anunciada antes, na mesma discussão, e não se repete no trecho.
  if (!proposicao && emDiscussao) { proposicao = emDiscussao.proposicao; identificacao = 'materia-em-discussao'; }
  if (!ata.data) return { motivo: 'data da reunião não identificada no cabeçalho da ata' };
  if (!proposicao) return { motivo: 'proposição votada não identificada no texto da ata' };
  const textoMateria = identificacao === 'materia-em-discussao' ? emDiscussao.texto : materia;
  const turno = RE_MATERIA.exec(textoMateria)?.[1] || null;
  const objetos = [...antes.matchAll(/Em votação, (?:a |o |os |as )?(.+?)\.(?=\s+[–A-ZÀ-Ý(]|\s*$)/g)].map((m) => m[1].trim());
  const objeto = objetos.length ? objetos[objetos.length - 1] : null;
  const orientacao = /([^.]*registrarão[^.]*\.)/.exec(antes)?.[1]?.trim() || null;
  const totais = totaisProclamados(proclamacao);
  const resultadoTexto = /(Está(?:,? portanto,)? (?:aprovad|rejeitad)[ao][^.]*\.)/.exec(proclamacao)?.[1] || null;
  // Conferências
  const vistos = new Set();
  const votos = [];
  const naoEncontrados = [];
  for (const lista of grupo.listas) {
    for (const n of lista.nomes) {
      const k = normalizarNome(n.nome);
      if (vistos.has(k)) return { motivo: `nome repetido nas listas: ${n.nome}`, proposicao };
      vistos.add(k);
      const dep = mapaDeputados.get(k);
      if (!dep) naoEncontrados.push(n.nome);
      votos.push({ parlamentar_id: dep ? String(dep.id) : null, nome: n.nome, partido: n.partido, uf: 'MG', voto: lista.opcao_texto.charAt(0).toUpperCase() + lista.opcao_texto.slice(1) });
    }
  }
  if (naoEncontrados.length) return { motivo: `nomes sem correspondência na lista oficial de deputados: ${naoEncontrados.join(', ')}`, proposicao };
  const opcoesLista = new Map(grupo.listas.map((l) => [l.opcao, l.nomes.length]));
  if (grupo.listas.length !== opcoesLista.size) return { motivo: 'opção de voto repetida em duas listas', proposicao };
  for (const [op, n] of opcoesLista) {
    if (totais[op] == null) return { motivo: `total de votos "${op}" não proclamado na ata (lista com ${n} nomes)`, proposicao };
    if (totais[op] !== n) return { motivo: `lista "${op}" com ${n} nomes, mas a ata proclama ${totais[op]}`, proposicao };
  }
  for (const [op, n] of Object.entries(totais)) {
    if (n > 0 && !opcoesLista.has(op)) return { motivo: `ata proclama ${n} votos "${op}" mas não publica a lista correspondente`, proposicao };
  }
  votos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const placar = { sim: totais.sim ?? 0, nao: totais['não'] ?? 0, abstencao: 0, obstrucao: 0, outros: 0 };
  for (const [op, n] of Object.entries(totais)) if (op !== 'sim' && op !== 'não') placar.outros += n;
  const res = /rejeitad/.test(resultadoTexto || '') ? 'rejeitada' : /aprovad/.test(resultadoTexto || '') ? 'aprovada' : null;
  return {
    registro: {
      proposicao, turno, objeto, orientacao_registro: orientacao,
      materia_texto: textoMateria.slice(0, 600),
      proposicao_identificada_por: identificacao,
      proclamacao_texto: proclamacao.slice(0, 1200),
      resultado: res, resultado_texto_oficial: resultadoTexto,
      placar, totais_proclamados: totais, votos,
    },
  };
}
