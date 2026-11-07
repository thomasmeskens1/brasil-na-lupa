// Lê os dados já coletados em dados/ e monta, para cada item de cada seção, tudo o que o gerador e o
// verificador precisam: dado bruto, modelo estruturado (construir → título "estruturado" ou null),
// etiqueta (etiquetar), título oficial, subtítulo, universo numérico oficial, nomes de pessoas ligados
// ao item e o que consultar nas fontes externas (só para o tema). Sem rede.
import path from 'node:path';
import { DADOS, jsonsDe, lerJson, dataBR } from './lib.mjs';
import { universoNumerico, limpar as limparBase } from './texto.mjs';
import { tipoDoAto } from './temas.mjs';
import { chaveNormaSp } from './fontes.mjs';
import { subtituloVotacao, oficialVotacao, etiquetaVotacao, quorumAplicavel } from './modelos-votacoes.mjs';
import { subtituloMp, estruturadoMp, etiquetaMp, subtituloVeto, etiquetaVeto, estruturadoNorma, etiquetaNorma, modeloIcms, etiquetaIcms, modeloContasTce, etiquetaContasTce, contagemVeto } from './modelos-atos.mjs';
import { etiquetaTemaStj, etiquetaTemaStf, etiquetaSumulaVinculante } from './modelos-justica.mjs';
import { mascararTexto } from '../stf/privacidade.mjs';

// Diretriz 12: texto livre de tribunal passa pelo mascaramento de nomes de particulares (idempotente).
const limpar = (s) => limparBase(s);
const limparJud = (s) => limparBase(mascararTexto(limparBase(s)).texto);
const nada = () => null;

export const SECOES = ['camara', 'senado', 'executivo', 'stj', 'stf', 'alesp', 'governo-sp', 'atibaia', 'icms', 'tribunais-contas'];

const P = (...p) => path.join(DADOS, ...p);
const sem = (obj, campos) => {
  if (!obj || typeof obj !== 'object') return obj;
  const o = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const c of campos) delete o[c];
  return o;
};
const PESADOS_VOTO = ['votos', 'orientacoes', 'comparecimento', 'votos_por_tipo', 'fontes', 'fonte', 'url', 'lacunas', 'partidos_em_obstrucao', 'conferencia_placar'];

/** Nomes de pessoas conhecidos (parlamentares, ministros, vereadores) — para o verificador. */
let NOMES_GLOBAIS = null;
export function nomesGlobais() {
  if (NOMES_GLOBAIS) return NOMES_GLOBAIS;
  const s = new Set();
  const add = (n) => { n = limpar(n); if (n && n.split(' ').length >= 2) s.add(n); };
  for (const f of ['camara/parlamentares.json', 'senado/parlamentares.json', 'alesp/parlamentares.json', 'atibaia/vereadores.json', 'stj/ministros.json', 'stf/ministros.json']) {
    for (const i of lerJson(P(f))?.itens || []) { add(i.nome); add(i.nome_civil); }
  }
  NOMES_GLOBAIS = [...s];
  return NOMES_GLOBAIS;
}
function nomesDoItem(raw) {
  const s = new Set();
  const visitar = (v, k) => {
    if (!v) return;
    if (Array.isArray(v)) { v.forEach((x) => visitar(x, k)); return; }
    if (typeof v === 'object') { for (const [kk, x] of Object.entries(v)) visitar(x, kk); return; }
    if (typeof v === 'string' && /^(nome|nome_civil|relator|presidente|redator_acordao|autor)$/.test(k || '')) s.add(limpar(v));
  };
  visitar(raw);
  return [...s];
}

/** Troca partido, autor, governo e nomes por marcadores: o modelo tem de dar a mesma frase. */
export function perturbar(raw) {
  const CAMPOS = /^(partido|partido_na_fonte|autor|autores|autoria|autoria_na_ementa|nome|nome_civil|relator|presidente|bancada|orientacao|partidos_em_obstrucao|governo|presidente_votacao|redator_acordao|responsaveis)$/;
  const visitar = (v) => {
    if (Array.isArray(v)) return v.map(visitar);
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) o[k] = CAMPOS.test(k) ? (typeof x === 'string' ? 'OUTRO-PARTIDO' : Array.isArray(x) ? [] : x) : visitar(x);
      return o;
    }
    return v;
  };
  return visitar(raw);
}

/** Identificação comum da proposição ("PLP 125/2022"), para ligar votações, MPs e normas (consistência). */
export function chaveDe(sigla, numero, ano) {
  return sigla && numero && ano ? `${sigla} ${Number(String(numero).replace(/\./g, ''))}/${ano}` : null;
}
function comQuorum(u, v) {
  const q = quorumAplicavel(v);
  if (q && v.resultado === 'rejeitada' && v.placar?.sim > v.placar?.nao) u.add(String(q));
  return u;
}

function item(base) {
  return { nomes: nomesDoItem(base.raw), rotulos: [], consultas: {}, nominal: false, construir: nada, etiquetar: nada, ...base };
}

// ---------- Votações ----------
function votacoes(casa, dir, filtro, extraConsultas) {
  return jsonsDe(dir, filtro).map(({ arquivo }) => lerJson(arquivo)).filter((v) => v && v.id).map((v) => {
    return item({
      secao: casa, id: String(v.id), tipo: 'votacao', raw: v,
      construir: nada, etiquetar: (r) => etiquetaVotacao(r),
      oficial: oficialVotacao(v), subtitulo: subtituloVotacao(v),
      universo: comQuorum(universoNumerico(sem(v, PESADOS_VOTO)), v),
      textos: [v.proposicao?.ementa, v.descricao, v.materia_votada].filter(Boolean),
      chave: chaveDe(v.proposicao?.sigla, v.proposicao?.numero, v.proposicao?.ano),
      nominal: v.tipo === 'nominal',
      consultas: extraConsultas(v),
      rotulos: casa === 'alesp' ? [{ fonte: 'tipo', valor: tipoDoAto(v.proposicao?.ementa) || 'outro' }] : [],
      data: v.data,
    });
  });
}

// ---------- Seções ----------
export function carregarSecao(secao) {
  switch (secao) {
    case 'camara':
      return votacoes('camara', P('camara/votacoes'), () => true, (v) => ({ camaraId: v.proposicao?.id, mpCamara: v.proposicao?.sigla === 'MPV' ? v.proposicao.id : null }));
    case 'senado':
      return votacoes('senado', P('senado/votacoes'), (f) => /^\d+\.json$/.test(f), (v) => ({ senadoProcesso: v.proposicao?.id, senadoMateria: v.proposicao?.codigo_materia ? String(v.proposicao.codigo_materia) : null, mpSenado: v.proposicao?.sigla === 'MPV' ? v.proposicao.id : null }));
    case 'alesp':
      return votacoes('alesp', P('alesp/votacoes'), () => true, (v) => ({ alespProcesso: v.proposicao?.id || null }));
    case 'executivo': return executivo();
    case 'stj':
      return jsonsDe(P('stj/temas')).map(({ arquivo }) => lerJson(arquivo)).filter((t) => t && t.id).map((t) => item({
        secao, id: t.id, tipo: 'tese', raw: t, construir: nada, etiquetar: (r) => etiquetaTemaStj(r),
        oficial: { titulo: limparJud(t.tese || t.questao || `Tema Repetitivo ${t.numero} do STJ`), fonte: t.url_oficial },
        subtitulo: [`Tema Repetitivo ${t.numero}`, t.orgao ? `${t.orgao} do Superior Tribunal de Justiça` : 'Superior Tribunal de Justiça', t.situacao].filter(Boolean).join(' · '),
        universo: universoNumerico(sem(t, ['processos', 'fontes', 'pautas', 'anotacoes_nugepnac', 'informacoes_complementares', 'delimitacao_julgado'])),
        rotulos: (t.assuntos || []).map((a) => ({ fonte: 'assunto-judicial', valor: a.descricao })),
        consultas: { tpu: (t.assuntos || []).map((a) => a.codigo).filter(Boolean) },
        data: t.datas?.julgamento || t.datas?.afetacao,
      }));
    case 'stf': return stf();
    case 'governo-sp':
      return [2025, 2026].flatMap((a) => lerJson(P(`governo-sp/normas/indice-${a}.json`))?.itens || []).map((n) => normaItem(secao, n, 'sp', { id: n.id, tipo: n.tipo, ementa: n.ementa, fonte: n.url || n.fonte?.url, data: n.data_ato }, `${n.tipo} estadual nº ${n.numero}`));
    case 'atibaia':
      return [2025, 2026].flatMap((a) => lerJson(P(`atibaia/normas/indice-${a}.json`))?.itens || []).map((n) => normaItem(secao, n, 'atibaia', { id: n.id, tipo: n.tipo, ementa: n.ementa_publica, fonte: n.url || n.fonte?.url, data: n.data }, `${n.tipo} municipal nº ${n.numero}`, ['ementa']));
    case 'icms':
      return (lerJson(P('icms/decisoes.json'))?.itens || []).map((d) => item({
        secao, id: d.id, tipo: 'icms', raw: d, construir: (r) => modeloIcms(r), etiquetar: (r) => etiquetaIcms(r),
        oficial: { titulo: limpar(d.titulo), fonte: d.fontes?.[0]?.url },
        subtitulo: [`${d.instrumento} ${d.numero}`, d.orgao, dataBR(d.datas?.decisao || d.datas?.publicacao)].filter(Boolean).join(' · '),
        universo: universoNumerico(sem(d, ['responsaveis', 'fontes', 'termos', 'relacionados'])),
        rotulos: [{ fonte: 'tipo', valor: 'icms' }], data: d.datas?.decisao || d.datas?.publicacao,
      }));
    case 'tribunais-contas': return contas();
    default: return [];
  }
}

function normaItem(secao, bruto, esfera, n, nomeOficial, ocultar = []) {
  const raw = sem(bruto, ocultar);
  return item({
    secao, id: n.id, tipo: 'norma', raw,
    construir: (r) => estruturadoNorma({ ...n, ementa: esfera === 'atibaia' ? r.ementa_publica : r.ementa }, esfera),
    etiquetar: () => etiquetaNorma(n, esfera),
    oficial: { titulo: limpar(n.ementa), fonte: n.fonte },
    subtitulo: [raw.nome_oficial || nomeOficial, esfera === 'federal' ? raw.forma : esfera === 'sp' ? 'Governo do Estado de São Paulo · ato individual' : 'Município de Atibaia', dataBR(n.data)].filter(Boolean).join(' · '),
    universo: universoNumerico(sem(raw, ['fonte', 'edicao', 'publicacao_dou', 'links', 'ids_oficiais'])),
    rotulos: [{ fonte: 'tipo', valor: tipoDoAto(n.ementa) || 'outro' }],
    consultas: esfera === 'federal'
      ? { ...(raw.projeto_origem?.[0] ? normaConsultas(raw.projeto_origem[0]) : {}), senadoNorma: raw.ids_oficiais?.senado_norma || null }
      : esfera === 'sp' && /^(Decreto|Lei|Lei Complementar)$/.test(n.tipo) ? { normaSp: chaveNormaSp(n.tipo, raw.numero, String(n.data || '').slice(0, 4)) } : {},
    textos: [n.ementa].filter(Boolean),
    chave: esfera === 'federal' && raw.projeto_origem?.[0]?.identificacao ? chaveDe(...raw.projeto_origem[0].identificacao.split(/[\s/]/)) : null,
    data: n.data,
  });
}
function normaConsultas(po) {
  const m = /^(\w+)\s+(\d+)\/(\d{4})$/.exec(po.identificacao || '');
  return {
    senadoProcesso: po.senado_processo || null, senadoMateria: po.senado_materia || null,
    camaraBusca: m ? { sigla: m[1], numero: m[2], ano: m[3] } : null,
  };
}

function executivo() {
  const out = [];
  for (const { arquivo } of jsonsDe(P('executivo/medidas-provisorias'), (f) => f.startsWith('mpv-'))) {
    const mp = lerJson(arquivo); if (!mp) continue;
    out.push(item({
      secao: 'executivo', id: mp.id, tipo: 'mp', raw: mp, construir: (r) => estruturadoMp(r), etiquetar: (r) => etiquetaMp(r),
      oficial: { titulo: limpar(mp.ementa), fonte: mp.links?.planalto || mp.fontes?.[0]?.url }, subtitulo: subtituloMp(mp),
      universo: universoNumerico(sem(mp, ['exposicao_motivos', 'justificativa', 'votacoes', 'fontes', 'prazos', 'links', 'ids_oficiais'])),
      consultas: { senadoProcesso: mp.ids_oficiais?.senado_processo, senadoMateria: mp.ids_oficiais?.senado_materia, camaraId: mp.ids_oficiais?.camara_proposicao, mpCongresso: true },
      textos: [mp.ementa].filter(Boolean), chave: chaveDe('MPV', mp.numero, mp.ano),
      data: mp.datas?.edicao,
    }));
  }
  for (const { arquivo } of jsonsDe(P('executivo/vetos'), (f) => f.startsWith('vet-'))) {
    const vet = lerJson(arquivo); if (!vet) continue;
    const c = contagemVeto(vet);
    const u = universoNumerico(sem(vet, ['dispositivos', 'fontes', 'links', 'ids_oficiais', 'resultado_pdfs']));
    for (const n of Object.values(c)) u.add(String(n));
    out.push(item({
      secao: 'executivo', id: vet.id, tipo: 'veto', raw: vet,
      construir: nada, etiquetar: (r) => etiquetaVeto(r), oficial: { titulo: limpar(vet.ementa), fonte: vet.links?.senado || vet.fontes?.[0]?.url },
      subtitulo: subtituloVeto(vet), universo: u,
      consultas: { senadoProcesso: vet.ids_oficiais?.senado_processo },
      rotulos: vet.assunto_congresso && /^PLOA|^PLN|Orçament/i.test(vet.assunto_congresso) ? [{ fonte: 'tipo', valor: 'veto-orcamento' }] : [],
      data: vet.datas?.publicacao,
    }));
  }
  for (const a of [2025, 2026]) {
    for (const n of lerJson(P(`executivo/normas/indice-${a}.json`))?.itens || []) {
      out.push(normaItem('executivo', n, 'federal', { id: n.id, tipo: n.tipo, ementa: n.ementa, fonte: n.links?.planalto || n.links?.senado_norma, data: n.data_assinatura }, n.nome_oficial));
    }
  }
  return out;
}

function stf() {
  const out = [];
  for (const { arquivo } of jsonsDe(P('stf/repercussao-geral'))) {
    const t = lerJson(arquivo); if (!t || t.numero == null) continue;
    out.push(item({
      secao: 'stf', id: `stf-tema-${t.numero}`, tipo: 'tese', raw: t, construir: nada, etiquetar: (r) => etiquetaTemaStf(r),
      oficial: { titulo: limparJud(t.titulo || t.tese || `Tema ${t.numero}`), fonte: t.url },
      subtitulo: [`Tema ${t.numero} de repercussão geral`, t.leading_case?.identificacao ? `leading case ${t.leading_case.identificacao}` : null, 'Supremo Tribunal Federal', t.situacao?.andamento].filter(Boolean).join(' · ').replace('leading case', 'processo paradigma'),
      universo: universoNumerico(sem(t, ['fontes', 'links_oficiais'])),
      rotulos: (t.assuntos || []).map((a) => ({ fonte: 'assunto-judicial', valor: a })),
      data: t.situacao?.data_andamento,
    }));
  }
  for (const { arquivo, nome } of jsonsDe(P('stf/julgamentos'), (f) => f !== 'indice.json')) {
    const j = lerJson(arquivo); if (!j) continue;
    out.push(item({
      secao: 'stf', id: j.id || nome, tipo: 'julgamento', raw: sem(j, ['votacoes', 'participacao', 'conferencia_votos_x_certidao']),
      construir: nada, etiquetar: nada,
      oficial: { titulo: limparJud(j.certidao_literal || j.processo?.identificacao), fonte: j.certidao_fonte?.url || j.processo?.url },
      subtitulo: [limparJud(j.processo?.identificacao), j.orgao ? `${j.orgao} do Supremo Tribunal Federal` : 'Supremo Tribunal Federal', dataBR(j.data_julgamento)].filter(Boolean).join(' · '),
      universo: universoNumerico(sem(j, ['votacoes', 'participacao', 'fontes', 'conferencia_votos_x_certidao', 'relacionados'])),
      rotulos: (j.colecoes || []).includes('icms') ? [{ fonte: 'tipo', valor: 'icms' }] : [],
      data: j.data_julgamento,
    }));
  }
  const sv = lerJson(P('stf/sumulas-vinculantes.json'));
  for (const s of sv?.itens || []) {
    out.push(item({
      secao: 'stf', id: `stf-sv-${s.numero}`, tipo: 'tese', raw: s, construir: nada, etiquetar: (r) => etiquetaSumulaVinculante(r),
      oficial: { titulo: limparJud(s.texto || s.titulo), fonte: s.url || sv.fonte?.url },
      subtitulo: [`Súmula Vinculante ${s.numero}`, 'Supremo Tribunal Federal', s.situacao, dataBR(s.julgamento_data)].filter(Boolean).join(' · '),
      universo: universoNumerico(sem(s, ['precedentes', 'publicacoes'])), data: s.julgamento_data,
    }));
  }
  return out;
}

function contas() {
  const out = [];
  for (const { arquivo } of jsonsDe(P('tribunais-contas/tce-sp/contas-governador'))) {
    const c = lerJson(arquivo); if (!c) continue;
    out.push(contaItem(c, 'Governador do Estado de São Paulo', 'Governador'));
  }
  for (const c of lerJson(P('tribunais-contas/tce-sp/contas-prefeitos/atibaia.json'))?.itens || []) {
    out.push(contaItem(c, 'Prefeito de Atibaia', 'Prefeito'));
  }
  const tcu = lerJson(P('tribunais-contas/tcu/contas-do-presidente.json'));
  for (const ex of tcu?.exercicios || []) {
    out.push(item({
      secao: 'tribunais-contas', id: `tcu-contas-presidente-${ex.exercicio}`, tipo: 'contas', raw: ex, construir: nada, etiquetar: nada,
      oficial: { titulo: limpar(ex.conclusao_parecer || `Contas do Presidente da República — exercício ${ex.exercicio}`), fonte: ex.acordao?.url || ex.julgamento_politico?.url },
      subtitulo: [`Contas do Presidente da República — exercício ${ex.exercicio}`, ex.acordao ? `Acórdão ${ex.acordao.numero} · ${ex.acordao.orgao} do Tribunal de Contas da União` : 'Tribunal de Contas da União', ex.julgamento_politico?.situacao_literal ? `Congresso Nacional: ${ex.julgamento_politico.situacao_literal.toLocaleLowerCase('pt-BR')}` : null].filter(Boolean).join(' · '),
      universo: universoNumerico(sem(ex, ['julgamento_politico'])), rotulos: [{ fonte: 'tipo', valor: 'contas-publicas' }],
      data: ex.acordao?.data_julgamento,
    }));
  }
  return out;
}
function contaItem(c, contas_de, curto) {
  const construir = (r) => modeloContasTce(r, curto);
  const etiquetar = (r) => etiquetaContasTce(r);
  return item({
    secao: 'tribunais-contas', id: c.id, tipo: 'contas', raw: sem(c, ['determinacoes_e_recomendacoes', 'votacoes', 'quorum']), construir, etiquetar,
    oficial: { titulo: limpar(c.titulo), fonte: c.parecer?.documento?.url || c.fontes?.[0]?.url || c.processo?.url },
    subtitulo: [`Parecer prévio — contas do ${contas_de}, exercício ${c.parecer?.exercicio}`, 'Tribunal de Contas do Estado de São Paulo', c.processo?.numero ? `processo ${c.processo.numero}` : null, dataBR(c.data_julgamento || c.data_transito_em_julgado)].filter(Boolean).join(' · '),
    universo: universoNumerico(sem(c, ['determinacoes_e_recomendacoes', 'votacoes', 'quorum', 'fontes', 'certidao_literal'])),
    rotulos: [{ fonte: 'tipo', valor: 'contas-publicas' }], data: c.data_julgamento || c.data_transito_em_julgado,
  });
}
