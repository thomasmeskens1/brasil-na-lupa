// Orquestra a coleta de presença em Plenário (presenca.mjs) e da cota parlamentar (despesas.mjs)
// para coletar.mjs: anos a processar, estado dos downloads condicionais (meta.json → arquivos_em_massa),
// contagens e fontes. Um erro aqui não desfaz as votações já gravadas; vira "erros" em meta.json.
import path from 'node:path';
import { lerJson } from './lib.mjs';
import { coletarPresenca } from './presenca.mjs';
import { coletarDespesas } from './despesas.mjs';

// ---------- presença em Plenário e cota parlamentar ----------
const titulosFonte = new Map();
export async function coletarPresencaEDespesas({
  DIR, hoje, anoAtual, anos, completo, forcar, cotaOficial, comPresenca, comDespesas, log, fonte,
}) {
  const metaAntiga = lerJson(path.join(DIR, 'meta.json')) || {};
  const arquivos = { ...(metaAntiga.arquivos_em_massa || {}) };
  const contAntigas = metaAntiga.contagens || {};
  const out = { fontes: [], arquivos, erros: [], execucao: { presenca: {}, despesas: {} },
    contagens: { presenca: { ...(contAntigas.presenca || {}) }, despesas: { ...(contAntigas.despesas || {}) } } };
  const comum = { hoje, arquivosMeta: arquivos, forcar, completo, log, fonte };
  const carteirasPorAno = new Map();
  const anosDespesas = completo ? anos : [...new Set([anoAtual - 1, ...anos])].filter((a) => a >= 2025).sort();
  if (comDespesas) for (const ano of anosDespesas) {
    try {
      const r = await coletarDespesas({ ...comum, ano, dirBase: path.join(DIR, 'despesas'), cotaOficial });
      Object.assign(arquivos, r.arquivos);
      if (r.carteiras) carteirasPorAno.set(ano, r.carteiras);
      if (r.resumo) out.contagens.despesas[ano] = r.resumo;
      out.execucao.despesas[ano] = r.pulado ? 'sem mudança' : 'processado';
      out.fontes.push([r.urls[0], 'Cota para o Exercício da Atividade Parlamentar (arquivo anual)']);
      if (!r.pulado) out.fontes.push([`https://www.camara.leg.br/cota-parlamentar/sumarizado?nuDeputadoId={id}&dataInicio=1/${ano}&dataFim=12/${ano}`, 'Página oficial de consulta da cota parlamentar (conferência)']);
    } catch (e) { out.erros.push(`despesas ${ano}: ${e.message}`); log(`ERRO despesas ${ano}: ${e.message}`); }
  }
  if (comPresenca) for (const ano of anos.filter((a) => a >= 2025)) {
    try {
      const r = await coletarPresenca({ ...comum, ano, dir: path.join(DIR, 'presenca'), carteirasCeap: carteirasPorAno.get(ano) });
      Object.assign(arquivos, r.arquivos);
      if (r.resumo) out.contagens.presenca[ano] = r.resumo;
      out.execucao.presenca[ano] = r.pulado ? 'sem mudança' : 'processado';
      const [uEv, uPres, uDia, uDep] = r.urls;
      out.fontes.push([uEv, 'Arquivo de dados abertos (anual)'], [uPres, 'Arquivo de dados abertos (anual)'],
        [`${uDia}?data=DD/MM/AAAA`, 'Serviço de dados abertos SitCamaraWS (frequência em Plenário)']);
      if (uDep) out.fontes.push([uDep, 'Serviço de dados abertos SitCamaraWS (carteira parlamentar)']);
    } catch (e) { out.erros.push(`presença ${ano}: ${e.message}`); log(`ERRO presença ${ano}: ${e.message}`); }
  }
  return out;
}

