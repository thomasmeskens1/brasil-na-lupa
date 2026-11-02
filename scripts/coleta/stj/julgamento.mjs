// Monta o bloco "julgamento" de um tema: uma sessão (votacao_stj) por acórdão encontrado nos espelhos
// de acórdãos ou, na falta, nas íntegras do Diário da Justiça. Texto literal; resultado só por expressão literal.
import { dataISO } from './lib.mjs';
import { prepararTexto, resultadoLiteral, preExtrairVotos, etapaPorClasse } from './votos.mjs';

const ORGAO = 'Superior Tribunal de Justiça';
const ORDEM_ETAPA = { afetacao: 0, merito: 1, embargos: 2, outro: 3 };
const classeDe = (processo) => String(processo ?? '').replace(/\s+\d+$/, '').trim();

function sessaoBase({ etapa, processo, registro, paradigma, orgao, tipoDecisao, data, publicacao, publicacaoFonte, relator, bruto }) {
  const { texto, omitidos } = prepararTexto(bruto);
  const res = resultadoLiteral(texto);
  const colegiada = /AC[ÓO]RD[ÃA]O/i.test(tipoDecisao || '');
  const lacunas = [];
  if (!texto.trim()) lacunas.push('Texto do resultado do julgamento vazio na fonte');
  else if (!res.resultado) lacunas.push('O texto oficial não traz "por unanimidade" nem "por maioria": resultado não informado');
  return {
    etapa, processo, numero_registro: registro, processo_paradigma: paradigma,
    orgao, tipo: colegiada ? 'colegiada' : (tipoDecisao ? 'monocratica' : null), tipo_decisao_fonte: tipoDecisao ?? null,
    data, data_publicacao: publicacao, data_publicacao_fonte: publicacaoFonte,
    relator_fonte: relator,
    decisao: texto || null,
    resultado: res.resultado,
    resultado_trechos: res.trechos,
    votos_pre_extracao: colegiada && texto.trim() ? preExtrairVotos(texto, { relatorCampo: relator }) : null,
    trechos_omitidos: omitidos,
    lacunas,
  };
}

/** Sessão a partir de um registro de espelho de acórdão. */
export function sessaoDeEspelho(item, tema, hoje) {
  const e = item.registro;
  const processo = `${String(e.siglaClasse ?? '').trim()} ${String(e.numeroProcesso ?? '').trim()}`.trim();
  const reg = String(e.numeroRegistro).trim();
  const paradigma = tema.processos.find((p) => p.numero_registro === reg);
  const s = sessaoBase({
    etapa: etapaPorClasse(e.siglaClasse, classeDe(paradigma?.processo)),
    processo, registro: reg, paradigma: paradigma?.paradigma ?? null,
    orgao: e.nomeOrgaoJulgador ?? null, tipoDecisao: e.tipoDeDecisao ?? null,
    data: dataISO(e.dataDecisao), publicacao: dataISO(e.dataPublicacao),
    publicacaoFonte: e.dataPublicacao ? String(e.dataPublicacao).replace(/\s+/g, ' ').trim() : null,
    relator: e.ministroRelator ?? null, bruto: e.decisao,
  });
  s.tese_juridica = e.teseJuridica ? String(e.teseJuridica).trim() : null;
  s.ementa = e.ementa ? String(e.ementa).trim() : null;
  s.referencias_legislativas = Array.isArray(e.referenciasLegislativas) ? e.referenciasLegislativas.map((x) => String(x).trim()) : [];
  s.tema_fonte = e.tema ? String(e.tema).replace(/\s+/g, ' ').trim() : null;
  s.fonte = {
    titulo: `STJ — Dados Abertos: espelhos de acórdãos (${e.nomeOrgaoJulgador ?? item.conjunto}), arquivo ${item.arquivo}, acórdão id ${e.id}`,
    url: item.url, orgao: ORGAO, acessado_em: hoje,
  };
  return s;
}

/** Sessão a partir das íntegras (metadados + parágrafo do acórdão). Data da sessão não vem nos metadados. */
export function sessaoDeIntegra(achado, tema, hoje) {
  const d = achado.meta;
  const reg = String(d.numeroRegistro).trim();
  const paradigma = tema.processos.find((p) => p.numero_registro === reg);
  const classe = classeDe(d.processo);
  const s = sessaoBase({
    etapa: etapaPorClasse(classe, classeDe(paradigma?.processo)),
    processo: d.processo ?? null, registro: reg, paradigma: paradigma?.paradigma ?? null,
    orgao: null, tipoDecisao: d.tipoDocumento ?? null,
    data: null, publicacao: dataISO(d.dataPublicacao), publicacaoFonte: d.dataPublicacao ?? null,
    relator: d.NM_MINISTRO ?? null, bruto: achado.texto_dispositivo ?? '',
  });
  s.lacunas.push('Data da sessão de julgamento não consta dos metadados das íntegras');
  s.lacunas.push('Órgão julgador não consta dos metadados das íntegras');
  if (!achado.texto_dispositivo) s.lacunas.push('Parágrafo do acórdão não localizado no arquivo de textos das íntegras');
  s.tese_juridica = null; s.ementa = null; s.referencias_legislativas = []; s.tema_fonte = null;
  s.fonte = {
    titulo: `STJ — Dados Abertos: íntegras de decisões e acórdãos do Diário da Justiça de ${d.dataPublicacao}, documento ${d.SeqDocumento}`,
    url: achado.url_textos ?? achado.url_metadados, orgao: ORGAO, acessado_em: hoje,
  };
  return s;
}

/** Junta as sessões do tema e registra as lacunas do julgamento. */
export function montarJulgamento(tema, sessoes, { mesesPesquisados, integrasPesquisadas, pendenciaIntegra }) {
  sessoes.sort((a, b) => String(a.data ?? a.data_publicacao ?? '').localeCompare(String(b.data ?? b.data_publicacao ?? ''))
    || ORDEM_ETAPA[a.etapa] - ORDEM_ETAPA[b.etapa] || (b.processo_paradigma === true) - (a.processo_paradigma === true)
    || String(a.processo).localeCompare(String(b.processo)));
  const lacunas = [];
  const temPublicacao = Boolean(tema.datas.publicacao || tema.processos.some((p) => p.data_publicacao_acordao));
  const temMerito = sessoes.some((s) => s.etapa === 'merito');
  if (temPublicacao && !temMerito) {
    lacunas.push(pendenciaIntegra
      ?? 'Texto oficial do julgamento do mérito não encontrado nos espelhos de acórdãos nem nas íntegras pesquisadas');
  }
  if (!temPublicacao && !sessoes.length) lacunas.push('Tema ainda sem acórdão publicado');
  return {
    sessoes,
    pesquisa: { espelhos_meses: mesesPesquisados, integras_dias: integrasPesquisadas },
    aguardando_fonte: temPublicacao && !temMerito,
    conferencia_votos: sessoes.some((s) => s.votos_pre_extracao) ? 'pendente' : null,
    lacunas,
  };
}
