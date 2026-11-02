// Modelos de título para atos: medidas provisórias, vetos, leis e decretos (federais, de SP e de
// Atibaia), decisões de ICMS e pareceres de contas. Mesmo molde para qualquer governo.
import { limpar, trechoDaEmenta, trechoCredito, cortarEmOracao, semFormulaFinal } from './texto.mjs';
import { LIMITE_DURO } from './regras.mjs';
import { dataBR } from './lib.mjs';

const tirarPonto = (s) => limpar(s).replace(/\.$/, '');
const milhar = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ---------- Medidas provisórias ----------
export function modeloMp(mp, extra = {}) {
  const base = 'Presidência edita medida provisória';
  if (mp.apelido_senado) {
    const t = `${base}: ${tirarPonto(mp.apelido_senado)}`;
    if (t.length <= LIMITE_DURO) return { titulo: t, origem: 'apelido-oficial', fonte: mp.links?.senado || mp.fontes?.[0]?.url };
  }
  // crédito do Executivo: "abre" + valor oficial, antes de qualquer manchete (revisão de viés)
  const cr = trechoCredito(mp.ementa, LIMITE_DURO - 'Medida provisória '.length);
  if (cr) return { titulo: `Medida provisória ${cr}`, origem: 'modelo', fonte: mp.links?.planalto || mp.fontes?.[0]?.url };
  if (extra.manchete) return extra.manchete;
  const tr = trechoDaEmenta(mp.ementa, LIMITE_DURO - base.length - 5);
  if (!tr) return { erro: 'ementa sem verbo inicial ou longa demais para corte em fronteira de oração' };
  return { titulo: `${base} que ${tr.texto}`, origem: 'modelo', fonte: mp.links?.planalto || mp.fontes?.[0]?.url };
}
export function subtituloMp(mp) {
  return [`Medida Provisória ${milhar(mp.numero)}/${mp.ano}`, 'ato individual', mp.situacao, dataBR(mp.datas?.edicao)].filter(Boolean).join(' · ');
}

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
const trechos = (n) => `${n} ${n === 1 ? 'trecho' : 'trechos'}`;
export function modeloVeto(vet) {
  const c = contagemVeto(vet);
  if (!c.total) return { erro: 'quantidade de dispositivos vetados não informada' };
  let assunto = vet.assunto_congresso ? tirarPonto(vet.assunto_congresso) : null;
  const fonte = vet.links?.congresso_dispositivos || vet.links?.senado || vet.fontes?.[0]?.url;
  let acao;
  if (c.mantido + c.derrubado + c.prejudicado === 0) {
    acao = vet.tipo === 'total' ? 'Presidência veta o projeto inteiro; veto aguarda decisão do Congresso'
      : `Presidência veta ${trechos(c.total)}; veto aguarda decisão do Congresso`;
  } else {
    const partes = [];
    if (c.derrubado) partes.push(`derruba o veto em ${c.derrubado}`);
    if (c.mantido) partes.push(`mantém o veto em ${c.mantido}`);
    acao = `Congresso ${partes.join(' e ')} ${partes.length ? `de ${trechos(c.total)} vetados` : ''}`.replace(/\s+/g, ' ').trim();
    if (!partes.length) acao = `Congresso declara prejudicados ${c.prejudicado} de ${trechos(c.total)} vetados`;
    if (c.pendente) acao += `; ${c.pendente} aguardam decisão`;
  }
  if (assunto) {
    const t = `${assunto}: ${acao}`;
    if (t.length <= LIMITE_DURO) return { titulo: t, origem: 'modelo', fonte };
  }
  const ementa = vet.materia_vetada?.ementa;
  const prefixo = `${acao} do projeto que `;
  const tr = ementa ? trechoDaEmenta(ementa, LIMITE_DURO - prefixo.length) : null;
  if (tr && !/ do projeto inteiro/.test(acao)) return { titulo: `${prefixo}${tr.texto}`, origem: 'modelo', fonte };
  if (acao.length <= LIMITE_DURO) return { titulo: acao, origem: 'modelo', fonte };
  return { erro: 'sem assunto do Congresso e ementa longa demais' };
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
/** norma: { tipo, ementa, apelido?, fonte }. esfera: federal | sp | atibaia */
export function modeloNorma(n, esfera, extra = {}) {
  const sujeito = SUJEITO[esfera]?.[n.tipo] || null;
  if (!sujeito) return { erro: 'tipo de norma sem modelo' };
  if (n.apelido) {
    const t = `${sujeito} ${/^Decreto/.test(sujeito) ? 'publicado' : 'publicada'}: ${tirarPonto(n.apelido)}`;
    if (t.length <= LIMITE_DURO) return { titulo: t, origem: 'apelido-oficial', fonte: n.fonteApelido || n.fonte };
  }
  const cr = trechoCredito(n.ementa, LIMITE_DURO - sujeito.length - 1);
  if (cr) return { titulo: `${sujeito} ${cr}`, origem: 'modelo', fonte: n.fonte };
  if (extra.manchete) return extra.manchete;
  const tr = trechoDaEmenta(n.ementa, LIMITE_DURO - sujeito.length - 1);
  if (!tr) return { erro: 'ementa sem verbo inicial ou longa demais para corte em fronteira de oração' };
  return { titulo: `${sujeito} ${tr.texto}`, origem: 'modelo', fonte: n.fonte };
}

// ---------- ICMS ----------
const UNIDADE = (u) => {
  const m = /^R\$ por (.+)$/.exec(u || '');
  return m ? { prefixo: 'R$ ', sufixo: ` por ${m[1]}` } : null;
};
export function modeloIcms(d) {
  const ms = (d.mudancas || []).filter((m) => m.antes && m.depois);
  if (ms.length !== 1 || (d.mudancas || []).length !== 1) return { erro: 'decisão sem uma única mudança com valor antes e depois' };
  const m = ms[0];
  // números da exposição de motivos ou da justificativa do autor não entram como fato (revisão de viés)
  const doc = (d.fontes || []).find((f) => f.url === m.fonte);
  if (doc && /exposi[çc][ãa]o de motivos|justificativa|mensagem/iu.test(doc.titulo || '')) return { erro: 'valores da mudança vêm de documento do autor, não do texto da norma' };
  const u = UNIDADE(m.unidade);
  const quando = m.vigencia ? ` a partir de ${dataBR(m.vigencia)}` : '';
  let titulo;
  if (u) {
    const item = m.item.charAt(0).toLocaleLowerCase('pt-BR') + m.item.slice(1);
    titulo = `ICMS de ${item} passa de ${u.prefixo}${m.antes} para ${u.prefixo}${m.depois}${u.sufixo}${quando}`;
  } else if (/%$/.test(m.antes) && /%$/.test(m.depois)) {
    titulo = `${m.item} passa de ${m.antes} para ${m.depois}${quando}`;
  } else return { erro: 'unidade da mudança sem modelo' };
  if (titulo.length > LIMITE_DURO) return { erro: 'título do modelo longo demais' };
  return { titulo, origem: 'modelo', fonte: m.fonte || d.fontes?.[0]?.url };
}

// ---------- Pareceres de contas ----------
export function modeloContasTce(c, contas) {
  const p = c.parecer || {};
  const concl = String(p.conclusao || '').toLocaleLowerCase('pt-BR');
  if (!['favorável', 'desfavorável'].includes(concl)) return { erro: 'conclusão do parecer não informada na fonte' };
  // mesmo molde para governador e prefeito; lacuna da fonte sobre ressalvas é dita, não omitida
  const ress = p.com_ressalvas === true ? ', com ressalvas' : p.com_ressalvas === false ? ', sem ressalvas' : '; ressalvas não informadas na fonte';
  const titulo = `Tribunal de Contas emite parecer ${concl} às contas de ${p.exercicio} do ${contas}${ress}`;
  if (titulo.length > LIMITE_DURO) return { erro: 'título do modelo longo demais' };
  return { titulo, origem: 'modelo', fonte: p.documento?.url || c.fontes?.[0]?.url || c.processo?.url };
}
export function modeloContasTcu(ex) {
  const lit = limpar(ex.conclusao_parecer || '');
  const m = /estão (em condições de\b[^.]*)/iu.exec(lit);
  if (!m) return { erro: 'conclusão do parecer não informada na fonte' };
  const trecho = tirarPonto(m[1]);
  const titulo = `TCU emite parecer: contas de ${ex.exercicio} do Presidente "${trecho}"`;
  if (titulo.length > LIMITE_DURO) {
    const curto = cortarEmOracao(trecho, LIMITE_DURO - titulo.length + trecho.length, { estrito: true });
    if (!curto) return { erro: 'título do modelo longo demais' };
    return { titulo: `TCU emite parecer: contas de ${ex.exercicio} do Presidente "${curto}"`, origem: 'modelo', fonte: ex.acordao?.url };
  }
  return { titulo, origem: 'modelo', fonte: ex.acordao?.url };
}

export { semFormulaFinal };
