#!/usr/bin/env node
/**
 * Gera, no build, os índices da seção Congresso a partir de web/content/{camara,senado}
 * (copiados de ../dados por sync-data.mjs; rodar depois dele).
 *
 * - content/congresso/<casa>.json  (só servidor/build): parlamentares (lista oficial + quem
 *   aparece em votações nominais e não está na lista atual), resumo de todas as votações e o
 *   índice invertido parlamentar → votos nominais. Evita ler ~3.800 arquivos por página.
 * - public/congresso/busca.json    (navegador): índice compacto para a busca de votações.
 *   É um arquivo estático; a busca roda no navegador e nada do visitante é enviado.
 *
 * Nenhum dado é deduzido: só se copiam e reorganizam campos da fonte.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = path.join(webDir, "content");
const saidaServidor = path.join(content, "congresso");
const saidaPublica = path.join(webDir, "public", "congresso");

const CASAS = ["camara", "senado"];
const TIPOS = ["nominal", "simbolica", "secreta"];

function lerJson(arquivo) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    return null;
  }
}

function tituloProposicao(p) {
  if (!p) return null;
  return p.titulo ?? p.identificacao ?? (p.sigla && p.numero && p.ano ? `${p.sigla} ${p.numero}/${p.ano}` : null);
}

function chaveTempo(v) {
  return `${v.data ?? ""}T${v.hora ?? "99:99"}`;
}

function gerarCasa(casa) {
  const dir = path.join(content, casa, "votacoes");
  if (!fs.existsSync(dir)) return null;
  const lista = lerJson(path.join(content, casa, "parlamentares.json"));
  const meta = lerJson(path.join(content, casa, "meta.json"));

  const votacoes = [];
  for (const nome of fs.readdirSync(dir)) {
    if (!nome.endsWith(".json") || nome.startsWith("indice")) continue;
    const d = lerJson(path.join(dir, nome));
    if (!d || !d.id) continue;
    votacoes.push(d);
  }
  votacoes.sort((a, b) => chaveTempo(b).localeCompare(chaveTempo(a)) || String(b.id).localeCompare(String(a.id)));

  const resumos = votacoes.map((d) => ({
    id: String(d.id),
    data: d.data ?? null,
    hora: d.hora ?? null,
    tipo: d.tipo ?? null,
    resultado: d.resultado ?? null,
    orgao: d.orgao_nome ?? d.orgao ?? null,
    proposicao: d.proposicao
      ? {
          id: d.proposicao.id != null ? String(d.proposicao.id) : null,
          titulo: tituloProposicao(d.proposicao),
          sigla: d.proposicao.sigla ?? null,
          ementa: d.proposicao.ementa ?? null,
        }
      : null,
    descricao: d.descricao ?? null,
    placar: d.placar ?? null,
  }));

  // Parlamentares da lista oficial atual.
  const parlamentares = new Map();
  for (const p of lista?.itens ?? []) {
    parlamentares.set(String(p.id), { ...p, id: String(p.id), na_lista_atual: true });
  }

  // Índice invertido: só votações nominais, só o que a fonte registra em "votos".
  const votosPor = {};
  votacoes.forEach((d, i) => {
    if (d.tipo !== "nominal") return;
    for (const v of d.votos ?? []) {
      const pid = v.parlamentar_id != null ? String(v.parlamentar_id) : null;
      if (!pid) continue;
      (votosPor[pid] ??= []).push([i, v.voto ?? null]);
      // Quem votou e não está na lista atual: nome, partido e UF do registro mais recente.
      if (!parlamentares.has(pid)) {
        parlamentares.set(pid, {
          id: pid,
          nome: v.nome,
          partido: v.partido ?? null,
          uf: v.uf ?? null,
          foto: null,
          url_oficial: null,
          na_lista_atual: false,
          registro_de: d.data ?? null,
        });
      }
    }
  });

  const ordenados = [...parlamentares.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return {
    casa,
    atualizado_em: meta?.atualizado_em ?? lista?.atualizado_em ?? null,
    lista_atualizada_em: lista?.atualizado_em ?? null,
    lista_fonte: lista?.fonte ?? null,
    fontes: meta?.fontes ?? [],
    periodo: meta?.periodo ?? null,
    observacoes: meta?.observacoes ?? [],
    parlamentares: ordenados,
    votacoes: resumos,
    votos_por_parlamentar: votosPor,
  };
}

function main() {
  const inicio = Date.now();
  fs.mkdirSync(saidaServidor, { recursive: true });
  fs.mkdirSync(saidaPublica, { recursive: true });

  const proposicoes = [];
  const indiceProp = new Map();
  const linhas = [];
  const casas = {};
  const resumo = [];

  CASAS.forEach((casa, c) => {
    const r = gerarCasa(casa);
    if (!r) return;
    fs.writeFileSync(path.join(saidaServidor, `${casa}.json`), JSON.stringify(r));
    casas[casa] = { atualizado_em: r.atualizado_em };
    resumo.push(`${casa}: ${r.votacoes.length} votações, ${r.parlamentares.length} parlamentares`);
    for (const v of r.votacoes) {
      let pi = -1;
      if (v.proposicao?.titulo) {
        const k = `${c}|${v.proposicao.id ?? v.proposicao.titulo}`;
        if (!indiceProp.has(k)) {
          indiceProp.set(k, proposicoes.length);
          proposicoes.push([v.proposicao.titulo, v.proposicao.ementa ?? ""]);
        }
        pi = indiceProp.get(k);
      }
      const t = TIPOS.indexOf(v.tipo);
      const res = v.resultado === "aprovada" ? 1 : v.resultado === "rejeitada" ? 0 : -1;
      linhas.push([
        c,
        v.id,
        v.data ?? "",
        t,
        res,
        pi,
        v.descricao ?? "",
        v.placar?.sim ?? null,
        v.placar?.nao ?? null,
        v.hora ?? "",
      ]);
    }
  });

  linhas.sort((a, b) => `${b[2]}T${b[9] || "99:99"}`.localeCompare(`${a[2]}T${a[9] || "99:99"}`));
  const busca = { gerado_em: new Date().toISOString(), casas, p: proposicoes, v: linhas.map((l) => l.slice(0, 9)) };
  fs.writeFileSync(path.join(saidaPublica, "busca.json"), JSON.stringify(busca));
  const kb = Math.round(fs.statSync(path.join(saidaPublica, "busca.json")).size / 1024);
  console.log(`[gerar-congresso] ${resumo.join("; ") || "sem dados"}; busca.json ${kb} KB (${Date.now() - inicio} ms).`);
}

main();
