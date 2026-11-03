// Atos (medidas provisórias, vetos, leis e decretos federais, de SP e de Atibaia), decisões de ICMS e
// pareceres de contas. Dois produtos, ambos só de campos estruturados:
//   - título "estruturado" (modelo fixo por tipo), apenas onde há dado verificável: crédito com valor
//     (MP/lei/decreto), mudança de ICMS antes → depois, parecer de contas do TCE-SP;
//   - etiqueta curta ("Lei publicada", "Veto mantido", "ICMS: de 18% para 20,5%").
// Nenhuma ementa é reescrita: o resto fica com o título oficial.
import { limpar, semFormulaFinal } from './texto.mjs';
import { LIMITE_DURO } from './regras.mjs';
import { dataBR } from './lib.mjs';

const milhar = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ---------- Crédito com valor (modelo "credito") ----------
const RE_CREDITO = /^(?:abre|dispõe sobre a abertura de)\s+(?:um\s+|aos?\s+[^,]{0,60}?\s+)?(crédito\s+(?:adicional\s+)?(?:extraordinário|suplementar|especial))(?![\p{L}])/iu;
const RE_VALOR = /R\$\s?[\d.]+,\d{2}/gu;
/**
 * "<sujeito> abre crédito extraordinário de R$ 6.605.000.000,00 em favor do Ministério de Minas e Energia".
 * Só com UM valor na ementa (com mais de um, o título perderia parte do objeto); os beneficiários entram
 * só como trecho literal e completo "em favor de …" (até ", no valor de", ", para" ou fim) e só se couberem;
 * senão o título fica sem beneficiário (nunca com parte da lista).
 * Devolve também os trechos literais usados (o verificador confere que estão na ementa).
 */
export function modeloCredito(ementa, sujeito, fonte) {
  const e = semFormulaFinal(ementa || '');
  const t = RE_CREDITO.exec(e);
  if (!t) return null;
  const valores = e.match(RE_VALOR) || [];
  if (valores.length !== 1) return { erro: valores.length ? 'mais de um valor na ementa' : 'crédito sem valor na ementa' };
  const tipo = t[1].toLocaleLowerCase('pt-BR');
  const valor = valores[0].replace(/R\$\s?/, 'R$ ');
  const base = `${sujeito} abre ${tipo} de ${valor}`;
  // beneficiários completos (lista inteira até ", no valor de" / ", para" / fim): cortar a lista tiraria objeto
  const favor = /(?:^|,\s*)(em favor d[oae]s?\s[^;()]+?)(?=,\s*no valor de|,\s*para\s|;|$)/iu.exec(e);
  const literais = [t[1], valores[0]];
  if (favor && !/\bno valor\b|R\$/.test(favor[1]) && base.length + favor[1].length + 1 <= LIMITE_DURO) {
    return { titulo: `${base} ${favor[1]}`, modelo: 'credito', fonte, literais: [...literais, favor[1]] };
  }
  return base.length <= LIMITE_DURO ? { titulo: base, modelo: 'credito', fonte, literais } : { erro: 'título do modelo longo demais' };
}

// ---------- Medidas provisórias ----------
export function subtituloMp(mp) {
  return [`Medida Provisória ${milhar(mp.numero)}/${mp.ano}`, 'ato individual', mp.situacao, dataBR(mp.datas?.edicao)].filter(Boolean).join(' · ');
}
export function estruturadoMp(mp) {
  return modeloCredito(mp.ementa, 'Medida provisória', mp.links?.planalto || mp.fontes?.[0]?.url || null);
}
const SITUACAO_MP = {
  'em tramitação': 'Medida provisória em vigor, em análise no Congresso',
  'convertida em lei': 'Medida provisória convertida em lei',
  'perdeu eficácia': 'Medida provisória perdeu a eficácia',
  revogada: 'Medida provisória revogada',
  'aprovada pelo Congresso, enviada à sanção': 'Medida provisória aprovada, enviada à sanção',
};
export const etiquetaMp = (mp) => SITUACAO_MP[String(mp.situacao || '').toLocaleLowerCase('pt-BR')] || null;

// ---------- Vetos ----------
export function contagemVeto(vet) {
  const c = { total: vet.quantidade_dispositivos_fonte ?? (vet.dispositivos || []).length, mantido: 0, derrubado: 0, prejudicado: 0, pendente: 0 };
  for (const d of vet.dispositivos || []) {
    if (d.situacao === 'mantido') c.mantido++;
    else if (d.situacao === 'derrubado') c.derrubado++;
    else if (d.situacao === 'prejudicado') c.prejudicado++;
    else c.pendente++;
  }
  return c;
}
/** "Veto mantido", "Veto derrubado", "Veto derrubado em 2 de 10 trechos", "Veto aguarda decisão do Congresso". */
export function etiquetaVeto(vet) {
  const c = contagemVeto(vet);
  if (!c.total || (vet.dispositivos || []).length !== c.total) return null;
  if (c.pendente === c.total) return 'Veto aguarda decisão do Congresso';
  if (c.mantido === c.total) return 'Veto mantido';
  if (c.derrubado === c.total) return 'Veto derrubado';
  if (c.prejudicado === c.total) return 'Veto prejudicado';
  if (c.derrubado) return `Veto derrubado em ${c.derrubado} de ${c.total} trechos`;
  if (c.mantido) return `Veto mantido em ${c.mantido} de ${c.total} trechos`;
  return null;
}
export function subtituloVeto(vet) {
  const tipo = vet.tipo === 'total' ? 'Veto total' : 'Veto parcial';
  return [`${tipo} ${vet.numero}/${vet.ano}`, vet.materia_vetada?.identificacao, vet.norma?.descricao, 'ato individual; apreciação pelo Congresso Nacional'].filter(Boolean).join(' · ');
}

// ---------- Leis e decretos ----------
const SUJEITO = {
  federal: { Lei: 'Lei federal', 'Lei Complementar': 'Lei complementar federal', Decreto: 'Decreto federal' },
  sp: { Decreto: 'Decreto estadual', Lei: 'Lei estadual', 'Lei Complementar': 'Lei complementar estadual' },
  atibaia: { Decreto: 'Decreto de Atibaia', Lei: 'Lei de Atibaia', 'Lei Complementar': 'Lei complementar de Atibaia' },
};
/** norma: { tipo, ementa, fonte }. esfera: federal | sp | atibaia. Só crédito com valor vira título estruturado. */
export function estruturadoNorma(n, esfera) {
  const sujeito = SUJEITO[esfera]?.[n.tipo];
  if (!sujeito) return null;
  return modeloCredito(n.ementa, sujeito, n.fonte);
}
const ETIQUETA_NORMA = {
  federal: { Lei: 'Lei publicada', 'Lei Complementar': 'Lei complementar publicada', Decreto: 'Decreto publicado' },
  sp: { Lei: 'Lei estadual publicada', 'Lei Complementar': 'Lei complementar estadual publicada', Decreto: 'Decreto estadual publicado', 'Veto Parcial': 'Veto parcial do governador', 'Veto Total': 'Veto total do governador' },
  atibaia: { Lei: 'Lei municipal publicada', 'Lei Complementar': 'Lei complementar municipal publicada', Decreto: 'Decreto municipal publicado' },
};
export const etiquetaNorma = (n, esfera) => ETIQUETA_NORMA[esfera]?.[n.tipo] || null;

// ---------- ICMS (modelo "icms-mudanca") ----------
const UNIDADE = (u) => {
  const m = /^R\$ por (.+)$/.exec(u || '');
  return m ? { prefixo: 'R$ ', sufixo: ` por ${m[1]}` } : null;
};
/** A única mudança da decisão, com antes e depois, tirada do texto da norma (não de documento do autor). */
function mudancaUnica(d) {
  const ms = d.mudancas || [];
  if (ms.length !== 1 || !ms[0].antes || !ms[0].depois) return { erro: 'decisão sem uma única mudança com valor antes e depois' };
  const m = ms[0];
  const doc = (d.fontes || []).find((f) => f.url === m.fonte);
  if (doc && /exposi[çc][ãa]o de motivos|justificativa|mensagem/iu.test(doc.titulo || '')) return { erro: 'valores da mudança vêm de documento do autor, não do texto da norma' };
  const u = UNIDADE(m.unidade);
  const pct = /%$/.test(m.antes) && /%$/.test(m.depois);
  if (!u && !pct) return { erro: 'unidade da mudança sem modelo' };
  return { m, u };
}
export function modeloIcms(d) {
  const x = mudancaUnica(d);
  if (x.erro) return x;
  const { m, u } = x;
  const quando = m.vigencia ? ` a partir de ${dataBR(m.vigencia)}` : '';
  const item = limpar(m.item);
  const titulo = u
    ? `ICMS de ${item.charAt(0).toLocaleLowerCase('pt-BR')}${item.slice(1)} passa de ${u.prefixo}${m.antes} para ${u.prefixo}${m.depois}${u.sufixo}${quando}`
    : `${item} passa de ${m.antes} para ${m.depois}${quando}`;
  if (titulo.length > LIMITE_DURO) return { erro: 'título do modelo longo demais' };
  return { titulo, modelo: 'icms-mudanca', fonte: m.fonte || d.fontes?.[0]?.url || null, literais: [] };
}
/** "ICMS: de 18% para 20,5%" ou "ICMS: de R$ 1,3721 para R$ 1,47 por litro". */
export function etiquetaIcms(d) {
  const x = mudancaUnica(d);
  if (x.erro) return null;
  const { m, u } = x;
  return u ? `ICMS: de R$ ${m.antes} para R$ ${m.depois}${u.sufixo}` : `ICMS: de ${m.antes} para ${m.depois}`;
}

// ---------- Pareceres de contas do TCE-SP (modelo "contas-tce") ----------
function conclusaoTce(c) {
  const concl = String(c.parecer?.conclusao || '').toLocaleLowerCase('pt-BR');
  return ['favorável', 'desfavorável'].includes(concl) ? concl : null;
}
export function modeloContasTce(c, contas) {
  const p = c.parecer || {};
  const concl = conclusaoTce(c);
  if (!concl) return { erro: 'conclusão do parecer não informada na fonte' };
  // mesmo molde para governador e prefeito; lacuna da fonte sobre ressalvas é dita, não omitida
  const ress = p.com_ressalvas === true ? ', com ressalvas' : p.com_ressalvas === false ? ', sem ressalvas' : '; ressalvas não informadas na fonte';
  const titulo = `Tribunal de Contas emite parecer ${concl} às contas de ${p.exercicio} do ${contas}${ress}`;
  if (titulo.length > LIMITE_DURO) return { erro: 'título do modelo longo demais' };
  return { titulo, modelo: 'contas-tce', fonte: p.documento?.url || c.fontes?.[0]?.url || c.processo?.url || null, literais: [] };
}
/** "Parecer favorável, com ressalvas" — parecer prévio, não julgamento (quem julga é o Legislativo). */
export function etiquetaContasTce(c) {
  const concl = conclusaoTce(c);
  if (!concl) return null;
  const r = c.parecer?.com_ressalvas;
  return `Parecer ${concl}${r === true ? ', com ressalvas' : r === false ? ', sem ressalvas' : ''}`;
}
