// Monta os itens (formato ParecerPrevioTce do site) a partir dos registros da API de jurisprudência
// do TCE-AM, e os arquivos de saída (contas do Governador por exercício, contas dos Prefeitos por município).
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, fonte, normalizar } from './lib.mjs';
import {
  limparConteudo, numeroLiteral, numeroDoTexto, extrairExercicio, extrairResponsavel, extrairRelatorTexto,
  relatoresCompativeis, extrairConclusao, itensDispositivos, ressalvasEDeterminacoes, dataSessaoISO, dataSessaoDoTexto, classificarOrgao,
} from './extrair.mjs';

export const API = 'https://jurisprudencia-api.tce.am.gov.br';
export const SITE_JURIS = 'https://jurisprudencia.tce.am.gov.br';
export const NATUREZA = 'Prestação de Contas Anual';
export const TIPO = 'Parecer Prévio';

/** URL de consulta da API (mesmos parâmetros do site oficial; os não usados vão como "null"). */
export function urlApi(campos) {
  const base = {
    strConteudo: 'null', strAnoProcesso: 'null', strNumeroProcesso: 'null', strAnoDecisorio: 'null', strNumeroDecisorio: 'null',
    strRelatorDecisorio: 'null', strOrgaoJulgador: 'null', strDataSessaoInicio: 'null', strDataSessaoFim: 'null', strNatureza: 'null',
  };
  const p = new URLSearchParams({ ...base, ...campos });
  return `${API}/decisorios/byManyFields?${p.toString().replace(/\+/g, '%20')}`;
}

export const urlProcessoSite = (n, a) => `${SITE_JURIS}/decisoriosByProcesso?processo=${encodeURIComponent(n)}&anoProcesso=${encodeURIComponent(a)}`;

/** Municípios do Amazonas (dados/municipios/entes.json, Siconfi/Tesouro): nome normalizado → { id, nome, codigo_ibge }. */
export function carregarMunicipiosAM(arquivo = path.join(RAIZ, 'dados', 'municipios', 'entes.json')) {
  const d = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const m = new Map();
  for (const [cod, nome, uf, slug] of d.itens) if (uf === 'am') m.set(normalizar(nome), { id: slug, nome, codigo_ibge: String(cod) });
  return m;
}

export const LACUNA_ACENTOS = 'O texto integral publicado pela API de jurisprudência vem sem acentos; os trechos literais estão reproduzidos como na fonte';
export const LACUNA_RECURSOS = 'Recursos contra o parecer (natureza "Recurso") não foram consultados; uma eventual reforma da decisão não aparece aqui';
export const LACUNA_PUBLICACAO = 'Data de publicação no Diário Oficial Eletrônico do TCE-AM não informada pela API';

/**
 * Converte um registro da API num item. Devolve { tipo, municipio_normalizado?, item } ou { tipo: 'descartado', motivo }.
 */
export function montarItem(x) {
  // Registros migrados de sistema antigo vêm sem metadados (tipoDecisorio, anoDecisorio, dataSessao vazios),
  // mas com o campo "tipo" = "PARECERPREVIO"; o número é então lido do cabeçalho do texto integral.
  const semMetadados = !x.tipoDecisorio && x.tipo === 'PARECERPREVIO';
  if (x.tipoDecisorio !== TIPO && !semMetadados) return { tipo: 'descartado', motivo: `tipo ${x.tipoDecisorio || x.tipo || 'vazio'}` };
  if (x.natureza !== NATUREZA) return { tipo: 'descartado', motivo: `natureza ${x.natureza}` };
  const quem = classificarOrgao(x.orgao);
  if (quem.tipo === 'outro') return { tipo: 'descartado', motivo: `órgão ${x.orgao}` };
  const doTexto = semMetadados ? numeroDoTexto(x.conteudo) : null;
  if (semMetadados && !doTexto) return { tipo: 'descartado', motivo: `número não identificado (registro sem metadados, processo ${x.numeroProcesso}/${x.anoProcesso})` };
  const texto = limparConteudo(x.conteudo);
  const ex = extrairExercicio(texto, x.objeto);
  const num = semMetadados ? `${doTexto.numero}/${doTexto.ano}` : `${x.numeroDecisorio}/${x.anoDecisorio}`;
  if (!ex.exercicio) return { tipo: 'descartado', motivo: `exercício não identificado (Parecer Prévio ${num})` };
  if (semMetadados) {
    const lit = numeroLiteral(x.conteudo) || '';
    x = { ...x, orgaoJulgador: /TRIBUNAL PLENO/.test(lit) ? 'Tribunal Pleno' : null };
  }
  const c = extrairConclusao(texto);
  const relTexto = extrairRelatorTexto(texto);
  const relApi = (x.relator || '').trim() || null;
  const compat = relatoresCompativeis(relApi, relTexto);
  const pdf = /^https:\/\/jurisprudencia-fs\.tce\.am\.gov\.br\//.test(x.caminhoArquivo || '') ? x.caminhoArquivo : null;
  const colegiado = (x.orgaoJulgador || '').trim() || null;
  const docTitulo = `Parecer Prévio nº ${num} – TCE – ${colegiado ?? 'TCE-AM'}`;
  const lacunas = [];
  if (c.lacuna) lacunas.push(c.lacuna);
  if (ex.divergente) lacunas.push(ex.divergente);
  if (relApi && relTexto && !compat) lacunas.push(`Os registros oficiais divergem sobre o relator: "${relTexto}" no texto do parecer e "${relApi}" no campo relator da API`);
  if (!relApi && !relTexto) lacunas.push('Relator não informado');
  if (!pdf) lacunas.push('Link do PDF oficial não informado pela API');
  const dataApi = dataSessaoISO(x.dataSessao);
  const dataTexto = dataSessaoDoTexto(texto);
  const dataJulgamento = dataApi ?? dataTexto?.iso ?? null;
  if (semMetadados) lacunas.push('Registro da API sem metadados (tipo da sessão, colegiado e número vazios): número e colegiado lidos do cabeçalho do texto integral');
  if (!dataApi && dataTexto) lacunas.push(`Data da sessão ausente na API; lida do item "Data da Sessao" do texto integral ("${dataTexto.literal}")`);
  else if (!dataJulgamento) lacunas.push('Data da sessão de julgamento não informada pela API nem pelo texto integral');
  else if (dataTexto && dataTexto.iso !== dataApi) lacunas.push(`A data da sessão na API (${dataApi}) difere da escrita no texto integral ("${dataTexto.literal}"); foi usada a da API`);
  lacunas.push(LACUNA_PUBLICACAO, LACUNA_ACENTOS, LACUNA_RECURSOS);
  const item = {
    id: null, // definido ao agrupar
    tribunal: 'tce-am',
    natureza: 'parecer-previo',
    titulo: null,
    decisorio: { tipo: TIPO, numero: num, numero_literal: numeroLiteral(x.conteudo) },
    processo: {
      classe: x.natureza,
      numero: x.numeroProcesso && x.anoProcesso ? `${x.numeroProcesso}/${x.anoProcesso}` : null,
      incidente_ou_registro: null,
      url: x.numeroProcesso && x.anoProcesso ? urlProcessoSite(x.numeroProcesso, x.anoProcesso) : null,
    },
    orgao: colegiado,
    sessao: null,
    sessao_literal: (x.sessao || '').trim() || null,
    relator: compat || !relTexto ? relApi : relTexto,
    relator_registros: [
      relTexto ? { texto: relTexto, documento: `${docTitulo} (texto integral, item "Relator")`, url: pdf } : null,
      relApi ? { texto: relApi, documento: 'API do Banco de Jurisprudência do TCE-AM (campo "relator")', url: null } : null,
    ].filter(Boolean),
    data_julgamento: dataJulgamento,
    data_publicacao: null,
    responsavel_literal: extrairResponsavel(texto),
    parecer: {
      conclusao: c.conclusao,
      com_ressalvas: c.com_ressalvas,
      conclusao_literal: c.conclusao_literal,
      ementa_literal: c.ementa_literal,
      ressalvas: [],
      alertas: [],
      contas_de: null,
      exercicio: ex.exercicio,
      documento: pdf ? { titulo: `${docTitulo} (PDF)`, url: pdf, tamanho: (x.tamanho || '').trim() || null } : null,
    },
    votacoes: c.unanimidade_literal ? [{ parte: 'mérito', resultado: 'unanimidade', resultado_literal: c.unanimidade_literal }] : [],
    julgamento_politico: null,
    situacao_conferencia: 'automatico-estruturado',
    ...(semMetadados ? { registro_sem_metadados: true } : {}),
    fontes: [
      pdf ? fonte(`${docTitulo} (PDF oficial)`, pdf) : null,
      x.numeroProcesso && x.anoProcesso
        ? fonte(`Banco de Jurisprudência do TCE-AM — decisórios do processo ${x.numeroProcesso}/${x.anoProcesso} (API JSON não documentada oficialmente)`,
          urlApi({ strNumeroProcesso: x.numeroProcesso, strAnoProcesso: x.anoProcesso }))
        : null,
    ].filter(Boolean),
    lacunas,
  };
  if (quem.tipo === 'governador') {
    item.parecer.contas_de = 'Governador do Estado do Amazonas';
    const { ressalvas, determinacoes, tituloRessalvas, temAcordao } = ressalvasEDeterminacoes(itensDispositivos(texto));
    // O PDF traz o parecer e o acórdão que é "parte integrante do Parecer Prévio"; os itens vêm dos dois.
    const ac = String(x.conteudo || '').replace(/\s+/g, ' ').match(/ACORDAO N[º°o]*\s*(\d{1,4}\/\d{4})[^(]{0,60}\(parte integrante do Parecer Previo/);
    const docItens = temAcordao ? `${docTitulo} e ${ac ? `Acórdão nº ${ac[1]}` : 'acórdão'} (parte integrante do parecer)` : docTitulo;
    item.parecer.ressalvas = ressalvas;
    if (ressalvas.length && pdf) item.parecer.ressalvas_fonte = { documento: docItens, url: pdf, trecho: tituloRessalvas };
    item.determinacoes_e_recomendacoes = determinacoes.length && pdf ? { documento: docItens, url: pdf, itens: determinacoes } : null;
    item.certidao_literal = c.conclusao_literal;
    item.id = `tce-am-contas-governador-${ex.exercicio}`;
    item.titulo = `Parecer prévio do Tribunal de Contas do Estado do Amazonas sobre as contas do Governador — exercício ${ex.exercicio}`;
    lacunas.push('Julgamento das contas pela Assembleia Legislativa do Estado do Amazonas (ALEAM) não localizado nos dados coletados');
  } else {
    lacunas.unshift('Ressalvas, determinações e multas do parecer não foram copiadas para este arquivo; ver o texto integral no PDF oficial');
  }
  return { tipo: quem.tipo, municipio_normalizado: quem.municipio_normalizado, item };
}

/** Completa os itens de um município (contas_de, id único, título) e ordena por exercício. */
export function fecharItensMunicipio(mun, itens) {
  const porEx = new Map();
  for (const it of itens) porEx.set(it.parecer.exercicio, (porEx.get(it.parecer.exercicio) || 0) + 1);
  return itens
    .map((it) => {
      const n = it.decisorio.numero;
      const dup = porEx.get(it.parecer.exercicio) > 1;
      const sufixo = dup ? `-pp-${n.replace('/', '-')}` : '';
      const lac = it.lacunas.filter((l) => !/^Julgamento das contas pela Câmara Municipal/.test(l) && !/^Há mais de um parecer prévio/.test(l));
      if (dup) lac.push(`Há mais de um parecer prévio da natureza "Prestação de Contas Anual" sobre o exercício ${it.parecer.exercicio} deste município (ex.: responsáveis diferentes no mesmo ano); cada um aparece separado`);
      lac.push(`Julgamento das contas pela Câmara Municipal de ${mun.nome} não localizado nos dados coletados`);
      return {
        ...it,
        id: `tce-am-contas-prefeito-${mun.id}-${it.parecer.exercicio}${sufixo}`,
        titulo: `Parecer Prévio nº ${n} do Tribunal de Contas do Estado do Amazonas sobre as contas do Prefeito de ${mun.nome} — exercício ${it.parecer.exercicio}`,
        parecer: { ...it.parecer, contas_de: `Prefeito de ${mun.nome}` },
        lacunas: lac,
      };
    })
    .sort((a, b) => a.parecer.exercicio.localeCompare(b.parecer.exercicio) || a.decisorio.numero.localeCompare(b.decisorio.numero, 'pt-BR', { numeric: true }));
}

export function arquivoMunicipio(mun, itens, fonteBase) {
  const ex = itens.map((i) => Number(i.parecer.exercicio));
  return {
    atualizado_em: new Date().toISOString(),
    municipio: { id: mun.id, nome: mun.nome, uf: 'AM', codigo_ibge: mun.codigo_ibge },
    tribunal: 'tce-am',
    periodo: { inicio: Math.min(...ex), fim: Math.max(...ex) },
    contagens: {
      exercicios: new Set(ex).size,
      pareceres: itens.length,
      com_parecer_em_fonte_aberta: itens.filter((i) => i.parecer.conclusao).length,
      sem_fonte_aberta: itens.filter((i) => !i.parecer.conclusao).length,
    },
    fontes: [fonteBase],
    observacoes: [
      'Só aparecem os exercícios com parecer prévio publicado no Banco de Jurisprudência do TCE-AM (tipo "Parecer Prévio", natureza "Prestação de Contas Anual"). Exercício ausente aqui não quer dizer que as contas não foram julgadas.',
      '"Conclusão" resume a fórmula escrita no parecer ("recomendando … a aprovação", "a desaprovação"); o trecho literal está em conclusao_literal. Sem fórmula reconhecida, a conclusão fica vazia.',
      'O município é identificado pelo nome exato do órgão na API ("Prefeitura Municipal de …"), comparado sem acentos com a lista oficial de municípios do Siconfi (Tesouro Nacional).',
    ],
    itens,
  };
}

/** Entre vários pareceres do Governador para o mesmo exercício, fica o de sessão mais recente; os outros viram lacuna. */
export function escolherGovernador(itens) {
  const ord = [...itens].sort((a, b) => (b.data_julgamento ?? '').localeCompare(a.data_julgamento ?? ''));
  const [esc, ...outros] = ord;
  if (!outros.length) return esc;
  return {
    ...esc,
    lacunas: [...esc.lacunas.filter((l) => !/^Há outro\(s\) parecer/.test(l)), `Há outro(s) parecer(es) prévio(s) sobre o mesmo exercício no Banco de Jurisprudência: ${outros.map((o) => `nº ${o.decisorio.numero}`).join(', ')}; exibido o de sessão mais recente`],
  };
}
