// Normas federais (leis ordinárias, leis complementares, decretos numerados): lista e detalhe
// da legislação no Senado (publicação no DOU, URN LexML), projeto de origem (processo com a norma gerada)
// e página no Planalto, confirmada por requisição.
import path from 'node:path';
import { obter, paraCada, lerJson, gravarSeMudou, fonte, lista, dataISO, somarDias } from './lib.mjs';
import { existePlanalto } from './planalto.mjs';

const SEN = 'https://legis.senado.leg.br/dadosabertos';
const TIPOS = [
  { sigla: 'LEI', prefixo: 'lei', nome: 'Lei', caminho: (ano, n) => `_ato2023-2026/${ano}/lei/l${n}.htm` },
  { sigla: 'LCP', prefixo: 'lcp', nome: 'Lei Complementar', caminho: (ano, n) => `leis/lcp/lcp${n}.htm` },
  { sigla: 'DEC', prefixo: 'dec', nome: 'Decreto', caminho: (ano, n) => `_ato2023-2026/${ano}/decreto/d${n}.htm` },
];

export async function coletarNormas({ anos, completo, hoje, dirDados, log }) {
  const dir = path.join(dirDados, 'normas');
  const contagem = { total: 0, por_tipo: {}, detalhes_consultados: 0, com_planalto: 0, sem_planalto: 0, com_projeto_origem: 0, com_veto: 0 };
  for (const ano of anos) {
    const arqIndice = path.join(dir, `indice-${ano}.json`);
    const antigos = new Map((lerJson(arqIndice)?.itens || []).map((x) => [x.id, x]));
    // Projeto de origem: processos (Senado/CN) cuja norma gerada é a lei; vetos ficam de fora.
    const origem = new Map();
    for (const t of ['LEI', 'LCP']) {
      const r = await obter(`${SEN}/processo?tipoNorma=${t}&anoNorma=${ano}`);
      for (const p of r.dados || []) {
        if (!p.normaGerada || /^VET /.test(p.identificacao)) continue;
        if (!origem.has(p.normaGerada)) origem.set(p.normaGerada, []);
        origem.get(p.normaGerada).push({ identificacao: p.identificacao, autoria: p.autoria || null, senado_processo: String(p.id), senado_materia: p.codigoMateria ? String(p.codigoMateria) : null });
      }
    }
    const itens = [];
    for (const tipo of TIPOS) {
      const r = await obter(`${SEN}/legislacao/lista?tipo=${tipo.sigla}&ano=${ano}`);
      const docs = lista(r.dados?.ListaDocumento?.documentos?.documento);
      await paraCada(docs, async (d) => {
        const numero = Number(d.numero);
        const id = `${tipo.prefixo}-${numero}-${ano}`;
        const antigo = antigos.get(id);
        const data = dataISO(d.dataassinatura);
        const recente = data && data >= somarDias(hoje, -30);
        let detalhe = antigo && !completo ? { publicacoes: antigo.publicacao_dou, lexml: antigo.links.lexml, vetos: antigo.vetos } : null;
        if (!detalhe) {
          const rd = await obter(`${SEN}/legislacao/${d.id}`, { opcional: true });
          contagem.detalhes_consultados++;
          const doc = lista(rd?.dados?.DetalheDocumento?.documentos?.documento)[0];
          detalhe = {
            publicacoes: lista(doc?.publicacoes?.publicacao).filter((p) => p.tipo === 'PUB')
              .map((p) => ({ veiculo: p.fonte, data: dataISO(p.data), pagina: p.pagina || null, coluna: p.coluna || null })),
            lexml: doc?.identificacao?.urlDocumento || null,
            vetos: [...new Set(lista(doc?.vides?.vide).map((x) => x.nomeNormaPosterior).filter((x) => /^Mensagem de Veto/i.test(x || '')))],
          };
        }
        let planalto = antigo?.links?.planalto ?? null;
        if (completo || (!planalto && (!antigo || recente))) planalto = await existePlanalto(tipo.caminho(ano, numero));
        const projetos = origem.get(d.normaNome) || [];
        const lacunas = [];
        if (!planalto) lacunas.push('Página no Planalto não localizada pelo endereço padrão');
        if (!detalhe.publicacoes?.length) lacunas.push('Publicação no Diário Oficial da União não informada pela fonte');
        if (tipo.sigla !== 'DEC' && !projetos.length) lacunas.push('Projeto de origem não informado pela fonte');
        itens.push({
          id, tipo: tipo.nome, numero, ano, nome_oficial: d.normaNome, data_assinatura: data,
          ementa: d.ementa || null,
          apelido_senado: (d.apelido || '').split(' , ').slice(1).join(' , ') || null,
          caminho: tipo.sigla === 'DEC' ? 'presidencia' : 'congresso',
          forma: tipo.sigla === 'DEC' ? 'ato individual (decreto)' : 'lei aprovada pelo Congresso Nacional',
          publicacao_dou: detalhe.publicacoes || [],
          projeto_origem: projetos,
          vetos: detalhe.vetos || [],
          links: { planalto, lexml: detalhe.lexml, senado_norma: `https://legis.senado.leg.br/norma/${d.id}` },
          ids_oficiais: { senado_norma: String(d.id) },
          lacunas,
        });
      });
    }
    const ordem = { Lei: 1, 'Lei Complementar': 2, Decreto: 3 };
    itens.sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || a.numero - b.numero);
    for (const x of itens) {
      contagem.total++;
      contagem.por_tipo[x.tipo] = (contagem.por_tipo[x.tipo] || 0) + 1;
      if (x.links.planalto) contagem.com_planalto++; else contagem.sem_planalto++;
      if (x.projeto_origem.length) contagem.com_projeto_origem++;
      if (x.vetos.length) contagem.com_veto++;
    }
    gravarSeMudou(arqIndice, {
      atualizado_em: hoje, ano,
      abrangencia: 'Leis ordinárias, leis complementares e decretos numerados assinados no ano, conforme a base de legislação do Senado Federal',
      fontes: [
        ...TIPOS.map((t) => fonte(`${t.nome}s de ${ano} — Legislação Federal (Senado Federal)`, `${SEN}/legislacao/lista?tipo=${t.sigla}&ano=${ano}`, 'Senado Federal', hoje)),
        fonte(`Processos que geraram leis de ${ano} — Senado Federal`, `${SEN}/processo?tipoNorma=LEI&anoNorma=${ano}`, 'Senado Federal / Congresso Nacional', hoje),
      ],
      itens,
    });
    log(`Normas ${ano}: ${itens.length}`);
  }
  return contagem;
}
