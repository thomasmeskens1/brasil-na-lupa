#!/usr/bin/env node
/**
 * Coletor de fontes abertas estaduais sem SAPL: Pernambuco (ALEPE) e Distrito Federal (CLDF). Node 20+, sem dependências.
 *
 * USO
 *   node scripts/coleta/estados/abertos/coletar.mjs               # PE e DF, em paralelo (hosts diferentes)
 *   node scripts/coleta/estados/abertos/coletar.mjs --uf pe
 *   node scripts/coleta/estados/abertos/coletar.mjs --anos 2025,2026   # padrão: ano corrente
 *   COLETA_ORCAMENTO_MIN=15 (padrão)  PE_MAX_DETALHES=40  DF_MAX_DETALHES=40  DF_MAX_PAGINAS=40
 *   node scripts/coleta/estados/abertos/testes.mjs                # testes offline
 *
 * SAÍDA (dados/estados/<uf>/, contrato de dados/esquema.json + "uf" e "casa"):
 *   meta.json, parlamentares.json, proposicoes/indice-<ano>.json, normas/indice-<ano>.json,
 *   votacoes/<id>.json + votacoes/indice-<ano>.json (só PE: resultado de cada discussão em Plenário, sem voto individual).
 *
 * REGRAS: robots.txt de cada host antes de qualquer outra requisição; intervalo mínimo por host (Crawl-delay + 1 s,
 * ou 2 s se não declarado); User-Agent que cita o Brasil na Lupa; sem CPF, login, IP ou telefone; nomes de
 * particulares mascarados; nada deduzido. Gravação atômica; arquivo sem mudança não é regravado.
 * Código de saída: 0 = ok; 1 = alguma UF falhou por inteiro.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Cliente, hojeISO } from './base.mjs';
import { coletarPE } from './coletar-pe.mjs';
import { coletarDF } from './coletar-df.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const COLETORES = { pe: coletarPE, df: coletarDF };
const ufs = (val('--uf') || Object.keys(COLETORES).join(',')).toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
for (const u of ufs) if (!COLETORES[u]) { console.error(`UF sem coletor neste script: ${u}`); process.exit(1); }
const hoje = hojeISO();
const anos = (val('--anos') || hoje.slice(0, 4)).split(',').map(Number).filter((a) => a >= 1990 && a <= Number(hoje.slice(0, 4)));
if (!anos.length) { console.error('Uso: --anos AAAA[,AAAA]'); process.exit(1); }
const orcamentoMin = Number(process.env.COLETA_ORCAMENTO_MIN || 15);
const inicio = Date.now();
const prazoMs = inicio + orcamentoMin * 60000;
const log = (...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(0)}s]`, ...m);
log(`Abertos: ${ufs.join(', ')}; anos ${anos.join(', ')}; orçamento ${orcamentoMin} min`);

const res = await Promise.all(ufs.map(async (u) => {
  const cliente = new Cliente({ prazoMs, log: (...m) => log(`[${u.toUpperCase()}]`, ...m) });
  const dir = path.join(RAIZ, 'dados', 'estados', u);
  fs.mkdirSync(dir, { recursive: true });
  try {
    return await COLETORES[u]({ cliente, dir, hoje, anos, inicioExec: new Date(inicio).toISOString(), log: (...m) => log(`[${u.toUpperCase()}]`, ...m) });
  } catch (e) {
    log(`[${u.toUpperCase()}] FALHA: ${e.stack || e.message}`);
    return { uf: u.toUpperCase(), ok: false };
  }
}));
for (const r of res) log(`${r.uf}: ${r.ok ? 'ok' : 'falhou'}${r.resumo ? ` — ${JSON.stringify(r.resumo)}` : ''}`);
process.exit(res.every((r) => r.ok) ? 0 : 1);
