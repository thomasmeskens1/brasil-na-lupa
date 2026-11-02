// Amostra estratificada de 60 títulos para a revisão de viés pelos três analistas (esquerda, centro,
// direita). Cotas fixas por seção; dentro de cada seção, rodízio entre estratos (origem do título,
// resultado da votação, partido do autor quando a fonte informa), com sorteio determinístico pelo id.
import crypto from 'node:crypto';
import path from 'node:path';
import { DADOS, lerJson } from './lib.mjs';

const COTAS = { camara: 9, senado: 7, alesp: 8, executivo: 10, stj: 5, stf: 5, 'governo-sp': 4, atibaia: 4, icms: 4, 'tribunais-contas': 4 };
const hash = (s) => crypto.createHash('sha1').update(String(s)).digest('hex');

let autoresAlesp = null;
function autorAlesp(idProposicao) {
  if (!autoresAlesp) {
    autoresAlesp = new Map();
    for (const a of [2025, 2026]) {
      for (const p of lerJson(path.join(DADOS, `alesp/proposicoes/indice-${a}.json`))?.itens || []) {
        autoresAlesp.set(String(p.id), { autor: p.autor?.nome || null, partido: p.autor?.partido || null });
      }
    }
  }
  return autoresAlesp.get(String(idProposicao)) || null;
}

function textoOficial(it) {
  if (it.tipo === 'votacao') return it.raw.proposicao?.ementa || it.oficial.titulo;
  if (it.tipo === 'tese') return it.raw.tese || it.raw.questao || it.raw.texto || it.raw.titulo || it.oficial.titulo;
  return it.oficial.titulo;
}

export function escolherAmostra(todos) {
  const porSecao = new Map();
  for (const x of todos) {
    if (!porSecao.has(x.it.secao)) porSecao.set(x.it.secao, []);
    porSecao.get(x.it.secao).push(x);
  }
  const itens = [];
  for (const [secao, cota] of Object.entries(COTAS)) {
    const lista = (porSecao.get(secao) || []).filter((x) => x.reg.origem !== 'oficial'); // o oficial não precisa de revisão
    const estratos = new Map();
    for (const x of lista) {
      const aut = x.it.secao === 'alesp' ? autorAlesp(x.it.raw.proposicao?.id) : null;
      x.autoria = aut;
      const verbo = x.it.tipo === 'votacao' ? (x.reg.titulo.match(/\b(aprova|rejeita|mantém|retira|adia|muda|encerra|vota)\b/) || [])[1] : x.it.tipo;
      const chave = [x.reg.origem, verbo, aut?.partido || ''].join('|');
      if (!estratos.has(chave)) estratos.set(chave, []);
      estratos.get(chave).push(x);
    }
    const filas = [...estratos.keys()].sort().map((k) => estratos.get(k).sort((a, b) => hash(a.it.id).localeCompare(hash(b.it.id))));
    let escolhidos = 0;
    for (let rodada = 0; escolhidos < cota && filas.some((f) => f.length > rodada); rodada++) {
      for (const f of filas) {
        if (escolhidos >= cota) break;
        const x = f[rodada];
        if (!x) continue;
        itens.push({
          secao, id: x.it.id, titulo: x.reg.titulo, subtitulo: x.reg.subtitulo, origem: x.reg.origem, fonte: x.reg.fonte,
          ...(x.reg.credito ? { credito: x.reg.credito } : {}),
          tema: x.reg.tema, texto_oficial: textoOficial(x.it),
          autoria_na_fonte: x.autoria ? { autor: x.autoria.autor, partido: x.autoria.partido } : null,
          revisao: { esquerda: null, centro: null, direita: null },
        });
        escolhidos++;
      }
    }
  }
  const partidos = {};
  for (const i of itens) if (i.autoria_na_fonte?.partido) partidos[i.autoria_na_fonte.partido] = (partidos[i.autoria_na_fonte.partido] || 0) + 1;
  const origens = {};
  for (const i of itens) origens[i.origem] = (origens[i.origem] || 0) + 1;
  return {
    descricao: 'Amostra estratificada de títulos simples para revisão de viés. Cada analista (esquerda, centro, direita) compara o título com o texto oficial e só pode vetar, com motivo; não reescreve. Um único veto fundamentado devolve o item ao título oficial (campo verificacao.veto_vies na seção correspondente).',
    criterio: 'Cotas por seção (Câmara 9, Senado 7, ALESP 8, Executivo 10, STJ 5, STF 5, Governo de SP 4, Atibaia 4, ICMS 4, Tribunais de Contas 4); dentro da seção, rodízio entre estratos de origem do título, resultado da votação e partido do autor (quando a fonte informa), com sorteio determinístico pelo identificador. Títulos de origem "oficial" ficam fora porque são o texto do órgão sem alteração.',
    instrucoes_revisao: 'Preencher revisao.<vies> com { "veto": true|false, "motivo": "…", "data": "AAAA-MM-DD" }. Vetar quando o título: (1) diz algo que o texto oficial não diz; (2) omite ressalva que muda o sentido; (3) usa palavra que favorece ou desfavorece partido, governo ou grupo; (4) trataria de forma diferente o mesmo tipo de decisão de outro partido ou governo.',
    distribuicao: { total: itens.length, por_origem: origens, partidos_dos_autores_alesp: partidos },
    itens,
  };
}
