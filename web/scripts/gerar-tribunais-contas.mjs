#!/usr/bin/env node
/**
 * Gera, no build, os índices de busca dos acórdãos dos tribunais de contas a partir de
 * web/content/tribunais-contas/<orgao>/acordaos/indice-<ano>.json (copiado de ../dados por
 * sync-data.mjs). Pasta ausente é ignorada.
 *
 * Navegador (public/tribunais-de-contas/<orgao>/acordaos-<ano>.json): um arquivo por ano, só com
 * número, colegiado, tipo, data da sessão, relator, situação e sumário. O link oficial é montado
 * no navegador a partir da KEY oficial e do modelo de endereço publicado no próprio índice.
 * Servidor (content/_gerado/tc-<orgao>-acordaos.json): anos, totais, lacunas e fontes dos índices.
 * Não há página por acórdão: as páginas próprias são só as das coleções (contas do Presidente e
 * impostos), lidas pelo servidor de content/.
 *
 * Diretriz 12: o sumário só sai daqui quando a coleta não o omitiu (aviso de privacidade) e não
 * traz número de CPF ou CNPJ; nesses casos vai só o aviso.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = path.join(webDir, "content", "tribunais-contas");
const pub = path.join(webDir, "public", "tribunais-de-contas");
const saidaServidor = path.join(webDir, "content", "_gerado");

const CPF_CNPJ = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/;
const PREFIXO_KEY = "ACORDAO-COMPLETO-";

function lerJson(arquivo) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    return null;
  }
}

function gravar(arquivo, dados) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(dados));
  return Math.round(fs.statSync(arquivo).size / 1024);
}

function indice(lista, v) {
  if (v == null) return -1;
  let i = lista.indexOf(v);
  if (i < 0) i = lista.push(v) - 1;
  return i;
}

/** Linha compacta: [key, número, colegiado, tipo, data, relator, situação, sumário, aviso]. */
function gerarAno(arq) {
  const j = lerJson(arq);
  if (!j?.itens) return null;
  const colegiados = [];
  const tipos = [];
  const relatores = [];
  const situacoes = ["OFICIALIZADO"];
  let omitidos = 0;
  const n = j.itens.map((x) => {
    const id = String(x.id ?? "");
    const key = id.startsWith(PREFIXO_KEY) && /^\d+$/.test(id.slice(PREFIXO_KEY.length)) ? Number(id.slice(PREFIXO_KEY.length)) : id;
    let sumario = typeof x.sumario === "string" && x.sumario.trim() ? x.sumario.trim() : null;
    let aviso = x.aviso_privacidade ? 1 : 0;
    if (sumario && CPF_CNPJ.test(sumario)) {
      sumario = null;
      aviso = 1;
    }
    if (aviso) omitidos += 1;
    return [
      key,
      String(x.numero ?? ""),
      indice(colegiados, x.colegiado ?? null),
      indice(tipos, x.tipo ?? null),
      x.data_sessao ?? "",
      indice(relatores, x.relator ?? null),
      indice(situacoes, x.situacao ?? null),
      sumario,
      aviso,
    ];
  });
  n.sort((a, b) => b[4].localeCompare(a[4]) || Number(b[1]) - Number(a[1]));
  return {
    ano: j.ano,
    dados: {
      ano: j.ano,
      atualizado_em: j.atualizado_em ?? null,
      prefixo: PREFIXO_KEY,
      url_modelo: j.url_modelo ?? null,
      c: colegiados,
      t: tipos,
      r: relatores,
      s: situacoes,
      n,
    },
    total: n.length,
    omitidos,
    lacunas: j.lacunas ?? [],
    fonte: j.fonte ?? null,
  };
}

function main() {
  const inicio = Date.now();
  fs.rmSync(pub, { recursive: true, force: true });
  if (!fs.existsSync(base)) {
    console.log("[gerar-tribunais-contas] sem dados.");
    return;
  }
  const resumo = [];
  for (const orgao of fs.readdirSync(base)) {
    if (!/^[a-z0-9-]+$/.test(orgao)) continue;
    const dir = path.join(base, orgao, "acordaos");
    if (!fs.existsSync(dir)) continue;
    const servidor = { anos: [], lacunas: [], fontes: [] };
    for (const nome of fs.readdirSync(dir).filter((x) => /^indice-\d{4}\.json$/.test(x)).sort()) {
      const r = gerarAno(path.join(dir, nome));
      if (!r) continue;
      const kb = gravar(path.join(pub, orgao, `acordaos-${r.ano}.json`), r.dados);
      servidor.anos.push({ ano: r.ano, total: r.total, sem_sumario_por_privacidade: r.omitidos });
      for (const l of r.lacunas) if (!servidor.lacunas.includes(l)) servidor.lacunas.push(l);
      if (r.fonte && !servidor.fontes.some((x) => x.url === r.fonte.url)) servidor.fontes.push(r.fonte);
      resumo.push(`${orgao} ${r.ano}: ${r.total} acórdãos (${kb} KB; ${r.omitidos} sem sumário por privacidade)`);
    }
    // Resumo para o servidor (lacunas e fontes dos índices), sem precisar ler os índices de vários MB.
    gravar(path.join(saidaServidor, `tc-${orgao}-acordaos.json`), servidor);
  }
  console.log(`[gerar-tribunais-contas] ${resumo.length ? resumo.join("; ") : "nenhum índice"} (${Date.now() - inicio} ms).`);
}

main();
