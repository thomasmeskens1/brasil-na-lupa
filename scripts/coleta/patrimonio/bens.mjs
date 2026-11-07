// Funções puras do coletor de patrimônio declarado (bens de candidato do TSE). Sem rede.
//
// Vínculo parlamentar ↔ candidatura, só por chave exata:
//   Câmara: CPF da API oficial da Câmara (/deputados/{id}) = NR_CPF_CANDIDATO do TSE, cargo deputado
//           federal, eleição de 2022. O CPF só existe em memória durante a execução.
//   Senado: a API do Senado não publica CPF. Vínculo = senador titular cuja data de nascimento na API
//           do Senado é idêntica à DT_NASCIMENTO de um único eleito para senador na mesma UF (2018 ou
//           2022). Nada de nome: sem correspondência única, fica sem vínculo.
// Grava só tipo e valor de cada bem (a descrição livre pode trazer dados de terceiros e não é lida).

/** "1.695.000,00" ou "1695000,00" → centavos (inteiro) ou null. */
export function centavos(v) {
  const s = String(v ?? '').trim();
  if (!/^-?[\d.]*\d(,\d{1,2})?$/.test(s)) return null;
  const [int, dec = ''] = s.replace(/\./g, '').split(',');
  const n = Number(int) * 100 + Number((dec + '00').slice(0, 2)) * (int.startsWith('-') ? -1 : 1);
  return Number.isFinite(n) ? n : null;
}

/** "23/10/1976" → "1976-10-23" (ou null). */
export function dataIso(d) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(d ?? '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');
/** CPF utilizável como chave: 11 dígitos, não todos iguais (o TSE usa -1/-4 para "não divulgável"). */
export const cpfValido = (s) => /^\d{11}$/.test(s) && !/^(\d)\1{10}$/.test(s);

const ELEITO = new Set([1, 2, 3]);
export const ehEleito = (cdSitTot) => ELEITO.has(Number(cdSitTot));

/**
 * Escolhe a candidatura de um parlamentar entre várias encontradas pela chave: prefere eleição
 * ordinária (CD_TIPO_ELEICAO 2) e, depois, a de turno maior. Retorna null se a lista estiver vazia.
 */
export function escolherCandidatura(lista) {
  if (!lista?.length) return null;
  return [...lista].sort((a, b) => (b.ordinaria - a.ordinaria) || (b.turno - a.turno) || String(a.sq).localeCompare(String(b.sq)))[0];
}

/**
 * Vínculo dos senadores por data de nascimento + UF entre os eleitos para senador.
 * senadores: [{ id, uf, nascimento: 'AAAA-MM-DD', titular: bool }]
 * eleitos: [{ sq, ano, uf, nascimento, situacao, ordinaria, turno }]
 * → Map(id → candidatura) e lista de ids sem vínculo único.
 */
export function vincularSenadores(senadores, eleitos) {
  const porChave = new Map();
  for (const e of eleitos) {
    if (!e.nascimento || !e.uf) continue;
    const k = `${e.uf}|${e.nascimento}`;
    porChave.set(k, [...(porChave.get(k) ?? []), e]);
  }
  const vinculos = new Map();
  const sem = [];
  for (const s of senadores) {
    const cands = s.titular && s.nascimento ? porChave.get(`${s.uf}|${s.nascimento}`) ?? [] : [];
    if (cands.length === 1) vinculos.set(s.id, cands[0]);
    else sem.push({ id: s.id, motivo: !s.titular ? 'suplente em exercício (não foi eleito titular)' : !s.nascimento ? 'data de nascimento ausente na API do Senado' : cands.length ? 'mais de uma correspondência' : 'sem correspondência exata' });
  }
  return { vinculos, sem };
}

/** Agrupa as linhas de bens por SQ_CANDIDATO: Map(sq → { bens: [[ordem, tipo, centavos]], atualizado }). */
export function acumularBem(mapa, { sq, ordem, tipo, valor, atualizado }) {
  const r = mapa.get(sq) ?? { bens: [], atualizado: null, invalidos: 0 };
  const c = centavos(valor);
  if (c === null) r.invalidos++;
  else r.bens.push([Number(ordem) || 0, String(tipo || 'Não informado').trim(), c]);
  const d = dataIso(atualizado);
  if (d && (!r.atualizado || d > r.atualizado)) r.atualizado = d;
  mapa.set(sq, r);
  return mapa;
}

const tipoLegivel = (t) => {
  const s = t.toLocaleLowerCase('pt-BR');
  return s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1);
};

/** Item final de um parlamentar: total em reais, bens [tipo, valor] na ordem do TSE. */
export function itemParlamentar(cand, bensDoSq) {
  const bens = [...(bensDoSq?.bens ?? [])].sort((a, b) => a[0] - b[0]);
  const total = bens.reduce((s, b) => s + b[2], 0);
  return {
    eleicao: cand.ano,
    cargo: cand.cargo,
    uf: cand.uf,
    sq_candidato: String(cand.sq),
    situacao_na_eleicao: cand.situacao ?? null,
    total: total / 100,
    quantidade_bens: bens.length,
    bens: bens.map(([, tipo, c]) => [tipoLegivel(tipo), c / 100]),
    ultima_atualizacao_tse: bensDoSq?.atualizado ?? null,
    ...(bensDoSq?.invalidos ? { linhas_sem_valor_legivel: bensDoSq.invalidos } : {}),
  };
}
