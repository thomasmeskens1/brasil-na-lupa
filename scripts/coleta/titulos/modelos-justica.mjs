// STJ e STF: o título é sempre o oficial (tese, questão, título do tema ou certidão, sem corte nem
// reescrita). Aqui só a etiqueta, montada de campos estruturados de situação. A 2ª revisão mostrou
// "fixa tese" em tema sem repercussão geral e aviso "Aguardando a publicação do acórdão" lido como tese:
// "Tese firmada/fixada" só sai com tese real e situação que a confirme.
import { limpar } from './texto.mjs';

/** Tese real: existe e não é aviso administrativo da página ("*Aguardando a publicação…"). */
export const teseReal = (t) => {
  const s = limpar(t || '');
  return Boolean(s) && !/^\*/.test(s) && !/aguardando (a )?publica/iu.test(s);
};

const SITUACAO_STJ = {
  'trânsito em julgado': (t) => (teseReal(t.tese) ? 'Tese firmada, decisão definitiva' : null),
  'acórdão publicado': (t) => (teseReal(t.tese) ? 'Tese firmada' : null),
  'acórdão publicado - re pendente': (t) => (teseReal(t.tese) ? 'Tese firmada, com recurso ao STF pendente' : null),
  'mérito julgado': () => 'Mérito julgado',
  cancelado: () => 'Tema cancelado',
  afetado: () => 'Em análise',
  'em julgamento': () => 'Em julgamento',
  sobrestado: () => 'Suspenso',
  revisado: (t) => (teseReal(t.tese) ? 'Tese revisada' : null),
};
export function etiquetaTemaStj(t) {
  const f = SITUACAO_STJ[String(t.situacao || '').toLocaleLowerCase('pt-BR')];
  return f ? f(t) : null;
}

export function etiquetaTemaStf(t) {
  const rg = String(t.situacao?.repercussao_geral || '');
  if (/^Não há repercussão geral/i.test(rg)) return 'Sem repercussão geral';
  if (/^Há repercussão geral/i.test(rg)) return teseReal(t.tese) ? 'Tese fixada' : 'Repercussão geral reconhecida';
  return null;
}

export function etiquetaSumulaVinculante(s) {
  const sit = String(s.situacao || '');
  if (sit === 'Aprovada') return 'Súmula vinculante aprovada';
  if (sit === 'Cancelada') return 'Súmula vinculante cancelada';
  return null;
}
