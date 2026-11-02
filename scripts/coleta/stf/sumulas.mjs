// Súmulas vinculantes (API de jurisprudência, base "sumulas"). A votação da proposta de súmula (PSV) não vem
// na API: fica como lacuna (só aparece no processo PSV, em /processos, que o robots.txt bloqueia).
import { normalizarEspacos } from './lib.mjs';
import { fonte, URL_API_JURIS } from './fontes.mjs';

const linhas = (s) => (s ? String(s).split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : []);
const texto = (s) => (s ? normalizarEspacos(s) : null);

export function montarSumulas({ total, itens }, hoje) {
  const lacunas = ['Votação da proposta de súmula vinculante (PSV) não disponível na fonte usada (Informação não disponível em fonte oficial estruturada)'];
  const sumulas = itens
    .filter((s) => s.is_vinculante !== false)
    .map((s) => {
      const l = [];
      if (!s.publicacao_data) l.push('Data de publicação não disponível em fonte oficial');
      if (!s.sumula_texto) l.push('Texto da súmula não disponível em fonte oficial');
      return {
        numero: s.sumula_numero ?? null,
        titulo: s.titulo ?? null,
        texto: texto(s.sumula_texto),
        situacao: s.situacao_sumula ?? null,
        orgao: s.orgao_julgador ?? null,
        julgamento_data: s.julgamento_data ?? null,
        publicacao_data: s.publicacao_data ?? null,
        publicacoes: linhas(s.documental_publicacao_lista_texto),
        precedentes: linhas(s.processo_precedente_texto),
        legislacao_citada: linhas(s.documental_legislacao_citada_texto),
        observacao: texto(s.documental_observacao_texto),
        ramo_direito: s.ramo_direito ?? [],
        aprovacao_url: s.aprovacao_url ?? null,
        id_fonte: s.id ?? null,
        lacunas: l,
      };
    })
    .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
  if (total !== null && total !== sumulas.length) lacunas.push(`A fonte informa ${total} registros e ${sumulas.length} foram lidos`);
  return {
    atualizado_em: hoje,
    tribunal: 'stf',
    fonte: fonte('Pesquisa de jurisprudência do STF – Súmulas vinculantes', 'https://jurisprudencia.stf.jus.br/pages/search?base=sumulas&sinonimo=true&plural=true&page=1&pageSize=10&queryString=vinculante', hoje),
    fonte_api: URL_API_JURIS,
    total: sumulas.length,
    itens: sumulas,
    lacunas,
  };
}
