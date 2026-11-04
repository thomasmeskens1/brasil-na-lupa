#!/usr/bin/env node
/**
 * Gera, no build, os índices da busca de "Quem me representa" (rodar depois de gerar-inicio.mjs).
 *
 * Navegador (public/quem-me-representa/r/, arquivos estáticos; nada do visitante é enviado):
 *   base.json          governadores, deputados estaduais e distritais, deputados federais e senadores
 *                      eleitos (TSE), com os indicadores oficiais do mandato quando há vínculo exato
 *                      com a lista oficial em exercício (Câmara, Senado, ALESP)
 *   mun/<uf>.json      prefeitos, vice-prefeitos e vereadores eleitos em 2024 na UF (compacto)
 *   aut/<casa>-<id>.json  proposições de autoria transformadas em norma (lista aberta no cartão)
 *
 * Entradas: content/eleitos (TSE), content/camara e content/senado (listas oficiais e presença),
 * autoria em content/autoria ou, enquanto o sync não a copia, ../dados/autoria.
 * Nenhum dado é deduzido: só se copiam e reorganizam campos das fontes oficiais.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lerJson, slug } from "./lib/inicio-decisoes.mjs";

const inicio = Date.now();
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = path.join(webDir, "content");
const dados = path.join(webDir, "..", "dados");
const saida = path.join(webDir, "public", "quem-me-representa", "r");
const UFS = ["ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg", "ms", "mt", "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr", "rs", "sc", "se", "sp", "to"];
const CARGOS_MUN = ["Prefeito", "Vice-prefeito", "Vereador"];

/** content/<rel> ou, se ausente, ../dados/<rel>. */
function ler(rel) {
  return lerJson(path.join(content, rel)) ?? lerJson(path.join(dados, rel));
}

function gravar(arquivo, obj) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const txt = JSON.stringify(obj);
  const tmp = `${arquivo}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, txt);
  fs.renameSync(tmp, arquivo);
  return txt.length;
}

/* ---------- listas oficiais em exercício ---------- */
function mapaLista(rel) {
  const d = ler(rel);
  return { fonte: d?.fonte ?? null, porId: new Map((d?.itens ?? []).map((p) => [String(p.id), p])) };
}

function idsComPagina() {
  const ids = { camara: new Set(), senado: new Set(), alesp: new Set() };
  for (const casa of ["camara", "senado"]) {
    for (const p of lerJson(path.join(content, "congresso", `${casa}.json`))?.parlamentares ?? []) ids[casa].add(String(p.id));
  }
  for (const d of lerJson(path.join(content, "_gerado", "sp.json"))?.deputados ?? []) ids.alesp.add(String(d.id));
  return ids;
}

/* ---------- indicadores ---------- */
function fonteResumo(f, extra = {}) {
  return f ? { titulo: f.titulo ?? null, url: f.url, orgao: f.orgao ?? null, acessado_em: f.acessado_em ?? null, ...extra } : null;
}

function prepararAutoria(casa) {
  const a = ler(`autoria/${casa}/aprovadas.json`);
  if (!a) return null;
  const consultados = casa === "senado" ? new Set((a.consultados ?? []).map(String)) : null;
  return {
    meta: {
      periodo: a.periodo ?? null,
      criterio: a.criterio ?? null,
      atualizado_em: a.atualizado_em ?? null,
      fontes: (a.fontes ?? []).map((f) => fonteResumo(f)),
    },
    /** null = sem consulta para este parlamentar (lacuna); [] = consultado, nenhuma. */
    lista(id) {
      if (consultados && !consultados.has(id)) return null;
      return a.autores?.[id] ?? [];
    },
    proposicao: (pid) => a.proposicoes?.[pid] ?? null,
  };
}

function prepararPresenca() {
  const p = ler("camara/presenca/2026.json");
  if (!p) return null;
  const f = p.fonte;
  return {
    meta: {
      ano: p.ano ?? null,
      atualizado_em: p.atualizado_em ?? null,
      definicao: "dias de sessão deliberativa do Plenário em exercício, segundo o registro oficial de frequência",
      fonte: f
        ? {
            titulo: "Frequência em Plenário (registro oficial)",
            url: String(f.url).replace(/\/ListarPresencasDia\?.*$/, "?op=ListarPresencasDia"),
            orgao: f.orgao ?? "Câmara dos Deputados",
            acessado_em: f.acessado_em ?? null,
          }
        : null,
    },
    porId: new Map((p.itens ?? []).map((i) => [String(i.parlamentar_id), i])),
  };
}

/* ---------- execução ---------- */
function main() {
  const meta = ler("eleitos/meta.json");
  if (!meta) {
    console.log("[gerar-representantes] eleitos ausentes; nada a gerar.");
    return;
  }
  fs.rmSync(saida, { recursive: true, force: true });
  const camara = mapaLista("camara/parlamentares.json");
  const senado = mapaLista("senado/parlamentares.json");
  const alesp = mapaLista("alesp/parlamentares.json");
  const listas = { camara, senado, alesp };
  const paginas = idsComPagina();
  const autoria = { camara: prepararAutoria("camara"), senado: prepararAutoria("senado") };
  const presenca = prepararPresenca();

  const pessoas = [];
  const partidos = new Set();
  const fontesEleitos = new Map();
  let arquivosAut = 0;
  let municipaisTotal = 0;

  for (const uf of UFS) {
    const d = ler(`eleitos/${uf}.json`);
    if (!d) continue;
    for (const f of d.fontes ?? []) fontesEleitos.set(`${f.url}|${f.titulo}`, fonteResumo(f));

    // Estaduais e federais.
    for (const x of d.estaduais_federais?.itens ?? []) {
      const o = { k: String(x.sq_candidato ?? `${uf}-${pessoas.length}`), c: x.cargo, n: x.nome_urna, uf: d.uf, p: x.partido ?? null, a: x.ano ?? null, s: x.situacao ?? null };
      if (o.p) partidos.add(o.p);
      const casa = x.vinculo_confianca === "exata" ? x.parlamentar_casa : null;
      const id = casa && x.parlamentar_id ? String(x.parlamentar_id) : null;
      if (casa && id && listas[casa]?.porId.has(id)) {
        const of = listas[casa].porId.get(id);
        o.v = { casa, id };
        if (paginas[casa]?.has(id)) o.h = casa === "alesp" ? `/estados/sp/deputados/${id}` : `/congresso/${casa}/parlamentares/${id}`;
        if (of.nome_civil) o.nc = of.nome_civil;
        if (of.partido) o.pa = { p: of.partido, em: listas[casa].fonte?.acessado_em ?? null };
        if (of.url_oficial) o.uo = of.url_oficial;
        const ind = {};
        const aut = casa === "camara" || casa === "senado" ? autoria[casa] : null;
        if (aut) {
          const l = aut.lista(id);
          if (l) {
            ind.aut = { n: l.length, n1: l.filter(([, ordem]) => ordem === 1).length };
            if (l.length) {
              const itens = l.map(([pid, ordem]) => ({ ...aut.proposicao(pid), ordem }));
              gravar(path.join(saida, "aut", `${casa}-${id}.json`), { casa, id, periodo: aut.meta.periodo, itens });
              arquivosAut += 1;
            }
          }
        }
        if (casa === "camara" && presenca) {
          const i = presenca.porId.get(id);
          if (i && typeof i.dias_presenca === "number" && typeof i.dias_com_sessao === "number") {
            ind.pr = {
              d: i.dias_presenca,
              t: i.dias_com_sessao,
              aj: i.dias_ausencia_justificada ?? null,
              an: i.dias_ausencia_nao_justificada ?? null,
              ini: i.periodo_na_fonte?.inicio ?? null,
              fim: i.periodo_na_fonte?.fim ?? null,
            };
          }
        }
        if (Object.keys(ind).length) o.i = ind;
      }
      pessoas.push(o);
    }

    // Municipais (compacto): [nome, cargo, partido, município, situação].
    if (uf === "df") continue;
    const usados = new Set();
    const municipios = [];
    const p = [];
    for (const m of d.municipios ?? []) {
      let s = slug(m.nome);
      if (usados.has(s)) s = `${s}-${m.codigo_tse}`;
      usados.add(s);
      const mi = municipios.length;
      municipios.push([m.nome, s]);
      for (const x of m.itens ?? []) {
        const ci = CARGOS_MUN.indexOf(x.cargo);
        if (ci < 0) continue;
        if (x.partido) partidos.add(x.partido);
        p.push([x.nome_urna, ci, x.partido ?? null, mi, x.situacao ?? null]);
      }
    }
    municipaisTotal += p.length;
    const fontes24 = (d.fontes ?? []).filter((f) => /2024|munic/i.test(f.titulo ?? "")).map((f) => fonteResumo(f));
    gravar(path.join(saida, "mun", `${uf}.json`), { uf: d.uf, nome_uf: d.nome_uf, ano: 2024, atualizado_em: d.atualizado_em ?? null, cargos: CARGOS_MUN, fontes: fontes24, municipios, p });
  }

  pessoas.sort((a, b) => a.n.localeCompare(b.n, "pt-BR") || a.uf.localeCompare(b.uf));
  const tam = gravar(path.join(saida, "base.json"), {
    gerado_em: new Date().toISOString(),
    eleitos: { atualizado_em: meta.atualizado_em ?? null, aviso: meta.aviso ?? null, fontes: [...fontesEleitos.values()] },
    listas: {
      camara: fonteResumo(camara.fonte),
      senado: fonteResumo(senado.fonte),
      alesp: fonteResumo(alesp.fonte),
    },
    autoria: { camara: autoria.camara?.meta ?? null, senado: autoria.senado?.meta ?? null },
    presenca: { camara: presenca?.meta ?? null },
    partidos: [...partidos].sort((a, b) => a.localeCompare(b, "pt-BR")),
    pessoas,
  });
  console.log(
    `[gerar-representantes] ${pessoas.length} estaduais e federais (base.json ${Math.round(tam / 1024)} KB), ${municipaisTotal} municipais, ` +
      `${arquivosAut} listas de autoria; autoria Câmara ${autoria.camara ? "ok" : "ausente"}, Senado ${autoria.senado ? "ok" : "ausente"} (${Date.now() - inicio} ms).`,
  );
}

main();
