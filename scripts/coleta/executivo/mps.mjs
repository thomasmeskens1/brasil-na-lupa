// Medidas provisórias: Senado/Congresso (processo e prazos), Câmara (id da proposição),
// Planalto (página da MP e PDF da exposição de motivos) e votações já coletadas em dados/camara e dados/senado.
import path from 'node:path';
import { obter, paraCada, lerJson, gravarSeMudou, sha256, fonte, lista } from './lib.mjs';
import { extrairLinhasPdf, paragrafos as separarParagrafos } from './pdf.mjs';
import { paginaPlanalto } from './planalto.mjs';

const SEN = 'https://legis.senado.leg.br/dadosabertos';
const CAM = 'https://dadosabertos.camara.leg.br/api/v2';
const LIMITE_TRECHO = 1000;

/** Situação: só rótulos que correspondem exatamente ao registro oficial; o texto oficial vai junto. */
function situacaoMp(p) {
  const tipo = p.deliberacao?.siglaTipo || '';
  if (p.tramitando === 'Sim') return 'em tramitação';
  if (tipo === 'PERDA_EFICACIA') return 'perdeu eficácia';
  if (/REJEITAD/.test(tipo)) return 'rejeitada';
  if (tipo === 'REVOGADO') return 'revogada';
  if (/^APROVAD/.test(tipo) && p.normaGerada?.numero) return 'convertida em lei';
  if (/^APROVAD/.test(tipo) && p.deliberacao?.siglaDestino === 'SANCAO') return 'aprovada pelo Congresso, enviada à sanção';
  if (p.siglaSituacaoAtual === 'SEFICA') return 'perdeu eficácia';
  return null;
}

/** Corta a citação no fim de frase anterior ao limite; marca o corte. */
function trecho(numero, texto) {
  if (texto.length <= LIMITE_TRECHO) return { paragrafo: numero, texto, truncado: false };
  const corte = texto.slice(0, LIMITE_TRECHO);
  const fim = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('; '));
  return { paragrafo: numero, texto: (fim > 200 ? corte.slice(0, fim + 1) : corte) + ' […]', truncado: true };
}

// Linhas de rodapé/assinatura do SEI que não fazem parte dos parágrafos.
const RUIDO = /(\/\s*pg\.\s*\d+\s*$)|^(\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}\b|https?:\/\/|Documento assinado eletronicamente|Assinado eletronicamente|A autenticidade d|Referência: Processo|Criado por|Respeitosamente|Assinatura)/i;

async function exposicaoDeMotivos(urlPdf, hoje) {
  const r = await obter(urlPdf, { tipo: 'buffer', opcional: true, timeoutMs: 90000 });
  if (!r) return { url: urlPdf, lacuna: 'PDF da exposição de motivos indicado na página do Planalto não foi encontrado (HTTP 404)' };
  const linhas = extrairLinhasPdf(r.dados).filter((l) => !RUIDO.test(l.texto.trim()));
  const { cabecalho, paragrafos, numerado_na_fonte } = separarParagrafos(linhas);
  const base = { url: r.url, sha256: sha256(r.dados), bytes: r.dados.length, acessado_em: hoje };
  if (!paragrafos.length) {
    return { ...base, documento: null, trechos: [], lacuna: 'Texto da exposição de motivos não extraível do PDF (texto não legível ou sem parágrafos identificáveis); consultar o PDF oficial' };
  }
  const doc = cabecalho.find((l) => /^(EMI?|EXM|E\.M\.)\s*(n|nº|n°|no)/i.test(l)) || null;
  const data = cabecalho.find((l) => /^Bras[íi]lia,/i.test(l)) || null;
  const escolhidos = [];
  const urg = paragrafos.find((p) => /urg[êe]ncia/i.test(p.texto) && /relev[âa]ncia/i.test(p.texto));
  const p2 = paragrafos.find((p) => p.numero === 2);
  if (p2) escolhidos.push(trecho(2, p2.texto));
  if (urg && urg.numero !== 2) escolhidos.push(trecho(urg.numero, urg.texto));
  if (!escolhidos.length) escolhidos.push(trecho(1, paragrafos[0].texto));
  return {
    ...base,
    documento: doc,
    data_texto: data,
    paragrafos_total: paragrafos.length,
    paragrafos_numerados_na_fonte: numerado_na_fonte,
    criterio_trechos: 'Trechos literais: parágrafo 2 (o primeiro após o de apresentação) e o parágrafo que trata de relevância e urgência, quando houver; sem resumo.'
      + (numerado_na_fonte ? '' : ' O documento não numera os parágrafos: o número indica a posição do parágrafo na ordem de leitura.'),
    trechos: escolhidos,
  };
}

/** Índice local das votações já coletadas (Câmara e Senado), por identificação "MPV n/ano" e por id de processo. */
export function votacoesLocais(raiz) {
  const camara = new Map(), senado = new Map();
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const ano of [2023, 2024, 2025, 2026, 2027]) {
    const c = lerJson(path.join(raiz, 'dados/camara/votacoes', `indice-${ano}.json`));
    for (const v of c?.itens || []) {
      const t = v.proposicao?.titulo || '';
      if (/^(MPV|PLV) /.test(t)) add(camara, t, { casa: 'camara', votacao_ref: v.id, data: v.data, orgao: v.orgao, descricao: v.descricao, tipo: v.tipo, resultado: v.resultado, placar: v.placar ?? null });
    }
    const s = lerJson(path.join(raiz, 'dados/senado/votacoes', `indice-${ano}.json`));
    for (const v of s?.itens || []) {
      const reg = { casa: 'senado', votacao_ref: v.id, data: v.data, descricao: v.descricao, tipo: v.tipo, resultado: v.resultado, placar: v.placar ?? null };
      if (v.proposicao_id) add(senado, 'id:' + v.proposicao_id, reg);
      if (v.proposicao) add(senado, v.proposicao, reg);
    }
  }
  return { camara, senado };
}

export async function coletarMps({ anos, desde, completo, hoje, dirDados, raiz, log }) {
  const dir = path.join(dirDados, 'medidas-provisorias');
  const votos = votacoesLocais(raiz);
  const contagem = { total: 0, detalhes_atualizados: 0, com_exposicao: 0, exposicao_sem_texto: 0, sem_exposicao: 0, com_votacao_local: 0, por_situacao: {} };
  for (const ano of anos) {
    const { dados: listaSen } = await obter(`${SEN}/processo?sigla=MPV&ano=${ano}`);
    // Câmara: id da proposição para o link oficial
    const idsCamara = new Map();
    for (let pag = 1; pag < 10; pag++) {
      const r = await obter(`${CAM}/proposicoes?siglaTipo=MPV&ano=${ano}&itens=100&ordem=ASC&ordenarPor=id&pagina=${pag}`);
      for (const p of r.dados.dados || []) idsCamara.set(Number(p.numero), p.id);
      if (!(r.dados.links || []).some((l) => l.rel === 'next')) break;
    }
    const itensIndice = [];
    await paraCada(listaSen, async (resumo) => {
      const numero = Number(resumo.identificacao.split(' ')[1].split('/')[0]);
      const id = `mpv-${numero}-${ano}`;
      const arq = path.join(dir, `${id}.json`);
      const antigo = lerJson(arq);
      const mudou = completo || !antigo || resumo.tramitando === 'Sim' || (resumo.dataUltimaAtualizacao || '').slice(0, 10) >= desde;
      let reg = antigo;
      if (mudou) {
        const [{ dados: p }, prazoResp] = await Promise.all([
          obter(`${SEN}/processo/${resumo.id}`),
          obter(`${SEN}/processo/prazo?idProcesso=${resumo.id}`, { opcional: true }),
        ]);
        reg = await montarMp({ p, prazos: prazoResp?.dados || [], numero, ano, id, antigo, completo, hoje, idCamara: idsCamara.get(numero) });
        contagem.detalhes_atualizados++;
      }
      if (!reg) return;
      // Votações (sempre recalculadas a partir dos arquivos locais)
      const ident = `MPV ${numero}/${ano}`;
      const vs = [...(votos.camara.get(ident) || []), ...(votos.senado.get('id:' + reg.ids_oficiais.senado_processo) || [])];
      const vistos = new Set();
      reg.votacoes = vs.filter((v) => { const k = v.casa + v.votacao_ref; if (vistos.has(k)) return false; vistos.add(k); return true; })
        .sort((a, b) => (a.data + a.casa + a.votacao_ref).localeCompare(b.data + b.casa + b.votacao_ref));
      reg.lacunas = reg.lacunas.filter((l) => !l.startsWith('Votações'));
      if (!reg.votacoes.length) reg.lacunas.push('Votações: nenhuma votação desta medida provisória consta nos dados coletados da Câmara (dados/camara) e do Senado (dados/senado)');
      else if (!reg.votacoes.some((v) => v.casa === 'senado')) reg.lacunas.push('Votações no Senado: o serviço oficial do Senado lista apenas votações nominais e secretas; votações simbólicas não constam em dados/senado');
      gravarSeMudou(arq, reg);
      contagem.total++;
      contagem.por_situacao[reg.situacao || 'outra'] = (contagem.por_situacao[reg.situacao || 'outra'] || 0) + 1;
      if (reg.exposicao_motivos?.trechos?.length) contagem.com_exposicao++;
      else if (reg.exposicao_motivos) contagem.exposicao_sem_texto++;
      else contagem.sem_exposicao++;
      if (reg.votacoes.length) contagem.com_votacao_local++;
      itensIndice.push({
        id, numero, ano, data: reg.datas.edicao, ementa: reg.ementa, situacao: reg.situacao, situacao_oficial: reg.situacao_oficial,
        norma_gerada: reg.norma_gerada?.descricao || null, exposicao_motivos: !!reg.exposicao_motivos?.trechos?.length,
        votacoes: reg.votacoes.length, url: reg.links.planalto || reg.links.senado,
      });
    });
    itensIndice.sort((a, b) => a.numero - b.numero);
    gravarSeMudou(path.join(dir, `indice-${ano}.json`), {
      atualizado_em: hoje, ano,
      fonte: fonte(`Medidas provisórias de ${ano} — Dados Abertos do Senado Federal (Congresso Nacional)`, `${SEN}/processo?sigla=MPV&ano=${ano}`, 'Senado Federal / Congresso Nacional', hoje),
      itens: itensIndice,
    });
    log(`MPs ${ano}: ${itensIndice.length}`);
  }
  return contagem;
}

async function montarMp({ p, prazos, numero, ano, id, antigo, completo, hoje, idCamara }) {
  const lacunas = [];
  const fontes = [fonte(`Processo ${p.identificacao} — Senado Federal (Congresso Nacional)`, `${SEN}/processo/${p.id}`, 'Senado Federal / Congresso Nacional', hoje)];
  const editada = lista(p.itensCalendario).find((i) => /Editada/i.test(i.descricaoItem))?.eventoOcorrido || null;
  const ng = p.normaGerada && p.normaGerada.numero ? p.normaGerada : null;
  const listaPrazos = lista(prazos).map((z) => ({
    tipo: z.tipoPrazo, inicio: z.inicioPrazo || null, fim: z.fimPrazo || null, fundamento_legal: z.fundamentoLegal || null,
    prorrogado: z.prorrogado || null, fase: z.descricaoTipoFase || null, colegiado: z.nomeColegiado || null,
  })).sort((a, b) => (a.inicio || '').localeCompare(b.inicio || '') || a.tipo.localeCompare(b.tipo));
  if (listaPrazos.length) fontes.push(fonte(`Prazos de ${p.identificacao} — Senado Federal`, `${SEN}/processo/prazo?idProcesso=${p.id}`, 'Senado Federal / Congresso Nacional', hoje));
  else lacunas.push('Prazos não disponíveis em fonte oficial');
  const reg = {
    id, caminho: 'presidencia', instrumento: 'Medida Provisória', forma: 'ato individual (medida provisória)',
    numero, ano, identificacao: p.identificacao,
    ementa: p.conteudo?.ementa || null,
    apelido_senado: p.apelido || null,
    autoria: lista(p.autoriaIniciativa).map((a) => a.autor).join('; ') || null,
    mensagem: p.identificacaoExterna?.identificacao || null,
    datas: { edicao: editada, publicacao: p.documento?.dataPublicacao || null, situacao: p.dataSituacaoAtual || null },
    situacao: situacaoMp(p),
    situacao_oficial: p.situacaoAtual || null,
    tramitando: p.tramitando === 'Sim',
    deliberacao: p.deliberacao?.siglaTipo ? { data: p.deliberacao.data || null, tipo: p.deliberacao.tipoDeliberacao || null, destino: p.deliberacao.destino || null } : null,
    norma_gerada: ng ? {
      id: `${/LCP/.test(ng.siglaTipo) ? 'lcp' : 'lei'}-${ng.numero}-${ng.anoAssinatura}`,
      descricao: ng.descricao, tipo: ng.tipo, numero: ng.numero, data_assinatura: ng.dataAssinatura || null,
      data_publicacao: ng.dataPublicacao || null, publicacao: ng.veiculoPublicacao || null,
    } : null,
    comissao_mista: (() => { try { const c = JSON.parse(p.comissaoMpv || '{}'); return c.nome || null; } catch { return null; } })(),
    prazos: listaPrazos,
    ids_oficiais: { senado_processo: String(p.id), senado_materia: p.codigoMateria ? String(p.codigoMateria) : null, camara_proposicao: idCamara ? String(idCamara) : null },
    links: {
      planalto: null,
      senado: p.codigoMateria ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${p.codigoMateria}` : null,
      camara: idCamara ? `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${idCamara}` : null,
      texto_original_senado: p.documento?.url || null,
    },
    exposicao_motivos: null,
    justificativa: null,
    votacoes: [],
    fontes, lacunas,
    atualizado_em: hoje,
  };
  if (!idCamara) lacunas.push('Proposição não localizada na API da Câmara dos Deputados (siglaTipo=MPV)');
  if (!reg.situacao) lacunas.push(`Situação sem rótulo padronizado; vale o texto oficial: "${p.situacaoAtual}"`);

  // Planalto: reaproveita a exposição de motivos já extraída (o PDF oficial não muda), salvo em --completo.
  const jaTem = antigo?.exposicao_motivos?.sha256 && antigo?.links?.planalto;
  if (jaTem && !completo) {
    reg.links.planalto = antigo.links.planalto;
    reg.links.planalto_lei = antigo.links.planalto_lei || null;
    reg.exposicao_motivos = antigo.exposicao_motivos;
    for (const f of antigo.fontes || []) if (f.orgao === 'Presidência da República') fontes.push(f);
    for (const l of antigo.lacunas || []) if (/Planalto|exposição de motivos/i.test(l)) lacunas.push(l);
  } else {
    const pagina = await paginaPlanalto(`_ato2023-2026/${ano}/mpv/mpv${numero}.htm`);
    if (!pagina) {
      lacunas.push('Página da medida provisória no Planalto não encontrada; exposição de motivos não disponível em fonte oficial coletada');
    } else {
      reg.links.planalto = pagina.url;
      fontes.push(fonte(pagina.titulo || `Medida Provisória nº ${numero}/${ano} — Planalto`, pagina.url, 'Presidência da República', hoje));
      const lei = pagina.links.find((l) => /^Convertida na Lei/i.test(l.texto));
      reg.links.planalto_lei = lei ? lei.url : null;
      const em = pagina.links.find((l) => /^Exposi[çc][ãa]o de motivos/i.test(l.texto));
      if (!em) lacunas.push('A página da medida provisória no Planalto não traz link para exposição de motivos');
      else {
        const ex = await exposicaoDeMotivos(em.url, hoje);
        reg.exposicao_motivos = ex;
        fontes.push(fonte(ex.documento ? `Exposição de Motivos ${ex.documento}` : `Exposição de Motivos da MP ${numero}/${ano}`, ex.url, 'Presidência da República', hoje));
        if (ex.lacuna) lacunas.push(ex.lacuna);
      }
    }
  }
  if (reg.exposicao_motivos?.trechos?.length) {
    const t = reg.exposicao_motivos.trechos[reg.exposicao_motivos.trechos.length - 1];
    reg.justificativa = { texto: t.texto, documento: `Exposição de Motivos${reg.exposicao_motivos.documento ? ' ' + reg.exposicao_motivos.documento : ''}, parágrafo ${t.paragrafo}`, url: reg.exposicao_motivos.url };
  }
  return reg;
}
