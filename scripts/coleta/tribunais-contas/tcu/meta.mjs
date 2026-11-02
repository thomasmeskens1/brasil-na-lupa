// meta.json do TCU: contagens, fontes, restrições de acesso respeitadas, conferência e lacunas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, ANO_INICIAL, anomalias } from './acordaos.mjs';
import { SENADO } from './congresso.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/** Conferência amostral feita por pessoa/agente contra o inteiro teor oficial (arquivo estático, ver conferencia.json). */
function lerConferencia() {
  try { return JSON.parse(fs.readFileSync(path.join(AQUI, 'conferencia.json'), 'utf8')); } catch { return null; }
}

export function montarMeta(x) {
  const total = Object.values(x.contagensAno).reduce((s, c) => s + c.total, 0);
  return {
    atualizado_em: x.hoje,
    tribunal: 'tcu',
    orgao: {
      id: 'tcu',
      nome: 'Tribunal de Contas da União',
      esfera: 'federal',
      uf: null,
      jurisdiciona: 'União',
      situacao_coleta: 'ativa',
    },
    // Dados da execução: não contam como mudança de conteúdo (o arquivo só é regravado quando o resto muda).
    ultima_execucao: {
      data: x.hoje, modo: x.modo, paginas_lidas: x.leitura.paginas, leitura_chegou_ao_fim: x.leitura.completo, duracao_s: x.duracao_s,
      registros_lidos: x.leitura.registros.length,
      novos: x.novos,
      atualizados: x.atualizados,
      anteriores_ao_periodo_descartados: x.foraDoPeriodo,
      repetidos_entre_paginas: x.duplicados,
      ...(x.ausentesNaLeitura !== null ? { gravados_que_nao_vieram_na_leitura_completa: x.ausentesNaLeitura } : {}),
      paginas_rejeitadas_por_resposta_misturada: anomalias.paginas_rejeitadas,
      exemplos_de_rejeicao: anomalias.exemplos,
      http: { requisicoes: x.estatisticas.requisicoes, retentativas: x.estatisticas.retentativas, bytes: x.estatisticas.bytes, por_host: x.estatisticas.por_host },
    },
    periodo: `acórdãos de ${ANO_INICIAL} em diante (ano do acórdão)`,
    contagens: {
      acordaos: total,
      por_ano: x.contagensAno,
      julgamentos_das_colecoes: Object.fromEntries(Object.entries(x.colecoesMeta).map(([k, v]) => [k, v.itens.length])),
      sumarios_omitidos_por_trazerem_nomes_de_particulares: x.privacidade.omitidos.length,
      sumarios_com_documento_pessoal_trocado: x.privacidade.com_documento_trocado,
    },
    colecoes: x.colecoesMeta,
    sumarios_omitidos: x.privacidade.omitidos,
    fontes: [
      { titulo: 'API de dados abertos do TCU — acórdãos (recupera-acordaos)', url: API, orgao: 'Tribunal de Contas da União', acessado_em: x.hoje },
      { titulo: 'Dados Abertos do Senado Federal — processos (MCN das contas do Presidente)', url: `${SENADO}/processo?sigla=MCN`, orgao: 'Senado Federal / Congresso Nacional', acessado_em: x.hoje },
    ],
    restricoes_respeitadas: [
      'Só a API de dados abertos do TCU (dados-abertos.apps.tcu.gov.br) é usada para o TCU; o coletor recusa qualquer host fora da lista antes de fazer a requisição.',
      'sites.tcu.gov.br não é acessado: o robots.txt desse host proíbe robôs de inteligência artificial pelo nome (GPTBot, ClaudeBot, anthropic-ai e outros). Por isso os arquivos anuais de jurisprudência (com processo, assunto, quórum, vencidos e votos) e os hotsites das Contas do Presidente não são lidos.',
      'pesquisa.apps.tcu.gov.br (pesquisa integrada) não é acessado: o firewall de aplicações do TCU bloqueia robôs. Não há contorno.',
      'Listas de responsáveis com contas julgadas irregulares, inabilitados e inidôneos (certidoes.apps.tcu.gov.br) não são coletadas nem republicadas: trazem CPF e nomes de particulares.',
      'Diretriz 12: a API não traz partes, interessados nem responsáveis. Quando o campo sumário da fonte traz, por erro, a lista de partes ou de advogados (nome com CPF mascarado, inscrição na OAB, "Representação legal:", "Recorrente:"), o sumário inteiro é omitido e o item recebe um aviso; CPF/RG com número em qualquer outro sumário vira "[documento pessoal omitido]". Ministros aparecem só como relatores, com o nome que a API traz.',
      'robots.txt de cada host lido antes do primeiro acesso; no máximo 2 requisições simultâneas; User-Agent identificável.',
    ],
    robots: x.robots,
    lacunas: [
      'Processo e assunto: a API não traz (null em todos os itens).',
      'Resultado da votação (unanimidade/maioria), ministros presentes, vencidos, voto de desempate, revisor, redator e declarações de voto: o campo estruturado "QUORUM" e os demais só existem no arquivo anual de jurisprudência em sites.tcu.gov.br, que não é acessado. Nos arquivos "julgamento" ficam vazios/null com lacuna, salvo se a expressão aparecer literalmente no sumário da API.',
      'Sessão ordinária ou extraordinária: a API não informa.',
      'Texto da decisão (dispositivo "ACORDAM…"): a API não traz; o inteiro teor está no link "url_pdf".',
      'Sumário vazio nos "ACÓRDÃO DE RELAÇÃO" (cerca de dois terços do total): vazio na fonte.',
      'Leitura incremental: um acórdão já gravado que mude na API depois (ex.: sumário corrigido) só é atualizado se estiver na página lida ou na próxima leitura com --completo.',
    ],
    observacoes: [
      'Defeito observado na fonte em 02/11/2026: com requisições simultâneas (nossas ou de outros usuários), a API devolve páginas misturadas com registros de outras páginas (ex.: pedido de 500 devolveu 520 ou 1500; uma página de 2026 veio com 1000 acórdãos de 2019). O coletor pede uma página por vez, confere tamanho, KEYs repetidas e continuidade (cada página começa pelo último registro da anterior) e repete a página rejeitada.',
      'Os campos "processo" e "assunto" ficam null em todos os itens do índice porque a API não os traz.',
      'Nomes de ministros relatores aparecem como a API os grava (em maiúsculas).',
    ],
    conferencia_amostral: lerConferencia(),
    divergencias: x.divergencias,
    falhas: [...x.falhas, ...x.estatisticas.falhas],
    comando_diario: 'node scripts/coleta/tribunais-contas/tcu/coletar.mjs',
  };
}
