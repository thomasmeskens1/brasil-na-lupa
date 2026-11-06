// Monta o registro de um exercício (contrato de dados/tribunais-contas/<orgao>/contas-governador/AAAA.json, o mesmo
// lido por web/src/features/tribunais-contas) a partir da página do exercício e da leitura da ata no PDF. Funções puras.
import { fonte, HOST } from './lib.mjs';

export const NOME_TRIBUNAL = 'Tribunal de Contas do Distrito Federal';
const CASA = 'Câmara Legislativa do Distrito Federal (CLDF)';

/** Motivo (texto simples) para um exercício que não ganha página no site. null = publicável. */
export function motivoNaoPublicar(pagina, leitura) {
  if (!pagina.rapp) return 'a página do exercício não traz o PDF do Relatório Analítico e Parecer Prévio';
  if (!leitura) return 'PDF ainda não lido (a leitura continua nas próximas execuções)';
  if (leitura.situacao === 'erro') return `PDF não lido (${leitura.erro})`;
  if (leitura.situacao === 'ilegivel') return 'PDF digitalizado sem texto legível por máquina';
  if (leitura.situacao === 'sem_proclamacao') return 'proclamação da decisão da Sessão Especial não localizada no texto do PDF';
  const a = leitura.ata;
  if (!a) return 'leitura sem resultado';
  if (a.exercicio !== pagina.exercicio) return `a proclamação no PDF cita o exercício de ${a.exercicio}, diferente do título da página`;
  if (!(a.sessao?.data ?? a.ato?.data)) return 'data da Sessão Especial não localizada no texto do PDF';
  return null;
}

function documentos(pagina) {
  const docs = pagina.documentos.map((d) => ({
    titulo: d.tipo === 'relatorio' ? `${d.titulo} — Relatório Analítico e Parecer Prévio (PDF)` : `${d.titulo} (PDF)`,
    url: d.url,
  }));
  docs.push({ titulo: `Página "${pagina.titulo_literal}" no site do TCDF`, url: pagina.url });
  return docs;
}

/** Registro do exercício (só chamado quando motivoNaoPublicar(...) é null). */
export function montarItem(pagina, leitura, urlApi) {
  const ano = pagina.exercicio;
  const a = leitura.ata;
  const docRapp = { titulo: `${pagina.rapp.titulo} — Relatório Analítico e Parecer Prévio (PDF)`, url: pagina.rapp.url };
  const data = a.sessao?.data ?? a.ato?.data;
  const sessaoNum = a.sessao?.numero ?? a.ato?.sessao ?? null;
  const decreto = pagina.documentos.filter((d) => d.tipo === 'decreto-legislativo');
  const lacunas = [];
  if (!a.conclusao_literal) lacunas.push('Texto do parecer ("é de parecer que ...") não localizado de forma literal na ata da Sessão Especial publicada no PDF; vale a proclamação da decisão, reproduzida no texto da decisão');
  else if (a.conclusao_fonte === 'votos') lacunas.push('A ata publicada no PDF não transcreve o parecer; a conclusão exibida é a frase da ata que registra os votos dos conselheiros');
  if (/\bII\.\s/.test(a.conclusao_literal ?? '')) lacunas.push('O parecer tem mais de um item (responsáveis por períodos diferentes do exercício); a conclusão de cada item está no texto oficial');
  if (!a.votacao) lacunas.push('Resultado da votação (unanimidade ou maioria) não localizado no trecho lido da ata');
  if (!a.processo && !a.ato?.processo) lacunas.push('Número do processo não localizado no trecho lido da ata');
  if (!a.ato) lacunas.push('Número da decisão não localizado no PDF; a data e a sessão vêm da ata da Sessão Especial');
  if (a.conclusao_literal && !a.ressalvas.length && /ressalva/i.test(a.conclusao_literal)) lacunas.push('O parecer cita ressalvas, mas a lista não foi separada de forma literal no texto do PDF');
  if (pagina.sobrestado) lacunas.push(`Observação da página do exercício: "${pagina.sobrestado}"`);
  lacunas.push(
    decreto.length
      ? `Julgamento das contas pela ${CASA} não coletado; a página do exercício traz o link do Decreto Legislativo (em Documentos), que não é lido pelo coletor`
      : `Julgamento das contas pela ${CASA} não localizado nos dados coletados`,
  );
  const det = [...a.determinacoes.map((t) => ({ texto: t, grupo: 'Determinações' })), ...a.recomendacoes.map((t) => ({ texto: t, grupo: 'Recomendações' }))];
  const relatorRegistros = [{ texto: pagina.titulo_literal, documento: 'Título da página do exercício no site do TCDF', url: pagina.url }];
  if (a.ato?.relator_literal) relatorRegistros.push({ texto: a.ato.relator_literal, documento: `Decisão nº ${a.ato.numero} (ata no PDF do relatório)`, url: pagina.rapp.url });
  return {
    id: `tc-df-contas-governador-${ano}`,
    tribunal: 'tc-df',
    natureza: 'parecer-previo',
    titulo: `Parecer prévio do ${NOME_TRIBUNAL} sobre as contas do Governo do Distrito Federal — exercício ${ano}`,
    ato: a.ato ? { tipo: 'Decisão', numero: a.ato.numero, titulo_oficial: `Decisão nº ${a.ato.numero}`, ementa_literal: a.ato.ementa } : null,
    processo: { classe: 'Relatório Analítico e Parecer Prévio sobre as Contas do Governo do Distrito Federal', numero: a.ato?.processo ?? a.processo ?? null, url: null },
    orgao: null,
    sessao: sessaoNum,
    sessao_literal: a.sessao?.literal ?? (a.ato ? `Sessão Especial Nº ${a.ato.sessao}` : null),
    relator: pagina.relator,
    relator_registros: relatorRegistros,
    data_julgamento: data,
    data_publicacao: null,
    data_transito_em_julgado: null,
    votacao_literal: a.votacao,
    proclamacao_literal: a.proclamacao,
    certidao_literal: a.decisao ?? a.proclamacao,
    responsaveis_literal: a.responsaveis,
    parecer: {
      conclusao: a.conclusao,
      com_ressalvas: a.com_ressalvas,
      conclusao_literal: a.conclusao_literal,
      conclusao_fonte: a.conclusao_fonte === 'decisao' ? 'Texto da decisão proclamada na ata da Sessão Especial (PDF)' : a.conclusao_fonte === 'votos' ? 'Frase da ata da Sessão Especial que registra os votos (PDF)' : null,
      ressalvas: a.ressalvas,
      ressalvas_fonte: a.ressalvas.length ? { documento: `Ata da Sessão Especial${sessaoNum ? ` nº ${sessaoNum}` : ''} — texto da decisão`, url: pagina.rapp.url } : null,
      alertas: [],
      contas_de: 'Governo do Distrito Federal',
      exercicio: ano,
      documento: docRapp,
    },
    determinacoes_e_recomendacoes: det.length ? { documento: `Ata da Sessão Especial${sessaoNum ? ` nº ${sessaoNum}` : ''} — texto da decisão`, url: pagina.rapp.url, itens: det } : null,
    julgamento_politico: null,
    documentos: documentos(pagina),
    leitura_pdf: { situacao: leitura.situacao, versao: leitura.versao, lido_em: leitura.lido_em, sha256: leitura.sha256, bytes: leitura.bytes, paginas: leitura.paginas },
    situacao_conferencia: 'automatico-estruturado',
    coletado_em: leitura.lido_em,
    fontes: [
      fonte(`Página "${pagina.titulo_literal}" — site do TCDF (API do WordPress do site)`, urlApi),
      fonte(`${pagina.rapp.titulo} — Relatório Analítico e Parecer Prévio (PDF, com a ata da Sessão Especial)`, pagina.rapp.url, leitura.lido_em),
    ],
    lacunas,
  };
}

export const urlPost = (id) => `https://${HOST}/wp-json/wp/v2/posts/${id}`;
