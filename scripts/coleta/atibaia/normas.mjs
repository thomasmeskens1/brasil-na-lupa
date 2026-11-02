// Consolidação dos atos lidos na Imprensa Oficial: índice publicado (só confiança alta ou
// revisão humana), fila de curadoria e composição da Câmara a partir das atas publicadas.
import { atosDaPagina, presencaDaPagina, lerCabecalhoEdicao, chaveEmenta, NOMES_TIPO, VERSAO_LEITOR } from './atos.mjs';
import { semAcento } from './lib.mjs';
import { ementaPublica, textoGravavel, hashTexto, temDocumentoPessoal, DOC_OMITIDO } from './privacidade.mjs';

export const NOTA_EMENTA_ORIGINAL = 'Ementa com nome de particular e/ou documento pessoal omitidos (diretriz 12). O texto literal está no documento oficial (link da edição e página); "ementa_original_sha256" é o hash SHA-256 desse texto, para auditoria.';

/** Texto em várias linhas (trecho lido) tratado de uma vez, para pegar nome partido entre linhas. */
function linhasGravaveis(linhas, regras) {
  if (!Array.isArray(linhas)) return linhas;
  return textoGravavel(linhas.join('\n'), regras).texto.split('\n');
}

/**
 * Diretriz 12 com repositório público: nenhum nome de particular nem documento pessoal é gravado
 * em texto claro, nem no registro bruto das edições. A ementa tratada substitui a literal e o hash
 * da literal fica em "ementa_original_sha256". Idempotente (texto já tratado não muda).
 */
export function sanearAto(a, regras = []) {
  if (a.ementa) {
    const r = ementaPublica(a.ementa, regras);
    if (r.ementa_publica !== a.ementa) {
      a.ementa_original_sha256 ||= hashTexto(a.ementa);
      const p = a.mascaramento || { nomes_omitidos_automatico: 0, nomes_omitidos_lista: 0 };
      p.nomes_omitidos_automatico += r.mascaras.filter((m) => m.origem === 'automatico').length;
      p.nomes_omitidos_lista += r.mascaras.filter((m) => m.origem === 'lista').length;
      a.mascaramento = p;
      a.ementa = r.ementa_publica;
    }
  }
  if (a.cabecalho) a.cabecalho = textoGravavel(a.cabecalho, regras).texto;
  if (a.clausula) a.clausula = textoGravavel(a.clausula, regras).texto;
  if (Array.isArray(a.trecho)) a.trecho = linhasGravaveis(a.trecho, regras);
  return a;
}

/** Monta o registro de uma edição a partir da extração do PDF. mascaras: { ato_id: regras }. */
export function registroDaEdicao(ed, extr, processadoEm, mascaras = {}) {
  const p1 = extr.paginas.find((p) => p.pagina === 1);
  const cab = p1 ? lerCabecalhoEdicao(p1.blocos.flatMap((b) => b.linhas)) : null;
  const avisos = [];
  if (!cab) avisos.push('cabeçalho da edição não lido na página 1');
  else {
    if (cab.data && cab.data !== ed.data) avisos.push(`data do cabeçalho (${cab.data}) difere da data do calendário (${ed.data})`);
    if (cab.numero && cab.numero !== String(ed.numero_base) && cab.numero !== ed.edicao) {
      avisos.push(`número no cabeçalho (${cab.numero}) difere do número do arquivo (${ed.edicao})`);
    }
  }
  const atos = [];
  const presencas = [];
  for (const pg of extr.paginas) {
    for (const a of atosDaPagina(pg, { numero: ed.edicao, data: ed.data })) {
      if (avisos.length) { a.motivos.push(...avisos); a.confianca = 'revisar'; }
      if (a.confianca === 'alta') delete a.trecho; // o trecho só é útil para a curadoria
      atos.push(sanearAto(a, mascaras?.[a.id]));
    }
    const pr = presencaDaPagina(pg);
    if (pr) presencas.push(pr);
  }
  return {
    edicao: ed.edicao,
    data: ed.data,
    url: ed.url,
    data_cabecalho: cab?.data ?? null,
    extraordinaria: cab?.extraordinaria ?? null,
    total_paginas: extr.total_paginas,
    paginas_lidas: extr.paginas.map((p) => p.pagina),
    sha256: extr.sha256,
    bytes: extr.bytes,
    extrator_versao: extr.versao,
    leitor_versao: VERSAO_LEITOR,
    processado_em: processadoEm,
    avisos,
    atos,
    presencas,
  };
}

const docsOmitidos = (t) => String(t ?? '').split(DOC_OMITIDO).length - 1;
const FAIXA_NUMERO ={ decreto: 1000, lei: 300, 'lei-complementar': 100 };
const urlPagina = (url, p) => `${url}#page=${p}`;

function itemPublicado(a, ed, acessadoEm, extra = {}) {
  const pub = extra.privacidade;
  // Contagem: o que já foi omitido ao gravar o registro + o que a lista atual omitiu agora.
  const auto = (a.mascaramento?.nomes_omitidos_automatico || 0) + pub.mascaras.filter((m) => m.origem === 'automatico').length;
  const lista = (a.mascaramento?.nomes_omitidos_lista || 0) + pub.mascaras.filter((m) => m.origem === 'lista').length;
  const docs = docsOmitidos(pub.ementa_publica);
  const original = a.ementa_original_sha256 || (pub.ementa_publica !== a.ementa ? hashTexto(a.ementa) : null);
  return {
    id: a.id,
    tipo: a.tipo_nome,
    numero: a.numero,
    data: a.data,
    // Diretriz 12 (repositório público): quando há omissão, "ementa" é igual a "ementa_publica" e o
    // texto literal fica só no documento oficial, identificado pelo hash.
    ementa: pub.ementa_publica,
    ementa_publica: pub.ementa_publica,
    ...(original ? { ementa_original_sha256: original, nota_ementa: NOTA_EMENTA_ORIGINAL } : {}),
    ...(auto || lista || docs ? { mascaramento: { nomes_omitidos_automatico: auto, nomes_omitidos_lista: lista, documentos_omitidos: docs } } : {}),
    autoria_na_ementa: a.autoria_na_ementa ?? null,
    edicao: { numero: ed.edicao, data: ed.data, url: ed.url },
    pagina: a.pagina,
    url: urlPagina(ed.url, a.pagina),
    confianca: extra.confianca || 'alta',
    ...(extra.revisao ? { revisao: extra.revisao } : {}),
    ...(extra.outras_publicacoes?.length ? { outras_publicacoes: extra.outras_publicacoes } : {}),
    fonte: {
      titulo: `Imprensa Oficial Eletrônica da Estância de Atibaia, edição n.º ${ed.edicao}, de ${ed.data.split('-').reverse().join('/')}, p. ${a.pagina}`,
      url: urlPagina(ed.url, a.pagina),
      orgao: 'Prefeitura da Estância de Atibaia — Imprensa Oficial do Município',
      acessado_em: acessadoEm,
    },
  };
}

function itemPendente(a, ed, motivosExtra = []) {
  return {
    id_candidato: a.id_candidato,
    id_sugerido: a.id,
    tipo: a.tipo_nome ?? null,
    numero: a.numero ?? null,
    data: a.data ?? null,
    ementa_lida: textoGravavel(a.ementa ?? null).texto,
    motivos: [...a.motivos, ...motivosExtra],
    edicao: { numero: ed.edicao, data: ed.data, url: ed.url },
    pagina: a.pagina,
    coluna: a.coluna,
    url: urlPagina(ed.url, a.pagina),
    trecho: a.trecho ? linhasGravaveis(a.trecho) : null,
  };
}

/**
 * registros: [{ edicoes: [...] }] (todos os anos); curadoria: { decisoes: [] };
 * mascaras: { ato_id: [{ trecho_sha256, substituir_por }] } (revisao/mascaras.json).
 * Devolve { indices: { ano: itens[] }, pendentes: [], mascarasPendentes: [], estatisticas }.
 */
export function consolidar(registros, curadoria, acessadoEm, mascaras = {}) {
  const decisoes = new Map((curadoria?.decisoes || []).map((d) => [d.id_candidato, d]));
  const candidatos = [];
  for (const reg of registros) for (const ed of reg.edicoes || []) for (const a of ed.atos || []) candidatos.push({ a, ed });

  const est = { candidatos: candidatos.length, alta: 0, revisar: 0, revisados_incluidos: 0, descartados: 0, rebaixados: 0,
    mascarados_automatico: 0, mascarados_lista: 0, com_documento_omitido: 0, aguardando_mascara: 0 };
  const pendentes = [];
  const altas = [];
  for (const c of candidatos) {
    const d = decisoes.get(c.a.id_candidato);
    if (d?.decisao === 'descartar') { est.descartados++; continue; }
    if (d?.decisao === 'incluir') {
      const a = { ...c.a, ...(d.correcao || {}) };
      // Ementa corrigida pela curadoria: o hash e a contagem de omissões são os da correção.
      if (d.correcao?.ementa) {
        a.ementa_original_sha256 = d.correcao.ementa_original_sha256 ?? null;
        a.mascaramento = d.correcao.mascaramento ?? null;
      }
      if (d.correcao?.tipo) a.tipo_nome = NOMES_TIPO[d.correcao.tipo] || d.correcao.tipo;
      if (d.correcao?.numero) a.numero_int = Number(String(d.correcao.numero).replace(/\./g, ''));
      if (a.data && a.tipo && a.numero_int) a.id = `atibaia-${a.tipo}-${a.numero_int}-${a.data.slice(0, 4)}`;
      if (!a.id || !a.data || !a.ementa) { pendentes.push(itemPendente(c.a, c.ed, ['decisão de inclusão sem tipo, número, data ou ementa completos'])); continue; }
      altas.push({ a, ed: c.ed, revisao: { revisor: d.revisor || null, revisado_em: d.revisado_em || null, observacao: d.observacao || null } });
      est.revisados_incluidos++;
      continue;
    }
    if (c.a.confianca === 'alta') { altas.push(c); est.alta++; } else { pendentes.push(itemPendente(c.a, c.ed)); est.revisar++; }
  }

  // Mesmo ato em mais de uma edição: ementas iguais → um item com "outras_publicacoes";
  // ementas diferentes → todos vão para a curadoria.
  const grupos = new Map();
  for (const x of altas) { const g = grupos.get(x.a.id) || []; g.push(x); grupos.set(x.a.id, g); }
  const publicados = [];
  for (const [, g] of grupos) {
    g.sort((p, q) => p.ed.data.localeCompare(q.ed.data) || p.a.pagina - q.a.pagina);
    const chaves = new Set(g.map((x) => chaveEmenta(x.a.ementa)));
    if (chaves.size > 1 && !g.some((x) => x.revisao)) {
      for (const x of g) pendentes.push(itemPendente(x.a, x.ed, ['mesmo número e ano publicado com ementas diferentes em outra edição']));
      est.rebaixados += g.length;
      continue;
    }
    // Mesma ementa: a primeira publicação é a principal; ementas diferentes: a conferida pela curadoria.
    const principal = chaves.size === 1 ? g[0] : g.find((x) => x.revisao);
    const outras = g.filter((x) => x !== principal).map((x) => ({ edicao: x.ed.edicao, data: x.ed.data, pagina: x.a.pagina, url: urlPagina(x.ed.url, x.a.pagina) }));
    publicados.push({ ...principal, outras });
  }

  // Número fora da faixa dos demais atos do mesmo tipo e ano → curadoria.
  const porTipoAno = new Map();
  for (const x of publicados) {
    const k = `${x.a.tipo}-${x.a.data.slice(0, 4)}`;
    const l = porTipoAno.get(k) || []; l.push(x.a.numero_int); porTipoAno.set(k, l);
  }
  const medianas = new Map([...porTipoAno].map(([k, l]) => {
    const s = [...l].sort((a, b) => a - b); return [k, { n: s.length, med: s[Math.floor(s.length / 2)] }];
  }));
  const indices = {};
  const mascarasPendentes = [];
  for (const x of publicados) {
    const ano = x.a.data.slice(0, 4);
    const md = medianas.get(`${x.a.tipo}-${ano}`);
    if (!x.revisao && md.n >= 5 && Math.abs(x.a.numero_int - md.med) > FAIXA_NUMERO[x.a.tipo]) {
      pendentes.push(itemPendente(x.a, x.ed, [`número ${x.a.numero} fora da faixa dos demais atos do mesmo tipo em ${ano} (mediana ${md.med.toLocaleString('pt-BR')})`]));
      est.rebaixados++;
      continue;
    }
    // Diretriz 12: nome com dúvida (pessoa física?) segura a publicação até a decisão da curadoria.
    const privacidade = ementaPublica(x.a.ementa, mascaras?.[x.a.id]);
    if (privacidade.duvidas.length || temDocumentoPessoal(privacidade.ementa_publica)) {
      mascarasPendentes.push({
        ato_id: x.a.id, id_candidato: x.a.id_candidato ?? null, tipo: x.a.tipo_nome, numero: x.a.numero, data: x.a.data,
        url: urlPagina(x.ed.url, x.a.pagina), ementa: privacidade.ementa_publica,
        duvidas: privacidade.duvidas.length ? privacidade.duvidas : [{ trecho_sha256: '(documento)', motivo: 'padrão de documento pessoal na ementa pública' }],
      });
      est.aguardando_mascara++;
      continue;
    }
    if (x.a.mascaramento?.nomes_omitidos_automatico || privacidade.mascaras.some((m) => m.origem === 'automatico')) est.mascarados_automatico++;
    if (x.a.mascaramento?.nomes_omitidos_lista || privacidade.mascaras.some((m) => m.origem === 'lista')) est.mascarados_lista++;
    if (docsOmitidos(privacidade.ementa_publica)) est.com_documento_omitido++;
    (indices[ano] ||= []).push(itemPublicado(x.a, x.ed, acessadoEm, {
      confianca: x.revisao ? 'revisada' : 'alta', revisao: x.revisao, outras_publicacoes: x.outras, privacidade,
    }));
  }
  const ordemTipo = { Decreto: 0, Lei: 1, 'Lei Complementar': 2 };
  for (const l of Object.values(indices)) {
    l.sort((p, q) => p.data.localeCompare(q.data) || ordemTipo[p.tipo] - ordemTipo[q.tipo]
      || Number(p.numero.replace(/\./g, '')) - Number(q.numero.replace(/\./g, '')));
  }
  pendentes.sort((p, q) => q.edicao.data.localeCompare(p.edicao.data) || p.pagina - q.pagina || p.id_candidato.localeCompare(q.id_candidato));
  mascarasPendentes.sort((p, q) => q.data.localeCompare(p.data) || p.ato_id.localeCompare(q.ato_id));
  return { indices, pendentes, mascarasPendentes, estatisticas: est };
}

const slug = (s) => semAcento(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Composição da Câmara pela ata mais recente publicada na Imprensa Oficial. */
export function vereadoresDasAtas(registros, acessadoEm, lacunasExtras = []) {
  const atas = [];
  for (const reg of registros) for (const ed of reg.edicoes || []) for (const p of ed.presencas || []) atas.push({ p, ed });
  const validas = atas.filter((x) => x.p.valida && x.p.data_sessao)
    .sort((a, b) => b.p.data_sessao.localeCompare(a.p.data_sessao) || b.ed.data.localeCompare(a.ed.data));
  const lacunas = [...lacunasExtras];
  if (!validas.length) {
    lacunas.push('Nenhuma ata com lista de presença legível foi encontrada nas edições lidas da Imprensa Oficial.');
    return { atualizado_em: new Date().toISOString(), fonte: null, itens: [], mesa: [], lacunas };
  }
  const { p, ed } = validas[0];
  const anterior = validas.find((x) => x.p.data_sessao < p.data_sessao);
  const nomesMesa = new Map((p.mesa || []).map((m) => [m.nome, m.cargo]));
  const url = `${ed.url}#page=${p.pagina}`;
  const sessaoTxt = `${p.sessao || 'sessão'} de ${p.data_sessao.split('-').reverse().join('/')}`;
  if (!/^n[ãa]o houve$/i.test(p.ausentes_texto || '')) {
    lacunas.push(`A ata registra ausentes ("${p.ausentes_texto}"); os ausentes não estão na lista, que reúne só os presentes.`);
  }
  lacunas.push('Nome parlamentar (nome de urna), foto, e-mail e página individual: Informação não disponível em fonte oficial acessível pelo coletor.');
  let conferencia = null;
  if (anterior) {
    const a = new Set(anterior.p.presentes.map((v) => `${v.nome}|${v.partido}`));
    const b = new Set(p.presentes.map((v) => `${v.nome}|${v.partido}`));
    const iguais = a.size === b.size && [...a].every((x) => b.has(x));
    conferencia = {
      ata_anterior: `${anterior.p.sessao || 'sessão'} de ${anterior.p.data_sessao.split('-').reverse().join('/')}`,
      url: `${anterior.ed.url}#page=${anterior.p.pagina}`,
      mesma_lista: iguais,
    };
  }
  return {
    atualizado_em: new Date().toISOString(),
    fonte: {
      titulo: `Ata da ${sessaoTxt} da Câmara Municipal da Estância de Atibaia, publicada na Imprensa Oficial Eletrônica n.º ${ed.edicao}, de ${ed.data.split('-').reverse().join('/')}, p. ${p.pagina}`,
      url,
      orgao: 'Câmara Municipal da Estância de Atibaia (publicação na Imprensa Oficial do Município)',
      acessado_em: acessadoEm,
    },
    criterio: 'Vereadores registrados como presentes na ata de sessão mais recente publicada na Imprensa Oficial, com o partido como consta na ata. A ata informa os ausentes no campo "VEREADOR AUSENTE".',
    sessao: { descricao: p.sessao, data: p.data_sessao, ausentes_registrados: p.ausentes_texto },
    conferencia_com_ata_anterior: conferencia,
    itens: [...p.presentes].sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')).map((v) => ({
      id: slug(v.nome),
      nome: v.nome,
      nome_civil: null,
      partido: v.partido,
      uf: 'SP',
      em_exercicio: true,
      cargo_na_mesa: nomesMesa.get(v.nome) || null,
      foto: null,
      url_oficial: null,
      email: null,
    })),
    mesa: p.mesa || [],
    lacunas,
  };
}
