// Votações nominais em comissões permanentes da ALESP: GET /processo/votacaoComissao/{idProcesso}.
// Cada deliberação com lista de votos vira um registro (id = idReuniaoItemDeliberacao da ALESP).
import { obter, normalizarNome } from './lib.mjs';
import { API } from './plenario.mjs';

/** "09/12/2025 - Comissão de Constituição, Justiça e Redação" → { data, nome } */
function lerDetalhes(txt) {
  const m = /^\s*(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+?)\s*$/.exec(txt || '');
  return m ? { data: `${m[3]}-${m[2]}-${m[1]}`, nome: m[4] } : { data: null, nome: null };
}

/**
 * Busca as deliberações com votos nominais de um processo.
 * proc: { id, sigla, numero, ano, ementa, tipo }
 */
export async function coletarComissoesDoProcesso(proc, { hoje, mapaNomes }) {
  const regs = [];
  for (let page = 0; page < 50; page++) {
    const url = `${API}/processo/votacaoComissao/${proc.id}?page=${page}&size=100`;
    const j = await obter(url, { opcional: true });
    if (!j || !Array.isArray(j.content)) break;
    for (const c of j.content) {
      if (!Array.isArray(c.votos) || !c.votos.length) continue;
      const det = lerDetalhes(c.detalhes);
      const siglas = [...new Set(c.votos.map((v) => v.siglaColegiado).filter(Boolean))];
      const lacunas = [
        'Placar em "sim/não" não informado pela fonte: a ALESP registra cada voto como texto '
        + '(ex.: "Favorável ao voto do relator"), reproduzido sem conversão',
        'Partido de cada parlamentar na data da votação não informado pela fonte',
      ];
      if (!det.data) lacunas.push('Data da reunião não informada pela fonte');
      if (siglas.length !== 1) lacunas.push('Sigla da comissão ausente ou múltipla na fonte');
      const porTipo = {};
      const votos = c.votos.map((v) => {
        const voto = String(v.txVoto ?? '').trim() || null;
        porTipo[voto ?? 'sem registro'] = (porTipo[voto ?? 'sem registro'] || 0) + 1;
        return {
          parlamentar_id: mapaNomes.get(normalizarNome(v.parlamentar)) ?? null,
          nome: v.parlamentar, partido: null, uf: 'SP', voto, voto_codigo: v.idReuniaoItemVotacao != null ? String(v.idReuniaoItemVotacao) : null,
        };
      }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const semId = votos.filter((v) => !v.parlamentar_id).length;
      if (semId) lacunas.push(`${semId} nome(s) sem correspondência exata na lista oficial de parlamentares; identificador deixado em branco`);
      const urlProc = `https://www.al.sp.gov.br/propositura/${proc.id}`;
      regs.push({
        id: String(c.idReuniaoItemDeliberacao),
        casa: 'alesp',
        data: det.data,
        hora: null,
        orgao: 'comissão',
        orgao_sigla: siglas.length === 1 ? siglas[0] : null,
        orgao_nome: det.nome,
        proposicao: {
          id: String(proc.id), tipo: proc.tipo || null, sigla: proc.sigla || null, numero: proc.numero ?? null,
          ano: proc.ano ?? null, ementa: proc.ementa || null, url: urlProc,
        },
        descricao: c.txDeliberacao || null,
        resultado: null,
        tipo: 'nominal',
        placar: null,
        votos_por_tipo: porTipo,
        presidente_votacao: c.presidenteVotacao || null,
        placar_origem: 'contagem-dos-votos',
        conferencia_placar: 'Contagem dos votos registrados pela fonte, agrupados pelo texto oficial de cada voto.',
        votos,
        fonte: {
          titulo: `Votação em comissão — ${proc.sigla || ''} ${proc.numero ?? ''}/${proc.ano ?? ''} (${det.nome || 'comissão'})`,
          url: urlProc,
          url_dados: url,
          orgao: 'Assembleia Legislativa do Estado de São Paulo (ALESP)',
          acessado_em: hoje,
        },
        url: urlProc,
        lacunas: [...lacunas, 'Resultado: ver o texto oficial da deliberação (campo descrição)'],
      });
    }
    if (j.last !== false) break;
  }
  return regs;
}
