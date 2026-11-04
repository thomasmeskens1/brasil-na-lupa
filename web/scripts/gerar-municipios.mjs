#!/usr/bin/env node
/**
 * Gera, no build, os índices da seção Municípios. Rodar depois de sync-data.mjs e gerar-atibaia.mjs.
 *
 * Entradas (web/content/municipios, copiada de ../dados/municipios; se ausente, lê ../dados/municipios):
 *   entes.json                            os 5.570 municípios (Siconfi)
 *   registro.json                         Câmaras com SAPL (Interlegis) e a verificação por amostra
 *   <uf>/<cidade>/**                      coleta SAPL (mesmo contrato dos estados: meta, parlamentares,
 *                                         proposicoes/indice-*, normas/indice-*, votacoes/<id>.json)
 *   financas/<ano>-b<bim>/<uf>.json       RREO do Siconfi (Tesouro Nacional)
 *   Atibaia, por adaptador e sem mover dados: content/_gerado/atibaia.json (gerar-atibaia.mjs).
 *
 * Saídas:
 *   content/_gerado/municipios/indice.json                 municípios com dados e o que cada um tem
 *   content/_gerado/municipios/<uf>/<cidade>.json          índice do servidor da página da cidade
 *   content/_gerado/municipios/<uf>/<cidade>/v/<id>.json   detalhe de cada votação (sem campos internos)
 *   public/municipios/lista.json                           busca no navegador (todos os municípios)
 *   public/municipios/<uf>/<cidade>/camara.json            busca de proposições, votações e leis
 *
 * Regra de inclusão: o município entra quando há pelo menos uma fonte oficial estruturada coletada
 * (Câmara no SAPL, leis e decretos, ou finanças no Siconfi). Nada é deduzido: voto individual só
 * aparece quando a votação é nominal e a fonte traz o voto de cada vereador.
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
const pubBase = arg("--public") ?? path.join(webDir, "public", "municipios");
const saida = path.join(content, "_gerado", "municipios");
const emContent = path.join(content, "municipios");
const base = arg("--dados") ?? (fs.existsSync(emContent) ? emContent : path.join(webDir, "..", "dados", "municipios"));
const ID = /^[A-Za-z0-9-]{1,60}$/;
const SLUG = /^[a-z0-9-]{1,80}$/;

const lerJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};
const listar = (dir, filtro = () => true) => {
  try {
    return fs.readdirSync(dir).filter((n) => n.endsWith(".json") && filtro(n)).sort();
  } catch {
    return [];
  }
};
function gravar(arquivo, dados) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(dados));
  return fs.statSync(arquivo).size;
}
const texto = (v) => (typeof v === "string" && v.trim() ? v : null);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// ------------------------------------------------------------------ finanças (Siconfi)
const ROTULOS_R = {
  TotalReceitas: "Total das receitas",
  ReceitasCorrentes: "Receitas correntes",
  ReceitaTributaria: "Impostos, taxas e contribuições de melhoria",
  Impostos: "Impostos",
  TransferenciasCorrentes: "Transferências correntes",
  ReceitasDeCapital: "Receitas de capital",
  ReceitasDeOperacoesDeCredito: "Operações de crédito (empréstimos)",
};
const ROTULOS_D = {
  TotalDespesas: "Total das despesas",
  DespesasCorrentes: "Despesas correntes",
  PessoalEEncargosSociais: "Pessoal e encargos sociais",
  JurosEEncargosDaDivida: "Juros e encargos da dívida",
  OutrasDespesasCorrentes: "Outras despesas correntes",
  DespesasDeCapital: "Despesas de capital",
  Investimentos: "Investimentos",
  AmortizacaoDaDivida: "Amortização da dívida",
};

function carregarFinancas() {
  const dir = path.join(base, "financas");
  const porIbge = new Map();
  let relatorios = [];
  try {
    relatorios = fs.readdirSync(dir).filter((n) => /^\d{4}-b[1-6]$/.test(n)).sort().reverse();
  } catch {
    return { porIbge, meta: null };
  }
  for (const rel of relatorios) {
    for (const n of listar(path.join(dir, rel))) {
      const d = lerJson(path.join(dir, rel, n));
      if (!d?.itens) continue;
      for (const [ibge, x] of Object.entries(d.itens)) {
        if (!x || x.sem_dados) continue;
        const lista = porIbge.get(Number(ibge)) ?? [];
        const rec = Object.keys(ROTULOS_R).filter((k) => x.receitas?.[k]).map((k) => [ROTULOS_R[k], texto(d.contas?.[k]), ...x.receitas[k].map(num)]);
        const desp = Object.keys(ROTULOS_D).filter((k) => x.despesas?.[k]).map((k) => [ROTULOS_D[k], texto(d.contas?.[k]), ...x.despesas[k].map(num)]);
        lista.push({
          chave: rel,
          exercicio: d.exercicio,
          periodo: d.periodo,
          consultado_em: x.consultado_em ?? null,
          instituicao: texto(x.instituicao),
          receitas: rec,
          despesas: desp,
          funcoes: Array.isArray(x.funcoes) ? x.funcoes.map((f) => [String(f[0]), num(f[1]), num(f[2]), num(f[3])]) : null,
          url: `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio=${d.exercicio}&nr_periodo=${d.periodo}&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo%2001&id_ente=${ibge}`,
          url_funcoes: `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio=${d.exercicio}&nr_periodo=${d.periodo}&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo%2002&id_ente=${ibge}`,
        });
        porIbge.set(Number(ibge), lista);
      }
    }
  }
  return { porIbge, meta: lerJson(path.join(dir, "meta.json")) };
}

// ------------------------------------------------------------------ Câmara (SAPL)
/** Textos do coletor estadual que ainda falem de deputados/Assembleia (coletas antigas). */
const ajustar = (s) =>
  typeof s === "string"
    ? s.replace(/SAPL da Assembleia/g, "SAPL da Câmara Municipal").replace(/da Assembleia\./g, "da Câmara Municipal.").replace(/por deputado/g, "por vereador").replace(/votos de deputados/g, "votos de vereadores")
    : s;

function lerCamara(uf, slug, reg) {
  const dir = path.join(base, uf, slug);
  const meta = lerJson(path.join(dir, "meta.json"));
  if (!meta) return null;
  const parl = lerJson(path.join(dir, "parlamentares.json"));
  const props = listar(path.join(dir, "proposicoes"), (n) => n.startsWith("indice-")).flatMap((n) => lerJson(path.join(dir, "proposicoes", n))?.itens ?? []);
  const normas = listar(path.join(dir, "normas"), (n) => n.startsWith("indice-")).flatMap((n) => lerJson(path.join(dir, "normas", n))?.itens ?? []);
  const votacoes = [];
  for (const n of listar(path.join(dir, "votacoes"), (x) => /^[a-z]{2}-\d+\.json$/.test(x))) {
    const v = lerJson(path.join(dir, "votacoes", n));
    if (v?.id && ID.test(String(v.id))) votacoes.push(v);
  }
  votacoes.sort((a, b) => `${b.data ?? ""}T${b.hora ?? ""}`.localeCompare(`${a.data ?? ""}T${a.hora ?? ""}`) || String(b.id).localeCompare(String(a.id)));
  props.sort((a, b) => String(b.data_apresentacao ?? "").localeCompare(String(a.data_apresentacao ?? "")) || (b.id_oficial ?? 0) - (a.id_oficial ?? 0));
  normas.sort((a, b) => String(b.data ?? "").localeCompare(String(a.data ?? "")) || (b.id_oficial ?? 0) - (a.id_oficial ?? 0));

  const vereadores = (parl?.itens ?? [])
    .filter((p) => p?.id != null && texto(p.nome))
    .map((p) => ({ id: String(p.id), nome: p.nome, partido: texto(p.partido), em_exercicio: p.em_exercicio ?? null, url_oficial: texto(p.url_oficial) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const nomes = new Map(vereadores.map((v) => [v.id, v.nome]));
  const resumoVot = (v) => ({
    id: String(v.id),
    data: v.data ?? null,
    hora: v.hora ?? null,
    sessao: texto(v.sessao?.nome),
    proposicao: v.proposicao ? { sigla: v.proposicao.sigla ?? null, numero: v.proposicao.numero ?? null, ano: v.proposicao.ano ?? null, ementa: ajustar(v.proposicao.ementa ?? null), url: v.proposicao.url ?? null } : null,
    descricao: texto(v.descricao),
    resultado_oficial: texto(v.resultado_oficial),
    tipo: ["nominal", "simbolica", "secreta"].includes(v.tipo) ? v.tipo : null,
    placar: v.tipo === "nominal" || v.tipo === "secreta" ? v.placar ?? null : null,
    votos_situacao: v.votos_situacao ?? null,
    n_votos: v.tipo === "nominal" && Array.isArray(v.votos) ? v.votos.length : 0,
    url: texto(v.url),
  });
  const detalhes = votacoes.map((v) => ({
    ...resumoVot(v),
    etapa: texto(v.etapa),
    resultado_pauta: texto(v.resultado_pauta),
    observacao_oficial: texto(v.observacao_oficial),
    conferencia_placar: texto(v.conferencia_placar),
    totais_registrados: v.tipo === "simbolica" ? v.totais_registrados ?? null : null,
    // Diretriz 5: voto individual só em votação nominal registrada.
    votos: v.tipo === "nominal" && Array.isArray(v.votos) ? v.votos.map((x) => ({ id: x.parlamentar_id != null ? String(x.parlamentar_id) : null, nome: x.nome ?? nomes.get(String(x.parlamentar_id)) ?? null, partido: x.partido ?? null, voto: x.voto ?? null })) : [],
    fonte: v.fonte ?? null,
    fonte_votos: v.tipo === "nominal" ? v.fonte_votos ?? null : null,
    lacunas: (v.lacunas ?? []).map(ajustar),
  }));
  const linhaProp = (p) => ({
    id: String(p.id),
    identificacao: texto(p.identificacao),
    tipo: texto(p.tipo),
    ementa: ajustar(texto(p.ementa)),
    data: p.data_apresentacao ?? null,
    autores: (p.autores ?? []).map((a) => a?.nome).filter(Boolean),
    situacao: p.situacao ? { texto: ajustar(texto(p.situacao.texto)), status: texto(p.situacao.status), data: p.situacao.data ?? null } : null,
    url: texto(p.url),
  });
  const linhaNorma = (n) => ({
    id: `${n.id}`,
    tipo: texto(n.tipo),
    numero: n.numero ?? null,
    ano: n.ano ?? null,
    data: n.data ?? null,
    ementa: ajustar(texto(n.ementa)),
    url: texto(n.url),
  });
  const porSigla = {};
  for (const p of props) if (p.sigla) porSigla[p.sigla] = (porSigla[p.sigla] ?? 0) + 1;
  const porTipoNorma = {};
  for (const n of normas) if (n.tipo) porTipoNorma[n.tipo] = (porTipoNorma[n.tipo] ?? 0) + 1;
  return {
    resumo: {
      nome: texto(meta.orgao) ?? reg?.casa ?? null,
      host: meta.host ?? reg?.host ?? null,
      atualizado_em: meta.atualizado_em ?? null,
      periodo: meta.periodo ?? null,
      fontes: (meta.fontes ?? []).filter((f) => f?.url),
      robots: meta.robots ?? null,
      cobertura: meta.cobertura ?? null,
      observacoes: (meta.observacoes ?? []).map(ajustar),
      legislatura: parl?.legislatura ?? null,
      fonte_vereadores: parl?.fonte ?? null,
      vereadores,
      votacoes: votacoes.map(resumoVot),
      proposicoes: { total: props.length, por_sigla: porSigla, recentes: props.slice(0, 8).map(linhaProp) },
      normas: { total: normas.length, por_tipo: porTipoNorma, recentes: normas.slice(0, 8).map(linhaNorma) },
    },
    detalhes,
    busca: {
      p: props.map((p) => {
        const l = linhaProp(p);
        const emColeta = !l.autores.length && (p.autores_ids ?? []).length > 0;
        return [l.id, l.identificacao, l.ementa, l.data, emColeta ? "ainda em coleta" : l.autores.slice(0, 3).join("; ") + (l.autores.length > 3 ? ` e mais ${l.autores.length - 3}` : ""), l.situacao?.texto ?? l.situacao?.status ?? null, l.url];
      }),
      n: normas.map((x) => {
        const l = linhaNorma(x);
        return [l.id, l.tipo, l.numero, l.ano, l.data, l.ementa, l.url];
      }),
      v: detalhes.map((v) => [v.id, v.data, v.descricao, v.resultado_oficial, v.tipo, v.n_votos, v.proposicao?.ementa ?? null]),
    },
  };
}

// ------------------------------------------------------------------ principal
const inicio = Date.now();
fs.rmSync(saida, { recursive: true, force: true });
fs.rmSync(pubBase, { recursive: true, force: true });
fs.mkdirSync(saida, { recursive: true });

const entesArq = lerJson(path.join(base, "entes.json"));
if (!entesArq?.itens?.length) {
  gravar(path.join(saida, "indice.json"), { gerado_em: new Date().toISOString(), total_municipios: 0, presentes: [], fontes: [] });
  console.log("[gerar-municipios] sem dados (entes.json ausente).");
  process.exit(0);
}
const entes = entesArq.itens
  .map(([cod_ibge, nome, uf, slug, capital, populacao]) => ({ cod_ibge, nome, uf, slug, capital: !!capital, populacao: num(populacao) }))
  .filter((e) => SLUG.test(e.slug) && /^[a-z]{2}$/.test(e.uf));
const registro = lerJson(path.join(base, "registro.json"));
const camaraPor = new Map((registro?.camaras ?? []).map((c) => [`${c.uf}/${c.slug}`, c]));
const fin = carregarFinancas();
const atibaia = lerJson(path.join(content, "_gerado", "atibaia.json"));

// Pastas de coleta SAPL existentes (evita 5.570 leituras sem arquivo).
const comPasta = new Set();
for (const uf of fs.existsSync(base) ? fs.readdirSync(base) : []) {
  if (!/^[a-z]{2}$/.test(uf)) continue;
  for (const c of fs.readdirSync(path.join(base, uf))) if (fs.existsSync(path.join(base, uf, c, "meta.json"))) comPasta.add(`${uf}/${c}`);
}
const presentes = [];
const lista = [];
let nCamaras = 0;
let bytesPub = 0;
for (const e of entes) {
  const k = `${e.uf}/${e.slug}`;
  const reg = camaraPor.get(k) ?? null;
  const cam = comPasta.has(k) ? lerCamara(e.uf, e.slug, reg) : null;
  const financas = fin.porIbge.get(e.cod_ibge) ?? [];
  const ehAtibaia = e.uf === "sp" && e.slug === "atibaia" && !!atibaia;
  const tem = {
    votacoes: (cam?.resumo.votacoes.length ?? 0) > 0,
    leis: (cam?.resumo.normas.total ?? 0) > 0 || (ehAtibaia && (atibaia.normas?.total ?? 0) > 0),
    financas: financas.length > 0 || (ehAtibaia && (atibaia.financas?.length ?? 0) > 0),
    camara: !!cam || (ehAtibaia && !!atibaia.vereadores),
  };
  const flags = (tem.votacoes ? 1 : 0) | (tem.leis ? 2 : 0) | (tem.financas ? 4 : 0) | (tem.camara ? 8 : 0);
  lista.push([e.uf, e.slug, e.nome, flags, e.capital ? 1 : 0]);
  if (!flags) continue;
  if (cam) nCamaras++;
  presentes.push({ uf: e.uf, slug: e.slug, nome: e.nome, cod_ibge: e.cod_ibge, capital: e.capital, tem, atibaia: ehAtibaia });
  const cidade = {
    uf: e.uf,
    slug: e.slug,
    nome: e.nome,
    cod_ibge: e.cod_ibge,
    capital: e.capital,
    populacao: e.populacao,
    populacao_fonte: entesArq.fonte ?? null,
    populacao_exercicio: entesArq.exercicio_populacao ?? null,
    atibaia: ehAtibaia,
    sapl: reg ? { host: reg.host, url: reg.url, casa: reg.casa, verificacao: reg.verificacao ?? null } : null,
    registro_fonte: registro?.fontes?.[0] ?? null,
    camara: cam?.resumo ?? null,
    financas,
    financas_fonte: fin.meta?.fonte ?? null,
  };
  gravar(path.join(saida, e.uf, `${e.slug}.json`), cidade);
  if (cam) {
    for (const d of cam.detalhes) gravar(path.join(saida, e.uf, e.slug, "v", `${d.id}.json`), d);
    bytesPub += gravar(path.join(pubBase, e.uf, e.slug, "camara.json"), { gerado_em: new Date().toISOString(), ...cam.busca });
  }
}
lista.sort((a, b) => a[2].localeCompare(b[2], "pt-BR") || a[0].localeCompare(b[0]));
bytesPub += gravar(path.join(pubBase, "lista.json"), { gerado_em: new Date().toISOString(), m: lista });
const camarasSapl = registro?.camaras ?? [];
gravar(path.join(saida, "indice.json"), {
  gerado_em: new Date().toISOString(),
  total_municipios: entes.length,
  presentes,
  contagens: {
    com_dados: presentes.length,
    com_votacoes: presentes.filter((p) => p.tem.votacoes).length,
    com_leis: presentes.filter((p) => p.tem.leis).length,
    com_financas: presentes.filter((p) => p.tem.financas).length,
    camaras_sapl_registradas: camarasSapl.length,
    camaras_sapl_verificadas: camarasSapl.filter((c) => c.verificacao).length,
    camaras_sapl_api_ok: camarasSapl.filter((c) => c.verificacao?.api_responde).length,
    camaras_sapl_com_votos: camarasSapl.filter((c) => c.verificacao?.votos_nominais_publicados).length,
  },
  fontes: [...(registro?.fontes ?? []), ...(fin.meta?.fonte ? [fin.meta.fonte] : [])],
  financas_relatorios: fin.meta?.relatorios_alvo ?? [],
  financas_atualizado_em: fin.meta?.atualizado_em ?? null,
  registro_atualizado_em: registro?.atualizado_em ?? null,
});
console.log(
  `[gerar-municipios] ${entes.length} municípios, ${presentes.length} com dados (${nCamaras} com Câmara no SAPL, ${presentes.filter((p) => p.tem.financas).length} com finanças); public ${Math.round(bytesPub / 1024)} KB (${Date.now() - inicio} ms).`,
);
