#!/usr/bin/env node
/**
 * Coletor SAPL 3 (Interlegis) das Assembleias Legislativas de AM, PI, PB, RO, AC, AL, RR e TO — genérico, parametrizado
 * pelo host (hosts.mjs). Node 20+, sem dependências.
 *
 * USO
 *   node scripts/coleta/estados/sapl/coletar.mjs                  # todas as UFs, em paralelo (um relógio por host)
 *   node scripts/coleta/estados/sapl/coletar.mjs --uf am,ro
 *   node scripts/coleta/estados/sapl/coletar.mjs --desde 2025-01-01   # limite da retroação (padrão: início da legislatura atual)
 *   COLETA_ORCAMENTO_MIN=25 (padrão) — minutos por execução; nenhuma requisição começa depois disso
 *   SAPL_PAGE_SIZE=1000 (padrão, só na 1ª execução de cada UF; depois fica fixo no cursor) — o servidor limita ao máximo aceito
 *   node scripts/coleta/estados/sapl/testes.mjs                    # testes offline
 *
 * O QUE COLETA (API REST pública, JSON)
 *   deputados: mandatos da legislatura atual (+ filiação partidária)  → parlamentares.json
 *   proposições: matérias + última tramitação                         → proposicoes/indice-<ano>.json
 *   sessões plenárias e itens de pauta (Ordem do Dia e Expediente)    → sessoes/indice-<ano>.json, sessoes/pauta-<ano>.json
 *   resultado de cada votação + votos nominais por deputado           → votacoes/<uf>-<id>.json, votacoes/indice-<ano>.json
 *   normas jurídicas (leis; decretos e outras só se o SAPL trouxer)   → normas/indice-<ano>.json
 *   tabelas de apoio e cursor                                         → tabelas.json, meta.json
 *
 * REGRAS: robots.txt primeiro; ≥ 61 s entre requisições ao mesmo host (Crawl-delay: 60), contando desde a
 * primeira e entre execuções (meta.json guarda a última); /materia/docacessorio/ nunca; User-Agent dos
 * coletores do projeto. Gravação atômica; arquivo sem mudança não é regravado.
 * Código de saída: 0 = ok; 1 = alguma UF não conseguiu ler o robots.txt (falhas pontuais vão para meta.json).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hojeISO } from '../../alesp/lib.mjs';
import { CASAS } from './hosts.mjs';
import { executarCasa } from './tarefas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');

const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const ufs = (val('--uf') || Object.keys(CASAS).join(',')).toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
for (const u of ufs) if (!CASAS[u]) { console.error(`UF sem SAPL configurado: ${u}`); process.exit(1); }
const desde = val('--desde');
if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) { console.error('Uso: --desde AAAA-MM-DD'); process.exit(1); }
const orcamentoMin = Number(process.env.COLETA_ORCAMENTO_MIN || 25);
if (!(orcamentoMin > 0)) { console.error('COLETA_ORCAMENTO_MIN inválido'); process.exit(1); }
const pageSize = Math.max(10, Math.min(5000, Number(process.env.SAPL_PAGE_SIZE || 1000)));

const inicio = Date.now();
const prazoMs = inicio + orcamentoMin * 60000;
const log = (...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(0)}s]`, ...m);
log(`SAPL: ${ufs.join(', ')} — orçamento ${orcamentoMin} min, page_size solicitado ${pageSize}`);

const resultados = await Promise.all(ufs.map((u) => executarCasa(CASAS[u], {
  raiz: RAIZ, hoje: hojeISO(), prazoMs, pageSize, desde, log,
}).catch((e) => ({ uf: CASAS[u].uf, falhas: [e.stack || e.message], robotsOk: false }))));

let erro = false;
for (const r of resultados) {
  if (!r.robotsOk) erro = true; // falhas pontuais não derrubam o workflow: ficam em meta.json
  log(`${r.uf}: ${r.requisicoes ?? 0} requisições; falhas: ${r.falhas.length ? r.falhas.join(' | ') : 'nenhuma'}`);
}
process.exit(erro ? 1 : 0);
