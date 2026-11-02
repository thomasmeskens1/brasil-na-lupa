#!/usr/bin/env node
/**
 * Gera, no build, os índices da seção São Paulo a partir de web/content/{alesp,governo-sp}
 * (copiados de ../dados por sync-data.mjs; rodar depois dele). Pastas ausentes são ignoradas.
 *
 * Servidor/build (content/_gerado/sp.json): deputados, resumo de todas as votações (plenário e
 * comissões), índice invertido deputado → votos, contagens, itens recentes e as ligações das
 * decisões do ICMS com atos e projetos de SP (só por número idêntico, nada é deduzido).
 * Navegador (public/sao-paulo/, arquivos estáticos; a busca roda no navegador):
 *   votacoes.json  votações (com os votos das comissões, que não têm página própria)
 *   projetos.json  proposições (PL, PLC, PEC, PDL, PR)
 *   normas.json    leis, leis complementares, decretos e vetos do governador (com as razões)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = path.join(webDir, "content");
const saidaServidor = path.join(content, "_gerado");
const pub = path.join(webDir, "public", "sao-paulo");

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

const semPontos = (s) => String(s ?? "").replace(/\./g, "");
const chaveProp = (sigla, numero, ano) => `${sigla}|${semPontos(numero)}|${ano}`;
const rotuloProp = (p) => (p?.sigla && p?.numero != null && p?.ano ? `${p.sigla} ${p.numero}/${p.ano}` : null);
const tempo = (v) => `${v.data ?? ""}T${v.hora ?? "99:99"}`;

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

function lerVotacoes(base) {
  const dir = path.join(base, "votacoes");
  const out = [];
  for (const n of listar(dir, (x) => !x.startsWith("indice") && x !== "meta.json")) {
    const d = lerJson(path.join(dir, n));
    if (d?.id && /^[A-Za-z0-9-]{1,60}$/.test(String(d.id))) out.push(d);
  }
  out.sort((a, b) => tempo(b).localeCompare(tempo(a)) || String(b.id).localeCompare(String(a.id)));
  return out;
}

function gerar() {
  const alesp = path.join(content, "alesp");
  const gov = path.join(content, "governo-sp");
  fs.rmSync(pub, { recursive: true, force: true });
  if (!fs.existsSync(alesp) && !fs.existsSync(gov)) return "sem dados";

  const lista = lerJson(path.join(alesp, "parlamentares.json"));
  const metaParl = lerJson(path.join(alesp, "meta.json"));
  const metaVot = lerJson(path.join(alesp, "votacoes", "meta.json"));
  const metaProp = lerJson(path.join(alesp, "proposicoes", "meta.json"));
  const metaNormas = lerJson(path.join(gov, "normas", "meta.json"));

  // ------------------------------------------------------------ Proposições
  const idxProp = listar(path.join(alesp, "proposicoes"), (n) => n.startsWith("indice-")).map((n) =>
    lerJson(path.join(alesp, "proposicoes", n)),
  );
  const projetos = idxProp.flatMap((i) => i?.itens ?? []);
  projetos.sort((a, b) => (b.data_publicacao ?? "").localeCompare(a.data_publicacao ?? "") || b.numero - a.numero);
  const propPorChave = new Map(projetos.map((p) => [chaveProp(p.sigla, p.numero, p.ano), p]));

  // ------------------------------------------------------------ Votações
  const votacoes = lerVotacoes(alesp);
  const deputados = new Map((lista?.itens ?? []).map((p) => [String(p.id), { ...p, id: String(p.id) }]));
  const votosPor = {};
  const plenPorProp = {};
  const comPorProp = new Set();
  const resumos = votacoes.map((d, i) => {
    const plen = d.orgao === "Plenário";
    const pid = d.proposicao?.id != null ? String(d.proposicao.id) : null;
    if (plen && pid) (plenPorProp[pid] ??= []).push(String(d.id));
    if (!plen && pid) comPorProp.add(pid);
    // Índice invertido: um registro por deputado e votação; repetições contadas como na fonte.
    const porDep = new Map();
    for (const v of d.votos ?? []) {
      const p = v.parlamentar_id != null ? String(v.parlamentar_id) : null;
      if (!p || !deputados.has(p)) continue;
      const r = porDep.get(p) ?? { votos: [], marcador: v.marcador_relatorio ?? null };
      r.votos.push(v.voto ?? null);
      porDep.set(p, r);
    }
    for (const [p, r] of porDep) {
      const distintos = [...new Set(r.votos)];
      (votosPor[p] ??= []).push([i, distintos.join(" / "), r.votos.length, r.marcador]);
    }
    return {
      id: String(d.id),
      plenario: plen,
      data: d.data ?? null,
      hora: d.hora ?? null,
      orgao: d.orgao_nome ?? d.orgao ?? null,
      sessao: d.sessao?.titulo ?? null,
      proposicao: d.proposicao
        ? { id: pid, rotulo: rotuloProp(d.proposicao), sigla: d.proposicao.sigla ?? null, ementa: d.proposicao.ementa ?? null, url: d.proposicao.url ?? null }
        : null,
      descricao: d.descricao ?? null,
      resultado: d.resultado_texto_oficial ?? null,
      placar: d.placar_oficial_relatorio && Object.keys(d.placar_oficial_relatorio).length ? d.placar_oficial_relatorio : null,
      n_votos: (d.votos ?? []).length,
      url: d.url ?? d.fonte?.url ?? null,
    };
  });

  // Arquivo do navegador: votações com os votos das comissões (que não têm página própria).
  const dOrg = dicionario();
  const dProp = dicionario();
  const dNome = dicionario();
  const dVoto = dicionario();
  const linhasV = votacoes.map((d, i) => {
    const r = resumos[i];
    const p = r.proposicao;
    const votos = r.plenario
      ? null
      : (d.votos ?? []).map((v) => [dNome.id([v.nome ?? "", v.parlamentar_id && deputados.has(String(v.parlamentar_id)) ? String(v.parlamentar_id) : null]), dVoto.id(v.voto ?? "")]);
    return [
      r.id,
      r.data ?? "",
      r.hora ?? "",
      r.plenario ? 0 : 1,
      dOrg.id(r.orgao ?? ""),
      p ? dProp.id([p.id, p.rotulo, p.ementa ?? "", p.url]) : -1,
      r.descricao ?? "",
      r.resultado,
      r.placar?.votos_sim ?? null,
      r.placar?.votos_nao ?? null,
      r.n_votos,
      r.url,
      votos,
      r.plenario ? null : (d.presidente_votacao ?? null),
    ];
  });
  const kbV = gravar(path.join(pub, "votacoes.json"), {
    gerado_em: new Date().toISOString(),
    o: dOrg.lista,
    p: dProp.lista,
    n: dNome.lista,
    t: dVoto.lista,
    v: linhasV,
  });

  // ------------------------------------------------------------ Projetos (navegador)
  const linhasP = projetos.map((p) => {
    const autores = (p.autores ?? []).map((a) => a.nome).filter(Boolean);
    return [
      String(p.id),
      p.sigla,
      p.numero,
      p.ano,
      p.ementa ?? "",
      p.data_publicacao ?? "",
      autores.length > 3 ? `${autores.slice(0, 3).join("; ")} e mais ${autores.length - 3}` : autores.join("; "),
      p.situacao?.etapa ?? null,
      p.situacao?.ultima_tramitacao?.data ?? null,
      p.situacao?.ultima_tramitacao?.descricao ?? null,
      p.url ?? null,
      p.situacao?.url_norma ?? null,
      comPorProp.has(String(p.id)) ? 1 : 0,
      plenPorProp[String(p.id)] ?? [],
      p.situacao_coletada_em ?? null,
    ];
  });
  const kbP = gravar(path.join(pub, "projetos.json"), { gerado_em: new Date().toISOString(), p: linhasP });

  // ------------------------------------------------------------ Normas do governador
  const idxNormas = listar(path.join(gov, "normas"), (n) => n.startsWith("indice-")).map((n) => lerJson(path.join(gov, "normas", n)));
  const normas = idxNormas.flatMap((i) => i?.itens ?? []);
  normas.sort((a, b) => (b.data_publicacao ?? "").localeCompare(a.data_publicacao ?? "") || String(b.numero ?? "").localeCompare(String(a.numero ?? "")));
  const TIPOS = ["Lei", "Lei Complementar", "Decreto", "Veto Total", "Veto Parcial"];
  const projetoLigado = (p) => {
    if (!p?.sigla || p.numero == null || !p.ano) return null;
    const x = propPorChave.get(chaveProp(p.sigla, p.numero, p.ano));
    return [`${p.sigla} ${p.numero}/${p.ano}`, x ? String(x.id) : null, p.url_alesp ?? x?.url ?? null];
  };
  const linhasN = normas.map((x) => [
    x.id,
    TIPOS.indexOf(x.tipo) >= 0 ? TIPOS.indexOf(x.tipo) : x.tipo,
    x.titulo ?? null,
    x.data_ato ?? "",
    x.data_publicacao ?? "",
    x.ementa ?? null,
    x.url ?? x.fonte?.url ?? null,
    x.retificacao ? 1 : 0,
    x.projeto_origem_texto ?? null,
    projetoLigado(x.projeto ?? x.projeto_origem),
    x.razoes_veto ?? null,
    x.texto ?? null,
    x.fonte?.acessado_em ?? null,
  ]);
  const kbN = gravar(path.join(pub, "normas.json"), { gerado_em: new Date().toISOString(), tipos: TIPOS, n: linhasN });
  const porAnoTipo = {};
  for (const x of normas) {
    const k = `${(x.data_publicacao ?? "").slice(0, 4)}|${x.tipo}`;
    porAnoTipo[k] = (porAnoTipo[k] ?? 0) + 1;
  }

  // ------------------------------------------------------------ Ligações com o ICMS
  const normaPor = new Map(normas.filter((x) => x.numero && !x.retificacao).map((x) => [`${x.tipo}|${semPontos(x.numero)}|${(x.data_ato ?? "").slice(0, 4)}`, x]));
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
        if (n) add({ rotulo: n.titulo ?? `${dec.instrumento} ${m[1]}/${m[2]}`, href: `/sao-paulo/leis-e-decretos#id=${n.id}` });
      }
    }
    for (const m of txt.matchAll(/\b(PLC|PL|PEC|PDL|PR)\s+(\d{1,3}(?:\.\d{3})*|\d+)\/(\d{4})/g)) {
      const p = propPorChave.get(chaveProp(m[1], m[2], m[3]));
      if (!p) continue;
      add({ rotulo: `${p.sigla} ${p.numero}/${p.ano} na lista de projetos`, href: `/sao-paulo/projetos#id=${p.id}` });
      for (const vid of plenPorProp[String(p.id)] ?? []) {
        const r = resumos.find((x) => x.id === vid);
        add({ rotulo: `Votação nominal em Plenário de ${r?.data?.split("-").reverse().join("/") ?? ""}: ${r?.descricao ?? ""}`.trim(), href: `/sao-paulo/votacoes/${vid}` });
      }
      if (comPorProp.has(String(p.id))) {
        add({ rotulo: `Votações em comissões sobre o ${p.sigla} ${p.numero}/${p.ano}`, href: `/sao-paulo/votacoes#p=${p.id}` });
      }
    }
    if (links.length) ligacoes[dec.id] = links;
  }

  // ------------------------------------------------------------ Índice do servidor
  const lstDep = [...deputados.values()]
    .map((p) => {
      const v = votosPor[p.id] ?? [];
      const nPlen = v.filter(([i]) => resumos[i].plenario).length;
      return { id: p.id, nome: p.nome, partido: p.partido ?? null, foto: p.foto ?? null, url_oficial: p.url_oficial ?? null, n_plenario: nPlen, n_comissao: v.length - nPlen };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const porSigla = {};
  for (const p of projetos) porSigla[p.sigla] = (porSigla[p.sigla] ?? 0) + 1;

  gravar(path.join(saidaServidor, "sp.json"), {
    atualizado_em: metaVot?.atualizado_em ?? metaParl?.atualizado_em ?? null,
    periodo: metaVot?.periodo ?? null,
    lista_fonte: lista?.fonte ?? null,
    lista_atualizada_em: lista?.atualizado_em ?? null,
    observacoes_lista: metaParl?.observacoes ?? [],
    // Endereços-modelo da API (com "{ano}") não abrem no navegador: o link vai para a documentação pública da API.
    fontes_votacoes: (metaVot?.fontes ?? [])
      .filter((f) => f?.url)
      .map((f) => (String(f.url).includes("{") ? { ...f, url: metaParl?.fontes?.[0]?.url ?? String(f.url).replace(/\/?\{[^}]+\}/g, "") } : f)),
    contagens_votacoes: metaVot?.contagens?.por_ano ?? null,
    fontes_projetos: idxProp.map((i) => i?.fonte).filter(Boolean),
    observacoes_projetos: metaProp?.observacoes ?? [],
    projetos: { total: projetos.length, por_sigla: porSigla },
    normas: {
      total: normas.length,
      por_ano_tipo: porAnoTipo,
      atualizado_em: metaNormas?.atualizado_em ?? null,
      fontes: metaNormas?.fontes ?? [],
      observacoes: metaNormas?.observacoes ?? [],
      recentes: normas.filter((x) => !x.retificacao).slice(0, 5).map((x) => ({ id: x.id, tipo: x.tipo, titulo: x.titulo, data_publicacao: x.data_publicacao, ementa: x.ementa ?? null, url: x.url ?? null })),
      vetos: normas.filter((x) => /^Veto/.test(x.tipo)).length,
    },
    deputados: lstDep,
    votacoes: resumos,
    votos_por_deputado: votosPor,
    ligacoes_icms: ligacoes,
  });
  return `sp: ${lstDep.length} deputados, ${resumos.length} votações (${resumos.filter((r) => r.plenario).length} em Plenário), ${projetos.length} projetos, ${normas.length} normas, ${Object.keys(ligacoes).length} decisões do ICMS ligadas; votacoes.json ${kbV} KB, projetos.json ${kbP} KB, normas.json ${kbN} KB`;
}

const inicio = Date.now();
fs.mkdirSync(saidaServidor, { recursive: true });
console.log(`[gerar-sao-paulo] ${gerar()} (${Date.now() - inicio} ms).`);
