// Votos do Plenário Virtual (JSON de sistemas.stf.jus.br/repgeral/votacao).
// Regras (docs/pesquisa/fontes-stf.md, seção 3):
//  - só a ÚLTIMA lista de julgamento de cada incidente é usada (listas antigas repetem votos de sessões posteriores);
//  - o campo "julgado" não é confiável e não é usado;
//  - voto com data posterior ao fim da sessão (cópia de outra sessão) ou anterior ao início (sem "voto antecipado") é descartado;
//  - o relator não aparece entre os votos da lista: fica no campo relator, com o link do voto, sem voto atribuído;
//  - código do ministro conferido com dados/stf/ministros.json (nome do Plenário Virtual = nome da composição).
import { dataISO, normalizarEspacos, chaveNome } from './lib.mjs';
import { urlVotacaoSessaoVirtual, urlPlenarioVirtualTema, PORTAL } from './fontes.mjs';

const d = (s) => dataISO(s);

/** Item da resposta que corresponde ao incidente, e suas listas em ordem cronológica. */
export function listasDoIncidente(resposta, incidente) {
  const item = resposta.find((x) => String(x?.objetoIncidente?.id) === String(incidente)) ?? null;
  const listas = (item?.listasJulgamento ?? []).filter((l) => l?.sessao)
    .sort((a, b) => (d(a.sessao.dataInicio) ?? '').localeCompare(d(b.sessao.dataInicio) ?? '') || a.id - b.id);
  return { identificacao: item?.objetoIncidente?.identificacao ?? null, listas };
}

/** Registra códigos vistos (para ministros.json): Map codigo → { descricao, visto_em:Set }. */
export function registrarCodigos(codigos, listas, onde) {
  const conflitos = [];
  const add = (m) => {
    if (!m?.codigo || !m?.descricao || !/^MIN\. /.test(m.descricao)) return;
    const desc = normalizarEspacos(m.descricao);
    const atual = codigos.get(String(m.codigo));
    if (!atual) codigos.set(String(m.codigo), { descricao: desc, visto_em: new Set([onde]) });
    else if (chaveNome(atual.descricao) !== chaveNome(desc)) conflitos.push(`código ${m.codigo}: "${atual.descricao}" × "${desc}" (${onde})`);
    else atual.visto_em.add(onde);
  };
  for (const l of listas) {
    add(l.ministroRelator); add(l.ministroVista); add(l.ministroDestaque);
    for (const v of l.votos || []) { add(v.ministro); add(v.acompanhandoMinistro); }
  }
  return conflitos;
}

function conferirMinistro(m, indice) {
  const codigo = String(m.codigo);
  const reg = indice.porCodigo.get(codigo);
  if (!reg) return { ok: false, motivo: `código ${codigo} (${m.descricao}) não consta de ministros.json` };
  if (chaveNome(reg.descricao) !== chaveNome(m.descricao)) return { ok: false, motivo: `código ${codigo}: "${m.descricao}" difere de ministros.json ("${reg.descricao}")` };
  return { ok: true, nome: reg.nome };
}

/**
 * Votos da lista escolhida. Retorna { votacao, descartados, problemas }.
 * votacao segue o esquema "julgamento.votacoes[]", com origem "plenario-virtual".
 */
export function votacaoDaLista(lista, { incidente, indice }) {
  const ini = d(lista.sessao.dataInicio), fim = d(lista.sessao.dataFim);
  const problemas = [], descartados = [];
  const vistos = new Set();
  const votos = [];
  for (const v of lista.votos || []) {
    const data = d(v.dataVoto);
    if (data && fim && data > fim) { descartados.push(`${v.ministro?.descricao} (${v.dataVoto}, depois do fim da sessão)`); continue; }
    if (data && ini && data < ini && !v.votoAntecipado) { descartados.push(`${v.ministro?.descricao} (${v.dataVoto}, antes do início da sessão)`); continue; }
    const cod = String(v.ministro?.codigo ?? '');
    if (vistos.has(cod)) { descartados.push(`${v.ministro?.descricao} (voto repetido na mesma lista)`); continue; }
    vistos.add(cod);
    const c = conferirMinistro(v.ministro, indice);
    if (!c.ok) problemas.push(c.motivo);
    const ac = v.acompanhandoMinistro?.codigo ? conferirMinistro(v.acompanhandoMinistro, indice) : null;
    if (ac && !ac.ok) problemas.push(ac.motivo);
    votos.push({
      ministro: normalizarEspacos(v.ministro?.descricao),
      ministro_id: cod || null,
      nome_na_composicao_atual: c.ok ? c.nome : null,
      tipo_voto: v.tipoVoto?.descricao ?? null,
      tipo_voto_codigo: v.tipoVoto?.codigo ?? null,
      acompanha: v.acompanhandoMinistro?.descricao ? normalizarEspacos(v.acompanhandoMinistro.descricao) : null,
      acompanha_id: v.acompanhandoMinistro?.codigo ?? null,
      voto_antecipado: v.votoAntecipado === true ? true : undefined,
      data: data,
      url_voto: v.textos?.[0]?.link ?? null,
      textos: (v.textos || []).map((t) => ({ titulo: t.descricao, url: t.link })),
    });
  }
  const relator = lista.ministroRelator ? { ministro: normalizarEspacos(lista.ministroRelator.descricao), ministro_id: lista.ministroRelator.codigo ?? null } : null;
  if (relator?.ministro_id) {
    const c = conferirMinistro(lista.ministroRelator, indice);
    if (!c.ok && /^MIN\. /.test(lista.ministroRelator.descricao)) problemas.push(c.motivo);
  }
  return {
    votacao: {
      origem: 'plenario-virtual',
      parte: null,
      descricao: 'Votos registrados no Plenário Virtual (a lista não separa as partes da decisão)',
      lista: { id: lista.id, nome: lista.nomeLista ?? null, tipo: lista.tipoListaJulgamento?.descricao ?? null },
      sessao: {
        numero: lista.sessao.numero ?? null, ano: lista.sessao.ano ?? null,
        colegiado: lista.sessao.colegiado?.descricao ?? null, tipo: lista.sessao.tipoSessao?.descricao ?? null,
        inicio: ini, fim,
      },
      resultado: null,
      vencidos: [],
      relator,
      relatorio_url: lista.relatorioRelator?.link ?? null,
      voto_relator_url: lista.votoRelator?.link ?? null,
      votos,
      votos_descartados: descartados,
      url: urlVotacaoSessaoVirtual(incidente),
    },
    descartados, problemas,
  };
}

// Colunas da votação de repercussão geral no Plenário Virtual, com os rótulos da página oficial
// detalharProcesso.asp (cabeçalho da tabela: Questão Constitucional | Repercussão Geral | Reafirmação de Jurisprudência | Suspensão Nacional).
const COLUNAS_RG = [
  ['votoQC', 'Questão Constitucional', 'preliminar'],
  ['votoRG', 'Repercussão Geral', 'preliminar'],
  ['votoRJ', 'Reafirmação de Jurisprudência', 'mérito'],
  ['votoSN', 'Suspensão Nacional', null],
];

/** Votações do Plenário Virtual de repercussão geral (?tema=N): uma por coluna com algum voto registrado. */
export function votacoesDoTema(lc, { indice, tema }) {
  const problemas = [];
  const ministros = lc?.placar?.ministro ?? [];
  const nomes = ministros.map((m) => {
    const reg = indice.porNome.get(chaveNome(m.nomeMinistro));
    if (!reg) problemas.push(`"${m.nomeMinistro}" não consta de ministros.json`);
    return { ministro: normalizarEspacos(m.nomeMinistro), ministro_id: reg?.id ?? null, nome_na_composicao_atual: reg?.nome ?? null };
  });
  const votacoes = [];
  for (const [campo, rotulo, parte] of COLUNAS_RG) {
    if (!ministros.some((m) => normalizarEspacos(m[campo]))) continue;
    votacoes.push({
      origem: 'plenario-virtual',
      parte,
      descricao: `Plenário Virtual da repercussão geral: ${rotulo}`,
      sessao: { inicio: dataISO(lc.dataInicioJulgamento), fim: dataISO(lc.dataFimPrevistaJulgamento), fim_e_data_prevista: true },
      resultado: null,
      vencidos: [],
      relator: lc.relator ? { ministro: lc.relator, ministro_id: null } : null,
      votos: ministros.map((m, i) => ({
        ...nomes[i],
        tipo_voto: normalizarEspacos(m[campo]) || null,
        sem_registro: normalizarEspacos(m[campo]) ? undefined : true,
        url_voto: m.seq_arquivo_manifestacao ? `${PORTAL}/jurisprudenciaRepercussao/verPronunciamento.asp?pronunciamento=${m.seq_arquivo_manifestacao}` : null,
      })),
      url: urlPlenarioVirtualTema(tema),
    });
  }
  return { votacoes, problemas };
}

/** Ministros cujo voto no Plenário Virtual é de divergência (texto oficial "Divirjo…" ou "Acompanho a divergência"). */
export const divergentes = (votacao) => votacao.votos
  .filter((v) => /^Divirjo|Acompanho a divergência/i.test(v.tipo_voto ?? '')).map((v) => v.ministro);
