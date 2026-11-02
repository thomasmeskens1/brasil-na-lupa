#!/usr/bin/env node
/**
 * Sincroniza os dados do projeto para dentro de web/ antes de `dev` e `build`.
 *
 * - ../dados/{icms,camara,senado,executivo,stj,stf}/** -> web/content/<mesma pasta>/**
 *   (stf pode ainda não existir: pastas ausentes são ignoradas)
 * - ../dados/glossario.json          -> web/content/glossario.json
 *
 * Pastas ou arquivos ausentes são ignorados. A cópia é feita numa pasta temporária,
 * trocada no fim: um build em paralelo nunca vê content/ vazio ou pela metade.
 * A pasta gerada está no .gitignore. Se ../dados não existir (ex.: deploy feito só
 * com a pasta web/), o script mantém o conteúdo já presente.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dadosDir = path.join(webDir, "..", "dados");
const contentFinal = path.join(webDir, "content");

const PASTAS = ["icms", "camara", "senado", "executivo", "stj", "stf"];
const ARQUIVOS = ["glossario.json"];

function copiarArvore(origem, destino) {
  let n = 0;
  fs.mkdirSync(destino, { recursive: true });
  for (const entrada of fs.readdirSync(origem, { withFileTypes: true })) {
    const o = path.join(origem, entrada.name);
    const d = path.join(destino, entrada.name);
    if (entrada.isDirectory()) n += copiarArvore(o, d);
    else if (entrada.isFile()) {
      fs.copyFileSync(o, d);
      n += 1;
    }
  }
  return n;
}

function limpar(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Substitui content/ pela pasta temporária com a menor janela possível. */
function trocarContent(tmp) {
  const antigo = path.join(webDir, `content.old-${process.pid}`);
  if (fs.existsSync(contentFinal)) {
    try {
      fs.renameSync(contentFinal, antigo);
    } catch {
      // Windows pode bloquear a renomeação se outro processo estiver lendo: remove e segue.
      limpar(contentFinal);
    }
  }
  fs.renameSync(tmp, contentFinal);
  limpar(antigo);
}

function main() {
  if (!fs.existsSync(dadosDir)) {
    if (fs.existsSync(contentFinal)) {
      console.log("[sync-data] ../dados não encontrado; mantendo web/content existente.");
      return;
    }
    // Sem dados: o site usa as fixtures provisórias embutidas no código.
    fs.mkdirSync(contentFinal, { recursive: true });
    console.log("[sync-data] ../dados não encontrado; web/content criado vazio.");
    return;
  }

  const tmp = path.join(webDir, `content.tmp-${process.pid}`);
  limpar(tmp);
  fs.mkdirSync(tmp, { recursive: true });
  const resumo = [];
  for (const p of PASTAS) {
    const origem = path.join(dadosDir, p);
    if (!fs.existsSync(origem) || !fs.statSync(origem).isDirectory()) continue;
    resumo.push(`${p}: ${copiarArvore(origem, path.join(tmp, p))}`);
  }
  for (const a of ARQUIVOS) {
    const origem = path.join(dadosDir, a);
    if (!fs.existsSync(origem)) continue;
    fs.copyFileSync(origem, path.join(tmp, a));
    resumo.push(a);
  }
  fs.writeFileSync(
    path.join(tmp, "_sync.json"),
    JSON.stringify({ sincronizado_em: new Date().toISOString() }, null, 2),
  );
  trocarContent(tmp);
  console.log(`[sync-data] content/ atualizado (${resumo.length ? resumo.join(", ") : "nenhum dado encontrado"}).`);
}

main();
