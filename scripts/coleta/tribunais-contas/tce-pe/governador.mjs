// Contas do Governador: entidade "Resultados" filtrada por Tipo=Governo e esfera estadual (E).
// Exercícios sem resultado na API viram item com conclusão null e lacuna; quando a entidade "Processos"
// traz o processo de prestação de contas do Governo do Estado, o número e a situação literal entram no item.
import { consultar, fonte } from './lib.mjs';
import { normalizarRegistro, agruparPorProcesso, resumirProcesso, montarItem, ordenarProcessos, NOME_TRIBUNAL } from './parecer.mjs';

export const PRIMEIRO_EXERCICIO = 2014; // primeiro exercício com processo eletrônico julgado na API (sondagem de 05/11/2026)
const UJ_GOVERNO = /^Governo do Estado de Pernambuco$/i;
const CASA = 'Assembleia Legislativa do Estado de Pernambuco (Alepe)';

/** Baixa todos os resultados de contas de governo da esfera estadual (uma consulta, ~10 registros). */
export async function baixarGovernador() {
  const { url, conteudo } = await consultar('Resultados', { Tipo: 'Governo', EsferaUJPrincipalProcesso: 'E' });
  const regs = conteudo.map(normalizarRegistro).filter((r) => r.esfera === 'E' && UJ_GOVERNO.test(r.uj) && r.tipo === 'Governo');
  return { url, regs, descartados: conteudo.length - regs.length };
}

/** Número no formato do e-TCE ("24100726-4") tirado dos parâmetros cprc e digito do link oficial; senão o literal. */
export function numeroDoLink(numero, linkProcesso) {
  const m = String(linkProcesso || '').match(/cprc=(\d+)&digito=(\d+)/);
  return m ? `${m[1]}-${m[2]}` : numero;
}

/** Processos de prestação de contas do Governo do Estado num exercício (para exercícios ainda sem resultado). */
export async function processosPendentes(exercicio) {
  const { url, conteudo } = await consultar('Processos', { Exercicio: exercicio, Tipo: 'Governo', Esfera: 'E', Modalidade: 'Prestação de Contas' });
  const vistos = new Map();
  for (const p of conteudo) {
    if (!UJ_GOVERNO.test(String(p.NomeUJ ?? '').trim()) || String(p.Tipo ?? '').trim() !== 'Governo') continue;
    const link = String(p.LinkProcesso ?? '').trim() || null;
    const numero = numeroDoLink(String(p.Processo ?? '').trim(), link);
    if (!numero || vistos.has(numero)) continue;
    // Só número, situação e link: as linhas trazem também interessados, que não são copiados.
    vistos.set(numero, { numero, situacao: String(p.Situacao ?? '').trim() || null, tipo: 'Governo', url: link });
  }
  return { url, processos: [...vistos.values()] };
}

/** Monta o item de um exercício do Governador. */
export function montarExercicioGovernador(exercicio, regs, urlConsulta, pendentes = null) {
  const doAno = regs.filter((r) => r.exercicio === exercicio && r.esfera === 'E' && r.tipo === 'Governo' && UJ_GOVERNO.test(r.uj));
  const resumos = ordenarProcessos([...agruparPorProcesso(doAno).values()].map(resumirProcesso));
  const item = montarItem({
    id: `tce-pe-contas-governador-${exercicio}`,
    titulo: `Parecer prévio do ${NOME_TRIBUNAL} sobre as contas do Governador — exercício ${exercicio}`,
    contasDe: 'Governador de Pernambuco',
    exercicio,
    resumo: resumos[0] ?? null,
    outros: resumos.slice(1),
    urlConsulta,
    casaJulgadora: CASA,
    lacunaSemRegistro: 'Parecer prévio não encontrado na API de Dados Abertos do TCE-PE (entidade "Resultados", que lista processos eletrônicos julgados) até a coleta',
  });
  if (!resumos.length && pendentes?.processos.length) {
    const p = pendentes.processos[0];
    item.processo = { classe: ['Prestação de Contas', p.tipo ? `tipo ${p.tipo}` : null].filter(Boolean).join(' — '), numero: p.numero, url: p.url };
    item.situacao_processo_literal = p.situacao;
    item.fontes.push(fonte('API de Dados Abertos do TCE-PE — entidade "Processos"', pendentes.url));
    item.lacunas.unshift(`Processo ${p.numero} de prestação de contas do Governo do Estado registrado na entidade "Processos" com situação "${p.situacao ?? 'não informada'}"`);
    if (pendentes.processos.length > 1) item.lacunas.push(`A entidade "Processos" traz mais de um processo de prestação de contas do Governo do Estado para o exercício (${pendentes.processos.map((x) => x.numero).join(', ')})`);
  }
  return item;
}
