// Contas do Governador de SP: página oficial "Contas Anuais" do TCE-SP (aba "Governo Estadual").
// Para cada exercício, lê relator e número do processo da página, baixa a "Decisão"/"Nota de Decisão"
// do Tribunal Pleno (PDF com texto legível) e, se a decisão não listar as ressalvas, a "Minuta de Parecer".
// O PDF do "Parecer" assinado é baixado só para registrar se tem texto legível (em 2023 e 2024 não tem).
import fs from 'node:fs';
import path from 'node:path';
import {
  obter, textoDoPdf, sha256, fonte, dataISO, normalizar, decodificarEntidades, hojeISO, RAIZ,
} from './lib.mjs';

export const URL_CONTAS_ANUAIS = 'https://www.tce.sp.gov.br/contas-anuais';
const NAO_DISPONIVEL = 'Informação não disponível em fonte oficial';

// ---------------------------------------------------------------- página "Contas Anuais"

/** Extrai, da aba "Governo Estadual", um item por exercício: relator, processo e anexos (PDFs). */
export function lerPaginaContasAnuais(html) {
  const ini = html.indexOf('id="contas-anuais-1"');
  const fim = html.indexOf('id="contas-anuais-2"');
  if (ini < 0) throw new Error('Página Contas Anuais: aba "Governo Estadual" não encontrada (layout mudou?)');
  const aba = html.slice(ini, fim > ini ? fim : undefined);
  const blocos = aba.split(/id="heading-accordion-/).slice(1);
  const limpar = (s) => decodificarEntidades(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const itens = [];
  for (const b of blocos) {
    const ano = (b.match(/data-toggle="collapse"[^>]*>\s*(\d{4})\s*<\/a>/) || [])[1];
    if (!ano) continue;
    const ps = [...b.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => limpar(m[1]));
    const relator = (ps.find((p) => /^Relator\(a\):/i.test(p)) || '').replace(/^Relator\(a\):\s*/i, '') || null;
    const tc = (ps.find((p) => /^TC:/i.test(p)) || '').replace(/^TC:\s*/i, '') || null;
    const anexos = [];
    for (const m of b.matchAll(/<a href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<td>([^<]*)<\/td>/gi)) {
      anexos.push({ titulo: limpar(m[2]), url: m[1].startsWith('http') ? m[1] : new URL(m[1], URL_CONTAS_ANUAIS).href, tamanho: limpar(m[3]) });
    }
    itens.push({ exercicio: Number(ano), relator_pagina: relator, processo_pagina: tc, anexos });
  }
  return itens;
}

function escolherAnexos(anexos) {
  const decisoes = anexos.filter((a) => /decis[ãa]o/i.test(a.titulo) && !/exposi|voto|motivos/i.test(a.titulo));
  const minuta = anexos.find((a) => /minuta de parecer/i.test(a.titulo)) || null;
  const parecer = anexos.find((a) => /parecer/i.test(a.titulo) && !/minuta|publica|SDG|PFE|MPC|ATJ|DCG/i.test(a.titulo)) || null;
  const voto = anexos.find((a) => /exposi[çc][ãa]o de motivos e voto|relat[óo]rio e voto/i.test(a.titulo)) || null;
  return { decisoes, minuta, parecer, voto };
}

// ---------------------------------------------------------------- leitura do texto dos PDFs

const CABECALHO = [
  /^TRIBUNAL DE CONTAS DO ESTADO DE S[ÃA]O( PAULO)?$/i, /^PAULO$/, /^SECRETARIA-DIRETORIA GERAL/i, /^TAQUIGRAFIA$/i,
  /Sess[ãa]o .* do Tribunal Pleno, realizada no$/i, /^audit[óo]rio "PROFESSOR/i, /^ENDERE[ÇC]O:/i, /^INTERNET:/i,
  /^Av\. Rangel Pestana/i, /^\(11\) 3292/, /^GABINETE D[OA] CONSELHEIR/i, /^\d{1,3}$/,
];
const ehCabecalho = (l) => CABECALHO.some((r) => r.test(l));

/** Linhas do documento sem cabeçalhos e rodapés repetidos. */
export function linhasDoTexto(paginas) {
  return paginas.flatMap((p) => p.split('\n')).map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l && !ehCabecalho(l));
}

const TITULOS = /^(?:d[oa]s?\s+)?(?:Conselheir[oa]s?|Auditor(?:a)? Substitut[oa] de Conselheir[oa]|Substitut[oa] de Conselheir[oa]|Conselheir[oa]-Substitut[oa])\s+/i;
const semTitulo = (s) => s.replace(TITULOS, '').trim();

/** Lê a "Decisão do Tribunal Pleno" (nota de decisão). Só copia trechos literais. */
export function lerDecisao(paginas) {
  const linhas = linhasDoTexto(paginas);
  const t = linhas.join(' ');
  const r = { lacunas: [] };
  r.processo = (t.match(/TC-\d{6}\.\d{3}\.\d{2}-\d/) || [])[0] || null;
  r.data_sessao = dataISO((t.match(/DATA DA SESS[ÃA]O\s*[–-]\s*(\d{2}-\d{2}-\d{4})/i) || [])[1]);
  // O nome da sessão está no cabeçalho repetido de cada página (removido de "linhas"): lê do texto bruto.
  r.sessao_literal = (paginas.join(' ').replace(/\s+/g, ' ').match(/\d+ª Sess[ãa]o (?:Extraordin[áa]ria|Ordin[áa]ria) do Tribunal Pleno/i) || [])[0] || null;
  r.certidao_literal = (t.match(/Pelo voto[\s\S]*?decidiu[\s\S]*?\.(?=\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9]|\s*$)/) || [])[0] || null;
  const votantes = (t.match(/Pelo voto (.+?), o E\. Plen[áa]rio/) || [])[1] || null;
  r.votantes_literal = votantes ? `Pelo voto ${votantes}` : null;
  if (votantes) {
    const rel = (votantes.match(/^(.+?),\s*Relator\b/) || [])[1];
    // "dos Conselheiros X, Relator, Y…": o plural vale para a lista toda, então fica só o nome.
    const relLimpo = rel ? rel.replace(/^d[oa]s?\s+/i, '').replace(/^Conselheir[oa]s\s+/i, '') : null;
    r.relator_literal = relLimpo ? `${relLimpo}, Relator` : null;
    r.relator = relLimpo ? semTitulo(relLimpo) : null;
    r.presentes = votantes
      .replace(/,\s*Relator\s*,?/i, ',')
      .split(/,\s*|\s+e\s+(?=d[oa]s?\s|[A-ZÁÉÍÓÚ])/)
      .map((s) => semTitulo(s.trim().replace(/^e\s+/, '')))
      .filter(Boolean);
  } else {
    r.relator = null; r.relator_literal = null; r.presentes = [];
  }
  const pres = t.match(/PRESIDENTE\s*[–-]\s*(.+?)(?=\s+PROCURADOR|\s+➢|\s+SDG-|$)/);
  r.presidente_literal = pres ? pres[1].trim() : null;
  const c = r.certidao_literal || '';
  const conc = c.match(/parecer\s+(?:prévio\s+)?((?:des)?favorável|contrário)\s+à\s+aprovação/i);
  r.conclusao = conc ? conc[1].toLowerCase() : null;
  r.com_ressalvas = /(?:^|\s)com\s[^.;]{0,40}?ressalvas?(?![a-zà-ú])/i.test(c) && !/(?:^|\s)sem ressalvas?(?![a-zà-ú])/i.test(c);
  const clausula = c.match(/decidiu (emitir[\s\S]*?)(?:,\s*sem prejuízo|\.$)/);
  r.conclusao_literal = clausula ? clausula[1].trim() : null;
  const res = c.match(/com ressalvas? relativas? (?:a|à|às|aos?)\s+(.+?)(?:,\s*sem prejuízo|,\s*constantes|\.$)/i);
  r.ressalvas = res ? res[1].split(/,\s*|\s+e\s+/).map((s) => s.trim()).filter(Boolean) : [];
  const unan = c.match(/por (unanimidade|maioria)[^,.;]*/i);
  r.resultado_literal = unan ? unan[0] : null;
  const venc = c.match(/vencid[oa]s?[^.;]*/i);
  r.vencidos_literal = venc ? venc[0] : null;
  r.itens = lerItensNumerados(linhas);
  return r;
}

/** Determinações e recomendações numeradas ("1.", "1.1.", "1.1.1.") até a assinatura do Presidente. */
function lerItensNumerados(linhas) {
  const itens = [];
  let comecou = false, atual = null;
  for (const l of linhas) {
    if (/^PRESIDENTE\s*[–-]/.test(l)) break;
    const m = l.match(/^(\d+(?:\.\d+)*)\.\s+(.*)$/);
    if (!comecou) {
      if (m && m[1] === '1' && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(m[2])) comecou = true; else continue;
    }
    if (m) { atual = { numero: m[1], texto: m[2] }; itens.push(atual); } else if (atual) atual.texto += ' ' + l;
  }
  return itens;
}

/** Na minuta de parecer: a ressalva literal e as recomendações "1) … 2) …" registradas à margem do parecer. */
export function lerMinuta(paginas) {
  const linhas = linhasDoTexto(paginas);
  const t = linhas.join(' ');
  const r = {};
  // Só o trecho dispositivo ("… decidiu emitir o presente Parecer, …"), nunca as citações do relatório.
  const ini = t.search(/decidiu emitir o presente Parecer/i);
  const disp = ini >= 0 ? t.slice(ini) : '';
  r.decisao_literal = (disp.match(/^decidiu emitir o presente Parecer,[\s\S]+?\.(?=\s+Decidiu)/i) || [])[0] || null;
  r.ressalva_literal = r.decisao_literal ? ((r.decisao_literal.match(/com ressalvas? [\s\S]+?(?=\.$)/i) || [])[0] || null) : null;
  const itens = [];
  let dentro = false, atual = null;
  for (const l of linhas) {
    if (!dentro) { if (/seguintes recomenda[çc][õo]es/i.test(l)) dentro = true; continue; }
    const m = l.match(/^(\d+)\)\s+(.*)$/);
    if (m) { atual = { numero: m[1], texto: m[2] }; itens.push(atual); } else if (atual) {
      if (/^(Sala das Sess|S[ãa]o Paulo, \d|[A-ZÁÉÍÓÚ ]{12,}$)/.test(l)) break;
      atual.texto += ' ' + l;
    }
  }
  r.recomendacoes = itens;
  return r;
}

// ---------------------------------------------------------------- ligação com a ALESP

/** PDLs da ALESP que julgam as contas anuais do Governador, por exercício, com as votações coletadas. */
export function julgamentosAlesp() {
  const dirProp = path.join(RAIZ, 'dados', 'alesp', 'proposicoes');
  const dirVot = path.join(RAIZ, 'dados', 'alesp', 'votacoes');
  const porExercicio = new Map();
  const anosIndice = [];
  if (!fs.existsSync(dirProp)) return { porExercicio, anosIndice };
  for (const f of fs.readdirSync(dirProp).filter((x) => /^indice-\d{4}\.json$/.test(x)).sort()) {
    anosIndice.push(Number(f.slice(7, 11)));
    const j = JSON.parse(fs.readFileSync(path.join(dirProp, f), 'utf8'));
    for (const p of j.itens || []) {
      const m = String(p.ementa || '').match(/contas anuais apresentadas pelo Senhor Chefe do Poder Executivo relativas ao exerc[íi]cio econ[ôo]mico-financeiro de (\d{4})/i);
      if (m && p.sigla === 'PDL') porExercicio.set(Number(m[1]), { proposicao: p, votacoes: [] });
    }
  }
  if (porExercicio.size && fs.existsSync(dirVot)) {
    const ids = new Map([...porExercicio.values()].map((v) => [String(v.proposicao.id), v]));
    for (const f of fs.readdirSync(dirVot)) {
      if (!f.endsWith('.json') || f.startsWith('indice')) continue;
      const bruto = fs.readFileSync(path.join(dirVot, f), 'utf8');
      if (![...ids.keys()].some((id) => bruto.includes(`"${id}"`))) continue;
      const v = JSON.parse(bruto);
      const alvo = ids.get(String(v.proposicao?.id));
      if (alvo) alvo.votacoes.push(v);
    }
  }
  return { porExercicio, anosIndice };
}

function julgamentoPolitico(exercicio, alesp) {
  const achado = alesp.porExercicio.get(exercicio);
  if (!achado) {
    const periodo = alesp.anosIndice.length ? `proposições de ${alesp.anosIndice[0]} a ${alesp.anosIndice.at(-1)}` : 'nenhum período';
    return {
      valor: null,
      lacuna: `Julgamento das contas de ${exercicio} pela Assembleia Legislativa não localizado nos dados coletados da ALESP (${periodo})`,
    };
  }
  const p = achado.proposicao;
  const votos = achado.votacoes
    .sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.orgao === 'Plenário' ? 1 : -1))
    .map((v) => ({
      votacao_ref: v.id,
      data: v.data,
      orgao: v.orgao_nome || v.orgao,
      tipo: v.tipo,
      descricao: v.descricao_abertura ? `${v.descricao} — ${v.descricao_abertura}` : v.descricao,
      resultado: v.resultado ?? null,
      placar: v.placar ?? null,
      votos_por_tipo: v.votos_por_tipo ?? undefined,
      url: v.url || v.fonte?.url || null,
    }));
  return {
    valor: {
      casa: 'alesp',
      decisao_id: null,
      proposicao: { id: String(p.id), sigla: p.sigla, numero: p.numero, ano: p.ano, ementa: p.ementa, url: p.url },
      situacao_literal: p.situacao?.ultima_tramitacao?.descricao ?? null,
      data_situacao: p.situacao?.ultima_tramitacao?.data ?? null,
      votacoes: votos,
      fonte: {
        titulo: `${p.descricao || `PDL ${p.numero}/${p.ano}`} — Assembleia Legislativa do Estado de São Paulo`,
        url: p.url,
        orgao: 'Assembleia Legislativa do Estado de São Paulo (ALESP)',
        acessado_em: p.situacao_coletada_em || hojeISO(),
      },
    },
    lacuna: votos.length ? null : `Votação do ${p.sigla} ${p.numero}/${p.ano} não encontrada nos dados coletados da ALESP`,
  };
}

// ---------------------------------------------------------------- montagem do item "julgamento"

async function baixarPdf(anexo) {
  const r = await obter(anexo.url, { tipo: 'bin' });
  const txt = textoDoPdf(r.corpo);
  return { ...txt, sha256: sha256(r.corpo), bytes: r.corpo.length, last_modified: r.cabecalhos['last-modified'] || null };
}

function itemVazio(exercicio) {
  return {
    id: `tce-sp-contas-governador-${exercicio}`,
    tribunal: 'tce-sp',
    natureza: 'parecer-previo',
    titulo: `Parecer prévio do Tribunal de Contas do Estado de São Paulo sobre as contas do Governador — exercício ${exercicio}`,
    processo: { classe: 'Contas do Governador', numero: null, incidente_ou_registro: null, url: URL_CONTAS_ANUAIS },
    orgao: 'Tribunal Pleno',
    sessao: null,
    sessao_literal: null,
    relator: null,
    relator_registros: [],
    redator_acordao: null,
    data_julgamento: null,
    data_publicacao: null,
    certidao_literal: null,
    parecer: { conclusao: null, com_ressalvas: null, conclusao_literal: null, ressalvas: [], ressalvas_fonte: null, alertas: [], contas_de: 'Governador do Estado de São Paulo', exercicio: String(exercicio) },
    determinacoes_e_recomendacoes: null,
    votacoes: [],
    quorum: { presentes: [], vencidos: [], voto_desempate: null, declaracoes_de_voto: [] },
    julgamento_politico: null,
    documentos: [],
    situacao_conferencia: 'pendente',
    coletado_em: hojeISO(),
    fontes: [fonte('Contas Anuais — Governo Estadual (página oficial)', URL_CONTAS_ANUAIS)],
    lacunas: [],
  };
}

/** Monta o julgamento/parecer de um exercício. `pagina` é o item da página (ou undefined se ausente). */
export async function montarExercicio(exercicio, pagina, alesp) {
  const it = itemVazio(exercicio);
  const jp = julgamentoPolitico(exercicio, alesp);
  it.julgamento_politico = jp.valor;

  if (!pagina) {
    it.lacunas.push(`Parecer prévio do exercício de ${exercicio} ainda não publicado na página oficial "Contas Anuais" do TCE-SP`);
    it.situacao_conferencia = 'automatico-estruturado'; // a ausência foi verificada na própria página oficial
    if (jp.lacuna) it.lacunas.push(jp.lacuna);
    return it;
  }

  it.documentos = pagina.anexos;
  it.processo.numero_na_pagina = pagina.processo_pagina;
  if (pagina.relator_pagina) {
    it.relator_registros.push({ texto: pagina.relator_pagina, documento: 'Página "Contas Anuais" (campo Relator(a))', url: URL_CONTAS_ANUAIS });
  }
  const { decisoes, minuta, parecer, voto } = escolherAnexos(pagina.anexos);

  if (!decisoes.length) {
    it.lacunas.push('Decisão do Tribunal Pleno não encontrada entre os anexos da página oficial');
  } else {
    // Mais de uma decisão (ex.: sessão convertida em diligência e sessão seguinte): lê todas e usa a última
    // que emite o parecer; as demais ficam em "outras_decisoes" com o texto literal.
    const lidas = [];
    for (const doc of decisoes) {
      const pdf = await baixarPdf(doc);
      it.fontes.push({ ...fonte(doc.titulo, doc.url), sha256: pdf.sha256 });
      lidas.push({ doc, pdf, d: pdf.legivel ? lerDecisao(pdf.paginas) : null });
    }
    const escolhida = [...lidas].reverse().find((x) => x.d?.conclusao) || lidas.find((x) => x.d) || lidas[0];
    if (lidas.length > 1) {
      it.outras_decisoes = lidas.filter((x) => x !== escolhida).map((x) => ({
        documento: x.doc.titulo, url: x.doc.url, data_sessao: x.d?.data_sessao ?? null, certidao_literal: x.d?.certidao_literal ?? null,
      }));
    }
    const { doc, pdf } = escolhida;
    if (!pdf.legivel) {
      it.lacunas.push(`O PDF "${doc.titulo}" não tem texto legível por máquina; conteúdo da decisão pendente de leitura humana`);
    } else {
      const d = escolhida.d;
      it.processo.numero = d.processo;
      it.sessao = d.sessao_literal ? (/extraordin/i.test(d.sessao_literal) ? 'extraordinaria' : 'ordinaria') : null;
      it.sessao_literal = d.sessao_literal;
      it.data_julgamento = d.data_sessao;
      it.certidao_literal = d.certidao_literal;
      it.relator = d.relator;
      if (d.relator_literal) it.relator_registros.push({ texto: d.relator_literal, documento: doc.titulo, url: doc.url });
      it.parecer.conclusao = d.conclusao;
      it.parecer.com_ressalvas = d.certidao_literal ? d.com_ressalvas : null;
      it.parecer.conclusao_literal = d.conclusao_literal;
      if (d.ressalvas.length) {
        it.parecer.ressalvas = d.ressalvas;
        it.parecer.ressalvas_fonte = { documento: doc.titulo, url: doc.url, trecho: (d.certidao_literal.match(/com ressalvas? relativas?.+?(?=,\s*sem prejuízo|\.$)/i) || [null])[0] };
      }
      if (d.itens.length) it.determinacoes_e_recomendacoes = { documento: doc.titulo, url: doc.url, itens: d.itens };
      it.quorum.presentes = d.presentes;
      it.votacoes.push({
        parte: 'mérito',
        resultado: d.resultado_literal,
        votantes_literal: d.votantes_literal,
        vencidos: [],
        impedidos: [],
        ausentes: [],
        presidente: d.presidente_literal,
        votos: [],
      });
      if (!d.resultado_literal) it.lacunas.push('O texto da decisão não usa as expressões "por unanimidade" nem "por maioria"; resultado da votação não classificado');
      if (d.vencidos_literal) it.votacoes[0].vencidos_literal = d.vencidos_literal;
      else it.lacunas.push('O texto da decisão não menciona votos vencidos nem declarações de voto');
      it.lacunas.push('Voto individual de cada conselheiro não publicado em fonte estruturada; consta apenas a lista "Pelo voto de…" da decisão');

      // Conferências internas e divergências.
      const faltas = [];
      for (const [campo, v] of [['processo', d.processo], ['data da sessão', d.data_sessao], ['relator', d.relator], ['conclusão', d.conclusao]]) if (!v) faltas.push(campo);
      if (faltas.length) it.lacunas.push(`Campos não localizados no texto da decisão: ${faltas.join(', ')}`);
      const numPag = String(pagina.processo_pagina || '').replace(/\D/g, '').replace(/^0+/, '');
      const numDec = String(d.processo || '').replace(/\D/g, '').replace(/^0+/, '');
      if (numPag && numDec && !numDec.startsWith(numPag) && !numPag.startsWith(numDec)) it.lacunas.push(`Número do processo diverge: página "${pagina.processo_pagina}", decisão "${d.processo}"`);
      if (pagina.relator_pagina && d.relator && !normalizar(pagina.relator_pagina).includes(normalizar(d.relator))) {
        it.lacunas.push(`Relator diverge entre fontes oficiais: a página "Contas Anuais" indica "${pagina.relator_pagina}" e a decisão do Tribunal Pleno indica "${d.relator_literal}". Os dois registros são mostrados sem correção`);
      }
      it.situacao_conferencia = faltas.length ? 'pendente' : 'automatico-estruturado';

      // Ressalvas não listadas na decisão: procura na minuta de parecer publicada na mesma página.
      if (d.com_ressalvas && !d.ressalvas.length) {
        if (minuta) {
          const pm = await baixarPdf(minuta);
          it.fontes.push({ ...fonte(minuta.titulo, minuta.url), sha256: pm.sha256 });
          const m = pm.legivel ? lerMinuta(pm.paginas) : {};
          if (m.ressalva_literal) {
            it.parecer.ressalvas = [m.ressalva_literal];
            it.parecer.ressalvas_fonte = { documento: minuta.titulo, url: minuta.url, trecho: m.decisao_literal };
            it.lacunas.push(`A decisão do Tribunal Pleno não lista as ressalvas; o texto da ressalva vem do documento "${minuta.titulo}" publicado na página oficial, não do parecer assinado`);
          } else {
            it.lacunas.push('Ressalvas não listadas na decisão nem localizadas na minuta de parecer');
          }
          if (m.recomendacoes?.length && !it.determinacoes_e_recomendacoes) {
            it.determinacoes_e_recomendacoes = { documento: minuta.titulo, url: minuta.url, itens: m.recomendacoes };
          }
        } else {
          it.lacunas.push('A decisão não lista as ressalvas; texto das ressalvas não disponível em documento legível por máquina');
        }
      }
    }
  }

  // Relator divergente: registra também o cabeçalho literal do voto (primeira página), se o PDF for pequeno.
  if (it.lacunas.some((l) => l.startsWith('Relator diverge')) && voto && !/MB$/i.test(voto.tamanho || '')) {
    const pv = await baixarPdf(voto);
    it.fontes.push({ ...fonte(voto.titulo, voto.url), sha256: pv.sha256 });
    const l1 = (pv.paginas[0] || '').split('\n').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const g = l1.findIndex((x) => /^GABINETE D[OA] CONSELHEIR/i.test(x));
    if (pv.legivel && g >= 0) {
      const texto = [l1[g], l1[g + 1]].filter((x) => x && !/^Tribunal Pleno$/i.test(x)).join(' — ');
      it.relator_registros.push({ texto, documento: `${voto.titulo} (cabeçalho)`, url: voto.url });
    }
  }
  if (parecer) {
    const pp = await baixarPdf(parecer);
    it.parecer.documento = { titulo: parecer.titulo, url: parecer.url, sha256: pp.sha256, texto_legivel: pp.legivel };
    it.fontes.push({ ...fonte(parecer.titulo, parecer.url), sha256: pp.sha256 });
    if (!pp.legivel) it.lacunas.push(`O PDF "${parecer.titulo}" (parecer assinado) usa fontes sem mapeamento de texto e não pôde ser lido por máquina; ressalvas e alertas detalhados exigem leitura humana`);
  } else {
    it.lacunas.push('Parecer assinado não encontrado entre os anexos da página oficial');
  }
  it.parecer.alertas = [];
  const pub = pagina.anexos.find((a) => /publica[çc][ãa]o do parecer/i.test(a.titulo));
  if (pub) it.lacunas.push(`Data de publicação do parecer não extraída automaticamente; ver o documento oficial "${pub.titulo}"`);
  else it.lacunas.push(`Data de publicação do parecer: ${NAO_DISPONIVEL.toLowerCase()}`);
  if (jp.lacuna) it.lacunas.push(jp.lacuna);
  return it;
}
