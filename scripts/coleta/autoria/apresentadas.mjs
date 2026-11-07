// Contagem de proposições APRESENTADAS por parlamentar (autoria ou coautoria), na legislatura atual.
// Só os tipos de proposição que podem virar norma; requerimentos, indicações, emendas etc. ficam fora.
// Funções puras (sem rede), usadas por camara.mjs e senado.mjs.
import { percorrerCsv, INICIO_LEGISLATURA, LEGISLATURA } from './lib.mjs';

export const TIPOS_CAMARA = ['PEC', 'PLP', 'PL', 'PDL', 'PRC'];
export const TIPOS_SENADO = ['PEC', 'PLP', 'PL', 'PDL', 'PRS'];
export const NOMES_TIPOS = {
  PEC: 'Proposta de Emenda à Constituição',
  PLP: 'Projeto de Lei Complementar',
  PL: 'Projeto de Lei',
  PDL: 'Projeto de Decreto Legislativo',
  PRC: 'Projeto de Resolução da Câmara',
  PRS: 'Projeto de Resolução do Senado',
};
const ID_DEP = /\/deputados\/(\d+)$/;

/** Do CSV de proposições da Câmara: Map(id → sigla) dos tipos contados apresentados no período. */
export function apresentadasDoCsv(texto, inicio = INICIO_LEGISLATURA, tipos = TIPOS_CAMARA) {
  const aceitos = new Set(tipos);
  const saida = new Map();
  percorrerCsv(texto, (l) => {
    const sigla = (l.siglaTipo || '').trim();
    if (!aceitos.has(sigla)) return;
    const data = (l.dataApresentacao || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < inicio) return;
    const id = String(l.id || '').trim();
    if (/^\d+$/.test(id)) saida.set(id, sigla);
  });
  return saida;
}

/** Do CSV de autores: Map(idDeputado → Map(idProposicao → menor ordem de assinatura)). */
export function autoresApresentadas(texto, apresentadas, destino = new Map()) {
  percorrerCsv(texto, (l) => {
    const prop = String(l.idProposicao || '').trim();
    if (!apresentadas.has(prop)) return;
    const dep = String(l.idDeputadoAutor || '').trim() || (ID_DEP.exec(l.uriAutor || '')?.[1] ?? '');
    if (!/^\d+$/.test(dep)) return;
    const o = Number(l.ordemAssinatura);
    const ordem = Number.isFinite(o) && o > 0 ? o : null;
    const m = destino.get(dep) ?? new Map();
    const atual = m.get(prop);
    if (atual === undefined || (ordem !== null && (atual === null || ordem < atual))) m.set(prop, ordem);
    destino.set(dep, m);
  });
  return destino;
}

const vazio = (tipos) => Object.fromEntries(tipos.map((t) => [t, 0]));

/** Contagem final por deputado: { total, primeiro_signatario, por_tipo }. */
export function contarCamara(apresentadas, autores) {
  const out = {};
  for (const dep of [...autores.keys()].sort((a, b) => Number(a) - Number(b))) {
    const c = { total: 0, primeiro_signatario: 0, por_tipo: vazio(TIPOS_CAMARA) };
    for (const [prop, ordem] of autores.get(dep)) {
      c.total++;
      if (ordem === 1) c.primeiro_signatario++;
      c.por_tipo[apresentadas.get(prop)]++;
    }
    out[dep] = c;
  }
  return out;
}

/** Da lista de processos de um senador (API do Senado): { total, por_tipo } dos tipos contados. */
export function contarListaSenado(lista, inicio = INICIO_LEGISLATURA) {
  const c = { total: 0, por_tipo: vazio(TIPOS_SENADO) };
  const vistos = new Set();
  for (const x of Array.isArray(lista) ? lista : []) {
    const sigla = String(x?.identificacao ?? '').split(' ')[0];
    if (!(sigla in c.por_tipo)) continue;
    if (String(x?.dataApresentacao ?? '') < inicio) continue;
    const id = String(x?.id ?? '');
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    c.total++;
    c.por_tipo[sigla]++;
  }
  return c;
}

export function montarApresentadas({ casa, contagem, fontes, hoje, consultados = null, inicio = INICIO_LEGISLATURA }) {
  const tipos = casa === 'camara' ? TIPOS_CAMARA : TIPOS_SENADO;
  return {
    atualizado_em: hoje,
    casa,
    legislatura: LEGISLATURA,
    periodo: { inicio, fim: hoje },
    tipos: tipos.map((t) => ({ sigla: t, nome: NOMES_TIPOS[t] })),
    criterio: casa === 'camara'
      ? 'Proposições dos tipos PEC, PLP, PL, PDL e PRC apresentadas desde o início da legislatura atual, nos arquivos de dados abertos da Câmara dos Deputados, em que o deputado aparece no arquivo oficial de autores (como primeiro signatário ou coautor). Requerimentos, indicações, emendas e outros tipos não entram. Cada proposição conta uma vez por deputado.'
      : 'Matérias dos tipos PEC, PLP, PL, PDL e PRS apresentadas desde o início da legislatura atual em que o senador aparece como autor ou coautor, segundo a API de dados abertos do Senado Federal (consulta de processos por autor). Requerimentos, indicações, emendas e outros tipos não entram. Cada matéria conta uma vez por senador.',
    fontes,
    ...(consultados ? { consultados: [...consultados].sort((a, b) => Number(a) - Number(b)) } : {}),
    parlamentares: contagem,
  };
}
