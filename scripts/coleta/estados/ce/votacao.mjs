// Ceará — leitura do "Relatório de Votação" (PDF) da ALECE a partir das palavras e bordas da tabela
// (extrair_pdf.py palavras). Puro e testado offline (testes.mjs).
//
// REGRA: a votação só é publicada quando TUDO confere: colunas da tabela localizadas pelas bordas do PDF e pelo
// cabeçalho, linhas numeradas 1..N sem repetição, cada palavra da área da tabela atribuída a uma linha, o voto
// escrito na célula igual ao título da coluna onde está, e as quantidades de cada coluna iguais às da linha
// "APURAÇÃO" do próprio PDF. Qualquer divergência devolve { erro } e a votação vai para a lista de revisão humana.
import { limpar, chaveNome, dataISO, fonte, textoPublico, LACUNA_PRIVACIDADE } from '../abertos/base.mjs';
import { CASA_CE } from './alece.mjs';

const VOTOS = { SIM: 'Sim', NAO: 'Não', ABSTENCAO: 'Abstenção', BRANCO: 'Em Branco' };
export const SEM_VOTO = 'Sem voto registrado';
const TOL_LINHA = 2.5;
const TOL_ROW = 7;

/** Agrupa palavras em linhas (por topo) e as ordena da esquerda para a direita. */
export function linhasDe(palavras) {
  const linhas = [];
  for (const w of [...palavras].sort((a, b) => a[2] - b[2] || a[0] - b[0])) {
    const l = linhas.find((x) => Math.abs(x.topo - w[2]) <= TOL_LINHA);
    if (l) l.p.push(w); else linhas.push({ topo: w[2], p: [w] });
  }
  for (const l of linhas) { l.p.sort((a, b) => a[0] - b[0]); l.texto = l.p.map((w) => w[3]).join(' '); }
  return linhas;
}

/** Bordas verticais → limites de coluna (junta bordas a menos de 3 pt; descarta as margens da página). */
export function limitesColunas(bordas, largura) {
  const xs = [...new Set(bordas)].filter((x) => x > 5 && x < largura - 5).sort((a, b) => a - b);
  const out = [];
  for (const x of xs) if (!out.length || x - out[out.length - 1] > 3) out.push(x);
  return out;
}
const centro = (w) => (w[0] + w[1]) / 2;
const colunaDe = (lim, x) => { for (let i = 0; i < lim.length - 1; i++) if (x >= lim[i] && x < lim[i + 1]) return i; return -1; };

/** Cabeçalho do relatório (texto corrido das linhas acima da tabela). */
export function cabecalhoCE(linhas) {
  const txt = linhas.map((l) => l.texto).join('\n');
  const data = /Data:\s*([\d\s/]{8,14})/.exec(txt)?.[1]?.replace(/\s+/g, '') ?? null;
  const hora = /Hor[áa]rio:\s*(\d{1,2}:\d{2})/.exec(txt)?.[1] ?? null;
  const processo = limpar(/Processo de vota[çc][ãa]o:\s*(.*?)(?:\s+Resultado:|\n|$)/.exec(txt)?.[1]);
  let resultado = limpar(/Resultado:[ \t]*([^\n]*)/.exec(txt)?.[1]);
  if (!resultado) resultado = limpar(/Resultado:[ \t]*\n([A-ZÀ-Ý ]{4,40})\n/.exec(txt)?.[1]);
  const presidente = limpar(/Presidente da Sess[ãa]o:\s*(.*?)\s+Data:/.exec(txt)?.[1]);
  const i = linhas.findIndex((l) => /^MAT[ÉE]RIAS?\b/i.test(l.texto));
  const f = linhas.findIndex((l, k) => k > i && /^VOTA[ÇC][ÃA]O$/i.test(l.texto.trim()));
  const materia = i >= 0 && f > i ? limpar(linhas.slice(i, f).map((l) => l.texto).join(' ').replace(/^MAT[ÉE]RIAS?\s*[-–]\s*/i, '')) : null;
  return { data, hora, processo, resultado, presidente, materia, bloco: /^MAT[ÉE]RIAS\b/i.test(linhas[i]?.texto || '') || /BLOCO/i.test(processo || '') };
}

/**
 * Páginas de palavras do relatório → { cabecalho, votos, apuracao } ou { erro }.
 * votos: [{ numero, nome, partido, voto, modalidade }] na ordem do PDF.
 */
export function lerRelatorioCE(paginas) {
  if (!Array.isArray(paginas) || !paginas.some((p) => p.palavras?.length)) return { erro: 'PDF sem camada de texto (não é feito reconhecimento de imagem)', sem_texto: true };
  const p0 = paginas[0];
  const l0 = linhasDe(p0.palavras);
  const iVot = l0.findIndex((l) => l.p.some((w) => chaveNome(w[3]) === 'SIM') && l.p.some((w) => chaveNome(w[3]) === 'NAO'));
  // Em alguns relatórios de 2023 o título "Nº" não é impresso; a coluna continua definida pelas bordas da tabela.
  const iTit = l0.findIndex((l) => /^(N[ºo°]\s+)?DEPUTADOS\s+PARTIDOS$/i.test(l.texto.trim()));
  if (iVot < 0 || iTit < 0 || iTit > iVot) return { erro: 'cabeçalho da tabela (Nº, Deputados, Partidos, Sim, Não…) não encontrado' };
  const cab = cabecalhoCE(l0.slice(0, iTit));
  const titulos = [...l0[iTit].p, ...l0[iVot].p];
  const nomesCol = ['N', 'DEPUTADOS', 'PARTIDOS', ...l0[iVot].p.map((w) => chaveNome(w[3]))];
  if (nomesCol.slice(3).some((n) => !VOTOS[n])) return { erro: `colunas de voto inesperadas (${nomesCol.slice(3).join(', ')})` };
  let lim = null;
  for (const p of paginas) {
    if (!p.palavras?.length) continue;
    const l = limitesColunas(p.bordas_v || [], p.largura);
    if (l.length !== nomesCol.length + 1) return { erro: `bordas da tabela: ${l.length} limites para ${nomesCol.length} colunas` };
    if (lim && l.some((x, k) => Math.abs(x - lim[k]) > 3)) return { erro: 'colunas da tabela mudam de posição entre as páginas' };
    lim = lim ?? l;
  }
  const esperado = ['N', 'DEPUTADOS', 'PARTIDOS'];
  for (const w of titulos) {
    const c = colunaDe(lim, centro(w));
    const k = chaveNome(w[3]).replace(/[º°]/g, 'O').replace(/^NO$/, 'N');
    const alvo = esperado.includes(k) ? esperado.indexOf(k) : nomesCol.indexOf(k);
    if (alvo < 0 || c !== alvo) return { erro: `título "${w[3]}" fora da coluna esperada` };
  }
  const linhasVoto = [];
  let apuracao = null;
  for (let pg = 0; pg < paginas.length; pg++) {
    const ws = paginas[pg].palavras || [];
    if (!ws.length) continue;
    const ls = linhasDe(ws);
    const ini = pg === 0 ? l0[iVot].topo + TOL_LINHA : -Infinity;
    const iAp = ls.findIndex((l) => l.topo > ini && /^APURA[ÇC][ÃA]O:/i.test(l.texto));
    const fim = iAp >= 0 ? ls[iAp].topo - TOL_LINHA : Infinity;
    if (iAp >= 0) {
      if (apuracao) return { erro: 'mais de uma linha de apuração' };
      const nums = ls[iAp].p.filter((w) => /^\d+$/.test(w[3]));
      apuracao = {};
      for (const w of nums) {
        const c = colunaDe(lim, centro(w));
        if (c < 3 || apuracao[nomesCol[c]] != null) return { erro: 'apuração fora das colunas de voto' };
        apuracao[nomesCol[c]] = Number(w[3]);
      }
      if (Object.keys(apuracao).length !== nomesCol.length - 3) return { erro: 'apuração não traz um total para cada coluna de voto' };
    }
    const area = ws.filter((w) => w[2] > ini && w[2] < fim);
    const ancoras = area.filter((w) => colunaDe(lim, centro(w)) === 0 && /^\d{1,3}$/.test(w[3])).sort((a, b) => a[2] - b[2]);
    if (pg > 0 && apuracao === null && !ancoras.length) continue;
    const linhasPg = ancoras.map((a) => ({ numero: Number(a[3]), topo: a[2], cel: nomesCol.map(() => []) }));
    for (const w of area) {
      if (ancoras.includes(w)) continue;
      const c = colunaDe(lim, centro(w));
      let melhor = null;
      for (const r of linhasPg) { const d = Math.abs(w[2] - r.topo); if (d <= TOL_ROW && (!melhor || d < melhor.d)) melhor = { r, d }; }
      if (!melhor) {
        if (pg > 0 && ancoras.length && w[2] < ancoras[0][2] - TOL_ROW && /^(N[ºo°]|DEPUTADOS|PARTIDOS|SIM|N[ÃA]O|ABSTEN[ÇC][ÃA]O|BRANCO|VOTA[ÇC][ÃA]O)$/i.test(w[3])) continue;
        return { erro: `palavra "${w[3]}" (página ${pg + 1}) sem linha de deputado correspondente` };
      }
      if (c < 1) return { erro: `palavra "${w[3]}" fora das colunas da tabela` };
      melhor.r.cel[c].push(w);
    }
    linhasVoto.push(...linhasPg);
    if (iAp >= 0) break;
  }
  if (!apuracao) return { erro: 'linha de apuração não encontrada' };
  const votos = [];
  const cont = Object.fromEntries(nomesCol.slice(3).map((n) => [n, 0]));
  for (const [k, r] of linhasVoto.entries()) {
    if (r.numero !== k + 1) return { erro: `numeração das linhas não é sequencial (esperado ${k + 1}, encontrado ${r.numero})` };
    const txt = (c) => limpar(r.cel[c].sort((a, b) => a[2] - b[2] || a[0] - b[0]).map((w) => w[3]).join(' '));
    const nome = txt(1), partido = txt(2);
    if (!nome) return { erro: `linha ${r.numero} sem nome de deputado` };
    const marcadas = nomesCol.map((n, c) => (c >= 3 && r.cel[c].length ? c : -1)).filter((c) => c >= 0);
    if (marcadas.length > 1) return { erro: `linha ${r.numero} (${nome}) com voto em mais de uma coluna` };
    let voto = SEM_VOTO, modalidade = null, textoVoto = null;
    if (marcadas.length) {
      const c = marcadas[0];
      textoVoto = txt(c);
      const m = /^(SIM|N[ÃA]O|ABSTEN[ÇC][ÃA]O|BRANCO)(?:\s*\(([PV])\))?$/i.exec(textoVoto || '');
      if (!m || chaveNome(m[1]) !== nomesCol[c]) return { erro: `linha ${r.numero} (${nome}): "${textoVoto}" na coluna ${nomesCol[c]}` };
      voto = VOTOS[nomesCol[c]];
      modalidade = m[2] ? (m[2].toUpperCase() === 'P' ? 'presencial' : 'virtual') : null;
      cont[nomesCol[c]]++;
    }
    votos.push({ numero: r.numero, nome, partido, voto, voto_texto_oficial: textoVoto, modalidade });
  }
  for (const n of Object.keys(cont)) if (cont[n] !== apuracao[n]) return { erro: `coluna ${n}: ${cont[n]} votos lidos, mas a apuração do PDF informa ${apuracao[n]}` };
  if (new Set(votos.map((v) => chaveNome(v.nome))).size !== votos.length) return { erro: 'deputado repetido na lista' };
  return { cabecalho: cab, votos, apuracao, colunas: nomesCol.slice(3) };
}

const TIPOS_MATERIA = [
  [/^Projeto de Lei Complementar|^PL\s+Complementar|^PLC\b/i, 'projeto_compl'],
  [/^PEC\b|^Proposta de Emenda/i, 'projeto_emen'],
  [/^PDL\b|^Projeto de Decreto Legislativo/i, 'projeto_decre'],
  [/^(Projeto de Lei|PL)\s+oriundo|^Oriundo da Mensagem|^Autoria do Poder Executivo\s*[-–]\s*Projeto de Lei oriundo/i, 'projeto_mens'],
  [/^(Projeto de Lei|PL)\s+de Autoria d[oa]s?\s+Deputad/i, 'projeto_lei'],
];
/**
 * Texto da matéria → { tabela, numero, ano, mensagem } quando o próprio PDF identifica o tipo e o número
 * ("13/2026 - Projeto de Lei oriundo da Mensagem n.º 9.491 …"). Bloco de matérias e vetos não são ligados.
 */
export function identificarMateriaCE(materia) {
  const t = limpar(materia) || '';
  let m = /^(\d{1,4})\/(\d{4})\s*[-–]\s*(?:\d+º\s*TURNO\s*[-–]\s*)?(.+)$/i.exec(t);
  let numero, ano, resto;
  if (m) [numero, ano, resto] = [Number(m[1]), Number(m[2]), m[3]];
  else if ((m = /^Projeto de Resolu[çc][ãa]o n\.?\s*[º°]\s*(\d{1,4})\/(\d{4})/i.exec(t))) return { tabela: 'projeto_reso', numero: Number(m[1]), ano: Number(m[2]), mensagem: null };
  else return null;
  const def = TIPOS_MATERIA.find(([re]) => re.test(resto));
  if (!def) return null;
  const msg = /Mens(?:agem)?\.?\s*n\.?\s*[º°]\s*([\d.]+)/i.exec(resto)?.[1]?.replace(/\./g, '') ?? null;
  return { tabela: def[1], numero, ano, mensagem: msg };
}

/** Votação no contrato de dados/esquema.json (publicada só depois de lerRelatorioCE sem erro). */
export function montarVotacaoCE(ref, lido, { hoje, sha256, porNome = new Map(), projeto = null, sigla = null, tipo = null, ident = null }) {
  const c = lido.cabecalho;
  const data = dataISO(c.data, hoje);
  const placar = {};
  for (const n of lido.colunas) placar[n === 'SIM' ? 'sim' : n === 'NAO' ? 'nao' : n === 'ABSTENCAO' ? 'abstencao' : 'Em branco'] = lido.apuracao[n];
  const semVoto = lido.votos.filter((v) => v.voto === SEM_VOTO).length;
  if (semVoto) placar['Sem voto registrado'] = semVoto;
  placar.total = lido.votos.length;
  const votos = lido.votos.map((v) => ({
    parlamentar_id: porNome.get(chaveNome(v.nome)) ?? null, nome: v.nome, partido: v.partido, uf: 'CE', voto: v.voto,
    voto_texto_oficial: v.voto_texto_oficial, modalidade: v.modalidade,
  }));
  const lacunas = [
    'Orientação das bancadas: não publicada pela ALECE.',
    `"${SEM_VOTO}": o deputado aparece na lista do relatório sem marcação em nenhuma coluna; o relatório não informa o motivo (ausência, licença ou presidência da sessão).`,
  ];
  if (votos.some((v) => !v.parlamentar_id)) lacunas.push('Algum nome do relatório não tem grafia idêntica à da página de deputados; o voto aparece sem ligação com o perfil.');
  if (c.bloco) lacunas.push('Votação em bloco: o relatório traz várias matérias numa só votação; a votação não é ligada a um projeto.');
  const desc = textoPublico(c.materia ?? ref.materia);
  if (desc.pendente) lacunas.push(LACUNA_PRIVACIDADE);
  const res = limpar(c.resultado);
  return {
    id: ref.id, id_fonte: ref.chave, uf: 'CE', casa: CASA_CE.casa,
    data, hora: c.hora, orgao: 'Plenário', orgao_sigla: 'PLEN', orgao_nome: 'Plenário',
    sessao: { titulo: ref.sessao ? ref.sessao.replace(/SESSÃO/g, 'Sessão').replace(/ORDINÁRIA/g, 'Ordinária').replace(/EXTRAORDINÁRIA/g, 'Extraordinária').replace(/ESPECIAL/g, 'Especial') : null, legislatura: ref.legislatura },
    presidente_sessao: c.presidente,
    proposicao: ident ? { id: projeto?.id ?? null, sigla, tipo, numero: ident.numero, ano: ident.ano, ementa: projeto?.ementa ?? null, url: projeto?.url ?? null } : null,
    descricao: desc.texto, privacidade_pendente: desc.pendente || undefined,
    resultado: /^APROVAD/i.test(res || '') ? 'aprovada' : /^REJEITAD/i.test(res || '') ? 'rejeitada' : null,
    resultado_texto_oficial: res, tipo: 'nominal', tipo_texto_oficial: c.processo,
    placar, placar_origem: 'totais-oficiais',
    conferencia_placar: `As ${lido.votos.length} linhas do relatório foram lidas pela posição na tabela; as quantidades de cada coluna (${lido.colunas.map((n) => `${VOTOS[n]} ${lido.apuracao[n]}`).join(', ')}) conferem com a linha "Apuração" do próprio PDF.`,
    votos_situacao: 'publicados', votos,
    url: ref.url, url_pdf: ref.url, sha256,
    fonte: fonte('Relatório de Votação (PDF) — Portal da Transparência da ALECE', ref.url, CASA_CE.nome, hoje),
    lacunas,
  };
}
