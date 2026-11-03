/**
 * Funções de scripts/gerar-inicio.mjs: "Decidido esta semana" e o índice da busca única.
 * Só copiam e reorganizam campos das fontes já presentes em web/content e web/public
 * (nenhuma informação é deduzida).
 */
import fs from "node:fs";
import path from "node:path";

export function lerJson(arquivo) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    return null;
  }
}

export function slug(t) {
  return String(t)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function corta(t, n) {
  if (!t) return "";
  const s = String(t).replace(/\s+/g, " ").trim();
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

function menosDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const FORMA_VOTACAO = { nominal: "votacao-nominal", simbolica: "votacao-simbolica", secreta: "votacao-secreta" };

function placarCongresso(p) {
  if (!p) return null;
  const o = {};
  for (const k of ["sim", "nao", "abstencao", "obstrucao", "outros"]) if (typeof p[k] === "number") o[k] = p[k];
  return o;
}

function itensPlacar(o) {
  const R = { sim: "Sim", nao: "Não", abstencao: "Abstenção", obstrucao: "Obstrução", outros: "Outros", em_branco: "Em branco", presidente: "Presidente" };
  return Object.entries(o).map(([k, v]) => ({ rotulo: R[k] ?? k, valor: v }));
}

function dadoVotacao(v) {
  if (v.tipo === "nominal" && v.placar) return { tipo: "placar", itens: itensPlacar(placarCongresso(v.placar)), resultado: v.resultado ?? null };
  if (v.tipo === "simbolica") return { tipo: "simbolica", resultado: v.resultado ?? null };
  return v.resultado ? { tipo: "texto", rotulo: "Resultado", texto: v.resultado } : null;
}

/** Decisões com data entre (hoje − 6 dias) e hoje, de todas as esferas, da mais recente para a mais antiga. */
export function decisoesDaSemana(content, webDir, hoje) {
  const inicio = menosDias(hoje, 6);
  const naJanela = (d) => typeof d === "string" && d.slice(0, 10) >= inicio && d.slice(0, 10) <= hoje;
  const titulos = (secao) => lerJson(path.join(content, "titulos", `${secao}.json`))?.itens ?? {};
  const itens = [];
  const add = (o, secaoTitulo, idTitulo) => {
    const s = secaoTitulo ? titulos(secaoTitulo)[idTitulo] : null;
    itens.push({ ...o, simples: s ?? null });
  };

  for (const casa of ["camara", "senado"]) {
    const c = lerJson(path.join(content, "congresso", `${casa}.json`));
    for (const v of c?.votacoes ?? []) {
      if (!naJanela(v.data)) continue;
      const det = lerJson(path.join(content, casa, "votacoes", `${v.id}.json`));
      const p = v.proposicao ?? {};
      add(
        {
          id: `${casa}-${v.id}`,
          ordem: `${v.data}T${v.hora ?? "00:00"}`,
          href: `/congresso/votacoes/${casa}/${v.id}`,
          tituloOficial: corta(`${p.titulo ?? "Votação"}: ${p.ementa ?? v.descricao ?? ""}`, 180),
          subtitulo: corta(v.descricao, 220) || null,
          caminho: casa,
          data: v.data,
          forma: FORMA_VOTACAO[v.tipo] ?? null,
          dado: dadoVotacao(v),
          quemDecidiu: casa === "camara" ? "Plenário da Câmara dos Deputados" : "Plenário do Senado Federal",
          fonte: det?.fonte ?? null,
        },
        casa,
        String(v.id),
      );
    }
  }

  const sp = lerJson(path.join(content, "_gerado", "sp.json"));
  for (const v of sp?.votacoes ?? []) {
    if (!v.plenario || !naJanela(v.data)) continue;
    const p = v.proposicao ?? {};
    const pl = v.placar ?? {};
    const o = {};
    if (typeof pl.votos_sim === "number") o.sim = pl.votos_sim;
    if (typeof pl.votos_nao === "number") o.nao = pl.votos_nao;
    for (const k of ["abstencao", "em_branco", "presidente"]) if (typeof pl[k] === "number") o[k] = pl[k];
    add(
      {
        id: `alesp-${v.id}`,
        ordem: `${v.data}T${v.hora ?? "00:00"}`,
        href: `/sao-paulo/votacoes/${v.id}`,
        tituloOficial: corta(`${p.rotulo ?? "Votação"}: ${p.ementa ?? v.descricao ?? ""}`, 180),
        subtitulo: corta(v.descricao, 220) || null,
        caminho: "alesp",
        data: v.data,
        forma: Object.keys(o).length ? "votacao-nominal" : null,
        dado: Object.keys(o).length ? { tipo: "placar", itens: itensPlacar(o), resultado: v.resultado ?? null } : null,
        quemDecidiu: "Plenário da Assembleia Legislativa do Estado de São Paulo (ALESP)",
        fonte: v.url ? { url: v.url, orgao: "ALESP", acessado_em: sp.atualizado_em?.slice(0, 10) ?? null } : null,
      },
      "alesp",
      v.id,
    );
  }

  const ex = lerJson(path.join(content, "_gerado", "executivo.json"));
  const coletaEx = ex?.atualizado_em?.slice(0, 10) ?? null;
  for (const m of ex?.mpvs ?? []) {
    if (!naJanela(m.data)) continue;
    add(
      {
        id: m.id,
        ordem: `${m.data}T00:00`,
        href: `/executivo/medidas-provisorias/${m.id}`,
        tituloOficial: `Medida Provisória ${m.numero}/${m.ano}`,
        subtitulo: corta(m.ementa, 220) || null,
        caminho: "presidencia",
        data: m.data,
        forma: "ato-individual",
        dado: { tipo: "sem-votacao", caminho: "ato individual do presidente da República" },
        quemDecidiu: "Presidência da República",
        fonte: m.url ? { url: m.url, orgao: "Presidência da República", acessado_em: coletaEx } : null,
      },
      "executivo",
      m.id,
    );
  }
  for (const v of ex?.vetos ?? []) {
    if (!naJanela(v.data_publicacao)) continue;
    add(
      {
        id: v.id,
        ordem: `${v.data_publicacao}T00:00`,
        href: `/executivo/vetos/${v.id}`,
        tituloOficial: `Veto ${v.tipo ?? ""} ${v.numero}/${v.ano}${v.materia_vetada ? ` ao ${v.materia_vetada}` : ""}`.replace(/\s+/g, " "),
        subtitulo: corta(v.ementa, 220) || null,
        caminho: "presidencia",
        data: v.data_publicacao,
        rotuloData: "Publicado em",
        forma: "ato-individual",
        dado: { tipo: "sem-votacao", caminho: "ato individual do presidente da República" },
        quemDecidiu: "Presidência da República",
        fonte: v.url ? { url: v.url, orgao: "Presidência da República", acessado_em: coletaEx } : null,
      },
      "executivo",
      v.id,
    );
  }

  // Leis e decretos (federal, SP e Atibaia): índices públicos já gerados pelas outras seções.
  const normas = [
    { arq: "executivo/normas.json", secao: "executivo", rota: "/executivo/leis-e-decretos", url: 6, data: 3, titulo: 2, ementa: 4, esfera: "federal" },
    { arq: "sao-paulo/normas.json", secao: "governo-sp", rota: "/sao-paulo/leis-e-decretos", url: 6, data: 4, titulo: 2, ementa: 5, esfera: "sp" },
    { arq: "atibaia/normas.json", secao: "atibaia", rota: "/atibaia/leis-e-decretos", url: 8, data: 3, titulo: 2, ementa: 4, esfera: "atibaia" },
  ];
  const ESFERA = {
    federal: { caminho: "presidencia", decreto: "Presidência da República", lei: "Conforme o texto oficial publicado no Diário Oficial da União", orgao: "Diário Oficial da União" },
    sp: { caminho: "governador-sp", decreto: "Governador do Estado de São Paulo", lei: "Conforme o texto oficial publicado no Diário Oficial do Estado", orgao: "Diário Oficial do Estado de São Paulo" },
    atibaia: { caminho: "prefeitura-atibaia", decreto: "Prefeitura de Atibaia", lei: "Conforme o texto oficial publicado na Imprensa Oficial de Atibaia", orgao: "Imprensa Oficial de Atibaia" },
  };
  for (const n of normas) {
    const d = lerJson(path.join(webDir, "public", n.arq));
    if (!d?.n) continue;
    for (const t of d.n) {
      const tipo = d.tipos?.[t[1]] ?? "";
      if (/^Veto/.test(tipo)) continue;
      // Retificações corrigem publicação anterior; não são decisão nova.
      if (/^\s*RETIFICA/i.test(String(t[n.titulo] ?? ""))) continue;
      const data = t[n.data];
      if (!naJanela(data)) continue;
      const e = ESFERA[n.esfera];
      const decreto = /^Decreto/.test(tipo);
      const tit = n.esfera === "atibaia" ? `${tipo} nº ${t[n.titulo]} de Atibaia` : t[n.titulo];
      add(
        {
          id: String(t[0]),
          ordem: `${data}T00:00`,
          href: n.rota,
          tituloOficial: corta(tit, 180),
          subtitulo: corta(t[n.ementa], 220) || null,
          caminho: decreto ? e.caminho : `${tipo} publicada`,
          rotuloCaminho: decreto ? undefined : n.esfera === "federal" ? `${tipo} federal` : n.esfera === "sp" ? `${tipo} estadual (SP)` : `${tipo} de Atibaia`,
          data,
          rotuloData: "Publicada em",
          forma: decreto ? "ato-individual" : null,
          dado: null,
          quemDecidiu: decreto ? e.decreto : e.lei,
          fonte: t[n.url] ? { url: t[n.url], orgao: e.orgao, acessado_em: d.gerado_em?.slice(0, 10) ?? null } : null,
        },
        n.secao,
        String(t[0]),
      );
    }
  }

  const icms = lerJson(path.join(content, "icms", "decisoes.json"));
  for (const x of icms?.itens ?? []) {
    const data = x.datas?.decisao ?? x.datas?.publicacao;
    if (!naJanela(data)) continue;
    const m = x.mudancas?.[0];
    add(
      {
        id: x.id,
        ordem: `${data}T00:00`,
        href: `/impostos/icms/${x.id}`,
        tituloOficial: `${x.instrumento ?? ""} ${x.numero ?? ""}`.trim() || x.id,
        subtitulo: x.orgao ?? null,
        caminho: x.caminho,
        data,
        forma: x.caminho === "confaz" ? "colegiado" : x.caminho === "governador-sp" ? "ato-individual" : null,
        dado: m ? { tipo: "mudanca", item: m.item ?? null, antes: m.antes ?? null, depois: m.depois ?? null, unidade: m.unidade ?? null, vigencia: m.vigencia ?? null } : null,
        quemDecidiu: x.orgao ?? null,
        fonte: x.fontes?.[0] ?? null,
      },
      "icms",
      x.id,
    );
  }

  const stj = lerJson(path.join(content, "_gerado", "justica-stj.json"));
  for (const t of stj?.itens ?? []) {
    const data = t.merito?.data ?? t.datas?.julgamento;
    if (!naJanela(data)) continue;
    add(
      {
        id: t.id,
        ordem: `${data}T00:00`,
        href: `/justica/stj/temas/${t.numero}`,
        tituloOficial: `${t.tipo_precedente ?? "Tema"} ${t.numero} do Superior Tribunal de Justiça`,
        subtitulo: t.situacao ?? null,
        caminho: "stj",
        data,
        forma: "julgamento",
        dado: t.merito?.resultado ? { tipo: "texto", rotulo: "Resultado do julgamento", texto: t.merito.resultado } : null,
        quemDecidiu: t.orgao ? `${t.orgao} do STJ` : null,
        fonte: t.url_oficial ? { url: t.url_oficial, orgao: "Superior Tribunal de Justiça", acessado_em: stj.atualizado_em?.slice(0, 10) ?? null } : null,
      },
      "stj",
      t.id,
    );
  }
  const stf = lerJson(path.join(content, "_gerado", "justica-stf.json"));
  for (const j of stf?.julgamentos ?? []) {
    const data = j.data_julgamento ?? j.data_publicacao;
    if (!naJanela(data)) continue;
    const merito = (j.resultados ?? []).find((r) => r.parte === "mérito");
    add(
      {
        id: j.id,
        ordem: `${data}T00:00`,
        href: `/justica/stf/julgamentos/${j.id}`,
        tituloOficial: `${j.identificacao}${j.tema ? ` (Tema ${j.tema} de repercussão geral)` : ""}`,
        subtitulo: null,
        caminho: "stf",
        data,
        rotuloData: j.data_julgamento ? "Julgado em" : "Publicado em",
        forma: "julgamento",
        dado: merito?.resultado ? { tipo: "texto", rotulo: "Resultado do mérito", texto: merito.resultado } : null,
        quemDecidiu: "Supremo Tribunal Federal (STF)",
        fonte: null,
      },
      "stf",
      j.id,
    );
  }

  itens.sort((a, b) => b.ordem.localeCompare(a.ordem) || a.id.localeCompare(b.id));
  return { gerado_em: new Date().toISOString(), periodo: { inicio, fim: hoje }, itens };
}

/**
 * Índice compacto da busca única: { t: [rótulos dos grupos], i: [[grupo, texto, data, href, detalhe]] }.
 * Ordem dos grupos fixa (fases do projeto); dentro do grupo, a ordem é aplicada no navegador.
 */
const URL_STJ =
  "https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp?novaConsulta=true&tipo_pesquisa=T&cod_tema_inicial={n}&cod_tema_final={n}";
const URL_STF = "https://portal.stf.jus.br/jurisprudenciaRepercussao/detalharProcesso.asp?numeroTema={n}";

export function indiceBusca(content, webDir) {
  const T = [
    "Deputados federais",
    "Senadores",
    "Deputados estaduais (SP)",
    "Votações na Câmara",
    "Votações no Senado",
    "Votações na ALESP",
    "Medidas provisórias",
    "Vetos",
    "Leis federais",
    "Decisões sobre o ICMS",
    "Temas do STJ",
    "Temas do STF",
  ];
  const i = [];
  for (const [g, casa] of [[0, "camara"], [1, "senado"]]) {
    const c = lerJson(path.join(content, "congresso", `${casa}.json`));
    for (const p of c?.parlamentares ?? []) {
      const det = [p.partido, p.uf].filter(Boolean).join("-");
      i.push([g, p.nome, null, `/congresso/${casa}/parlamentares/${p.id}`, `${det}${p.na_lista_atual ? "" : " · fora da lista atual"}`]);
    }
    // Votações agrupadas por proposição: leva à votação mais recente (o índice já vem do mais recente).
    const vistos = new Map();
    for (const v of c?.votacoes ?? []) {
      const p = v.proposicao;
      const k = p?.id ?? `v${v.id}`;
      const e = vistos.get(k);
      if (e) {
        e[4] += 1;
        continue;
      }
      const item = [g + 3, corta(`${p?.titulo ?? "Votação"}: ${p?.ementa ?? v.descricao ?? ""}`, 100), v.data ?? null, `/congresso/votacoes/${casa}/${v.id}`, 1];
      vistos.set(k, item);
      i.push(item);
    }
    for (const it of vistos.values()) it[4] = it[4] === 1 ? "1 votação" : `${it[4]} votações`;
  }
  const sp = lerJson(path.join(content, "_gerado", "sp.json"));
  for (const d of sp?.deputados ?? []) i.push([2, d.nome, null, `/sao-paulo/deputados/${d.id}`, d.partido ?? ""]);
  for (const v of sp?.votacoes ?? []) {
    if (!v.plenario) continue;
    i.push([5, corta(`${v.proposicao?.rotulo ?? "Votação"}: ${v.proposicao?.ementa ?? v.descricao ?? ""}`, 100), v.data ?? null, `/sao-paulo/votacoes/${v.id}`, ""]);
  }
  const ex = lerJson(path.join(content, "_gerado", "executivo.json"));
  for (const m of ex?.mpvs ?? []) i.push([6, corta(`MP ${m.numero}/${m.ano}: ${m.ementa ?? ""}`, 100), m.data ?? null, `/executivo/medidas-provisorias/${m.id}`, m.situacao ?? ""]);
  for (const v of ex?.vetos ?? []) i.push([7, corta(`Veto ${v.numero}/${v.ano} (${v.tipo ?? ""}): ${v.materia_vetada ?? ""} ${v.ementa ?? ""}`, 100), v.data_publicacao ?? null, `/executivo/vetos/${v.id}`, ""]);
  const nf = lerJson(path.join(webDir, "public", "executivo", "normas.json"));
  for (const t of nf?.n ?? []) {
    const tipo = nf.tipos?.[t[1]];
    if (tipo !== "Lei" && tipo !== "Lei Complementar") continue;
    if (!t[6]) continue;
    i.push([8, corta(`${t[2]}: ${t[4] ?? ""}`, 100), t[3] ?? null, t[6], "texto oficial"]);
  }
  const icms = lerJson(path.join(content, "icms", "decisoes.json"));
  for (const x of icms?.itens ?? []) {
    i.push([9, corta(`${x.instrumento ?? ""} ${x.numero ?? ""}: ${x.resumo ?? x.titulo ?? ""}`, 100), x.datas?.decisao ?? x.datas?.publicacao ?? null, `/impostos/icms/${x.id}`, x.orgao ?? ""]);
  }
  const stjIdx = lerJson(path.join(content, "_gerado", "justica-stj.json"));
  const comPaginaStj = new Set((stjIdx?.com_pagina ?? []).map(String));
  const stjDir = path.join(content, "stj", "temas");
  for (const f of fs.existsSync(stjDir) ? fs.readdirSync(stjDir) : []) {
    if (!f.endsWith(".json")) continue;
    const t = lerJson(path.join(stjDir, f));
    if (!t?.numero) continue;
    const n = String(t.numero);
    const href = comPaginaStj.has(n) ? `/justica/stj/temas/${n}` : t.url_oficial === URL_STJ.replaceAll("{n}", n) ? `@stj:${n}` : t.url_oficial;
    if (!href) continue;
    i.push([10, corta(`Tema ${n}: ${t.questao ?? t.tese ?? ""}`, 100), t.datas?.julgamento ?? null, href, comPaginaStj.has(n) ? "" : "página do STJ"]);
  }
  const stfIdx = lerJson(path.join(content, "_gerado", "justica-stf.json"));
  const comPaginaStf = new Set((stfIdx?.com_pagina ?? []).map(String));
  const stf = lerJson(path.join(webDir, "public", "justica", "stf-temas.json"));
  for (const t of stf?.t ?? []) {
    const n = String(t[0]);
    const href = comPaginaStf.has(n) ? `/justica/stf/temas/${n}` : t[9] === URL_STF.replaceAll("{n}", n) ? `@stf:${n}` : t[9];
    if (!href || !t[1]) continue;
    i.push([11, corta(`Tema ${n}: ${t[1]}`, 100), null, href, comPaginaStf.has(n) ? "" : "página do STF"]);
  }
  // "@stj:N" e "@stf:N" = página oficial do tema, montada no navegador com o modelo de "u".
  return { g: new Date().toISOString(), t: T, u: { stj: URL_STJ, stf: URL_STF }, i };
}
