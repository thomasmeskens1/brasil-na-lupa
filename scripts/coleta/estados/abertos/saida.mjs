// Leitura e gravação dos arquivos publicados em dados/estados/<uf>/ (os próprios arquivos guardam o estado
// da coleta incremental). Toda gravação passa antes pela conferência de privacidade.
import fs from 'node:fs';
import path from 'node:path';
import { lerJson, gravarSeMudou, conferirPrivacidade } from './base.mjs';

const lerDir = (dir, re) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => re.test(f)).sort() : []);

/** Itens de todos os indice-<ano>.json da subpasta → Map(id → item). */
export function lerIndices(dir, sub) {
  const m = new Map();
  for (const f of lerDir(path.join(dir, sub), /^indice-.+\.json$/)) {
    for (const it of lerJson(path.join(dir, sub, f))?.itens || []) if (it?.id) m.set(it.id, it);
  }
  return m;
}

export function gravar(arquivo, obj) {
  conferirPrivacidade(obj);
  return gravarSeMudou(arquivo, obj);
}

/** Grava um indice-<ano>.json por ano (anoDe(item) → ano ou "sem-data"); devolve { ano: n }. */
export function gravarIndices(dir, sub, itens, anoDe, cabecalho, ordenar) {
  const porAno = new Map();
  for (const it of itens) {
    const a = anoDe(it) || 'sem-data';
    if (!porAno.has(a)) porAno.set(a, []);
    porAno.get(a).push(it);
  }
  const cont = {};
  for (const [ano, lista] of porAno) {
    lista.sort(ordenar);
    gravar(path.join(dir, sub, `indice-${ano}.json`), { ...cabecalho(ano), itens: lista });
    cont[ano] = lista.length;
  }
  return cont;
}

/** Votações: um arquivo por votação + índice por ano com o resumo. */
export function gravarVotacoes(dir, votacoes, cabecalho) {
  const porAno = new Map();
  for (const v of votacoes) {
    gravar(path.join(dir, 'votacoes', `${v.id}.json`), v);
    const a = v.data ? v.data.slice(0, 4) : 'sem-data';
    if (!porAno.has(a)) porAno.set(a, []);
    porAno.get(a).push({
      id: v.id, data: v.data, proposicao: v.proposicao?.sigla ? `${v.proposicao.sigla} ${v.proposicao.numero}/${v.proposicao.ano}` : v.proposicao?.id ?? null,
      descricao: v.descricao, resultado_oficial: v.resultado_oficial, tipo: v.tipo, votos_situacao: v.votos_situacao, n_votos: v.votos.length,
    });
  }
  const cont = {};
  for (const [ano, itens] of porAno) {
    itens.sort((x, y) => String(y.data).localeCompare(String(x.data)) || String(y.id).localeCompare(String(x.id)));
    gravar(path.join(dir, 'votacoes', `indice-${ano}.json`), { ...cabecalho(ano), itens });
    cont[ano] = itens.length;
  }
  return cont;
}

export const porDataDesc = (campo) => (a, b) => String(b[campo] || '').localeCompare(String(a[campo] || '')) || (Number(b.numero) || 0) - (Number(a.numero) || 0) || String(b.id).localeCompare(String(a.id));
