// Composição do STF (páginas oficiais "Composição Atual" e "Turmas") e correspondência código → nome
// dos ministros no Plenário Virtual. O código só é atribuído a um ministro da composição quando o nome
// registrado no Plenário Virtual ("MIN. NOME") coincide com o nome da página oficial (sem acentos/maiúsculas).
import { htmlParaLinhas, entidades, chaveNome } from './lib.mjs';
import { URL_COMPOSICAO, URL_TURMAS, fonte } from './fontes.mjs';

const dataAtualizacao = (linhas) => {
  const i = linhas.findIndex((x) => /^Última atualização/.test(x));
  return i >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(linhas[i + 1]) ? linhas[i + 1] : null;
};

/** Página "Composição Atual": [{ tratamento, nome, funcao, url_oficial }] na ordem da página. */
export function lerPaginaComposicao(html) {
  const linhas = htmlParaLinhas(html);
  const atualizada = dataAtualizacao(linhas);
  const ini = linhas.findIndex((x) => /^Última atualização/.test(x));
  const fim = linhas.findIndex((x, i) => i > ini && /^Essa informação foi útil/.test(x));
  if (ini < 0 || fim < 0) throw new Error('Composição Atual: layout não reconhecido');
  const urls = new Map();
  for (const m of String(html).matchAll(/href="([^"]*pagina=\w+Principal[^"]*)"[^>]*>[\s\S]{0,300}?<img[^>]*title="Ministr[oa] ([^"]+)"/g)) {
    urls.set(chaveNome(entidades(m[2])), entidades(m[1]).trim());
  }
  const itens = [];
  const corpo = linhas.slice(ini + 2, fim);
  for (let i = 0; i < corpo.length; i++) {
    if (!/^Ministr[oa]$/.test(corpo[i])) continue;
    const nome = corpo[i + 1];
    if (!nome || /^Ministr[oa]$/.test(nome)) continue;
    const funcao = /^\(.+\)$/.test(corpo[i + 2] ?? '') ? corpo[i + 2].slice(1, -1) : null;
    itens.push({ tratamento: corpo[i], nome, funcao, url_oficial: urls.get(chaveNome(nome)) ?? null });
  }
  return { atualizada_em_fonte: atualizada, itens };
}

/** Página "Turmas": Map chaveNome → { turma, presidente_da_turma }. */
export function lerPaginaTurmas(html) {
  const linhas = htmlParaLinhas(html);
  const atualizada = dataAtualizacao(linhas);
  const mapa = new Map();
  let turma = null;
  for (const l of linhas) {
    if (/^(Primeira|Segunda) Turma$/.test(l)) { turma = l; continue; }
    if (/^Secretári[oa]|^Essa informação/.test(l)) turma = null;
    if (!turma) continue;
    const m = l.match(/^Ministr[oa] (.+?)(\s+-\s+Presidente)?$/);
    if (m) mapa.set(chaveNome(m[1]), { turma, presidente_da_turma: Boolean(m[2]), nome_na_pagina: m[1] });
  }
  return { atualizada_em_fonte: atualizada, mapa };
}

/**
 * Monta dados/stf/ministros.json.
 * codigosVistos: Map codigo → { descricao, visto_em: Set } (do Plenário Virtual nesta e em execuções anteriores).
 */
export function montarMinistros({ composicao, turmas, codigosVistos, hoje }) {
  const lacunas = [];
  const porChave = new Map();
  for (const [codigo, info] of codigosVistos) {
    const k = chaveNome(info.descricao);
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(codigo);
  }
  const itens = composicao.itens.map((m) => {
    const cods = porChave.get(chaveNome(m.nome)) ?? [];
    const t = turmas.mapa.get(chaveNome(m.nome));
    if (cods.length > 1) lacunas.push(`Mais de um código do Plenário Virtual com o nome ${m.nome} (${cods.join(', ')}); código não atribuído`);
    if (!cods.length) lacunas.push(`Código do Plenário Virtual de ${m.nome} ainda não observado nas listas coletadas`);
    if (!t) lacunas.push(`Turma de ${m.nome} não consta da página oficial das Turmas`);
    return {
      tribunal: 'stf',
      id: cods.length === 1 ? cods[0] : null,
      nome: m.nome,
      cargo: m.funcao ? `${m.tratamento} (${m.funcao})` : m.tratamento,
      funcao: m.funcao,
      orgao: t ? t.turma : null,
      presidente_da_turma: t ? t.presidente_da_turma : null,
      em_exercicio: true,
      url_oficial: m.url_oficial,
      nome_no_plenario_virtual: cods.length === 1 ? codigosVistos.get(cods[0]).descricao : null,
      fonte: fonte('Composição Atual', URL_COMPOSICAO, hoje),
    };
  });
  if (itens.length < 11) {
    lacunas.push(`A página oficial "Composição Atual" lista ${itens.length} ministros; a ${itens.length + 1}ª cadeira (de 11) não consta da página: Informação não disponível em fonte oficial`);
  }
  const naComposicao = new Set(itens.filter((x) => x.id).map((x) => x.id));
  const codigos = [...codigosVistos].sort((a, b) => Number(a[0]) - Number(b[0])).map(([codigo, info]) => {
    const atual = itens.find((x) => x.id === codigo);
    return {
      codigo,
      nome_no_plenario_virtual: info.descricao,
      na_composicao_atual: naComposicao.has(codigo),
      nome_na_composicao_atual: atual ? atual.nome : null,
      visto_em: [...info.visto_em].sort().slice(0, 5),
    };
  });
  return {
    atualizado_em: hoje,
    tribunal: 'stf',
    fonte: fonte('Composição Atual', URL_COMPOSICAO, hoje),
    fonte_turmas: fonte('Turmas', URL_TURMAS, hoje),
    pagina_composicao_atualizada_em: composicao.atualizada_em_fonte,
    pagina_turmas_atualizada_em: turmas.atualizada_em_fonte,
    total_na_pagina: itens.length,
    itens,
    codigos_plenario_virtual: codigos,
    _regra_codigos: 'O código é o identificador do ministro no Plenário Virtual (sistemas.stf.jus.br). Só é ligado a um ministro da composição quando o nome registrado no Plenário Virtual coincide com o nome da página oficial; códigos de ministros que não estão na composição atual ficam só em codigos_plenario_virtual.',
    lacunas,
  };
}

/** Índice para conferência dos votos: chaveNome → item de ministros.json; codigo → item. */
export function indiceMinistros(ministros) {
  const porCodigo = new Map(), porNome = new Map();
  for (const c of ministros?.codigos_plenario_virtual ?? []) porCodigo.set(c.codigo, { codigo: c.codigo, nome: c.nome_na_composicao_atual ?? null, descricao: c.nome_no_plenario_virtual });
  for (const m of ministros?.itens ?? []) {
    porNome.set(chaveNome(m.nome), m);
    if (m.nome_no_plenario_virtual) porNome.set(chaveNome(m.nome_no_plenario_virtual), m);
  }
  for (const c of ministros?.codigos_plenario_virtual ?? []) if (!porNome.has(chaveNome(c.nome_no_plenario_virtual))) porNome.set(chaveNome(c.nome_no_plenario_virtual), { id: c.codigo, nome: null, nome_no_plenario_virtual: c.nome_no_plenario_virtual });
  return { porCodigo, porNome };
}
