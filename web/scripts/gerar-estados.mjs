#!/usr/bin/env node
/**
 * Gera, no build, os índices da seção Estados (Assembleias Legislativas e governadores) para
 * as UFs com dados presentes. Funciona com 0 ou N estados. Rodar depois de sync-data.mjs.
 *
 * Entradas (em web/content, copiadas de ../dados):
 *   estados/<uf>/meta.json, parlamentares.json, proposicoes/indice-<ano>.json,
 *   votacoes/<id>.json, normas/indice-<ano>.json     (contrato de dados/esquema.json + "uf" e "casa")
 *   SP, por adaptador e sem mover dados: alesp/** (Assembleia) e governo-sp/normas/** (governador).
 *
 * Saídas:
 *   content/_gerado/estados/indice.json   UFs presentes e contagens (página /estados)
 *   content/_gerado/estados/<uf>.json     índice do servidor: deputados, resumos das votações,
 *                                         votos por deputado, contagens, atos recentes e, em SP,
 *                                         as ligações com as decisões do ICMS (número idêntico)
 *   public/estados/<uf>/votacoes.json     busca no navegador (com os votos das comissões)
 *   public/estados/<uf>/projetos.json
 *   public/estados/<uf>/normas.json
 *
 * Opções (para testes fora do repositório): --content <pasta> --public <pasta>.
 * Nada é deduzido: voto individual só entra quando a votação é nominal (tipo "nominal").
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (nome) => {
  const i = process.argv.indexOf(nome);
  return i > 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null;
};
const content = arg("--content") ?? path.join(webDir, "content");
const pubBase = arg("--public") ?? path.join(webDir, "public", "estados");
const saida = path.join(content, "_gerado", "estados");

const UFS = ["ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg", "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "sp", "se", "to"];
const ID = /^[A-Za-z0-9-]{1,60}$/;

function lerJson(arquivo) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    return null;
  }
}

function listar(dir, filtro = () => true) {
  try {
    return fs.readdirSync(dir).filter((n) => n.endsWith(".json") && filtro(n)).sort();
  } catch {
    return [];
  }
}

function gravar(arquivo, dados) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(dados));
  return Math.round(fs.statSync(arquivo).size / 1024);
}

const semPontos = (s) => String(s ?? "").replace(/\./g, "");
const chaveProp = (sigla, numero, ano) => `${sigla}|${semPontos(numero)}|${ano}`;
const rotuloProp = (p) => (p?.sigla && p?.numero != null && p?.ano ? `${p.sigla} ${p.numero}/${p.ano}` : null);
const tempo = (v) => `${v.data ?? ""}T${v.hora ?? "99:99"}`;
const ehPlenario = (d) => d.orgao === "Plenário" || d.orgao_sigla === "PLEN";
const texto = (v) => (typeof v === "string" && v.trim() ? v : null);
const numero = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Dicionário de valores repetidos (o arquivo do navegador guarda só o índice). */
function dicionario() {
  const lista = [];
  const mapa = new Map();
  return {
    lista,
    id(v) {
      const k = JSON.stringify(v);
      if (!mapa.has(k)) {
        mapa.set(k, lista.length);
        lista.push(v);
      }
      return mapa.get(k);
    },
  };
}

/** Onde estão os dados de cada UF. SP lê as pastas já existentes (adaptador). */
function pastas(uf) {
  if (uf === "sp") {
    const leg = path.join(content, "alesp");
    return {
      leg,
      normas: path.join(content, "governo-sp", "normas"),
      metaRaiz: path.join(leg, "meta.json"),
      metaVot: path.join(leg, "votacoes", "meta.json"),
      metaProp: path.join(leg, "proposicoes", "meta.json"),
      metaNormas: path.join(content, "governo-sp", "normas", "meta.json"),
    };
  }
  const leg = path.join(content, "estados", uf);
  return {
    leg,
    normas: path.join(leg, "normas"),
    metaRaiz: path.join(leg, "meta.json"),
    metaVot: path.join(leg, "votacoes", "meta.json"),
    metaProp: path.join(leg, "proposicoes", "meta.json"),
    metaNormas: path.join(leg, "normas", "meta.json"),
  };
}

function presente(p) {
  return ["parlamentares.json", "meta.json"].some((n) => fs.existsSync(path.join(p.leg, n))) || listar(path.join(p.leg, "votacoes")).length > 0 || listar(p.normas).length > 0 || listar(path.join(p.leg, "proposicoes")).length > 0;
}

function lerVotacoes(dir) {
  const out = [];
  for (const n of listar(dir, (x) => !x.startsWith("indice") && x !== "meta.json")) {
    const d = lerJson(path.join(dir, n));
    if (d?.id != null && ID.test(String(d.id))) out.push(d);
  }
  out.sort((a, b) => tempo(b).localeCompare(tempo(a)) || String(b.id).localeCompare(String(a.id)));
  return out;
}

/** Forma da votação como a fonte informa; sem o campo, só é nominal se a fonte trouxer votos. */
function forma(d) {
  const t = texto(d.tipo)?.toLowerCase();
  if (t === "nominal" || t === "simbolica" || t === "secreta") return t;
  return null;
}

/**
 * Placar oficial em pares rótulo → número (ordem fixa de dados/esquema.json, depois os extras).
 * SP: totais do rodapé do Relatório de Verificação de Votação.
 */
function placarDe(d) {
  const r = d.placar_oficial_relatorio;
  if (r && Object.keys(r).length) {
    const p = { sim: numero(r.votos_sim), nao: numero(r.votos_nao), abstencao: numero(r.abstencao), "Em branco": numero(r.em_branco), Presidente: numero(r.presidente) };
    const out = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== null));
    return Object.keys(out).length ? { itens: out, total: numero(r.total) } : null;
  }
  const g = d.placar;
  if (g && typeof g === "object") {
    const out = Object.fromEntries(Object.entries(g).filter(([k, v]) => k !== "total" && numero(v) !== null));
    return Object.keys(out).length ? { itens: out, total: numero(g.total) } : null;
  }
  return null;
}

/** Campos de uma norma, aceitando o formato do governo de SP e o de dados/esquema.json → norma/decisao. */
function lerNorma(x) {
  const fonte = x.fonte ?? (Array.isArray(x.fontes) ? x.fontes[0] : null);
  const links = x.links && typeof x.links === "object" ? Object.values(x.links).find((v) => typeof v === "string" && /^https?:\/\//.test(v)) : null;
  return {
    id: String(x.id ?? ""),
    tipo: texto(x.tipo) ?? texto(x.instrumento) ?? "Ato",
    titulo: texto(x.titulo) ?? texto(x.nome_oficial),
    numero: x.numero ?? null,
    data_ato: texto(x.data_ato) ?? texto(x.data_assinatura) ?? texto(x.datas?.decisao) ?? "",
    data_publicacao: texto(x.data_publicacao) ?? texto(x.datas?.publicacao) ?? texto(x.publicacao_dou?.[0]?.data) ?? texto(x.publicacao?.[0]?.data) ?? "",
    ementa: texto(x.ementa) ?? texto(x.resumo),
    url: texto(x.url) ?? texto(fonte?.url) ?? links ?? null,
    retificacao: !!x.retificacao,
    projeto_origem_texto: texto(x.projeto_origem_texto) ?? (Array.isArray(x.projeto_origem) ? x.projeto_origem.map((p) => texto(p?.identificacao)).filter(Boolean).join("; ") || null : null),
    projeto: x.projeto ?? (x.projeto_origem && !Array.isArray(x.projeto_origem) ? x.projeto_origem : null),
    razoes_veto: texto(x.razoes_veto),
    texto: texto(x.texto),
    acessado_em: texto(fonte?.acessado_em),
  };
}

function processar(uf) {
  const p = pastas(uf);
  const pub = path.join(pubBase, uf);
  fs.rmSync(pub, { recursive: true, force: true });
  if (!presente(p)) return null;

  const lista = lerJson(path.join(p.leg, "parlamentares.json"));
  const metaRaiz = lerJson(p.metaRaiz);
  const metaVot = lerJson(p.metaVot) ?? metaRaiz;
  const metaProp = lerJson(p.metaProp);
  const metaNormas = lerJson(p.metaNormas);

  // ------------------------------------------------------------ Proposições
  const idxProp = listar(path.join(p.leg, "proposicoes"), (n) => n.startsWith("indice-")).map((n) => lerJson(path.join(p.leg, "proposicoes", n)));
  const projetos = idxProp.flatMap((i) => i?.itens ?? []).filter((x) => x?.id != null && x.sigla);
  projetos.sort((a, b) => (b.data_publicacao ?? "").localeCompare(a.data_publicacao ?? "") || (Number(b.numero) || 0) - (Number(a.numero) || 0));
  const propPorChave = new Map(projetos.map((x) => [chaveProp(x.sigla, x.numero, x.ano), x]));
  const siglas = {};
  for (const x of projetos) if (texto(x.tipo) && !siglas[x.sigla]) siglas[x.sigla] = x.tipo;

  // ------------------------------------------------------------ Votações
  const votacoes = lerVotacoes(path.join(p.leg, "votacoes"));
  const deputados = new Map(
    (lista?.itens ?? []).filter((x) => x?.id != null && ID.test(String(x.id)) && texto(x.nome)).map((x) => [String(x.id), { ...x, id: String(x.id) }]),
  );
  const votosPor = {};
  const plenPorProp = {};
  const comPorProp = new Set();
  const resumos = votacoes.map((d, i) => {
    const plen = ehPlenario(d);
    const f = forma(d);
    const votos = f === "nominal" ? (d.votos ?? []) : [];
    const pid = d.proposicao?.id != null ? String(d.proposicao.id) : null;
    if (plen && pid) (plenPorProp[pid] ??= []).push(String(d.id));
    if (!plen && pid) comPorProp.add(pid);
    if (d.proposicao?.sigla && texto(d.proposicao.tipo) && !siglas[d.proposicao.sigla]) siglas[d.proposicao.sigla] = d.proposicao.tipo;
    // Índice invertido: um registro por deputado e votação; repetições contadas como na fonte.
    const porDep = new Map();
    for (const v of votos) {
      const id = v.parlamentar_id != null ? String(v.parlamentar_id) : null;
      if (!id || !deputados.has(id)) continue;
      const r = porDep.get(id) ?? { votos: [], marcador: v.marcador_relatorio ?? null };
      r.votos.push(v.voto ?? null);
      porDep.set(id, r);
    }
    for (const [id, r] of porDep) (votosPor[id] ??= []).push([i, [...new Set(r.votos)].join(" / "), r.votos.length, r.marcador]);
    return {
      id: String(d.id),
      plenario: plen,
      forma: f,
      data: d.data ?? null,
      hora: d.hora ?? null,
      orgao: d.orgao_nome ?? d.orgao ?? null,
      sessao: d.sessao?.titulo ?? null,
      proposicao: d.proposicao
        ? { id: pid, rotulo: rotuloProp(d.proposicao), sigla: d.proposicao.sigla ?? null, ementa: d.proposicao.ementa ?? null, url: d.proposicao.url ?? null }
        : null,
      descricao: d.descricao ?? null,
      resultado: d.resultado_texto_oficial ?? d.resultado ?? null,
      placar: placarDe(d),
      n_votos: votos.length,
      url: d.url ?? d.fonte?.url ?? null,
      acessado_em: d.fonte?.acessado_em ?? null,
      _votos: votos,
      _presidente: d.presidente_votacao ?? null,
    };
  });

  // Arquivo do navegador: votações, com os votos das comissões (que não têm página própria).
  const dOrg = dicionario();
  const dProp = dicionario();
  const dNome = dicionario();
  const dVoto = dicionario();
  const linhasV = resumos.map((r) => {
    const pr = r.proposicao;
    const votos = r.plenario
      ? null
      : r._votos.map((v) => [dNome.id([v.nome ?? "", v.parlamentar_id != null && deputados.has(String(v.parlamentar_id)) ? String(v.parlamentar_id) : null]), dVoto.id(v.voto ?? "")]);
    return [
      r.id,
      r.data ?? "",
      r.hora ?? "",
      r.plenario ? 0 : 1,
      dOrg.id(r.orgao ?? ""),
      pr ? dProp.id([pr.id, pr.rotulo, pr.ementa ?? "", pr.url]) : -1,
      r.descricao ?? "",
      r.resultado,
      r.placar?.itens ?? null,
      r.forma,
      r.n_votos,
      r.url,
      votos,
      r.plenario ? null : r._presidente,
      r.acessado_em,
    ];
  });
  const kbV = gravar(path.join(pub, "votacoes.json"), { gerado_em: new Date().toISOString(), o: dOrg.lista, p: dProp.lista, n: dNome.lista, t: dVoto.lista, v: linhasV });

  // ------------------------------------------------------------ Projetos (navegador)
  const linhasP = projetos.map((x) => {
    const autores = (x.autores ?? (x.autor ? [x.autor] : [])).map((a) => a?.nome).filter(Boolean);
    return [
      String(x.id),
      x.sigla,
      x.numero,
      x.ano,
      x.ementa ?? "",
      x.data_publicacao ?? x.data_apresentacao ?? "",
      autores.length > 3 ? `${autores.slice(0, 3).join("; ")} e mais ${autores.length - 3}` : autores.join("; "),
      x.situacao?.etapa ?? (typeof x.situacao === "string" ? x.situacao : null),
      x.situacao?.ultima_tramitacao?.data ?? null,
      x.situacao?.ultima_tramitacao?.descricao ?? null,
      x.url ?? null,
      x.situacao?.url_norma ?? null,
      comPorProp.has(String(x.id)) ? 1 : 0,
      plenPorProp[String(x.id)] ?? [],
      x.situacao_coletada_em ?? x.fonte?.acessado_em ?? null,
    ];
  });
  const kbP = gravar(path.join(pub, "projetos.json"), { gerado_em: new Date().toISOString(), siglas, p: linhasP });

  // ------------------------------------------------------------ Normas do governador
  const idxNormas = listar(p.normas, (n) => n.startsWith("indice-")).map((n) => lerJson(path.join(p.normas, n)));
  const normas = idxNormas.flatMap((i) => i?.itens ?? []).map(lerNorma).filter((x) => x.id);
  normas.sort((a, b) => b.data_publicacao.localeCompare(a.data_publicacao) || String(b.numero ?? "").localeCompare(String(a.numero ?? "")));
  const TIPOS = [...new Set(["Lei", "Lei Complementar", "Decreto", "Veto Total", "Veto Parcial", ...normas.map((x) => x.tipo)])];
  const projetoLigado = (pj) => {
    if (!pj?.sigla || pj.numero == null || !pj.ano) return null;
    const x = propPorChave.get(chaveProp(pj.sigla, pj.numero, pj.ano));
    return [`${pj.sigla} ${pj.numero}/${pj.ano}`, x ? String(x.id) : null, pj.url_alesp ?? pj.url ?? x?.url ?? null];
  };
  const linhasN = normas.map((x) => [
    x.id,
    TIPOS.indexOf(x.tipo),
    x.titulo,
    x.data_ato,
    x.data_publicacao,
    x.ementa,
    x.url,
    x.retificacao ? 1 : 0,
    x.projeto_origem_texto,
    projetoLigado(x.projeto),
    x.razoes_veto,
    x.texto,
    x.acessado_em,
  ]);
  const kbN = gravar(path.join(pub, "normas.json"), { gerado_em: new Date().toISOString(), tipos: TIPOS, n: linhasN });
  const porAnoTipo = {};
  for (const x of normas) {
    const k = `${x.data_publicacao.slice(0, 4)}|${x.tipo}`;
    porAnoTipo[k] = (porAnoTipo[k] ?? 0) + 1;
  }

  // ------------------------------------------------------------ Ligações com o ICMS (só SP)
  const ligacoes = uf === "sp" ? ligacoesIcms(normas, propPorChave, plenPorProp, comPorProp, resumos) : {};

  // ------------------------------------------------------------ Índice do servidor
  const lstDep = [...deputados.values()]
    .map((x) => {
      const v = votosPor[x.id] ?? [];
      const nPlen = v.filter(([i]) => resumos[i].plenario).length;
      return {
        id: x.id,
        nome: x.nome,
        partido: x.partido ?? null,
        foto: x.foto ?? null,
        url_oficial: x.url_oficial ?? null,
        em_exercicio: x.em_exercicio ?? null,
        n_plenario: nPlen,
        n_comissao: v.length - nPlen,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const porSigla = {};
  for (const x of projetos) porSigla[x.sigla] = (porSigla[x.sigla] ?? 0) + 1;
  const plen = resumos.filter((r) => r.plenario);

  const fontesMeta = (m) =>
    (m?.fontes ?? [])
      .filter((f) => f?.url)
      // Endereços-modelo de API (com "{…}") não abrem no navegador: o link vai para a primeira fonte da coleta.
      .map((f) => (String(f.url).includes("{") ? { ...f, url: metaRaiz?.fontes?.find((g) => g?.url && !String(g.url).includes("{"))?.url ?? String(f.url).replace(/\/?\{[^}]+\}/g, "") } : f));

  const indice = {
    uf,
    atualizado_em: metaVot?.atualizado_em ?? metaRaiz?.atualizado_em ?? lista?.atualizado_em ?? null,
    periodo: metaVot?.periodo ?? null,
    lista_fonte: lista?.fonte ?? null,
    lista_atualizada_em: lista?.atualizado_em ?? null,
    observacoes_lista: metaRaiz?.observacoes ?? [],
    fontes_votacoes: fontesMeta(metaVot),
    fontes_projetos: idxProp.map((i) => i?.fonte).filter((f) => f?.url),
    observacoes_projetos: metaProp?.observacoes ?? [],
    siglas,
    projetos: { total: projetos.length, por_sigla: porSigla },
    normas: {
      total: normas.length,
      por_ano_tipo: porAnoTipo,
      atualizado_em: metaNormas?.atualizado_em ?? idxNormas.find((i) => i?.atualizado_em)?.atualizado_em ?? null,
      fontes: [...fontesMeta(metaNormas), ...(metaNormas ? [] : idxNormas.flatMap((i) => (i?.fonte ? [i.fonte] : (i?.fontes ?? []))).filter((f) => f?.url))],
      observacoes: metaNormas?.observacoes ?? [],
      recentes: normas
        .filter((x) => !x.retificacao)
        .slice(0, 5)
        .map((x) => ({ id: x.id, tipo: x.tipo, titulo: x.titulo, data_ato: x.data_ato || null, data_publicacao: x.data_publicacao || null, ementa: x.ementa, url: x.url, acessado_em: x.acessado_em })),
      vetos: normas.filter((x) => /^Veto/i.test(x.tipo)).length,
    },
    deputados: lstDep,
    votacoes: resumos.map(({ _votos, _presidente, ...r }) => r),
    votos_por_deputado: votosPor,
    ligacoes_icms: ligacoes,
  };
  gravar(path.join(saida, `${uf}.json`), indice);
  return {
    resumo: {
      atualizado_em: indice.atualizado_em,
      normas_atualizado_em: indice.normas.atualizado_em,
      deputados: lstDep.length,
      votacoes: resumos.length,
      plenario: plen.length,
      plenario_nominal: plen.filter((r) => r.forma === "nominal").length,
      comissoes: resumos.length - plen.length,
      projetos: projetos.length,
      normas: normas.length,
    },
    texto: `${uf}: ${lstDep.length} deputados, ${resumos.length} votações (${plen.length} em Plenário), ${projetos.length} projetos, ${normas.length} normas${uf === "sp" ? `, ${Object.keys(ligacoes).length} decisões do ICMS ligadas` : ""}; votacoes.json ${kbV} KB, projetos.json ${kbP} KB, normas.json ${kbN} KB`,
  };
}

/** Atos, projetos e votações de SP com o mesmo número citado numa decisão do ICMS (nada é deduzido). */
function ligacoesIcms(normas, propPorChave, plenPorProp, comPorProp, resumos) {
  const base = "/estados/sp";
  const normaPor = new Map(normas.filter((x) => x.numero && !x.retificacao).map((x) => [`${x.tipo}|${semPontos(x.numero)}|${x.data_ato.slice(0, 4)}`, x]));
  const ligacoes = {};
  for (const dec of lerJson(path.join(content, "icms", "decisoes.json"))?.itens ?? []) {
    if (dec.caminho !== "alesp" && dec.caminho !== "governador-sp") continue;
    const txt = String(dec.numero ?? "");
    const links = [];
    const visto = new Set();
    const add = (l) => !visto.has(l.href) && (visto.add(l.href), links.push(l));
    if (dec.instrumento === "Lei" || dec.instrumento === "Decreto" || dec.instrumento === "Lei Complementar") {
      const semProjetos = txt.replace(/\b(PLC|PL|PEC|PDL|PR)\s+[\d.,\se]+\/\d{4}/g, "");
      for (const m of semProjetos.matchAll(/(\d{1,3}(?:\.\d{3})*)\/(\d{4})/g)) {
        const n = normaPor.get(`${dec.instrumento}|${semPontos(m[1])}|${m[2]}`);
        if (n) add({ rotulo: n.titulo ?? `${dec.instrumento} ${m[1]}/${m[2]}`, href: `${base}/leis-e-decretos#id=${n.id}` });
      }
    }
    for (const m of txt.matchAll(/\b(PLC|PL|PEC|PDL|PR)\s+(\d{1,3}(?:\.\d{3})*|\d+)\/(\d{4})/g)) {
      const pj = propPorChave.get(chaveProp(m[1], m[2], m[3]));
      if (!pj) continue;
      add({ rotulo: `${pj.sigla} ${pj.numero}/${pj.ano} na lista de projetos`, href: `${base}/projetos#id=${pj.id}` });
      for (const vid of plenPorProp[String(pj.id)] ?? []) {
        const r = resumos.find((x) => x.id === vid);
        add({ rotulo: `Votação nominal em Plenário de ${r?.data?.split("-").reverse().join("/") ?? ""}: ${r?.descricao ?? ""}`.trim(), href: `${base}/votacoes/${vid}` });
      }
      if (comPorProp.has(String(pj.id))) add({ rotulo: `Votações em comissões sobre o ${pj.sigla} ${pj.numero}/${pj.ano}`, href: `${base}/votacoes#p=${pj.id}` });
    }
    if (links.length) ligacoes[dec.id] = links;
  }
  return ligacoes;
}

const inicio = Date.now();
fs.rmSync(saida, { recursive: true, force: true });
fs.mkdirSync(saida, { recursive: true });
const presentes = {};
const linhas = [];
for (const uf of UFS) {
  const r = processar(uf);
  if (!r) continue;
  presentes[uf] = r.resumo;
  linhas.push(r.texto);
}
gravar(path.join(saida, "indice.json"), { gerado_em: new Date().toISOString(), ufs: presentes });
console.log(`[gerar-estados] ${linhas.length ? linhas.join(" | ") : "nenhum estado com dados"} (${Date.now() - inicio} ms).`);
