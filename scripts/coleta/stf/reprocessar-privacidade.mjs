#!/usr/bin/env node
// Reaplica o mascaramento da diretriz 12 aos dados já gravados, sem acessar a rede.
// Os coletores (scripts/coleta/stf/coletar.mjs e scripts/coleta/stj/coletar.mjs) fazem o mesmo a cada execução;
// este script serve para limpar o que já está gravado sem refazer a coleta.
// Uso: node scripts/coleta/stf/reprocessar-privacidade.mjs [stf] [stj]   (padrão: os dois)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { reprocessarPasta, registrarAutoridades } from './privacidade.mjs';
import * as libStf from './lib.mjs';
import * as libStj from '../stj/lib.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const alvos = process.argv.slice(2).length ? process.argv.slice(2) : ['stf', 'stj'];
const LIBS = { stf: libStf, stj: libStj };

// Relatores gravados nos temas do STJ (inclui ministros aposentados), como faz o coletor do STJ.
const dirTemas = path.join(RAIZ, 'dados', 'stj', 'temas');
if (fs.existsSync(dirTemas)) for (const a of fs.readdirSync(dirTemas)) {
  const t = libStj.lerJson(path.join(dirTemas, a));
  if (t) registrarAutoridades([...(Array.isArray(t.relator) ? t.relator : [t.relator]), ...(t.processos ?? []).flatMap((x) => [x.relator, x.ministro_proposta_afetacao])]);
}

for (const t of alvos) {
  const lib = LIBS[t];
  if (!lib) { console.error(`alvo desconhecido: ${t}`); process.exit(1); }
  const dir = path.join(RAIZ, 'dados', t);
  const resumo = reprocessarPasta(dir, lib.formatar);
  const arqMeta = path.join(dir, 'meta.json');
  const meta = lib.lerJson(arqMeta);
  if (meta) lib.gravarSeMudou(arqMeta, { ...meta, privacidade: resumo });
  console.log(`[${t}] ${resumo.arquivos_lidos} arquivos lidos, ${resumo.arquivos_regravados_nesta_execucao} regravados; nesta execução: ${JSON.stringify(resumo.nesta_execucao)}; total gravado: ${JSON.stringify(resumo.total_gravado)}`);
}
