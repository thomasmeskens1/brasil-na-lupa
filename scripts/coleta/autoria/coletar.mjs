#!/usr/bin/env node
// Coleta diária da autoria de proposições transformadas em norma (Câmara e Senado).
// Uso: node scripts/coleta/autoria/coletar.mjs [--casa camara|senado] [--completo]
//   --completo  ignora o download condicional (ETag) dos arquivos da Câmara.
// Saída: dados/autoria/camara/{aprovadas,meta}.json e dados/autoria/senado/{aprovadas,meta}.json.
import { coletarCamara } from './camara.mjs';
import { coletarSenado } from './senado.mjs';
import { estat } from './lib.mjs';

const args = process.argv.slice(2);
const casaArg = args.includes('--casa') ? args[args.indexOf('--casa') + 1] : null;
if (casaArg && !['camara', 'senado'].includes(casaArg)) {
  console.error('--casa deve ser camara ou senado');
  process.exit(2);
}
const completo = args.includes('--completo');
const inicio = Date.now();
let erro = false;

for (const [nome, fn] of [['camara', () => coletarCamara({ completo })], ['senado', () => coletarSenado()]]) {
  if (casaArg && casaArg !== nome) continue;
  try {
    await fn();
  } catch (e) {
    erro = true;
    console.error(`[autoria/${nome}] falhou: ${e.message}`);
  }
}
console.log(`[autoria] ${estat.requisicoes} requisições, ${estat.retentativas} retentativas, ${Math.round(estat.bytes / 1048576)} MB, ${Math.round((Date.now() - inicio) / 1000)} s.`);
process.exit(erro ? 1 : 0);
