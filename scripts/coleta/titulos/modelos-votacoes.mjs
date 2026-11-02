// Modelos de título para votações (Câmara, Senado, ALESP).
// Estrutura fixa, igual para qualquer partido ou governo:
//   [quem decidiu] [verbo da lista fechada] [etapa] [o que foi votado] [trecho literal da ementa] [(N Sim, M Não) só se nominal]
import { limpar, nomeCurto, nomeOficial, art, trechoDaEmenta, trechoIndicacao, NOME_EXTENSO } from './texto.mjs';
import { LIMITE_DURO } from './regras.mjs';
import { dataBR } from './lib.mjs';

const norm = (s) => limpar(s).toLocaleLowerCase('pt-BR');

export function quemDecidiu(v) {
  const plen = (v.orgao_sigla || '').toUpperCase() === 'PLEN' || /^plen[áa]rio/i.test(v.orgao || '');
  if (v.casa === 'camara') return plen ? 'Câmara' : 'Comissão da Câmara';
  if (v.casa === 'senado') return 'Senado';
  if (v.casa === 'alesp') return plen ? 'Assembleia de SP' : 'Comissão da Assembleia de SP';
  return null;
}

/** Classifica o que foi votado, a partir da descrição oficial do resultado. */
export function tipoDaVotacao(v) {
  let d = norm(v.descricao).replace(/^\(|\)\.?$/g, '');
  const abertura = norm(`${v.descricao_abertura || ''} ${v.materia_votada || ''}`);
  const sigla = v.proposicao?.sigla;
  if (v.casa === 'senado') {
    d = d.replace(/^vota[çc][ãa]o nominal (em [12]º turno )?(d[oa]s?|em) /, '');
    if (['MSF', 'OFS'].includes(sigla) || /^escolhe\b/i.test(v.proposicao?.ementa || '')) return { tipo: 'autoridade' };
  }
  const r = { textoPrincipal: /ressalvad|\bsalvo\b/.test(d), turno: null };
  if (/(primeiro|1º) turno/.test(d) || (/(primeiro|1º) turno/.test(abertura) && /proposta de emenda|^aprovad[ao], em/.test(d))) r.turno = '1º';
  if (/(segundo|2º) turno/.test(d) || (/(segundo|2º) turno/.test(abertura) && /proposta de emenda|^aprovad[ao], em/.test(d))) r.turno = '2º';
  const head = d.replace(/^(aprovad|rejeitad|mantid|suprimid)[ao]s?\b,?( em (primeiro|segundo) turno,?| por unanimidade,?| em aprecia[çc][ãa]o preliminar,?)?\s*((o|a|os|as)\s+)?/, '');
  const T = (tipo, extra = {}) => ({ ...r, tipo, ...extra });
  // "Requerimento de Votação Nominal do Requerimento de Adiamento": o objeto é o pedido de votação nominal
  if (/^requerimento de vota[çc][ãa]o (nominal|por partes|em globo|global)|^req\. m[ée]todo/.test(head)) return T('requerimento');
  if (/^altera[çc][ãa]o do regime/.test(d)) return T('regime');
  if (/^parecer/.test(head) && /pressupostos/.test(d)) return T('parecer'); // "relevância e urgência" da MP não é pedido de urgência
  if (/(requerimento de|solicita|requer|pedido de|regime de) urg[êe]ncia|urg[êe]ncia \(art|^req\. urg[êe]ncia/.test(d)) return T('urgencia');
  if (/retirada de pauta/.test(d)) return T('retirada');
  if (/adiamento/.test(d)) return T('adiamento', { discussao: /discuss/.test(d) });
  if (/encerramento d[ae] discuss/.test(d)) return T('encerramento');
  if (/reda[çc][ãa]o final/.test(d)) return T('redacao');
  if (/prefer[êe]ncia/.test(d)) return T('preferencia');
  if (/mantido o texto/.test(d)) return T('mantido');
  if (/suprimido o texto/.test(d)) return T('suprimido');
  if (/^aprovada a cota/.test(d)) return T('cota', { palavra: /juntada/.test(d) ? 'juntada' : /anexa/.test(d) ? 'anexação' : null });
  if (/^rejeitado o voto do relator/.test(d)) return T('voto-relator');
  if (/conclusivamente/.test(d)) return T('conclusivo', { substitutivo: /conclusivamente o substitutivo/.test(d) });
  if (/^aprovado como parecer/.test(d)) return T('parecer', { sentido: /contr[áa]rio\s*$/.test(d) ? 'contrário' : /favor[áa]vel\s*$/.test(d) ? 'favorável' : null });
  if (/^(aprovado|rejeitado) o parecer/.test(d) || /^parecer/.test(head)) return T('parecer');
  if (/^(subemenda substitutiva|substitutivo|emenda n[ºo°]?\s?[\d.]+\s?\(substitutivo\))/.test(head)) {
    return T('texto', { doSenado: /^substitutivo do senado/.test(head) });
  }
  if (/^(projeto|proposta|medida provis[óo]ria|plv|pdl|pec|pl|plp|plc|pr)\b/.test(head) && !/^(pl|plc|pdl) \d+\/\d+ (emenda|mensagem)/.test(head)) {
    return T('principal');
  }
  if (/^(emendas?|subemendas?|submenda|mensagem aditiva)\b/.test(head) || /^(pl|plc|pdl) [\d.]+ ?\/\d+ (emendas?|mensagem aditiva|subemenda)/.test(d)) {
    return T('emenda', { plural: /^(emendas|subemendas)\b|emendas englobadamente/.test(head) || /emendas/.test(d.slice(0, 40)), doSenado: /do senado/.test(head.slice(0, 60)), aditiva: /mensagem aditiva/.test(d) });
  }
  if (/^(parte|mat[ée]ria destacada|art\.|artigo|dispositivos|inclus[ãa]o|express[ãa]o)(?![\p{L}])/u.test(head)) return T('trecho');
  if (/^(req\.|requerimento)/.test(d) || /^requerimento/.test(head) || /calend[áa]rio especial|quebra de interst/.test(d)) return T('requerimento');
  if (/^recurso/.test(head)) return T('recurso');
  if (/^(aprovad|rejeitad)[ao]s?\.?$/.test(d)) {
    if (/emenda/.test(abertura)) return T('emenda', { plural: /emendas/.test(abertura), doSenado: /do senado/.test(abertura) });
    if (/express[ãa]o|dispositivo|art\./.test(abertura)) return T('trecho');
  }
  return { tipo: 'outro' };
}

/** A descrição cita outra proposição (apensada, PEC principal etc.)? Então a ementa não é a do que se votou. */
export function proposicaoDivergente(v) {
  const p = v.proposicao || {};
  if (!p.numero || !p.ano) return true;
  if (['RQS', 'REQ'].includes(p.sigla)) return false; // o requerimento cita a proposição a que se refere
  const d = limpar(v.descricao);
  const citadas = [];
  for (const m of d.matchAll(/(Projeto de Lei(?: Complementar)?|Proposta de Emenda à Constituição|Projeto de Resolução|Projeto de Decreto Legislativo|Medida Provisória)\s+n[º°.o]*\s*([\d.]+),?\s+de\s+(\d{4})/giu)) {
    citadas.push([Number(m[2].replace(/\./g, '')), Number(m[3])]);
  }
  for (const m of d.matchAll(/\b(PL|PLP|PEC|PDL|MPV|PLC|PR|PRC)\.?\s*n?º?\s*([\d.]+)\s*\/\s*(\d{2,4})\b/giu)) {
    let ano = Number(m[3]); if (ano < 100) ano += 2000;
    citadas.push([Number(m[2].replace(/\./g, '')), ano]);
  }
  return citadas.some(([n, a]) => !(n === Number(p.numero) && a === Number(p.ano)));
}

export function verboDoResultado(v, k) {
  if (k.tipo === 'mantido') return 'mantém';
  if (k.tipo === 'suprimido') return 'retira';
  if (k.tipo === 'voto-relator') return 'rejeita';
  const daDescricao = /^\(?aprovad/i.test(v.descricao || '') ? 'aprovada' : /^\(?rejeitad/i.test(v.descricao || '') ? 'rejeitada' : null;
  if (v.resultado && daDescricao && v.resultado !== daDescricao) return null; // resultado e descrição oficiais divergem
  const res = v.resultado || daDescricao;
  if (res === 'aprovada') {
    if (k.tipo === 'regime') return 'muda';
    if (k.tipo === 'retirada') return 'retira';
    if (k.tipo === 'adiamento') return 'adia';
    if (k.tipo === 'encerramento') return 'encerra';
    return 'aprova';
  }
  if (res === 'rejeitada') return k.tipo === 'regime' ? null : 'rejeita';
  return v.casa === 'alesp' && v.placar ? 'vota' : null;
}

/** Frase do objeto votado. prop = "projeto que institui…" (ou só "projeto" quando o assunto vem do apelido). */
function objeto(k, verbo, P, prop) {
  const de = art.de[P.g], a = art.a[P.g], o = art.o[P.g];
  switch (k.tipo) {
    case 'principal': return k.textoPrincipal ? `texto principal ${de} ${prop}` : prop;
    case 'texto':
      if (k.textoPrincipal) return `texto principal ${de} ${prop}`;
      return `substitutivo${k.doSenado ? ' do Senado' : ''} ${a} ${prop}`;
    case 'urgencia': return `urgência para ${o} ${prop}`;
    case 'regime': return `regime de tramitação ${de} ${prop}`;
    case 'retirada': return verbo === 'retira' ? `de pauta ${o} ${prop}` : `retirada de pauta ${de} ${prop}`;
    case 'adiamento': {
      const alvo = k.discussao ? 'discussão' : 'votação';
      return verbo === 'adia' ? `a ${alvo} ${de} ${prop}` : `adiamento da ${alvo} ${de} ${prop}`;
    }
    case 'encerramento': return verbo === 'encerra' ? `a discussão ${de} ${prop}` : `encerramento da discussão ${de} ${prop}`;
    case 'redacao': return `redação final ${de} ${prop}`;
    case 'preferencia': return `preferência na votação ${de} ${prop}`;
    case 'mantido': case 'suprimido': case 'trecho': return `trecho ${de} ${prop}`;
    case 'emenda': {
      if (k.aditiva) return `mensagem aditiva ${a} ${prop}`;
      return `${k.plural ? 'emendas' : 'emenda'}${k.doSenado ? ' do Senado' : ''} ${a} ${prop}`;
    }
    case 'parecer': return k.sentido ? `parecer ${k.sentido} ${a} ${prop}` : `parecer sobre ${o} ${prop}`;
    case 'conclusivo': return k.substitutivo ? `em caráter conclusivo substitutivo ${a} ${prop}` : `em caráter conclusivo ${o} ${prop}`;
    case 'voto-relator': return `parecer do relator sobre ${o} ${prop}`;
    case 'cota': return k.palavra ? `pedido de ${k.palavra} ${de} ${prop}` : null;
    case 'requerimento': return `requerimento sobre ${o} ${prop}`;
    case 'recurso': return `recurso sobre ${o} ${prop}`;
    default: return null;
  }
}

export function sufixoPlacar(v) {
  if (v.tipo !== 'nominal' || !v.placar) return '';
  const { sim, nao } = v.placar;
  if (!Number.isFinite(sim) || !Number.isFinite(nao)) return '';
  return ` (${sim} Sim, ${nao} Não)`;
}

/**
 * Título-modelo de uma votação. extra: { apelido?, explicacao?, fonteApelido? }.
 * Retorna { titulo, origem, fonte } ou { erro }.
 */
export function modeloVotacao(v, extra = {}) {
  const quem = quemDecidiu(v);
  const p = v.proposicao;
  if (!quem || !p || !p.sigla) return { erro: 'sem proposição identificada' };
  if (proposicaoDivergente(v)) return { erro: 'a descrição oficial cita proposição diferente da registrada' };
  const k = tipoDaVotacao(v);
  if (k.tipo === 'outro') return { erro: 'tipo de votação não reconhecido na descrição oficial' };
  const verbo = verboDoResultado(v, k);
  if (!verbo) return { erro: 'resultado oficial não informado' };
  const placar = sufixoPlacar(v);
  if (placar && v.resultado === 'aprovada' && v.placar.sim < v.placar.nao) {
    return { erro: 'placar registrado diverge do resultado oficial' };
  }
  const etapa = k.turno ? ` em ${k.turno} turno` : '';
  const P = nomeCurto(p.sigla, v.casa);

  if (k.tipo === 'autoridade') {
    const t = trechoIndicacao(p.ementa, LIMITE_DURO - quem.length - verbo.length - placar.length - 12);
    if (!t) return { erro: 'ementa sem cargo da indicação' };
    return { titulo: `${quem} ${verbo} indicação ${t}${placar}`, origem: 'modelo', fonte: v.proposicao.url || v.fonte?.url };
  }

  const rotulo = extra.apelido || extra.explicacao;
  if (rotulo) {
    const obj = objeto(k, verbo, P, P.nome);
    if (obj) {
      const titulo = `${limpar(rotulo).replace(/\.$/, '')}: ${quem} ${verbo}${etapa} ${obj}${placar}`;
      if (titulo.length <= LIMITE_DURO) return { titulo, origem: extra.apelido ? 'apelido-oficial' : 'explicacao-oficial', fonte: extra.fonteApelido };
    }
  }

  // Requerimento que é a própria proposição (RQS/REQ): "Senado aprova requerimento que requer urgência para…"
  if (['RQS', 'REQ'].includes(p.sigla) && /^requer\b/i.test(p.ementa || '')) {
    const base = `${quem} ${verbo} requerimento que `;
    const tr = trechoDaEmenta(p.ementa.replace(/^Requer\b/, 'Requer'), LIMITE_DURO - base.length - placar.length);
    if (!tr) return { erro: 'ementa longa demais para corte em fronteira de oração' };
    return { titulo: `${base}${tr.texto}${placar}`, origem: 'modelo', fonte: p.url || v.fonte?.url };
  }

  const molde = objeto(k, verbo, P, '§');
  if (!molde) return { erro: 'tipo de votação sem modelo' };
  const fixo = `${quem} ${verbo}${etapa} ${molde.replace('§', `${P.nome} que `)}${placar}`;
  const tr = trechoDaEmenta(p.ementa, LIMITE_DURO - fixo.length);
  if (!tr) return { erro: 'ementa sem verbo inicial ou longa demais para corte em fronteira de oração' };
  return {
    titulo: `${quem} ${verbo}${etapa} ${molde.replace('§', `${P.nome} que ${tr.texto}`)}${placar}`,
    origem: 'modelo',
    fonte: p.url || v.fonte?.url,
  };
}

export function subtituloVotacao(v) {
  const p = v.proposicao || {};
  const conhecida = p.sigla && (NOME_EXTENSO[p.sigla] || (v.casa === 'alesp' && p.sigla === 'PLC'));
  const nome = conhecida && p.numero ? nomeOficial(p.sigla, p.numero, p.ano, v.casa) : (p.titulo || p.identificacao || null);
  const forma = { nominal: 'votação nominal', simbolica: 'votação simbólica', secreta: 'votação secreta' }[v.tipo] || null;
  const orgao = v.orgao_nome && !/^plen/i.test(v.orgao_nome) ? v.orgao_nome : (v.casa === 'camara' ? 'Plenário da Câmara dos Deputados' : v.casa === 'senado' ? 'Plenário do Senado Federal' : 'Plenário da Assembleia Legislativa do Estado de São Paulo');
  return [nome, orgao, forma, dataBR(v.data)].filter(Boolean).join(' · ');
}

/** Título oficial sem alteração: a descrição oficial do resultado (ou a ementa, se faltar). */
export function oficialVotacao(v) {
  const d = limpar(v.descricao || '').replace(/^\((.*)\)\.?$/, '$1');
  const titulo = d || limpar(v.proposicao?.ementa || '') || 'Votação';
  return { titulo, fonte: v.fonte?.url || v.url || null };
}

/** Dados da votação para escolher uma manchete coerente (só votação do texto, nunca de requerimento). */
export function perfilParaManchete(v) {
  const k = tipoDaVotacao(v);
  const verbo = verboDoResultado(v, k);
  const principal = ['principal', 'texto'].includes(k.tipo) && ['aprova', 'rejeita'].includes(verbo);
  return { principal, verbo, turno: k.turno, data: v.data, plenario: /Plenário/.test(quemDecidiu(v) || '') || !/Comissão/.test(quemDecidiu(v) || '') };
}
