#!/usr/bin/env node
/**
 * Coletor SAPL 3 (Interlegis) das Câmaras Municipais — reaproveita, sem alterar, o coletor estadual
 * (scripts/coleta/estados/sapl/**): mesmo planejador, mesmas regras (robots.txt primeiro, ≥ 61 s entre
 * requisições ao mesmo host contando desde a 1ª e entre execuções, /materia/docacessorio/ nunca,
 * nenhum PDF baixado), mesma privacidade (privacidade.mjs de Atibaia) e o mesmo contrato de arquivos
 * dos estados, gravado em dados/municipios/<uf>/<cidade>/.
 *
 * USO
 *   node scripts/coleta/municipios/sapl.mjs                          # próximas câmaras verificadas (padrão 8)
 *   node scripts/coleta/municipios/sapl.mjs --cidade pb/joao-pessoa,rn/natal
 *   node scripts/coleta/municipios/sapl.mjs --max 12                 # quantas câmaras nesta execução
 *   node scripts/coleta/municipios/sapl.mjs --desde 2025-01-01       # limite da retroação (padrão: início da legislatura)
 *   COLETA_ORCAMENTO_MIN=25 (padrão)   SAPL_PAGE_SIZE=1000 (padrão)
 *
 * Só entram câmaras do registro (dados/municipios/registro.json) cuja verificação mostrou robots.txt
 * permitindo a API e a API respondendo. Ordem: capitais e câmaras com votos nominais publicados primeiro;
 * depois a que está há mais tempo sem coleta (rodízio).
 */
import fs from 'node:fs';
import path from 'node:path';
import { Armazem } from '../estados/sapl/armazem.mjs';
import { executarCasa } from '../estados/sapl/tarefas.mjs';
import { DIR_MUNICIPIOS, RAIZ, fetchComNossoAgente, hojeISO, lerJson } from './lib.mjs';

/**
 * O Armazém estadual grava em dados/estados/<uf>. Para municípios, a configuração da casa traz "dir";
 * o carregamento é refeito a partir dele (mesmo código de leitura do Armazém, nada mais muda).
 */
const carregarOriginal = Armazem.prototype._carregar;
if (!Armazem.prototype.__municipios) {
  Armazem.prototype.__municipios = true;
  Armazem.prototype._carregar = function carregarMunicipio() {
    if (this.cfg?.dir) {
      this.dir = this.cfg.dir;
      this.meta = lerJson(path.join(this.dir, 'meta.json')) || {};
      this.cursor = this.meta.cursor || { fluxos: {}, tabelas_em: {}, ultima_requisicao: null, pendencias_inexistentes: [] };
      this.tabelas = lerJson(path.join(this.dir, 'tabelas.json')) || {};
      const mascaras = lerJson(path.join(this.dir, 'revisao', 'mascaras.json')) || {};
      this.regras = (chave) => [...(mascaras['*'] || []), ...(mascaras[chave] || [])];
    }
    return carregarOriginal.call(this);
  };
}

export function dirCidade(c) {
  return path.join(DIR_MUNICIPIOS, c.uf, c.slug);
}

/** Configuração da "casa" no formato do coletor estadual. */
export function cfgCamara(c) {
  const dominio = c.host.replace(/^sapl\./, '');
  return {
    uf: c.uf.toUpperCase(),
    host: c.host,
    casa: `cm-${c.slug}`,
    nome: c.casa || `Câmara Municipal de ${c.municipio}`,
    dominios_email: [dominio],
    dir: dirCidade(c),
  };
}

/** Textos do coletor estadual escritos para Assembleias, ajustados para Câmaras Municipais. */
export function ajustarTexto(s) {
  return s
    .replace(/SAPL 3 \(Interlegis\) da Assembleia/g, 'SAPL 3 (Interlegis) da Câmara Municipal')
    .replace(/SAPL da Assembleia/g, 'SAPL da Câmara Municipal')
    .replace(/registro de voto por deputado/g, 'registro de voto por vereador')
    .replace(/não são votos de deputados/g, 'não são votos de vereadores');
}

/** Reescreve os textos padrão nos arquivos da cidade (só strings do coletor; dados da fonte intocados). */
export function ajustarArquivos(dir) {
  const andar = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'revisao') andar(f); continue; }
      if (!e.name.endsWith('.json')) continue;
      const t = fs.readFileSync(f, 'utf8');
      const n = ajustarTexto(t);
      if (n !== t) fs.writeFileSync(f, n, 'utf8');
    }
  };
  andar(dir);
}

export function escolherCamaras(reg, entes, { cidades, max }) {
  const ok = (reg.camaras || []).filter((c) => c.verificacao?.api_permitida && c.verificacao?.api_responde);
  if (cidades) return ok.filter((c) => cidades.includes(`${c.uf}/${c.slug}`));
  const capitais = new Set(entes.filter((e) => e[4]).map((e) => e[0]));
  const ultima = (c) => lerJson(path.join(dirCidade(c), 'meta.json'))?.ultima_execucao || '';
  return ok
    .map((c) => ({ c, u: ultima(c) }))
    .sort((a, b) => Number(Boolean(a.u)) - Number(Boolean(b.u))
      || Number(capitais.has(b.c.cod_ibge)) - Number(capitais.has(a.c.cod_ibge))
      || Number(Boolean(b.c.verificacao.votos_nominais_publicados)) - Number(Boolean(a.c.verificacao.votos_nominais_publicados))
      || a.u.localeCompare(b.u)
      || a.c.municipio.localeCompare(b.c.municipio, 'pt-BR'))
    .slice(0, max)
    .map((x) => x.c);
}

async function main() {
  const args = process.argv.slice(2);
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const cidades = val('--cidade') ? val('--cidade').toLowerCase().split(',').map((s) => s.trim()) : null;
  const max = Math.max(1, Number(val('--max') || 8));
  const desde = val('--desde');
  if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) { console.error('Uso: --desde AAAA-MM-DD'); process.exit(1); }
  const orcamentoMin = Number(process.env.COLETA_ORCAMENTO_MIN || 25);
  const pageSize = Math.max(10, Math.min(5000, Number(process.env.SAPL_PAGE_SIZE || 1000)));
  const reg = lerJson(path.join(DIR_MUNICIPIOS, 'registro.json'));
  const entes = lerJson(path.join(DIR_MUNICIPIOS, 'entes.json'))?.itens || [];
  if (!reg?.camaras) { console.error('dados/municipios/registro.json ausente: rode registro.mjs'); process.exit(1); }
  const lista = escolherCamaras(reg, entes, { cidades, max });
  const inicio = Date.now();
  const log = (...m) => console.log(`[${((Date.now() - inicio) / 1000).toFixed(0)}s]`, ...m);
  if (!lista.length) { log('nenhuma câmara verificada com API disponível'); return; }
  log(`SAPL municipal: ${lista.map((c) => `${c.uf}/${c.slug}`).join(', ')} — orçamento ${orcamentoMin} min`);
  const prazoMs = inicio + orcamentoMin * 60000;
  const fetchImpl = fetchComNossoAgente();
  const res = await Promise.all(lista.map((c) => {
    const cfg = cfgCamara(c);
    const logC = (...m) => log(`[${c.uf}/${c.slug}]`, ...m);
    return executarCasa(cfg, { raiz: RAIZ, hoje: hojeISO(), prazoMs, pageSize, desde, log: logC, fetchImpl })
      .then((r) => { ajustarArquivos(cfg.dir); return { ...r, cidade: `${c.uf}/${c.slug}` }; })
      .catch((e) => ({ cidade: `${c.uf}/${c.slug}`, falhas: [e.stack || e.message], robotsOk: false }));
  }));
  for (const r of res) log(`${r.cidade}: ${r.requisicoes ?? 0} requisições; falhas: ${r.falhas.length ? r.falhas.slice(0, 5).join(' | ') : 'nenhuma'}`);
  process.exit(res.some((r) => !r.robotsOk) ? 1 : 0);
}

if (process.argv[1] && /sapl\.mjs$/.test(process.argv[1])) {
  main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
}
