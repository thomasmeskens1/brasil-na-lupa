// Cursor de coleta de uma rota da API do SAPL lida em ordem decrescente de id (o=-id): o mais recente
// primeiro, depois retroage. Funções puras (sem rede), testadas em testes.mjs.
//
// Estado de um fluxo (gravado em meta.json → cursor.fluxos.<nome>):
//   { faixas: [{ hi, lo, n, lo_data }], concluido, tamanho_pagina }
//   Cada faixa é um intervalo contíguo de ids já lidos (n = quantos registros existem nele).
//   A primeira faixa sempre começa no registro mais novo depois da fase "topo" de cada execução,
//   então a posição do próximo registro antigo na lista o=-id é exatamente n: a página seguinte é
//   calculada a partir de n. Se a fase topo não terminar (orçamento), a faixa nova fica separada
//   e é emendada na execução seguinte.
//   Conferência de deriva: quando a página traz a posição n-1, o registro ali tem de ser o "lo"
//   da faixa; se não for (registro apagado na fonte), a posição é corrigida ou a página recua.

export function estadoVazio() {
  return { faixas: [], concluido: false, tamanho_pagina: null };
}

export function iniciarExecucao(estado) {
  return { fase: estado.faixas.length ? 'topo' : 'retro', pagina: 1, nova: null, recuo: 0, paginas: 0 };
}

/**
 * Próxima requisição { pagina, tamanho } (tamanho null = o solicitado de sempre), ou null.
 * Na retroação, o tamanho da página varia entre S/2 e S (S = máximo aceito pelo servidor) para que a
 * página contenha o último id conhecido (posição n-1) logo no início: serve de âncora contra deriva.
 */
export function proximaPagina(estado, exec) {
  if (exec.fase === 'topo') return { pagina: exec.pagina, tamanho: null };
  if (!estado.faixas.length) return { pagina: 1, tamanho: null };
  if (estado.concluido) return null;
  const S = estado.tamanho_pagina;
  if (!S) return { pagina: 1, tamanho: null };
  const n = estado.faixas[0].n;
  const alvo = Math.max(0, n - 1 - exec.recuo * Math.ceil(S / 2));
  // Ganho = registros novos depois da âncora na página: s - 1 - (alvo mod s).
  let melhor = S;
  const ganho = (s) => s - 1 - (alvo % s);
  for (let s = S; s >= Math.max(1, Math.ceil(S / 2)); s--) if (ganho(s) > ganho(melhor)) melhor = s;
  if (exec.recuo === 0 && ganho(melhor) < Math.max(1, Math.floor(S / 4))) {
    exec.ancora = false; // âncora sairia cara: página seguinte inteira, sem conferência
    return { pagina: Math.floor(n / S) + 1, tamanho: S };
  }
  exec.ancora = true;
  return { pagina: Math.floor(alvo / melhor) + 1, tamanho: melhor };
}

function absorver(estado, ids, dataDe) {
  // ids em ordem decrescente; acrescenta à faixa 0 os que estão abaixo dela, emendando faixas.
  let novos = 0;
  for (const id of ids) {
    const f0 = estado.faixas[0];
    if (id >= f0.lo) continue;
    const f1 = estado.faixas[1];
    if (f1 && id <= f1.hi) {
      f0.lo = f1.lo; f0.n += f1.n; f0.lo_data = f1.lo_data;
      estado.faixas.splice(1, 1);
      if (id >= f0.lo) continue;
    }
    f0.lo = id; f0.n++; f0.lo_data = dataDe(id); novos++;
  }
  return novos;
}

/**
 * Aplica uma página lida. registros: resultados da API (ordem o=-id). temProxima: a API indicou próxima página.
 * dataDe(id) → data validada (AAAA-MM-DD) do registro, ou null. desde: data mínima da cobertura.
 * Devolve { novos } (quantos ids entraram no cursor).
 */
export function aplicarPagina(estado, exec, pagina, registros, { temProxima, dataDe = () => null, desde = null, tamanho, tamanhoPedido = null }) {
  const ids = registros.map((r) => r.id).filter(Number.isFinite).sort((a, b) => b - a);
  exec.paginas++;
  if (tamanho && !estado.tamanho_pagina) estado.tamanho_pagina = tamanho;
  const ps = tamanhoPedido || estado.tamanho_pagina || tamanho || ids.length || 1;
  let novos = 0;

  if (!estado.faixas.length) {
    if (!ids.length) { estado.concluido = !temProxima; exec.fase = 'retro'; return { novos }; }
    estado.faixas.push({ hi: ids[0], lo: ids[0], n: 1, lo_data: dataDe(ids[0]) });
    novos = 1 + absorver(estado, ids.slice(1), dataDe);
    exec.fase = 'retro';
    if (!temProxima) estado.concluido = true;
  } else if (exec.fase === 'topo') {
    const topo = estado.faixas[0];
    const acima = ids.filter((id) => id > topo.hi);
    if (acima.length) {
      if (!exec.nova) exec.nova = { hi: acima[0], lo: acima[0], n: 0, lo_data: null };
      for (const id of acima) if (id <= exec.nova.lo || exec.nova.n === 0) { exec.nova.lo = id; exec.nova.lo_data = dataDe(id); exec.nova.n++; }
      novos += acima.length;
    }
    const encontrou = ids.some((id) => id <= topo.hi);
    if (encontrou || !temProxima) {
      if (exec.nova) { topo.hi = exec.nova.hi; topo.n += exec.nova.n; exec.nova = null; }
      exec.fase = 'retro';
      novos += absorver(estado, ids.filter((id) => id < topo.lo), dataDe);
    } else {
      exec.pagina++;
    }
  } else {
    // Retroação: página que contém a posição n (e, se não for início de página, a posição n-1 = lo).
    const f0 = estado.faixas[0];
    const inicio = (pagina - 1) * ps;
    const posLo = f0.n - 1 - inicio;
    if (posLo >= 0 && posLo < ids.length && ids[posLo] !== f0.lo) {
      const idx = ids.indexOf(f0.lo);
      if (idx >= 0) {
        f0.n = inicio + idx + 1; // registros apagados acima: corrige a posição
      } else if (ids.length && ids[0] < f0.lo) {
        exec.recuo++; // a lista andou para cima (registros apagados): recua antes de absorver
        return { novos: 0, deriva: true };
      }
    } else if (exec.ancora && posLo < 0 && ids.length && ids[0] < f0.lo && pagina > 1) {
      exec.recuo++; // âncora fora da página: não absorve sem conferir
      return { novos: 0, deriva: true };
    }
    exec.recuo = 0;
    novos = absorver(estado, ids, dataDe);
    if (!temProxima && estado.faixas.length === 1) estado.concluido = true;
  }
  if (desde && exec.fase === 'retro' && registros.length) {
    const datas = ids.map(dataDe);
    if (datas.every((d) => d && d < desde) && estado.faixas.length === 1) estado.concluido = true;
  }
  return { novos };
}

/** Fim da execução: se a fase topo não terminou, a faixa nova vira a primeira (será emendada depois). */
export function encerrarExecucao(estado, exec) {
  if (exec.nova) { estado.faixas.unshift(exec.nova); exec.nova = null; }
}

/** Ids nas bordas das faixas (registros cujo grupo pode continuar fora do que já foi lido). */
export function bordas(estado) {
  const s = new Set();
  estado.faixas.forEach((f, i) => {
    if (i > 0) s.add(f.hi);
    if (!(estado.concluido && i === estado.faixas.length - 1)) s.add(f.lo);
  });
  return s;
}

/** O id está dentro de alguma faixa já lida? */
export function coberto(estado, id) {
  return estado.faixas.some((f) => id >= f.lo && id <= f.hi);
}

/** Data mais antiga até onde o fluxo está contíguo a partir do mais recente (null = nada lido). */
export function coberturaDesde(estado) {
  if (!estado.faixas.length) return null;
  if (estado.concluido && estado.faixas.length === 1) return '0000-00-00';
  return estado.faixas[0].lo_data;
}
