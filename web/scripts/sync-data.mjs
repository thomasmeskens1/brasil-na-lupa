#!/usr/bin/env node
/**
 * Sincroniza os dados do projeto para dentro de web/ antes de `dev` e `build`.
 *
 * - ../dados/{icms,camara,senado,executivo,stj,stf,alesp,governo-sp,atibaia,tribunais-contas,eleitos,agenda,titulos}/** -> web/content/<mesma pasta>/**
 *   (pastas ausentes são ignoradas). De Atibaia não se copiam a pasta de curadoria (revisao/)
 *   nem o texto bruto das edições (normas/edicoes-*.json): o site só usa os índices publicados.
 *   Dos títulos simples, não se copia a curadoria (revisao/ e amostra-revisao.json).
 *   Dos tribunais de contas, a curadoria do TCU (tcu/curadoria/) é copiada: o site exibe as
 *   ressalvas e alertas literais das Contas do Presidente que ela registra.
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

const PASTAS = ["icms", "camara", "senado", "executivo", "stj", "stf", "alesp", "governo-sp", "atibaia", "tribunais-contas", "eleitos", "agenda", "titulos", "estados"];
/** Caminhos relativos a ../dados que não entram em content/ (material de curadoria). */
const EXCLUIR = [/^atibaia\/revisao(\/|$)/, /^atibaia\/normas\/edicoes-[^/]*$/, /^titulos\/revisao(\/|$)/, /^titulos\/amostra-revisao(-\d+)?\.json$/];
const ARQUIVOS = ["glossario.json"];

function copiarArvore(origem, destino) {
  let n = 0;
  fs.mkdirSync(destino, { recursive: true });
  for (const entrada of fs.readdirSync(origem, { withFileTypes: true })) {
    const o = path.join(origem, entrada.name);
    const d = path.join(destino, entrada.name);
    const rel = path.relative(dadosDir, o).split(path.sep).join("/");
    if (EXCLUIR.some((re) => re.test(rel))) continue;
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
  // Antivírus ou indexador do Windows podem segurar a pasta recém-copiada por instantes: tenta de novo.
  for (let tentativa = 1; ; tentativa++) {
    try {
      fs.renameSync(tmp, contentFinal);
      break;
    } catch (e) {
      if (e?.code !== "EPERM") throw e;
      if (tentativa >= 10) {
        // Bloqueio persistente (ex.: observador de arquivos do editor): copia em vez de renomear.
        fs.cpSync(tmp, contentFinal, { recursive: true });
        limpar(tmp);
        break;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300 * tentativa);
    }
  }
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
