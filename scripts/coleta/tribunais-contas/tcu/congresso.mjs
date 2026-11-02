// Julgamento político das Contas do Presidente da República: situação no Congresso Nacional.
//
// O TCU emite o parecer prévio; quem julga as contas é o Congresso Nacional (art. 49, IX, da Constituição),
// a partir da Mensagem do Congresso Nacional (MCN) que encaminha as contas. Fonte: Dados Abertos do Senado
// Federal, serviço /dadosabertos/processo (substituto indicado pelo próprio Senado para materia/movimentacoes).
//   GET https://legis.senado.leg.br/dadosabertos/processo?sigla=MCN&numero={n}&ano={a}
//   GET https://legis.senado.leg.br/dadosabertos/processo/{id}
// Tudo é copiado literalmente (situação, colegiado, informe de recebimento do parecer). Nada é deduzido:
// "julgado" só existiria se a fonte trouxer deliberação/norma gerada.
import { obterJson } from './lib.mjs';

export const SENADO = 'https://legis.senado.leg.br/dadosabertos';
export const urlMateria = (codigo) => `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigo}`;

/** Lê a situação de uma MCN. Devolve objeto pronto para "julgamento_politico" (mais campos de contexto). */
export async function situacaoMcn({ numero, ano }, hoje) {
  const identificacao = `MCN ${numero}/${ano}`;
  const urlLista = `${SENADO}/processo?sigla=MCN&numero=${numero}&ano=${ano}`;
  const lista = await obterJson(urlLista);
  const resumo = (Array.isArray(lista) ? lista : []).find((p) => p.identificacao === identificacao);
  if (!resumo) throw new Error(`${identificacao} não encontrada em ${urlLista}`);
  const urlDetalhe = `${SENADO}/processo/${resumo.id}`;
  const det = await obterJson(urlDetalhe);

  const autuacao = (det.autuacoes || []).find((a) => /principal/i.test(a.descricao || '')) || (det.autuacoes || [])[0] || {};
  const situacoes = autuacao.situacoes || [];
  const atual = situacoes.filter((s) => !s.fim).pop() || situacoes[situacoes.length - 1] || null;
  const informes = autuacao.informesLegislativos || [];
  const recebimento = informes.find((i) => /Parecer Pr[ée]vio do Tribunal de Contas da Uni[ãa]o/i.test(i.descricao || ''));
  const aviso = recebimento?.documentosAssociados?.find((d) => /aviso/i.test(d.tipo || d.siglaTipo || ''));
  const temDeliberacao = det.deliberacao && Object.keys(det.deliberacao).length > 0;
  const temNorma = det.normaGerada && Object.keys(det.normaGerada).length > 0;

  const lacunas = [];
  if (!temDeliberacao && !temNorma) {
    lacunas.push(`Contas ainda não julgadas pelo Congresso Nacional: a fonte oficial não registra deliberação nem decreto legislativo para a ${identificacao}.`);
  }
  if (!recebimento) lacunas.push('Informe de recebimento do parecer prévio do TCU não localizado na tramitação.');

  return {
    casa: 'congresso',
    mensagem: identificacao,
    ementa: resumo.ementa ?? det.conteudo?.ementa ?? null,
    decisao_id: null,
    situacao_literal: det.situacaoAtual ?? atual?.descricao ?? resumo.situacaoAtual ?? null,
    data_situacao: det.dataSituacaoAtual ?? atual?.inicio ?? resumo.dataSituacaoAtual ?? null,
    colegiado_atual: autuacao.nomeColegiadoControleAtual
      ? `${autuacao.nomeColegiadoControleAtual}${autuacao.siglaColegiadoControleAtual ? ` (${autuacao.siglaColegiadoControleAtual})` : ''}`
      : null,
    tramitando: det.tramitando ?? resumo.tramitando ?? null,
    recebimento_parecer_tcu: recebimento
      ? { data: String(recebimento.data || '').slice(0, 10) || null, texto_literal: recebimento.descricao, documento: aviso ? { titulo: aviso.identificacao, url: aviso.url } : null }
      : null,
    deliberacao: temDeliberacao ? det.deliberacao : null,
    norma_gerada: temNorma ? det.normaGerada : null,
    url: urlMateria(resumo.codigoMateria),
    fonte: {
      titulo: `${identificacao} — tramitação (Dados Abertos do Senado Federal)`,
      url: urlDetalhe,
      orgao: 'Senado Federal / Congresso Nacional',
      acessado_em: hoje,
    },
    lacunas,
  };
}
