// meta.json do TCM-PA: execução, contagens, fontes, regras de acesso e lacunas verificadas na coleta.
import { HOST, estatisticas, fonte } from './lib.mjs';
import { URL_LISTA, URL_PAGINA_DOE } from './edicoes.mjs';

const brev = (r) => ({ numero: r.numero, municipio_literal: r.municipio_literal, exercicio: r.exercicio ?? null, motivo: r.motivo ?? null, edicao: r.edicao, data_publicacao: r.data_publicacao, url: r.url, transcricao: !!r.transcricao, municipio: r.municipio, bruto: r.bruto });

/** Números de edição que faltam na lista do site entre a menor e a maior lidas. */
function faltando(edicoes) {
  const nums = new Set(edicoes.map((e) => Number(e.numero)).filter(Number.isFinite));
  if (!nums.size) return { menor: null, maior: null, faltam: [] };
  const menor = Math.min(...nums);
  const maior = Math.max(...nums);
  const faltam = [];
  for (let n = menor; n <= maior; n++) if (!nums.has(n)) faltam.push(n);
  return { menor, maior, faltam };
}

export function montarMeta({ estado, municipios, porMun, edicoes, inicio, robots, interrompidoPor, args, leitor, lidasNestaExecucao }) {
  const itens = [...estado.itens.values()];
  const lidas = edicoes.filter((e) => e.situacao === 'lida');
  const pendentes = edicoes.filter((e) => e.situacao === 'pendente');
  const comErro = edicoes.filter((e) => e.situacao === 'erro' || e.situacao === 'indisponivel');
  const br = (d) => d.split('-').reverse().join('/');
  const todas = edicoes.map((e) => e.data).sort();
  // Períodos de mais de 60 dias sem nenhuma edição na lista.
  const vaos = [];
  for (let i = 1; i < todas.length; i++) if ((Date.parse(todas[i]) - Date.parse(todas[i - 1])) / 864e5 > 60) vaos.push([todas[i - 1], todas[i]]);
  const f = faltando(edicoes);
  const porExercicio = {};
  for (const it of itens) porExercicio[it.parecer.exercicio] = (porExercicio[it.parecer.exercicio] || 0) + 1;
  const semParecer = municipios.lista.filter((m) => !porMun.has(m.id)).map((m) => m.nome);
  const naoCasados = [...estado.naoCasados.values()].map(brev).sort((a, b) => a.numero.localeCompare(b.numero));
  const semExercicio = [...estado.semExercicio.values()].map(brev).sort((a, b) => a.numero.localeCompare(b.numero));
  const nomesNaoCasados = {};
  for (const r of naoCasados) nomesNaoCasados[r.municipio_literal || '(sem município escrito)'] = (nomesNaoCasados[r.municipio_literal || '(sem município escrito)'] || 0) + 1;

  const lacunas = [
    'O TCM-PA não emite parecer sobre as contas do Governador do Pará (competência do TCE-PA)',
    `O site lista as edições oficiais do Diário Oficial Eletrônico ${f.menor ? `nº ${f.menor} a nº ${f.maior}` : ''}${todas.length ? ` (${br(todas[0])} a ${br(todas[todas.length - 1])})` : ''}; as edições oficiais anteriores (a versão oficial começa em 12/12/2016) não aparecem na lista e nenhuma edição posterior está publicada nela`,
    ...vaos.map(([a, b]) => `Nenhuma edição na lista do site entre ${br(a)} e ${br(b)}; resoluções publicadas nesse período não foram lidas`),
    f.faltam.length ? `${f.faltam.length} números de edição entre nº ${f.menor} e nº ${f.maior} não aparecem na lista do site` : null,
    comErro.length ? `${comErro.length} edições listadas não puderam ser baixadas (ver edicoes.json)` : null,
    semExercicio.length ? `${semExercicio.length} resoluções de parecer prévio sem exercício escrito (ou com exercícios diferentes no texto) não são exibidas` : null,
    naoCasados.length ? `${naoCasados.length} resoluções com nome de município que não confere exatamente com a lista oficial não são exibidas` : null,
    semParecer.length ? `${semParecer.length} municípios sem nenhuma resolução de parecer prévio localizada nas edições lidas` : null,
    'Ressalvas, multas e determinações não são separadas do texto da resolução',
    'Julgamento das contas pelas Câmaras Municipais não coletado',
    'Consulta de processos (SPE) não acessada: exige reCAPTCHA; atos oficiais em atosoficiais.com.br não acessados: desafio anti-robô',
  ].filter(Boolean);

  return {
    atualizado_em: new Date().toISOString(),
    ultima_execucao: new Date().toISOString(),
    tribunal: 'tcm-pa',
    modo: args?.reprocessar ? 'reprocessamento do cache' : args?.completo ? 'completo' : 'incremental',
    interrompido_por: interrompidoPor || null,
    leitor_pdf_disponivel: leitor ?? null,
    fontes: [
      fonte('Diário Oficial Eletrônico — Tribunal de Contas dos Municípios do Pará', URL_PAGINA_DOE),
      fonte('Calendário DOE TCM-PA (lista de edições em PDF)', URL_LISTA),
    ],
    robots_e_restricoes: [
      `robots.txt de ${HOST} lido no início de cada execução${robots ? ` (HTTP ${robots.status})` : ''}: o grupo "User-agent: *" permite tudo ("Allow: /")${robots?.sinal ? ` e traz "Content-Signal: ${robots.sinal}"` : ''}; o coletor se identifica como BrasilNaLupa-coletor e só republica informação oficial com link para a fonte.`,
      'Uma requisição por vez, pausa mínima de 1,5 s; robots.txt inacessível interrompe a coleta.',
      'Não acessados: a consulta de processos (spe.tcm.pa.gov.br, com reCAPTCHA) e atosoficiais.com.br (desafio anti-robô).',
      'O CPF de pessoas citado nas resoluções é retirado de todo texto republicado.',
    ],
    observacoes: [
      'Um item por resolução de parecer prévio sobre a prestação de contas de governo de uma Prefeitura. Exercício, conclusão, processo, relator e datas vêm do texto publicado.',
      'Quando a mesma resolução aparece em mais de uma edição (republicação ou transcrição dentro de outro ato), vale a publicação própria mais antiga.',
      'Recursos contra parecer prévio entram como item próprio quando a decisão do recurso fala do parecer prévio.',
    ],
    lacunas,
    contagens: {
      edicoes_listadas: edicoes.length,
      edicoes_lidas: lidas.length,
      edicoes_pendentes: pendentes.length,
      edicoes_com_erro: comErro.length,
      edicoes_lidas_nesta_execucao: lidasNestaExecucao ?? 0,
      numeros_de_edicao_ausentes_na_lista: f.faltam.length,
      resolucoes_exibidas: itens.length,
      resolucoes_sem_exercicio: semExercicio.length,
      resolucoes_municipio_nao_casado: naoCasados.length,
      resolucoes_de_recurso: itens.filter((i) => i.recurso).length,
      resolucoes_lidas_de_transcricao: itens.filter((i) => i.publicacao?.transcricao).length,
      com_conclusao: itens.filter((i) => i.parecer.conclusao).length,
      sem_data_de_julgamento: itens.filter((i) => !i.data_julgamento).length,
      sem_processo: itens.filter((i) => !i.processo?.numero).length,
      municipios: municipios.lista.length,
      municipios_com_parecer: porMun.size,
      municipios_sem_parecer: semParecer.length,
      por_exercicio: Object.fromEntries(Object.entries(porExercicio).sort()),
      blocos_descartados: estado.descartes,
    },
    municipios_sem_parecer: semParecer,
    nomes_nao_casados: nomesNaoCasados,
    pareceres_sem_exercicio: semExercicio,
    pareceres_municipio_nao_casado: naoCasados,
    numeros_de_edicao_ausentes_na_lista: f.faltam,
    duracao_s: Math.round((Date.now() - inicio) / 1000),
    estatisticas_http: { requisicoes: estatisticas.requisicoes, retentativas: estatisticas.retentativas, bytes: estatisticas.bytes, falhas: estatisticas.falhas.slice(0, 20) },
  };
}
