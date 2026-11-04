#!/usr/bin/env node
/**
 * Gera, no build, os índices compactos das seções Executivo, Justiça e dos complementos do
 * perfil dos deputados, a partir de web/content (copiado de ../dados por sync-data.mjs; rodar
 * depois dele). Pastas ausentes são ignoradas: o site mostra a seção como "em construção".
 *
 * Servidor/build (content/_gerado/):
 *   executivo.json        listas de medidas provisórias e vetos (todas os anos), contagens de normas
 *   justica-stj.json      índice dos temas do STJ + quais têm página de detalhe
 *   justica-stf.json      índice dos temas de repercussão geral do STF (se houver dados)
 *   presenca-camara-<ano>.json  presença por deputado + dias sem registro no serviço de frequência
 * Navegador (public/, arquivos estáticos; a busca roda no navegador):
 *   executivo/normas.json           leis, leis complementares e decretos (busca e filtros)
 *   executivo/vetos/votos/<cod>.json votos nominais de um dispositivo de veto (carregados sob demanda)
 *   justica/stj-temas.json          temas do STJ com questão e tese literais (busca)
 *   justica/stf-temas.json          temas de repercussão geral do STF (busca), se houver dados
 *
 * Nada é deduzido: só se copiam e reorganizam campos da fonte.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = path.join(webDir, "content");
const saidaServidor = path.join(content, "_gerado");
const pub = path.join(webDir, "public");

function lerJson(arquivo) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    return null;
  }
}

function listar(dir, filtro = () => true) {
  try {
    return fs.readdirSync(dir).filter((n) => n.endsWith(".json") && filtro(n));
  } catch {
    return [];
  }
}

function gravar(arquivo, dados) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(dados));
  return Math.round(fs.statSync(arquivo).size / 1024);
}

/** Recria uma pasta pública gerada (evita arquivos de execuções anteriores). */
function limparPublico(rel) {
  fs.rmSync(path.join(pub, rel), { recursive: true, force: true });
}

const resumo = [];

// ---------------------------------------------------------------- Títulos em linguagem simples
// dados/titulos/<secao>.json (contrato "titulo_simples"). Pode não existir: as páginas usam o
// título oficial. Só vão para o site os itens que as páginas usam.
const dirTitulos = path.resolve(webDir, "..", "dados", "titulos");
const titulosExecutivo = lerJson(path.join(dirTitulos, "executivo.json"))?.itens ?? {};
const titulosStj = lerJson(path.join(dirTitulos, "stj.json"))?.itens ?? {};
const titulosStf = lerJson(path.join(dirTitulos, "stf.json"))?.itens ?? {};

/** Mesmas regras de components/decisao/rotulos.ts → tituloAprovado. */
function aprovado(s) {
  if (!s || typeof s.titulo !== "string" || !s.titulo.trim()) return false;
  // Mesma regra de tituloAprovado(): só título "estruturado" aprovado pelo verificador.
  if (s.origem !== "estruturado") return false;
  const v = s.verificacao;
  if (!v || v.aprovado_pelo_verificador !== true) return false;
  if (v.numeros_e_datas_conferidos === false || v.verbo_permitido === false) return false;
  if (Array.isArray(v.palavras_proibidas) && v.palavras_proibidas.length > 0) return false;
  return v.veto_vies === null || v.veto_vies === undefined || v.veto_vies === false;
}

/** Título para os índices de busca: só o aprovado que reformula o texto (o "oficial" é o próprio texto). */
// Mesma chave de web/src/components/decisao/rotulos.ts (TITULOS_SIMPLES_ATIVOS).
const TITULOS_SIMPLES_ATIVOS = true; // a regra de aprovação (só "estruturado" verificado) fica em tituloAprovado()

function tituloUtil(itens, id) {
  if (!TITULOS_SIMPLES_ATIVOS) return null;
  const s = itens[id];
  return aprovado(s) && s.origem !== "oficial" ? s.titulo.trim() : null;
}

/** Tema do dia a dia e etiqueta estruturada do arquivo de títulos (mesmas regras de etiquetaDe). */
function temaEtiqueta(itens, id) {
  const s = itens[id];
  if (!s) return [null, null];
  const e = typeof s.etiqueta === "string" ? s.etiqueta.trim() : "";
  const okEtiqueta = e && e.length <= 60 && !(s.verificacao && s.verificacao.aprovado_pelo_verificador === false);
  return [typeof s.tema === "string" && s.tema.trim() ? s.tema.trim() : null, okEtiqueta ? e : null];
}

/** Expressões literais do resultado ("por unanimidade", "por maioria") presentes no trecho oficial. */
function expressoesResultado(trecho) {
  const t = String(trecho ?? "");
  const r = [];
  if (/por\s+unanimidade/i.test(t)) r.push("Por unanimidade");
  if (/por\s+maioria/i.test(t)) r.push("Por maioria");
  return r;
}

/** Corta o texto oficial em fim de palavra (para o cartão; a página de detalhe tem o texto inteiro). */
function cortar(texto, max) {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= max) return t;
  return `${t.slice(0, max + 1).replace(/\s+\S*$/, "").replace(/[\s,;:.–—-]+$/, "")}…`;
}

/** Trecho literal do mérito (mesma escolha de resultadoMeritoStj em features/justica/apresentacao.ts). */
function meritoStj(sessoes) {
  const s = (sessoes ?? []).find((x) => x.etapa === "merito" && (x.resultado_trechos ?? []).length);
  if (!s) return null;
  return s.resultado_trechos.find((x) => /tese/i.test(x.trecho)) ?? s.resultado_trechos[0];
}

function contar(itens, f) {
  const m = {};
  for (const x of itens) {
    const k = f(x);
    if (k != null && k !== "") m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

function gravarTitulos(secao, ids) {
  const fonte = { executivo: titulosExecutivo, stj: titulosStj, stf: titulosStf }[secao];
  const itens = {};
  if (TITULOS_SIMPLES_ATIVOS) for (const id of ids) if (fonte[id]) itens[id] = fonte[id];
  gravar(path.join(saidaServidor, `titulos-${secao}.json`), { itens });
}

// ---------------------------------------------------------------- Executivo
function gerarExecutivo() {
  const base = path.join(content, "executivo");
  limparPublico("executivo");
  if (!fs.existsSync(base)) return;
  const meta = lerJson(path.join(base, "meta.json"));

  const lerIndices = (sub) =>
    listar(path.join(base, sub), (n) => n.startsWith("indice-"))
      .map((n) => lerJson(path.join(base, sub, n)))
      .filter(Boolean);

  const idxMpv = lerIndices("medidas-provisorias");
  const mpvs = idxMpv.flatMap((i) => i.itens ?? []);
  mpvs.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "") || b.numero - a.numero);

  const idxVet = lerIndices("vetos");
  const vetos = idxVet.flatMap((i) => i.itens ?? []);
  vetos.sort((a, b) => (b.data_publicacao ?? "").localeCompare(a.data_publicacao ?? "") || b.numero - a.numero);
  const vetoPorNorma = new Map(vetos.filter((v) => v.norma).map((v) => [v.norma, v.id]));

  // Detalhe de cada veto: assunto do Congresso para o título da lista e, por dispositivo, o
  // texto vetado e as razões em arquivo próprio (baixado só quando o leitor abre o trecho).
  let nDispositivos = 0;
  for (const v of vetos) {
    const d = lerJson(path.join(base, "vetos", `${v.id}.json`));
    if (!d) continue;
    v.assunto_congresso = d.assunto_congresso ?? null;
    for (const x of d.dispositivos ?? []) {
      if (!/^[0-9A-Za-z.-]+$/.test(String(x.codigo))) continue;
      gravar(path.join(pub, "executivo", "vetos", "dispositivos", `${x.codigo}.json`), {
        texto_vetado: x.texto_vetado ?? null,
        razao_veto: x.razao_veto ?? null,
        origem: x.origem ?? null,
        votacao: x.votacao ?? null,
        tipo_votacao: x.tipo_votacao ?? null,
      });
      nDispositivos += 1;
    }
  }

  // Votos por dispositivo: arquivo compacto por código, baixado só quando o leitor abre a tabela.
  const dirVotos = path.join(base, "vetos", "votos");
  let nVotos = 0;
  for (const n of listar(dirVotos)) {
    const d = lerJson(path.join(dirVotos, n));
    if (!d || !Array.isArray(d.votos) || !/^[0-9A-Za-z.-]+$/.test(String(d.id))) continue;
    const linhas = d.votos
      .map((v) => [v.casa === "senado" ? 1 : 0, v.nome ?? "", v.partido_na_fonte ?? null, v.uf ?? null, v.voto ?? null, v.parlamentar_id ?? null])
      .sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1], "pt-BR"));
    gravar(path.join(pub, "executivo", "vetos", "votos", `${d.id}.json`), {
      fonte: d.fonte ?? null,
      sessao: d.sessao ?? null,
      v: linhas,
    });
    nVotos += 1;
  }

  // Normas: índice compacto para a busca no navegador.
  const idxNormas = lerIndices("normas");
  const normas = idxNormas.flatMap((i) => i.itens ?? []);
  normas.sort((a, b) => (b.data_assinatura ?? "").localeCompare(a.data_assinatura ?? "") || b.numero - a.numero);
  const TIPOS = ["Lei", "Lei Complementar", "Decreto"];
  const linhasNormas = normas.map((x) => [
    x.id,
    TIPOS.indexOf(x.tipo) >= 0 ? TIPOS.indexOf(x.tipo) : x.tipo,
    x.nome_oficial ?? null,
    x.data_assinatura ?? "",
    x.ementa ?? "",
    x.apelido_senado ?? null,
    x.links?.planalto ?? null,
    (x.publicacao_dou ?? []).map((p) =>
      [String(p.veiculo ?? "").replace(/\s+/g, " ").trim(), p.pagina ? `p. ${p.pagina}` : null, p.coluna ? `col. ${p.coluna}` : null]
        .filter(Boolean)
        .join(", "),
    ),
    (x.projeto_origem ?? []).map((p) => p.identificacao).filter(Boolean),
    vetoPorNorma.get(x.nome_oficial) ?? null,
    x.links?.senado_norma ?? null,
    tituloUtil(titulosExecutivo, x.id),
  ]);
  const kbNormas = gravar(path.join(pub, "executivo", "normas.json"), {
    gerado_em: new Date().toISOString(),
    tipos: TIPOS,
    n: linhasNormas,
  });

  const contagemNormas = {};
  for (const x of normas) {
    const k = `${x.ano}|${x.tipo}`;
    contagemNormas[k] = (contagemNormas[k] ?? 0) + 1;
  }

  gravar(path.join(saidaServidor, "executivo.json"), {
    atualizado_em: meta?.atualizado_em ?? null,
    periodo: meta?.periodo ?? null,
    fontes: meta?.fontes ?? [],
    contagens: meta?.contagens ?? null,
    fontes_mpv: idxMpv.map((i) => i.fonte).filter(Boolean),
    fontes_vetos: idxVet.map((i) => i.fonte).filter(Boolean),
    fontes_normas: idxNormas.flatMap((i) => i.fontes ?? []),
    abrangencia_normas: idxNormas[0]?.abrangencia ?? null,
    mpvs,
    vetos,
    normas: { total: normas.length, anos: [...new Set(normas.map((x) => x.ano))].sort().reverse(), por_ano_tipo: contagemNormas },
  });
  gravarTitulos("executivo", [...mpvs.map((m) => m.id), ...vetos.map((v) => v.id)]);
  resumo.push(
    `executivo: ${mpvs.length} MPs, ${vetos.length} vetos (${nDispositivos} dispositivos), ${nVotos} arquivos de votos, normas.json ${kbNormas} KB`,
  );
}

// ---------------------------------------------------------------- STJ
function gerarStj() {
  const base = path.join(content, "stj");
  limparPublico(path.join("justica", "stj-temas.json"));
  const indice = lerJson(path.join(base, "temas", "indice.json"));
  if (!indice?.itens) return;
  const meta = lerJson(path.join(base, "meta.json"));
  const colecoes = meta?.contagens?.colecoes ?? {};
  const naColecao = new Set(Object.values(colecoes).flat().map(String));
  // Página de detalhe só para o que precisa: temas com julgamento coletado, de uma coleção ou em pauta.
  const comPagina = indice.itens
    .filter((t) => t.sessoes > 0 || (t.colecoes ?? []).length || naColecao.has(String(t.numero)) || t.em_pauta)
    .map((t) => String(t.numero));
  const setPagina = new Set(comPagina);

  const modelo = "https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp?novaConsulta=true&tipo_pesquisa=T&cod_tema_inicial={n}&cod_tema_final={n}";
  const linhas = [];
  for (const t of indice.itens) {
    const d = lerJson(path.join(base, "temas", `${t.numero}.json`));
    const url = t.url_oficial ?? null;
    const merito = meritoStj(d?.julgamento?.sessoes);
    const [tema, etiqueta] = temaEtiqueta(titulosStj, `stj-tema-${t.numero}`);
    linhas.push([
      String(t.numero),
      t.tipo_precedente ?? null,
      t.situacao ?? null,
      t.orgao ?? null,
      (t.relator ?? []).join("; ") || null,
      d?.questao ?? null,
      d?.tese ?? null,
      t.colecoes ?? [],
      setPagina.has(String(t.numero)) ? 1 : 0,
      t.datas?.julgamento ?? t.datas?.afetacao ?? null,
      url === modelo.replaceAll("{n}", String(t.numero)) ? 1 : url,
      tituloUtil(titulosStj, `stj-tema-${t.numero}`),
      // Acrescentados para a lista com filtros (Justiça): tema do dia a dia, etiqueta, expressões
      // literais do resultado do mérito, o trecho oficial (cortado) e qual data é a da posição 9.
      tema,
      etiqueta,
      merito ? expressoesResultado(merito.trecho) : [],
      merito ? cortar(merito.trecho, 200) : null,
      t.datas?.julgamento ? "j" : t.datas?.afetacao ? "a" : null,
    ]);
  }
  linhas.sort((a, b) => Number(b[0]) - Number(a[0]));
  const kb = gravar(path.join(pub, "justica", "stj-temas.json"), { gerado_em: new Date().toISOString(), url_modelo: modelo, t: linhas });

  // Divergências entre arquivos oficiais registradas pela coleta ("Tema N: ..."), por tema.
  const divergencias = {};
  for (const d of meta?.divergencias_da_fonte ?? []) {
    const m = /^Tema (\d+):\s*(.+)$/.exec(String(d));
    if (m && setPagina.has(m[1])) (divergencias[m[1]] ??= []).push(m[2]);
  }

  gravar(path.join(saidaServidor, "justica-stj.json"), {
    atualizado_em: indice.atualizado_em ?? meta?.atualizado_em ?? null,
    fonte: indice.fonte ?? null,
    fontes: meta?.fontes ?? [],
    divergencias,
    total: indice.itens.length,
    colecoes,
    com_pagina: comPagina,
    itens: indice.itens.filter((t) => setPagina.has(String(t.numero))),
    situacoes: [...new Set(indice.itens.map((t) => t.situacao).filter(Boolean))].sort(),
    // Contagens oficiais do índice inteiro (painel de números da Justiça).
    contagens: {
      por_situacao: contar(indice.itens, (t) => t.situacao),
      por_tipo: contar(indice.itens, (t) => t.tipo_precedente),
      com_tese: indice.itens.filter((t) => t.tem_tese).length,
    },
    orgaos: [...new Set(indice.itens.map((t) => t.orgao).filter(Boolean))].sort(),
    tipos: [...new Set(indice.itens.map((t) => t.tipo_precedente).filter(Boolean))].sort(),
  });
  gravarTitulos("stj", comPagina.map((n) => `stj-tema-${n}`));
  resumo.push(`stj: ${indice.itens.length} temas, ${comPagina.length} com página, stj-temas.json ${kb} KB`);
}

// ---------------------------------------------------------------- STF (pode não existir)
function gerarStf() {
  const base = path.join(content, "stf");
  limparPublico(path.join("justica", "stf-temas.json"));
  if (!fs.existsSync(base)) {
    resumo.push("stf: sem dados");
    return;
  }
  const indice = lerJson(path.join(base, "repercussao-geral", "indice.json"));
  const itens = Array.isArray(indice?.itens) ? indice.itens : Array.isArray(indice?.temas) ? indice.temas : [];
  const julgamentos = listar(path.join(base, "julgamentos"), (n) => !n.startsWith("indice"))
    .map((n) => ({ arquivo: n.replace(/\.json$/, ""), d: lerJson(path.join(base, "julgamentos", n)) }))
    .filter((j) => j.d);
  // Tema → arquivos de julgamento (pelo número do precedente, quando o arquivo informa).
  const julgPorTema = {};
  for (const j of julgamentos) {
    const n = j.d.precedente?.numero ?? j.d.tema ?? null;
    if (n != null) (julgPorTema[String(n)] ??= []).push(j.arquivo);
  }
  const comPagina = itens
    .filter((t) => (t.colecoes ?? []).length || t.julgamento_ref || julgPorTema[String(t.numero)])
    .map((t) => String(t.numero));
  const setPagina = new Set(comPagina);
  const porArquivoJ = new Map(julgamentos.map((j) => [j.arquivo, j.d]));
  /** Trecho literal do mérito na certidão (mesma escolha de resultadoCertidao em apresentacao.ts). */
  const trechoCertidao = (d) => {
    const cert = (d?.votacoes ?? []).filter((v) => v.origem !== "plenario-virtual" && v.trecho);
    return (cert.find((v) => /m[ée]rito/i.test(String(v.parte ?? ""))) ?? cert[cert.length - 1])?.trecho ?? null;
  };
  /** Julgamento mais recente ligado ao tema (mesma regra de julgamentosDoTemaStf + cartaoTemaStf). */
  const julgamentoDoTema = (t) => {
    const refs = new Set(julgPorTema[String(t.numero)] ?? []);
    for (const r of [t.julgamento_ref].flat()) if (typeof r === "string") refs.add(r.replace(/^.*\//, "").replace(/\.json$/, ""));
    return [...refs]
      .map((r) => porArquivoJ.get(r))
      .filter(Boolean)
      .sort((a, b) => String(b.data_julgamento ?? "").localeCompare(String(a.data_julgamento ?? "")))[0] ?? null;
  };
  if (itens.length) {
    const linhas = itens.map((t) => {
      const d = lerJson(path.join(base, "repercussao-geral", `${t.numero}.json`));
      const julg = julgamentoDoTema(t);
      const trecho = julg ? trechoCertidao(julg) : null;
      const [tema, etiqueta] = temaEtiqueta(titulosStf, `stf-tema-${t.numero}`);
      const dataTese = d?.data_tese ?? t.data_tese ?? null;
      const dataRg = d?.situacao?.data_repercussao_geral ?? null;
      return [
        String(t.numero),
        t.titulo ?? d?.titulo ?? null,
        t.situacao ?? d?.situacao?.repercussao_geral ?? null,
        t.andamento ?? d?.situacao?.andamento ?? null,
        t.relator ?? d?.relator ?? null,
        t.leading_case ?? d?.leading_case?.identificacao ?? null,
        d?.tese ?? null,
        t.colecoes ?? [],
        setPagina.has(String(t.numero)) ? 1 : 0,
        d?.url ?? null,
        d?.descricao ?? null,
        tituloUtil(titulosStf, `stf-tema-${t.numero}`),
        // Acrescentados para a lista com filtros (Justiça): tema do dia a dia, etiqueta, expressões
        // literais do resultado na certidão do julgamento ligado, o trecho (cortado), a data e qual é.
        tema,
        etiqueta,
        expressoesResultado(trecho),
        cortar(trecho, 200),
        julg?.data_julgamento ?? dataTese ?? dataRg,
        julg?.data_julgamento ? "j" : dataTese ? "t" : dataRg ? "r" : null,
        julg?.orgao ?? null,
      ];
    });
    linhas.sort((a, b) => Number(b[0]) - Number(a[0]));
    gravar(path.join(pub, "justica", "stf-temas.json"), { gerado_em: new Date().toISOString(), t: linhas });
  }
  // Lista dos julgamentos (todos têm página de detalhe: são poucos e vêm das coleções acompanhadas),
  // com o trecho literal do resultado do mérito na certidão, para o cartão da lista.
  const porArquivo = new Map(julgamentos.map((j) => [j.arquivo, j.d]));
  const listaJulgamentos = (lerJson(path.join(base, "julgamentos", "indice.json"))?.itens ?? julgamentos.map((j) => ({ id: j.arquivo })))
    .filter((j) => j && /^[A-Za-z0-9._-]{1,80}$/.test(String(j.id)) && porArquivo.has(j.id))
    .map((j) => {
      const d = porArquivo.get(j.id);
      const cert = (d.votacoes ?? []).filter((v) => v.origem !== "plenario-virtual" && v.trecho);
      const merito = cert.find((v) => /m[ée]rito/i.test(String(v.parte ?? ""))) ?? cert[cert.length - 1];
      return {
        ...j,
        resultado_trecho: merito?.trecho ?? null,
        certidao_inicio: d.certidao_literal ? String(d.certidao_literal).slice(0, 400) : null,
        ementa_inicio: d.ementa ? String(d.ementa).slice(0, 400) : null,
        orgao: d.orgao ?? null,
        acessado_em: d.atualizado_em ?? null,
        url: d.certidao_fonte?.url ?? d.processo?.url ?? null,
        tema_dia_a_dia: temaEtiqueta(titulosStf, j.id)[0],
        etiqueta: temaEtiqueta(titulosStf, j.id)[1],
      };
    });
  gravarTitulos("stf", [...comPagina.map((n) => `stf-tema-${n}`), ...listaJulgamentos.map((j) => j.id)]);
  gravar(path.join(saidaServidor, "justica-stf.json"), {
    atualizado_em: indice?.atualizado_em ?? null,
    fonte: indice?.fonte ?? null,
    total: itens.length,
    com_pagina: comPagina,
    itens: itens.filter((t) => setPagina.has(String(t.numero))),
    julgamentos_por_tema: julgPorTema,
    julgamentos_total: julgamentos.length,
    // Contagens oficiais do índice inteiro (painel de números da Justiça).
    contagens: {
      por_situacao: contar(itens, (t) => t.situacao),
      por_andamento: contar(itens, (t) => t.andamento),
      com_tese: itens.filter((t) => t.tem_tese).length,
    },
    // Lista dos julgamentos (todos têm página de detalhe: são poucos e vêm das coleções acompanhadas).
    julgamentos: listaJulgamentos,
    fontes: (lerJson(path.join(base, "meta.json"))?.fontes ?? []).filter((f) => f?.url && !String(f.url).includes("{")),
  });
  resumo.push(`stf: ${itens.length} temas, ${julgamentos.length} julgamentos, ${comPagina.length} com página`);
}

// ---------------------------------------------------------------- Presença na Câmara
function gerarPresenca() {
  const dir = path.join(content, "camara", "presenca");
  for (const n of listar(dir, (x) => /^\d{4}\.json$/.test(x))) {
    const ano = n.slice(0, 4);
    const p = lerJson(path.join(dir, n));
    if (!p?.itens) continue;
    const dias = lerJson(path.join(dir, `dias-${ano}.json`));
    // Sessões deliberativas do arquivo oficial de eventos em dias sem nenhum registro no serviço de frequência.
    const semRegistro = [];
    if (dias?.sessoes && dias?.dias) {
      for (const s of dias.sessoes) {
        if (s?.data && !(s.data in dias.dias)) semRegistro.push({ data: s.data, descricao: s.descricao ?? null });
      }
    }
    const porId = {};
    for (const i of p.itens) if (i.parlamentar_id) porId[String(i.parlamentar_id)] = i;
    gravar(path.join(saidaServidor, `presenca-camara-${ano}.json`), {
      ano: Number(ano),
      atualizado_em: p.atualizado_em ?? null,
      abrangencia: p.abrangencia ?? null,
      totais: p.totais ?? null,
      fonte: p.fonte ?? null,
      fontes_complementares: p.fontes_complementares ?? [],
      sem_registro_no_servico: semRegistro,
      por_id: porId,
    });
    resumo.push(`presença ${ano}: ${Object.keys(porId).length} deputados`);
  }
}

function main() {
  const inicio = Date.now();
  fs.rmSync(saidaServidor, { recursive: true, force: true });
  fs.mkdirSync(saidaServidor, { recursive: true });
  gerarExecutivo();
  gerarStj();
  gerarStf();
  gerarPresenca();
  console.log(`[gerar-executivo-justica] ${resumo.join("; ") || "sem dados"} (${Date.now() - inicio} ms).`);
}

main();
