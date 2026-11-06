// Montagem dos arquivos do site a partir do índice de pareceres lidos (pareceres.json):
//   contas-governador/<exercicio>.json  um parecer prévio por exercício (contas do Governador)
//   contas-prefeitos/<municipio>.json   pareceres sobre as contas de governo de cada prefeitura, por exercício
// Pareceres sobre contas de gestão e tomadas de contas especiais sem menção a contas de governo ficam em
// "outros_pareceres" (guardados, ainda não exibidos). Parecer sem exercício escrito fica em "itens_sem_exercicio".
import { fonte, hojeISO, normalizar } from './lib.mjs';
import { URL_PAGINA } from './fonte.mjs';

export const NOME_TRIBUNAL = 'Tribunal de Contas do Estado de Roraima';
export const ASSEMBLEIA = 'Assembleia Legislativa do Estado de Roraima';
const TIPOS_GOVERNO = new Set(['governo', 'governo-e-gestao', 'prestacao-de-contas']);

/** Parecer sobre contas de governo (anuais) do chefe do Executivo? */
export function eContasDeGoverno(lei) {
  if (TIPOS_GOVERNO.has(lei.tipo_contas)) return true;
  return lei.tipo_contas === 'tomada-de-contas-especial' && /\bgoverno\b/.test(normalizar(lei.assunto)) && !/\bgestao\b/.test(normalizar(lei.assunto).replace(/gestao fiscal/g, ''));
}

const ROTULO_TIPO = {
  governo: 'as contas de governo',
  'governo-e-gestao': 'as contas de governo e de gestão',
  'prestacao-de-contas': 'a prestação de contas',
  gestao: 'as contas de gestão',
  'tomada-de-contas-especial': 'a tomada de contas especial',
};

/** Item no formato ParecerPrevioTce (web/src/features/tribunais-contas/tipos.ts). */
export function itemDe(del, lei, { contasDe, casa, urlConsulta }) {
  const lacunas = [];
  for (const a of lei.anotacoes_literal || []) lacunas.push(`O documento oficial traz a anotação: “${a}”`);
  lacunas.push(...(lei.lacunas_leitura || []));
  if (lei.divergencia) lacunas.push(`O exercício foi lido no ${lei.exercicio_fonte}; outra parte do texto menciona outro ano (${lei.divergencia})`);
  if (!lei.data_sessao) {
    lacunas.push(lei.sessao_literal
      ? `A data da sessão está escrita como “${lei.sessao_literal}”; o dia exato do julgamento não foi informado`
      : 'Data da sessão de julgamento não localizada no texto do parecer');
  }
  if (!lei.data_publicacao) lacunas.push('Data de publicação no diário oficial não localizada no topo do documento');
  if (!lei.relator) lacunas.push('Relator não localizado no cabeçalho do parecer');
  if (lei.truncado) lacunas.push('O documento é muito grande; foi lido só o início, onde ficam o cabeçalho, a ementa e a decisão');
  lacunas.push('Ressalvas, determinações e recomendações não foram copiadas; estão no texto do parecer (link oficial)');
  lacunas.push('Votação (unanimidade ou maioria) e votos de cada conselheiro não foram copiados');
  lacunas.push('Data do trânsito em julgado não informada');
  lacunas.push(`Julgamento das contas pela ${casa} não localizado nos dados coletados`);
  const doc = { titulo: `Parecer Prévio nº ${del.numero} — texto oficial no SEI do TCE-RR`, url: del.url };
  return {
    id: `tce-rr-parecer-previo-${del.id}`,
    tribunal: 'tce-rr',
    natureza: 'parecer-previo',
    titulo: `Parecer Prévio nº ${del.numero} do ${NOME_TRIBUNAL} sobre ${ROTULO_TIPO[lei.tipo_contas] ?? 'as contas'} ${contasDe}${lei.exercicio ? ` — exercício ${lei.exercicio}` : ''}`,
    numero: del.numero,
    processo: { classe: lei.assunto ?? null, numero: lei.processo ?? null, url: null },
    tipo_contas: lei.tipo_contas ?? null,
    unidade_jurisdicionada_literal: lei.orgao ?? null,
    orgao: del.colegiado,
    sessao_literal: lei.sessao_literal ?? null,
    relator: lei.relator ?? null,
    data_julgamento: lei.data_sessao ?? null,
    data_publicacao: lei.data_publicacao ?? null,
    data_transito_em_julgado: null,
    publicacao_literal: lei.publicacao_literal?.length ? lei.publicacao_literal : null,
    responsaveis_literal: lei.responsavel ? [lei.responsavel] : [],
    parecer: {
      conclusao: lei.conclusao ?? null,
      conclusao_literal: lei.conclusao_literal ?? null,
      ressalvas: [],
      alertas: [],
      contas_de: contasDe.replace(/^d[oa]s?\s+/, ''),
      exercicio: lei.exercicio ? String(lei.exercicio) : null,
      documento: doc,
    },
    ementa_literal: lei.ementa ?? null,
    julgamento_politico: null,
    documentos: [doc],
    situacao_conferencia: 'automatico-texto',
    coletado_em: lei.lido_em ?? hojeISO(),
    fontes: [
      fonte('Portal da Transparência do TCE-RR — Decisões e Acórdãos, série “Parecer Prévio” (lista oficial)', URL_PAGINA),
      { ...fonte(`Parecer Prévio nº ${del.numero} (texto oficial no SEI do TCE-RR)`, del.url), observacao: `Consulta da lista: ${urlConsulta}` },
    ],
    lacunas: [...new Set(lacunas)],
  };
}

const ordem = (a, b) => (b.parecer.exercicio ?? '').localeCompare(a.parecer.exercicio ?? '')
  || (b.data_julgamento ?? b.data_publicacao ?? '').localeCompare(a.data_julgamento ?? a.data_publicacao ?? '')
  || a.id.localeCompare(b.id);

/** Resumo curto de um parecer guardado fora da lista principal. */
function resumoOutro(it) {
  return { id: it.id, numero: it.numero, tipo_contas: it.tipo_contas, assunto_literal: it.processo.classe, exercicio: it.parecer.exercicio, conclusao: it.parecer.conclusao, conclusao_literal: it.parecer.conclusao_literal, data_julgamento: it.data_julgamento, colegiado: it.orgao, url: it.parecer.documento.url };
}

/** Arquivos do Governador por exercício. entradas: [{ del, lei }] já filtradas para o Governo do Estado. */
export function montarGovernador(entradas, urlConsulta) {
  const porAno = new Map();
  const semExercicio = [];
  for (const { del, lei } of entradas) {
    const it = itemDe(del, lei, { contasDe: 'do Governador de Roraima', casa: ASSEMBLEIA, urlConsulta });
    if (!lei.exercicio) { semExercicio.push(it); continue; }
    if (!porAno.has(lei.exercicio)) porAno.set(lei.exercicio, []);
    porAno.get(lei.exercicio).push({ it, governo: eContasDeGoverno(lei) });
  }
  const arquivos = new Map();
  for (const [ano, lista] of porAno) {
    const gov = lista.filter((x) => x.governo).map((x) => x.it).sort(ordem);
    const resto = lista.filter((x) => !x.governo).map((x) => x.it).sort(ordem);
    if (!gov.length) continue; // só contas de gestão: guardadas em meta.json, sem página de exercício
    const [principal, ...outros] = gov;
    const extra = [...outros, ...resto];
    if (extra.length) {
      principal.outros_pareceres = extra.map(resumoOutro);
      principal.lacunas.unshift(`Há ${extra.length === 1 ? 'outro parecer prévio' : `outros ${extra.length} pareceres prévios`} do TCE-RR sobre o exercício ${ano} (${extra.map((x) => `nº ${x.numero}`).join(', ')}); a página mostra o de julgamento mais recente sobre as contas de governo e os demais estão em “outros_pareceres”`);
    }
    arquivos.set(ano, principal);
  }
  const fora = [...porAno.values()].flat().filter((x) => !x.governo && !arquivos.has(Number(x.it.parecer.exercicio))).map((x) => resumoOutro(x.it));
  return { arquivos, semExercicio: semExercicio.map(resumoOutro), fora };
}

/** Arquivo de um município (formato ContasPrefeitos). entradas: [{ del, lei }] do município. */
export function montarMunicipio(mun, entradas, urlConsulta, anoFim) {
  const casa = `Câmara Municipal de ${mun.nome}`;
  const itens = [];
  const outros = [];
  const semEx = [];
  for (const { del, lei } of entradas) {
    const it = itemDe(del, lei, { contasDe: `do Prefeito de ${mun.nome}`, casa, urlConsulta });
    if (!eContasDeGoverno(lei)) outros.push(it);
    else if (!lei.exercicio) semEx.push(it);
    else itens.push(it);
  }
  itens.sort(ordem);
  outros.sort(ordem);
  const anos = [...new Set(itens.map((i) => Number(i.parecer.exercicio)))].sort((a, b) => a - b);
  const inicio = anos.length ? anos[0] : null;
  const faltam = [];
  for (let a = inicio ?? anoFim + 1; a <= anoFim; a++) if (!anos.includes(a)) faltam.push(a);
  return {
    atualizado_em: new Date().toISOString(),
    municipio: { id: mun.id, nome: mun.nome, uf: 'RR', codigo_ibge: mun.codigo_ibge },
    tribunal: 'tce-rr',
    periodo: anos.length ? { inicio, fim: anos[anos.length - 1] } : null,
    contagens: {
      exercicios: anos.length,
      pareceres: itens.length,
      com_parecer_em_fonte_aberta: itens.filter((i) => i.parecer.conclusao).length,
      sem_fonte_aberta: itens.filter((i) => !i.parecer.conclusao).length,
      exercicios_sem_parecer_na_serie: faltam.length,
      outros_pareceres: outros.length,
      itens_sem_exercicio: semEx.length,
    },
    exercicios_sem_parecer_na_serie: faltam,
    fontes: [fonte('Portal da Transparência do TCE-RR — Decisões e Acórdãos, série “Parecer Prévio”', URL_PAGINA)],
    observacoes: [
      'Só aparecem os exercícios com parecer prévio sobre as contas de governo da Prefeitura na série “Parecer Prévio” do Portal da Transparência do TCE-RR. Exercício ausente não quer dizer que as contas não foram analisadas.',
      '“Conclusão” resume a fórmula escrita na ementa ou na decisão do parecer (“pela irregularidade das contas”, “regulares com ressalvas”, “prescrição”); o trecho literal está em conclusao_literal. Sem fórmula reconhecida, ou com duas fórmulas diferentes, a conclusão fica vazia.',
      `O município é identificado pelo nome escrito no campo “Órgão” do parecer, comparado sem acentos com a lista oficial de municípios do Siconfi (Tesouro Nacional); grafias diferentes não são ligadas.`,
      'Pareceres sobre contas de gestão, tomadas de contas e tomadas de contas especiais ficam em “outros_pareceres” (guardados, ainda não exibidos).',
      `O julgamento das contas é feito pela ${casa}; ainda não coletado.`,
    ],
    itens,
    outros_pareceres: outros,
    itens_sem_exercicio: semEx,
  };
}
